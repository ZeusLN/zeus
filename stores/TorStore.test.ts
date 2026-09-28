const mockPlatform = { OS: 'android' };
const mockAppState = {
    currentState: 'active',
    addEventListener: jest.fn()
};
const mockTorServiceModule = {
    startService: jest.fn(),
    updateNotification: jest.fn(),
    stopService: jest.fn()
};
const mockDeviceEventEmitter = { addListener: jest.fn() };
const mockStorage: { [key: string]: string } = {};

// Getters because imports are hoisted above the mock constants, so the
// factory runs before they are initialized
jest.mock('react-native', () => ({
    get Platform() {
        return mockPlatform;
    },
    get AppState() {
        return mockAppState;
    },
    get NativeModules() {
        return { TorServiceModule: mockTorServiceModule };
    },
    get DeviceEventEmitter() {
        return mockDeviceEventEmitter;
    }
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key])),
    setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
        return Promise.resolve();
    })
}));

jest.mock('../utils/TorUtils', () => ({
    requestNewTorIdentity: jest.fn(),
    restartTor: jest.fn(),
    setTorRequestOutcomeListener: jest.fn(),
    subscribeTorStatus: jest.fn()
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string, subs?: any) =>
        subs ? `${key} ${JSON.stringify(subs)}` : key
}));

jest.mock('./SettingsStore', () => ({}));

import { observable, runInAction } from 'mobx';

import TorStore, {
    getTorIndicator,
    getTorStatusText,
    TOR_FAILURE_THRESHOLD,
    TOR_PERSISTENT_SERVICE_ENABLED
} from './TorStore';
import {
    requestNewTorIdentity,
    restartTor,
    setTorRequestOutcomeListener,
    subscribeTorStatus
} from '../utils/TorUtils';

const running = (
    network: 'up' | 'down' | 'unknown' = 'up',
    circuitEstablished = true
): any => ({
    state: 'running',
    socksAddress: '127.0.0.1:9056',
    controlAddress: '127.0.0.1:9051',
    connectivity: { network, circuitEstablished }
});
const starting = (progress: number): any => ({
    state: 'starting',
    bootstrap: { progress, tag: 'conn', summary: 'Connecting' }
});
const failed: any = {
    state: 'failed',
    error: { code: 'TOR_START_FAILED', message: 'boom' }
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const newSettingsStore = (fields: any = {}) =>
    observable({ enableTor: false, host: '', url: '', ...fields });

// Builds an initialized store and hands back the listeners it registered
const setup = async (settings: any = { enableTor: true }) => {
    const settingsStore = newSettingsStore(settings);
    const store = new TorStore(settingsStore as any);
    await store.initialize();
    const emitStatus = (subscribeTorStatus as jest.Mock).mock.calls[0][0];
    const reportOutcome = (setTorRequestOutcomeListener as jest.Mock).mock
        .calls[0][0];
    return { store, settingsStore, emitStatus, reportOutcome };
};

describe('getTorIndicator', () => {
    it('is off before any status arrives and when stopped', () => {
        expect(getTorIndicator(null, 0)).toBe('off');
        expect(getTorIndicator({ state: 'stopped' }, 0)).toBe('off');
    });

    it('is connecting while starting or stopping', () => {
        expect(getTorIndicator(starting(40), 0)).toBe('connecting');
        expect(getTorIndicator({ state: 'stopping' }, 0)).toBe('connecting');
    });

    it('is error when the daemon failed', () => {
        expect(getTorIndicator(failed, 0)).toBe('error');
    });

    it('is connected when running with a circuit', () => {
        expect(getTorIndicator(running(), 0)).toBe('connected');
    });

    it('treats unknown network liveness as connected', () => {
        expect(getTorIndicator(running('unknown'), 0)).toBe('connected');
    });

    it('is degraded when the network is down', () => {
        expect(getTorIndicator(running('down'), 0)).toBe('degraded');
    });

    it('is degraded when no circuit is established', () => {
        expect(getTorIndicator(running('up', false), 0)).toBe('degraded');
    });

    it('is degraded once consecutive request failures reach the threshold', () => {
        expect(getTorIndicator(running(), TOR_FAILURE_THRESHOLD - 1)).toBe(
            'connected'
        );
        expect(getTorIndicator(running(), TOR_FAILURE_THRESHOLD)).toBe(
            'degraded'
        );
    });
});

describe('getTorStatusText', () => {
    it('shows rounded bootstrap progress while starting', () => {
        expect(getTorStatusText(starting(44.6), 0)).toBe(
            'views.Settings.Networking.Tor.bootstrapping {"progress":45}'
        );
    });

    it('distinguishes stopping from connecting', () => {
        expect(getTorStatusText({ state: 'stopping' }, 0)).toBe(
            'views.Settings.Networking.Tor.stopping'
        );
    });

    it('maps each indicator to its label', () => {
        expect(getTorStatusText(running(), 0)).toBe(
            'views.Settings.Networking.Tor.connected'
        );
        expect(getTorStatusText(running('down'), 0)).toBe(
            'views.Settings.Networking.Tor.degraded'
        );
        expect(getTorStatusText(failed, 0)).toBe(
            'views.Settings.Networking.Tor.error'
        );
        expect(getTorStatusText(null, 0)).toBe(
            'views.Settings.Networking.Tor.stopped'
        );
    });
});

describe('TorStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatform.OS = 'android';
        mockAppState.currentState = 'active';
        Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
        mockTorServiceModule.startService.mockResolvedValue(true);
        mockTorServiceModule.updateNotification.mockResolvedValue(true);
        mockTorServiceModule.stopService.mockResolvedValue(true);
    });

    describe('torInUse', () => {
        it('is true when the wallet has Tor enabled', () => {
            const store = new TorStore(
                newSettingsStore({ enableTor: true }) as any
            );
            expect(store.torInUse).toBe(true);
        });

        it('is true for a .onion host even without the Tor flag', () => {
            const store = new TorStore(
                newSettingsStore({ host: 'abc.onion' }) as any
            );
            expect(store.torInUse).toBe(true);
        });

        it('is true for a .onion url (CLNRest, LNDHub)', () => {
            const store = new TorStore(
                newSettingsStore({ url: 'https://abc.onion:3010' }) as any
            );
            expect(store.torInUse).toBe(true);
        });

        it('is false for a clearnet wallet without Tor', () => {
            const store = new TorStore(
                newSettingsStore({ host: 'node.example.com' }) as any
            );
            expect(store.torInUse).toBe(false);
        });
    });

    it('only subscribes once when initialized repeatedly', async () => {
        const { store } = await setup();
        await store.initialize();

        expect(subscribeTorStatus).toHaveBeenCalledTimes(1);
    });

    it('counts consecutive transport failures and resets on success', async () => {
        const { store, emitStatus, reportOutcome } = await setup();
        emitStatus(running());

        reportOutcome(false);
        reportOutcome(false);
        expect(store.indicator).toBe('degraded');

        reportOutcome(true);
        expect(store.consecutiveFailures).toBe(0);
        expect(store.indicator).toBe('connected');
    });

    it('clears the failure count when the daemon leaves the running state', async () => {
        const { store, emitStatus, reportOutcome } = await setup();
        emitStatus(running());
        reportOutcome(false);
        reportOutcome(false);

        emitStatus(starting(10));

        expect(store.consecutiveFailures).toBe(0);
    });

    it('clears the failure count after a new identity', async () => {
        const { store, emitStatus, reportOutcome } = await setup();
        (requestNewTorIdentity as jest.Mock).mockResolvedValue(undefined);
        emitStatus(running());
        reportOutcome(false);
        reportOutcome(false);

        await store.newIdentity();

        expect(requestNewTorIdentity).toHaveBeenCalled();
        expect(store.indicator).toBe('connected');
        expect(store.actionInFlight).toBeNull();
    });

    it('surfaces an action error and keeps the failure count', async () => {
        const { store, emitStatus, reportOutcome } = await setup();
        (restartTor as jest.Mock).mockRejectedValue(new Error('no control'));
        emitStatus(running());
        reportOutcome(false);

        await store.restart();

        expect(store.actionError).toBe('no control');
        expect(store.consecutiveFailures).toBe(1);
        expect(store.actionInFlight).toBeNull();
    });

    it('ignores a second action while one is in flight', async () => {
        const { store } = await setup();
        let finish: () => void = () => {};
        (restartTor as jest.Mock).mockReturnValue(
            new Promise<void>((resolve) => (finish = resolve))
        );

        const first = store.restart();
        await store.newIdentity();
        finish();
        await first;

        expect(requestNewTorIdentity).not.toHaveBeenCalled();
    });

    it('runs a new identity requested from the notification', async () => {
        await setup();
        (requestNewTorIdentity as jest.Mock).mockResolvedValue(undefined);
        const [event, handler] =
            mockDeviceEventEmitter.addListener.mock.calls[0];

        handler();

        expect(event).toBe('TorServiceNewIdentity');
        expect(requestNewTorIdentity).toHaveBeenCalled();
    });

    it('persists the persistent service setting', async () => {
        const { store } = await setup();

        await store.setPersistentServiceEnabled(true);

        expect(mockStorage[TOR_PERSISTENT_SERVICE_ENABLED]).toBe('true');
        expect(store.persistentServiceEnabled).toBe(true);
    });

    describe('Android foreground service', () => {
        it('does not start when the setting is off', async () => {
            const { emitStatus } = await setup();

            emitStatus(running());
            await flush();

            expect(mockTorServiceModule.startService).not.toHaveBeenCalled();
        });

        it('starts with the status text once Tor is starting', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const { emitStatus } = await setup();

            emitStatus(starting(5));
            await flush();

            expect(mockTorServiceModule.startService).toHaveBeenCalledWith(
                'views.Settings.Networking.tor',
                'views.Settings.Networking.Tor.bootstrapping {"progress":5}',
                'views.Settings.Networking.Tor.newIdentity'
            );
        });

        it('updates the notification only when the text changes', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const { emitStatus } = await setup();
            emitStatus(starting(5));
            await flush();

            emitStatus(running());
            await flush();
            emitStatus(running());
            await flush();

            expect(mockTorServiceModule.startService).toHaveBeenCalledTimes(1);
            expect(
                mockTorServiceModule.updateNotification
            ).toHaveBeenCalledTimes(1);
            expect(
                mockTorServiceModule.updateNotification
            ).toHaveBeenCalledWith(
                'views.Settings.Networking.tor',
                'views.Settings.Networking.Tor.connected',
                'views.Settings.Networking.Tor.newIdentity'
            );
        });

        it('does not start from the background, and starts on return to the foreground', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            mockAppState.currentState = 'background';
            const { emitStatus } = await setup();

            emitStatus(running());
            await flush();
            expect(mockTorServiceModule.startService).not.toHaveBeenCalled();

            mockAppState.currentState = 'active';
            const onAppState = mockAppState.addEventListener.mock.calls[0][1];
            onAppState('active');
            await flush();

            expect(mockTorServiceModule.startService).toHaveBeenCalledTimes(1);
        });

        it('stops when the user switches to a wallet that does not use Tor', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const { emitStatus, settingsStore } = await setup();
            emitStatus(running());
            await flush();

            runInAction(() => {
                settingsStore.enableTor = false;
            });
            await flush();

            expect(mockTorServiceModule.stopService).toHaveBeenCalledTimes(1);
        });

        it('stops when the setting is turned off', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const { store, emitStatus } = await setup();
            emitStatus(running());
            await flush();

            await store.setPersistentServiceEnabled(false);
            await flush();

            expect(mockTorServiceModule.stopService).toHaveBeenCalledTimes(1);
        });

        it('tries to start again after a failed start', async () => {
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const warn = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockTorServiceModule.startService.mockRejectedValueOnce(
                new Error('ForegroundServiceStartNotAllowedException')
            );
            const { emitStatus } = await setup();

            emitStatus(starting(5));
            await flush();
            emitStatus(running());
            await flush();

            expect(mockTorServiceModule.startService).toHaveBeenCalledTimes(2);
            expect(
                mockTorServiceModule.updateNotification
            ).not.toHaveBeenCalled();
            warn.mockRestore();
        });

        it('does nothing on iOS', async () => {
            mockPlatform.OS = 'ios';
            mockStorage[TOR_PERSISTENT_SERVICE_ENABLED] = 'true';
            const { emitStatus } = await setup();

            emitStatus(running());
            await flush();

            expect(mockTorServiceModule.startService).not.toHaveBeenCalled();
            expect(mockDeviceEventEmitter.addListener).not.toHaveBeenCalled();
        });
    });
});
