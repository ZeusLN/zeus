import { observable, copmuted } from 'mobx';

interface HTLC {
    hash_lock: string;
    expiration_height: number;
    incoming: boolean;
    amount: string;
}

export default class Channel {
    commit_weight: string;
    local_balance: string;
    commit_fee: string;
    csv_delay: number;
    channel_point: string;
    chan_id: string;
    fee_per_kw: string;
    total_satoshis_received: string;
    pending_htlcs: Array<HTLC>;
    num_updates: string;
    @observable
    active: boolean;
    remote_balance: string;
    unsettled_balance: string;
    total_satoshis_sent: string;
    remote_pubkey: string;
    capacity: string;
    private: boolean;
    // c-lightningInvoice
    @observable
    status: string;

    @computed
    public get isActive(): boolean {
        return this.active || this.status === 'CHANNELD_NORMAL';
    }

    constructor(data?: any) {
        super();
        this.compose(data);
    }
}