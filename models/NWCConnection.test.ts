jest.mock('../stores/Stores', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        getReadOnlyPermissions: () => [],
        hasPaymentPermissions: () => false
    }
}));

import NWCConnection from './NWCConnection';

const baseConnection = () =>
    new NWCConnection({
        id: 'test',
        name: 'test',
        pubkey: 'abc',
        relayUrl: 'wss://relay.example.com',
        permissions: [],
        createdAt: new Date('2026-01-01T00:00:00Z'),
        totalSpendSats: 0,
        maxAmountSats: 100000,
        nodePubkey: 'def',
        implementation: 'lnd'
    } as any);

describe('NWCConnection budget accounting with pending payments', () => {
    it('counts pending pay_invoice amounts in pendingSpendSats', () => {
        const connection = baseConnection();
        connection.activity.push(
            {
                id: 'lnbc1',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'pending',
                satAmount: 40000
            },
            {
                id: 'lnbc2',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'pending',
                satAmount: 25000
            }
        );

        expect(connection.pendingSpendSats).toBe(65000);
    });

    it('ignores settled, failed, expired, and make_invoice activity', () => {
        const connection = baseConnection();
        connection.activity.push(
            {
                id: 'a',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'success',
                satAmount: 10000
            },
            {
                id: 'b',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'failed',
                satAmount: 10000
            },
            {
                id: 'c',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'expired',
                satAmount: 10000
            },
            {
                id: 'd',
                type: 'make_invoice',
                payment_source: 'lightning',
                status: 'pending',
                satAmount: 10000
            }
        );

        expect(connection.pendingSpendSats).toBe(0);
    });

    it('rejects a payment when pending amounts exhaust the budget', () => {
        const connection = baseConnection();
        // Budget 100k: a single settled 10k payment plus a pending 90k
        // hodl payment must block further spends even though only the
        // settled 10k has been debited to totalSpendSats.
        connection.trackSpending(10000);
        connection.activity.push({
            id: 'lnbc-hodl',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 90000
        });

        expect(connection.canSpend(1)).toBe(false);
        expect(connection.remainingBudget).toBe(0);
    });

    it('does not double-count once a pending payment reconciles', () => {
        const connection = baseConnection();
        connection.activity.push({
            id: 'lnbc-settling',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 60000
        });

        expect(connection.canSpend(40000)).toBe(true);
        expect(connection.canSpend(40001)).toBe(false);

        // Mirror reconcilePendingPayInvoiceActivities: flip to success
        // and debit in one step.
        connection.activity[0].status = 'success';
        connection.trackSpending(60000);

        expect(connection.pendingSpendSats).toBe(0);
        expect(connection.totalSpendSats).toBe(60000);
        expect(connection.canSpend(40000)).toBe(true);
        expect(connection.canSpend(40001)).toBe(false);
    });

    it('reproduces the C3 bypass scenario when pending is ignored', () => {
        // Pre-fix behavior: 10 x 100k-sat payments against a 100k budget
        // all passed canSpend because none were settled yet. With pending
        // counted, only the first passes.
        const connection = baseConnection();

        expect(connection.canSpend(100000)).toBe(true);
        connection.activity.push({
            id: 'lnbc-first',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100000
        });

        for (let i = 0; i < 9; i++) {
            expect(connection.canSpend(100000)).toBe(false);
        }
    });

    it('treats connections without a budget limit as unlimited', () => {
        const connection = new NWCConnection({
            id: 'nolimit',
            name: 'nolimit',
            pubkey: 'abc',
            relayUrl: 'wss://relay.example.com',
            permissions: [],
            createdAt: new Date('2026-01-01T00:00:00Z'),
            totalSpendSats: 0,
            nodePubkey: 'def',
            implementation: 'lnd'
        } as any);
        connection.activity.push({
            id: 'lnbc-pending',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 500000
        });

        expect(connection.canSpend(1000000)).toBe(true);
        expect(connection.remainingBudget).toBe(Infinity);
    });
});
