jest.mock('../stores/Stores');
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        getReadOnlyPermissions: () => [],
        hasPaymentPermissions: () => false,
        isPaymentTimedOutMessage: (message?: string | null) => {
            if (!message) return false;
            const normalized = message.toLowerCase();
            return (
                normalized.includes('timed out') ||
                message === 'views.SendingLightning.paymentTimedOut' ||
                message === 'error.paymentTimedOut'
            );
        }
    }
}));

import { autorun } from 'mobx';

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

    it('keeps budget getters consistent when pending activity exists', () => {
        // Budget 100k: 10k settled + 90k pending. Every budget-facing
        // value must agree that the budget is exhausted, not just
        // remainingBudget/canSpend.
        const connection = baseConnection();
        connection.trackSpending(10000);
        connection.activity.push({
            id: 'lnbc-hodl',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 90000
        });

        expect(connection.effectiveSpendSats).toBe(100000);
        expect(connection.remainingBudget).toBe(0);
        expect(connection.budgetUsagePercentage).toBe(100);
        expect(connection.budgetLimitReached).toBe(true);
        expect(connection.canSpend(1)).toBe(false);
    });

    it('reflects pending payments in budgetUsagePercentage', () => {
        const connection = baseConnection();
        connection.trackSpending(25000);
        connection.activity.push({
            id: 'lnbc-partial',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 25000
        });

        expect(connection.budgetUsagePercentage).toBe(50);
        expect(connection.budgetLimitReached).toBe(false);
    });

    it('frees the budget and limit flag when a pending payment fails', () => {
        const connection = baseConnection();
        connection.activity.push({
            id: 'lnbc-doomed',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100000
        });

        expect(connection.budgetLimitReached).toBe(true);
        expect(connection.canSpend(1)).toBe(false);

        connection.activity[0].status = 'failed';

        expect(connection.budgetLimitReached).toBe(false);
        expect(connection.remainingBudget).toBe(100000);
        expect(connection.canSpend(100000)).toBe(true);
    });

    it('clears the BudgetLimitReached warning once budget frees up', () => {
        const connection = baseConnection();
        connection.activity.push({
            id: 'lnbc-transient',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100000
        });

        connection.checkAndResetBudgetIfNeeded(1000000);
        expect(
            connection.warnings.some((w) => w.type === 'budget_limit_reached')
        ).toBe(true);

        connection.activity[0].status = 'failed';
        connection.checkAndResetBudgetIfNeeded(1000000);
        expect(
            connection.warnings.some((w) => w.type === 'budget_limit_reached')
        ).toBe(false);
    });

    it('holds the fee cap of a pending pay_invoice with its amount', () => {
        const connection = baseConnection();
        connection.activity.push(
            {
                id: 'lnbc-held',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'pending',
                satAmount: 1,
                feeLimitSats: 1000
            },
            {
                id: 'lnbc-settled',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'success',
                satAmount: 1,
                feeLimitSats: 1000
            }
        );

        expect(connection.pendingSpendSats).toBe(1001);
        expect(connection.remainingBudget).toBe(98999);
    });
});

describe('NWCConnection feeLimitSatsForPayment', () => {
    it('returns the full cap when the budget has room for it', () => {
        const connection = baseConnection();
        expect(connection.feeLimitSatsForPayment(1000, 1000)).toBe(1000);
    });

    it('limits the cap to the budget left after the amount', () => {
        const connection = baseConnection();
        connection.trackSpending(98500);
        expect(connection.feeLimitSatsForPayment(1000, 1000)).toBe(500);
        expect(connection.feeLimitSatsForPayment(1500, 1000)).toBe(0);
    });

    it('counts pending holds, fee caps included, as used', () => {
        const connection = baseConnection();
        connection.maxAmountSats = 2000;
        connection.activity.push({
            id: 'lnbc-held',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 1,
            feeLimitSats: 1000
        });

        expect(connection.feeLimitSatsForPayment(1, 1000)).toBe(998);
    });

    it('never returns a negative cap', () => {
        const connection = baseConnection();
        connection.trackSpending(100000);
        expect(connection.feeLimitSatsForPayment(10, 1000)).toBe(0);
    });

    it('returns the full cap when the connection has no budget', () => {
        const connection = baseConnection();
        connection.maxAmountSats = undefined;
        expect(connection.feeLimitSatsForPayment(5000000, 1000)).toBe(1000);
    });
});

describe('NWCConnection pay_invoice activity lookup', () => {
    it('findPayInvoiceActivityIndex matches by id', () => {
        const connection = baseConnection();
        connection.activity.push({
            id: 'lnbc1normalized',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100
        });

        expect(connection.findPayInvoiceActivityIndex('lnbc1normalized')).toBe(
            0
        );
        expect(connection.findPayInvoiceActivityIndex('missing')).toBe(-1);
    });

    it('findPayInvoiceActivityIndex matches by paymentHash when ids differ', () => {
        const connection = baseConnection();
        const paymentHash = 'abc123paymenthash';
        connection.activity.push({
            id: 'lnbc1normalized',
            type: 'pay_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100,
            paymentHash
        });

        expect(
            connection.findPayInvoiceActivityIndex(
                'LNBC1NORMALIZED',
                paymentHash
            )
        ).toBe(0);
    });

    it('findPayInvoiceActivity ignores make_invoice rows with the same id/hash', () => {
        const connection = baseConnection();
        const paymentHash = 'abc123paymenthash';
        connection.activity.push({
            id: 'lnbc1normalized',
            type: 'make_invoice',
            payment_source: 'lightning',
            status: 'pending',
            satAmount: 100,
            paymentHash
        });

        expect(
            connection.findPayInvoiceActivityIndex(
                'lnbc1normalized',
                paymentHash
            )
        ).toBe(-1);
        expect(
            connection.findPayInvoiceActivity('lnbc1normalized', paymentHash)
        ).toBeUndefined();
    });

    it('isUnresolvedPayInvoiceActivity matches pending and timeout-failed holds', () => {
        const connection = baseConnection();
        const pending = {
            id: 'lnbc1pending',
            type: 'pay_invoice' as const,
            payment_source: 'lightning' as const,
            status: 'pending' as const,
            satAmount: 100
        };
        const timeoutFailed = {
            id: 'lnbc1timeout',
            type: 'pay_invoice' as const,
            payment_source: 'lightning' as const,
            status: 'failed' as const,
            satAmount: 100,
            error: 'views.SendingLightning.paymentTimedOut'
        };

        expect(connection.isUnresolvedPayInvoiceActivity(pending)).toBe(true);
        expect(connection.isUnresolvedPayInvoiceActivity(timeoutFailed)).toBe(
            true
        );
        expect(
            connection.isUnresolvedPayInvoiceActivity({
                ...timeoutFailed,
                error: 'FAILURE_REASON_NO_ROUTE'
            })
        ).toBe(false);
        expect(
            connection.isUnresolvedPayInvoiceActivity({
                ...pending,
                isBudgetDebited: true
            })
        ).toBe(false);
    });
});

describe('NWCConnection expiry', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('refuses payments after expiry while isExpired is observed', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const connection = baseConnection();
        connection.expiresAt = new Date('2026-01-01T01:00:00Z');
        // a mounted observer screen keeps the computed cached
        const dispose = autorun(() => connection.isExpired);
        expect(connection.validateBudgetBeforePayment(1).success).toBe(true);

        jest.setSystemTime(new Date('2026-01-01T02:00:00Z'));

        expect(connection.isExpiredNow()).toBe(true);
        expect(connection.validateBudgetBeforePayment(1)).toEqual({
            success: false,
            errorMessage:
                'views.Settings.NostrWalletConnect.error.connectionExpired'
        });
        dispose();
    });

    it('isExpiredNow is false without an expiry and before it', () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00Z'));
        const connection = baseConnection();
        expect(connection.isExpiredNow()).toBe(false);

        connection.expiresAt = new Date('2026-01-01T01:00:00Z');
        expect(connection.isExpiredNow()).toBe(false);
    });
});

describe('NWCConnection received amounts', () => {
    const receive = (
        id: string,
        satAmount: number,
        createdAt: string,
        status = 'success'
    ) => ({
        id,
        type: 'make_invoice',
        payment_source: 'lightning',
        status,
        satAmount,
        createdAt: new Date(createdAt)
    });

    it('returns 0 when nothing was received', () => {
        const connection = baseConnection();
        expect(connection.lastReceivedActivitySats).toBe(0);
        expect(connection.totalReceivedActivitySats).toBe(0);
    });

    it('uses the most recently created successful make_invoice', () => {
        const connection = baseConnection();
        connection.activity.push(
            receive('a', 100, '2026-01-01T00:00:00Z') as any,
            receive('b', 2500, '2026-01-03T00:00:00Z') as any,
            receive('c', 700, '2026-01-02T00:00:00Z') as any
        );

        expect(connection.lastReceivedActivitySats).toBe(2500);
        expect(connection.totalReceivedActivitySats).toBe(3300);
    });

    it('ignores pending, expired and failed invoices and pay_invoice', () => {
        const connection = baseConnection();
        connection.activity.push(
            receive('a', 100, '2026-01-01T00:00:00Z') as any,
            receive('b', 9000, '2026-01-05T00:00:00Z', 'pending') as any,
            receive('c', 9000, '2026-01-06T00:00:00Z', 'expired') as any,
            receive('d', 9000, '2026-01-07T00:00:00Z', 'failed') as any,
            {
                id: 'p',
                type: 'pay_invoice',
                payment_source: 'lightning',
                status: 'success',
                satAmount: 9000,
                createdAt: new Date('2026-01-08T00:00:00Z')
            } as any
        );

        expect(connection.lastReceivedActivitySats).toBe(100);
        expect(connection.totalReceivedActivitySats).toBe(100);
    });

    it('skips zero-sat successful invoices', () => {
        const connection = baseConnection();
        connection.activity.push(
            receive('a', 100, '2026-01-01T00:00:00Z') as any,
            receive('b', 0, '2026-01-09T00:00:00Z') as any
        );

        expect(connection.lastReceivedActivitySats).toBe(100);
    });

    it('tolerates persisted string dates', () => {
        const connection = baseConnection();
        connection.activity.push(
            {
                ...receive('a', 100, '2026-01-01T00:00:00Z'),
                createdAt: '2026-01-01T00:00:00.000Z'
            } as any,
            {
                ...receive('b', 400, '2026-01-02T00:00:00Z'),
                createdAt: '2026-01-02T00:00:00.000Z'
            } as any
        );

        expect(connection.lastReceivedActivitySats).toBe(400);
    });
});
