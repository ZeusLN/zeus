import { computed } from 'mobx';
import { localeString } from './../utils/LocaleUtils';
import Channel from './Channel';

export default class ForceClosedChannel extends Channel {
    local_chan_reserve_sat: number;
    remote_chan_reserve_sat: number;
    commitment_type: any;
    num_forwarding_packages: number;
    chan_status_flags: string;
    remote_node_pub: string;

    @computed
    public get channelId(): string {
        return (
            this.chan_id ||
            this.channel_id ||
            localeString('models.Channel.unknownId')
        );
    }

    @computed
    public get remotePubkey(): string {
        return this.remote_pubkey || this.remote_node_pub;
    }
}
