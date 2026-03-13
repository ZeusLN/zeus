import { action, observable, runInAction } from 'mobx';
import NetInfo, {
    NetInfoState,
    NetInfoSubscription
} from '@react-native-community/netinfo';

const REACHABILITY_POLL_INTERVAL = 15000; // 15s

export default class ConnectivityStore {
    @observable public isOffline: boolean = false;

    private netInfoUnsubscribe: NetInfoSubscription | null = null;
    private reachabilityInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectCallbacks: Array<() => void> = [];

    public onReconnect = (callback: () => void) => {
        this.reconnectCallbacks.push(callback);
    };

    private updateState = (state: NetInfoState) => {
        const wasOffline = this.isOffline;
        runInAction(() => {
            // isInternetReachable can be null (unknown) initially;
            // treat null as "not offline" to avoid false positives
            this.isOffline =
                state.isConnected === false ||
                state.isInternetReachable === false;
        });
        if (wasOffline && !this.isOffline) {
            this.reconnectCallbacks.forEach((cb) => cb());
        }
    };

    @action
    public start = () => {
        if (this.netInfoUnsubscribe) return;
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
    };

    @action
    public reset = () => {
        this.stop();
        this.isOffline = false;
    };
}
