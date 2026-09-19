jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../ldknode/LdkNodeInjection', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getBlockchainBalance: jest.fn(),
        getLightningBalance: jest.fn(),
        supportsOnchainBalance: jest.fn(() => true)
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
