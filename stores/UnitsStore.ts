import { action, observable } from 'mobx';
import Storage from '../storage';

import SettingsStore from './SettingsStore';
import FiatStore from './FiatStore';

import {
    SATS_PER_BTC,
    numberWithCommas,
    numberWithDecimals
} from '../utils/UnitsUtils';
import FeeUtils from '../utils/FeeUtils';

type Units = 'sats' | 'BTC' | 'fiat';

export const LEGACY_UNIT_KEY = 'zeus-units';
export const UNIT_KEY = 'zeus-units-v2';

interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
    error?: string;
}

export default class UnitsStore {
    @observable public units: Units | string = 'sats';
    settingsStore: SettingsStore;
    fiatStore: FiatStore;

    constructor(settingsStore: SettingsStore, fiatStore: FiatStore) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
        this.getUnits();
    }

    getUnits = async () => {
        const units = await Storage.getItem(UNIT_KEY);
        if (units) this.units = units;
    };

    @action
    public changeUnits = async () => {
        this.units = this.getNextUnit();
        await Storage.setItem(UNIT_KEY, this.units);
    };

    public getNextUnit = () => {
        const { settings } = this.settingsStore;
        const { fiatEnabled } = settings;

        if (!fiatEnabled) {
            return this.units === 'sats' ? 'BTC' : 'sats';
        } else {
            switch (this.units) {
                case 'sats':
                    return 'BTC';
                case 'BTC':
                    return 'fiat';
                default:
                    return 'sats';
            }
        }
    };

    @action
    public resetUnits = () => {
        this.units = 'sats';
    };

    @action getUnformattedAmount = (
        value: string | number = 0,
        fixedUnits?: string
    ): ValueDisplayProps => {
        const { settings } = this.settingsStore;
        const { fiat, display } = settings;
        const showAllDecimalPlaces: boolean =
            (display && display.showAllDecimalPlaces) || false;
        const units = fixedUnits || this.units;

        const sats = Number(value);
        const negative = sats < 0;
        const absValueSats = Math.abs(sats);

        if (units === 'BTC') {
            return {
                amount: FeeUtils.toFixed(
                    absValueSats / SATS_PER_BTC,
                    showAllDecimalPlaces
                ),
                unit: 'BTC',
                negative,
                space: false
            };
        } else if (units === 'sats') {
            return {
                amount: numberWithCommas(absValueSats),
                unit: 'sats',
                negative,
                plural: !(Number(value) === 1 || Number(value) === -1)
            };
        } else {
            const currency = fiat;

            // TODO: is this the right place to catch this?
            if (!currency) {
                return {
                    amount: 'Disabled',
                    unit: 'fiat',
                    symbol: '$'
                };
            }

            if (this.fiatStore.fiatRates) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];

                if (!fiatEntry?.rate) {
                    return {
                        amount: 'Disabled',
                        unit: 'fiat',
                        error: 'Rate for selected currency not available'
                    };
                }

                const rate = (fiatEntry && fiatEntry.rate) || 0;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.getSymbol();

                const amount = (
                    FeeUtils.toFixed(absValueSats / SATS_PER_BTC) * rate
                ).toFixed(2);

                return {
                    amount: separatorSwap
                        ? numberWithDecimals(amount)
                        : numberWithCommas(amount),
                    unit: 'fiat',
                    symbol,
                    negative,
                    plural: false,
                    rtl,
                    space
                };
            } else {
                return {
                    amount: 'Disabled',
                    unit: 'fiat',
                    error: 'Error fetching fiat rates'
                };
            }
        }
    };

    @action
    public getAmountFromSats = (
        value: string | number = 0,
        fixedUnits?: string
    ) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        const units = fixedUnits || this.units;

        const [wholeSats] = value.toString().split('.');
        if (units === 'BTC') {
            // handle negative values
            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                const processedValue = valueToProcess.split('-')[1];
                return `-₿${FeeUtils.toFixed(
                    Number(processedValue) / SATS_PER_BTC
                )}`;
            }

            return `₿${FeeUtils.toFixed(
                Number(wholeSats || 0) / SATS_PER_BTC
            )}`;
        } else if (units === 'sats') {
            const sats = `${numberWithCommas(wholeSats || value) || 0} ${
                Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
            }`;
            return sats;
        } else if (units === 'fiat' && fiat) {
            if (this.fiatStore.fiatRates) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const { code } = fiatEntry;
                const rate = (fiatEntry && fiatEntry.rate) || 0;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.symbolLookup(code);

                const amount = (
                    FeeUtils.toFixed(Number(wholeSats || 0) / SATS_PER_BTC) *
                    rate
                ).toFixed(2);

                const formattedAmount = separatorSwap
                    ? numberWithDecimals(amount)
                    : numberWithCommas(amount);

                if (rtl) {
                    return `${formattedAmount}${space ? ' ' : ''}${symbol}`;
                } else {
                    return `${symbol}${space ? ' ' : ''}${formattedAmount}`;
                }
            } else {
                return '$N/A';
            }
        }
    };

    @action
    public getFormattedAmount = (
        value: string | number = 0,
        fixedUnits?: string
    ) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        const units = fixedUnits || this.units;

        if (units === 'BTC') {
            // handle negative values
            const valueToProcess = value.toString() || '0';
            if (valueToProcess.includes('-')) {
                const processedValue = valueToProcess.split('-')[1];
                return `-₿${FeeUtils.toFixed(Number(processedValue))}`;
            }

            return `₿${FeeUtils.toFixed(Number(value || 0))}`;
        } else if (units === 'sats') {
            const [wholeSats] = value.toString().split('.');
            const sats = `${numberWithCommas(wholeSats || value) || 0} ${
                Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
            }`;
            return sats;
        } else if (units === 'fiat' && fiat) {
            if (this.fiatStore.fiatRates) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const { code } = fiatEntry;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.symbolLookup(code);

                // handle amounts passed in with commas
                const amount = Number(
                    value.toString().replace(/,/g, '.')
                ).toFixed(2);

                const formattedAmount = separatorSwap
                    ? numberWithDecimals(amount)
                    : numberWithCommas(amount);

                if (rtl) {
                    return `${formattedAmount}${space ? ' ' : ''}${symbol}`;
                } else {
                    return `${symbol}${space ? ' ' : ''}${formattedAmount}`;
                }
            } else {
                return '$N/A';
            }
        }
    };
}
