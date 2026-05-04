import { action, observable, runInAction } from 'mobx';
import NetInfo, {
    NetInfoState,
    NetInfoSubscription
} from '@react-native-community/netinfo';

import SettingsStore from './SettingsStore';

const REACHABILITY_POLL_INTERVAL = 15000; // 15s
const OFFLINE_DEBOUNCE_MS = 10000; // 10s
const VERIFY_TIMEOUT_MS = 5000;
const DEFAULT_REACHABILITY_HOST = 'mempool.space';
// Fallback URLs tried when the primary reachability host is unreachable.
// If ANY of these succeed, the device is online.
const FALLBACK_REACHABILITY_URLS = [
    'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo',
    'https://cloudflare.com/cdn-cgi/trace'
];

export default class ConnectivityStore {
    @observable public isOffline: boolean = false;

    private netInfoUnsubscribe: NetInfoSubscription | null = null;
    private reachabilityInterval: ReturnType<typeof setInterval> | null = null;
    private offlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
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

        // Custom host may include scheme (e.g. http://mynode:3006#mempool.space)
        if (custom && host.indexOf('://') !== -1) {
            const hostUrl = host.split('#')[0];
            return `${hostUrl}/api/blocks/tip/height`;
        }

        return `https://${host}/api/blocks/tip/height`;
    };

    public onReconnect = (callback: () => void) => {
        this.reconnectCallbacks.push(callback);
    };

    private clearDebounce = () => {
        if (this.offlineDebounceTimer) {
            clearTimeout(this.offlineDebounceTimer);
            this.offlineDebounceTimer = null;
        }
    };

    private probeUrl = async (url: string): Promise<boolean> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
        try {
            // Any HTTP response — even 4xx/5xx — proves connectivity;
            // only network-level failures (caught below) mean unreachable
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

    /**
     * Confirm we're truly offline before trusting NetInfo's
     * isInternetReachable=false. Probe the configured reachability host
     * and fallback URLs in parallel. If ANY respond the device is online.
     */
    private verifyOffline = async (): Promise<boolean> => {
        const urls = [this.getReachabilityUrl(), ...FALLBACK_REACHABILITY_URLS];
        const results = await Promise.all(
            urls.map((url) => this.probeUrl(url))
        );
        return !results.some((ok) => ok);
    };

    private updateState = (state: NetInfoState) => {
        // isConnected === false is a reliable native signal (airplane mode, no
        // network interface) — surface immediately without debouncing
        if (state.isConnected === false) {
            this.clearDebounce();
            runInAction(() => {
                this.isOffline = true;
            });
            return;
        }

        // isInternetReachable === false can be a false positive when the
        // reachability fetch fails transiently; debounce and then verify
        // with our own fetch before marking offline.
        // When already offline, skip the debounce and verify immediately
        // so recovery isn't delayed.
        if (state.isInternetReachable === false) {
            if (this.isOffline) {
                if (!this.verifyInFlight) {
                    this.verifyInFlight = true;
                    this.verifyOffline().then((trulyOffline) => {
                        this.verifyInFlight = false;
                        if (!trulyOffline && this.isOffline) {
                            runInAction(() => {
                                this.isOffline = false;
                            });
                            this.reconnectCallbacks.forEach((cb) => cb());
                        }
                    });
                }
            } else if (!this.offlineDebounceTimer) {
                const timer = setTimeout(async () => {
                    const trulyOffline = await this.verifyOffline();
                    // Only apply if this timer is still the active one —
                    // an online event during verifyOffline will have
                    // cleared it via clearDebounce()
                    if (this.offlineDebounceTimer === timer) {
                        if (trulyOffline) {
                            runInAction(() => {
                                this.isOffline = true;
                            });
                        }
                        this.offlineDebounceTimer = null;
                    }
                }, OFFLINE_DEBOUNCE_MS);
                this.offlineDebounceTimer = timer;
            }
            return;
        }

        // Online — isConnected is not false and isInternetReachable is true or
        // null (null = unknown, treat as online to avoid false positives)
        this.clearDebounce();
        const wasOffline = this.isOffline;
        runInAction(() => {
            this.isOffline = false;
        });
        if (wasOffline) {
            this.reconnectCallbacks.forEach((cb) => cb());
        }
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
        // Poll every 15s so isInternetReachable gets re-evaluated
        // after reconnect (the listener alone can leave it stale)
        this.reachabilityInterval = setInterval(() => {
            NetInfo.fetch().then(this.updateState);
        }, REACHABILITY_POLL_INTERVAL);
    };

    @action
    public stop = () => {
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }
        if (this.reachabilityInterval) {
            clearInterval(this.reachabilityInterval);
            this.reachabilityInterval = null;
        }
        this.clearDebounce();
    };

    @action
    public reset = () => {
        this.stop();
        this.isOffline = false;
    };
}
