import { action, observable } from 'mobx';
import RNFetchBlob from 'rn-fetch-blob';
import SettingsStore from './SettingsStore';

interface CurrencyDisplayRules {
    symbol: string;
    space: boolean;
    rtl: boolean;
}
export default class FiatStore {
    @observable public fiatRates: any = {};
    @observable public loading: boolean = false;
    @observable public error: boolean = false;

    getFiatRatesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    // TODO: do more of these symbol pairs. I'm referring to
    // https://fastspring.com/blog/how-to-format-30-currencies-from-countries-all-over-the-world/
    private symbolLookup = (symbol: string): CurrencyDisplayRules => {
        const symbolPairs = {
            USD: { symbol: '$', space: false, rtl: false },
            EUR: { symbol: '€', space: true, rtl: false },
            GBP: { symbol: '£', space: false, rtl: false },
            JPY: { symbol: '¥', space: true, rtl: false },
            THB: { symbol: '฿', space: true, rtl: true }
        };

        if (symbol in symbolPairs) {
            // TODO: how do I get typescript less mad here?
            return symbolPairs[symbol];
        } else {
            return { symbol, space: true, rtl: false };
        }
    };

    @action getSymbol = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        if (fiat) {
            return this.symbolLookup(this.fiatRates[fiat].symbol);
        } else {
            console.log('no fiat?');
            // TODO: what do we do in this case?
            return { symbol: '???', space: true, rtl: true };
        }
    };

    @action
    public getRate = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        if (fiat) {
            const rate = this.fiatRates[fiat]['15m'];
            //const symbol = this.symbolLookup(this.fiatRates[fiat].symbol);
            const symbol = '$';
            return `${symbol}${rate} BTC/${fiat}`;
        }
        return 'N/A';
    };

    @action
    public getFiatRates = () => {
        this.loading = true;
        RNFetchBlob.fetch('get', 'https://blockchain.info/ticker')
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    this.loading = false;
                    this.fiatRates = data;
                } else {
                    this.fiatRates = {};
                    this.loading = false;
                }
            })
            .catch(() => {
                this.fiatRates = {};
                this.loading = false;
            });
    };
}
