import BigNumber from 'bignumber.js';
import { observable, computed } from 'mobx';
import BaseModel from './BaseModel';
import { lnrpc } from '../proto/lightning';

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
    zero_conf?: boolean;
    commitment_type?: string;
    // c-lightning
    @observable
    state: string;
    // CLN v23.05 msat deprecations
    msatoshi_total: string;
    msatoshi_to_us: string;
    total_msat: string;
    to_us_msat: string;
    // CLN v23.05 msat new
    total: string;
    to_us: string;

    channel_id?: string;
    alias?: string;
    // pending
    remote_node_pub: string;

    // enrichments
    displayName?: string;

    @computed
    public get isActive(): boolean {
        return this.active || this.state === 'CHANNELD_NORMAL';
    }

    @computed
    public get channelCapacity(): string {
        return new BigNumber(this.localBalance)
            .plus(this.remoteBalance)
            .toString();
    }

    @computed
    public get localBalance(): string {
        return this.to_us
            ? (Number(this.to_us) / 1000).toString()
            : this.to_us_msat
            ? (Number(this.to_us_msat) / 1000).toString()
            : this.msatoshi_to_us
            ? (Number(this.msatoshi_to_us) / 1000).toString()
            : this.local_balance || '0';
    }

    @computed
    public get remoteBalance(): string {
        return this.total
            ? ((Number(this.total) - Number(this.to_us)) / 1000).toString()
            : this.total_msat
            ? (
                  (Number(this.total_msat) - Number(this.to_us_msat)) /
                  1000
              ).toString()
            : this.msatoshi_total
            ? (
                  (Number(this.msatoshi_total) - Number(this.msatoshi_to_us)) /
                  1000
              ).toString()
            : this.remote_balance || '0';
    }

    /** Channel id
     * @returns {string | undefined} id of the channel or undefined if channel is pending
     */
    @computed
    public get channelId(): string | undefined {
        return this.chan_id || this.channel_id;
    }

    @computed
    public get remotePubkey(): string {
        return this.remote_pubkey || this.remote_node_pub;
    }

    @computed
    public get getCommitmentType(): string | undefined {
        return this.commitment_type
            ? Number.isNaN(Number(this.commitment_type))
                ? this.commitment_type
                : lnrpc.CommitmentType[Number(this.commitment_type)]
            : undefined;
    }
}
