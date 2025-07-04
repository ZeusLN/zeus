import { action, observable, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';

import SettingsStore from './SettingsStore';
import {
    SATS_PER_BTC,
    numberWithCommas,
    numberWithDecimals
} from '../utils/UnitsUtils';

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
        this.getFiatRates();
    }

    // Resource below may be helpful for formatting
    // https://fastspring.com/blog/how-to-format-30-currencies-from-countries-all-over-the-world/
    @observable public symbolLookup = (
        symbol: string
    ): CurrencyDisplayRules => {
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
            ARS: {
                symbol: '$',
                space: true,
                rtl: false,
                separatorSwap: true
            },
            ALL: {
                symbol: 'L',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            ANG: {
                symbol: 'f',
                space: false,
                rtl: false,
                separatorSwap: true
            },
            AOA: {
                symbol: 'Kz',
                space: true,
                rtl: false,
                separatorSwap: true
            },
            AUD: {
                symbol: '$',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            BDT: {
                symbol: '৳',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            BGN: {
                symbol: 'лв',
                space: true,
                rtl: false,
                separatorSwap: true
            },
            BHD: {
                symbol: 'BD',
                space: true,
                rtl: false,
                separatorSwap: true
            },
            BIF: {
                symbol: 'FBu',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            BMD: {
                symbol: 'BD$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
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
            BWP: {
                symbol: 'P',
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
            DJF: {
                symbol: 'Fdj',
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
            DZD: {
                symbol: 'دج',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            EGP: {
                symbol: '.ج.م',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            ETB: {
                symbol: 'Br',
                space: true,
                rtl: true,
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
            GEL: {
                symbol: '₾',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            GHS: {
                symbol: 'GH₵',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            GNF: {
                symbol: 'FG',
                space: true,
                rtl: true,
                separatorSwap: true
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
            HNL: {
                symbol: 'L',
                space: false,
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
            IRR: {
                symbol: '﷼',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            ISK: { symbol: 'kr', space: true, rtl: true, separatorSwap: true },
            JMD: {
                symbol: '$',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            JOD: {
                symbol: 'JD',
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
            KGS: {
                symbol: 'сом',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            KRW: { symbol: '₩', space: true, rtl: false, separatorSwap: false },
            KZT: {
                symbol: '₸',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            LBP: {
                symbol: 'LL',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            LKR: {
                symbol: 'Rs',
                space: false,
                rtl: true,
                separatorSwap: false
            },
            MAD: {
                symbol: 'DH',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            MRU: {
                symbol: 'UM',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            MGA: {
                symbol: 'Ar',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            MXN: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            MYR: {
                symbol: 'RM',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NAD: {
                symbol: 'N$',
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
            NPR: {
                symbol: 'रु',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            NZD: { symbol: '$', space: true, rtl: false, separatorSwap: false },
            PAB: {
                symbol: 'B/',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            PEN: {
                symbol: 'S/',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            PHP: { symbol: '₱', space: true, rtl: false, separatorSwap: false },
            PKR: {
                symbol: 'Rs',
                space: true,
                rtl: true,
                separatorSwap: false
            },
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
            RSD: {
                symbol: 'дин',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            RUB: {
                symbol: 'p.',
                space: true,
                rtl: true,
                separatorSwap: true
            },
            RWF: {
                symbol: 'FRw',
                space: true,
                rtl: true,
                separatorSwap: false
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
            UZS: {
                symbol: 'soʻm',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            VES: {
                symbol: 'Bs.',
                space: true,
                rtl: false,
                separatorSwap: false
            },
            VND: {
                symbol: '₫',
                space: true,
                rtl: true,
                separatorSwap: true
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
            },
            ZMW: {
                symbol: 'K',
                space: false,
                rtl: false,
                separatorSwap: false
            },
            XAG: {
                symbol: 'Ag oz',
                space: true,
                rtl: true,
                separatorSwap: false
            },
            XAU: {
                symbol: 'Au oz',
                space: true,
                rtl: true,
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

    public getSymbol = () => {
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
                ? numberWithDecimals(rate)
                : numberWithCommas(rate);

            const formattedMoscow = separatorSwap
                ? numberWithDecimals(moscowTime)
                : numberWithCommas(moscowTime);

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

    // as of April 17, 2024
    // BTCPAY rates string:
    // BTC_USD,BTC_AUD,BTC_BRL,BTC_CAD,BTC_CHF,BTC_CLP,BTC_CNY,BTC_CZK,BTC_DKK,BTC_EUR,BTC_GBP,BTC_HKD,BTC_HUF,BTC_INR,BTC_ISK,BTC_JPY,BTC_KRW,BTC_NZD,BTC_PLN,BTC_RON,BTC_RUB,BTC_SEK,BTC_SGD,BTC_THB,BTC_TRY,BTC_TWD,BTC_ILS,BTC_ARS,BTC_NGN,BTC_LBP,BTC_MYR,BTC_UAH,BTC_JMD,BTC_COP,BTC_MXN,BTC_VES,BTC_TZS,BTC_QAR,BTC_TND,BTC_NOK,BTC_AED,BTC_TTD,BTC_PHP,BTC_CDF,BTC_XAF,BTC_KES,BTC_UGX,BTC_ZAR,BTC_CUP,BTC_DOP,BTC_BZD,BTC_BOB,BTC_CRC,BTC_GTQ,BTC_NIO,BTC_PYG,BTC_UYU,BTC_MRU,BTC_ALL,BTC_ANG,BTC_AOA,BTC_BDT,BTC_BGN,BTC_BHD,BTC_BIF,BTC_BMD,BTC_BWP,BTC_DJF,BTC_DZD,BTC_EGP,BTC_ETB,BTC_GEL,BTC_GHS,BTC_GNF,BTC_HNL,BTC_IRR,BTC_JOD,BTC_KGS,BTC_KZT,BTC_LKR,BTC_MAD,BTC_MGA,BTC_NAD,BTC_NPR,BTC_PAB,BTC_PEN,BTC_PKR,BTC_RSD,BTC_RWF,BTC_UZS,BTC_VND,BTC_XAG,BTC_XAU,BTC_ZMW
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
    // BTC_ALL = yadio(BTC_ALL);
    // BTC_ANG = yadio(BTC_ANG);
    // BTC_AOA = yadio(BTC_AOA);
    // BTC_BDT = yadio(BTC_BDT);
    // BTC_BGN = yadio(BTC_BGN);
    // BTC_BHD = yadio(BTC_BHD);
    // BTC_BIF = yadio(BTC_BIF);
    // BTC_BMD = yadio(BTC_BMD);
    // BTC_BWP = yadio(BTC_BWP);
    // BTC_DJF = yadio(BTC_DJF);
    // BTC_DZD = yadio(BTC_DZD);
    // BTC_EGP = yadio(BTC_EGP);
    // BTC_ETB = yadio(BTC_ETB);
    // BTC_GEL = yadio(BTC_GEL);
    // BTC_GHS = yadio(BTC_GHS);
    // BTC_GNF = yadio(BTC_GNF);
    // BTC_HNL = yadio(BTC_HNL);
    // BTC_IRR = yadio(BTC_IRR);
    // BTC_JOD = yadio(BTC_JOD);
    // BTC_KGS = yadio(BTC_KGS);
    // BTC_KZT = yadio(BTC_KZT);
    // BTC_LKR = yadio(BTC_LKR);
    // BTC_MAD = yadio(BTC_MAD);
    // BTC_MGA = yadio(BTC_MGA);
    // BTC_NAD = yadio(BTC_NAD);
    // BTC_NPR = yadio(BTC_NPR);
    // BTC_PAB = yadio(BTC_PAB);
    // BTC_PEN = yadio(BTC_PEN);
    // BTC_PKR = yadio(BTC_PKR);
    // BTC_RSD = yadio(BTC_RSD);
    // BTC_RWF = yadio(BTC_RWF);
    // BTC_UZS = yadio(BTC_UZS);
    // BTC_VND = yadio(BTC_VND);
    // BTC_XAG = yadio(BTC_XAG);
    // BTC_XAU = yadio(BTC_XAU);
    // BTC_ZMW = yadio(BTC_ZMW);

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

            if (settings.fiatRatesSource.toLowerCase() === 'zeus') {
                this.fiatRates = await this.getFiatRatesFromZeus();
            } else if (settings.fiat != null) {
                const rate = await this.getSelectedFiatRateFromYadio(
                    settings.fiat
                );

                runInAction(() => {
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
                });
            }

            this.sourceOfCurrentFiatRates = settings.fiatRatesSource;
        } finally {
            this.loading = false;
        }
    };

    public formatAmountForDisplay = (input: string | number) => {
        const { symbol, space, rtl, separatorSwap } = this.getSymbol();
        const amount = separatorSwap
            ? numberWithDecimals(input)
            : numberWithCommas(input);

        if (rtl) return `${amount}${space ? ' ' : ''}${symbol}`;
        return `${symbol}${space ? ' ' : ''}${amount}`;
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
        } catch (error) {
            console.error('Error fetching fiat rates from yadio', error);
        }

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
        } catch (error) {
            console.error('Error fetching fiat rates from zeus', error);
        }

        return undefined;
    };
}
