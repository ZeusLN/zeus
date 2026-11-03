jest.mock('../utils/LocaleUtils');
jest.mock('../utils/BackendUtils', () => ({
    supportsOnchainSends: () => true,
    supportsCashuWallet: () => false
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(async () => false), setItem: jest.fn() }
}));
// ActivityStore's store imports pull in native modules; only their types
// are used here
jest.mock('./SettingsStore', () => ({}));
jest.mock('./PaymentsStore', () => ({}));
jest.mock('./InvoicesStore', () => ({}));
jest.mock('./TransactionsStore', () => ({}));
jest.mock('./CashuStore', () => ({}));
jest.mock('./SwapStore', () => ({}));
jest.mock('./SpliceStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./LSPStore', () => ({ LSPS_ORDERS_KEY: 'lsps' }));
jest.mock('./Stores', () => ({ notesStore: { notes: {} } }));

import ActivityStore from './ActivityStore';
import Splice from '../models/Splice';
import Transaction from '../models/Transaction';

const spliceRecord = {
    userChannelId: 'user-chan',
    channelId: 'chan',
    txid: 'splice-txid',
    initiator: 'local',
    direction: 'in',
    amountSats: 100000,
    startedAt: 2_000_000,
    status: 'pending'
};

const activityWith = (transactions: Transaction[], splices: any[]) =>
    new ActivityStore(
        { settings: {} } as any,
        { payments: [] } as any,
        { invoices: [] } as any,
        { transactions } as any,
        {} as any,
        { swaps: [] } as any,
        { splices } as any,
        { nodeInfo: { nodeId: '03me' } } as any
    ).getSortedActivity();

describe('ActivityStore splices', () => {
    it('lists each splice as its own row', async () => {
        const activity = await activityWith([], [spliceRecord]);

        expect(activity).toHaveLength(1);
        expect(activity[0]).toBeInstanceOf(Splice);
        expect(activity[0].getAmount).toEqual(100000);
    });

    it("hides the on-chain transaction a splice's row stands for", async () => {
        const activity = await activityWith(
            [
                new Transaction({
                    tx_hash: 'splice-txid',
                    amount: -100250,
                    time_stamp: '2000'
                }),
                new Transaction({
                    tx_hash: 'payment-txid',
                    amount: -5000,
                    time_stamp: '1000'
                })
            ],
            [spliceRecord]
        );

        expect(activity).toHaveLength(2);
        expect(activity[0]).toBeInstanceOf(Splice);
        expect(activity[1]).toBeInstanceOf(Transaction);
        expect((activity[1] as Transaction).tx).toEqual('payment-txid');
    });

    it('sorts splices in with everything else by time', async () => {
        const activity = await activityWith(
            [
                new Transaction({
                    tx_hash: 'later',
                    amount: 1,
                    time_stamp: '3000'
                })
            ],
            [spliceRecord]
        );

        expect(activity.map((item: any) => item.model)).toEqual([
            'general.transaction',
            'Splice'
        ]);
    });
});
