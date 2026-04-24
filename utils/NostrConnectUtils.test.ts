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
});
