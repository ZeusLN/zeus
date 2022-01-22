import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import FiatStore from './FiatStore';
import FeeUtils from './../utils/FeeUtils';

type Units = 'sats' | 'btc' | 'fiat';

export const satoshisPerBTC = 100000000;

interface ValueDisplayProps {
    amount: string;
    unit: Units;
    symbol?: string;
    negative?: boolean;
    plural?: boolean;
    rtl?: boolean;
    space?: boolean;
}

export default class UnitsStore {
    @observable public units: Units = 'sats';
    settingsStore: SettingsStore;
    fiatStore: FiatStore;

    constructor(settingsStore: SettingsStore, fiatStore: FiatStore) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
    }

    @action
    public changeUnits = () => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        if (!fiat || fiat === 'Disabled') {
            this.units = this.units == 'sats' ? 'btc' : 'sats';
        } else {
            switch (this.units) {
                case 'sats':
                    this.units = 'btc';
                    break;
                case 'btc':
                    this.units = 'fiat';
                    break;
                case 'fiat':
                    this.units = 'sats';
                    break;
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
        const { fiat } = settings;
        const units = fixedUnits || this.units;

        const [wholeSats] = value.toString().split('.');
        const sats = (wholeSats && Number(wholeSats)) || 0;
        const negative = sats < 0;
        const absValueSats = Math.abs(sats);

        if (units === 'btc') {
            return {
                amount: FeeUtils.toFixed(absValueSats / satoshisPerBTC),
                unit: 'btc',
                negative,
                space: false
            };
        } else if (units === 'sats') {
            return {
                amount: this.fiatStore.numberWithCommas(absValueSats),
                unit: 'sats',
                negative,
                plural: !(Number(value) === 1 || Number(value) === -1)
            };
        } else {
            const currency = fiat;

            // TODO: is this the right place to catch this?
            if (!currency || currency === 'Disabled') {
                return {
                    amount: 'Disabled',
                    unit: 'fiat',
                    symbol: '$'
                };
            }

            if (this.fiatStore.fiatRates && this.fiatStore.fiatRates.filter) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const rate = fiatEntry.rate;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.getSymbol();

                const amount = (
                    FeeUtils.toFixed(absValueSats / satoshisPerBTC) * rate
                ).toFixed(2);

                return {
                    amount: separatorSwap
                        ? this.fiatStore.numberWithDecimals(amount)
                        : this.fiatStore.numberWithCommas(amount),
                    unit: 'fiat',
                    symbol,
                    negative,
                    plural: false,
                    rtl,
                    space
                };
            } else {
                return { error: 'Error fetching fiat rates' };
            }
        }
    };

    @action
    public getAmount = (value: string | number = 0, fixedUnits?: string) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;
        const units = fixedUnits || this.units;

        const [wholeSats] = value.toString().split('.');
        if (units === 'btc') {
            // handle negative values
            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                const processedValue = valueToProcess.split('-')[1];
                return `-₿${FeeUtils.toFixed(
                    Number(processedValue) / satoshisPerBTC
                )}`;
            }

            return `₿${FeeUtils.toFixed(
                Number(wholeSats || 0) / satoshisPerBTC
            )}`;
        } else if (units === 'sats') {
            const sats = `${this.fiatStore.numberWithCommas(value) || 0} ${
                Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
            }`;
            return sats;
        } else if (units === 'fiat' && fiat) {
            if (this.fiatStore.fiatRates && this.fiatStore.fiatRates.filter) {
                const fiatEntry = this.fiatStore.fiatRates.filter(
                    (entry: any) => entry.code === fiat
                )[0];
                const rate = fiatEntry.rate;
                const { symbol, space, rtl, separatorSwap } =
                    this.fiatStore.symbolLookup(fiatEntry.code);

                const valueToProcess =
                    (wholeSats && wholeSats.toString()) || '0';

                const amount = (
                    FeeUtils.toFixed(Number(wholeSats || 0) / satoshisPerBTC) *
                    rate
                ).toFixed(2);

                const formattedAmount = separatorSwap
                    ? this.fiatStore.numberWithDecimals(amount)
                    : this.fiatStore.numberWithCommas(amount);

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
