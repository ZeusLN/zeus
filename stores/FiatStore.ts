import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import SettingsStore from './SettingsStore';
import { SATS_PER_BTC } from './UnitsStore';

interface CurrencyDisplayRules {
    symbol: string;
    space: boolean;
    rtl: boolean;
    separatorSwap: boolean;
}
export default class FiatStore {
    @observable public fiatRates:
        | {
              name?: string;
              cryptoCode: string;
              currencyPair: string;
              code: string;
              rate: number;
          }[]
        | undefined;
    @observable public loading = false;
    @observable public error = false;

    private sourceOfCurrentFiatRates: string | undefined;

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
    symbolLookup = (symbol: string): CurrencyDisplayRules => {
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
            BOB: {
                symbol: 'Bs',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            BRL: {
                symbol: 'R$',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            BZD: {
                symbol: 'BZ$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            CAD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            CDF: {
                symbol: 'FC',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            CHF: {
                symbol: 'fr.',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            CLP: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            CNY: { symbol: '¥', space: true, rtl: false, separatorSwap: false },
            COP: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            CRC: {
                symbol: '₡',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            CUP: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
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
            DOP: {
                symbol: 'RD$',
                space: false,
                rtl: false,
                separatorSwap: false
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
            GTQ: {
                symbol: 'Q',
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
            IDR: {
                symbol: 'Rp',
                space: false,
                rtl: false,
                separatorSwap: false
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
            KES: {
                symbol: '/=',
                space: false,
                rtl: true,
                separatorSwap: false
            },
            KRW: { symbol: '₩', space: true, rtl: false, separatorSwap: false },
            LBP: {
                symbol: 'LL',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            MRU: {
                symbol: 'UM',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            MXN: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            MYR: {
                symbol: 'RM',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NGN: {
                symbol: '₦',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NIO: {
                symbol: 'C$',
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
            PYG: {
                symbol: '₲',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            RON: {
                symbol: 'lei',
                space: true,
                rtl: true,
                separatorSwap: false
            },
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
            UGX: {
                symbol: '/=',
                space: false,
                rtl: true,
                separatorSwap: false
            },
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
            },
            UYU: {
                symbol: 'U$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            XAF: {
                symbol: 'F.CFA',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            ZAR: {
                symbol: 'R',
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
        if (fiat) {
            return this.symbolLookup(fiat);
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
    public getRate = (sats: boolean = false) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        if (fiat && this.fiatRates) {
            const fiatEntry = this.fiatRates.filter(
                (entry) => entry.code === fiat
            )[0];
            const rate = (fiatEntry && fiatEntry.rate) || 0;
            const { symbol, space, rtl, separatorSwap } = this.symbolLookup(
                fiatEntry && fiatEntry.code
            );

            const moscowTime = new BigNumber(1)
                .div(rate)
                .multipliedBy(SATS_PER_BTC)
                .toFixed(0);

            const formattedRate = separatorSwap
                ? this.numberWithDecimals(rate)
                : this.numberWithCommas(rate);

            const formattedMoscow = separatorSwap
                ? this.numberWithDecimals(moscowTime)
                : this.numberWithCommas(moscowTime);

            if (sats) {
                return `${formattedMoscow} sats = 1 ${fiat}`;
            }

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
    // BTC_USD,BTC_AUD,BTC_BRL,BTC_CAD,BTC_CHF,BTC_CLP,BTC_CNY,BTC_CZK,BTC_DKK,BTC_EUR,BTC_GBP,BTC_HKD,BTC_HUF,BTC_INR,BTC_ISK,BTC_JPY,BTC_KRW,BTC_NZD,BTC_PLN,BTC_RON,BTC_RUB,BTC_SEK,BTC_SGD,BTC_THB,BTC_TRY,BTC_TWD,BTC_ILS,BTC_ARS,BTC_NGN,BTC_LBP,BTC_MYR,BTC_UAH,BTC_JMD,BTC_COP,BTC_MXN,BTC_VES,BTC_TZS,BTC_QAR,BTC_TND,BTC_NOK,BTC_AED,BTC_TTD,BTC_PHP,BTC_CDF,BTC_XAF,BTC_KES,BTC_UGX,BTC_ZAR,BTC_CUP,BTC_DOP,BTC_BZD,BTC_BOB,BTC_CRC,BTC_GTQ,BTC_NIO,BTC_PYG,BTC_UYU,BTC_MRU
    // BTCPAY custom scripting :
    // BTC_USD = coingecko(BTC_USD);
    // BTC_BZD = 2 * coingecko(BTC_USD);
    // BTC_AUD = coingecko(BTC_AUD);
    // BTC_BRL = yadio(BTC_BRL);
    // BTC_CAD = coingecko(BTC_CAD);
    // BTC_CHF = coingecko(BTC_CHF);
    // BTC_CLP = yadio(BTC_CLP);
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
    // BTC_ARS = yadio(BTC_ARS);
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
    // BTC_CDF = yadio(BTC_CDF);
    // BTC_XAF = yadio(BTC_XAF);
    // BTC_KES = yadio(BTC_KES);
    // BTC_UGX = yadio(BTC_UGX);
    // BTC_ZAR = yadio(BTC_ZAR);
    // BTC_CUP = yadio(BTC_CUP);
    // BTC_DOP = yadio(BTC_DOP);
    // BTC_BOB = yadio(BTC_BOB);
    // BTC_CRC = yadio(BTC_CRC);
    // BTC_GTQ = yadio(BTC_GTQ);
    // BTC_NIO = yadio(BTC_NIO);
    // BTC_PYG = yadio(BTC_PYG);
    // BTC_UYU = yadio(BTC_UYU);
    // BTC_MRU = yadio(BTC_MRU);
    @action
    public getFiatRates = async () => {
        // try not to slam endpoint
        if (this.loading) return;
        this.loading = true;

        try {
            const settings = await this.settingsStore.getSettings();

            if (
                this.fiatRates != null &&
                this.sourceOfCurrentFiatRates != settings.fiatRatesSource
            ) {
                // clear rates to display loading indicator after rates source switch
                this.fiatRates = undefined;
            }

            if (settings.fiatRatesSource === 'Zeus') {
                this.fiatRates = await this.getFiatRatesFromZeus();
            } else if (settings.fiat != null) {
                const rate = await this.getSelectedFiatRateFromYadio(
                    settings.fiat
                );

                if (this.fiatRates) {
                    this.fiatRates = this.fiatRates.filter(
                        (r) => r.code !== settings.fiat
                    );
                    if (rate != null) {
                        this.fiatRates = this.fiatRates.concat([rate]);
                    }
                } else if (rate) {
                    this.fiatRates = [rate];
                }
            }

            this.sourceOfCurrentFiatRates = settings.fiatRatesSource;
        } finally {
            this.loading = false;
        }
    };

    private getSelectedFiatRateFromYadio = async (code: string) => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                `https://api.yadio.io/rate/${code}/BTC`
            );
            const status = response.info().status;
            if (status == 200) {
                return {
                    cryptoCode: 'BTC',
                    code,
                    rate: response.json().rate,
                    currencyPair: `BTC_${code}`
                };
            }
        } catch {}

        return undefined;
    };

    private getFiatRatesFromZeus = async () => {
        try {
            const response = await ReactNativeBlobUtil.fetch(
                'GET',
                'https://pay.zeusln.app/api/rates?storeId=Fjt7gLnGpg4UeBMFccLquy3GTTEz4cHU4PZMU63zqMBo'
            );
            const status = response.info().status;
            if (status == 200) {
                return response.json();
            }
        } catch {}

        return undefined;
    };
}
