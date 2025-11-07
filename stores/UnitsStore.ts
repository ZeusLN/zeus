import { observable } from 'mobx';
import Storage from '../storage';

import SettingsStore from './SettingsStore';
import FiatStore from './FiatStore';

type Units = 'sats' | 'BTC' | 'fiat';

export const LEGACY_UNIT_KEY = 'zeus-units';
export const UNIT_KEY = 'zeus-units-v2';

export default class UnitsStore {
    @observable public units: Units | string = 'sats';
    settingsStore: SettingsStore;
    fiatStore: FiatStore;

    constructor(settingsStore: SettingsStore, fiatStore: FiatStore) {
        this.settingsStore = settingsStore;
        this.fiatStore = fiatStore;
        this.getUnits();
    }

    private getUnits = async () => {
        const units = await Storage.getItem(UNIT_KEY);
        if (units) this.units = units;
    };

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

    public resetUnits = () => (this.units = 'sats');
}
