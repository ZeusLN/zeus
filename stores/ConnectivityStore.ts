import { action, observable, runInAction } from 'mobx';
import { Platform } from 'react-native';
import NetInfo, {
    NetInfoState,
    NetInfoSubscription
} from '@react-native-community/netinfo';

import SettingsStore from './SettingsStore';

const POLL_INTERVAL = 15000; // 15s
const VERIFY_TIMEOUT_MS = 5000;
// Budget for the probe that runs before wallet init. A slow answer is
// treated as offline: that costs one session of skipped VSS and sync, while
// waiting costs every startup.
const STARTUP_PROBE_TIMEOUT_MS = 1500;
const DEFAULT_REACHABILITY_HOST = 'mempool.space';
const PLATFORM_REACHABILITY_URL =
    Platform.OS === 'ios'
        ? 'https://www.apple.com/library/test/success.html'
        : 'https://www.google.com/generate_204';
const FALLBACK_REACHABILITY_URLS = [
    'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo',
    PLATFORM_REACHABILITY_URL
];

export default class ConnectivityStore {
    @observable public isOffline: boolean = false;

    private netInfoUnsubscribe: NetInfoSubscription | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private verifyInFlight: boolean = false;
    // Incremented by every stop(). A check remembers the value it started
    // with and drops its result if the value has changed since.
    private generation: number = 0;
    private reconnectCallbacks: Array<() => void> = [];
    private settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    private getReachabilityUrl = (): string => {
        const { privacy } = this.settingsStore.settings;
        const custom = privacy?.defaultBlockExplorer === 'Custom';
        const host =
            custom && privacy?.customBlockExplorer
                ? privacy.customBlockExplorer
                : privacy?.defaultBlockExplorer || DEFAULT_REACHABILITY_HOST;

        if (custom && host.indexOf('://') !== -1) {
            const hostUrl = host.split('#')[0];
            return `${hostUrl}/api/blocks/tip/height`;
        }

        return `https://${host}/api/blocks/tip/height`;
    };

    public onReconnect = (callback: () => void) => {
        this.reconnectCallbacks.push(callback);
    };

    private probeUrl = async (
        url: string,
        timeoutMs: number
    ): Promise<boolean> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            await fetch(url, {
                method: 'HEAD',
                signal: controller.signal
            });
            return true;
        } catch {
            return false;
        } finally {
            clearTimeout(timeout);
        }
    };

    private verifyConnectivity = async (
        timeoutMs: number = VERIFY_TIMEOUT_MS
    ): Promise<boolean> => {
        const urls = [this.getReachabilityUrl(), ...FALLBACK_REACHABILITY_URLS];
        const results = await Promise.all(
            urls.map((url) => this.probeUrl(url, timeoutMs))
        );
        return results.some((ok) => ok);
    };

    // Fires the reconnect callbacks on an offline -> online transition. Each
    // callback is isolated so one that throws cannot skip the rest.
    private setOnlineState = (online: boolean) => {
        const wasOffline = this.isOffline;
        runInAction(() => {
            this.isOffline = !online;
        });
        if (!online || !wasOffline) return;
        this.reconnectCallbacks.forEach((cb) => {
            try {
                cb();
            } catch (e) {
                console.error(
                    'ConnectivityStore: reconnect callback failed',
                    e
                );
            }
        });
    };

    /**
     * Probes right away with a short budget and records the result, so
     * wallet init can read isOffline before it starts network-bound work.
     * Resolves to whether we are online; always true when the offline check
     * is disabled. Holds verifyInFlight so a NetInfo-triggered check during
     * the probe does not start a second one.
     */
    public checkNow = async (): Promise<boolean> => {
        if (this.settingsStore.settings?.networking?.disableOfflineCheck)
            return true;
        const generation = this.generation;
        this.verifyInFlight = true;
        const online = await this.verifyConnectivity(STARTUP_PROBE_TIMEOUT_MS);
        if (generation !== this.generation) return online;
        this.verifyInFlight = false;
        this.setOnlineState(online);
        return online;
    };

    /**
     * Core logic: probe fallback URLs and update isOffline accordingly.
     * Called by the poll interval and on NetInfo state changes.
     */
    private check = () => {
        if (this.verifyInFlight) return;
        this.verifyInFlight = true;
        const generation = this.generation;
        this.verifyConnectivity().then((online) => {
            // The probes can outlast stop(), e.g. a wallet switch while
            // offline; their result must not reach a later session
            if (generation !== this.generation) return;
            this.verifyInFlight = false;
            this.setOnlineState(online);
        });
    };

    private updateState = (state: NetInfoState) => {
        // isConnected === false is a reliable native signal — mark immediately
        if (state.isConnected === false) {
            this.setOnlineState(false);
            return;
        }

        // isInternetReachable === true is reliable — mark online immediately
        if (state.isInternetReachable === true) {
            this.setOnlineState(true);
            return;
        }

        // null or false — verify ourselves with fallback probes
        this.check();
    };

    @action
    public start = () => {
        if (this.netInfoUnsubscribe) return;
        if (this.settingsStore.settings?.networking?.disableOfflineCheck)
            return;

        NetInfo.configure({
            reachabilityUrl: this.getReachabilityUrl(),
            reachabilityTest: async (response) => response.status === 200,
            useNativeReachability: false
        });

        // NetInfo can deliver a state after stop() (a poll's fetch, the
        // initial state of a new listener), so tie its states to this session
        const generation = this.generation;
        const onState = (state: NetInfoState) => {
            if (generation === this.generation) this.updateState(state);
        };
        this.netInfoUnsubscribe = NetInfo.addEventListener(onState);
        this.pollInterval = setInterval(() => {
            NetInfo.fetch().then(onState);
        }, POLL_INTERVAL);
    };

    @action
    public stop = () => {
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.generation++;
        // A probe still in flight must not hold back the next session's
        // first check
        this.verifyInFlight = false;
        // Nothing updates the flag once monitoring stops, so a stale
        // offline state would outlive e.g. a switch to another wallet
        this.isOffline = false;
    };
}
