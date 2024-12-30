jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn()
}));
jest.mock('react-native-tor', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: {
        setSettings: jest.fn()
    }
}));
jest.mock('../utils/BackendUtils', () => ({}));

import { DEFAULT_NOSTR_RELAYS_2023 } from '../stores/SettingsStore';
import MigrationUtils from './MigrationUtils';

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

    describe('MigrationUtils', () => {
        it('handles empty settings', () => {
            expect(
                MigrationUtils.legacySettingsMigrations('{}')
            ).resolves.toEqual({
                ...defaultSettings
            });
        });
        it('handles mod1', () => {
            expect(
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
        it('handles mod2', () => {
            expect(
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
        it('handles mod3', () => {
            expect(
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
        it('handles mod7', () => {
            expect(
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
        it('handles mod8', () => {
            expect(
                MigrationUtils.legacySettingsMigrations(
                    JSON.stringify({
                        lightningAddress: {
                            nostrRelays: DEFAULT_NOSTR_RELAYS_2023,
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
        it('migrates old POS squareEnabled setting to posEnabled', () => {
            expect(
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
    });
});
