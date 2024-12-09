import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { themeColor } from '../utils/ThemeUtils';
// import BigNumber from 'bignumber.js';

// import SettingsStore from './SettingsStore';

// wss://api.testnet.boltz.exchange/v2/ws
export const HOST = 'https://api.testnet.boltz.exchange/v2';

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo = {};
    @observable public loading = true;

    @action
    public statusColor = (status: string) => {
        let stateColor;
        switch (status) {
            case 'transaction.claimed':
                stateColor = 'green';
                break;
            case 'invoice.failedToPay':
            case 'swap.expired':
            case 'transaction.lockupFailed':
                stateColor = themeColor('error');
                break;
            default:
                stateColor = 'orange';
                break;
        }

        return stateColor;
    };

    @action
    public formatStatus = (status: string): string => {
        if (!status) return 'No updates found!';

        return status
            .replace(/\./g, ' ') // Replace dots with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
            .toLowerCase() // Convert to lowercase
            .replace(/\b[a-z]/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
    };

    @action
    public getSwapFees = async () => {
        this.loading = true;
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${HOST}/swap/submarine`
            );
            const status = response.info().status;
            if (status == 200) {
                this.subInfo = response.json().BTC.BTC;
                console.log('a', this.subInfo);
            }
        } catch {}

        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `${HOST}/swap/reverse`
            );
            const status = response.info().status;
            if (status == 200) {
                this.reverseInfo = response.json().BTC.BTC;
                console.log('b', this.reverseInfo);
            }
        } catch {}
        this.loading = false;
    };
}
