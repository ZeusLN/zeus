import * as Keychain from 'react-native-keychain';
import { action, observable } from 'mobx';
import axios from 'axios';

interface Credentials {
    service: string;
    username: string;
    password: string;
};

interface Settings {
    host?: string;
    port?: string;
    macaroonHex?: string;
    onChainAndress?: string;
}

export default class SettingsStore {
    @observable settings: Settings = {};
    @observable loading: boolean = false;

    @action
    public async getSettings() {
        this.loading = true;

        try {
            // Retrieve the credentials
            const credentials: Credentials | any = await Keychain.getGenericPassword();
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

        axios.request({
            method: 'get',
            url: `https://${host}:${port}/v1/newaddress`,
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
        })
        .catch((error: Error) => {
            // handle error
            console.log('errrrrr - newaddress');
            console.log(error);
        });
    }
}