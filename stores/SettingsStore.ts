import RNSecureKeyStore, { ACCESSIBLE } from 'react-native-secure-key-store';
import { action, observable } from 'mobx';
import axios from 'axios';
import RESTUtils from '../utils/RESTUtils';

interface Node {
    host?: string;
    port?: string;
    macaroonHex?: string;
    implementation?: string;
}

interface Settings {
    nodes?: Array<Node>;
    onChainAddress?: string;
    theme?: string;
    lurkerMode?: boolean;
    selectedNode?: number;
    passphrase?: string;
    fiat?: string;
}

export default class SettingsStore {
    @observable settings: Settings = {};
    @observable loading: boolean = false;
    @observable btcPayError: string | null;
    @observable host: string;
    @observable port: string;
    @observable macaroonHex: string;
    @observable implementation: string;
    @observable chainAddress: string | undefined;

    @action
    public fetchBTCPayConfig = (data: string) => {
        const configRoute = data.split('config=')[1];
        this.btcPayError = null;

        return axios
            .request({
                method: 'get',
                url: configRoute
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                const configuration = data.configurations[0];
                const { adminMacaroon, macaroon, type, uri } = configuration;

                if (type !== 'lnd-rest' && type !== 'clightning-rest') {
                    this.btcPayError =
                        'Sorry, we currently only support BTCPay instances using lnd or c-lightning';
                } else {
                    const config = {
                        host: uri.split('https://')[1],
                        macaroonHex: adminMacaroon || macaroon,
                        implementation:
                            type === 'clightning-rest'
                                ? 'c-lightning-REST'
                                : 'lnd'
                    };

                    return config;
                }
            })
            .catch(() => {
                // handle error
                this.btcPayError = 'Error getting BTCPay configuration';
            });
    };

    @action
    public async getSettings() {
        this.loading = true;

        try {
            // Retrieve the credentials
            const credentials: any = await RNSecureKeyStore.get('zeus-settings');
            this.loading = false;
            if (credentials) {
                this.settings = JSON.parse(credentials);
                const node: any =
                    this.settings.nodes &&
                    this.settings.nodes[this.settings.selectedNode || 0];
                if (node) {
                    this.host = node.host;
                    this.port = node.port;
                    this.macaroonHex = node.macaroonHex;
                    this.implementation = node.implementation;
                }
                this.chainAddress = this.settings.onChainAddress;
                return this.settings;
            } else {
                console.log('No credentials stored');
            }
        } catch (error) {
            this.loading = false;
            console.log("Keychain couldn't be accessed!", error);
        }
    }

    @action
    public async setSettings(settings: string) {
        this.loading = true;

        // Store the credentials
        await RNSecureKeyStore.set('zeus-settings', settings, { accessible: ACCESSIBLE.WHEN_UNLOCKED }).then(() => {
            this.loading = false;
            return settings;
        });
    }

    @action
    public getNewAddress = () => {
        return RESTUtils.getNewAddress(this).then((response: any) => {
            // handle success
            const data = response.data;
            const newAddress = data.address;
            this.chainAddress = newAddress;
            const newSettings = {
                ...this.settings,
                onChainAddress: newAddress
            };

            this.setSettings(JSON.stringify(newSettings));
        });
    };
}
