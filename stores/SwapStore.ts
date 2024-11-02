import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
// import BigNumber from 'bignumber.js';

// import SettingsStore from './SettingsStore';

// wss://api.testnet.boltz.exchange/v2/ws
const HOST = 'https://api.testnet.boltz.exchange/v2';

export default class SwapStore {
    @observable public subInfo = {};
    @observable public reverseInfo = {};
    @observable public loading = true;

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
