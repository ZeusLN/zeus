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
        spliceOut: jest.fn()
    }
}));

import SpliceStore from './SpliceStore';
import BackendUtils from '../utils/BackendUtils';

const channelsStore = { getChannels: jest.fn() };
const balanceStore = { getCombinedBalance: jest.fn() };

const newStore = () =>
    new SpliceStore(channelsStore as any, balanceStore as any);

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
