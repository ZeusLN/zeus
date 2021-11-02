import RNSecureKeyStore, { ACCESSIBLE } from 'react-native-secure-key-store';
import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import RESTUtils from '../utils/RESTUtils';

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
    onChainAddress?: string;
    enableTor?: boolean;
}

interface Settings {
    nodes?: Array<Node>;
    theme?: string;
    lurkerMode?: boolean;
    selectedNode?: number;
    passphrase?: string;
    fiat?: string;
    locale?: string;
    onChainAddress?: string;
}

export const LOCALE_KEYS = [
    { key: 'English', value: 'English' },
    { key: 'Español', value: 'Español' },
    { key: 'Português', value: 'Português' },
    { key: 'Français', value: 'Français' },
    { key: 'Češka', value: 'Češka' },
    { key: 'Slovák', value: 'Slovák' },
    { key: 'Deutsch', value: 'Deutsch' },
    { key: 'Türkçe', value: 'Türkçe' },
    { key: 'magyar nyelv', value: 'magyar nyelv' },
    { key: '简化字', value: '简化字' },
    // in progress
    { key: 'Ελληνικά', value: 'Ελληνικά' },
    { key: 'زبان فارسي', value: 'زبان فارسي' },
    { key: 'Nederlands', value: 'Nederlands' }
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
    { key: '🇦🇺 Austrlian Dollar (AUD)', value: 'AUD' },
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
    { key: '🇹🇼 Taiwan New Dollar (TWD)', value: 'TWD' }
];

export const THEME_KEYS = [
    { key: 'Dark', value: 'dark' },
    { key: 'Light', value: 'light' },
    { key: 'Junkie', value: 'junkie' }
];

export const DEFAULT_THEME = 'dark';
export const DEFAULT_FIAT = 'Disabled';
export const DEFAULT_LOCALE = 'English';
export default class SettingsStore {
    @observable settings: Settings = {};
    @observable public loading: boolean = false;
    @observable btcPayError: string | null;
    @observable host: string;
    @observable port: string;
    @observable url: string;
    @observable macaroonHex: string;
    @observable accessKey: string;
    @observable implementation: string;
    @observable certVerification: boolean | undefined;
    @observable chainAddress: string | undefined;
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

        return RNFetchBlob.fetch('get', configRoute)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    const configuration = data.configurations[0];
                    const {
                        adminMacaroon,
                        macaroon,
                        type,
                        uri
                    } = configuration;

                    if (type !== 'lnd-rest' && type !== 'clightning-rest') {
                        this.btcPayError =
                            'Sorry, we currently only support BTCPay instances using lnd or c-lightning';
                    } else {
                        const config = {
                            host: uri,
                            macaroonHex: adminMacaroon || macaroon,
                            implementation:
                                type === 'clightning-rest'
                                    ? 'c-lightning-REST'
                                    : 'lnd'
                        };

                        return config;
                    }
                } else {
                    this.btcPayError = 'Error getting BTCPay configuration';
                }
            })
            .catch((err: any) => {
                // handle error
                this.btcPayError = `Error getting BTCPay configuration: ${err.toString()}`;
            });
    };

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
                    this.chainAddress = node.onChainAddress;
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

    @action
    public getNewAddress = () => {
        return RESTUtils.getNewAddress().then((data: any) => {
            const newAddress = data.address || data[0].address;
            if (this.settings.nodes) {
                this.settings.nodes[
                    this.settings.selectedNode || 0
                ].onChainAddress = newAddress;
            }

            const newSettings = this.settings;

            this.setSettings(JSON.stringify(newSettings)).then(() => {
                this.getSettings();
            });
        });
    };

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
                this.createAccountSuccess =
                    'Successfully created LNDHub account. Record the username and password somewhere so you can restore your funds if something happens to your device. Then hit Save Node Config to continue.';
                return data;
            })
            .catch(() => {
                // handle error
                this.loading = false;
                this.createAccountError =
                    'Error creating LNDHub account. Please check the host and try again.';
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
}
