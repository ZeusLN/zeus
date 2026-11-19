// A payment that waited for the express graph sync is reopened once the
// wallet has loaded. Runs the production Wallet method without mounting the
// view.
import { sourceMethods } from '../../backends/lncTestUtils';

const setup = (loadPendingPaymentData: jest.Mock) => {
    const clearPendingPaymentData = jest.fn(async () => {});
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['processPendingGraphSyncPayment'],
        { loadPendingPaymentData, clearPendingPaymentData }
    );
    const view = new Wallet();
    const navigate = jest.fn();
    view.props = { navigation: { navigate } };
    return { view, navigate, clearPendingPaymentData };
};

describe('Wallet pending graph sync payment', () => {
    afterEach(() => jest.restoreAllMocks());

    // PaymentRequest decodes the request in its route params itself
    it('opens PaymentRequest with the pending payment request', async () => {
        const { view, navigate, clearPendingPaymentData } = setup(
            jest.fn(async () => ({ payment_request: 'lnbc1pending' }))
        );

        await view.processPendingGraphSyncPayment();

        expect(navigate).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith('PaymentRequest', {
            paymentRequest: 'lnbc1pending',
            fromGraphSync: true
        });
        // PaymentRequest clears the pending data when it opens
        expect(clearPendingPaymentData).not.toHaveBeenCalled();
    });

    it('opens Send for a pending keysend', async () => {
        const { view, navigate } = setup(
            jest.fn(async () => ({ pubkey: '02abc', amount: '1500' }))
        );

        await view.processPendingGraphSyncPayment();

        expect(navigate).toHaveBeenCalledWith('Send', {
            destination: '02abc',
            satAmount: '1500',
            transactionType: 'Keysend',
            fromGraphSync: true
        });
    });

    it('clears pending data that names no destination', async () => {
        const { view, navigate, clearPendingPaymentData } = setup(
            jest.fn(async () => ({ amount: '1500' }))
        );

        await view.processPendingGraphSyncPayment();

        expect(clearPendingPaymentData).toHaveBeenCalledTimes(1);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('opens nothing when no payment is pending', async () => {
        const { view, navigate, clearPendingPaymentData } = setup(
            jest.fn(async () => null)
        );

        await view.processPendingGraphSyncPayment();

        expect(navigate).not.toHaveBeenCalled();
        expect(clearPendingPaymentData).not.toHaveBeenCalled();
    });

    it('opens nothing when the pending data cannot be read', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const { view, navigate } = setup(
            jest.fn(async () => {
                throw new Error('storage unavailable');
            })
        );

        await view.processPendingGraphSyncPayment();

        expect(navigate).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });
});
