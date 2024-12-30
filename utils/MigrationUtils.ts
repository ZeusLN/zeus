import stores from '../stores/Stores';
import {
    Settings,
    DEFAULT_FIAT_RATES_SOURCE,
    DEFAULT_FIAT,
    DEFAULT_LSP_MAINNET,
    DEFAULT_LSP_TESTNET,
    DEFAULT_NOSTR_RELAYS,
    localeMigrationMapping,
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET,
    DEFAULT_LSPS1_HOST_MAINNET,
    DEFAULT_LSPS1_HOST_TESTNET,
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_LSPS1_PUBKEY_TESTNET,
    DEFAULT_LSPS1_REST_MAINNET,
    DEFAULT_LSPS1_REST_TESTNET,
    DEFAULT_SPEEDLOADER,
    DEFAULT_NOSTR_RELAYS_2023,
    PosEnabled,
    DEFAULT_SLIDE_TO_PAY_THRESHOLD
} from '../stores/SettingsStore';
import EncryptedStorage from 'react-native-encrypted-storage';

class MigrationsUtils {
    public async legacySettingsMigrations(settings: string) {
        const newSettings = JSON.parse(settings) as Settings;
        if (!newSettings.fiatRatesSource) {
            newSettings.fiatRatesSource = DEFAULT_FIAT_RATES_SOURCE;
        }

        // migrate fiat settings from older versions
        if (!newSettings.fiat || newSettings.fiat === 'Disabled') {
            newSettings.fiat = DEFAULT_FIAT;
            newSettings.fiatEnabled = false;
        } else if (newSettings.fiatEnabled == null) {
            newSettings.fiatEnabled = true;
        }

        // set default LSPs if not defined
        if (newSettings.enableLSP === undefined) {
            newSettings.enableLSP = true;
        }
        if (!newSettings.lspMainnet) {
            newSettings.lspMainnet = DEFAULT_LSP_MAINNET;
        }
        if (!newSettings.lspTestnet) {
            newSettings.lspTestnet = DEFAULT_LSP_TESTNET;
        }

        // default Lightning Address settings
        if (!newSettings.lightningAddress) {
            newSettings.lightningAddress = {
                enabled: false,
                automaticallyAccept: true,
                automaticallyAcceptAttestationLevel: 2,
                automaticallyRequestOlympusChannels: false, // deprecated
                routeHints: false,
                allowComments: true,
                nostrPrivateKey: '',
                nostrRelays: DEFAULT_NOSTR_RELAYS,
                notifications: 0
            };
        }

        // migrate locale to ISO 639-1
        if (
            newSettings.locale != null &&
            localeMigrationMapping[newSettings.locale]
        ) {
            newSettings.locale = localeMigrationMapping[newSettings.locale];
        }

        const MOD_KEY = 'lsp-taproot-mod';
        const mod = await EncryptedStorage.getItem(MOD_KEY);
        if (!mod) {
            newSettings.requestSimpleTaproot = true;
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY, 'true');
        }

        const MOD_KEY2 = 'lsp-preview-mod';
        const mod2 = await EncryptedStorage.getItem(MOD_KEY2);
        if (!mod2) {
            if (newSettings?.lspMainnet === 'https://lsp-preview.lnolymp.us') {
                newSettings.lspMainnet = DEFAULT_LSP_MAINNET;
            }
            if (newSettings?.lspTestnet === 'https://testnet-lsp.lnolymp.us') {
                newSettings.lspTestnet = DEFAULT_LSP_TESTNET;
            }
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY2, 'true');
        }

        const MOD_KEY3 = 'neutrino-peers-mod1';
        const mod3 = await EncryptedStorage.getItem(MOD_KEY3);
        if (!mod3) {
            const neutrinoPeersMainnetOld = [
                'btcd1.lnolymp.us',
                'btcd2.lnolymp.us',
                'btcd-mainnet.lightning.computer',
                'node.eldamar.icu',
                'noad.sathoarder.com'
            ];
            if (
                JSON.stringify(newSettings?.neutrinoPeersMainnet) ===
                JSON.stringify(neutrinoPeersMainnetOld)
            ) {
                newSettings.neutrinoPeersMainnet =
                    DEFAULT_NEUTRINO_PEERS_MAINNET;
            }
            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY3, 'true');
        }

        const MOD_KEY4 = 'lsps1-hosts1';
        const mod4 = await EncryptedStorage.getItem(MOD_KEY4);
        if (!mod4) {
            if (!newSettings?.lsps1HostMainnet) {
                newSettings.lsps1HostMainnet = DEFAULT_LSPS1_HOST_MAINNET;
            }
            if (!newSettings?.lsps1HostTestnet) {
                newSettings.lsps1HostTestnet = DEFAULT_LSPS1_HOST_TESTNET;
            }
            if (!newSettings?.lsps1PubkeyMainnet) {
                newSettings.lsps1PubkeyMainnet = DEFAULT_LSPS1_PUBKEY_MAINNET;
            }
            if (!newSettings?.lsps1PubkeyTestnet) {
                newSettings.lsps1PubkeyTestnet = DEFAULT_LSPS1_PUBKEY_TESTNET;
            }
            if (!newSettings?.lsps1RestMainnet) {
                newSettings.lsps1RestMainnet = DEFAULT_LSPS1_REST_MAINNET;
            }
            if (!newSettings?.lsps1RestTestnet) {
                newSettings.lsps1RestTestnet = DEFAULT_LSPS1_REST_TESTNET;
            }

            if (!newSettings?.lsps1Token) {
                newSettings.lsps1Token = '';
            }

            if (!newSettings?.lsps1ShowPurchaseButton) {
                newSettings.lsps1ShowPurchaseButton = true;
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY4, 'true');
        }

        const MOD_KEY5 = 'millisat_amounts';
        const mod5 = await EncryptedStorage.getItem(MOD_KEY5);
        if (!mod5) {
            if (!newSettings?.display?.showMillisatoshiAmounts) {
                if (!newSettings.display) {
                    newSettings.display = {
                        showMillisatoshiAmounts: true
                    };
                } else {
                    newSettings.display.showMillisatoshiAmounts = true;
                }
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY5, 'true');
        }

        const MOD_KEY6 = 'egs-host';
        const mod6 = await EncryptedStorage.getItem(MOD_KEY6);
        if (!mod6) {
            if (!newSettings?.speedloader) {
                newSettings.speedloader = DEFAULT_SPEEDLOADER;
                newSettings.customSpeedloader = '';
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY6, 'true');
        }

        // switch off bimodal pathfinding while bug exists
        // https://github.com/lightningnetwork/lnd/issues/9085
        const MOD_KEY7 = 'bimodal-bug-9085';
        const mod7 = await EncryptedStorage.getItem(MOD_KEY7);
        if (!mod7) {
            if (newSettings?.bimodalPathfinding) {
                newSettings.bimodalPathfinding = false;
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY7, 'true');
        }

        const MOD_KEY8 = 'nostr-relays-2024';
        const mod8 = await EncryptedStorage.getItem(MOD_KEY8);
        if (!mod8) {
            if (
                JSON.stringify(newSettings?.lightningAddress?.nostrRelays) ===
                JSON.stringify(DEFAULT_NOSTR_RELAYS_2023)
            ) {
                newSettings.lightningAddress.nostrRelays = DEFAULT_NOSTR_RELAYS;
            }

            stores.settingsStore.setSettings(JSON.stringify(newSettings));
            await EncryptedStorage.setItem(MOD_KEY8, 'true');
        }

        // migrate old POS squareEnabled setting to posEnabled
        if (newSettings?.pos?.squareEnabled) {
            newSettings.pos.posEnabled = PosEnabled.Square;
            newSettings.pos.squareEnabled = false;
        }

        if (!newSettings.neutrinoPeersMainnet) {
            newSettings.neutrinoPeersMainnet = DEFAULT_NEUTRINO_PEERS_MAINNET;
        }
        if (!newSettings.neutrinoPeersTestnet) {
            newSettings.neutrinoPeersTestnet = DEFAULT_NEUTRINO_PEERS_TESTNET;
        }

        if (newSettings.payments == null) {
            newSettings.payments = {
                slideToPayThreshold: DEFAULT_SLIDE_TO_PAY_THRESHOLD
            };
        } else if (newSettings.payments.slideToPayThreshold == null) {
            newSettings.payments.slideToPayThreshold =
                DEFAULT_SLIDE_TO_PAY_THRESHOLD;
        }

        return newSettings;
    }
}

const migrationsUtils = new MigrationsUtils();
export default migrationsUtils;
