/**
 * LDK Node is built with a fixed VSS Authorization header (see
 * VssAuthUtils.generateVssAuthHeaders) and sends that same header with every
 * VSS request for as long as the node runs. The header carries a signed
 * timestamp that the VSS server accepts for 24 hours, so after 24 hours of
 * uptime every backup write is refused. Until the node can sign a header per
 * request, the app rebuilds the node with a newly signed header before the
 * old one expires: when the app returns to the foreground and on a timer
 * while it stays there.
 */

// Rebuild once the header is this old, leaving 4 hours before the server's
// 24 hour window closes
export const VSS_HEADER_MAX_AGE_MS = 20 * 60 * 60 * 1000;
// How often the header age is checked while the app is in the foreground
export const VSS_HEADER_CHECK_INTERVAL_MS = 15 * 60 * 1000;
// How long a rebuild waits while a payment or channel operation is running
export const VSS_HEADER_BUSY_RETRY_MS = 60 * 1000;

// When the header the running node was built with was signed, or undefined
// when no node with a VSS header is running
let headerIssuedAt: number | undefined;

export const noteVssHeaderIssued = (issuedAt: number) => {
    headerIssuedAt = issuedAt;
};

export const clearVssHeaderIssued = () => {
    headerIssuedAt = undefined;
};

export const getVssHeaderIssuedAt = () => headerIssuedAt;

export const isVssHeaderDue = (
    issuedAt: number | undefined,
    now: number,
    maxAgeMs: number = VSS_HEADER_MAX_AGE_MS
): boolean => issuedAt !== undefined && now - issuedAt >= maxAgeMs;

interface BusyStores {
    SettingsStore: { connecting: boolean };
    TransactionsStore: {
        loading: boolean;
        paymentInFlight: boolean;
        crafting: boolean;
    };
    ChannelsStore: {
        openingChannel: boolean;
        closingChannel: boolean;
        syncOpensInFlight: number;
    };
}

// True while stopping the node would interrupt a connect, a payment, an
// on-chain send or a channel open or close started from the app
export const isLdkNodeBusy = ({
    SettingsStore,
    TransactionsStore,
    ChannelsStore
}: BusyStores): boolean =>
    SettingsStore.connecting ||
    TransactionsStore.paymentInFlight ||
    TransactionsStore.loading ||
    TransactionsStore.crafting ||
    ChannelsStore.openingChannel ||
    ChannelsStore.closingChannel ||
    ChannelsStore.syncOpensInFlight > 0;

interface RefresherOptions {
    // False when the selected wallet is not an LDK Node wallet
    isEnabled: () => boolean;
    isBusy: () => boolean;
    // Stops the node and builds it again, which signs a new header
    rebuild: () => Promise<void>;
    now?: () => number;
}

export class VssHeaderRefresher {
    private checkTimer?: ReturnType<typeof setInterval>;
    private retryTimer?: ReturnType<typeof setTimeout>;
    private rebuilding?: Promise<void>;
    private now: () => number;

    constructor(private options: RefresherOptions) {
        this.now = options.now ?? Date.now;
    }

    public handleAppStateChange = (appState: string) => {
        if (appState === 'active') {
            this.startTimer();
            this.check();
        } else if (appState === 'background') {
            this.stop();
        }
    };

    // Clears the timers. A rebuild already running is left to finish.
    public stop = () => {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = undefined;
        }
        this.clearRetry();
    };

    // Rebuilds the node if its header is due and nothing is using the node.
    // While busy, checks again after VSS_HEADER_BUSY_RETRY_MS.
    public check = (): Promise<void> => {
        if (this.rebuilding) return this.rebuilding;
        if (!this.options.isEnabled()) return Promise.resolve();
        if (!isVssHeaderDue(getVssHeaderIssuedAt(), this.now())) {
            return Promise.resolve();
        }
        if (this.options.isBusy()) {
            console.log(
                'LDK Node: VSS auth header is due, waiting for the running operation to finish'
            );
            this.scheduleRetry();
            return Promise.resolve();
        }
        this.clearRetry();
        console.log(
            'LDK Node: VSS auth header is due, rebuilding the node to sign a new one'
        );
        this.rebuilding = this.options
            .rebuild()
            .catch((e) =>
                console.warn(
                    'LDK Node: rebuild for a new VSS header failed:',
                    e
                )
            )
            .finally(() => {
                this.rebuilding = undefined;
            });
        return this.rebuilding;
    };

    private startTimer() {
        if (this.checkTimer) return;
        this.checkTimer = setInterval(
            () => this.check(),
            VSS_HEADER_CHECK_INTERVAL_MS
        );
    }

    private scheduleRetry() {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            this.check();
        }, VSS_HEADER_BUSY_RETRY_MS);
    }

    private clearRetry() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
        }
    }
}
