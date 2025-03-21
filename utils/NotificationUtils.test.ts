import { Linking, AppState } from 'react-native';
import {
    checkNotifications,
    requestNotifications
} from 'react-native-permissions';

import { Settings } from '../stores/SettingsStore';
import {
    handleNotificationPermissions,
    checkAndRequestNotificationPermissions
} from './NotificationUtils';

jest.mock('react-native', () => ({
    Platform: {
        OS: 'android'
    },
    Linking: {
        openSettings: jest.fn()
    },
    AppState: {
        addEventListener: jest.fn()
    }
}));
jest.mock('react-native-permissions', () => ({
    checkNotifications: jest.fn(),
    requestNotifications: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () => {
    const mockGetItem = jest.fn();
    return {
        getItem: mockGetItem.mockImplementation((key) => {
            if (key === 'persistentServicesEnabled') {
                return Promise.resolve('true');
            }
            return Promise.resolve(null);
        })
    };
});

jest.mock('../stores/Stores', () => ({
    __esModule: true,
    default: {
        modalStore: {
            toggleInfoModal: jest.fn()
        },
        nodeInfoStore: {
            nodeInfo: {
                identity_pubkey: 'test-pubkey'
            }
        },
        settingsStore: {
            settings: {
                locale: 'en'
            }
        }
    }
}));

const mockSettings: Partial<Settings> = {
    lightningAddress: {
        enabled: true,
        automaticallyAccept: true,
        automaticallyAcceptAttestationLevel: 2,
        automaticallyRequestOlympusChannels: false,
        routeHints: false,
        allowComments: true,
        nostrPrivateKey: '',
        nostrRelays: [],
        notifications: 1
    }
};

describe('NotificationUtils', () => {
    let toggleInfoModal: jest.Mock;
    let addEventListener: jest.Mock;

    beforeEach(() => {
        toggleInfoModal = jest.mocked(
            require('../stores/Stores').default.modalStore.toggleInfoModal
        );
        addEventListener = AppState.addEventListener as jest.Mock;
        jest.clearAllMocks();
    });

    describe('checkAndRequestNotificationPermissions', () => {
        it('returns true when permissions are granted', async () => {
            (requestNotifications as jest.Mock).mockResolvedValue({
                status: 'granted'
            });
            const result = await checkAndRequestNotificationPermissions();
            expect(result).toBe(true);
        });

        it('returns false when permissions are denied', async () => {
            (requestNotifications as jest.Mock).mockResolvedValue({
                status: 'denied'
            });
            const result = await checkAndRequestNotificationPermissions();
            expect(result).toBe(false);
        });

        it('returns true when user grants permission through settings after initial block', async () => {
            (requestNotifications as jest.Mock).mockResolvedValue({
                status: 'blocked'
            });
            (checkNotifications as jest.Mock).mockResolvedValue({
                status: 'granted'
            });

            const promise = checkAndRequestNotificationPermissions();

            await Promise.resolve();
            expect(toggleInfoModal).toHaveBeenCalled();
            const modalCallback =
                toggleInfoModal.mock.calls[0][0].buttons[0].callback;
            await modalCallback();

            const appStateCallback = addEventListener.mock.calls[0][1];
            appStateCallback('active');

            const result = await promise;
            expect(result).toBe(true);
            expect(Linking.openSettings).toHaveBeenCalled();
        });

        it('returns false when user dismisses infoModal', async () => {
            (requestNotifications as jest.Mock).mockResolvedValue({
                status: 'blocked'
            });

            const promise = checkAndRequestNotificationPermissions();

            await Promise.resolve();
            expect(toggleInfoModal).toHaveBeenCalled();
            const onCloseCallback = toggleInfoModal.mock.calls[0][0].onDismiss;
            onCloseCallback();

            const result = await promise;
            expect(result).toBe(false);
        });
    });

    describe('handleNotificationPermissions', () => {
        it('requests notification permissions when current node has ln address and and push notifications enabled', async () => {
            (requestNotifications as jest.Mock).mockResolvedValue({
                status: 'granted'
            });
            await handleNotificationPermissions(mockSettings as Settings);
            expect(requestNotifications).toHaveBeenCalled();
        });

        it('requests notification permissions when current node is embedded-lnd with persistent mode enabled', async () => {
            const mockAsyncStorage = require('@react-native-async-storage/async-storage');
            const embeddedSettings = {
                ...mockSettings,
                lightningAddress: {
                    ...mockSettings.lightningAddress,
                    enabled: false,
                    nostrPrivateKey: ''
                },
                nodes: [
                    {
                        implementation: 'embedded-lnd',
                        dismissCustodialWarning: false
                    }
                ],
                selectedNode: 0
            } as Settings;

            await handleNotificationPermissions(embeddedSettings);
            expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
                'persistentServicesEnabled'
            );
        });

        it('should not request permissions when notifications are disabled', async () => {
            const noNotificationSettings = {
                ...mockSettings,
                lightningAddress: {
                    ...mockSettings.lightningAddress,
                    notifications: 0
                }
            } as Settings;

            await handleNotificationPermissions(noNotificationSettings);
            expect(requestNotifications).not.toHaveBeenCalled();
        });
    });
});
