import { computed } from 'mobx';
import BaseModel from './BaseModel';
import { localeString } from './../utils/LocaleUtils';

export default class ChannelClose extends BaseModel {
    channel_point: string;
    chain_hash: string;
    chan_id: string;
    closing_tx_hash: string;
    remote_pubkey: string;
    capacity: string;
    close_height: number;
    settled_balance: string;
    time_lock_balance: string;
    close_time: number;
    open_initiator: any;
    close_initiator: any;
    resolutions: any;

    @computed
    public get channelId(): string {
        return this.chan_id || localeString('models.Channel.unknownId');
    }

    @computed
    public get localBalance(): string {
        return this.settled_balance;
    }

    @computed
    public get remoteBalance(): string {
        return `${Number(this.capacity) - Number(this.settled_balance)}`;
    }
}
