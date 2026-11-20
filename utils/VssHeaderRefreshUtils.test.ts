import {
    VSS_HEADER_BUSY_RETRY_MS,
    VSS_HEADER_CHECK_INTERVAL_MS,
    VSS_HEADER_MAX_AGE_MS,
    VssHeaderRefresher,
    clearVssHeaderIssued,
    getVssHeaderIssuedAt,
    isLdkNodeBusy,
    isVssHeaderDue,
    noteVssHeaderIssued
} from './VssHeaderRefreshUtils';
import {
    deriveVssSigningKeyFromSeed,
    generateVssAuthHeaders
} from './VssAuthUtils';

const HOUR = 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 17, 8, 0, 0);

const vssKey = deriveVssSigningKeyFromSeed(Buffer.alloc(64, 7));

// Signs a header the way LdkNodeInjection.initializeNode does at build time
// and records when, as initializeNode does
const buildNodeWithHeader = (): string => {
    noteVssHeaderIssued(Date.now());
    return generateVssAuthHeaders('', undefined, vssKey).authorization;
};

const headerTimestamp = (authorization: string) =>
    // hex(pubkey 33B) + hex(signature 64B) + decimal timestamp
    Number(authorization.slice((33 + 64) * 2));

const flush = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

const idleStores = () => ({
    SettingsStore: { connecting: false },
    TransactionsStore: {
        loading: false,
        paymentInFlight: false,
        crafting: false
    },
    ChannelsStore: {
        openingChannel: false,
        closingChannel: false,
        syncOpensInFlight: 0
    }
});

describe('VssHeaderRefreshUtils', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(START);
        clearVssHeaderIssued();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('isVssHeaderDue', () => {
        it('is false without a header', () => {
            expect(isVssHeaderDue(undefined, START)).toBe(false);
        });

        it('is false below the maximum age', () => {
            expect(
                isVssHeaderDue(START, START + VSS_HEADER_MAX_AGE_MS - 1)
            ).toBe(false);
        });

        it('is true at and past the maximum age', () => {
            expect(isVssHeaderDue(START, START + VSS_HEADER_MAX_AGE_MS)).toBe(
                true
            );
            expect(isVssHeaderDue(START, START + 30 * HOUR)).toBe(true);
        });

        it('rebuilds before the 24 hour server window closes', () => {
            expect(VSS_HEADER_MAX_AGE_MS).toBeLessThan(24 * HOUR);
            expect(
                VSS_HEADER_MAX_AGE_MS + VSS_HEADER_CHECK_INTERVAL_MS
            ).toBeLessThan(24 * HOUR);
        });
    });

    describe('isLdkNodeBusy', () => {
        it('is false when nothing is running', () => {
            expect(isLdkNodeBusy(idleStores())).toBe(false);
        });

        it.each([
            ['a connect', (s: any) => (s.SettingsStore.connecting = true)],
            [
                'a Lightning payment',
                (s: any) => (s.TransactionsStore.paymentInFlight = true)
            ],
            [
                'an on-chain send or broadcast',
                (s: any) => (s.TransactionsStore.loading = true)
            ],
            [
                'a PSBT being crafted',
                (s: any) => (s.TransactionsStore.crafting = true)
            ],
            [
                'a channel open',
                (s: any) => (s.ChannelsStore.openingChannel = true)
            ],
            [
                'a channel close',
                (s: any) => (s.ChannelsStore.closingChannel = true)
            ],
            [
                'an open that has not settled',
                (s: any) => (s.ChannelsStore.syncOpensInFlight = 1)
            ]
        ])('is true during %s', (_name, setBusy) => {
            const stores = idleStores();
            setBusy(stores);
            expect(isLdkNodeBusy(stores)).toBe(true);
        });
    });

    describe('VssHeaderRefresher', () => {
        const setup = ({
            busy = false,
            enabled = true
        }: { busy?: boolean; enabled?: boolean } = {}) => {
            const state = { busy, enabled };
            const headers: string[] = [];
            const rebuild = jest.fn(async () => {
                headers.push(buildNodeWithHeader());
            });
            const refresher = new VssHeaderRefresher({
                isEnabled: () => state.enabled,
                isBusy: () => state.busy,
                rebuild
            });
            return { state, headers, rebuild, refresher };
        };

        it('rebuilds once with a new header on resume when the header is past the threshold', async () => {
            const original = buildNodeWithHeader();
            const { refresher, rebuild, headers } = setup();

            jest.setSystemTime(START + 21 * HOUR);
            refresher.handleAppStateChange('active');
            await flush();

            expect(rebuild).toHaveBeenCalledTimes(1);
            expect(headers).toHaveLength(1);
            expect(headers[0]).not.toEqual(original);
            expect(headerTimestamp(headers[0])).toEqual(
                Math.floor((START + 21 * HOUR) / 1000)
            );
            expect(headerTimestamp(original)).toEqual(Math.floor(START / 1000));
            expect(getVssHeaderIssuedAt()).toEqual(START + 21 * HOUR);

            // The new header is fresh, so the next resume does not rebuild
            refresher.handleAppStateChange('background');
            refresher.handleAppStateChange('active');
            await flush();
            expect(rebuild).toHaveBeenCalledTimes(1);
            refresher.stop();
        });

        it('does not rebuild on resume when the header is below the threshold', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild } = setup();

            jest.setSystemTime(START + 19 * HOUR);
            refresher.handleAppStateChange('active');
            await flush();

            expect(rebuild).not.toHaveBeenCalled();
            refresher.stop();
        });

        it('does nothing when no node was built with a header', async () => {
            const { refresher, rebuild } = setup();

            jest.setSystemTime(START + 30 * HOUR);
            refresher.handleAppStateChange('active');
            await flush();

            expect(rebuild).not.toHaveBeenCalled();
            refresher.stop();
        });

        it('does nothing when the selected wallet is not an LDK Node wallet', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild } = setup({ enabled: false });

            jest.setSystemTime(START + 21 * HOUR);
            refresher.handleAppStateChange('active');
            await flush();
            jest.advanceTimersByTime(VSS_HEADER_BUSY_RETRY_MS);
            await flush();

            expect(rebuild).not.toHaveBeenCalled();
            refresher.stop();
        });

        it('defers the rebuild while the node is busy and runs it once it is not', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild, state } = setup({ busy: true });

            jest.setSystemTime(START + 21 * HOUR);
            refresher.handleAppStateChange('active');
            await flush();
            expect(rebuild).not.toHaveBeenCalled();

            // Still busy at the first retry
            jest.advanceTimersByTime(VSS_HEADER_BUSY_RETRY_MS);
            await flush();
            expect(rebuild).not.toHaveBeenCalled();

            state.busy = false;
            jest.advanceTimersByTime(VSS_HEADER_BUSY_RETRY_MS);
            await flush();
            expect(rebuild).toHaveBeenCalledTimes(1);
            refresher.stop();
        });

        it('does not stack rebuilds or timers on repeated resumes', async () => {
            buildNodeWithHeader();
            let finishRebuild!: () => void;
            const rebuild = jest.fn(
                () =>
                    new Promise<void>((resolve) => {
                        finishRebuild = () => {
                            noteVssHeaderIssued(Date.now());
                            resolve();
                        };
                    })
            );
            const refresher = new VssHeaderRefresher({
                isEnabled: () => true,
                isBusy: () => false,
                rebuild
            });

            jest.setSystemTime(START + 21 * HOUR);
            refresher.handleAppStateChange('active');
            refresher.handleAppStateChange('active');
            refresher.handleAppStateChange('inactive');
            refresher.handleAppStateChange('active');
            await flush();

            expect(rebuild).toHaveBeenCalledTimes(1);
            // One check interval, no extra timers
            expect(jest.getTimerCount()).toEqual(1);

            finishRebuild();
            await flush();
            refresher.handleAppStateChange('active');
            await flush();
            expect(rebuild).toHaveBeenCalledTimes(1);
            expect(jest.getTimerCount()).toEqual(1);
            refresher.stop();
        });

        it('does not stack deferred retries on repeated resumes while busy', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild, state } = setup({ busy: true });

            jest.setSystemTime(START + 21 * HOUR);
            refresher.handleAppStateChange('active');
            refresher.handleAppStateChange('active');
            refresher.handleAppStateChange('active');
            await flush();
            // The check interval and a single retry
            expect(jest.getTimerCount()).toEqual(2);

            state.busy = false;
            jest.advanceTimersByTime(VSS_HEADER_BUSY_RETRY_MS);
            await flush();
            expect(rebuild).toHaveBeenCalledTimes(1);
            refresher.stop();
        });

        it('rebuilds from the timer while the app stays in the foreground', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild } = setup();

            refresher.handleAppStateChange('active');
            await flush();
            expect(rebuild).not.toHaveBeenCalled();

            jest.advanceTimersByTime(
                VSS_HEADER_MAX_AGE_MS + VSS_HEADER_CHECK_INTERVAL_MS
            );
            await flush();
            expect(rebuild).toHaveBeenCalledTimes(1);
            refresher.stop();
        });

        it('stops the timer in the background', async () => {
            buildNodeWithHeader();
            const { refresher, rebuild } = setup();

            refresher.handleAppStateChange('active');
            refresher.handleAppStateChange('background');
            expect(jest.getTimerCount()).toEqual(0);

            jest.advanceTimersByTime(30 * HOUR);
            await flush();
            expect(rebuild).not.toHaveBeenCalled();
        });

        it('tries again on the next check after a failed rebuild', async () => {
            buildNodeWithHeader();
            const rebuild = jest
                .fn()
                .mockRejectedValueOnce(new Error('build failed'))
                .mockImplementationOnce(async () => {
                    noteVssHeaderIssued(Date.now());
                });
            const refresher = new VssHeaderRefresher({
                isEnabled: () => true,
                isBusy: () => false,
                rebuild
            });

            jest.setSystemTime(START + 21 * HOUR);
            await refresher.check();
            expect(rebuild).toHaveBeenCalledTimes(1);

            await refresher.check();
            expect(rebuild).toHaveBeenCalledTimes(2);
            expect(getVssHeaderIssuedAt()).toEqual(START + 21 * HOUR);
        });
    });
});
