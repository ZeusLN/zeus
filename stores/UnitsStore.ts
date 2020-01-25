import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';
import FiatStore from './FiatStore';
import FeeUtils from './../utils/FeeUtils';

type Units = 'sats' | 'btc' | 'fiat';

export const satoshisPerBTC = 100000000;

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

        if (fiat === 'Disabled') {
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

    numberWithCommas = (x: string | number) =>
        x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    @action
    public getAmount = (value: string | number = 0) => {
        const { settings } = this.settingsStore;
        const { fiat } = settings;

        const wholeSats = value.toString().split('.')[0];
        if (this.units === 'btc') {
            // handle negative values
            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                let processedValue = valueToProcess.split('-')[1];
                return `- ₿ ${FeeUtils.toFixed(
                    Number(processedValue) / satoshisPerBTC
                )}`;
            }

            return `₿ ${FeeUtils.toFixed(Number(wholeSats || 0) / satoshisPerBTC)}`;
        } else if (this.units === 'sats') {
            const sats = `${value || 0} ${
                Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
            }`;
            return this.numberWithCommas(sats);
        } else if (this.units === 'fiat' && fiat) {
            const rate = this.fiatStore.fiatRates[fiat]['15m'];
            const symbol = this.fiatStore.fiatRates[fiat].symbol;

            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                let processedValue = valueToProcess.split('-')[1];
                return `- ${symbol} ${(
                    FeeUtils.toFixed(Number(processedValue) / satoshisPerBTC) * rate
                ).toFixed(2)}`;
            }

            return `${symbol} ${(
                FeeUtils.toFixed(Number(wholeSats || 0) / satoshisPerBTC) * rate
            ).toFixed(2)}`;
        }
    };
}
