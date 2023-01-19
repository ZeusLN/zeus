import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import SettingsStore from './SettingsStore';

interface CurrencyDisplayRules {
    symbol: string;
    space: boolean;
    rtl: boolean;
}
export default class FiatStore {
    @observable public fiatRates: any = {};
    @observable public loading = false;
    @observable public error = false;

    getFiatRatesToken: any;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    numberWithCommas = (x: string | number) =>
        x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    numberWithDecimals = (x: string | number) =>
        this.numberWithCommas(x).replace(/[,.]/g, (y: string) =>
            y === ',' ? '.' : ','
        );

    private symbolLookup = (symbol: string): CurrencyDisplayRules => {
        const symbolPairs: any = {
            USD: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            ARS: { symbol: '$', space: true, rtl: false, separatorSwap: true },
            AUD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            BRL: {
                symbol: 'R$',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            CAD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            CHF: {
                symbol: 'fr.',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            CLP: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            CNY: { symbol: '¥', space: true, rtl: false, separatorSwap: false },
            CZK: {
                symbol: 'Kč',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            DKK: {
                symbol: 'kr.',
                space: true,
                rtl: false,
                separatorSwap: true
            },
            EUR: {
                symbol: '€',
                space: false,
                rtl: false,
                separatorSwap: true
            },
            GBP: {
                symbol: '£',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            HKD: {
                symbol: 'HK$',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            HUF: {
                symbol: 'Ft',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            ILS: { symbol: '₪', space: true, rtl: false, separatorSwap: false },
            INR: { symbol: '₹', space: true, rtl: false, separatorSwap: false },
            JPY: { symbol: '¥', space: true, rtl: false, separatorSwap: false },
            KRW: { symbol: '₩', space: true, rtl: false, separatorSwap: false },
            NGN: {
                symbol: '₦',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NZD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            PLN: { symbol: 'zł', space: true, rtl: true, separatorSwap: false },
            RUB: {
                symbol: 'p.',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            SAR: { symbol: '﷼', space: true, rtl: true, separatorSwap: false },
            SEK: {
                symbol: 'kr',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            SGD: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            THB: { symbol: '฿', space: true, rtl: true, separatorSwap: false },
            TRY: { symbol: '₺', space: true, rtl: true, separatorSwap: false },
            TWD: { symbol: '元', space: true, rtl: false, separatorSwap: false }
        };

        if (symbol in symbolPairs) {
            return symbolPairs[symbol];
        } else {
            return {
                symbol: symbol || 'N/A',
                space: true,
                rtl: false,
                separatorSwap: false
            };
        }
    };

    @action getSymbol = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        if (fiat && this.fiatRates.filter) {
            const fiatEntry = this.fiatRates.filter(
                (entry: any) => entry.code === fiat
            )[0];
            return this.symbolLookup(fiatEntry && fiatEntry.code);
        } else {
            return {
                symbol: fiat,
                space: true,
                rtl: true,
                separatorSwap: false
            };
        }
    };

    @action
    public getRate = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        if (fiat && this.fiatRates.filter) {
            const fiatEntry = this.fiatRates.filter(
                (entry: any) => entry.code === fiat
            )[0];
            const rate = (fiatEntry && fiatEntry.rate) || 0;
            const { symbol, space, rtl, separatorSwap } = this.symbolLookup(
                fiatEntry && fiatEntry.code
            );

            const formattedRate = separatorSwap
                ? this.numberWithDecimals(rate)
                : this.numberWithCommas(rate);

            if (rtl) {
                return `${formattedRate}${
                    space ? ' ' : ''
                }${symbol} BTC/${fiat}`;
            } else {
                return `${symbol}${
                    space ? ' ' : ''
                }${formattedRate} BTC/${fiat}`;
            }
        }
        return '$N/A';
    };

    @action
    public getFiatRates = () => {
        this.loading = true;
        ReactNativeBlobUtil.fetch(
            'GET',
            'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo'
        )
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    const data = response.json();
                    this.loading = false;
                    this.fiatRates = data;
                } else {
                    this.loading = false;
                }
            })
            .catch(() => {
                this.loading = false;
            });
    };
}
