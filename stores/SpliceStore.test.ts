jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getUTXOs: jest.fn(),
        getBlockchainBalance: jest.fn()
    }
}));

import SpliceStore from './SpliceStore';
import BackendUtils from '../utils/BackendUtils';

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

        const store = new SpliceStore();
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

        const store = new SpliceStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(60000);
    });

    it('treats a missing reserve as none', async () => {
        mockUtxos([{ amount_sat: 50000, confirmations: '6' }]);
        mockReserve(undefined);

        const store = new SpliceStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(50000);
    });

    it('never goes below zero when the reserve exceeds the confirmed funds', async () => {
        mockUtxos([{ amount_sat: 10000, confirmations: '6' }]);
        mockReserve('25000');

        const store = new SpliceStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toEqual(0);
    });

    it('records the error when the node call fails', async () => {
        (BackendUtils.getUTXOs as jest.Mock).mockRejectedValue(
            new Error('Node not initialized')
        );
        mockReserve('0');

        const store = new SpliceStore();
        await store.loadSpliceInAvailable();

        expect(store.spliceInAvailableSats).toBeNull();
        expect(store.spliceInAvailableError).toEqual('Node not initialized');
        expect(store.loadingSpliceInAvailable).toBe(false);
    });

    it('clears a previous result on reset', async () => {
        mockUtxos([{ amount_sat: 50000, confirmations: '6' }]);
        mockReserve('0');

        const store = new SpliceStore();
        await store.loadSpliceInAvailable();
        store.reset();

        expect(store.spliceInAvailableSats).toBeNull();
        expect(store.spliceInAvailableError).toBeNull();
    });
});
