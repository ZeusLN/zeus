import { computed } from 'mobx';
import Channel from './Channel';
import { lnrpc } from '../proto/lightning';

export default class ClosedChannel extends Channel {
    chain_hash: string;
    closing_tx_hash: string;
    close_height: number;
    settled_balance: string;
    time_lock_balance: string;
    close_time: number;
    open_initiator: any;
    close_initiator: any;
    resolutions: any;
    remote_node_pub: string;
    close_type: string;
    closing_txid: string;

    @computed
    public get localBalance(): string {
        return this.settled_balance;
    }

    @computed
    public get remoteBalance(): string {
        return `${Number(this.capacity) - Number(this.settled_balance || 0)}`;
    }

    @computed
    public get closeHeight(): number {
        return this.close_height;
    }

    @computed
    public get closeType(): string {
        return typeof this.close_type === 'number'
            ? lnrpc.ChannelCloseSummary.ClosureType[this.close_type]
            : this.close_type || '';
    }
}
