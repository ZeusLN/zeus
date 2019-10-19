import { action, observable } from 'mobx';
import SettingsStore from './SettingsStore';

type Units = 'sats' | 'btc';

export const satoshisPerBTC = 100000000;

export default class UnitsStore {
    @observable public units: Units = 'sats';
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    @action
    public changeUnits = () => {
        this.units = this.units == 'sats' ? 'btc' : 'sats';
    };

    numberWithCommas = (x: string | number) =>
        x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    @action
    public getAmount = (value: string | number) => {
        if (this.units === 'btc') {
            // handle negative values
            const valueToProcess = (value && value.toString()) || '0';
            if (valueToProcess.includes('-')) {
                let processedValue = valueToProcess.split('-')[1];
                return `- ₿ ${Number(processedValue) / satoshisPerBTC}`;
            }

            return `₿ ${Number(value || 0) / satoshisPerBTC}`;
        }

        const sats = `${value || 0} ${
            Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
        }`;
        return this.numberWithCommas(sats);
    };
}
