import { action, computed, observable, reaction, runInAction } from 'mobx';
import {
    AppState,
    DeviceEventEmitter,
    NativeModules,
    Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SettingsStore from './SettingsStore';

import {
    requestNewTorIdentity,
    restartTor,
    setTorRequestOutcomeListener,
    subscribeTorStatus
} from '../utils/TorUtils';
import type { TorStatus } from '../utils/TorUtils';
import { localeString } from '../utils/LocaleUtils';

export const TOR_PERSISTENT_SERVICE_ENABLED = 'persistentTorServiceEnabled';
const NEW_IDENTITY_EVENT = 'TorServiceNewIdentity';

// Consecutive requests that must fail at the transport level before a
// daemon that reports itself as running is shown as degraded
export const TOR_FAILURE_THRESHOLD = 2;

export type TorIndicator =
    | 'off'
    | 'connecting'
    | 'connected'
    | 'degraded'
    | 'error';

// Theme color keys for each indicator state
export const TOR_INDICATOR_COLORS: { [key in TorIndicator]: string } = {
    connected: 'success',
    connecting: 'bitcoin',
    degraded: 'bitcoin',
    // warning is a brighter red than error, which is also the background
    // of the wallet's connection error screen
    error: 'warning',
    off: 'secondaryText'
};

export const getTorIndicator = (
    status: TorStatus | null,
    consecutiveFailures: number
): TorIndicator => {
    if (!status) return 'off';
    switch (status.state) {
        case 'starting':
        case 'stopping':
            return 'connecting';
        case 'failed':
            return 'error';
        case 'running':
            if (
                status.connectivity.network === 'down' ||
                !status.connectivity.circuitEstablished ||
                consecutiveFailures >= TOR_FAILURE_THRESHOLD
            ) {
                return 'degraded';
            }
            return 'connected';
        default:
            return 'off';
    }
};

export const getTorStatusText = (
    status: TorStatus | null,
    consecutiveFailures: number
): string => {
    if (status?.state === 'starting') {
        return localeString('views.Settings.Networking.Tor.bootstrapping', {
            progress: Math.round(status.bootstrap.progress)
        });
    }
    if (status?.state === 'stopping') {
        return localeString('views.Settings.Networking.Tor.stopping');
    }
    switch (getTorIndicator(status, consecutiveFailures)) {
        case 'connected':
            return localeString('views.Settings.Networking.Tor.connected');
        case 'degraded':
            return localeString('views.Settings.Networking.Tor.degraded');
        case 'error':
            return localeString('views.Settings.Networking.Tor.error');
        default:
            return localeString('views.Settings.Networking.Tor.stopped');
    }
};

export default class TorStore {
    @observable public status: TorStatus | null = null;
    @observable public consecutiveFailures: number = 0;
    @observable public persistentServiceEnabled: boolean = false;
    @observable public actionInFlight: 'newIdentity' | 'restart' | null = null;
    @observable public actionError: string | null = null;

    private settingsStore: SettingsStore;
    private initialized = false;
    private serviceRunning = false;
    private lastNotificationText: string | null = null;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    // Whether the active wallet routes its node traffic through Tor
    @computed public get torInUse(): boolean {
        const { enableTor, host, url } = this.settingsStore;
        const address = host || url || '';
        return !!enableTor || address.includes('.onion');
    }

    @computed public get indicator(): TorIndicator {
        return getTorIndicator(this.status, this.consecutiveFailures);
    }

    @computed public get statusText(): string {
        return getTorStatusText(this.status, this.consecutiveFailures);
    }

    public initialize = async () => {
        if (this.initialized) return;
        this.initialized = true;

        setTorRequestOutcomeListener(this.onRequestOutcome);
        subscribeTorStatus(this.onStatus);

        if (Platform.OS === 'android') {
            await this.loadPersistentServiceSetting();
            DeviceEventEmitter.addListener(NEW_IDENTITY_EVENT, () => {
                this.newIdentity();
            });
            reaction(
                () => [
                    this.persistentServiceEnabled,
                    this.torInUse,
                    this.status?.state,
                    this.statusText
                ],
                () => this.syncAndroidService(),
                { fireImmediately: true }
            );
            // Android does not allow starting a foreground service from
            // the background, so a start deferred there happens here
            AppState.addEventListener('change', (state) => {
                if (state === 'active') this.syncAndroidService();
            });
        }
    };

    @action
    private onStatus = (status: TorStatus) => {
        this.status = status;
        if (status.state !== 'running') this.consecutiveFailures = 0;
    };

    @action
    private onRequestOutcome = (ok: boolean) => {
        this.consecutiveFailures = ok ? 0 : this.consecutiveFailures + 1;
    };

    public newIdentity = () =>
        this.runAction('newIdentity', requestNewTorIdentity);

    public restart = () => this.runAction('restart', restartTor);

    private runAction = async (
        name: 'newIdentity' | 'restart',
        fn: () => Promise<void>
    ) => {
        if (this.actionInFlight) return;
        runInAction(() => {
            this.actionInFlight = name;
            this.actionError = null;
        });
        try {
            await fn();
            runInAction(() => {
                this.consecutiveFailures = 0;
            });
        } catch (e: any) {
            runInAction(() => {
                this.actionError = e?.message || String(e);
            });
        } finally {
            runInAction(() => {
                this.actionInFlight = null;
            });
        }
    };

    private loadPersistentServiceSetting = async () => {
        try {
            const stored = await AsyncStorage.getItem(
                TOR_PERSISTENT_SERVICE_ENABLED
            );
            runInAction(() => {
                this.persistentServiceEnabled = stored === 'true';
            });
        } catch (e) {
            console.warn('Failed to load persistent Tor service setting', e);
        }
    };

    public setPersistentServiceEnabled = async (enabled: boolean) => {
        await AsyncStorage.setItem(
            TOR_PERSISTENT_SERVICE_ENABLED,
            enabled.toString()
        );
        runInAction(() => {
            this.persistentServiceEnabled = enabled;
        });
    };

    private syncAndroidService = async () => {
        const { TorServiceModule } = NativeModules;
        if (Platform.OS !== 'android' || !TorServiceModule) return;

        const state = this.status?.state;
        const shouldRun =
            this.persistentServiceEnabled &&
            this.torInUse &&
            (state === 'starting' || state === 'running' || state === 'failed');

        try {
            if (!shouldRun) {
                if (this.serviceRunning) {
                    this.serviceRunning = false;
                    this.lastNotificationText = null;
                    await TorServiceModule.stopService();
                }
                return;
            }

            const text = this.statusText;
            if (this.serviceRunning && text === this.lastNotificationText) {
                return;
            }
            if (!this.serviceRunning && AppState.currentState !== 'active') {
                return;
            }

            const title = localeString('views.Settings.Networking.tor');
            const newIdentityLabel = localeString(
                'views.Settings.Networking.Tor.newIdentity'
            );
            if (this.serviceRunning) {
                await TorServiceModule.updateNotification(
                    title,
                    text,
                    newIdentityLabel
                );
            } else {
                // set before awaiting so a status update that lands
                // mid-start updates the notification instead of
                // starting the service a second time
                this.serviceRunning = true;
                try {
                    await TorServiceModule.startService(
                        title,
                        text,
                        newIdentityLabel
                    );
                } catch (e) {
                    this.serviceRunning = false;
                    throw e;
                }
            }
            this.lastNotificationText = text;
        } catch (e) {
            console.warn('Failed to sync Tor foreground service', e);
        }
    };
}
