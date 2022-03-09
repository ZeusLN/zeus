import RNSecureKeyStore, { ACCESSIBLE } from 'react-native-secure-key-store';
import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';

import RESTUtils from '../utils/RESTUtils';
import { doTorRequest, RequestMethod } from '../utils/TorUtils';
import { localeString } from '../utils/LocaleUtils';

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
}

interface PrivacySettings {
    defaultBlockExplorer?: string;
    customBlockExplorer?: string;
    clipboard?: boolean;
    lurkerMode?: boolean;
    enableMempoolRates?: boolean;
}

interface Settings {
    nodes?: Array<Node>;
    theme?: string;
    selectedNode?: number;
    passphrase?: string;
    duressPassphrase?: string;
    pin?: string;
    duressPin?: string;
    authenticationAttempts?: number;
    fiat?: string;
    locale?: string;
    privacy: PrivacySettings;
}

export const BLOCK_EXPLORER_KEYS = [
    { key: 'mempool.space', value: 'mempool.space' },
    { key: 'blockstream.info', value: 'blockstream.info' },
    { key: 'Custom', value: 'Custom' }
];

export const INTERFACE_KEYS = [
    { key: 'LND', value: 'lnd' },
    { key: 'c-lightning-REST', value: 'c-lightning-REST' },
    { key: 'Spark (c-lightning)', value: 'spark' },
    { key: 'Eclair', value: 'eclair' },
    { key: 'LNDHub', value: 'lndhub' }
];

export const LOCALE_KEYS = [
    { key: 'English', value: 'English' },
    { key: 'Español', value: 'Español' },
    { key: 'Português', value: 'Português' },
    { key: 'Français', value: 'Français' },
    { key: 'Češka', value: 'Češka' },
    { key: 'Slovák', value: 'Slovák' },
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
    { key: '日本語', value: '日本語' }
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
    { key: '🇮🇱 Israeli New Shekel (ILS)', value: 'ILS' }
];

export const THEME_KEYS = [
    { key: 'Dark', value: 'dark' },
    { key: 'Light', value: 'light' },
    { key: 'Junkie', value: 'junkie' },
    { key: 'BPM', value: 'bpm' },
    { key: 'Orange', value: 'orange' }
];

export const DEFAULT_THEME = 'dark';
export const DEFAULT_FIAT = 'Disabled';
export const DEFAULT_LOCALE = 'English';
export default class SettingsStore {
    @observable settings: Settings = {
        privacy: {
            defaultBlockExplorer: 'mempool.space',
            customBlockExplorer: '',
            clipboard: false,
            lurkerMode: false,
            enableMempoolRates: false
        }
    };
    @observable public loading = false;
    @observable btcPayError: string | null;
    @observable host: string;
    @observable port: string;
    @observable url: string;
    @observable macaroonHex: string;
    @observable accessKey: string;
    @observable implementation: string;
    @observable certVerification: boolean | undefined;
    @observable public loggedIn = false;
    @observable public connecting = true;
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
            return RNFetchBlob.fetch('get', configRoute)
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
            const credentials: any = await RNSecureKeyStore.get(
                'zeus-settings'
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
                }
                return this.settings;
            } else {
                console.log('No credentials stored');
            }
        } catch (error) {
            console.log("Keychain couldn't be accessed!", error);
        } finally {
            this.loading = false;
        }
    }

    @action
    public async setSettings(settings: string) {
        this.loading = true;

        // Store the credentials
        await RNSecureKeyStore.set('zeus-settings', settings, {
            accessible: ACCESSIBLE.WHEN_UNLOCKED
        }).then(() => {
            this.loading = false;
            return settings;
        });
    }

    // LNDHub
    @action
    public createAccount = (
        host: string,
        certVerification: boolean,
        enableTor?: boolean
    ) => {
        this.createAccountSuccess = '';
        this.createAccountError = '';
        this.loading = true;
        return RESTUtils.createAccount(host, certVerification, enableTor)
            .then((data: any) => {
                this.loading = false;
                this.createAccountSuccess = localeString(
                    'stores.SettingsStore.lndhubSuccess'
                );
                return data;
            })
            .catch(() => {
                // handle error
                this.loading = false;
                this.createAccountError = localeString(
                    'stores.SettingsStore.lndhubError'
                );
            });
    };

    // LNDHub
    @action
    public login = (request: LoginRequest) => {
        this.createAccountSuccess = '';
        this.createAccountError = '';
        this.loading = true;
        return RESTUtils.login({
            login: request.login,
            password: request.password
        })
            .then((data: any) => {
                this.loading = false;
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
            })
            .catch(() => {
                // handle error
                this.loading = false;
            });
    };

    @action
    public setLoginStatus = (status = false) => {
        this.loggedIn = status;
    };

    @action
    public setConnectingStatus = (status = false) => {
        this.connecting = status;
    };
}
