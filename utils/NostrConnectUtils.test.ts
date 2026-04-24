jest.mock('bolt11', () => ({ decode: jest.fn() }));
jest.mock('@noble/hashes/sha256', () => ({ sha256: jest.fn() }));
jest.mock('@noble/hashes/utils', () => ({
    bytesToHex: jest.fn(),
    utf8ToBytes: jest.fn()
}));
jest.mock('../models/NWCConnection', () => ({
    __esModule: true,
    BudgetRenewalType: {},
    PermissionType: {},
    TimeUnit: {}
}));
jest.mock('../models/Invoice', () => ({
    __esModule: true,
    default: class Invoice {}
}));
jest.mock('../models/Payment', () => ({
    __esModule: true,
    default: class Payment {}
}));
jest.mock('../models/CashuPayment', () => ({
    __esModule: true,
    default: class CashuPayment {}
}));
jest.mock('../models/CashuInvoice', () => ({
    __esModule: true,
    default: class CashuInvoice {}
}));
jest.mock('../models/CashuToken', () => ({
    __esModule: true,
    default: class CashuToken {}
}));
jest.mock('../models/Transaction', () => ({
    __esModule: true,
    default: class Transaction {}
}));
jest.mock('./LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('./DateTimeUtils', () => ({
    __esModule: true,
    default: {
        getCurrentTimestamp: jest.fn(() => 1700000000)
    }
}));
jest.mock('./BackendUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('./AmountUtils', () => ({
    millisatsToSats: jest.fn((amount: number) => Math.floor(amount / 1000)),
    satsToMillisats: jest.fn((amount: number) => amount * 1000)
}));

import NostrConnectUtils from './NostrConnectUtils';

describe('NostrConnectUtils msat handling', () => {
    it('prefers msatAmount when exporting connection activity', () => {
        const transaction = NostrConnectUtils.convertConnectionActivityToNip47Transaction(
            {
                id: 'activity-1',
                type: 'make_invoice',
                status: 'pending',
                paymentHash: 'payment-hash',
                satAmount: 1,
                msatAmount: 1500,
                invoice: {
                    getPaymentRequest: 'lnbc1exact',
                    getMemo: 'exact msat invoice'
                }
            } as any
        );

        expect(transaction).toMatchObject({
            type: 'incoming',
            state: 'pending',
            invoice: 'lnbc1exact',
            payment_hash: 'payment-hash',
            amount: 1500,
            description: 'exact msat invoice'
        });
    });

    describe('convertLightningDataToNip47Transactions', () => {
        it('omits payments without a real payment_hash (no synthetic fabrication)', () => {
            const transactions =
                NostrConnectUtils.convertLightningDataToNip47Transactions({
                    payments: [
                        {
                            getAmount: 100,
                            getTimestamp: 1700000000,
                            getPaymentRequest: 'lnbc1decodedinvoice',
                            paymentHash: '',
                            getFee: 0,
                            getMemo: '',
                            getPreimage: 'preimage-only',
                            isFailed: false,
                            isIncomplete: false
                        } as any
                    ]
                });

            expect(transactions).toEqual([]);
        });

        it('omits invoices without a real payment_hash (no synthetic fabrication)', () => {
            const transactions =
                NostrConnectUtils.convertLightningDataToNip47Transactions({
                    invoices: [
                        {
                            getAmount: 100,
                            getTimestamp: 1700000000,
                            getPaymentRequest: 'lnbc1decodedinvoice',
                            payment_hash: '',
                            getMemo: '',
                            expires_at: 0,
                            isPaid: false
                        } as any
                    ]
                });

            expect(transactions).toEqual([]);
        });

        it('keeps payments that carry a real payment_hash', () => {
            const transactions =
                NostrConnectUtils.convertLightningDataToNip47Transactions({
                    payments: [
                        {
                            getAmount: 100,
                            getTimestamp: 1700000000,
                            getPaymentRequest: 'lnbc1real',
                            paymentHash: 'a'.repeat(64),
                            getFee: 1,
                            getMemo: 'memo',
                            getPreimage: 'preimage',
                            isFailed: false,
                            isIncomplete: false
                        } as any
                    ]
                });

            expect(transactions).toHaveLength(1);
            expect(transactions[0].payment_hash).toBe('a'.repeat(64));
            expect(transactions[0].state).toBe('settled');
        });

        it('does not synthesize a hash from connection activity invoice data', () => {
            const transaction =
                NostrConnectUtils.convertConnectionActivityToNip47Transaction(
                    {
                        id: 'activity-1',
                        type: 'make_invoice',
                        status: 'success',
                        paymentHash: '',
                        satAmount: 1,
                        msatAmount: 1000,
                        invoice: {
                            getPaymentRequest: 'lnbc1decodedinvoice',
                            getMemo: 'memo',
                            payment_hash: ''
                        }
                    } as any
                );

            expect(transaction.payment_hash).toBe('');
        });
    });
});
