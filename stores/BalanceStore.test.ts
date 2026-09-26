jest.mock('./Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('./SettingsStore', () => ({}));
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

import { observable, runInAction } from 'mobx';

import BalanceStore from './BalanceStore';
import BackendUtils from '../utils/BackendUtils';

const blockchainBalance = {
    total_balance: '0',
    confirmed_balance: '0',
    unconfirmed_balance: '0'
};
const lightningBalance = { balance: '0', pending_open_balance: '0' };

const newSettingsStore = (walletSelectionPending: boolean) =>
    observable({
        settings: { nodes: [{}], selectedNode: 0 } as any,
        walletSelectionPending,
        hasCredentials: () => true
    });

// Writing settings again is what startup does: getSettings() runs several
// times and assigns a freshly parsed object each time.
const rewriteSettings = (settingsStore: any) =>
    runInAction(() => {
        settingsStore.settings = { nodes: [{}], selectedNode: 0 };
    });

describe('BalanceStore settings reaction', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (BackendUtils.getBlockchainBalance as jest.Mock).mockResolvedValue(
            blockchainBalance
        );
        (BackendUtils.getLightningBalance as jest.Mock).mockResolvedValue(
            lightningBalance
        );
    });

    it('does not reach a node while the user is still choosing a wallet on startup', () => {
        const settingsStore = newSettingsStore(true);
        new BalanceStore(settingsStore as any);

        rewriteSettings(settingsStore);

        expect(BackendUtils.getBlockchainBalance).not.toHaveBeenCalled();
        expect(BackendUtils.getLightningBalance).not.toHaveBeenCalled();
    });

    it('fetches balances when no wallet selection is pending', () => {
        const settingsStore = newSettingsStore(false);
        new BalanceStore(settingsStore as any);

        rewriteSettings(settingsStore);

        expect(BackendUtils.getBlockchainBalance).toHaveBeenCalled();
        expect(BackendUtils.getLightningBalance).toHaveBeenCalled();
    });

    it('fetches again once the wallet has been picked', () => {
        const settingsStore = newSettingsStore(true);
        new BalanceStore(settingsStore as any);

        rewriteSettings(settingsStore);
        expect(BackendUtils.getLightningBalance).not.toHaveBeenCalled();

        runInAction(() => {
            settingsStore.walletSelectionPending = false;
        });
        rewriteSettings(settingsStore);

        expect(BackendUtils.getBlockchainBalance).toHaveBeenCalled();
        expect(BackendUtils.getLightningBalance).toHaveBeenCalled();
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
        const store = new BalanceStore(newSettingsStore(true) as any);

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
        const store = new BalanceStore(newSettingsStore(true) as any);

        await store.getBlockchainBalance(true, false);
        store.setPendingCloseBalance(47151);

        expect(BackendUtils.getTransactions).not.toHaveBeenCalled();
        expect(store.cooperativeCloseOverlap).toEqual(0);
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
        const store = new BalanceStore(newSettingsStore(true) as any);

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
        const store = new BalanceStore(newSettingsStore(true) as any);

        await store.getBlockchainBalance(true, false);

        expect(store.externalUnconfirmedBalance).toEqual(0);
        expect(store.settledBlockchainBalance).toEqual(150000);
    });

    it('handles a string total before any external balance is set', () => {
        const store = new BalanceStore(newSettingsStore(true) as any);
        runInAction(() => {
            store.totalBlockchainBalance = '25000';
        });

        expect(store.settledBlockchainBalance).toEqual(25000);
    });
});

// Regression coverage for issue #4593: the error flag raised by a failed
// balance fetch was only ever cleared by reset(), which runs solely on
// reconnect (Wallet.tsx fetchData under `connecting`). One request timing
// out, e.g. over a VPN tunnel that was still establishing, kept the
// full-screen "Error connecting to your node" pane up even after later
// fetches succeeded. A successful fetch must clear the flag.

const BackendUtilsMock: any = BackendUtils;

// BalanceStore only touches settingsStore.settings (via its constructor
// reaction) and hasCredentials(); a plain object keeps the reaction inert
// so the tests drive the fetch methods directly.
const newStore = () =>
    new BalanceStore({
        settings: {},
        hasCredentials: () => false
    } as any);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('BalanceStore error flag', () => {
    it('sets error when a lightning balance fetch fails', async () => {
        BackendUtilsMock.getLightningBalance.mockRejectedValueOnce(
            new Error('Request timeout')
        );
        const store = newStore();

        await store.getLightningBalance(false);

        expect(store.error).toEqual(true);
    });

    it('clears error once a lightning balance fetch succeeds again', async () => {
        BackendUtilsMock.getLightningBalance
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({ balance: 100, pending_open_balance: 0 });
        const store = newStore();

        await store.getLightningBalance(false);
        expect(store.error).toEqual(true);

        await store.getLightningBalance(true);

        expect(store.error).toEqual(false);
        expect(store.lightningBalance).toEqual(100);
    });

    it('clears error once a blockchain balance fetch succeeds again', async () => {
        BackendUtilsMock.getBlockchainBalance
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({
                confirmed_balance: 50,
                unconfirmed_balance: 0
            });
        const store = newStore();

        await store.getBlockchainBalance(false, false);
        expect(store.error).toEqual(true);

        await store.getBlockchainBalance(true, false);

        expect(store.error).toEqual(false);
        expect(store.totalBlockchainBalance).toEqual(50);
    });
});

// getCombinedBalance awaits lightning, then on-chain. A success on either
// leg proves the node is reachable, so the error flag behind the
// full-screen pane only latches when every attempted leg failed. A leg
// that failed returns undefined and must not zero its balances: with the
// pane down, a zeroed balance would render as 0 sats instead of the last
// known value.
describe('getCombinedBalance partial failures', () => {
    it('holds the last lightning balance when only that leg fails', async () => {
        BackendUtilsMock.getLightningBalance
            .mockResolvedValueOnce({
                balance: 500000,
                pending_open_balance: 100
            })
            .mockRejectedValueOnce(new Error('Request timeout'));
        BackendUtilsMock.getBlockchainBalance.mockResolvedValue({
            confirmed_balance: 50,
            unconfirmed_balance: 0
        });
        const store = newStore();

        await store.getCombinedBalance();
        expect(store.lightningBalance).toEqual(500000);
        expect(store.pendingOpenBalance).toEqual(100);

        await store.getCombinedBalance();

        expect(store.error).toEqual(false);
        expect(store.lightningBalance).toEqual(500000);
        expect(store.pendingOpenBalance).toEqual(100);
        expect(store.totalBlockchainBalance).toEqual(50);
    });

    it('holds the last on-chain balance when only that leg fails', async () => {
        BackendUtilsMock.getLightningBalance.mockResolvedValue({
            balance: 500000,
            pending_open_balance: 0
        });
        BackendUtilsMock.getBlockchainBalance
            .mockResolvedValueOnce({
                confirmed_balance: 50,
                unconfirmed_balance: 0
            })
            .mockRejectedValueOnce(new Error('Request timeout'));
        const store = newStore();

        await store.getCombinedBalance();
        expect(store.totalBlockchainBalance).toEqual(50);

        await store.getCombinedBalance();

        // the lightning leg succeeded, so the node is reachable and the
        // pane stays down even though on-chain resolved last
        expect(store.error).toEqual(false);
        expect(store.totalBlockchainBalance).toEqual(50);
        expect(store.lightningBalance).toEqual(500000);
    });

    it('raises the error when both legs fail', async () => {
        BackendUtilsMock.getLightningBalance.mockRejectedValue(
            new Error('Request timeout')
        );
        BackendUtilsMock.getBlockchainBalance.mockRejectedValue(
            new Error('Request timeout')
        );
        const store = newStore();

        await store.getCombinedBalance();

        expect(store.error).toEqual(true);
    });

    it('raises the error when the only attempted leg fails', async () => {
        BackendUtilsMock.supportsOnchainBalance.mockReturnValueOnce(false);
        BackendUtilsMock.getLightningBalance.mockRejectedValueOnce(
            new Error('Request timeout')
        );
        const store = newStore();

        await store.getCombinedBalance();

        expect(store.error).toEqual(true);
        expect(BackendUtilsMock.getBlockchainBalance).not.toHaveBeenCalled();
    });
});
