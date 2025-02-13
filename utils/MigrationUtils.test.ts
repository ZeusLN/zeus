jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: jest.fn()
}));
jest.mock('react-native-notifications', () => ({
    Notifications: {
        registerRemoteNotifications: jest.fn(),
        events: jest.fn(() => ({
            registerRemoteNotificationsRegistered: jest.fn(),
            registerRemoteNotificationsRegistrationFailed: jest.fn(),
            registerNotificationReceived: jest.fn(),
            registerNotificationOpened: jest.fn()
        }))
    }
}));
jest.mock('react-native-ping', () => ({
    default: {
        start: jest.fn(),
        stop: jest.fn(),
        getPingStats: jest.fn()
    }
}));
jest.mock('react-native-device-info', () => ({
    default: {
        getVersion: jest.fn(),
        getBuildNumber: jest.fn(),
        getModel: jest.fn(),
        getSystemVersion: jest.fn(),
        getUniqueId: jest.fn()
    }
}));
jest.mock('react-native-securerandom', () => ({
    generateSecureRandom: jest.fn()
}));
jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            addListener: jest.fn(),
            removeListeners: jest.fn()
        }
    },
    Platform: {
        OS: 'android'
    },
    NativeEventEmitter: jest.fn(),
    DeviceEventEmitter: {
        addListener: jest.fn()
    }
}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));

jest.mock('../stores/storeInstances', () => ({
    settingsStore: {
        setSettings: jest.fn(),
        settings: {},
        migrationPromise: Promise.resolve(),
        currentNodeUuid: 'uuid1'
    },
    lightningAddressStore: {
        checkLightningAddressExists: jest.fn()
    },
    nodeInfoStore: {
        nodeInfo: {
            identity_pubkey: 'pubkey123'
        }
    }
}));
jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('../stores/SettingsStore', () => {
    class MockSettingsStore {
        setSettings = jest.fn();
        settings = {};
        migrationPromise = Promise.resolve();
    }

    return {
        DEFAULT_FIAT_RATES_SOURCE: 'Zeus',
        DEFAULT_FIAT: 'USD',
        DEFAULT_LSP_MAINNET: 'https://0conf.lnolymp.us',
        DEFAULT_LSP_TESTNET: 'https://testnet-0conf.lnolymp.us',
        DEFAULT_NOSTR_RELAYS: [
            'wss://relay.damus.io',
            'wss://nostr.land',
            'wss://nostr.wine',
            'wss://nos.lol',
            'wss://relay.snort.social'
        ],
        DEFAULT_NEUTRINO_PEERS_MAINNET: [
            'btcd1.lnolymp.us',
            'btcd2.lnolymp.us',
            'btcd-mainnet.lightning.computer',
            'node.eldamar.icu',
            'noad.sathoarder.com'
        ],
        DEFAULT_NEUTRINO_PEERS_TESTNET: [
            'testnet.lnolymp.us',
            'btcd-testnet.lightning.computer',
            'testnet.blixtwallet.com'
        ],
        DEFAULT_LSPS1_HOST_MAINNET: '45.79.192.236:9735',
        DEFAULT_LSPS1_HOST_TESTNET: '139.144.22.237:9735',
        DEFAULT_LSPS1_PUBKEY_MAINNET:
            '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
        DEFAULT_LSPS1_PUBKEY_TESTNET:
            '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df',
        DEFAULT_LSPS1_REST_MAINNET: 'https://lsps1.lnolymp.us',
        DEFAULT_LSPS1_REST_TESTNET: 'https://testnet-lsps1.lnolymp.us',
        DEFAULT_SPEEDLOADER: 'https://egs.lnze.us/',
        DEFAULT_NOSTR_RELAYS_2023: [
            'wss://nostr.mutinywallet.com',
            'wss://relay.damus.io',
            'wss://nostr.lnproxy.org'
        ],
        DEFAULT_SLIDE_TO_PAY_THRESHOLD: 10000,
        STORAGE_KEY: 'zeus-settings-v2',
        LEGACY_CURRENCY_CODES_KEY: 'currency-codes',
        CURRENCY_CODES_KEY: 'zeus-currency-codes',
        PosEnabled: {
            Disabled: 'disabled',
            Square: 'square',
            Standalone: 'standalone'
        },
        default: MockSettingsStore
    };
});
jest.mock('../stores/Stores', () => ({
    default: {
        settingsStore: new (jest.fn(() => ({
            setSettings: jest.fn(),
            settings: {},
            migrationPromise: Promise.resolve()
        })))(),
        modalStore: {},
        offersStore: {},
        fiatStore: {}
    }
}));

jest.mock('../utils/BackendUtils', () => ({}));

import migrationUtils from './MigrationUtils';
import Storage from '../storage';
import { Settings } from '../stores/SettingsStore';
import {
    settingsStore,
    lightningAddressStore,
    nodeInfoStore
} from '../stores/storeInstances';

describe('MigrationUtils', () => {
    const defaultSettings = {
        customSpeedloader: '',
        display: {
            showMillisatoshiAmounts: true
        },
        enableLSP: true,
        fiat: 'USD',
        fiatEnabled: false,
        fiatRatesSource: 'Zeus',
        lightningAddress: {
            allowComments: true,
            automaticallyAccept: true,
            automaticallyAcceptAttestationLevel: 2,
            automaticallyRequestOlympusChannels: false,
            enabled: false,
            nostrPrivateKey: '',
            nostrRelays: [
                'wss://relay.damus.io',
                'wss://nostr.land',
                'wss://nostr.wine',
                'wss://nos.lol',
                'wss://relay.snort.social'
            ],
            notifications: 0,
            routeHints: false
        },
        lspMainnet: 'https://0conf.lnolymp.us',
        lspTestnet: 'https://testnet-0conf.lnolymp.us',
        lsps1HostMainnet: '45.79.192.236:9735',
        lsps1HostTestnet: '139.144.22.237:9735',
        lsps1PubkeyMainnet:
            '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
        lsps1PubkeyTestnet:
            '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df',
        lsps1RestMainnet: 'https://lsps1.lnolymp.us',
        lsps1RestTestnet: 'https://testnet-lsps1.lnolymp.us',
        lsps1ShowPurchaseButton: true,
        lsps1Token: '',
        neutrinoPeersMainnet: [
            'btcd1.lnolymp.us',
            'btcd2.lnolymp.us',
            'btcd-mainnet.lightning.computer',
            'node.eldamar.icu',
            'noad.sathoarder.com'
        ],
        neutrinoPeersTestnet: [
            'testnet.lnolymp.us',
            'btcd-testnet.lightning.computer',
            'testnet.blixtwallet.com'
        ],
        payments: {
            slideToPayThreshold: 10000
        },
        requestSimpleTaproot: true,
        speedloader: 'https://egs.lnze.us/'
    };

    describe('MigrationUtils Legacy Settings', () => {
        it('handles empty settings', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations('{}')
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('handles mod1', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        requestSimpleTaproot: false,
                        fiatRatesSource: 'Yadio'
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                fiatRatesSource: 'Yadio'
            });
        });
        it('handles mod2', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lspMainnet: 'https://lsp-preview.lnolymp.us',
                        lspTestnet: 'https://testnet-lsp.lnolymp.us'
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('handles mod3', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        neutrinoPeersMainnet: [
                            'btcd1.lnolymp.us',
                            'btcd2.lnolymp.us',
                            'btcd-mainnet.lightning.computer',
                            'node.eldamar.icu',
                            'noad.sathoarder.com'
                        ]
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('handles mod7', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        bimodalPathfinding: true
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                bimodalPathfinding: false
            });
        });
        it('handles mod8', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lightningAddress: {
                            nostrRelays: [
                                'wss://nostr.mutinywallet.com',
                                'wss://relay.damus.io',
                                'wss://nostr.lnproxy.org'
                            ],
                            allowComments: true,
                            automaticallyAccept: true,
                            automaticallyAcceptAttestationLevel: 2,
                            automaticallyRequestOlympusChannels: false,
                            enabled: false,
                            nostrPrivateKey: '',
                            notifications: 0,
                            routeHints: false
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('migrates old POS squareEnabled setting to posEnabled', async () => {
            await expect(
                migrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        pos: {
                            squareEnabled: true
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                pos: {
                    posEnabled: 'square',
                    squareEnabled: false
                }
            });
        });
    });

    describe('migrateLightningAddressSettings', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            Storage.getItem = jest.fn();
            Storage.setItem = jest.fn();
            settingsStore.setSettings = jest.fn();
            lightningAddressStore.checkLightningAddressExists = jest.fn();
        });

        it('creates todo list during first run with UUIDs of only those nodes that need migration', async () => {
            settingsStore.settings = {
                nodes: [
                    { implementation: 'embedded-lnd', uuid: 'uuid1' },
                    { implementation: 'lnd', uuid: 'uuid2' },
                    { implementation: 'lndhub', uuid: 'uuid3' }
                ],
                lightningAddress: {
                    automaticallyAccept: true,
                    automaticallyAcceptAttestationLevel: 2,
                    routeHints: false,
                    allowComments: true,
                    nostrRelays: ['relay1', 'relay2'],
                    notifications: 0,
                    nostrPrivateKey: 'test-key'
                }
            } as Settings;

            // simulate first run
            (Storage.getItem as jest.Mock).mockResolvedValue(null);

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(true);
            expect(Storage.setItem).toHaveBeenCalledWith(
                'make-ln-address-settings-pubkey-specific-2025',
                ['uuid1', 'uuid2']
            );
        });

        it('deletes legacy settings at first run when there are only nodes that do not need migration', async () => {
            settingsStore.settings = {
                nodes: [
                    { implementation: 'lndhub', uuid: 'uuid1' },
                    { implementation: 'cln-rest', uuid: 'uuid2' }
                ],
                lightningAddress: {
                    automaticallyAccept: true
                }
            } as Settings;

            // simulate first run
            (Storage.getItem as jest.Mock).mockResolvedValue(null);

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(true);
            expect(settingsStore.setSettings).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    lightningAddress: expect.anything()
                })
            );
        });

        it('sets enabled: false when lightning address does not exist for current node', async () => {
            settingsStore.settings = {
                lightningAddress: {
                    automaticallyAccept: true
                }
            } as Settings;
            settingsStore.currentNodeUuid = 'uuid1';
            nodeInfoStore.nodeInfo = { identity_pubkey: 'pubkey123' };

            (Storage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify(['uuid1'])
            );
            (
                lightningAddressStore.checkLightningAddressExists as jest.Mock
            ).mockResolvedValue(false);

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(true);
            expect(settingsStore.setSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    lightningAddressByPubkey: {
                        pubkey123: {
                            enabled: false
                        }
                    }
                })
            );
        });

        it('keeps remaining nodes in todo list when migration fails for current node', async () => {
            settingsStore.settings = {
                lightningAddress: {
                    automaticallyAccept: true
                }
            } as Settings;
            settingsStore.currentNodeUuid = 'uuid1';
            nodeInfoStore.nodeInfo = { identity_pubkey: 'pubkey123' };

            (Storage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify(['uuid1', 'uuid2'])
            );
            (
                lightningAddressStore.checkLightningAddressExists as jest.Mock
            ).mockRejectedValue(new Error('Backend error'));

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(false);
            expect(Storage.setItem).not.toHaveBeenCalled();
        });

        it('creates lightningAddressByPubkey settings for current node, removes node from migration todo list and deletes legacy settings when it was the last node to migrate', async () => {
            settingsStore.settings = {
                lightningAddress: {
                    automaticallyAccept: true,
                    automaticallyAcceptAttestationLevel: 2,
                    routeHints: false,
                    allowComments: true,
                    nostrPrivateKey: 'privateKey123',
                    nostrRelays: ['relay1', 'relay2'],
                    notifications: 1
                }
            } as Settings;
            settingsStore.currentNodeUuid = 'uuid1';
            nodeInfoStore.nodeInfo = { identity_pubkey: 'pubkey123' };

            (Storage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify(['uuid1'])
            );

            (
                lightningAddressStore.checkLightningAddressExists as jest.Mock
            ).mockResolvedValue(true);

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(true);
            expect(settingsStore.setSettings).toHaveBeenCalledWith(
                expect.objectContaining({
                    lightningAddressByPubkey: {
                        pubkey123: {
                            enabled: true,
                            automaticallyAccept: true,
                            automaticallyAcceptAttestationLevel: 2,
                            routeHints: false,
                            allowComments: true,
                            nostrPrivateKey: 'privateKey123',
                            nostrRelays: ['relay1', 'relay2'],
                            notifications: 1
                        }
                    }
                })
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                'make-ln-address-settings-pubkey-specific-2025',
                []
            );
            expect(settingsStore.setSettings).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    lightningAddress: expect.anything()
                })
            );
        });

        it('skips migration when all nodes are migrated', async () => {
            (Storage.getItem as jest.Mock).mockResolvedValue(
                JSON.stringify([])
            );

            const result =
                await migrationUtils.migrateLightningAddressSettings();

            expect(result).toBe(false);
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
        });
    });
});
