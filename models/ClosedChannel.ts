import { computed } from 'mobx';
import Channel from './Channel';
import { lnrpc } from '../proto/lightning';

export default class ClosedChannel extends Channel {
    time_lock_balance: string;
    close_time: number;
    resolutions: any;
    close_type: string;

    @computed
    public get localBalance(): string {
        if (this.to_us_msat) {
            return (Number(this.to_us_msat) / 1000).toString();
        }
        return this.settled_balance;
    }

    @computed
    public get remoteBalance(): string {
        if (this.to_us_msat) {
            return (
                (Number(this.total_msat) - Number(this.to_us_msat)) /
                1000
            ).toString();
        }
        return `${Number(this.capacity) - Number(this.settled_balance || 0)}`;
    }

    @computed
    public get closeHeight(): number {
        return Number(this.capacity) - Number(this.settled_balance || 0);
    }

    @computed
    public get closeType(): string {
        return typeof this.close_type === 'number'
            ? lnrpc.ChannelCloseSummary.ClosureType[this.close_type]
            : this.close_type || '';
    }
}
