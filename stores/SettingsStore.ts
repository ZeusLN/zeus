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
    fiat?: string;
    locale?: string;
    privacy: PrivacySettings;
    display: DisplaySettings;
    pos: PosSettings;
    payments: PaymentsSettings;
    invoices: InvoicesSettings;
    isBiometryEnabled: boolean;
    supportedBiometryType?: BiometryType;
    lndHubLnAuthMode?: string;
}

export const BLOCK_EXPLORER_KEYS = [
    { key: 'mempool.space', value: 'mempool.space' },
    { key: 'blockstream.info', value: 'blockstream.info' },
    { key: 'Custom', value: 'Custom' }
];

export const INTERFACE_KEYS = [
    { key: 'LND (REST)', value: 'lnd' },
    { key: 'LND (Lightning Node Connect)', value: 'lightning-node-connect' },
    { key: 'Core Lightning (c-lightning-REST)', value: 'c-lightning-REST' },
    { key: 'Core Lightning (Sparko)', value: 'spark' },
    { key: 'Eclair', value: 'eclair' },
    { key: 'LNDHub', value: 'lndhub' }
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
    { key: 'Disabled', value: 'Disabled' },
    { key: '🇺🇸 US Dollar (USD)', value: 'USD' },
    { key: '🇯🇵 Japanese Yen (JPY)', value: 'JPY' },
    { key: '🇨🇳 Chinese Yuan (CNY)', value: 'CNY' },
    { key: '🇸🇬 Singapore Dollar (SGD)', value: 'SGD' },
    { key: '🇭🇰 Hong Kong Dollar (HKD)', value: 'HKD' },
    { key: '🇨🇦 Canadian Dollar (CAD)', value: 'CAD' },
    { key: '🇳🇿 New Zealand Dollar (NZD)', value: 'NZD' },
    { key: '🇦🇺 Australian Dollar (AUD)', value: 'AUD' },
    { key: '🇨🇱 Chilean Peso (CLP)', value: 'CLP' },
    { key: '🇬🇧 Great British Pound (GBP)', value: 'GBP' },
    { key: '🇩🇰 Danish Krone (DKK)', value: 'DKK' },
    { key: '🇸🇪 Swedish Krona (SEK)', value: 'SEK' },
    { key: '🇮🇸 Icelandic Krona (ISK)', value: 'ISK' },
    { key: '🇨🇭 Swiss Franc (CHF)', value: 'CHF' },
    { key: '🇧🇷 Brazilian Real (BRL)', value: 'BRL' },
    { key: '🇪🇺 Eurozone Euro (EUR)', value: 'EUR' },
    { key: '🇷🇺 Russian Ruble (RUB)', value: 'RUB' },
    { key: '🇵🇱 Polish Złoty (PLN)', value: 'PLN' },
    { key: '🇹🇭 Thai Baht (THB)', value: 'THB' },
    { key: '🇰🇷 South Korean Won (KRW)', value: 'KRW' },
    { key: '🇹🇼 New Taiwan Dollar (TWD)', value: 'TWD' },
    { key: '🇨🇿 Czech Koruna (CZK)', value: 'CZK' },
    { key: '🇭🇺 Hungarian Forint (HUF)', value: 'HUF' },
    { key: '🇮🇳 Indian Rupee (INR)', value: 'INR' },
    { key: '🇹🇷 Turkish Lira (TRY)', value: 'TRY' },
    { key: '🇳🇬 Nigerian Naira (NGN)', value: 'NGN' },
    { key: '🇦🇷 Argentine Peso (ARS)', value: 'ARS' },
    { key: '🇮🇱 Israeli New Shekel (ILS)', value: 'ILS' },
    { key: '🇱🇧 Lebanese Pound (LBP)', value: 'LBP' },
    { key: '🇲🇾 Malaysian Ringgit (MYR)', value: 'MYR' },
    { key: '🇺🇦 Ukrainian Hryvnia (UAH)', value: 'UAH' },
    { key: '🇯🇲 Jamaican Dollar (JMD)', value: 'JMD' },
    { key: '🇨🇴 Colombian Peso (COP)', value: 'COP' },
    { key: '🇲🇽 Mexican Peso (MXN)', value: 'MXN' },
    { key: '🇻🇪 Venezuelan Bolivar (VES)', value: 'VES' },
    { key: '🇹🇿 Tanzanian Shilling (TZS)', value: 'TZS' },
    { key: '🇶🇦 Qatari Riyal (QAR)', value: 'QAR' },
    { key: '🇹🇳 Tunisian Dinar (TND)', value: 'TND' },
    { key: '🇳🇴 Norwegian Krone (NOK)', value: 'NOK' },
    { key: '🇦🇪 United Arab Emirates Dirham (AED)', value: 'AED' },
    { key: '🇹🇹 Trinidad & Tobago Dollar (TTD)', value: 'TTD' },
    { key: '🇵🇭 Philippine Peso (PHP)', value: 'PHP' },
    { key: '🇮🇩 Indonesian Rupiah (IDR)', value: 'IDR' },
    { key: '🇷🇴 Romanian Leu (RON)', value: 'RON' },
    { key: '🇨🇩 Congolese Franc (CDF)', value: 'CDF' },
    { key: '🇨🇲🇨🇫🇹🇩🇨🇬🇬🇶🇬🇦 Central African CFA franc (XAF)', value: 'XAF' },
    { key: '🇰🇪 Kenyan Shilling (KES)', value: 'KES' },
    { key: '🇺🇬 Ugandan Shilling (UGX)', value: 'UGX' },
    { key: '🇿🇦 South African Rand (ZAR)', value: 'ZAR' },
    { key: '🇨🇺 Cuban Peso (CUP)', value: 'CUP' },
    { key: '🇩🇴 Dominican Peso (DOP)', value: 'DOP' },
    { key: '🇧🇿 Belize Dollar (BZD)', value: 'BZD' }
];

export const THEME_KEYS = [
    { key: 'Dark', value: 'dark' },
    { key: 'Light', value: 'light' },
    { key: 'Junkie', value: 'junkie' },
    { key: 'BPM', value: 'bpm' },
    { key: 'Orange', value: 'orange' },
    { key: 'Blacked Out', value: 'blacked-out' },
    { key: 'Scarlet', value: 'scarlet' },
    { key: 'Memberberry', value: 'purple' },
    { key: 'Blueberry', value: 'blueberry' },
    { key: 'Deep Purple', value: 'deep-purple' },
    { key: 'Deadpool', value: 'deadpool' },
    { key: 'Mighty', value: 'mighty' },
    { key: 'Green', value: 'green' },
    { key: 'Pub', value: 'pub' },
    { key: 'Popsicle', value: 'popsicle' },
    { key: 'Nostrich', value: 'nostrich' },
    { key: 'Desert', value: 'desert' },
    { key: 'Orange Cream Soda', value: 'orange-cream-soda' },
    { key: 'Mint', value: 'mint' },
    { key: 'Red Metallic', value: 'red-metallic' }
];

export const DEFAULT_VIEW_KEYS = [
    { key: 'Balance', value: 'Balance' },
    { key: 'Keypad', value: 'Keypad' }
];

export const DEFAULT_THEME = 'dark';
export const DEFAULT_FIAT = 'Disabled';
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
            bigKeypadButtons: false
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
            addressType: '1',
            memo: '',
            expiry: '3600',
            routeHints: false,
            ampInvoice: false
        },
        supportedBiometryType: undefined,
        isBiometryEnabled: false,
        scramblePin: true,
        loginBackground: false,
        fiat: DEFAULT_FIAT
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
            // Retrieve the credentials
            const credentials: any = await EncryptedStorage.getItem(
                STORAGE_KEY
            );
            if (credentials) {
                this.settings = JSON.parse(credentials);

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
                }
            } else {
                console.log('No credentials stored');
            }
        } catch (error) {
            console.log("Keychain couldn't be accessed!", error);
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
