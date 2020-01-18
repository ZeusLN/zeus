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

    toFixed(x: any) {
        if (Math.abs(x) < 1.0) {
            let e = parseInt(x.toString().split('e-')[1]);
            if (e) {
                x *= Math.pow(10, e - 1);
                x = '0.' + new Array(e).join('0') + x.toString().substring(2);
            }
        } else {
            let e = parseInt(x.toString().split('+')[1]);
            if (e > 20) {
                e -= 20;
                x /= Math.pow(10, e);
                x += new Array(e + 1).join('0');
            }
        }
        return x;
    }

    @action
    public getAmount = (value: string | number = 0) => {
        const wholeSats = value.toString().split('.')[0];
        if (this.units === 'btc') {
            // handle negative values
            const valueToProcess = (wholeSats && wholeSats.toString()) || '0';
            if (valueToProcess.includes('-')) {
                let processedValue = valueToProcess.split('-')[1];
                return `- ₿ ${this.toFixed(
                    Number(processedValue) / satoshisPerBTC
                )}`;
            }

            return `₿ ${this.toFixed(Number(wholeSats || 0) / satoshisPerBTC)}`;
        }

        const sats = `${value || 0} ${
            Number(value) === 1 || Number(value) === -1 ? 'sat' : 'sats'
        }`;
        return this.numberWithCommas(sats);
    };
}
