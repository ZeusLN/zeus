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

    // Resource below may be helpful for formatting
    // https://fastspring.com/blog/how-to-format-30-currencies-from-countries-all-over-the-world/
    private symbolLookup = (symbol: string): CurrencyDisplayRules => {
        const symbolPairs: any = {
            USD: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            AED: {
                symbol: 'د.إ',
                space: false,
                rtl: true,
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
            COP: { symbol: '$', space: true, rtl: false, separatorSwap: false },
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
            ISK: { symbol: 'kr', space: true, rtl: true, separatorSwap: true },
            JMD: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            JPY: { symbol: '¥', space: true, rtl: false, separatorSwap: false },
            KRW: { symbol: '₩', space: true, rtl: false, separatorSwap: false },
            LBP: {
                symbol: 'LL',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            MXN: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            MYR: {
                symbol: 'MR',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            NGN: {
                symbol: '₦',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NOK: {
                symbol: 'kr',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            NZD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            PHP: { symbol: '₱', space: true, rtl: false, separatorSwap: false },
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
            TND: {
                symbol: 'د.ت',
                space: false,
                rtl: true,
                separatorSwap: false
            },
            TRY: { symbol: '₺', space: true, rtl: true, separatorSwap: false },
            TTD: {
                symbol: 'TT$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            TWD: {
                symbol: '元',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            TZS: {
                symbol: '/=',
                space: false,
                rtl: true,
                separatorSwap: false
            },
            UAH: { symbol: '₴', space: false, rtl: false, separatorSwap: true },
            VES: {
                symbol: 'Bs.',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            QAR: {
                symbol: 'QR',
                space: true,
                rtl: false,
                separatorSwap: false
            }
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

    // as of March 13, 2023
    // BTCPAY rates string:
    // BTC_USD,BTC_AUD,BTC_BRL,BTC_CAD,BTC_CHF,BTC_CLP,BTC_CNY,BTC_CZK,BTC_DKK,BTC_EUR,BTC_GBP,BTC_HKD,BTC_HUF,BTC_INR,BTC_ISK,BTC_JPY,BTC_KRW,BTC_NZD,BTC_PLN,BTC_RON,BTC_RUB,BTC_SEK,BTC_SGD,BTC_THB,BTC_TRY,BTC_TWD,BTC_ILS,BTC_ARS,BTC_NGN,BTC_LBP,BTC_MYR,BTC_UAH,BTC_JMD,BTC_COP,BTC_MXN,BTC_VES,BTC_TZS,BTC_QAR,BTC_TND,BTC_NOK,BTC_AED,BTC_TTD,BTC_PHP
    // BTCPAY custom scripting :
    // BTC_USD = coingecko(BTC_USD);
    // BTC_AUD = coingecko(BTC_AUD);
    // BTC_BRL = coingecko(BTC_BRL);
    // BTC_CAD = coingecko(BTC_CAD);
    // BTC_CHF = coingecko(BTC_CHF);
    // BTC_CLP = coingecko(BTC_CLP);
    // BTC_CNY = coingecko(BTC_CNY);
    // BTC_CZK = coingecko(BTC_CZK);
    // BTC_DKK = coingecko(BTC_DKK);
    // BTC_EUR = coingecko(BTC_EUR);
    // BTC_GBP = coingecko(BTC_GBP);
    // BTC_HKD = coingecko(BTC_HKD);
    // BTC_HUF = coingecko(BTC_HUF);
    // BTC_INR = coingecko(BTC_INR);
    // BTC_ISK = bitpay(BTC_ISK);
    // BTC_JPY = coingecko(BTC_JPY);
    // BTC_KRW = coingecko(BTC_KRW);
    // BTC_NZD = coingecko(BTC_NZD);
    // BTC_PLN = coingecko(BTC_PLN);
    // BTC_RON = yadio(BTC_RON);
    // BTC_RUB = coingecko(BTC_RUB);
    // BTC_SEK = coingecko(BTC_SEK);
    // BTC_SGD = coingecko(BTC_SGD);
    // BTC_THB = coingecko(BTC_THB);
    // BTC_TRY = coingecko(BTC_TRY);
    // BTC_TWD = coingecko(BTC_TWD);
    // BTC_ILS = coingecko(BTC_ILS);
    // BTC_ARS = coingecko(BTC_ARS);
    // BTC_NGN = coingecko(BTC_NGN);
    // BTC_LBP = yadio(BTC_LBP);
    // BTC_MYR = yadio(BTC_MYR);
    // BTC_UAH = yadio(BTC_UAH);
    // BTC_JMD = yadio(BTC_JMD);
    // BTC_COP = yadio(BTC_COP);
    // BTC_MXN = yadio(BTC_MXN);
    // BTC_VES = yadio(BTC_VES);
    // BTC_TZS = yadio(BTC_TZS);
    // BTC_QAR = yadio(BTC_QAR);
    // BTC_TND = yadio(BTC_TND);
    // BTC_NOK = yadio(BTC_NOK);
    // BTC_AED = yadio(BTC_AED);
    // BTC_TTD = yadio(BTC_TTD);
    // BTC_PHP = yadio(BTC_PHP);
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
