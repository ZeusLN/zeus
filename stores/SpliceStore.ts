import {
    action,
    IReactionDisposer,
    observable,
    reaction,
    runInAction
} from 'mobx';

import BalanceStore from './BalanceStore';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';

import Channel from '../models/Channel';

import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import {
    SPLICES_KEY,
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

// One list for every wallet, like swaps, so each record names its node
interface StoredSplice extends PendingSplice {
    nodePubkey: string;
}

export default class SpliceStore {
    @observable public pendingSplices: PendingSplice[] = [];
    // Channels whose splice failed after the splice screens were left, so
    // the channel screen can say so. Not saved: a restart forgets them
    @observable public failedSpliceChannels: string[] = [];

    private intents = new Map<string, SpliceIntent>();
    private tracking = false;
    private trackingSession = 0;
    private unsubscribeSpliceEvents: (() => void) | null = null;
    private disposeReconcile: IReactionDisposer | null = null;
    private nodePubkey: string | null = null;
    private otherNodesSplices: StoredSplice[] = [];
    private saveQueue: Promise<unknown> = Promise.resolve();
    // The channel the Splicing screen is following
    private spliceUserChannelId: string | null = null;

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
    nodeInfoStore: NodeInfoStore;

    constructor(
        channelsStore: ChannelsStore,
        balanceStore: BalanceStore,
        nodeInfoStore: NodeInfoStore
    ) {
        this.channelsStore = channelsStore;
        this.balanceStore = balanceStore;
        this.nodeInfoStore = nodeInfoStore;
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
        this.spliceUserChannelId = null;
    };

    // Follows splices for the connected node, including ones the peer starts.
    // A splice keeps the channel's old funding and capacity until it locks,
    // so channels and balances are refreshed on each step. Safe to call on
    // every refresh: it only starts once until stopTracking
    public trackSplices = async () => {
        if (this.tracking) return;
        this.tracking = true;
        const session = ++this.trackingSession;
        const nodePubkey: string | null =
            this.nodeInfoStore.nodeInfo?.nodeId || null;

        // Read before subscribing, so no event saves over records that
        // haven't been loaded yet
        const stored = nodePubkey ? await this.loadStoredSplices() : [];
        if (session !== this.trackingSession) return;

        const unsubscribe = BackendUtils.watchSpliceEvents(
            this.handleSpliceEvent
        );
        if (typeof unsubscribe !== 'function') return;

        runInAction(() => {
            this.unsubscribeSpliceEvents = unsubscribe;
            this.nodePubkey = nodePubkey;
            this.otherNodesSplices = stored.filter(
                (splice) => splice.nodePubkey !== nodePubkey
            );
            this.pendingSplices = stored
                .filter((splice) => splice.nodePubkey === nodePubkey)
                .map(({ nodePubkey: _nodePubkey, ...splice }) => splice);
        });

        this.disposeReconcile = reaction(
            () => [
                this.channelsStore.hasChannelData,
                this.channelsStore.channels
            ],
            this.reconcile,
            { fireImmediately: true }
        );
    };

    @action
    public stopTracking = () => {
        this.trackingSession++;
        this.tracking = false;
        this.unsubscribeSpliceEvents?.();
        this.unsubscribeSpliceEvents = null;
        this.disposeReconcile?.();
        this.disposeReconcile = null;
        this.nodePubkey = null;
        this.otherNodesSplices = [];
        this.pendingSplices = [];
        this.failedSpliceChannels = [];
        this.intents.clear();
    };

    @action
    private handleSpliceEvent = (event: SpliceEvent) => {
        const { type, userChannelId } = event;
        const pending = this.pendingSplices.some(
            (splice) => splice.userChannelId === userChannelId
        );

        // The Splicing screen shows "requested" when the node stopped
        // waiting before the peer answered; the answer can still come
        const requested =
            userChannelId === this.spliceUserChannelId &&
            this.spliceSuccess &&
            !this.spliceTxid;
        if (requested && type === 'splicePending' && event.txid) {
            this.spliceTxid = event.txid;
        } else if (requested && type === 'spliceFailed') {
            this.spliceSuccess = false;
            this.spliceError = localeString('views.Splice.failedLate');
        }

        if (type === 'splicePending' && event.txid) {
            const intent = this.intents.get(userChannelId);
            this.intents.delete(userChannelId);
            this.failedSpliceChannels = this.failedSpliceChannels.filter(
                (id) => id !== userChannelId
            );
            this.setPendingSplices([
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
            ]);
        } else if (type === 'spliceFailed' || type === 'channelClosed') {
            const intended = this.intents.delete(userChannelId);
            if (!pending && !intended) return;
            this.removePendingSplice(userChannelId);
            if (type === 'spliceFailed') {
                this.failedSpliceChannels = [
                    ...this.failedSpliceChannels.filter(
                        (id) => id !== userChannelId
                    ),
                    userChannelId
                ];
            }
        } else if (type === 'channelReady' && pending) {
            this.removePendingSplice(userChannelId);
        } else {
            return;
        }

        this.channelsStore.getChannels();
        this.balanceStore.getCombinedBalance();
    };

    // Catches what happened while nothing was listening, such as a splice
    // that locked while the app was closed. Only a loaded channel list
    // counts: an empty one from a reset or a failed fetch proves nothing
    @action
    private reconcile = () => {
        const { hasChannelData, channels } = this.channelsStore;
        if (!hasChannelData) return;

        const remaining = this.pendingSplices.filter((splice) => {
            const channel = channels.find(
                (c) => c.user_channel_id === splice.userChannelId
            );
            // No longer open: closed or closing, so the splice is moot
            if (!channel) return false;
            // Already running on the splice transaction: it locked
            return channel.channel_point?.split(':')[0] !== splice.txid;
        });

        if (remaining.length !== this.pendingSplices.length) {
            this.setPendingSplices(remaining);
        }
    };

    public getPendingSplice = (channel: Channel): PendingSplice | null =>
        (channel.user_channel_id &&
            this.pendingSplices.find(
                (splice) => splice.userChannelId === channel.user_channel_id
            )) ||
        null;

    public hasFailedSplice = (channel: Channel): boolean =>
        !!channel.user_channel_id &&
        this.failedSpliceChannels.includes(channel.user_channel_id);

    @action
    private removePendingSplice = (userChannelId: string) => {
        this.setPendingSplices(
            this.pendingSplices.filter(
                (splice) => splice.userChannelId !== userChannelId
            )
        );
    };

    @action
    private setPendingSplices = (splices: PendingSplice[]) => {
        this.pendingSplices = splices;
        this.saveSplices();
    };

    private loadStoredSplices = async (): Promise<StoredSplice[]> => {
        try {
            const stored = await Storage.getItem(SPLICES_KEY);
            const splices = stored ? JSON.parse(stored) : [];
            return Array.isArray(splices) ? splices : [];
        } catch (error) {
            console.error('Error loading splices:', error);
            return [];
        }
    };

    // Queued so an older list can never land after a newer one
    private saveSplices = () => {
        const { nodePubkey } = this;
        if (!nodePubkey) return;
        const splices: StoredSplice[] = [
            ...this.otherNodesSplices,
            ...this.pendingSplices.map((splice) => ({ ...splice, nodePubkey }))
        ];
        this.saveQueue = this.saveQueue
            .then(() => Storage.setItem(SPLICES_KEY, splices))
            .catch((error) => console.error('Error saving splices:', error));
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
        this.spliceUserChannelId = userChannelId || null;

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
