import { getExternalUnconfirmedBalance } from './BalanceUtils';

describe('BalanceUtils', () => {
    describe('getExternalUnconfirmedBalance', () => {
        it('excludes change from our own channel funding transaction', () => {
            // regtest repro from issue #2167: 1,000,000 sat wallet opens a
            // 500,000 sat channel at a 166 sat fee, leaving 499,834 sats of
            // unconfirmed change
            const transactions = [
                {
                    amount: '-500166',
                    total_fees: '166',
                    num_confirmations: 0
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 499834)).toEqual(
                0
            );
        });

        it('counts an unconfirmed external deposit', () => {
            const transactions = [
                {
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 50000)).toEqual(
                50000
            );
        });

        it('separates external deposits from own change when mixed', () => {
            const transactions = [
                {
                    amount: '-500166',
                    total_fees: '166',
                    num_confirmations: 0
                },
                {
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 549834)).toEqual(
                50000
            );
        });

        it('ignores confirmed transactions', () => {
            const transactions = [
                {
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 3
                },
                {
                    amount: '25000',
                    total_fees: '0',
                    num_confirmations: 0,
                    status: 'confirmed'
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 10000)).toEqual(
                0
            );
        });

        it('handles LDK Node shaped transactions', () => {
            const transactions = [
                {
                    amount: '25000',
                    total_fees: '0',
                    num_confirmations: 0,
                    status: 'pending'
                },
                {
                    amount: '-30000',
                    total_fees: '0',
                    num_confirmations: 0,
                    status: 'pending'
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 25000)).toEqual(
                25000
            );
        });

        it('handles numeric and Long-like amount fields', () => {
            const longLike = {
                toString: () => '40000'
            };
            const transactions = [
                {
                    amount: longLike,
                    total_fees: 0,
                    num_confirmations: 0
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 40000)).toEqual(
                40000
            );
        });

        it('clamps to the reported unconfirmed balance', () => {
            const transactions = [
                {
                    amount: '60000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 40000)).toEqual(
                40000
            );
        });

        it('returns 0 for empty or missing inputs', () => {
            expect(getExternalUnconfirmedBalance([], 10000)).toEqual(0);
            expect(
                getExternalUnconfirmedBalance(undefined as any, 10000)
            ).toEqual(0);
            expect(getExternalUnconfirmedBalance([null], 10000)).toEqual(0);
            expect(
                getExternalUnconfirmedBalance(
                    [{ amount: '50000', total_fees: '0' }],
                    0
                )
            ).toEqual(0);
            expect(
                getExternalUnconfirmedBalance(
                    [{ amount: '50000', total_fees: '0' }],
                    -100
                )
            ).toEqual(0);
        });
    });
});
