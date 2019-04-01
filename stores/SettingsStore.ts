import * as Keychain from 'react-native-keychain';
import { action, observable } from 'mobx';
import axios from 'axios';

interface Settings {
    host?: string;
    port?: string;
    macaroonHex?: string;
    onChainAndress?: string;
    theme?: string;
}

export default class SettingsStore {
    @observable settings: Settings = {};
    @observable loading: boolean = false;
    @observable btcPayError: string | null;

    @action
    public fetchBTCPayConfig = (data: string) => {
        const configRoute = data.split('config=')[1];
        this.btcPayError = null;

        return axios.request({
            method: 'get',
            url: configRoute
        }).then((response: any) => {
            // handle success
            const data = response.data;
            const configuration = data.configurations[0];
            const { adminMacaroon, type, uri } = configuration;

            if (type !== 'lnd-rest') {
                this.btcPayError = "Sorry, we only currently support BTCPay instances using lnd";
            } else {
                const config = {
                    host: uri.split('https://')[1],
                    macaroonHex: adminMacaroon
                }

                return config;
            }
        })
        .catch(() => {
            // handle error
            this.btcPayError = "Error getting BTCPay configuration";
        });
    }

    @action
    public async getSettings() {
        this.loading = true;

        try {
            // Retrieve the credentials
            const credentials: any = await Keychain.getGenericPassword();
            this.loading = false;
            if (credentials) {
                this.settings = JSON.parse(credentials.password);
            } else {
                console.log('No credentials stored');
            }
        } catch (error) {
            this.loading = false;
            console.log('Keychain couldn\'t be accessed!', error);
        }
    }

    @action
    public async setSettings(settings: string) {
        this.loading = true;

        // Store the credentials
        await Keychain.setGenericPassword('settings', settings).then(() => {
            this.loading = false;
        });
    }

    @action
    public getNewAddress = () => {
        const { host, port, macaroonHex } = this.settings;

        return axios.request({
            method: 'get',
            url: `https://${host}${port ? ':' + port : ''}/v1/newaddress`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            const newAddress = data.address;
            const newSettings = {
                ...this.settings,
                onChainAndress: newAddress
            };

            this.setSettings(JSON.stringify(newSettings));
        });
    }
}