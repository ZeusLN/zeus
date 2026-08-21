jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/public-downloads',
    DocumentDirectoryPath: '/docs',
    CachesDirectoryPath: '/cache',
    exists: jest.fn().mockResolvedValue(false),
    unlink: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn()
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        setSettings: jest.fn()
    }
}));
jest.mock('../stores/ChannelBackupStore', () => ({}));
jest.mock('../stores/LightningAddressStore', () => ({}));
jest.mock('../stores/LSPStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));

jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_FIAT_RATES_SOURCE: 'Zeus',
    DEFAULT_FIAT: 'USD',
    DEFAULT_LSP_MAINNET: 'https://flow.zeuslsp.com',
    DEFAULT_LSP_TESTNET: 'https://flow.testnet.zeuslsp.com',
    DEFAULT_LSP_MUTINYNET: 'https://flow.mutinynet.zeuslsp.com',
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
    DEFAULT_LSPS1_REST_MAINNET: 'https://lsps1.zeuslsp.com',
    DEFAULT_LSPS1_REST_TESTNET: 'https://lsps1.testnet.zeuslsp.com',
    DEFAULT_LSPS1_REST_MUTINYNET: 'https://lsps1.mutinynet.zeuslsp.com',
    DEFAULT_SPEEDLOADER: 'https://egs.lnze.us/',
    DEFAULT_SWAP_HOST_MAINNET: 'https://api.boltz.exchange/v2',
    DEFAULT_SWAP_HOST_TESTNET: 'https://api.testnet.boltz.exchange/v2',
    LEGACY_ZEUS_SWAP_HOST_MAINNET: 'https://swaps.zeuslsp.com/api/v2',
    LEGACY_ZEUS_SWAP_HOST_TESTNET: 'https://testnet-swaps.zeuslsp.com/api/v2',
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
    }
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
}));

import MigrationUtils from './MigrationUtils';

// Mock console logs to keep test output clean
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

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
            mintUrl: '',
            nostrPrivateKey: '',
            nostrRelays: [
                'wss://relay.damus.io',
                'wss://nostr.land',
                'wss://nostr.wine',
                'wss://nos.lol',
                'wss://relay.snort.social'
            ],
            notifications: 0,
            routeHints: false,
            zapReceiptsEnabled: true
        },
        lspMainnet: 'https://flow.zeuslsp.com',
        lspTestnet: 'https://flow.testnet.zeuslsp.com',
        lsps1HostMainnet: '45.79.192.236:9735',
        lsps1HostTestnet: '139.144.22.237:9735',
        lsps1PubkeyMainnet:
            '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
        lsps1PubkeyTestnet:
            '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df',
        lsps1RestMainnet: 'https://lsps1.zeuslsp.com',
        lsps1RestTestnet: 'https://lsps1.testnet.zeuslsp.com',
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

    describe('MigrationUtils', () => {
        it('handles empty settings', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations('{}')
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('handles mod1', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
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
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lspMainnet: 'https://lsp-preview.lnolymp.us',
                        lspTestnet: 'https://testnet-lsp.lnolymp.us'
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('migrates old default Olympus LSP hosts to zeuslsp.com hosts', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lspMainnet: 'https://0conf.lnolymp.us',
                        lspTestnet: 'https://testnet-0conf.lnolymp.us',
                        lspMutinynet: 'https://mutinynet-flow.lnolymp.us',
                        lsps1RestMainnet: 'https://lsps1.lnolymp.us',
                        lsps1RestTestnet: 'https://testnet-lsps1.lnolymp.us',
                        lsps1RestMutinynet: 'https://mutinynet-lsps1.lnolymp.us'
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                lspMutinynet: 'https://flow.mutinynet.zeuslsp.com',
                lsps1RestMutinynet: 'https://lsps1.mutinynet.zeuslsp.com'
            });
        });
        it('leaves custom LSP hosts untouched', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lspMainnet: 'https://my-custom-lsp.com',
                        lsps1RestMainnet: 'https://my-custom-lsps1.com'
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                lspMainnet: 'https://my-custom-lsp.com',
                lsps1RestMainnet: 'https://my-custom-lsps1.com'
            });
        });
        it('handles mod3', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
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
                MigrationUtils.legacySettingsMigrations(
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
                MigrationUtils.legacySettingsMigrations(
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
                            mintUrl: '',
                            nostrPrivateKey: '',
                            notifications: 0,
                            routeHints: false,
                            zapReceiptsEnabled: true
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('migrates old POS squareEnabled setting to posEnabled', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
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
        it('repairs invoice expiry display fields when out of sync with expirySeconds', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        invoices: {
                            expiry: '3600',
                            timePeriod: 'Hours',
                            expirySeconds: '3600'
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                invoices: {
                    expiry: '1',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            });
        });
        it('backfills expirySeconds + timePeriod on pre-Feb-2024 installs with only `expiry: 3600`', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        invoices: {
                            expiry: '3600'
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                invoices: {
                    expiry: '1',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            });
        });
        it('leaves consistent invoice expiry settings untouched', async () => {
            await expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        invoices: {
                            expiry: '2',
                            timePeriod: 'Hours',
                            expirySeconds: '7200'
                        }
                    })
                )
            ).resolves.toEqual({
                ...defaultSettings,
                invoices: {
                    expiry: '2',
                    timePeriod: 'Hours',
                    expirySeconds: '7200'
                }
            });
        });
    });

    describe('migrateSwapHostsToBoltz', () => {
        const EncryptedStorage = require('react-native-encrypted-storage');
        const { settingsStore } = require('../stores/Stores');

        beforeEach(() => {
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
            settingsStore.setSettings.mockReset();
        });

        it('migrates retired ZEUS swap hosts to the Boltz defaults', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://swaps.zeuslsp.com/api/v2',
                    hostTestnet: 'https://testnet-swaps.zeuslsp.com/api/v2',
                    customHost: '',
                    proEnabled: false
                }
            };

            await MigrationUtils.migrateSwapHostsToBoltz(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://api.boltz.exchange/v2'
            );
            expect(settings.swaps.hostTestnet).toBe(
                'https://api.testnet.boltz.exchange/v2'
            );
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            expect(settingsStore.setSettings.mock.calls[0][0]).toBe(settings);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-boltz',
                'true'
            );
        });

        it('leaves non-ZEUS hosts untouched and does not rewrite storage', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://api.middle-way.space/v2',
                    hostTestnet: 'Custom',
                    customHost: 'https://my-boltz.local/v2',
                    proEnabled: false
                }
            };

            await MigrationUtils.migrateSwapHostsToBoltz(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://api.middle-way.space/v2'
            );
            expect(settings.swaps.hostTestnet).toBe('Custom');
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-boltz',
                'true'
            );
        });

        it('only sets the flag when settings have no swaps block', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {};

            await MigrationUtils.migrateSwapHostsToBoltz(settings);

            expect(settings).toEqual({});
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-boltz',
                'true'
            );
        });

        it('is a no-op when the migration flag is already set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://swaps.zeuslsp.com/api/v2'
                }
            };

            await MigrationUtils.migrateSwapHostsToBoltz(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://swaps.zeuslsp.com/api/v2'
            );
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('migrateInvoiceExpiryDisplay', () => {
        const EncryptedStorage = require('react-native-encrypted-storage');
        const { settingsStore } = require('../stores/Stores');

        beforeEach(() => {
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
            settingsStore.setSettings.mockReset();
        });

        it('repairs inconsistent expiry/timePeriod on v2 settings', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                invoices: {
                    expiry: '3600',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices).toEqual({
                expiry: '1',
                timePeriod: 'Hours',
                expirySeconds: '3600'
            });
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'invoices-expiry-display-fix-v2',
                'true'
            );
        });

        it('persists the settings object rather than a JSON string', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                invoices: {
                    expiry: '3600',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            // Guards against regressing #4150: passing a stringified payload
            // briefly turns the MobX `settings` observable into a string,
            // which can crash observers reading nested keys.
            const persistedSettings =
                settingsStore.setSettings.mock.calls[0][0];
            expect(typeof persistedSettings).not.toBe('string');
            expect(persistedSettings).toBe(settings);
        });

        it('backfills missing expirySeconds + timePeriod for pre-Feb-2024 installs', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = { invoices: { expiry: '3600' } };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices).toEqual({
                expiry: '1',
                timePeriod: 'Hours',
                expirySeconds: '3600'
            });
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'invoices-expiry-display-fix-v2',
                'true'
            );
        });

        it('backfills missing expirySeconds when expiry + timePeriod are valid', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                invoices: { expiry: '2', timePeriod: 'Hours' }
            };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices).toEqual({
                expiry: '2',
                timePeriod: 'Hours',
                expirySeconds: '7200'
            });
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
        });

        it('leaves consistent settings untouched and does not rewrite storage', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                invoices: {
                    expiry: '2',
                    timePeriod: 'Hours',
                    expirySeconds: '7200'
                }
            };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices).toEqual({
                expiry: '2',
                timePeriod: 'Hours',
                expirySeconds: '7200'
            });
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'invoices-expiry-display-fix-v2',
                'true'
            );
        });

        it('is a no-op when the migration flag is already set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');
            const settings: any = {
                invoices: {
                    expiry: '3600',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices.expiry).toBe('3600');
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('only sets the flag when settings have no invoices block', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {};

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings).toEqual({});
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'invoices-expiry-display-fix-v2',
                'true'
            );
        });

        it('re-runs for users who already ran the v1 migration', async () => {
            // v1 set 'invoices-expiry-display-fix' before the guard was
            // fixed; v2 must run independently.
            EncryptedStorage.getItem.mockImplementation((key: string) =>
                key === 'invoices-expiry-display-fix-v2'
                    ? Promise.resolve(null)
                    : Promise.resolve('true')
            );
            const settings: any = { invoices: { expiry: '3600' } };

            await MigrationUtils.migrateInvoiceExpiryDisplay(settings);

            expect(settings.invoices).toEqual({
                expiry: '1',
                timePeriod: 'Hours',
                expirySeconds: '3600'
            });
        });
    });

    describe('migrateOlympusHostsToZeusLsp', () => {
        const EncryptedStorage = require('react-native-encrypted-storage');
        const { settingsStore } = require('../stores/Stores');

        beforeEach(() => {
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
            settingsStore.setSettings.mockReset();
        });

        it('rewrites all six old default hosts on v2 settings', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us',
                lspTestnet: 'https://testnet-0conf.lnolymp.us',
                lspMutinynet: 'https://mutinynet-flow.lnolymp.us',
                lsps1RestMainnet: 'https://lsps1.lnolymp.us',
                lsps1RestTestnet: 'https://testnet-lsps1.lnolymp.us',
                lsps1RestMutinynet: 'https://mutinynet-lsps1.lnolymp.us'
            };

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            expect(settings).toEqual({
                lspMainnet: 'https://flow.zeuslsp.com',
                lspTestnet: 'https://flow.testnet.zeuslsp.com',
                lspMutinynet: 'https://flow.mutinynet.zeuslsp.com',
                lsps1RestMainnet: 'https://lsps1.zeuslsp.com',
                lsps1RestTestnet: 'https://lsps1.testnet.zeuslsp.com',
                lsps1RestMutinynet: 'https://lsps1.mutinynet.zeuslsp.com'
            });
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeuslsp-hosts-2026',
                'true'
            );
        });

        it('persists the settings object rather than a JSON string', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us'
            };

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            const persistedSettings =
                settingsStore.setSettings.mock.calls[0][0];
            expect(typeof persistedSettings).not.toBe('string');
            expect(persistedSettings).toBe(settings);
        });

        it('leaves custom hosts untouched and does not rewrite storage', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                lspMainnet: 'https://my-custom-lsp.com',
                lsps1RestMainnet: 'https://my-custom-lsps1.com'
            };

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            expect(settings).toEqual({
                lspMainnet: 'https://my-custom-lsp.com',
                lsps1RestMainnet: 'https://my-custom-lsps1.com'
            });
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeuslsp-hosts-2026',
                'true'
            );
        });

        it('leaves unset hosts unset so runtime falls back to new defaults', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {};

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            expect(settings).toEqual({});
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeuslsp-hosts-2026',
                'true'
            );
        });

        it('is a no-op when the migration flag is already set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us'
            };

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            expect(settings.lspMainnet).toBe('https://0conf.lnolymp.us');
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('is idempotent when run twice without the flag', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us'
            };

            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);
            await MigrationUtils.migrateOlympusHostsToZeusLsp(settings);

            expect(settings.lspMainnet).toBe('https://flow.zeuslsp.com');
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
        });
    });

    describe('migrateCashuSeedVersion', () => {
        beforeEach(() => {
            // Clear mock history before each test
            require('../storage').setItem.mockClear();
            mockConsoleLog.mockClear();
            mockConsoleError.mockClear();
        });

        afterAll(() => {
            // Restore original console functions
            mockConsoleLog.mockRestore();
            mockConsoleError.mockRestore();
        });

        it('should set seedVersion to "v1" and save to Storage if undefined', async () => {
            const mockCashuStore: any = {
                seedVersion: undefined,
                settingsStore: { implementation: 'embedded-lnd' },
                getLndDir: jest.fn().mockReturnValue('testLndDir'),
                getNodeDir: jest.fn().mockReturnValue('testLndDir')
            };

            await MigrationUtils.migrateCashuSeedVersion(mockCashuStore);

            expect(mockCashuStore.seedVersion).toBe('v1');
            expect(require('../storage').setItem).toHaveBeenCalledTimes(1);
            expect(require('../storage').setItem).toHaveBeenCalledWith(
                'testLndDir-cashu-seed-version',
                'v1'
            );
            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Migrating Cashu seed version to v1'
            );
            expect(mockConsoleLog).toHaveBeenCalledWith(
                'Cashu seed version migrated and saved as v1.'
            );
        });

        it('should not change seedVersion or call Storage.setItem if seedVersion is already "v1"', async () => {
            const mockCashuStore: any = {
                seedVersion: 'v1',
                settingsStore: { implementation: 'embedded-lnd' },
                getLndDir: jest.fn().mockReturnValue('testLndDir'),
                getNodeDir: jest.fn().mockReturnValue('testLndDir')
            };

            await MigrationUtils.migrateCashuSeedVersion(mockCashuStore);

            expect(mockCashuStore.seedVersion).toBe('v1');
            expect(require('../storage').setItem).not.toHaveBeenCalled();
            expect(mockConsoleLog).not.toHaveBeenCalledWith(
                'Migrating Cashu seed version to v1'
            );
        });

        it('should not change seedVersion or call Storage.setItem if seedVersion is already defined with another value', async () => {
            const mockCashuStore: any = {
                seedVersion: 'v2-bip39',
                settingsStore: { implementation: 'embedded-lnd' },
                getLndDir: jest.fn().mockReturnValue('testLndDir'),
                getNodeDir: jest.fn().mockReturnValue('testLndDir')
            };

            await MigrationUtils.migrateCashuSeedVersion(mockCashuStore);

            expect(mockCashuStore.seedVersion).toBe('v2-bip39');
            expect(require('../storage').setItem).not.toHaveBeenCalled();
        });

        it('should handle errors during Storage.setItem gracefully', async () => {
            require('../storage').setItem.mockRejectedValueOnce(
                new Error('Storage failed')
            );
            const mockCashuStore: any = {
                seedVersion: undefined,
                settingsStore: { implementation: 'embedded-lnd' },
                getLndDir: jest.fn().mockReturnValue('testLndDir'),
                getNodeDir: jest.fn().mockReturnValue('testLndDir')
            };

            await MigrationUtils.migrateCashuSeedVersion(mockCashuStore);

            expect(mockCashuStore.seedVersion).toBe('v1'); // Version is set before storage attempt
            expect(require('../storage').setItem).toHaveBeenCalledTimes(1);
            expect(require('../storage').setItem).toHaveBeenCalledWith(
                'testLndDir-cashu-seed-version',
                'v1'
            );
            expect(mockConsoleError).toHaveBeenCalledWith(
                'Error saving migrated Cashu seed version:',
                expect.any(Error)
            );
        });
    });
});
