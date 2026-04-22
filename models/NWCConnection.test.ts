/**
 * Tests for NWCConnection budget race condition handling and tracking
 */

import NWCConnection from './NWCConnection';

// Mock localeString to avoid dependency on locale system
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string, params?: Record<string, any>) => {
        if (key.includes('invalidAmount')) return 'Invalid amount';
        if (key.includes('paymentExceedsBudget')) {
            return `Payment exceeds budget. Amount: ${params?.amount}, Remaining: ${params?.remaining}`;
        }
        return 'Mock translation';
    }
}));

describe('NWCConnection', () => {
    describe('trackSpending - Budget Enforcement', () => {
        it('should successfully track spending within budget', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 0,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            const result = connection.trackSpending(500);

            expect(result.success).toBe(true);
            expect(result.errorMessage).toBeUndefined();
            expect(connection.totalSpendSats).toBe(500);
        });

        it('should reject spending that exceeds budget', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 800,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            const result = connection.trackSpending(300);

            expect(result.success).toBe(false);
            expect(result.errorMessage).toBeDefined();
            expect(result.errorMessage).toContain('exceeds budget');
            // Budget should be clamped to max
            expect(connection.totalSpendSats).toBe(1000);
        });

        it('should allow spending exactly at budget limit', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 900,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            const result = connection.trackSpending(100);

            expect(result.success).toBe(true);
            expect(connection.totalSpendSats).toBe(1000);
        });

        it('should not enforce budget when no limit is set', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 0,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
                // No maxAmountSats set
            });

            const result = connection.trackSpending(5000000);

            expect(result.success).toBe(true);
            expect(connection.totalSpendSats).toBe(5000000);
        });

        it('should reject invalid amounts', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 0,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            expect(() => connection.trackSpending(-1)).toThrow();
            expect(() => connection.trackSpending(1.5)).toThrow();
        });
    });

    describe('Concurrent Payment Scenarios (Race Condition)', () => {
        it('should clamp budget when concurrent payments cause overage', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 800,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            // Simulate two concurrent payments that both read totalSpendSats=800
            // and each try to add 200 (total would be 1200, exceeding limit)
            const payment1Result = connection.trackSpending(200);

            // First payment succeeds
            expect(payment1Result.success).toBe(true);
            expect(connection.totalSpendSats).toBe(1000);

            // Second concurrent payment should fail and clamp (it doesn't see the first)
            const payment2Result = connection.trackSpending(200);
            expect(payment2Result.success).toBe(false);
            expect(connection.totalSpendSats).toBe(1000); // Should stay at max, not grow to 1200
        });

        it('should log race condition detection with full context', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const connection = new NWCConnection({
                id: 'conn-123',
                name: 'My Wallet',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 900,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            connection.trackSpending(200);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Budget race detected'),
                expect.objectContaining({
                    connectionId: 'conn-123',
                    connectionName: 'My Wallet',
                    totalSpendSatsBefore: 900,
                    attemptedAmount: 200,
                    maxAmountSats: 1000,
                    totalSpendSatsAfterClamp: 1000,
                    overageAmount: 100
                })
            );

            consoleSpy.mockRestore();
        });

        it('should prevent unbounded budget overflow in rapid succession', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 500,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            // Simulate rapid payments that all see totalSpendSats=500
            // Each tries to add 200 (individual should succeed, but collectively would exceed)
            const results = [];
            results.push(connection.trackSpending(200)); // 500 + 200 = 700 ✓
            results.push(connection.trackSpending(200)); // 700 + 200 = 900 ✓
            results.push(connection.trackSpending(200)); // 900 + 200 = 1100 ✗ (exceeds)
            results.push(connection.trackSpending(200)); // 1000 (clamped) + 200 = ? ✗ (exceeds)

            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);
            expect(results[2].success).toBe(false);
            expect(results[3].success).toBe(false);

            // CRITICAL INVARIANT: totalSpendSats should NEVER exceed maxAmountSats
            expect(connection.totalSpendSats).toBeLessThanOrEqual(
                connection.maxAmountSats!
            );
            expect(connection.totalSpendSats).toBe(1000);
        });

        it('should maintain budget invariant: totalSpendSats <= maxAmountSats in all cases', () => {
            const testScenarios = [
                { initial: 0, max: 1000, payment: 500 },
                { initial: 750, max: 1000, payment: 300 },
                { initial: 950, max: 1000, payment: 100 },
                { initial: 999, max: 1000, payment: 2 }
            ];

            testScenarios.forEach(({ initial, max, payment }) => {
                const connection = new NWCConnection({
                    id: 'test-conn',
                    name: 'Test Connection',
                    pubkey: 'test-pubkey',
                    relayUrl: 'wss://relay.example.com',
                    permissions: [],
                    createdAt: new Date(),
                    totalSpendSats: initial,
                    maxAmountSats: max,
                    nodePubkey: 'node-pubkey',
                    implementation: 'zeus'
                });

                connection.trackSpending(payment);

                expect(connection.totalSpendSats).toBeLessThanOrEqual(max);
                expect(connection.totalSpendSats).toBeGreaterThanOrEqual(
                    initial
                );
            });
        });
    });

    describe('Budget Properties', () => {
        it('should compute remainingBudget correctly', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 300,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            expect(connection.remainingBudget).toBe(700);
        });

        it('should compute budgetUsagePercentage correctly', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 250,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            expect(connection.budgetUsagePercentage).toBe(25);
        });

        it('should report budgetLimitReached when totalSpendSats >= maxAmountSats', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 1000,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            expect(connection.budgetLimitReached).toBe(true);
        });

        it('should report canSpend correctly', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 800,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            expect(connection.canSpend(200)).toBe(true);
            expect(connection.canSpend(201)).toBe(false);
            expect(connection.canSpend(1)).toBe(true);
        });
    });

    describe('Budget Reset', () => {
        it('should reset budget and update lastBudgetReset timestamp', () => {
            const connection = new NWCConnection({
                id: 'test-conn',
                name: 'Test Connection',
                pubkey: 'test-pubkey',
                relayUrl: 'wss://relay.example.com',
                permissions: [],
                createdAt: new Date(),
                totalSpendSats: 500,
                maxAmountSats: 1000,
                nodePubkey: 'node-pubkey',
                implementation: 'zeus'
            });

            const beforeReset = new Date();
            connection.resetBudget();
            const afterReset = new Date();

            expect(connection.totalSpendSats).toBe(0);
            expect(connection.lastBudgetReset).toBeDefined();
            expect(
                connection.lastBudgetReset!.getTime()
            ).toBeGreaterThanOrEqual(beforeReset.getTime());
            expect(connection.lastBudgetReset!.getTime()).toBeLessThanOrEqual(
                afterReset.getTime()
            );
        });
    });
});
