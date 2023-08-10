import { action, observable } from 'mobx';
import { BiometryType } from 'react-native-biometrics';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';

// lndhub
import LoginRequest from './../models/LoginRequest';

interface Node {
    host?: string;
    port?: string;
    url?: string;
    macaroonHex?: string;
    accessKey?: string;
    implementation?: string;
    certVerification?: boolean;
    enableTor?: boolean;
    nickname?: string;
    // LNC
    pairingPhrase?: string;
    mailboxServer?: string;
    customMailboxServer?: string;
}

interface PrivacySettings {
    defaultBlockExplorer?: string;
    customBlockExplorer?: string;
    clipboard?: boolean;
    lurkerMode?: boolean;
    enableMempoolRates?: boolean;
}

interface DisplaySettings {
    theme?: string;
    defaultView?: string;
    displayNickname?: boolean;
    bigKeypadButtons?: boolean;
    showAllDecimalPlaces?: boolean;
}

interface PosSettings {
    squareEnabled?: boolean;
    squareAccessToken?: string;
    squareLocationId?: string;
    merchantName?: string;
    confirmationPreference?: string;
    disableTips?: boolean;
    squareDevMode?: boolean;
}

interface PaymentsSettings {
    defaultFeeMethod?: string;
    defaultFeePercentage?: string;
    defaultFeeFixed?: string;
}

interface InvoicesSettings {
    addressType?: string;
    memo?: string;
    expiry?: string;
    routeHints?: boolean;
    ampInvoice?: boolean;
}

export interface Settings {
    nodes?: Array<Node>;
    selectedNode?: number;
    passphrase?: string;
    duressPassphrase?: string;
    pin?: string;
    duressPin?: string;
    scramblePin?: boolean;
    loginBackground?: boolean;
    authenticationAttempts?: number;
    fiatEnabled?: boolean;
    fiat?: string;
    fiatRatesSource: 'Zeus' | 'Yadio';
    locale?: string;
    privacy: PrivacySettings;
    display: DisplaySettings;
    pos: PosSettings;
    payments: PaymentsSettings;
    invoices: InvoicesSettings;
    isBiometryEnabled: boolean;
    supportedBiometryType?: BiometryType;
    lndHubLnAuthMode?: string;
    // Embedded node
    expressGraphSync: boolean;
    expressGraphSyncMobile: boolean;
    resetExpressGraphSyncOnStartup: boolean;
    bimodalPathfinding: boolean;
    // LSP
    enableLSP: boolean;
    lspMainnet: string;
    lspTestnet: string;
    lspAccessKey: string;
}

export const FIAT_RATES_SOURCE_KEYS = [
    { key: 'Zeus', value: 'Zeus' },
    { key: 'Yadio', value: 'Yadio' }
];

export const BLOCK_EXPLORER_KEYS = [
    { key: 'mempool.space', value: 'mempool.space' },
    { key: 'blockstream.info', value: 'blockstream.info' },
    {
        key: 'Custom',
        translateKey: 'views.Settings.Privacy.BlockExplorer.custom',
        value: 'Custom'
    }
];

export const INTERFACE_KEYS = [
    { key: 'Embedded LND', value: 'embedded-lnd' },
    { key: 'LND (REST)', value: 'lnd' },
    { key: 'LND (Lightning Node Connect)', value: 'lightning-node-connect' },
    { key: 'Core Lightning (c-lightning-REST)', value: 'c-lightning-REST' },
    { key: 'Eclair', value: 'eclair' },
    { key: 'LNDHub', value: 'lndhub' },
    { key: '[DEPRECATED] Core Lightning (Sparko)', value: 'spark' }
];

export const LNC_MAILBOX_KEYS = [
    {
        key: 'mailbox.terminal.lightning.today:443',
        value: 'mailbox.terminal.lightning.today:443'
    },
    {
        key: 'lnc.zeusln.app:443',
        value: 'lnc.zeusln.app:443'
    },
    { key: 'Custom defined mailbox', value: 'custom-defined' }
];

export const LOCALE_KEYS = [
    { key: 'English', value: 'English' },
    { key: 'Español', value: 'Español' },
    { key: 'Português', value: 'Português' },
    { key: 'Français', value: 'Français' },
    { key: 'Čeština', value: 'Čeština' },
    { key: 'Slovenčina', value: 'Slovenčina' },
    { key: 'Deutsch', value: 'Deutsch' },
    { key: 'Polski', value: 'Polski' },
    { key: 'Türkçe', value: 'Türkçe' },
    { key: 'magyar nyelv', value: 'magyar nyelv' },
    { key: '简化字', value: '简化字' },
    { key: 'Nederlands', value: 'Nederlands' },
    { key: 'Bokmål', value: 'Bokmål' },
    { key: 'Svenska', value: 'Svenska' },
    { key: 'ภาษาไทย', value: 'ภาษาไทย' },
    { key: 'украї́нська мо́ва', value: 'украї́нська мо́ва' },
    { key: 'Limba română', value: 'Limba română' },
    // in progress
    { key: 'Ελληνικά', value: 'Ελληνικά' },
    { key: 'زبان فارسي', value: 'زبان فارسي' },
    { key: 'Slovenski jezik', value: 'Slovenski jezik' },
    { key: 'русский язык', value: 'русский язык' },
    { key: 'Suomen kieli', value: 'Suomen kieli' },
    { key: 'Italiano', value: 'Italiano' },
    { key: 'Tiếng Việt', value: 'Tiếng Việt' },
    { key: '日本語', value: '日本語' },
    { key: 'עִבְרִית', value: 'עִבְרִית' },
    { key: 'Hrvatski', value: 'Hrvatski' }
];

export const CURRENCY_KEYS = [
    {
        key: '🇺🇸 US Dollar (USD)',
        value: 'USD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇯🇵 Japanese Yen (JPY)',
        value: 'JPY',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇳 Chinese Yuan (CNY)',
        value: 'CNY',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇸🇬 Singapore Dollar (SGD)',
        value: 'SGD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇭🇰 Hong Kong Dollar (HKD)',
        value: 'HKD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇦 Canadian Dollar (CAD)',
        value: 'CAD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇿 New Zealand Dollar (NZD)',
        value: 'NZD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇦🇺 Australian Dollar (AUD)',
        value: 'AUD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇱 Chilean Peso (CLP)',
        value: 'CLP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇬🇧 Great British Pound (GBP)',
        value: 'GBP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇩🇰 Danish Krone (DKK)',
        value: 'DKK',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇸🇪 Swedish Krona (SEK)',
        value: 'SEK',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇮🇸 Icelandic Krona (ISK)',
        value: 'ISK',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇭 Swiss Franc (CHF)',
        value: 'CHF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇷 Brazilian Real (BRL)',
        value: 'BRL',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇪🇺 Eurozone Euro (EUR)',
        value: 'EUR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇷🇺 Russian Ruble (RUB)',
        value: 'RUB',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇱 Polish Złoty (PLN)',
        value: 'PLN',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇭 Thai Baht (THB)',
        value: 'THB',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇰🇷 South Korean Won (KRW)',
        value: 'KRW',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇼 New Taiwan Dollar (TWD)',
        value: 'TWD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇿 Czech Koruna (CZK)',
        value: 'CZK',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇭🇺 Hungarian Forint (HUF)',
        value: 'HUF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇮🇳 Indian Rupee (INR)',
        value: 'INR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇷 Turkish Lira (TRY)',
        value: 'TRY',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇬 Nigerian Naira (NGN)',
        value: 'NGN',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇦🇷 Argentine Peso (ARS)',
        value: 'ARS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇮🇱 Israeli New Shekel (ILS)',
        value: 'ILS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇱🇧 Lebanese Pound (LBP)',
        value: 'LBP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇲🇾 Malaysian Ringgit (MYR)',
        value: 'MYR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇺🇦 Ukrainian Hryvnia (UAH)',
        value: 'UAH',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇯🇲 Jamaican Dollar (JMD)',
        value: 'JMD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇴 Colombian Peso (COP)',
        value: 'COP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇲🇽 Mexican Peso (MXN)',
        value: 'MXN',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇻🇪 Venezuelan Bolivar (VES)',
        value: 'VES',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇿 Tanzanian Shilling (TZS)',
        value: 'TZS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇶🇦 Qatari Riyal (QAR)',
        value: 'QAR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇳 Tunisian Dinar (TND)',
        value: 'TND',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇴 Norwegian Krone (NOK)',
        value: 'NOK',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇦🇪 United Arab Emirates Dirham (AED)',
        value: 'AED',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇹🇹 Trinidad & Tobago Dollar (TTD)',
        value: 'TTD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇭 Philippine Peso (PHP)',
        value: 'PHP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇮🇩 Indonesian Rupiah (IDR)',
        value: 'IDR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇷🇴 Romanian Leu (RON)',
        value: 'RON',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇩 Congolese Franc (CDF)',
        value: 'CDF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇲🇨🇫🇹🇩🇨🇬🇬🇶🇬🇦 Central African CFA franc (XAF)',
        value: 'XAF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇰🇪 Kenyan Shilling (KES)',
        value: 'KES',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇺🇬 Ugandan Shilling (UGX)',
        value: 'UGX',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇿🇦 South African Rand (ZAR)',
        value: 'ZAR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇺 Cuban Peso (CUP)',
        value: 'CUP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇩🇴 Dominican Peso (DOP)',
        value: 'DOP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇿 Belize Dollar (BZD)',
        value: 'BZD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇴 Bolivian Boliviano (BOB)',
        value: 'BOB',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇨🇷 Costa Rican Colón (CRC)',
        value: 'CRC',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇬🇹 Guatemalan Quetzal (GTQ)',
        value: 'GTQ',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇮 Nicaraguan Córdoba (NIO)',
        value: 'NIO',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇾 Paraguayan Guaraní (PYG)',
        value: 'PYG',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇺🇾 Uruguayan Peso (UYU)',
        value: 'UYU',
        supportedSources: ['Zeus', 'Yadio']
    }
];

export const THEME_KEYS = [
    { key: 'Dark', translateKey: 'views.Settings.Theme.dark', value: 'dark' },
    {
        key: 'Light',
        translateKey: 'views.Settings.Theme.light',
        value: 'light'
    },
    {
        key: 'Junkie',
        translateKey: 'views.Settings.Theme.junkie',
        value: 'junkie'
    },
    { key: 'BPM', translateKey: 'views.Settings.Theme.bpm', value: 'bpm' },
    {
        key: 'Orange',
        translateKey: 'views.Settings.Theme.orange',
        value: 'orange'
    },
    {
        key: 'Blacked Out',
        translateKey: 'views.Settings.Theme.blacked-out',
        value: 'blacked-out'
    },
    {
        key: 'Scarlet',
        translateKey: 'views.Settings.Theme.scarlet',
        value: 'scarlet'
    },
    {
        key: 'Memberberry',
        translateKey: 'views.Settings.Theme.purple',
        value: 'purple'
    },
    {
        key: 'Blueberry',
        translateKey: 'views.Settings.Theme.blueberry',
        value: 'blueberry'
    },
    {
        key: 'Deep Purple',
        translateKey: 'views.Settings.Theme.deep-purple',
        value: 'deep-purple'
    },
    {
        key: 'Deadpool',
        translateKey: 'views.Settings.Theme.deadpool',
        value: 'deadpool'
    },
    {
        key: 'Mighty',
        translateKey: 'views.Settings.Theme.mighty',
        value: 'mighty'
    },
    {
        key: 'Green',
        translateKey: 'views.Settings.Theme.green',
        value: 'green'
    },
    { key: 'Pub', translateKey: 'views.Settings.Theme.pub', value: 'pub' },
    {
        key: 'Popsicle',
        translateKey: 'views.Settings.Theme.popsicle',
        value: 'popsicle'
    },
    {
        key: 'Nostrich',
        translateKey: 'views.Settings.Theme.nostrich',
        value: 'nostrich'
    },
    {
        key: 'Desert',
        translateKey: 'views.Settings.Theme.desert',
        value: 'desert'
    },
    {
        key: 'Orange Cream Soda',
        translateKey: 'views.Settings.Theme.orange-cream-soda',
        value: 'orange-cream-soda'
    },
    { key: 'Mint', translateKey: 'views.Settings.Theme.mint', value: 'mint' },
    {
        key: 'Red Metallic',
        translateKey: 'views.Settings.Theme.red-metallic',
        value: 'red-metallic'
    },
    {
        key: 'Watermelon',
        translateKey: 'views.Settings.Theme.watermelon',
        value: 'watermelon'
    }
];

export const DEFAULT_VIEW_KEYS = [
    {
        key: 'Balance',
        translateKey: 'views.Settings.Display.DefaultView.balance',
        value: 'Balance'
    },
    {
        key: 'Keypad',
        translateKey: 'views.Settings.Display.DefaultView.keypad',
        value: 'Keypad'
    }
];

export const DEFAULT_THEME = 'dark';
export const DEFAULT_FIAT = 'USD';
export const DEFAULT_FIAT_RATES_SOURCE = 'Zeus';
export const DEFAULT_LOCALE = 'English';

export const POS_CONF_PREF_KEYS = [
    { key: '0 conf', value: '0conf' },
    { key: '1 conf', value: '1conf' },
    { key: 'LN only', value: 'lnOnly' }
];

export const LNDHUB_AUTH_MODES = [
    { key: 'BlueWallet', value: 'BlueWallet' },
    { key: 'Alby', value: 'Alby' }
];

const STORAGE_KEY = 'zeus-settings';

export default class SettingsStore {
    @observable settings: Settings = {
        privacy: {
            defaultBlockExplorer: 'mempool.space',
            customBlockExplorer: '',
            clipboard: false,
            lurkerMode: false,
            enableMempoolRates: true
        },
        display: {
            theme: DEFAULT_THEME,
            defaultView: 'Keypad',
            displayNickname: false,
            bigKeypadButtons: false,
            showAllDecimalPlaces: false
        },
        pos: {
            squareEnabled: false,
            squareAccessToken: '',
            squareLocationId: '',
            merchantName: '',
            confirmationPreference: 'lnOnly',
            disableTips: false,
            squareDevMode: false
        },
        payments: {
            defaultFeeMethod: 'fixed',
            defaultFeePercentage: '0.5',
            defaultFeeFixed: '100'
        },
        invoices: {
            addressType: '0',
            memo: '',
            expiry: '3600',
            routeHints: false,
            ampInvoice: false
        },
        supportedBiometryType: undefined,
        isBiometryEnabled: false,
        scramblePin: true,
        loginBackground: false,
        fiatEnabled: false,
        fiat: DEFAULT_FIAT,
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE,
        // EGS
        expressGraphSync: false,
        expressGraphSyncMobile: false,
        resetExpressGraphSyncOnStartup: false,
        // embedded node
        bimodalPathfinding: false,
        // LSP
        enableLSP: true,
        lspMainnet: 'https://lsp-preview.lnolymp.us',
        lspTestnet: 'https://testnet-lsp.lnolymp.us',
        lspAccessKey: ''
    };
    @observable public posStatus: string = 'unselected';
    @observable public loading = false;
    @observable btcPayError: string | null;
    @observable sponsorsError: string | null;
    @observable olympians: Array<any>;
    @observable gods: Array<any>;
    @observable mortals: Array<any>;
    @observable host: string;
    @observable port: string;
    @observable url: string;
    @observable macaroonHex: string;
    @observable accessKey: string;
    @observable implementation: string;
    @observable certVerification: boolean | undefined;
    @observable public loggedIn = false;
    @observable public connecting = true;
    @observable public lurkerExposed = false;
    // LNDHub
    @observable username: string;
    @observable password: string;
    @observable lndhubUrl: string;
    @observable public createAccountError: string;
    @observable public createAccountSuccess: string;
    @observable public accessToken: string;
    @observable public refreshToken: string;
    // Tor
    @observable public enableTor: boolean;
    // LNC
    @observable public pairingPhrase: string;
    @observable public mailboxServer: string;
    @observable public customMailboxServer: string;
    @observable public error = false;
    @observable public errorMsg: string;
    // Embedded lnd
    @observable public seedPhrase: Array<string>;
    @observable public walletPassword: string;
    @observable public adminMacaroon: string;
    @observable public embeddedLndNetwork: string;

    @action
    public changeLocale = (locale: string) => {
        this.settings.locale = locale;
    };

    @action
    public fetchBTCPayConfig = (data: string) => {
        const configRoute = data.split('config=')[1];
        this.btcPayError = null;

        if (configRoute.includes('.onion')) {
            return doTorRequest(configRoute, RequestMethod.GET)
                .then((response: any) => {
                    return this.parseBTCPayConfig(response);
                })
                .catch((err: any) => {
                    // handle error
                    this.btcPayError = `${localeString(
                        'stores.SettingsStore.btcPayFetchConfigError'
                    )}: ${err.toString()}`;
                });
        } else {
            return ReactNativeBlobUtil.fetch('get', configRoute)
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        return this.parseBTCPayConfig(data);
                    } else {
                        this.btcPayError = localeString(
                            'stores.SettingsStore.btcPayFetchConfigError'
                        );
                    }
                })
                .catch((err: any) => {
                    // handle error
                    this.btcPayError = `${localeString(
                        'stores.SettingsStore.btcPayFetchConfigError'
                    )}: ${err.toString()}`;
                });
        }
    };

    @action
    public fetchSponsors = () => {
        const olympiansRoute = 'https://zeusln.app/api/sponsors/v2/getSponsors';
        this.sponsorsError = null;
        this.olympians = [];
        this.gods = [];
        this.mortals = [];
        this.loading = true;

        if (this.enableTor) {
            return doTorRequest(olympiansRoute, RequestMethod.GET)
                .then((response: any) => {
                    this.olympians = response.olympians;
                    this.gods = response.gods;
                    this.mortals = response.mortals;
                    this.loading = false;
                })
                .catch((err: any) => {
                    // handle error
                    this.olympians = [];
                    this.gods = [];
                    this.mortals = [];
                    this.loading = false;
                    this.sponsorsError = `${localeString(
                        'stores.SettingsStore.olympianFetchError'
                    )}: ${err.toString()}`;
                });
        } else {
            return ReactNativeBlobUtil.fetch('get', olympiansRoute)
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        this.olympians = data.olympians;
                        this.gods = data.gods;
                        this.mortals = data.mortals;
                        this.loading = false;
                    } else {
                        this.olympians = [];
                        this.gods = [];
                        this.mortals = [];
                        this.loading = false;
                        this.sponsorsError = localeString(
                            'stores.SettingsStore.olympianFetchError'
                        );
                    }
                })
                .catch((err: any) => {
                    // handle error
                    this.olympians = [];
                    this.gods = [];
                    this.mortals = [];
                    this.loading = false;
                    this.sponsorsError = `${localeString(
                        'stores.SettingsStore.olympianFetchError'
                    )}: ${err.toString()}`;
                });
        }
    };

    parseBTCPayConfig(data: any) {
        const configuration = data.configurations[0];
        const { adminMacaroon, macaroon, type, uri } = configuration;

        if (type !== 'lnd-rest' && type !== 'clightning-rest') {
            this.btcPayError = localeString(
                'stores.SettingsStore.btcPayImplementationSupport'
            );
        } else {
            const config = {
                host: uri,
                macaroonHex: adminMacaroon || macaroon,
                implementation:
                    type === 'clightning-rest' ? 'c-lightning-REST' : 'lnd'
            };

            return config;
        }
    }

    hasCredentials() {
        return this.macaroonHex || this.accessKey ? true : false;
    }

    @action
    public async getSettings() {
        this.loading = true;
        try {
            // Retrieve the settings
            const settings = await EncryptedStorage.getItem(STORAGE_KEY);
            if (settings) {
                this.settings = JSON.parse(settings);
                if (!this.settings.fiatRatesSource) {
                    this.settings.fiatRatesSource = DEFAULT_FIAT_RATES_SOURCE;
                }

                // migrate fiat settings from older versions
                if (!this.settings.fiat || this.settings.fiat === 'Disabled') {
                    this.settings.fiat = DEFAULT_FIAT;
                    this.settings.fiatEnabled = false;
                } else if (this.settings.fiatEnabled == null) {
                    this.settings.fiatEnabled = true;
                }

                const node: any =
                    this.settings.nodes &&
                    this.settings.nodes[this.settings.selectedNode || 0];
                if (node) {
                    this.host = node.host;
                    this.port = node.port;
                    this.url = node.url;
                    this.username = node.username;
                    this.password = node.password;
                    this.lndhubUrl = node.lndhubUrl;
                    this.macaroonHex = node.macaroonHex;
                    this.accessKey = node.accessKey;
                    this.implementation = node.implementation || 'lnd';
                    this.certVerification = node.certVerification || false;
                    this.enableTor = node.enableTor;
                    // LNC
                    this.pairingPhrase = node.pairingPhrase;
                    this.mailboxServer = node.mailboxServer;
                    this.customMailboxServer = node.customMailboxServer;
                    // Embeded lnd
                    this.seedPhrase = node.seedPhrase;
                    this.walletPassword = node.walletPassword;
                    this.adminMacaroon = node.adminMacaroon;
                    this.embeddedLndNetwork = node.embeddedLndNetwork;
                }
            } else {
                console.log('No settings stored');
            }
        } catch (error) {
            console.error('Could not load settings', error);
        } finally {
            this.loading = false;
        }

        return this.settings;
    }

    @action
    public async setSettings(settings: string) {
        this.loading = true;
        await EncryptedStorage.setItem(STORAGE_KEY, settings);
        this.loading = false;
        return settings;
    }

    @action
    public updateSettings = async (newSetting: any) => {
        const existingSettings = await this.getSettings();

        const newSettings = {
            ...existingSettings,
            ...newSetting
        };

        await this.setSettings(JSON.stringify(newSettings));
        this.settings = newSettings;
        return this.settings;
    };

    // LNDHub
    @action
    public createAccount = (
        host: string,
        certVerification?: boolean,
        enableTor?: boolean
    ) => {
        const url = `${host}/create`;
        const headers = {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };

        this.createAccountSuccess = '';
        this.createAccountError = '';
        this.loading = true;
        if (enableTor) {
            return doTorRequest(url, RequestMethod.POST)
                .then((response: any) => {
                    this.loading = false;
                    if (response.error) {
                        this.createAccountError =
                            response.message ||
                            localeString('stores.SettingsStore.lndhubError');
                    } else {
                        this.createAccountSuccess = localeString(
                            'stores.SettingsStore.lndhubSuccess'
                        );
                    }
                    return response;
                })
                .catch((err: any) => {
                    // handle error
                    const errorString = err.error || err.toString();
                    this.loading = false;
                    this.createAccountError = `${localeString(
                        'stores.SettingsStore.lndhubError'
                    )}: ${errorString}`;
                });
        } else {
            return ReactNativeBlobUtil.config({
                trusty: !certVerification
            })
                .fetch('post', url, headers, '')
                .then((response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        const data = response.json();
                        console.log('!!', data);
                        this.loading = false;
                        if (data.error) {
                            this.createAccountError =
                                data.message ||
                                localeString(
                                    'stores.SettingsStore.lndhubError'
                                );
                        } else {
                            this.createAccountSuccess = localeString(
                                'stores.SettingsStore.lndhubSuccess'
                            );
                        }

                        return data;
                    } else {
                        // handle error
                        this.loading = false;
                        this.createAccountError = localeString(
                            'stores.SettingsStore.lndhubError'
                        );
                    }
                })
                .catch((err: any) => {
                    // handle error
                    const errorString = err.error || err.toString();
                    this.loading = false;
                    this.createAccountError = `${localeString(
                        'stores.SettingsStore.lndhubError'
                    )}: ${errorString}`;
                });
        }
    };

    // LNDHub
    @action
    public login = (request: LoginRequest) => {
        this.error = false;
        this.errorMsg = '';
        this.createAccountSuccess = '';
        this.createAccountError = '';
        this.loading = true;
        return new Promise<void>(async (resolve) => {
            await BackendUtils.login({
                login: request.login,
                password: request.password
            })
                .then((data: any) => {
                    this.loading = false;
                    this.accessToken = data.access_token;
                    this.refreshToken = data.refresh_token;
                    resolve(data);
                })
                .catch(() => {
                    // handle error
                    this.loading = false;
                    this.error = true;
                    this.errorMsg = localeString(
                        'stores.SettingsStore.lndhubLoginError'
                    );
                    resolve();
                });
        });
    };

    // LNC
    @action
    public connect = async () => {
        this.loading = true;

        await BackendUtils.initLNC();

        const error = await BackendUtils.connect();
        if (error) {
            this.error = true;
            this.errorMsg = error;
            return error;
        }

        // repeatedly check if the connection was successful
        return new Promise<string | void>((resolve) => {
            let counter = 0;
            const interval = setInterval(async () => {
                counter++;
                const connected = await BackendUtils.isConnected();
                if (connected) {
                    clearInterval(interval);
                    this.loading = false;
                    resolve();
                } else if (counter > 20) {
                    clearInterval(interval);
                    this.error = true;
                    this.errorMsg = localeString(
                        'stores.SettingsStore.lncConnectError'
                    );
                    this.loading = false;
                    resolve(this.errorMsg);
                }
            }, 500);
        });
    };

    public loginRequired = () => this.loginMethodConfigured() && !this.loggedIn;

    public loginMethodConfigured = () =>
        this.settings &&
        (this.settings.passphrase ||
            this.settings.pin ||
            this.isBiometryConfigured());

    public isBiometryConfigured = () =>
        this.settings != null &&
        this.settings.isBiometryEnabled &&
        this.settings.supportedBiometryType !== undefined;

    @action
    public setLoginStatus = (status = false) => {
        this.loggedIn = status;
    };

    @action
    public setConnectingStatus = (status = false) => {
        // reset error on reconnect
        if (status) {
            this.error = false;
            this.errorMsg = '';
            BackendUtils.clearCachedCalls();
        }
        this.connecting = status;
        return this.connecting;
    };

    @action
    public toggleLurker = () => {
        this.lurkerExposed = true;
        this.settings.privacy.lurkerMode = false;

        setTimeout(() => {
            this.lurkerExposed = false;
            this.settings.privacy.lurkerMode = true;
        }, 3000);
    };

    @action
    public setPosStatus = (setting: string) => {
        this.posStatus = setting;
        return this.posStatus;
    };
}
