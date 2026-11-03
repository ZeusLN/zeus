import { action, observable, runInAction } from 'mobx';

import BalanceStore from './BalanceStore';
import ChannelsStore from './ChannelsStore';

import BackendUtils from '../utils/BackendUtils';
import {
    SpliceDirection,
    SpliceEvent,
    getSpliceErrorMessage,
    getSpliceInAvailableSats
} from '../utils/SpliceUtils';

export interface SpliceRequest {
    direction: SpliceDirection;
    fundingTxid: string;
    amountSats: number;
    // Splice-out destination; a fresh address from our own wallet if unset
    address?: string;
}

// What we asked for; the node's events don't say
interface SpliceIntent {
    direction: SpliceDirection;
    amountSats: number;
    address?: string;
}

export interface PendingSplice {
    userChannelId: string;
    channelId: string;
    txid: string;
    vout?: number;
    // remote: the peer started it, so direction and amount are unknown
    initiator: 'local' | 'remote';
    direction?: SpliceDirection;
    amountSats?: number;
    address?: string;
    startedAt: number;
}

export default class SpliceStore {
    @observable public pendingSplices: PendingSplice[] = [];

    private intents = new Map<string, SpliceIntent>();
    private unsubscribeSpliceEvents: (() => void) | null = null;

    @observable public spliceInAvailableSats: number | null = null;
    @observable public loadingSpliceInAvailable = false;
    @observable public spliceInAvailableError: string | null = null;

    @observable public splicing = false;
    @observable public spliceSuccess = false;
    @observable public spliceTxid: string | null = null;
    @observable public spliceError: string | null = null;
    @observable public spliceErrorDetail: string | null = null;

    channelsStore: ChannelsStore;
    balanceStore: BalanceStore;

    constructor(channelsStore: ChannelsStore, balanceStore: BalanceStore) {
        this.channelsStore = channelsStore;
        this.balanceStore = balanceStore;
    }

    @action
    public reset = () => {
        this.spliceInAvailableSats = null;
        this.loadingSpliceInAvailable = false;
        this.spliceInAvailableError = null;
        this.resetSplice();
    };

    @action
    private resetSplice = () => {
        this.splicing = false;
        this.spliceSuccess = false;
        this.spliceTxid = null;
        this.spliceError = null;
        this.spliceErrorDetail = null;
    };

    // Follows splices for the connected node, including ones the peer starts.
    // A splice keeps the channel's old funding and capacity until it locks,
    // so channels and balances are refreshed on each step. Safe to call on
    // every refresh: it subscribes once until stopTracking
    @action
    public trackSplices = () => {
        if (this.unsubscribeSpliceEvents) return;
        const unsubscribe = BackendUtils.watchSpliceEvents(
            this.handleSpliceEvent
        );
        if (typeof unsubscribe === 'function') {
            this.unsubscribeSpliceEvents = unsubscribe;
        }
    };

    @action
    public stopTracking = () => {
        this.unsubscribeSpliceEvents?.();
        this.unsubscribeSpliceEvents = null;
        this.pendingSplices = [];
        this.intents.clear();
    };

    @action
    private handleSpliceEvent = (event: SpliceEvent) => {
        const { type, userChannelId } = event;
        const pending = this.pendingSplices.some(
            (splice) => splice.userChannelId === userChannelId
        );

        if (type === 'splicePending' && event.txid) {
            const intent = this.intents.get(userChannelId);
            this.intents.delete(userChannelId);
            this.pendingSplices = [
                ...this.pendingSplices.filter(
                    (splice) => splice.userChannelId !== userChannelId
                ),
                {
                    userChannelId,
                    channelId: event.channelId,
                    txid: event.txid,
                    vout: event.vout,
                    initiator: intent ? 'local' : 'remote',
                    ...intent,
                    startedAt: Date.now()
                }
            ];
        } else if (type === 'spliceFailed' || type === 'channelClosed') {
            const intended = this.intents.delete(userChannelId);
            if (!pending && !intended) return;
            this.removePendingSplice(userChannelId);
        } else if (type === 'channelReady' && pending) {
            this.removePendingSplice(userChannelId);
        } else {
            return;
        }

        this.channelsStore.getChannels();
        this.balanceStore.getCombinedBalance();
    };

    @action
    private removePendingSplice = (userChannelId: string) => {
        this.pendingSplices = this.pendingSplices.filter(
            (splice) => splice.userChannelId !== userChannelId
        );
    };

    // A splice-in can only spend confirmed UTXOs, so the confirmed balance
    // is summed from the UTXO set rather than taken from the aggregate
    // balance, which also counts our own unconfirmed change
    @action
    public loadSpliceInAvailable = async () => {
        this.loadingSpliceInAvailable = true;
        this.spliceInAvailableError = null;

        try {
            const [{ utxos }, balance] = await Promise.all([
                BackendUtils.getUTXOs(),
                BackendUtils.getBlockchainBalance()
            ]);

            const confirmedSats = utxos
                .filter((utxo: any) => Number(utxo.confirmations) > 0)
                .reduce(
                    (sum: number, utxo: any) => sum + Number(utxo.amount_sat),
                    0
                );

            runInAction(() => {
                this.spliceInAvailableSats = getSpliceInAvailableSats(
                    confirmedSats,
                    Number(balance.reserved_balance_anchor_chan || 0)
                );
            });
        } catch (error: any) {
            runInAction(() => {
                this.spliceInAvailableSats = null;
                this.spliceInAvailableError = error?.message || String(error);
            });
        } finally {
            runInAction(() => {
                this.loadingSpliceInAvailable = false;
            });
        }
    };

    // Resolves once the peers have negotiated and broadcast the splice
    // transaction, or after the backend's wait for that times out, in which
    // case no txid is known yet. The channel keeps its old capacity until
    // the transaction confirms, so the refresh only picks up balances.
    @action
    public splice = async ({
        direction,
        fundingTxid,
        amountSats,
        address
    }: SpliceRequest) => {
        this.resetSplice();
        this.splicing = true;

        // Read by handleSpliceEvent, which may only hear back after this
        // call has timed out
        const userChannelId = this.channelsStore.channels.find(
            (channel) => channel.channel_point?.split(':')[0] === fundingTxid
        )?.user_channel_id;
        if (userChannelId) {
            this.intents.set(userChannelId, { direction, amountSats, address });
        }

        try {
            let result: any;
            if (direction === 'in') {
                result = await BackendUtils.spliceIn({
                    fundingTxid,
                    amountSats
                });
            } else {
                // Fetched only now so an abandoned splice doesn't use up a
                // wallet address
                const destination =
                    address || (await BackendUtils.getNewAddress()).address;
                result = await BackendUtils.spliceOut({
                    fundingTxid,
                    amountSats,
                    address: destination
                });
            }

            runInAction(() => {
                this.spliceSuccess = true;
                this.spliceTxid = result?.funding_txid_str || null;
            });

            this.channelsStore.getChannels();
            this.balanceStore.getCombinedBalance();
        } catch (error: any) {
            if (userChannelId) this.intents.delete(userChannelId);
            const message = error?.message || String(error);
            const friendly = getSpliceErrorMessage(message);
            runInAction(() => {
                this.spliceError = friendly;
                this.spliceErrorDetail = friendly !== message ? message : null;
            });
        } finally {
            runInAction(() => {
                this.splicing = false;
            });
        }
    };
}
