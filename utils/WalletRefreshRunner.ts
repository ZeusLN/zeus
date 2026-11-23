import type { AppStateStatus } from 'react-native';

interface RefreshFlagStore {
    triggerSettingsRefresh: boolean;
}

// Runs the Wallet screen's full refresh (getSettingsAndNavigate) one at a
// time. A settings change that lands while a refresh is in flight is not
// covered by it, so once it settles the flag is checked again and, while
// the Wallet is still focused, one follow-up refresh picks the change up
// right away instead of on the next focus event (#4751).
export default class WalletRefreshRunner {
    private inFlight = false;
    // Whether the app has been in the background since it was last active
    private backgrounded = false;

    constructor(
        private settingsStore: RefreshFlagStore,
        private isFocused: () => boolean,
        // Used for the follow-up refresh, which must not repeat one-off
        // arguments of the first (e.g. share intent data)
        private followUpRefresh: () => Promise<unknown>
    ) {}

    public get running(): boolean {
        return this.inFlight;
    }

    // Takes every AppState change and returns true when the app is active
    // again after being in the background. iOS also reports 'active' after
    // 'inactive' alone, when a system sheet (Face ID, Control Center,
    // Notification Center) covered the app without it leaving the
    // foreground. A refresh there repeats one that ran moments ago (#4791).
    public trackAppState = (appState: AppStateStatus): boolean => {
        if (appState === 'background') {
            this.backgrounded = true;
            return false;
        }
        if (appState !== 'active') return false;
        const resumed = this.backgrounded;
        this.backgrounded = false;
        return resumed;
    };

    // Starts the refresh unless one is already in flight. The returned
    // promise settles once the refresh and any follow-up are done.
    public run = (
        refresh: () => Promise<unknown>
    ): Promise<unknown> | undefined => {
        if (this.inFlight) return;
        return this.start(refresh, true);
    };

    private start = (
        refresh: () => Promise<unknown>,
        allowFollowUp: boolean
    ): Promise<unknown> => {
        // The refresh reads the current settings, so it covers every
        // change flagged so far; only a change made while it runs re-arms
        // the flag.
        this.settingsStore.triggerSettingsRefresh = false;
        this.inFlight = true;
        return refresh().finally(() => {
            this.inFlight = false;
            // At most one follow-up: a write that changes on every refresh
            // must not turn into a refresh loop. Off the Wallet, the next
            // focus event picks the flag up.
            if (
                allowFollowUp &&
                this.settingsStore.triggerSettingsRefresh &&
                this.isFocused()
            ) {
                console.log(
                    '[Wallet] settings changed during refresh, refreshing again'
                );
                return this.start(this.followUpRefresh, false);
            }
        });
    };
}
