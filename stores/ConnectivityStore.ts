import { action, observable, runInAction } from 'mobx';
import NetInfo, {
    NetInfoState,
    NetInfoSubscription
} from '@react-native-community/netinfo';

import SettingsStore from './SettingsStore';

const POLL_INTERVAL = 15000; // 15s
const VERIFY_TIMEOUT_MS = 5000;
// Tight budget for the pre-startup probe — we'd rather declare ourselves
// offline and skip 30+s of wallet-init timeouts than block startup waiting
// for a sluggish reachability host.
const INITIAL_PROBE_TIMEOUT_MS = 1500;
const DEFAULT_REACHABILITY_HOST = 'mempool.space';
const FALLBACK_REACHABILITY_URLS = [
    'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo',
    'https://cloudflare.com/cdn-cgi/trace'
];

export default class ConnectivityStore {
    @observable public isOffline: boolean = false;

    private netInfoUnsubscribe: NetInfoSubscription | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private verifyInFlight: boolean = false;
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
        timeoutMs: number = VERIFY_TIMEOUT_MS
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

    /**
     * Update isOffline and fire reconnect callbacks if we transitioned
     * from offline to online. Each callback is wrapped in its own
     * try/catch so one bad listener can't starve the rest.
     */
    private setOnlineState = (online: boolean) => {
        const wasOffline = this.isOffline;
        runInAction(() => {
            this.isOffline = !online;
        });
        if (online && wasOffline) {
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
        }
    };

    /**
     * Run an immediate probe with a tight budget and update isOffline.
     * Intended to be awaited *before* wallet initialization so that
     * downstream code (LDK Node, CashuStore) sees the correct offline
     * state and can skip network-bound work.
     */
    public checkNow = async (
        timeoutMs: number = INITIAL_PROBE_TIMEOUT_MS
    ): Promise<boolean> => {
        if (this.settingsStore.settings?.networking?.disableOfflineCheck) {
            return true;
        }
        const online = await this.verifyConnectivity(timeoutMs);
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
        this.verifyConnectivity().then((online) => {
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

        this.netInfoUnsubscribe = NetInfo.addEventListener(this.updateState);
        this.pollInterval = setInterval(() => {
            NetInfo.fetch().then(this.updateState);
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
    };

    @action
    public reset = () => {
        this.stop();
        this.isOffline = false;
    };
}
