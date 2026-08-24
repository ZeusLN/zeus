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
    SETTINGS_VERSION: 1,
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
    RETIRED_SWAP_HOSTS_MAINNET: ['https://boltz-api.eldamar.icu/v2'],
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
        settingsVersion: 1,
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

    describe('applySwapHostsToBoltz', () => {
        it('migrates retired ZEUS swap hosts to the Boltz defaults', () => {
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://swaps.zeuslsp.com/api/v2',
                    hostTestnet: 'https://testnet-swaps.zeuslsp.com/api/v2'
                }
            };

            expect(MigrationUtils.applySwapHostsToBoltz(settings)).toBe(true);
            expect(settings.swaps).toEqual({
                hostMainnet: 'https://api.boltz.exchange/v2',
                hostTestnet: 'https://api.testnet.boltz.exchange/v2'
            });
        });

        it('leaves non-ZEUS hosts untouched', () => {
            const settings: any = {
                swaps: { hostMainnet: 'https://my-custom-swaps.com/api' }
            };

            expect(MigrationUtils.applySwapHostsToBoltz(settings)).toBe(false);
            expect(settings.swaps.hostMainnet).toBe(
                'https://my-custom-swaps.com/api'
            );
        });

        it('is a no-op without a swaps block', () => {
            const settings: any = {};

            expect(MigrationUtils.applySwapHostsToBoltz(settings)).toBe(false);
            expect(settings).toEqual({});
        });
    });

    describe('migrateRetiredSwapHosts', () => {
        const EncryptedStorage = require('react-native-encrypted-storage');
        const { settingsStore } = require('../stores/Stores');

        beforeEach(() => {
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
            settingsStore.setSettings.mockReset();
        });

        it('moves a shut-down provider back to the default mainnet host', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://boltz-api.eldamar.icu/v2',
                    hostTestnet: 'https://api.testnet.boltz.exchange/v2',
                    customHost: '',
                    proEnabled: false
                }
            };

            await MigrationUtils.migrateRetiredSwapHosts(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://api.boltz.exchange/v2'
            );
            expect(settings.swaps.hostTestnet).toBe(
                'https://api.testnet.boltz.exchange/v2'
            );
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            expect(settingsStore.setSettings.mock.calls[0][0]).toBe(settings);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-retired-eldamar',
                'true'
            );
        });

        it('leaves a custom host pointed at a retired provider alone', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                swaps: {
                    hostMainnet: 'Custom',
                    customHost: 'https://boltz-api.eldamar.icu/v2',
                    proEnabled: false
                }
            };

            await MigrationUtils.migrateRetiredSwapHosts(settings);

            expect(settings.swaps.hostMainnet).toBe('Custom');
            expect(settings.swaps.customHost).toBe(
                'https://boltz-api.eldamar.icu/v2'
            );
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-retired-eldamar',
                'true'
            );
        });

        it('leaves still-operating providers untouched', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://swap.coinos.io/v2',
                    proEnabled: false
                }
            };

            await MigrationUtils.migrateRetiredSwapHosts(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://swap.coinos.io/v2'
            );
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-retired-eldamar',
                'true'
            );
        });

        it('only sets the flag when settings have no swaps block', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {};

            await MigrationUtils.migrateRetiredSwapHosts(settings);

            expect(settings).toEqual({});
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'swap-hosts-retired-eldamar',
                'true'
            );
        });

        it('is a no-op when the migration flag is already set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');
            const settings: any = {
                swaps: {
                    hostMainnet: 'https://boltz-api.eldamar.icu/v2'
                }
            };

            await MigrationUtils.migrateRetiredSwapHosts(settings);

            expect(settings.swaps.hostMainnet).toBe(
                'https://boltz-api.eldamar.icu/v2'
            );
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });
    });

    describe('applyInvoiceExpiryDisplay', () => {
        it('repairs expiry display fields when out of sync with expirySeconds', () => {
            const settings: any = {
                invoices: {
                    expiry: '3600',
                    timePeriod: 'Hours',
                    expirySeconds: '3600'
                }
            };

            expect(MigrationUtils.applyInvoiceExpiryDisplay(settings)).toBe(
                true
            );
            expect(settings.invoices).toEqual({
                expiry: '1',
                timePeriod: 'Hours',
                expirySeconds: '3600'
            });
        });

        it('backfills expirySeconds + timePeriod on pre-Feb-2024 installs with only `expiry: 3600`', () => {
            const settings: any = { invoices: { expiry: '3600' } };

            expect(MigrationUtils.applyInvoiceExpiryDisplay(settings)).toBe(
                true
            );
            expect(settings.invoices).toEqual({
                expiry: '1',
                timePeriod: 'Hours',
                expirySeconds: '3600'
            });
        });

        it('backfills missing expirySeconds when expiry + timePeriod are valid', () => {
            const settings: any = {
                invoices: { expiry: '2', timePeriod: 'Hours' }
            };

            expect(MigrationUtils.applyInvoiceExpiryDisplay(settings)).toBe(
                true
            );
            expect(settings.invoices).toEqual({
                expiry: '2',
                timePeriod: 'Hours',
                expirySeconds: '7200'
            });
        });

        it('leaves consistent settings untouched', () => {
            const settings: any = {
                invoices: {
                    expiry: '2',
                    timePeriod: 'Hours',
                    expirySeconds: '7200'
                }
            };

            expect(MigrationUtils.applyInvoiceExpiryDisplay(settings)).toBe(
                false
            );
            expect(settings.invoices).toEqual({
                expiry: '2',
                timePeriod: 'Hours',
                expirySeconds: '7200'
            });
        });

        it('is a no-op without an invoices block', () => {
            expect(MigrationUtils.applyInvoiceExpiryDisplay({})).toBe(false);
        });
    });

    describe('applyOlympusHostsToZeusLsp', () => {
        it('rewrites all six old default hosts', () => {
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us',
                lspTestnet: 'https://testnet-0conf.lnolymp.us',
                lspMutinynet: 'https://mutinynet-flow.lnolymp.us',
                lsps1RestMainnet: 'https://lsps1.lnolymp.us',
                lsps1RestTestnet: 'https://testnet-lsps1.lnolymp.us',
                lsps1RestMutinynet: 'https://mutinynet-lsps1.lnolymp.us'
            };

            expect(MigrationUtils.applyOlympusHostsToZeusLsp(settings)).toBe(
                true
            );
            expect(settings).toEqual({
                lspMainnet: 'https://flow.zeuslsp.com',
                lspTestnet: 'https://flow.testnet.zeuslsp.com',
                lspMutinynet: 'https://flow.mutinynet.zeuslsp.com',
                lsps1RestMainnet: 'https://lsps1.zeuslsp.com',
                lsps1RestTestnet: 'https://lsps1.testnet.zeuslsp.com',
                lsps1RestMutinynet: 'https://lsps1.mutinynet.zeuslsp.com'
            });
        });

        it('leaves custom hosts untouched', () => {
            const settings: any = {
                lspMainnet: 'https://my-custom-lsp.com',
                lsps1RestMainnet: 'https://my-custom-lsps1.com'
            };

            expect(MigrationUtils.applyOlympusHostsToZeusLsp(settings)).toBe(
                false
            );
            expect(settings).toEqual({
                lspMainnet: 'https://my-custom-lsp.com',
                lsps1RestMainnet: 'https://my-custom-lsps1.com'
            });
        });

        it('leaves unset hosts unset so runtime falls back to new defaults', () => {
            const settings: any = {};

            expect(MigrationUtils.applyOlympusHostsToZeusLsp(settings)).toBe(
                false
            );
            expect(settings).toEqual({});
        });
    });

    describe('applyRgsDefaultsToV2', () => {
        it('rewrites both v1 default endpoints on mainnet nodes', () => {
            const settings: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'mainnet',
                        ldkRgsServer: 'https://rgs.zeusln.com/snapshot'
                    },
                    {
                        implementation: 'ldk-node',
                        // ldkNetwork unset counts as mainnet
                        ldkRgsServer:
                            'https://rapidsync.lightningdevkit.org/snapshot'
                    }
                ]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(true);
            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://rgs.zeusln.com/snapshot/v2'
            );
            expect(settings.nodes[1].ldkRgsServer).toBe(
                'https://rapidsync.lightningdevkit.org/snapshot/v2'
            );
        });

        it('rewrites the v1 testnet default on testnet nodes', () => {
            const settings: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'testnet',
                        ldkRgsServer:
                            'https://rapidsync.lightningdevkit.org/testnet/snapshot'
                    }
                ]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(true);
            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://rapidsync.lightningdevkit.org/testnet/v2/snapshot'
            );
        });

        it('does not apply mappings across networks', () => {
            const settings: any = {
                nodes: [
                    {
                        // mainnet URL on a testnet node: misconfigured
                        // either way, not this migration's to fix
                        implementation: 'ldk-node',
                        ldkNetwork: 'testnet',
                        ldkRgsServer: 'https://rgs.zeusln.com/snapshot'
                    },
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'mainnet',
                        ldkRgsServer:
                            'https://rapidsync.lightningdevkit.org/testnet/snapshot'
                    }
                ]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(false);
            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://rgs.zeusln.com/snapshot'
            );
            expect(settings.nodes[1].ldkRgsServer).toBe(
                'https://rapidsync.lightningdevkit.org/testnet/snapshot'
            );
        });

        it('leaves custom URLs untouched', () => {
            const settings: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'mainnet',
                        ldkRgsServer: 'https://my-custom-rgs.com/snapshot'
                    }
                ]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(false);
            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://my-custom-rgs.com/snapshot'
            );
        });

        it('leaves unset values unset so runtime falls back to new defaults', () => {
            const settings: any = {
                nodes: [{ implementation: 'ldk-node', ldkNetwork: 'mainnet' }]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(false);
            expect(settings.nodes[0].ldkRgsServer).toBeUndefined();
        });

        it('is idempotent', () => {
            const settings: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkRgsServer: 'https://rgs.zeusln.com/snapshot'
                    }
                ]
            };

            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(true);
            expect(MigrationUtils.applyRgsDefaultsToV2(settings)).toBe(false);
            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://rgs.zeusln.com/snapshot/v2'
            );
        });

        it('is a no-op without nodes', () => {
            expect(MigrationUtils.applyRgsDefaultsToV2({})).toBe(false);
        });
    });

    describe('runSettingsMigrations', () => {
        const EncryptedStorage = require('react-native-encrypted-storage');
        const { settingsStore } = require('../stores/Stores');

        beforeEach(() => {
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
            settingsStore.setSettings.mockReset();
        });

        it('skips everything when the blob is already stamped', async () => {
            const settings: any = {
                settingsVersion: 1,
                lspMainnet: 'https://0conf.lnolymp.us'
            };

            await MigrationUtils.runSettingsMigrations(settings);

            expect(settings.lspMainnet).toBe('https://0conf.lnolymp.us');
            expect(EncryptedStorage.getItem).not.toHaveBeenCalled();
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
        });

        it('consolidates an unstamped blob with a single write and stamps it', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us',
                swaps: { hostMainnet: 'https://swaps.zeuslsp.com/api/v2' }
            };

            await MigrationUtils.runSettingsMigrations(settings);

            expect(settings.lspMainnet).toBe('https://flow.zeuslsp.com');
            expect(settings.swaps.hostMainnet).toBe(
                'https://api.boltz.exchange/v2'
            );
            expect(settings.settingsVersion).toBe(1);
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
            // retired per-migration flags are never written again
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
        });

        it('persists the settings object rather than a JSON string', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);
            const settings: any = {};

            await MigrationUtils.runSettingsMigrations(settings);

            const persistedSettings =
                settingsStore.setSettings.mock.calls[0][0];
            expect(typeof persistedSettings).not.toBe('string');
            expect(persistedSettings).toBe(settings);
        });

        it('honors retired per-migration flags during consolidation', async () => {
            EncryptedStorage.getItem.mockImplementation((key: string) =>
                Promise.resolve(key === 'zeuslsp-hosts-2026' ? 'true' : null)
            );
            const settings: any = {
                lspMainnet: 'https://0conf.lnolymp.us',
                swaps: { hostMainnet: 'https://swaps.zeuslsp.com/api/v2' }
            };

            await MigrationUtils.runSettingsMigrations(settings);

            // Olympus host migration already ran on this install — the
            // (user-restored) old value must not be rewritten again
            expect(settings.lspMainnet).toBe('https://0conf.lnolymp.us');
            // the un-flagged swap migration still applies
            expect(settings.swaps.hostMainnet).toBe(
                'https://api.boltz.exchange/v2'
            );
            expect(settings.settingsVersion).toBe(1);
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);
        });

        it('honors rgs-defaults-v2 but ignores the superseded rgs-default-zeus flag', async () => {
            // typical existing install: the retired v1 migration already ran
            // and pinned the v1 ZEUS default — its flag must not gate the v2
            // rewrite, only rgs-defaults-v2 does
            EncryptedStorage.getItem.mockImplementation((key: string) =>
                Promise.resolve(key === 'rgs-default-zeus' ? 'true' : null)
            );
            const settings: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'mainnet',
                        ldkRgsServer: 'https://rgs.zeusln.com/snapshot'
                    }
                ]
            };

            await MigrationUtils.runSettingsMigrations(settings);

            expect(settings.nodes[0].ldkRgsServer).toBe(
                'https://rgs.zeusln.com/snapshot/v2'
            );

            EncryptedStorage.getItem.mockImplementation((key: string) =>
                Promise.resolve(key === 'rgs-defaults-v2' ? 'true' : null)
            );
            const flagged: any = {
                nodes: [
                    {
                        implementation: 'ldk-node',
                        ldkNetwork: 'mainnet',
                        ldkRgsServer: 'https://rgs.zeusln.com/snapshot'
                    }
                ]
            };

            await MigrationUtils.runSettingsMigrations(flagged);

            expect(flagged.nodes[0].ldkRgsServer).toBe(
                'https://rgs.zeusln.com/snapshot'
            );
        });

        it('stamps with one write even when nothing needed migrating, then goes quiet', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');
            const settings: any = {
                lspMainnet: 'https://flow.zeuslsp.com'
            };

            await MigrationUtils.runSettingsMigrations(settings);

            expect(settings.settingsVersion).toBe(1);
            expect(settingsStore.setSettings).toHaveBeenCalledTimes(1);

            // second run: stamped — zero storage traffic
            EncryptedStorage.getItem.mockClear();
            settingsStore.setSettings.mockClear();

            await MigrationUtils.runSettingsMigrations(settings);

            expect(EncryptedStorage.getItem).not.toHaveBeenCalled();
            expect(settingsStore.setSettings).not.toHaveBeenCalled();
        });
    });

    describe('purgeRescueKeyFiles', () => {
        const RNFS = require('react-native-fs');
        const EncryptedStorage = require('react-native-encrypted-storage');
        // Platform.OS is 'ios' under the RN jest preset, so the legacy path
        // is the Documents dir. The staging path is the cache dir on both.
        const STAGING_PATH = '/cache/rescue_key.json';
        const LEGACY_PATH = '/docs/rescue_key.json';

        const stagingUnlinks = () =>
            RNFS.unlink.mock.calls.filter(
                (call: any[]) => call[0] === STAGING_PATH
            );

        beforeEach(() => {
            RNFS.exists.mockReset().mockResolvedValue(true);
            RNFS.unlink.mockReset().mockResolvedValue(undefined);
            EncryptedStorage.getItem.mockReset();
            EncryptedStorage.setItem.mockReset();
        });

        it('unlinks the staging file at most once per process', async () => {
            // getSettings() calls this on every transition to the background
            // (App.tsx stealth-mode handler), not only at launch. The Android
            // save dialog backgrounds the app while the staging file still
            // has to be readable - saveDocuments() copies it only once the
            // app is back in the foreground - so unlinking on every call
            // deletes the export source mid-save and fails the export.
            EncryptedStorage.getItem.mockResolvedValue('true');

            await MigrationUtils.purgeRescueKeyFiles();
            await MigrationUtils.purgeRescueKeyFiles();
            await MigrationUtils.purgeRescueKeyFiles();

            expect(stagingUnlinks()).toHaveLength(1);
        });

        it('purges the legacy shared-storage file once and sets the flag', async () => {
            EncryptedStorage.getItem.mockResolvedValue(null);

            await MigrationUtils.purgeRescueKeyFiles();

            expect(RNFS.unlink).toHaveBeenCalledWith(LEGACY_PATH);
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'rescue-key-file-cleanup',
                'true'
            );
        });

        it('skips the legacy purge when the flag is already set', async () => {
            EncryptedStorage.getItem.mockResolvedValue('true');

            await MigrationUtils.purgeRescueKeyFiles();

            expect(RNFS.unlink).not.toHaveBeenCalledWith(LEGACY_PATH);
            expect(EncryptedStorage.setItem).not.toHaveBeenCalled();
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
