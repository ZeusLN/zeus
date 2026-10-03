jest.mock('./Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getBlockchainBalance: jest.fn(),
        getLightningBalance: jest.fn(),
        getTransactions: jest.fn(),
        supportsOnchainBalance: jest.fn(() => true),
        supportsUnconfirmedTransactionOrigin: jest.fn(() => true)
    }
}));

import { runInAction } from 'mobx';

import BalanceStore from './BalanceStore';
import BackendUtils from '../utils/BackendUtils';

const blockchainBalance = {
    total_balance: '0',
    confirmed_balance: '0',
    unconfirmed_balance: '0'
};

describe('BalanceStore balance fetch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockBalances = () => {
        (BackendUtils.getLightningBalance as jest.Mock).mockResolvedValue({
            balance: '50000',
            pending_open_balance: '1000'
        });
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
            total_balance: '100000',
            confirmed_balance: '100000',
            unconfirmed_balance: '0'
        });
    };

    it('writes both balances in getCombinedBalance', async () => {
        mockBalances();
        const store = new BalanceStore();

        await store.getCombinedBalance();

        expect(store.lightningBalance).toEqual(50000);
        expect(store.pendingOpenBalance).toEqual(1000);
        expect(store.confirmedBlockchainBalance).toEqual(100000);
        expect(store.totalBlockchainBalance).toEqual(100000);
        expect(store.error).toBe(false);
    });

    it('sets error when the Lightning balance request fails', async () => {
        (BackendUtils.getLightningBalance as jest.Mock).mockRejectedValue(
            new Error('Request timeout')
        );
        const store = new BalanceStore();

        await store.getLightningBalance(true);

        expect(store.error).toBe(true);
        expect(store.loadingLightningBalance).toBe(false);
    });

    it('sets error when the on-chain balance request fails', async () => {
        (BackendUtils.getBlockchainBalance as jest.Mock).mockRejectedValue(
            new Error('Request timeout')
        );
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);

        expect(store.error).toBe(true);
        expect(store.loadingBlockchainBalance).toBe(false);
    });

    it('sets error in getCombinedBalance when one request fails', async () => {
        mockBalances();
        (BackendUtils.getLightningBalance as jest.Mock).mockRejectedValue(
            new Error('Request timeout')
        );
        const store = new BalanceStore();

        await store.getCombinedBalance();

        expect(store.error).toBe(true);
        expect(store.lightningBalance).toEqual(0);
        expect(store.totalBlockchainBalance).toEqual(100000);
    });
});

describe('BalanceStore cooperative close overlap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('counts an unconfirmed cooperative close once', async () => {
        // lnd reports the close as 47,151 sats of limbo and as a
        // 50,000 sat unconfirmed closing output at the same time
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
            total_balance: '150000',
            confirmed_balance: '100000',
            unconfirmed_balance: '50000'
        });
        (BackendUtils.getTransactions as jest.Mock).mockResolvedValue({
            transactions: [
                {
                    tx_hash: 'coop',
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ]
        });
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);
        store.setPendingCloseBalance(47151, [
            { closingTxid: 'coop', limboBalance: 47151 }
        ]);

        expect(store.externalUnconfirmedBalance).toEqual(50000);
        expect(store.externalUnconfirmedTxids).toEqual(['coop']);
        expect(store.cooperativeCloseOverlap).toEqual(47151);
    });

    it('keeps the limbo balance of a force close', async () => {
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue(
            blockchainBalance
        );
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);
        store.setPendingCloseBalance(47151);

        expect(BackendUtils.getTransactions).not.toHaveBeenCalled();
        expect(store.cooperativeCloseOverlap).toEqual(0);
    });
});

describe('BalanceStore force close sweep overlap', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // regtest vector from #4740: the sweep is broadcast one block before
    // maturity, while lnd still reports the 96,860 sat limbo balance
    const mockUnconfirmedSweep = () => {
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
            total_balance: '1087810',
            confirmed_balance: '991415',
            unconfirmed_balance: '96395'
        });
        (BackendUtils.getTransactions as jest.Mock).mockResolvedValue({
            transactions: [
                {
                    tx_hash: 'sweep',
                    amount: '96395',
                    total_fees: '0',
                    num_confirmations: 0,
                    previous_outpoints: [
                        { outpoint: 'commit:0', is_our_output: false }
                    ]
                }
            ]
        });
    };

    it('counts a force close with an unconfirmed sweep once', async () => {
        mockUnconfirmedSweep();
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);
        store.setPendingCloseBalance(
            96860,
            [],
            [{ txids: ['commit'], limboBalance: 96860 }]
        );

        expect(store.forceCloseSweepOverlap).toEqual(96395);
        // total + pending is 1,088,275 rather than 1,184,670: the sweep
        // output is counted once, and only the 330 sat anchor and the
        // 135 sat fee sit on top of the 1,087,810 sat wallet total until
        // the sweep confirms
        const pending =
            96860 +
            store.externalUnconfirmedBalance -
            store.forceCloseSweepOverlap;
        expect(pending).toEqual(96860);
        expect(store.settledBlockchainBalance + pending).toEqual(1088275);
    });

    it('never drops more than the cooperative close overlap leaves', async () => {
        mockUnconfirmedSweep();
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);
        store.setPendingCloseBalance(
            96860,
            [{ closingTxid: 'sweep', limboBalance: 50000 }],
            [{ txids: ['commit'], limboBalance: 96860 }]
        );

        expect(store.cooperativeCloseOverlap).toEqual(50000);
        expect(store.forceCloseSweepOverlap).toEqual(46860);
    });
});

describe('BalanceStore settled blockchain balance', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('excludes an external unconfirmed deposit', async () => {
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
            total_balance: '150000',
            confirmed_balance: '100000',
            unconfirmed_balance: '50000'
        });
        (BackendUtils.getTransactions as jest.Mock).mockResolvedValue({
            transactions: [
                {
                    tx_hash: 'deposit',
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ]
        });
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);

        expect(store.totalBlockchainBalance).toEqual(150000);
        expect(store.settledBlockchainBalance).toEqual(100000);
    });

    it('keeps unconfirmed change from our own spend', async () => {
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue({
            total_balance: '150000',
            confirmed_balance: '100000',
            unconfirmed_balance: '50000'
        });
        (BackendUtils.getTransactions as jest.Mock).mockResolvedValue({
            transactions: [
                {
                    tx_hash: 'funding',
                    amount: '-200000',
                    total_fees: '1000',
                    num_confirmations: 0
                }
            ]
        });
        const store = new BalanceStore();

        await store.getBlockchainBalance(true, false);

        expect(store.externalUnconfirmedBalance).toEqual(0);
        expect(store.settledBlockchainBalance).toEqual(150000);
    });

    it('handles a string total before any external balance is set', () => {
        const store = new BalanceStore();
        runInAction(() => {
            store.totalBlockchainBalance = '25000';
        });

        expect(store.settledBlockchainBalance).toEqual(25000);
    });
});
