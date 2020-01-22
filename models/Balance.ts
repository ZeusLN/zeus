import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';

export default class Balance extends BaseModel {
    @observable confirmed_balance: string;
    @observable unconfirmed_balance: string;
    @observable total_balance: string;
    // c-lightning
    @observable confBalance: string;
    @observable unconfBalance: string;
    @observable totalBalance: string;
    //
    @observable localBalance: string;
    @observable remoteBalance: string;
    @observable balance: string;
    public pending_open_balance: string;

    @computed
    public get unconfirmedBalance(): number {
        return Number(this.unconfBalance || this.unconfirmed_balance);
    }

    @computed
    public get confirmedBalance(): number {
        return Number(this.confBalance || this.confirmed_balance);
    }

    @computed
    public get getTotalBalance(): number {
        return Number(this.totalBalance || this.total_balance);
    }

    @computed
    public get getTotalLightningBalance(): number {
        return this.balance
            ? Number(this.balance)
            : Number(this.localBalance) || 0;
    }
}
