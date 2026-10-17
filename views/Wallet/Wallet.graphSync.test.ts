// The payment parked by the graph sync prompt is replayed at the end of
// fetchDataCore. Like a deep link it must wait for the login.
jest.mock('../../utils/LocaleUtils');

import { sourceMethods } from '../../backends/lncTestUtils';

function setup({
    pendingPaymentData,
    authRequired
}: {
    pendingPaymentData: any;
    authRequired: () => boolean;
}) {
    const clearPendingPaymentData = jest.fn(async () => {});
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['processPendingGraphSyncPayment'],
        {
            loadPendingPaymentData: async () => pendingPaymentData,
            clearPendingPaymentData
        }
    );
    const view = new Wallet();
    const navigation = { navigate: jest.fn() };
    const InvoicesStore = { getPayReq: jest.fn(async () => {}) };
    view.props = {
        InvoicesStore,
        SettingsStore: { externalInputAuthRequired: jest.fn(authRequired) },
        navigation
    };
    return { view, navigation, InvoicesStore, clearPendingPaymentData };
}

describe('Wallet.processPendingGraphSyncPayment', () => {
    const invoice = { payment_request: 'lnbc1parked' };
    const keysend = { pubkey: '02'.padEnd(66, 'a'), amount: '1000' };

    it('opens PaymentRequest for a parked invoice when no login is required', async () => {
        const { view, navigation, InvoicesStore } = setup({
            pendingPaymentData: invoice,
            authRequired: () => false
        });

        await view.processPendingGraphSyncPayment();

        expect(InvoicesStore.getPayReq).toHaveBeenCalledWith('lnbc1parked');
        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {
            fromGraphSync: true
        });
    });

    it('does not open PaymentRequest while login is required or POS is active', async () => {
        const { view, navigation, InvoicesStore, clearPendingPaymentData } =
            setup({
                pendingPaymentData: invoice,
                authRequired: () => true
            });

        await view.processPendingGraphSyncPayment();

        expect(InvoicesStore.getPayReq).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
        expect(clearPendingPaymentData).not.toHaveBeenCalled();
    });

    it('does not open PaymentRequest when the session locks while the invoice is decoded', async () => {
        let locked = false;
        const { view, navigation, InvoicesStore } = setup({
            pendingPaymentData: invoice,
            authRequired: () => locked
        });
        InvoicesStore.getPayReq.mockImplementation(async () => {
            locked = true;
        });

        await view.processPendingGraphSyncPayment();

        expect(InvoicesStore.getPayReq).toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('does not open Send for a parked keysend while login is required', async () => {
        const { view, navigation } = setup({
            pendingPaymentData: keysend,
            authRequired: () => true
        });

        await view.processPendingGraphSyncPayment();

        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('opens Send for a parked keysend when no login is required', async () => {
        const { view, navigation } = setup({
            pendingPaymentData: keysend,
            authRequired: () => false
        });

        await view.processPendingGraphSyncPayment();

        expect(navigation.navigate).toHaveBeenCalledWith('Send', {
            destination: keysend.pubkey,
            satAmount: '1000',
            transactionType: 'Keysend',
            fromGraphSync: true
        });
    });
});
