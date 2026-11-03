jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getUTXOs: jest.fn(),
        getBlockchainBalance: jest.fn(),
        getNewAddress: jest.fn(),
        spliceIn: jest.fn(),
        spliceOut: jest.fn(),
        watchSpliceEvents: jest.fn()
    }
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));

import { extendObservable } from 'mobx';

import SpliceStore from './SpliceStore';
import Storage from '../storage';
import BackendUtils from '../utils/BackendUtils';

// Observable, so the store's reconcile reacts to channel refreshes
const channelsStore: any = { getChannels: jest.fn() };
extendObservable(channelsStore, { channels: [], hasChannelData: false });
const balanceStore = { getCombinedBalance: jest.fn() };
const nodeInfoStore: any = { nodeInfo: { nodeId: '03me' } };

const newStore = () =>
    new SpliceStore(
        channelsStore as any,
        balanceStore as any,
        nodeInfoStore as any
    );

const mockUtxos = (
    utxos: Array<{ amount_sat: number; confirmations: string }>
) => (BackendUtils.getUTXOs as jest.Mock).mockResolvedValue({ utxos });

const mockReserve = (reserve?: string) =>
    (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
        confirmed_balance: '0',
        reserved_balance_anchor_chan: reserve
    });

describe('SpliceStore.loadSpliceInAvailable', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sums confirmed UTXOs and keeps the anchor reserve out', async () => {
        mockUtxos([
            { amount_sat: 60000, confirmations: '3' },
            { amount_sat: 40000, confirmations: '1' }
        ]);
        mockReserve('25000');

        const store = newStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(75000);
        expect(store.loadingSpliceInAvailable).toBe(false);
        expect(store.spliceInAvailableError).toBeNull();
    });

    it('leaves unconfirmed UTXOs out', async () => {
        mockUtxos([
            { amount_sat: 60000, confirmations: '2' },
            { amount_sat: 40000, confirmations: '0' }
        ]);
        mockReserve('0');

        const store = newStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(60000);
    });

    it('treats a missing reserve as none', async () => {
        mockUtxos([{ amount_sat: 50000, confirmations: '6' }]);
        mockReserve(undefined);

        const store = newStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(50000);
    });

    it('never goes below zero when the reserve exceeds the confirmed funds', async () => {
        mockUtxos([{ amount_sat: 10000, confirmations: '6' }]);
        mockReserve('25000');

        const store = newStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(0);
    });

    it('records the error when the node call fails', async () => {
        (BackendUtils.getUTXOs as jest.Mock).mockRejectedValue(
            new Error('Node not initialized')
        );
        mockReserve('0');

        const store = newStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toBeNull();
        expect(store.spliceInAvailableError).toEqual('Node not initialized');
        expect(store.loadingSpliceInAvailable).toBe(false);
    });

    it('clears a previous result on reset', async () => {
        mockUtxos([{ amount_sat: 50000, confirmations: '6' }]);
        mockReserve('0');

        const store = newStore();
        await store.loadSpliceInAvailable();
        store.reset();

        expect(store.spliceInAvailableSats).toBeNull();
        expect(store.spliceInAvailableError).toBeNull();
    });
});

describe('SpliceStore.splice', () => {
    const FUNDING_TXID = 'aa'.repeat(32);
    const NEW_FUNDING_TXID = 'bb'.repeat(32);

    beforeEach(() => jest.clearAllMocks());

    it('splices in and reports the new funding transaction', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockResolvedValue({
            success: true,
            funding_txid_str: NEW_FUNDING_TXID,
            output_index: 1
        });

        const store = newStore();
        await store.splice({
            direction: 'in',
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });

        expect(BackendUtils.spliceIn).toHaveBeenCalledWith({
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });
        expect(store.spliceSuccess).toBe(true);
        expect(store.spliceTxid).toEqual(NEW_FUNDING_TXID);
        expect(store.spliceError).toBeNull();
        expect(store.splicing).toBe(false);
        expect(channelsStore.getChannels).toHaveBeenCalled();
        expect(balanceStore.getCombinedBalance).toHaveBeenCalled();
    });

    it('reports success without a txid when the backend stopped waiting', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockResolvedValue({
            success: true
        });

        const store = newStore();
        await store.splice({
            direction: 'in',
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });

        expect(store.spliceSuccess).toBe(true);
        expect(store.spliceTxid).toBeNull();
    });

    it('splices out to a fresh wallet address when none is given', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockResolvedValue({
            address: 'tb1qwallet'
        });
        (BackendUtils.spliceOut as jest.Mock).mockResolvedValue({
            success: true,
            funding_txid_str: NEW_FUNDING_TXID
        });

        const store = newStore();
        await store.splice({
            direction: 'out',
            fundingTxid: FUNDING_TXID,
            amountSats: 30000
        });

        expect(BackendUtils.spliceOut).toHaveBeenCalledWith({
            fundingTxid: FUNDING_TXID,
            amountSats: 30000,
            address: 'tb1qwallet'
        });
        expect(store.spliceSuccess).toBe(true);
    });

    it('splices out to the given address without fetching one', async () => {
        (BackendUtils.spliceOut as jest.Mock).mockResolvedValue({
            success: true
        });

        const store = newStore();
        await store.splice({
            direction: 'out',
            fundingTxid: FUNDING_TXID,
            amountSats: 30000,
            address: 'tb1qexternal'
        });

        expect(BackendUtils.getNewAddress).not.toHaveBeenCalled();
        expect(BackendUtils.spliceOut).toHaveBeenCalledWith({
            fundingTxid: FUNDING_TXID,
            amountSats: 30000,
            address: 'tb1qexternal'
        });
    });

    it('explains a node error and keeps the raw message as detail', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockRejectedValue(
            new Error('Failed to splice channel.')
        );

        const store = newStore();
        await store.splice({
            direction: 'in',
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });

        expect(store.spliceSuccess).toBe(false);
        expect(store.spliceError).toEqual('views.Splice.error.spliceRefused');
        expect(store.spliceErrorDetail).toEqual('Failed to splice channel.');
        expect(store.splicing).toBe(false);
        expect(channelsStore.getChannels).not.toHaveBeenCalled();
    });

    it('shows an unknown error as-is, without a duplicate detail', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockRejectedValue(
            new Error('Splice failed')
        );

        const store = newStore();
        await store.splice({
            direction: 'in',
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });

        expect(store.spliceError).toEqual('Splice failed');
        expect(store.spliceErrorDetail).toBeNull();
    });

    it('fails without splicing when no wallet address can be fetched', async () => {
        (BackendUtils.getNewAddress as jest.Mock).mockRejectedValue(
            new Error('Node not initialized')
        );

        const store = newStore();
        await store.splice({
            direction: 'out',
            fundingTxid: FUNDING_TXID,
            amountSats: 30000
        });

        expect(BackendUtils.spliceOut).not.toHaveBeenCalled();
        expect(store.spliceError).toEqual('Node not initialized');
        expect(store.spliceSuccess).toBe(false);
    });

    it('is splicing while the request is in flight', async () => {
        let resolve: (value: any) => void = () => {};
        (BackendUtils.spliceIn as jest.Mock).mockReturnValue(
            new Promise((r) => (resolve = r))
        );

        const store = newStore();
        const pending = store.splice({
            direction: 'in',
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        });

        expect(store.splicing).toBe(true);
        resolve({ success: true });
        await pending;
        expect(store.splicing).toBe(false);
    });

    it('clears the previous result when a new splice starts', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockRejectedValueOnce(
            new Error('Failed to splice channel.')
        );
        (BackendUtils.spliceIn as jest.Mock).mockResolvedValueOnce({
            success: true,
            funding_txid_str: NEW_FUNDING_TXID
        });

        const store = newStore();
        const request = {
            direction: 'in' as const,
            fundingTxid: FUNDING_TXID,
            amountSats: 50000
        };
        await store.splice(request);
        expect(store.spliceError).not.toBeNull();

        await store.splice(request);
        expect(store.spliceError).toBeNull();
        expect(store.spliceErrorDetail).toBeNull();
        expect(store.spliceSuccess).toBe(true);
    });
});

describe('SpliceStore splice tracking', () => {
    let emit: (event: any) => void;
    const unsubscribe = jest.fn();

    const channel = {
        channel_point: 'funding-txid:0',
        user_channel_id: 'user-chan'
    };
    const pendingEvent = {
        type: 'splicePending',
        userChannelId: 'user-chan',
        channelId: 'chan',
        txid: 'splice-txid',
        vout: 1
    };

    const trackingStore = async () => {
        const store = newStore();
        await store.trackSplices();
        return store;
    };

    const mockStored = (splices: any[] | false) =>
        (Storage.getItem as jest.Mock).mockResolvedValue(
            splices && JSON.stringify(splices)
        );
    const lastSaved = () => {
        const calls = (Storage.setItem as jest.Mock).mock.calls;
        return calls[calls.length - 1][1];
    };
    const flushSaves = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
        jest.clearAllMocks();
        channelsStore.channels = [channel];
        channelsStore.hasChannelData = false;
        nodeInfoStore.nodeInfo = { nodeId: '03me' };
        mockStored(false);
        (BackendUtils.watchSpliceEvents as jest.Mock).mockImplementation(
            (callback: any) => {
                emit = callback;
                return unsubscribe;
            }
        );
    });

    it('starts once however often it is asked to track', async () => {
        const store = newStore();
        await Promise.all([store.trackSplices(), store.trackSplices()]);
        await store.trackSplices();

        expect(BackendUtils.watchSpliceEvents).toHaveBeenCalledTimes(1);
    });

    it('does nothing on a backend without splice events', async () => {
        (BackendUtils.watchSpliceEvents as jest.Mock).mockReturnValue(false);
        const store = await trackingStore();
        store.stopTracking();
        await store.trackSplices();

        expect(BackendUtils.watchSpliceEvents).toHaveBeenCalledTimes(2);
    });

    it('records a splice the peer started and refreshes channels', async () => {
        const store = await trackingStore();

        emit(pendingEvent);

        expect(store.pendingSplices).toEqual([
            expect.objectContaining({
                userChannelId: 'user-chan',
                channelId: 'chan',
                txid: 'splice-txid',
                vout: 1,
                initiator: 'remote'
            })
        ]);
        expect(store.pendingSplices[0].direction).toBeUndefined();
        expect(channelsStore.getChannels).toHaveBeenCalledTimes(1);
        expect(balanceStore.getCombinedBalance).toHaveBeenCalledTimes(1);
    });

    it('records our own splice with what we asked for, even after the call timed out', async () => {
        (BackendUtils.spliceOut as jest.Mock).mockResolvedValue({
            success: true
        });
        const store = await trackingStore();

        await store.splice({
            direction: 'out',
            fundingTxid: 'funding-txid',
            amountSats: 30000,
            address: 'bc1qdest'
        });
        emit(pendingEvent);

        expect(store.pendingSplices[0]).toEqual(
            expect.objectContaining({
                initiator: 'local',
                direction: 'out',
                amountSats: 30000,
                address: 'bc1qdest'
            })
        );
    });

    it('forgets what we asked for when the node refuses the splice', async () => {
        (BackendUtils.spliceIn as jest.Mock).mockRejectedValue(
            new Error('Failed to splice channel.')
        );
        const store = await trackingStore();

        await store.splice({
            direction: 'in',
            fundingTxid: 'funding-txid',
            amountSats: 50000
        });
        emit(pendingEvent);

        expect(store.pendingSplices[0].initiator).toEqual('remote');
    });

    it.each(['channelReady', 'spliceFailed', 'channelClosed'])(
        'clears the splice on %s and refreshes channels',
        async (type) => {
            const store = await trackingStore();
            emit(pendingEvent);
            jest.clearAllMocks();

            emit({ type, userChannelId: 'user-chan', channelId: 'chan' });

            expect(store.pendingSplices).toEqual([]);
            expect(channelsStore.getChannels).toHaveBeenCalledTimes(1);
            expect(balanceStore.getCombinedBalance).toHaveBeenCalledTimes(1);
        }
    );

    it('ignores channelReady for a channel with no splice, such as a new channel', async () => {
        const store = await trackingStore();

        emit({
            type: 'channelReady',
            userChannelId: 'other',
            channelId: 'other'
        });

        expect(store.pendingSplices).toEqual([]);
        expect(channelsStore.getChannels).not.toHaveBeenCalled();
    });

    it('keeps one splice per channel', async () => {
        const store = await trackingStore();

        emit(pendingEvent);
        emit({ ...pendingEvent, txid: 'later-txid' });

        expect(store.pendingSplices).toHaveLength(1);
        expect(store.pendingSplices[0].txid).toEqual('later-txid');
    });

    it('stops listening and forgets splices when tracking stops', async () => {
        const store = await trackingStore();
        emit(pendingEvent);

        store.stopTracking();

        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(store.pendingSplices).toEqual([]);
    });

    it('keeps tracked splices when the splice form resets', async () => {
        const store = await trackingStore();
        emit(pendingEvent);

        store.reset();

        expect(store.pendingSplices).toHaveLength(1);
    });

    it('finds the pending splice of a channel', async () => {
        const store = await trackingStore();
        emit(pendingEvent);

        expect(store.getPendingSplice(channel as any)?.txid).toEqual(
            'splice-txid'
        );
        expect(
            store.getPendingSplice({ user_channel_id: 'other' } as any)
        ).toBeNull();
        // other backends' channels have no user_channel_id
        expect(store.getPendingSplice({} as any)).toBeNull();
    });

    it('remembers a splice that failed after the splice screens were left', async () => {
        const store = await trackingStore();
        emit(pendingEvent);

        emit({
            type: 'spliceFailed',
            userChannelId: 'user-chan',
            channelId: 'chan'
        });

        expect(store.hasFailedSplice(channel as any)).toBe(true);
        expect(store.hasFailedSplice({ user_channel_id: 'other' } as any)).toBe(
            false
        );
    });

    it('forgets the failure once a new splice is negotiated', async () => {
        const store = await trackingStore();
        emit(pendingEvent);
        emit({
            type: 'spliceFailed',
            userChannelId: 'user-chan',
            channelId: 'chan'
        });

        emit(pendingEvent);

        expect(store.hasFailedSplice(channel as any)).toBe(false);
    });

    it('does not report a closed channel as a failed splice', async () => {
        const store = await trackingStore();
        emit(pendingEvent);

        emit({
            type: 'channelClosed',
            userChannelId: 'user-chan',
            channelId: 'chan'
        });

        expect(store.hasFailedSplice(channel as any)).toBe(false);
    });

    it('forgets failures when tracking stops', async () => {
        const store = await trackingStore();
        emit(pendingEvent);
        emit({
            type: 'spliceFailed',
            userChannelId: 'user-chan',
            channelId: 'chan'
        });

        store.stopTracking();

        expect(store.hasFailedSplice(channel as any)).toBe(false);
    });

    describe('the Splicing screen after the node stopped waiting', () => {
        const requestSplice = async (result: any = { success: true }) => {
            (BackendUtils.spliceIn as jest.Mock).mockResolvedValue(result);
            const store = await trackingStore();
            await store.splice({
                direction: 'in',
                fundingTxid: 'funding-txid',
                amountSats: 50000
            });
            return store;
        };

        it('shows the transaction once the peer agrees', async () => {
            const store = await requestSplice();
            expect(store.spliceTxid).toBeNull();

            emit(pendingEvent);

            expect(store.spliceSuccess).toBe(true);
            expect(store.spliceTxid).toEqual('splice-txid');
        });

        it('shows the failure if the splice falls through', async () => {
            const store = await requestSplice();

            emit({
                type: 'spliceFailed',
                userChannelId: 'user-chan',
                channelId: 'chan'
            });

            expect(store.spliceSuccess).toBe(false);
            expect(store.spliceError).toEqual('views.Splice.failedLate');
        });

        it('leaves a splice that was already broadcast alone', async () => {
            const store = await requestSplice({
                success: true,
                funding_txid_str: 'splice-txid'
            });

            emit({
                type: 'spliceFailed',
                userChannelId: 'user-chan',
                channelId: 'chan'
            });

            expect(store.spliceSuccess).toBe(true);
            expect(store.spliceError).toBeNull();
        });

        it("ignores another channel's splice", async () => {
            const store = await requestSplice();

            emit({ ...pendingEvent, userChannelId: 'other' });
            emit({
                type: 'spliceFailed',
                userChannelId: 'other',
                channelId: 'other'
            });

            expect(store.spliceTxid).toBeNull();
            expect(store.spliceError).toBeNull();
        });

        it('stops following once the screen resets', async () => {
            const store = await requestSplice();

            store.reset();
            emit(pendingEvent);

            expect(store.spliceTxid).toBeNull();
        });
    });

    describe('across restarts', () => {
        const stored = (overrides: any = {}) => ({
            userChannelId: 'user-chan',
            channelId: 'chan',
            txid: 'splice-txid',
            initiator: 'local',
            direction: 'in',
            amountSats: 50000,
            startedAt: 1,
            nodePubkey: '03me',
            ...overrides
        });

        it("loads this wallet's saved splices and not another wallet's", async () => {
            mockStored([
                stored(),
                stored({ userChannelId: 'theirs', nodePubkey: '02other' })
            ]);

            const store = await trackingStore();

            expect(store.pendingSplices).toEqual([
                expect.objectContaining({
                    userChannelId: 'user-chan',
                    direction: 'in',
                    amountSats: 50000
                })
            ]);
            expect(store.pendingSplices[0]).not.toHaveProperty('nodePubkey');
        });

        it("saves a new splice next to other wallets' splices", async () => {
            const theirs = stored({
                userChannelId: 'theirs',
                nodePubkey: '02other'
            });
            mockStored([theirs]);
            await trackingStore();

            emit(pendingEvent);
            await flushSaves();

            expect(Storage.setItem).toHaveBeenCalledWith(
                'zeus-splices',
                expect.any(Array)
            );
            expect(lastSaved()).toEqual([
                theirs,
                expect.objectContaining({
                    userChannelId: 'user-chan',
                    txid: 'splice-txid',
                    nodePubkey: '03me'
                })
            ]);
        });

        it('saves the list without a splice once it locks', async () => {
            await trackingStore();
            emit(pendingEvent);
            emit({
                type: 'channelReady',
                userChannelId: 'user-chan',
                channelId: 'chan'
            });
            await flushSaves();

            expect(lastSaved()).toEqual([]);
        });

        it('drops a splice that locked while the app was closed', async () => {
            mockStored([stored()]);
            const store = await trackingStore();
            expect(store.pendingSplices).toHaveLength(1);

            channelsStore.channels = [
                { ...channel, channel_point: 'splice-txid:1' }
            ];
            channelsStore.hasChannelData = true;
            await flushSaves();

            expect(store.pendingSplices).toEqual([]);
            expect(lastSaved()).toEqual([]);
        });

        it('drops a splice whose channel is no longer open', async () => {
            mockStored([stored()]);
            channelsStore.channels = [];
            channelsStore.hasChannelData = true;

            const store = await trackingStore();

            expect(store.pendingSplices).toEqual([]);
        });

        it('keeps a splice that is still waiting to confirm', async () => {
            mockStored([stored()]);
            channelsStore.hasChannelData = true;

            const store = await trackingStore();

            expect(store.pendingSplices).toHaveLength(1);
            expect(Storage.setItem).not.toHaveBeenCalled();
        });

        it('keeps splices while the channel list is empty because it has not loaded', async () => {
            mockStored([stored()]);
            channelsStore.channels = [];

            const store = await trackingStore();

            expect(store.pendingSplices).toHaveLength(1);
        });

        it('does not subscribe for a wallet that was switched away while loading', async () => {
            let finishLoad: (value: any) => void = () => {};
            (Storage.getItem as jest.Mock).mockReturnValue(
                new Promise((resolve) => (finishLoad = resolve))
            );
            const store = newStore();

            const tracking = store.trackSplices();
            store.stopTracking();
            finishLoad(JSON.stringify([stored()]));
            await tracking;

            expect(BackendUtils.watchSpliceEvents).not.toHaveBeenCalled();
            expect(store.pendingSplices).toEqual([]);
        });

        it('keeps splices in memory only when the node pubkey is unknown', async () => {
            nodeInfoStore.nodeInfo = {};
            const store = await trackingStore();

            emit(pendingEvent);
            await flushSaves();

            expect(store.pendingSplices).toHaveLength(1);
            expect(Storage.getItem).not.toHaveBeenCalled();
            expect(Storage.setItem).not.toHaveBeenCalled();
        });
    });
});
