import { action, observable, runInAction } from 'mobx';
import { BiometryType } from 'react-native-biometrics';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';
import isEqual from 'lodash/isEqual';

import BackendUtils from '../utils/BackendUtils';
import { getSupportedBiometryType } from '../utils/BiometricUtils';
import { localeString } from '../utils/LocaleUtils';
import MigrationsUtils from '../utils/MigrationUtils';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';

import Storage from '../storage';

// lndhub
import LoginRequest from '../models/LoginRequest';

const LEGACY_STORAGE_KEY = 'zeus-settings';
export const STORAGE_KEY = 'zeus-settings-v2';

export const LEGACY_CURRENCY_CODES_KEY = 'currency-codes';
export const CURRENCY_CODES_KEY = 'zeus-currency-codes';

export interface Node {
    host?: string;
    port?: string;
    url?: string;
    macaroonHex?: string;
    rune?: string;
    accessKey?: string;
    implementation?: string;
    certVerification?: boolean;
    enableTor?: boolean;
    nickname?: string;
    dismissCustodialWarning: boolean;
    photo?: string;
    // LNC
    pairingPhrase?: string;
    mailboxServer?: string;
    customMailboxServer?: string;
    // NWC
    nostrWalletConnectUrl?: string;
    // Embedded LND
    seedPhrase?: string[];
    walletPassword?: string;
    adminMacaroon?: string;
    embeddedLndNetwork?: string;
    lndDir?: string;
    isSqlite?: boolean;
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
    removeDecimalSpaces?: boolean;
    showMillisatoshiAmounts?: boolean;
}

export enum PosEnabled {
    Disabled = 'disabled',
    Square = 'square',
    Standalone = 'standalone'
}

export enum DefaultInvoiceType {
    Unified = 'unified',
    Lightning = 'lightning'
}

interface PosSettings {
    posEnabled?: PosEnabled;
    squareEnabled?: boolean;
    squareAccessToken?: string;
    squareLocationId?: string;
    merchantName?: string;
    confirmationPreference?: string;
    disableTips?: boolean;
    squareDevMode?: boolean;
    showKeypad?: boolean;
    taxPercentage?: string;
    enablePrinter?: boolean;
    defaultView?: string;
}

interface PaymentsSettings {
    defaultFeeMethod?: string; // deprecated
    defaultFeePercentage?: string;
    defaultFeeFixed?: string;
    timeoutSeconds?: string;
    preferredMempoolRate?: string;
    slideToPayThreshold: number;
    enableDonations?: boolean;
    defaultDonationPercentage?: number;
}

interface InvoicesSettings {
    addressType?: string;
    memo?: string;
    receiverName?: string;
    expiry?: string;
    timePeriod?: string;
    expirySeconds?: string;
    routeHints?: boolean;
    ampInvoice?: boolean;
    blindedPaths: boolean;
    showCustomPreimageField?: boolean;
    displayAmountOnInvoice?: boolean; // deprecated
    defaultInvoiceType?: DefaultInvoiceType;
}

interface ChannelsSettings {
    min_confs: number;
    privateChannel: boolean;
    scidAlias: boolean;
    simpleTaprootChannel: boolean;
}

interface LightningAddressSettings {
    enabled: boolean;
    automaticallyAccept: boolean;
    automaticallyAcceptAttestationLevel: number;
    automaticallyRequestOlympusChannels: boolean; // deprecated
    routeHints: boolean;
    allowComments: boolean;
    nostrPrivateKey: string;
    nostrRelays: Array<string>;
    notifications: number;
    mintUrl: string; // Cashu
    posEnabled?: boolean; // ZEUS Pay+
}

interface Bolt12AddressSettings {
    localPart: string;
}

interface EcashSettings {
    enableCashu: boolean;
    automaticallySweep: boolean;
    sweepThresholdSats?: number;
}

interface SwapsSettings {
    hostMainnet: string;
    hostTestnet: string;
    customHost: string;
    proEnabled: boolean;
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
    channels: ChannelsSettings;
    isBiometryEnabled: boolean;
    supportedBiometryType?: BiometryType;
    lndHubLnAuthMode?: string;
    // Embedded node
    automaticDisasterRecoveryBackup: boolean;
    expressGraphSync: boolean;
    resetExpressGraphSyncOnStartup: boolean;
    bimodalPathfinding: boolean;
    graphSyncPromptNeverAsk: boolean;
    graphSyncPromptIgnoreOnce: boolean;
    dontAllowOtherPeers: boolean;
    neutrinoPeersMainnet: Array<string>;
    neutrinoPeersTestnet: Array<string>;
    zeroConfPeers: Array<string>;
    rescan: boolean;
    compactDb: boolean;
    recovery: boolean;
    initialLoad: boolean;
    embeddedTor: boolean;
    feeEstimator: string;
    customFeeEstimator: string;
    speedloader: string;
    customSpeedloader: string;
    // LSP
    enableLSP: boolean;
    lspMainnet: string;
    lspTestnet: string;
    lspAccessKey: string;
    requestSimpleTaproot: boolean;
    //LSPS1
    lsps1RestMainnet: string;
    lsps1RestTestnet: string;
    lsps1PubkeyMainnet: string;
    lsps1PubkeyTestnet: string;
    lsps1HostMainnet: string;
    lsps1HostTestnet: string;
    lsps1Token: string;
    lsps1ShowPurchaseButton?: boolean; // deprecated
    // Swaps
    swaps: SwapsSettings;
    // Lightning Address
    lightningAddress: LightningAddressSettings;
    bolt12Address: Bolt12AddressSettings;
    selectNodeOnStartup: boolean;
    ecash: EcashSettings;
}

export const FIAT_RATES_SOURCE_KEYS = [
    { key: 'ZEUS', value: 'Zeus' },
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

export const MEMPOOL_RATES_KEYS = [
    {
        key: 'Fastest fee',
        value: 'fastestFee',
        translateKey: 'views.EditFee.fastestFee'
    },
    {
        key: 'Half hour fee',
        value: 'halfHourFee',
        translateKey: 'views.EditFee.halfHourFee'
    },
    {
        key: 'Hour fee',
        value: 'hourFee',
        translateKey: 'views.EditFee.hourFee'
    },
    {
        key: 'Minimum fee',
        value: 'minimumFee',
        translateKey: 'views.EditFee.minimumFee'
    }
];

export const DEFAULT_FEE_ESTIMATOR =
    'https://nodes.lightning.computer/fees/v1/btc-fee-estimates.json';

export const FEE_ESTIMATOR_KEYS = [
    {
        key: 'lightning.computer',
        value: 'https://nodes.lightning.computer/fees/v1/btc-fee-estimates.json'
    },
    {
        key: 'strike.me',
        value: 'https://bitcoinchainfees.strike.me/v1/fee-estimates'
    },
    {
        key: 'Custom',
        translateKey: 'views.Settings.Privacy.BlockExplorer.custom',
        value: 'Custom'
    }
];

export const SWAP_HOST_KEYS_MAINNET = [
    {
        key: 'ZEUS',
        value: 'https://swaps.zeuslsp.com/api/v2',
        pro: false,
        supportsRescue: true
    },
    {
        key: 'Boltz',
        value: 'https://api.boltz.exchange/v2',
        pro: true,
        supportsRescue: true
    },
    {
        key: 'SwapMarket',
        value: 'https://api.middle-way.space/v2',
        pro: false,
        supportsRescue: true
    },
    {
        key: 'Eldamar Swaps',
        value: 'https://boltz-api.eldamar.icu/v2',
        pro: false,
        supportsRescue: true
    },
    {
        key: 'Custom',
        translateKey: 'views.Settings.Privacy.BlockExplorer.custom',
        value: 'Custom',
        pro: true,
        supportsRescue: true
    }
];

export const SWAP_HOST_KEYS_TESTNET = [
    {
        key: 'ZEUS',
        value: 'https://testnet-swaps.zeuslsp.com/api/v2',
        pro: false,
        supportsRescue: true
    },
    {
        key: 'Boltz',
        value: 'https://api.testnet.boltz.exchange/v2',
        pro: false,
        supportsRescue: true
    },
    {
        key: 'Custom',
        translateKey: 'views.Settings.Privacy.BlockExplorer.custom',
        value: 'Custom',
        pro: true,
        supportsRescue: true
    }
];

export const DEFAULT_SPEEDLOADER = 'https://egs.lnze.us/';

export const SPEEDLOADER_KEYS = [
    {
        key: 'ZEUS',
        value: 'https://egs.lnze.us/'
    },
    {
        key: 'Blixt',
        value: 'https://primer.blixtwallet.com/'
    },
    {
        key: 'Custom',
        translateKey: 'views.Settings.Privacy.BlockExplorer.custom',
        value: 'Custom'
    }
];

export const INTERFACE_KEYS: {
    key: string;
    value: string;
}[] = [
    { key: 'Embedded LND', value: 'embedded-lnd' },
    { key: 'LND (REST)', value: 'lnd' },
    { key: 'LND (Lightning Node Connect)', value: 'lightning-node-connect' },
    { key: 'Core Lightning (CLNRest)', value: 'cln-rest' },
    { key: 'Nostr Wallet Connect', value: 'nostr-wallet-connect' },
    { key: 'LNDHub', value: 'lndhub' }
];

export type Implementations =
    | 'embedded-lnd'
    | 'lnd'
    | 'lightning-node-connect'
    | 'cln-rest'
    | 'lndhub'
    | 'nostr-wallet-connect';

export const EMBEDDED_NODE_NETWORK_KEYS = [
    { key: 'Mainnet', translateKey: 'network.mainnet', value: 'mainnet' },
    { key: 'Testnet', translateKey: 'network.testnet', value: 'testnet' }
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
    { key: 'en', value: 'English' },
    { key: 'es', value: 'Español' },
    { key: 'pt', value: 'Português' },
    { key: 'fr', value: 'Français' },
    { key: 'cs', value: 'Čeština' },
    { key: 'sk', value: 'Slovenčina' },
    { key: 'de', value: 'Deutsch' },
    { key: 'pl', value: 'Polski' },
    { key: 'tr', value: 'Türkçe' },
    { key: 'hu', value: 'magyar nyelv' },
    { key: 'zh', value: '简体中文' },
    { key: 'nl', value: 'Nederlands' },
    { key: 'nb', value: 'Bokmål' },
    { key: 'sv', value: 'Svenska' },
    { key: 'th', value: 'ภาษาไทย' },
    { key: 'uk', value: 'украї́нська мо́ва' },
    { key: 'ro', value: 'Limba română' },
    { key: 'el', value: 'Ελληνικά' },
    { key: 'fa', value: 'زبان فارسي' },
    { key: 'sl', value: 'Slovenski jezik' },
    { key: 'ru', value: 'русский язык' },
    { key: 'fi', value: 'Suomen kieli' },
    { key: 'it', value: 'Italiano' },
    { key: 'vi', value: 'Tiếng Việt' },
    { key: 'jp', value: '日本語' },
    { key: 'he', value: 'עִבְרִית' },
    { key: 'hr', value: 'Hrvatski' },
    { key: 'ko', value: '한국어' },
    { key: 'sw', value: 'Kiswahili' },
    { key: 'hi_IN', value: 'हिन्दी' },
    { key: 'zh_TW', value: '台灣華語' }
];

// this mapping is only for migration and does not need to be updated when new languages are added
export const localeMigrationMapping: { [oldLocale: string]: string } = {
    English: 'en',
    Español: 'es',
    Português: 'pt',
    Français: 'fr',
    Čeština: 'cs',
    Slovenčina: 'sk',
    Deutsch: 'de',
    Polski: 'pl',
    Türkçe: 'tr',
    'magyar nyelv': 'hu',
    简体中文: 'zh',
    Nederlands: 'nl',
    Bokmål: 'nb',
    Svenska: 'sv',
    ภาษาไทย: 'th',
    'украї́нська мо́ва': 'uk',
    'Limba română': 'ro',
    Ελληνικά: 'el',
    'زبان فارسي': 'fa',
    'Slovenski jezik': 'sl',
    'русский язык': 'ru',
    'Suomen kieli': 'fi',
    Italiano: 'it',
    'Tiếng Việt': 'vi',
    日本語: 'jp',
    עִבְרִית: 'he',
    Hrvatski: 'hr'
};

export const CURRENCY_KEYS = [
    {
        key: 'US Dollar',
        value: 'USD',
        flag: '🇺🇸',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Japanese Yen',
        value: 'JPY',
        flag: '🇯🇵',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Chinese Yuan',
        value: 'CNY',
        flag: '🇨🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Singapore Dollar',
        value: 'SGD',
        flag: '🇸🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Hong Kong Dollar',
        value: 'HKD',
        flag: '🇭🇰',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Canadian Dollar',
        value: 'CAD',
        flag: '🇨🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'New Zealand Dollar',
        value: 'NZD',
        flag: '🇳🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Australian Dollar',
        value: 'AUD',
        flag: '🇦🇺',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Chilean Peso',
        value: 'CLP',
        flag: '🇨🇱',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Great British Pound',
        value: 'GBP',
        flag: '🇬🇧',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Danish Krone',
        value: 'DKK',
        flag: '🇩🇰',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Swedish Krona',
        value: 'SEK',
        flag: '🇸🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Icelandic Krona',
        value: 'ISK',
        flag: '🇮🇸',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Swiss Franc',
        value: 'CHF',
        flag: '🇨🇭',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Brazilian Real',
        value: 'BRL',
        flag: '🇧🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Eurozone Euro',
        value: 'EUR',
        flag: '🇪🇺',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Russian Ruble',
        value: 'RUB',
        flag: '🇷🇺',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Polish Złoty',
        value: 'PLN',
        flag: '🇵🇱',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Thai Baht',
        value: 'THB',
        flag: '🇹🇭',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'South Korean Won',
        value: 'KRW',
        flag: '🇰🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'New Taiwan Dollar',
        value: 'TWD',
        flag: '🇹🇼',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Czech Koruna',
        value: 'CZK',
        flag: '🇨🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Hungarian Forint',
        value: 'HUF',
        flag: '🇭🇺',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Indian Rupee',
        value: 'INR',
        flag: '🇮🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Turkish Lira',
        value: 'TRY',
        flag: '🇹🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Nigerian Naira',
        value: 'NGN',
        flag: '🇳🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Argentine Peso',
        value: 'ARS',
        flag: '🇦🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Israeli New Shekel',
        value: 'ILS',
        flag: '🇮🇱',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Lebanese Pound',
        value: 'LBP',
        flag: '🇱🇧',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Malaysian Ringgit',
        value: 'MYR',
        flag: '🇲🇾',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Ukrainian Hryvnia',
        value: 'UAH',
        flag: '🇺🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Jamaican Dollar',
        value: 'JMD',
        flag: '🇯🇲',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Colombian Peso',
        value: 'COP',
        flag: '🇨🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Mexican Peso',
        value: 'MXN',
        flag: '🇲🇽',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Venezuelan Bolivar',
        value: 'VES',
        flag: '🇻🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Tanzanian Shilling',
        value: 'TZS',
        flag: '🇹🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Qatari Riyal',
        value: 'QAR',
        flag: '🇶🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Tunisian Dinar',
        value: 'TND',
        flag: '🇹🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Norwegian Krone',
        value: 'NOK',
        flag: '🇳🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'United Arab Emirates Dirham',
        value: 'AED',
        flag: '🇦🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Trinidad & Tobago Dollar',
        value: 'TTD',
        flag: '🇹🇹',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Philippine Peso',
        value: 'PHP',
        flag: '🇵🇭',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Indonesian Rupiah',
        value: 'IDR',
        flag: '🇮🇩',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Romanian Leu',
        value: 'RON',
        flag: '🇷🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Congolese Franc',
        value: 'CDF',
        flag: '🇨🇩',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Central African CFA franc',
        value: 'XAF',
        flag: '🇨🇲🇨🇫🇹🇩🇨🇬🇬🇶🇬🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'West African CFA franc',
        value: 'XOF',
        flag: '🇧🇯🇧🇫🇨🇮🇬🇼🇲🇱🇳🇪🇸🇳🇹🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Kenyan Shilling',
        value: 'KES',
        flag: '🇰🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Ugandan Shilling',
        value: 'UGX',
        flag: '🇺🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'South African Rand',
        value: 'ZAR',
        flag: '🇿🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Cuban Peso',
        value: 'CUP',
        flag: '🇨🇺',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Dominican Peso',
        value: 'DOP',
        flag: '🇩🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Belize Dollar',
        value: 'BZD',
        flag: '🇧🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Bolivian Boliviano',
        value: 'BOB',
        flag: '🇧🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Costa Rican Colón',
        value: 'CRC',
        flag: '🇨🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Guatemalan Quetzal',
        value: 'GTQ',
        flag: '🇬🇹',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Nicaraguan Córdoba',
        value: 'NIO',
        flag: '🇳🇮',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Paraguayan Guaraní',
        value: 'PYG',
        flag: '🇵🇾',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Uruguayan Peso',
        value: 'UYU',
        flag: '🇺🇾',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Mauritanian Ouguiya',
        value: 'MRU',
        flag: '🇲🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Albanian Lek',
        value: 'ALL',
        flag: '🇦🇱',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Netherlands Antillean Guilder',
        value: 'ANG',
        flag: '🇳🇱',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Angolan Kwanza',
        value: 'AOA',
        flag: '🇦🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Bangladeshi Takka',
        value: 'BDT',
        flag: '🇧🇩',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Bulgarian Lev',
        value: 'BGN',
        flag: '🇧🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Bahraini Dinar',
        value: 'BHD',
        flag: '🇧🇭',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Burundian Franc',
        value: 'BIF',
        flag: '🇧🇮',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Bermudan Dollar',
        value: 'BMD',
        flag: '🇧🇲',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Botswanan Pula',
        value: 'BWP',
        flag: '🇧🇼',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Djiboutian Franc',
        value: 'DJF',
        flag: '🇩🇯',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Algerian Dinar',
        value: 'DZD',
        flag: '🇩🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Egyptian Pound',
        value: 'EGP',
        flag: '🇪🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Ethiopian Birr',
        value: 'ETB',
        flag: '🇪🇹',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Georgian Lari',
        value: 'GEL',
        flag: '🇬🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Ghanaian Cedi',
        value: 'GHS',
        flag: '🇬🇭',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Guinean Franc',
        value: 'GNF',
        flag: '🇬🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Honduran Lempira',
        value: 'HNL',
        flag: '🇭🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Iranian Rial',
        value: 'IRR',
        flag: '🇮🇷',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Jordanian Dinar',
        value: 'JOD',
        flag: '🇯🇴',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Kyrgystani Som',
        value: 'KGS',
        flag: '🇰🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Kazakhstani Tenge',
        value: 'KZT',
        flag: '🇰🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Sri Lankan Rupee',
        value: 'LKR',
        flag: '🇱🇰',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Moroccan Dirham',
        value: 'MAD',
        flag: '🇲🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Malagasy Ariar',
        value: 'MGA',
        flag: '🇲🇬',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Namibian Dollar',
        value: 'NAD',
        flag: '🇳🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Nepalese Rupee',
        value: 'NPR',
        flag: '🇳🇵',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Panamanian Balboa',
        value: 'PAB',
        flag: '🇵🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Peruvian Sol',
        value: 'PEN',
        flag: '🇵🇪',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Pakistani Rupee',
        value: 'PKR',
        flag: '🇵🇰',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Serbian Dinar',
        value: 'RSD',
        flag: '🇷🇸',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Rwandan Franc',
        value: 'RWF',
        flag: '🇷🇼',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Uzbekistani Sum',
        value: 'UZS',
        flag: '🇺🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Vietnamese Dong',
        value: 'VND',
        flag: '🇻🇳',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Zambian Kwacha',
        value: 'ZMW',
        flag: '🇿🇲',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Malawian Kwacha',
        value: 'MWK',
        flag: '🇲🇼',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Lesotho Loti',
        value: 'LSL',
        flag: '🇱🇸',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Swazi Lilangeni',
        value: 'SZL',
        flag: '🇸🇿',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Saudi Riyal',
        value: 'SAR',
        flag: '🇸🇦',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Omani Rial',
        value: 'OMR',
        flag: '🇴🇲',
        supportedSources: ['Zeus', 'Yadio']
    },
    // {
    //     key: 'Kuwaiti Dinar',
    //     value: 'KWD',
    //     flag: '🇰🇼',
    //     supportedSources: ['Zeus', 'Yadio']
    // },
    {
        key: 'Gold',
        value: 'XAU',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Silver',
        value: 'XAG',
        supportedSources: ['Zeus', 'Yadio']
    }
];

export const THEME_KEYS = [
    { key: 'Kyriaki', value: 'kyriaki' },
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
    },
    {
        key: 'Radioactive',
        translateKey: 'views.Settings.Theme.radioactive',
        value: 'radioactive'
    },
    {
        key: 'Spooky',
        translateKey: 'views.Settings.Theme.spooky',
        value: 'orange'
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

export const DEFAULT_VIEW_KEYS_POS = [
    {
        key: 'Products',
        translateKey: 'views.Settings.POS.Products',
        value: 'Products'
    },
    {
        key: 'POS Keypad',
        translateKey: 'views.Settings.POS.Keypad',
        value: 'POS Keypad'
    }
];

export const DEFAULT_INVOICE_TYPE_KEYS = [
    {
        key: 'Unified',
        translateKey: 'general.unified',
        value: DefaultInvoiceType.Unified
    },
    {
        key: 'Lightning',
        translateKey: 'general.lightning',
        value: DefaultInvoiceType.Lightning
    }
];

export const DEFAULT_THEME = 'kyriaki';
export const DEFAULT_FIAT = 'USD';
export const DEFAULT_FIAT_RATES_SOURCE = 'Zeus';
export const DEFAULT_LOCALE = 'English';

export const POS_CONF_PREF_KEYS = [
    { key: '0 conf', translateKey: 'views.Settings.POS.0conf', value: '0conf' },
    { key: '1 conf', translateKey: 'views.Settings.POS.1conf', value: '1conf' },
    {
        key: 'LN only',
        translateKey: 'views.Settings.POS.lnOnly',
        value: 'lnOnly'
    }
];

export const POS_ENABLED_KEYS = [
    {
        key: 'Disabled',
        translateKey: 'general.disabled',
        value: PosEnabled.Disabled
    },
    {
        key: 'Standalone',
        translateKey: 'views.Settings.POS.standalone',
        value: PosEnabled.Standalone
    },
    { key: 'Square', value: PosEnabled.Square }
];

export const LNDHUB_AUTH_MODES = [
    { key: 'BlueWallet', value: 'BlueWallet' },
    { key: 'Alby', value: 'Alby' }
];

export const DEFAULT_LSP_MAINNET = 'https://0conf.lnolymp.us';
export const DEFAULT_LSP_TESTNET = 'https://testnet-0conf.lnolymp.us';

// LSPS1 REST
export const DEFAULT_LSPS1_REST_MAINNET = 'https://lsps1.lnolymp.us';
export const DEFAULT_LSPS1_REST_TESTNET = 'https://testnet-lsps1.lnolymp.us';

export const DEFAULT_LSPS1_PUBKEY_MAINNET =
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581';
export const DEFAULT_LSPS1_PUBKEY_TESTNET =
    '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df';
export const DEFAULT_LSPS1_HOST_MAINNET = '45.79.192.236:9735';
export const DEFAULT_LSPS1_HOST_TESTNET = '139.144.22.237:9735';

// Swaps
export const DEFAULT_SWAP_HOST_MAINNET = 'https://swaps.zeuslsp.com/api/v2';
export const DEFAULT_SWAP_HOST_TESTNET =
    'https://testnet-swaps.zeuslsp.com/api/v2';

export const DEFAULT_NOSTR_RELAYS_2023 = [
    'wss://nostr.mutinywallet.com',
    'wss://relay.damus.io',
    'wss://nostr.lnproxy.org'
];

export const DEFAULT_NOSTR_RELAYS = [
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.getalby.com/v1',
    'wss://relay.damus.io',
    'wss://nostr.land',
    'wss://nostr.wine'
];

export const NOTIFICATIONS_PREF_KEYS = [
    { key: 'Disabled', translateKey: 'general.disabled', value: 0 },
    {
        key: 'Push',
        translateKey:
            'views.Settings.LightningAddressSettings.notifications.push',
        value: 1
    },
    {
        key: 'Nostr',
        value: 2
    }
];

export const AUTOMATIC_ATTESTATION_KEYS = [
    { key: 'Disabled', translateKey: 'general.disabled', value: 0 },
    {
        key: 'Successful only',
        translateKey:
            'views.Settings.LightningAddressSettings.automaticallyAcceptAttestationLevel.successOnly',
        value: 1
    },
    {
        key: 'Successful and not found',
        translateKey:
            'views.Settings.LightningAddressSettings.automaticallyAcceptAttestationLevel.successAndNotFound',
        value: 2
    }
];

export const TIME_PERIOD_KEYS = [
    { key: 'Seconds', translateKey: 'time.seconds', value: 'Seconds' },
    { key: 'Minutes', translateKey: 'time.minutes', value: 'Minutes' },
    { key: 'Hours', translateKey: 'time.hours', value: 'Hours' },
    { key: 'Days', translateKey: 'time.days', value: 'Days' },
    { key: 'Weeks', translateKey: 'time.weeks', value: 'Weeks' }
];

export const DEFAULT_NEUTRINO_PEERS_MAINNET = [
    'btcd1.lnolymp.us',
    'btcd2.lnolymp.us',
    'btcd-mainnet.lightning.computer',
    'node.eldamar.icu',
    'noad.sathoarder.com'
];

export const SECONDARY_NEUTRINO_PEERS_MAINNET = [
    // friends
    [
        'uswest.blixtwallet.com',
        'europe.blixtwallet.com',
        'bb1.breez.technology',
        'bb2.breez.technology'
    ],
    // Asia
    [
        'sg.lnolymp.us',
        'asia.blixtwallet.com',
        // per Expatriotic
        '168.159.213.bc.googleusercontent.com',
        '115.85.88.107',
        '182.229.145.161',
        '18.142.108.45'
    ]
];

export const DEFAULT_NEUTRINO_PEERS_TESTNET = [
    'testnet.lnolymp.us',
    'btcd-testnet.lightning.computer',
    'testnet.blixtwallet.com'
];

export const DEFAULT_SLIDE_TO_PAY_THRESHOLD = 10000;

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
            showAllDecimalPlaces: false,
            removeDecimalSpaces: false,
            showMillisatoshiAmounts: true
        },
        pos: {
            posEnabled: PosEnabled.Disabled,
            squareEnabled: false, // deprecated
            squareAccessToken: '',
            squareLocationId: '',
            merchantName: '',
            confirmationPreference: 'lnOnly',
            disableTips: false,
            squareDevMode: false,
            showKeypad: true,
            taxPercentage: '',
            enablePrinter: false,
            defaultView: 'Products'
        },
        payments: {
            defaultFeeMethod: 'fixed', // deprecated
            defaultFeePercentage: '5.0',
            defaultFeeFixed: '1000',
            timeoutSeconds: '60',
            preferredMempoolRate: 'fastestFee',
            slideToPayThreshold: DEFAULT_SLIDE_TO_PAY_THRESHOLD,
            enableDonations: false,
            defaultDonationPercentage: 5
        },
        invoices: {
            addressType: '0',
            memo: '',
            receiverName: '',
            expiry: '1',
            timePeriod: 'Hours',
            expirySeconds: '3600',
            routeHints: false,
            ampInvoice: false,
            blindedPaths: false,
            showCustomPreimageField: false,
            displayAmountOnInvoice: false, // deprecated
            defaultInvoiceType: DefaultInvoiceType.Lightning
        },
        channels: {
            min_confs: 1,
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false
        },
        supportedBiometryType: undefined,
        isBiometryEnabled: false,
        scramblePin: true,
        loginBackground: false,
        fiatEnabled: false,
        fiat: DEFAULT_FIAT,
        fiatRatesSource: DEFAULT_FIAT_RATES_SOURCE,
        // embedded node
        automaticDisasterRecoveryBackup: true,
        expressGraphSync: false,
        resetExpressGraphSyncOnStartup: false,
        bimodalPathfinding: true,
        graphSyncPromptNeverAsk: false,
        graphSyncPromptIgnoreOnce: false,
        dontAllowOtherPeers: false,
        neutrinoPeersMainnet: DEFAULT_NEUTRINO_PEERS_MAINNET,
        neutrinoPeersTestnet: DEFAULT_NEUTRINO_PEERS_TESTNET,
        zeroConfPeers: [],
        rescan: false,
        compactDb: false,
        recovery: false,
        initialLoad: true,
        embeddedTor: false,
        feeEstimator: DEFAULT_FEE_ESTIMATOR,
        customFeeEstimator: '',
        speedloader: DEFAULT_SPEEDLOADER,
        customSpeedloader: '',
        // LSP
        enableLSP: true,
        lspMainnet: DEFAULT_LSP_MAINNET,
        lspTestnet: DEFAULT_LSP_TESTNET,
        lspAccessKey: '',
        requestSimpleTaproot: true,
        //lsps1
        lsps1RestMainnet: DEFAULT_LSPS1_REST_MAINNET,
        lsps1RestTestnet: DEFAULT_LSPS1_REST_TESTNET,
        lsps1PubkeyMainnet: DEFAULT_LSPS1_PUBKEY_MAINNET,
        lsps1PubkeyTestnet: DEFAULT_LSPS1_PUBKEY_TESTNET,
        lsps1HostMainnet: DEFAULT_LSPS1_HOST_MAINNET,
        lsps1HostTestnet: DEFAULT_LSPS1_HOST_TESTNET,
        lsps1Token: '',
        //swaps
        swaps: {
            hostMainnet: DEFAULT_SWAP_HOST_MAINNET,
            hostTestnet: DEFAULT_SWAP_HOST_TESTNET,
            customHost: '',
            proEnabled: false
        },
        // Lightning Address
        lightningAddress: {
            enabled: false,
            automaticallyAccept: true,
            automaticallyAcceptAttestationLevel: 2,
            automaticallyRequestOlympusChannels: false, // deprecated
            routeHints: false,
            allowComments: true,
            nostrPrivateKey: '',
            nostrRelays: DEFAULT_NOSTR_RELAYS,
            notifications: 0,
            mintUrl: '',
            posEnabled: false // ZEUS Pay+
        },
        bolt12Address: {
            localPart: ''
        },
        ecash: {
            enableCashu: false,
            automaticallySweep: false,
            sweepThresholdSats: 10000
        },
        selectNodeOnStartup: false
    };
    @observable public posStatus: string = 'unselected';
    @observable public posWasEnabled: boolean = false;
    @observable public loading = false;
    @observable public isMigrating = false;
    @observable public settingsUpdateInProgress: boolean = false;
    @observable btcPayError: string | null;
    @observable sponsorsError: string | null;
    @observable olympians: Array<any> = [];
    @observable gods: Array<any> = [];
    @observable mortals: Array<any> = [];
    @observable host: string;
    @observable port: string;
    @observable url: string;
    @observable macaroonHex: string;
    @observable rune: string;
    @observable accessKey: string;
    @observable implementation: Implementations;
    @observable certVerification: boolean | undefined;
    @observable public loggedIn = false;
    @observable public triggerSettingsRefresh: boolean = false;
    @observable public connecting = true;
    @observable public fetchLock = false;
    @observable public lurkerExposed = false;
    private lurkerTimeout: ReturnType<typeof setTimeout> | null = null;
    // LNDHub
    @observable username: string;
    @observable password: string;
    @observable lndhubUrl: string;
    @observable dismissCustodialWarning: boolean = false;
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
    @observable public lndDir?: string;
    @observable public isSqlite?: boolean;
    @observable public initialStart: boolean = true;
    @observable public embeddedLndStarted: boolean = false;
    @observable public lndFolderMissing: boolean = false;
    // NWC
    @observable public nostrWalletConnectUrl: string;

    public setInitialStart = (status: boolean) => {
        this.initialStart = status;
    };

    public setLndFolderMissing = (status: boolean) => {
        this.lndFolderMissing = status;
    };

    public fetchBTCPayConfig = (data: string) => {
        const configRoute = data.split('config=')[1];
        this.btcPayError = null;

        if (configRoute.includes('.onion')) {
            return doTorRequest(configRoute, RequestMethod.GET)
                .then((response: any) => this.parseBTCPayConfig(response))
                .catch((err: any) => {
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
                    this.btcPayError = `${localeString(
                        'stores.SettingsStore.btcPayFetchConfigError'
                    )}: ${err.toString()}`;
                });
        }
    };

    @action
    public fetchSponsors = () => {
        const olympiansRoute = 'https://zeusln.com/api/sponsors/v2/getSponsors';
        this.sponsorsError = null;
        this.olympians = [];
        this.gods = [];
        this.mortals = [];
        this.loading = true;

        if (this.enableTor) {
            return doTorRequest(olympiansRoute, RequestMethod.GET)
                .then((response: any) => {
                    runInAction(() => {
                        this.olympians = response.olympians;
                        this.gods = response.gods;
                        this.mortals = response.mortals;
                        this.loading = false;
                    });
                })
                .catch((err: any) => {
                    runInAction(() => {
                        this.olympians = [];
                        this.gods = [];
                        this.mortals = [];
                        this.loading = false;
                        this.sponsorsError = `${localeString(
                            'stores.SettingsStore.olympianFetchError'
                        )}: ${err.toString()}`;
                    });
                });
        } else {
            return ReactNativeBlobUtil.fetch('get', olympiansRoute)
                .then((response: any) => {
                    const status = response.info().status;
                    runInAction(() => {
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
                    });
                })
                .catch((err: any) => {
                    runInAction(() => {
                        this.olympians = [];
                        this.gods = [];
                        this.mortals = [];
                        this.loading = false;
                        this.sponsorsError = `${localeString(
                            'stores.SettingsStore.olympianFetchError'
                        )}: ${err.toString()}`;
                    });
                });
        }
    };

    private parseBTCPayConfig(data: any) {
        const configuration = data.configurations[0];
        const { adminMacaroon, macaroon, type, uri } = configuration;

        if (type !== 'lnd-rest') {
            this.btcPayError = localeString(
                'stores.SettingsStore.btcPayImplementationSupport'
            );
        } else {
            const config = {
                host: uri,
                macaroonHex: adminMacaroon || macaroon,
                implementation: 'lnd'
            };

            return config;
        }
    }

    public hasCredentials() {
        return this.macaroonHex || this.accessKey ? true : false;
    }

    @action
    private updateNodeProperties = (settings: Settings) => {
        const node: any =
            settings?.nodes?.length &&
            settings?.nodes[settings.selectedNode || 0];
        if (node) {
            this.host = node.host;
            this.port = node.port;
            this.url = node.url;
            this.username = node.username;
            this.password = node.password;
            this.lndhubUrl = node.lndhubUrl;
            this.macaroonHex = node.macaroonHex;
            this.rune = node.rune;
            this.accessKey = node.accessKey;
            this.dismissCustodialWarning = node.dismissCustodialWarning;
            this.implementation = node.implementation || 'lnd';
            this.certVerification = node.certVerification || false;
            this.enableTor = node.enableTor;
            // LNC
            this.pairingPhrase = node.pairingPhrase;
            this.mailboxServer = node.mailboxServer;
            this.customMailboxServer = node.customMailboxServer;
            // Embedded lnd
            this.seedPhrase = node.seedPhrase;
            this.walletPassword = node.walletPassword;
            this.adminMacaroon = node.adminMacaroon;
            this.embeddedLndNetwork = node.embeddedLndNetwork;
            this.lndDir = node.lndDir || 'lnd';
            this.isSqlite = node.isSqlite;
            // NWC
            this.nostrWalletConnectUrl = node.nostrWalletConnectUrl;
        }
    };

    public getSettings = async (silentUpdate: boolean = false) => {
        if (!silentUpdate) this.loading = true;
        try {
            await MigrationsUtils.keychainCloudSyncMigration();

            const modernSettings: any = await Storage.getItem(STORAGE_KEY);

            if (modernSettings) {
                console.log('attempting to load modern settings');
                this.settings = JSON.parse(modernSettings);
            } else {
                console.log('attempting to load legacy settings');

                // Retrieve the settings
                const settings = await EncryptedStorage.getItem(
                    LEGACY_STORAGE_KEY
                );
                if (settings) {
                    const newSettings =
                        await MigrationsUtils.legacySettingsMigrations(
                            settings
                        );

                    if (!isEqual(this.settings, newSettings)) {
                        this.settings = newSettings;
                    }

                    await MigrationsUtils.storageMigrationV2(newSettings);
                } else {
                    console.log('No legacy settings stored');
                }
            }

            this.updateNodeProperties(this.settings);
        } catch (error) {
            console.error('Could not load settings', error);
        } finally {
            this.isMigrating = false;
            if (!silentUpdate) this.loading = false;
        }

        return this.settings;
    };

    public async setSettings(settings: any) {
        this.loading = true;
        await Storage.setItem(STORAGE_KEY, settings);
        this.settings = settings;
        this.loading = false;
        return settings;
    }

    public updateSettings = async (newSetting: any) => {
        this.settingsUpdateInProgress = true;
        const existingSettings = await this.getSettings();
        const newSettings = {
            ...existingSettings,
            ...newSetting
        };

        if (
            newSetting.pos?.posEnabled &&
            newSetting.pos.posEnabled !== PosEnabled.Disabled
        ) {
            this.posWasEnabled = true;
        }

        await this.setSettings(newSettings);
        this.triggerSettingsRefresh = true;

        // Update store's node properties from latest settings
        this.updateNodeProperties(newSettings);
        this.settingsUpdateInProgress = false;
        return newSettings;
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
                    runInAction(() => {
                        this.loading = false;
                        if (response.error) {
                            this.createAccountError =
                                response.message ||
                                localeString(
                                    'stores.SettingsStore.lndhubError'
                                );
                        } else {
                            this.createAccountSuccess = localeString(
                                'stores.SettingsStore.lndhubSuccess'
                            );
                        }
                    });
                    return response;
                })
                .catch((err: any) => {
                    const errorString = err.error || err.toString();
                    runInAction(() => {
                        this.loading = false;
                        this.createAccountError = `${localeString(
                            'stores.SettingsStore.lndhubError'
                        )}: ${errorString}`;
                    });
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
                        runInAction(() => {
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
                        });

                        return data;
                    } else {
                        runInAction(() => {
                            this.loading = false;
                            this.createAccountError = localeString(
                                'stores.SettingsStore.lndhubError'
                            );
                        });
                    }
                })
                .catch((err: any) => {
                    const errorString = err.error || err.toString();
                    runInAction(() => {
                        this.loading = false;
                        this.createAccountError = `${localeString(
                            'stores.SettingsStore.lndhubError'
                        )}: ${errorString}`;
                    });
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
                    runInAction(() => {
                        this.loading = false;
                        this.accessToken = data.access_token;
                        this.refreshToken = data.refresh_token;
                    });
                    resolve(data);
                })
                .catch((error: any) => {
                    runInAction(() => {
                        this.loading = false;
                        this.error = true;
                        if (
                            typeof error.message === 'string' &&
                            error.message.includes('"bad auth"')
                        ) {
                            this.errorMsg = localeString(
                                'stores.SettingsStore.lndhubLoginError'
                            );
                        } else {
                            this.errorMsg = localeString(
                                'stores.SettingsStore.lndhubConnectError'
                            );
                        }
                    });
                    resolve();
                });
        });
    };

    // LNC
    public connect = async () => {
        this.loading = true;

        await BackendUtils.initLNC();

        const error = await BackendUtils.connect();
        if (error) {
            runInAction(() => {
                this.error = true;
                this.errorMsg = error;
            });
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
                    runInAction(() => {
                        this.error = true;
                        this.errorMsg = localeString(
                            'stores.SettingsStore.lncConnectError'
                        );
                        this.loading = false;
                    });
                    resolve(this.errorMsg);
                }
            }, 500);
        });
    };

    // NWC
    @action
    public connectNWC = async () => {
        this.loading = true;

        await BackendUtils.initNWC();

        const error = await BackendUtils.connect();
        if (error) {
            this.error = true;
            this.errorMsg = error;
            return error;
        }

        this.loading = false;
    };

    public loginRequired = () => this.loginMethodConfigured() && !this.loggedIn;

    public loginMethodConfigured = () =>
        this.settings &&
        (this.settings.passphrase ||
            this.settings.pin ||
            this.isBiometryConfigured());

    public checkBiometricsStatus = async () => {
        const biometryType = await getSupportedBiometryType();
        if (this.settings.supportedBiometryType !== biometryType) {
            await this.updateSettings({
                supportedBiometryType: biometryType
            });
        }
        return {
            supportedBiometryType: biometryType,
            isBiometryEnabled: this.settings.isBiometryEnabled
        };
    };

    public isBiometryConfigured = () =>
        this.settings != null &&
        this.settings.isBiometryEnabled &&
        this.settings.supportedBiometryType !== undefined;

    public setLoginStatus = (status = false) => (this.loggedIn = status);

    @action
    public setConnectingStatus = (status = false) => {
        // reset error on reconnect
        if (status) {
            this.error = false;
            this.errorMsg = '';
            this.lndFolderMissing = false;
            BackendUtils.clearCachedCalls();
            // remove fetchLock on reconnect
            this.fetchLock = false;
        }
        this.connecting = status;
        return this.connecting;
    };

    @action
    public toggleLurker = () => {
        if (this.lurkerTimeout) {
            clearTimeout(this.lurkerTimeout);
        }

        this.lurkerExposed = true;
        this.settings.privacy.lurkerMode = false;

        this.lurkerTimeout = setTimeout(() => {
            this.lurkerExposed = false;
            this.settings.privacy.lurkerMode = true;
            this.lurkerTimeout = null;
        }, 3000);
    };

    public setPosStatus = (setting: string) => {
        this.posStatus = setting;
        return this.posStatus;
    };
}
