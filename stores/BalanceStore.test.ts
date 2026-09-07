// Regression coverage for issue #4593: the error flag raised by a failed
// balance fetch was only ever cleared by reset(), which runs solely on
// reconnect (Wallet.tsx fetchData under `connecting`). One request timing
// out, e.g. over a VPN tunnel that was still establishing, kept the
// full-screen "Error connecting to your node" pane up even after later
// fetches succeeded. A successful fetch must clear the flag.

jest.mock('../utils/BackendUtils', () => ({
    getBlockchainBalance: jest.fn(),
    getLightningBalance: jest.fn(),
    supportsOnchainBalance: jest.fn().mockReturnValue(true)
}));

import BalanceStore from './BalanceStore';

const BackendUtilsMock: any = jest.requireMock('../utils/BackendUtils');

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
