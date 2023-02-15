import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';
import { localeString } from './../utils/LocaleUtils';

interface HTLC {
    hash_lock: string;
    expiration_height: number;
    incoming: boolean;
    amount: string;
}

export default class Channel extends BaseModel {
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
    initiator?: boolean;
    alias_scids?: Array<number>; // array uint64
    local_chan_reserve_sat?: string;
    remote_chan_reserve_sat?: string;
    // c-lightning
    @observable
    state: string;
    msatoshi_total: string;
    msatoshi_to_us: string;
    channel_id?: string;
    alias?: string;

    @computed
    public get isActive(): boolean {
        return this.active || this.state === 'CHANNELD_NORMAL';
    }

    @computed
    public get remoteBalance(): string {
        return this.msatoshi_total
            ? (
                  (Number(this.msatoshi_total) - Number(this.msatoshi_to_us)) /
                  1000
              ).toString()
            : this.remote_balance || '0';
    }

    @computed
    public get localBalance(): string {
        return this.msatoshi_to_us
            ? (Number(this.msatoshi_to_us) / 1000).toString()
            : this.local_balance || '0';
    }

    @computed
    public get channelId(): string {
        return (
            this.chan_id ||
            this.channel_id ||
            localeString('models.Channel.unknownId')
        );
    }
}
