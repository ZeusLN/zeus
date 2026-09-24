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
