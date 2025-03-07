import BigNumber from 'bignumber.js';
import { observable, computed } from 'mobx';
const { chanFormat } = require('bolt07');

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
    pendingOpen: any;
    pendingClose: any;
    forceClose: any;
    closing: any;
    blocks_til_maturity: any;
    chain_hash: string;
    closing_tx_hash: string;
    closing_txid: string;
    settled_balance: any;
    time_locked_balance: any;
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
    peer_scid_alias?: number;
    zero_conf_confirmed_scid?: number;
    alias_scids?: Array<number>; // array uint64
    local_chan_reserve_sat?: string;
    remote_chan_reserve_sat?: string;
    zero_conf?: boolean;
    commitment_type?: string;
    open_initiator?: string | number;
    close_initiator?: string | number;
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
    short_channel_id: string; // CLN

    channel_id?: string;
    alias?: string;
    // pending
    remote_node_pub?: string;

    // enrichments
    displayName?: string;

    @computed
    public get isActive(): boolean {
        return this.active || this.state === 'CHANNELD_NORMAL';
    }

    @computed
    public get getOpenInitiator(): string {
        return typeof this.open_initiator === 'number'
            ? lnrpc.Initiator[this.open_initiator]
            : this.open_initiator || '';
    }

    @computed
    public get getCloseInitiator(): string {
        return typeof this.close_initiator === 'number'
            ? lnrpc.Initiator[this.close_initiator]
            : this.close_initiator || '';
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
    public get sendingCapacity(): string {
        const localBalance = new BigNumber(this.localBalance).minus(
            this.localReserveBalance
        );
        if (localBalance.gt(0)) {
            return localBalance.toString();
        } else {
            return '0';
        }
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

    @computed
    public get receivingCapacity(): string {
        const remoteBalance = new BigNumber(this.remoteBalance).minus(
            this.remoteReserveBalance
        );
        if (remoteBalance.gt(0)) {
            return remoteBalance.toString();
        } else {
            return '0';
        }
    }

    @computed
    public get localReserveBalance(): string {
        return this.local_chan_reserve_sat
            ? Number(this.local_chan_reserve_sat).toString()
            : '0';
    }

    @computed
    public get remoteReserveBalance(): string {
        return this.remote_chan_reserve_sat
            ? Number(this.remote_chan_reserve_sat).toString()
            : '0';
    }

    @computed
    public get totalReserveBalance(): string {
        return (
            Number(this.localReserveBalance) + Number(this.remoteReserveBalance)
        ).toString();
    }

    @computed
    public get isBelowReserve(): boolean {
        return (
            new BigNumber(this.localBalance).lt(this.localReserveBalance) &&
            new BigNumber(this.localBalance).gt(0)
        );
    }

    /** Channel id
     * @returns {string | undefined} id of the channel or undefined if channel is pending
     */
    @computed
    public get channelId(): string | undefined {
        return this.chan_id || this.channel_id;
    }

    @computed
    public get shortChannelId(): string | undefined {
        return this.short_channel_id
            ? this.short_channel_id
            : this.channelId
            ? chanFormat({ number: this.channelId }).channel
            : undefined;
    }

    @computed
    public get aliasScids(): Array<string> {
        const scids: Array<string> = [];
        this.alias_scids?.forEach((scid) => {
            try {
                const formatted = chanFormat({ number: scid }).channel;
                if (formatted !== '0x0x0') scids.push(formatted);
            } catch (e) {}
        });
        return scids;
    }

    @computed
    public get peerScidAlias(): string | undefined {
        const scid = this.peer_scid_alias
            ? chanFormat({ number: this.peer_scid_alias }).channel
            : undefined;
        return scid !== '0x0x0' ? scid : undefined;
    }

    @computed get zeroConfConfirmedScid(): string | undefined {
        const scid = this.zero_conf_confirmed_scid
            ? chanFormat({ number: this.zero_conf_confirmed_scid }).channel
            : undefined;
        return scid !== '0x0x0' ? scid : undefined;
    }

    @computed
    public get remotePubkey(): string {
        return this.remote_pubkey || this.remote_node_pub || '';
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
