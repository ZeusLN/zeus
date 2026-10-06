const mockListPayments = jest.fn();
const mockSendBolt11 = jest.fn();
const mockSendSpontaneousPayment = jest.fn();
const mockBolt12SendUsingAmount = jest.fn();

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        payments: {
            listPayments: (...args: any[]) => mockListPayments(...args)
        },
        bolt11: {
            sendBolt11: (...args: any[]) => mockSendBolt11(...args)
        },
        spontaneous: {
            sendSpontaneousPayment: (...args: any[]) =>
                mockSendSpontaneousPayment(...args)
        },
        bolt12: {
            bolt12SendUsingAmount: (...args: any[]) =>
                mockBolt12SendUsingAmount(...args)
        }
    }
}));

jest.mock('../stores/Stores', () => ({
    settingsStore: {}
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import LdkNode from './LdkNode';
import Payment from '../models/Payment';

const PAYMENT_ID = 'payment-id';

const succeededPayment = (feePaidMsat?: number) => ({
    id: PAYMENT_ID,
    status: 'succeeded',
    amountMsat: 5_000_000,
    feePaidMsat,
    latestUpdateTimestamp: 0,
    kind: { hash: 'hash', preimage: 'preimage' }
});

describe('LdkNode payment results', () => {
    let ldk: LdkNode;

    beforeEach(() => {
        jest.clearAllMocks();
        ldk = new LdkNode();
        // Keep the native event loop out of the test
        ldk.subscribeToEvents = () => () => {};
        mockSendBolt11.mockResolvedValue(PAYMENT_ID);
        mockSendSpontaneousPayment.mockResolvedValue(PAYMENT_ID);
        mockBolt12SendUsingAmount.mockResolvedValue(PAYMENT_ID);
    });

    const payBolt11 = () =>
        ldk.payLightningInvoice({ payment_request: 'lnbcrt1...' });
    const payKeysend = () => ldk.sendKeysend({ pubkey: '02abc', amt: '5000' });
    const payOffer = () => ldk.fetchInvoiceFromOffer('lno1...', '5000');

    describe.each([
        ['payLightningInvoice', payBolt11],
        ['sendKeysend', payKeysend],
        ['fetchInvoiceFromOffer', payOffer]
    ])('%s', (_name, pay) => {
        it('returns the fee LDK paid', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(25_000)]);

            const result = await pay();

            expect(result.payment_hash).toEqual('hash');
            expect(result.payment_preimage).toEqual('preimage');
            expect(result.fee_msat).toEqual('25000');
            // What TransactionsStore.handlePayment shows on the success screen
            expect(new Payment(result).getFee).toEqual('25');
        });

        it('keeps a sub-sat fee', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(1_500)]);

            const result = await pay();

            expect(new Payment(result).getFee).toEqual('1.5');
        });

        it('returns a zero fee when LDK reports none', async () => {
            mockListPayments.mockResolvedValue([succeededPayment(undefined)]);

            const result = await pay();

            expect(result.fee_msat).toEqual('0');
            expect(new Payment(result).getFee).toEqual('0');
        });
    });
});
