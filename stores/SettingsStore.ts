import { action, observable } from 'mobx';
import { BiometryType } from 'react-native-biometrics';
import ReactNativeBlobUtil from 'react-native-blob-util';
import EncryptedStorage from 'react-native-encrypted-storage';
import isEqual from 'lodash/isEqual';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import { getSupportedBiometryType } from '../utils/BiometricUtils';

// lndhub
import LoginRequest from './../models/LoginRequest';

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
}

interface InvoicesSettings {
    addressType?: string;
    memo?: string;
    expiry?: string;
    timePeriod?: string;
    expirySeconds?: string;
    routeHints?: boolean;
    ampInvoice?: boolean;
    blindedPaths: boolean;
    showCustomPreimageField?: boolean;
    displayAmountOnInvoice?: boolean;
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
}

interface Bolt12AddressSettings {
    localPart: string;
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
    lsps1ShowPurchaseButton: boolean;
    // Lightning Address
    lightningAddress: LightningAddressSettings;
    bolt12Address: Bolt12AddressSettings;
    selectNodeOnStartup: boolean;
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
    { key: 'LNDHub', value: 'lndhub' },
    {
        key: '[DEPRECATED] Core Lightning (c-lightning-REST)',
        value: 'c-lightning-REST'
    },
    { key: '[DEPRECATED] Core Lightning (Sparko)', value: 'spark' },
    { key: '[DEPRECATED] Eclair', value: 'eclair' }
];

export type Implementations =
    | 'embedded-lnd'
    | 'lnd'
    | 'lightning-node-connect'
    | 'cln-rest'
    | 'lndhub'
    | 'c-lightning-REST'
    | 'spark'
    | 'eclair';

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
    { key: 'zh', value: '简化字' },
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
    { key: 'sw', value: 'Kiswahili' }
];

// this mapping is only for migration and does not need to be updated when new languages are added
const localeMigrationMapping: { [oldLocale: string]: string } = {
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
    简化字: 'zh',
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
    },
    {
        key: '🇲🇷 Mauritanian Ouguiya (MRU)',
        value: 'MRU',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇦🇱 Albanian Lek (ALL)',
        value: 'ALL',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇱 Netherlands Antillean Guilder (ANG)',
        value: 'ANG',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇦🇴 Angolan Kwanza (AOA)',
        value: 'AOA',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇩 Bangladeshi Takka (BDT)',
        value: 'BDT',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇬 Bulgarian Lev (BGN)',
        value: 'BGN',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇭 Bahraini Dinar (BHD)',
        value: 'BHD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇮 Burundian Franc (BIF)',
        value: 'BIF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇲 Bermudan Dollar (BMD)',
        value: 'BMD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇧🇼 Botswanan Pula (BWP)',
        value: 'BWP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇩🇯 Djiboutian Franc (DJF)',
        value: 'DJF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇩🇿 Algerian Dinar (DZD)',
        value: 'DZD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇪🇬 Egyptian Pound (EGP)',
        value: 'EGP',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇪🇹 Ethiopian Birr (ETB)',
        value: 'ETB',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇬🇪 Georgian Lari (GEL)',
        value: 'GEL',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇬🇭 Ghanaian Cedi (GHS)',
        value: 'GHS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇬🇳 Guinean Franc (GNF)',
        value: 'GNF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇭🇳 Honduran Lempira (HNL)',
        value: 'HNL',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇮🇷 Iranian Rial (IRR)',
        value: 'IRR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇯🇴 Jordanian Dinar (JOD)',
        value: 'JOD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇰🇬 Kyrgystani Som (KGS)',
        value: 'KGS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇰🇿 Kazakhstani Tenge (KZT)',
        value: 'KZT',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇱🇰 Sri Lankan Rupee (LKR)',
        value: 'LKR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇲🇦 Moroccan Dirham (MAD)',
        value: 'MAD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇲🇬 Malagasy Ariar (MGA)',
        value: 'MGA',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇦 Namibian Dollar (NAD)',
        value: 'NAD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇳🇵 Nepalese Rupee (NPR)',
        value: 'NPR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇦 Panamanian Balboa (PAB)',
        value: 'PAB',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇪 Peruvian Sol (PEN)',
        value: 'PEN',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇵🇰 Pakistani Rupee (PKR)',
        value: 'PKR',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇷🇸 Serbian Dinar (RSD)',
        value: 'RSD',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇷🇼 Rwandan Franc (RWF)',
        value: 'RWF',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇺🇿 Uzbekistan Sum (UZS)',
        value: 'UZS',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: '🇻🇳 Vietnamese Dong (VND)',
        value: 'VND',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Gold (XAU)',
        value: 'XAU',
        supportedSources: ['Zeus', 'Yadio']
    },
    {
        key: 'Silver (XAG)',
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
        translateKey: 'views.Settings.disabled',
        value: PosEnabled.Disabled
    },
    {
        key: 'Standalone',
        tanslateKey: 'views.Settings.POS.standalone',
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

export const DEFAULT_NOSTR_RELAYS_2023 = [
    'wss://nostr.mutinywallet.com',
    'wss://relay.damus.io',
    'wss://nostr.lnproxy.org'
];

export const DEFAULT_NOSTR_RELAYS = [
    'wss://relay.damus.io',
    'wss://nostr.land',
    'wss://nostr.wine',
    'wss://nos.lol',
    'wss://relay.snort.social'
];

export const NOTIFICATIONS_PREF_KEYS = [
    { key: 'Disabled', translateKey: 'views.Settings.disabled', value: 0 },
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
    { key: 'Disabled', translateKey: 'views.Settings.disabled', value: 0 },
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

const STORAGE_KEY = 'zeus-settings';

const DEFAULT_SLIDE_TO_PAY_THRESHOLD = 10000;

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
            taxPercentage: '0',
            enablePrinter: false,
            defaultView: 'Products'
        },
        payments: {
            defaultFeeMethod: 'fixed', // deprecated
            defaultFeePercentage: '5.0',
            defaultFeeFixed: '1000',
            timeoutSeconds: '60',
            preferredMempoolRate: 'fastestFee',
            slideToPayThreshold: DEFAULT_SLIDE_TO_PAY_THRESHOLD
        },
        invoices: {
            addressType: '0',
            memo: '',
            expiry: '3600',
            timePeriod: 'Seconds',
            expirySeconds: '3600',
            routeHints: false,
            ampInvoice: false,
            blindedPaths: false,
            showCustomPreimageField: false,
            displayAmountOnInvoice: false
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
        expressGraphSync: true,
        resetExpressGraphSyncOnStartup: false,
        bimodalPathfinding: true,
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
        lsps1ShowPurchaseButton: true,
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
            notifications: 0
        },
        bolt12Address: {
            localPart: ''
        },
        selectNodeOnStartup: false
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
    @observable rune: string;
    @observable accessKey: string;
    @observable implementation: Implementations;
    @observable certVerification: boolean | undefined;
    @observable public loggedIn = false;
    @observable public connecting = true;
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
    @observable public initialStart: boolean = true;

    @action
    public setInitialStart = (status: boolean) => {
        this.initialStart = status;
    };

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
        const olympiansRoute = 'https://zeusln.com/api/sponsors/v2/getSponsors';
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
    public async getSettings(silentUpdate: boolean = false) {
        if (!silentUpdate) this.loading = true;
        try {
            // Retrieve the settings
            const settings = await EncryptedStorage.getItem(STORAGE_KEY);
            if (settings) {
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
                    newSettings.locale =
                        localeMigrationMapping[newSettings.locale];
                }

                const MOD_KEY = 'lsp-taproot-mod';
                const mod = await EncryptedStorage.getItem(MOD_KEY);
                if (!mod) {
                    newSettings.requestSimpleTaproot = true;
                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY, 'true');
                }

                const MOD_KEY2 = 'lsp-preview-mod';
                const mod2 = await EncryptedStorage.getItem(MOD_KEY2);
                if (!mod2) {
                    if (
                        newSettings?.lspMainnet ===
                        'https://lsp-preview.lnolymp.us'
                    ) {
                        newSettings.lspMainnet = DEFAULT_LSP_MAINNET;
                    }
                    if (
                        newSettings?.lspTestnet ===
                        'https://testnet-lsp.lnolymp.us'
                    ) {
                        newSettings.lspTestnet = DEFAULT_LSP_TESTNET;
                    }
                    this.setSettings(JSON.stringify(newSettings));
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
                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY3, 'true');
                }

                const MOD_KEY4 = 'lsps1-hosts1';
                const mod4 = await EncryptedStorage.getItem(MOD_KEY4);
                if (!mod4) {
                    if (!newSettings?.lsps1HostMainnet) {
                        newSettings.lsps1HostMainnet =
                            DEFAULT_LSPS1_HOST_MAINNET;
                    }
                    if (!newSettings?.lsps1HostTestnet) {
                        newSettings.lsps1HostTestnet =
                            DEFAULT_LSPS1_HOST_TESTNET;
                    }
                    if (!newSettings?.lsps1PubkeyMainnet) {
                        newSettings.lsps1PubkeyMainnet =
                            DEFAULT_LSPS1_PUBKEY_MAINNET;
                    }
                    if (!newSettings?.lsps1PubkeyTestnet) {
                        newSettings.lsps1PubkeyTestnet =
                            DEFAULT_LSPS1_PUBKEY_TESTNET;
                    }
                    if (!newSettings?.lsps1RestMainnet) {
                        newSettings.lsps1RestMainnet =
                            DEFAULT_LSPS1_REST_MAINNET;
                    }
                    if (!newSettings?.lsps1RestTestnet) {
                        newSettings.lsps1RestTestnet =
                            DEFAULT_LSPS1_REST_TESTNET;
                    }

                    if (!newSettings?.lsps1Token) {
                        newSettings.lsps1Token = '';
                    }

                    if (!newSettings?.lsps1ShowPurchaseButton) {
                        newSettings.lsps1ShowPurchaseButton = true;
                    }

                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY4, 'true');
                }

                const MOD_KEY5 = 'millisat_amounts';
                const mod5 = await EncryptedStorage.getItem(MOD_KEY5);
                if (!mod5) {
                    if (!newSettings?.display.showMillisatoshiAmounts) {
                        newSettings.display.showMillisatoshiAmounts = true;
                    }

                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY5, 'true');
                }

                const MOD_KEY6 = 'egs-host';
                const mod6 = await EncryptedStorage.getItem(MOD_KEY6);
                if (!mod6) {
                    if (!newSettings?.speedloader) {
                        newSettings.speedloader = DEFAULT_SPEEDLOADER;
                        newSettings.customSpeedloader = '';
                    }

                    this.setSettings(JSON.stringify(newSettings));
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

                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY7, 'true');
                }

                const MOD_KEY8 = 'nostr-relays-2024';
                const mod8 = await EncryptedStorage.getItem(MOD_KEY8);
                if (!mod8) {
                    if (
                        JSON.stringify(
                            newSettings?.lightningAddress?.nostrRelays
                        ) === JSON.stringify(DEFAULT_NOSTR_RELAYS_2023)
                    ) {
                        newSettings.lightningAddress.nostrRelays =
                            DEFAULT_NOSTR_RELAYS;
                    }

                    this.setSettings(JSON.stringify(newSettings));
                    await EncryptedStorage.setItem(MOD_KEY8, 'true');
                }

                // migrate old POS squareEnabled setting to posEnabled
                if (newSettings?.pos?.squareEnabled) {
                    newSettings.pos.posEnabled = PosEnabled.Square;
                    newSettings.pos.squareEnabled = false;
                }

                if (!newSettings.neutrinoPeersMainnet) {
                    newSettings.neutrinoPeersMainnet =
                        DEFAULT_NEUTRINO_PEERS_MAINNET;
                }
                if (!newSettings.neutrinoPeersTestnet) {
                    newSettings.neutrinoPeersTestnet =
                        DEFAULT_NEUTRINO_PEERS_TESTNET;
                }

                if (newSettings.payments == null) {
                    newSettings.payments = {
                        slideToPayThreshold: DEFAULT_SLIDE_TO_PAY_THRESHOLD
                    };
                } else if (newSettings.payments.slideToPayThreshold == null) {
                    newSettings.payments.slideToPayThreshold =
                        DEFAULT_SLIDE_TO_PAY_THRESHOLD;
                }

                if (!isEqual(this.settings, newSettings)) {
                    this.settings = newSettings;
                }

                const node: any =
                    newSettings.nodes?.length &&
                    newSettings.nodes[newSettings.selectedNode || 0];
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
            if (!silentUpdate) this.loading = false;
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
        // ensure we get the enhanced settings set
        const settings = await this.getSettings(true);
        return settings;
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
                .catch((error: any) => {
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

    public checkBiometricsStatus = async () => {
        const biometryType = await getSupportedBiometryType();
        if (this.settings.supportedBiometryType !== biometryType) {
            this.updateSettings({
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

    @action
    public setPosStatus = (setting: string) => {
        this.posStatus = setting;
        return this.posStatus;
    };
}
