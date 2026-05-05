import { action, observable, runInAction } from 'mobx';
import NetInfo, {
    NetInfoState,
    NetInfoSubscription
} from '@react-native-community/netinfo';

import SettingsStore from './SettingsStore';

const POLL_INTERVAL = 15000; // 15s
const VERIFY_TIMEOUT_MS = 5000;
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

    private probeUrl = async (url: string): Promise<boolean> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
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

    private verifyConnectivity = async (): Promise<boolean> => {
        const urls = [this.getReachabilityUrl(), ...FALLBACK_REACHABILITY_URLS];
        const results = await Promise.all(
            urls.map((url) => this.probeUrl(url))
        );
        return results.some((ok) => ok);
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
            const wasOffline = this.isOffline;
            runInAction(() => {
                this.isOffline = !online;
            });
            if (online && wasOffline) {
                this.reconnectCallbacks.forEach((cb) => cb());
            }
        });
    };

    private updateState = (state: NetInfoState) => {
        // isConnected === false is a reliable native signal — mark immediately
        if (state.isConnected === false) {
            runInAction(() => {
                this.isOffline = true;
            });
            return;
        }

        // isInternetReachable === true is reliable — mark online immediately
        if (state.isInternetReachable === true) {
            const wasOffline = this.isOffline;
            runInAction(() => {
                this.isOffline = false;
            });
            if (wasOffline) {
                this.reconnectCallbacks.forEach((cb) => cb());
            }
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
