import {
    getCooperativeCloseOverlap,
    getCooperativeCloses,
    getExternalUnconfirmedBalance
} from './BalanceUtils';

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
            expect(
                getExternalUnconfirmedBalance(transactions, 499834).amount
            ).toEqual(0);
        });

        it('counts an unconfirmed external deposit', () => {
            const transactions = [
                {
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            expect(
                getExternalUnconfirmedBalance(transactions, 50000).amount
            ).toEqual(50000);
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
            expect(
                getExternalUnconfirmedBalance(transactions, 549834).amount
            ).toEqual(50000);
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
            expect(
                getExternalUnconfirmedBalance(transactions, 10000).amount
            ).toEqual(0);
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
            expect(
                getExternalUnconfirmedBalance(transactions, 25000).amount
            ).toEqual(25000);
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
            expect(
                getExternalUnconfirmedBalance(transactions, 40000).amount
            ).toEqual(40000);
        });

        it('clamps to the reported unconfirmed balance', () => {
            const transactions = [
                {
                    amount: '60000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            expect(
                getExternalUnconfirmedBalance(transactions, 40000).amount
            ).toEqual(40000);
        });

        it('returns 0 for empty or missing inputs', () => {
            expect(getExternalUnconfirmedBalance([], 10000).amount).toEqual(0);
            expect(
                getExternalUnconfirmedBalance(undefined as any, 10000).amount
            ).toEqual(0);
            expect(getExternalUnconfirmedBalance([null], 10000).amount).toEqual(
                0
            );
            expect(
                getExternalUnconfirmedBalance(
                    [{ amount: '50000', total_fees: '0' }],
                    0
                ).amount
            ).toEqual(0);
            expect(
                getExternalUnconfirmedBalance(
                    [{ amount: '50000', total_fees: '0' }],
                    -100
                ).amount
            ).toEqual(0);
        });

        it('counts the net amount received when some inputs are ours', () => {
            // payjoin receive: we contribute a 30,000 sat input and the
            // sender pays us 50,000 sats, so our output is 80,000 sats. lnd
            // cannot compute the fee since not all inputs are ours
            const transactions = [
                {
                    tx_hash: 'payjoin',
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0,
                    previous_outpoints: [
                        { outpoint: 'a:0', is_our_output: true },
                        { outpoint: 'b:0', is_our_output: false }
                    ]
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 80000)).toEqual({
                amount: 50000,
                txids: ['payjoin']
            });
        });

        it('returns the txids of external transactions only', () => {
            const transactions = [
                {
                    tx_hash: 'funding',
                    amount: '-500166',
                    total_fees: '166',
                    num_confirmations: 0
                },
                {
                    tx_hash: 'deposit',
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                },
                {
                    tx_hash: 'confirmed',
                    amount: '20000',
                    total_fees: '0',
                    num_confirmations: 1
                }
            ];
            expect(getExternalUnconfirmedBalance(transactions, 549834)).toEqual(
                { amount: 50000, txids: ['deposit'] }
            );
        });
    });

    describe('getCooperativeCloses', () => {
        const commitments = {
            local_txid: 'local',
            remote_txid: 'remote',
            remote_pending_txid: ''
        };

        it('returns cooperative closes with their limbo balance', () => {
            expect(
                getCooperativeCloses([
                    {
                        closing_txid: 'coop',
                        limbo_balance: '47151',
                        commitments
                    }
                ])
            ).toEqual([{ closingTxid: 'coop', limboBalance: 47151 }]);
        });

        it('skips force closes', () => {
            expect(
                getCooperativeCloses([
                    {
                        closing_txid: 'local',
                        limbo_balance: '47151',
                        commitments
                    },
                    {
                        closing_txid: 'remote',
                        limbo_balance: '47151',
                        commitments
                    },
                    {
                        closing_txid: 'pending',
                        limbo_balance: '47151',
                        commitments: {
                            ...commitments,
                            remote_pending_txid: 'pending'
                        }
                    }
                ])
            ).toEqual([]);
        });

        it('skips channels without a closing txid', () => {
            // LDK Node waiting close channels carry no closing txid
            expect(
                getCooperativeCloses([
                    { closing_txid: '', limbo_balance: '47151', commitments },
                    { channel: {} }
                ])
            ).toEqual([]);
        });

        it('handles Long-like limbo balances and missing commitments', () => {
            expect(
                getCooperativeCloses([
                    {
                        closing_txid: 'coop',
                        limbo_balance: { toString: () => '1000' }
                    }
                ])
            ).toEqual([{ closingTxid: 'coop', limboBalance: 1000 }]);
        });

        it('returns an empty list for missing input', () => {
            expect(getCooperativeCloses(undefined as any)).toEqual([]);
            expect(getCooperativeCloses([null])).toEqual([]);
        });
    });

    describe('getCooperativeCloseOverlap', () => {
        it('drops the limbo balance of an unconfirmed cooperative close', () => {
            // a cooperative close paying the funder 50,000 sats from a
            // 47,151 sat commitment balance: lnd reports the limbo balance
            // and the unconfirmed closing output at the same time
            const transactions = [
                {
                    tx_hash: 'coop',
                    amount: '50000',
                    total_fees: '0',
                    num_confirmations: 0
                }
            ];
            const external = getExternalUnconfirmedBalance(transactions, 50000);
            const cooperativeCloses = [
                { closingTxid: 'coop', limboBalance: 47151 }
            ];
            const overlap = getCooperativeCloseOverlap(
                cooperativeCloses,
                external.txids,
                47151
            );
            expect(overlap).toEqual(47151);
            // pending = limbo + external - overlap = the closing output
            expect(47151 + external.amount - overlap).toEqual(50000);
        });

        it('keeps limbo whose closing tx is not in the wallet yet', () => {
            expect(
                getCooperativeCloseOverlap(
                    [{ closingTxid: 'coop', limboBalance: 47151 }],
                    ['deposit'],
                    47151
                )
            ).toEqual(0);
        });

        it('only drops the overlapping channels', () => {
            expect(
                getCooperativeCloseOverlap(
                    [
                        { closingTxid: 'a', limboBalance: 10000 },
                        { closingTxid: 'b', limboBalance: 20000 }
                    ],
                    ['b'],
                    130000
                )
            ).toEqual(20000);
        });

        it('clamps to the pending close balance', () => {
            expect(
                getCooperativeCloseOverlap(
                    [{ closingTxid: 'coop', limboBalance: 47151 }],
                    ['coop'],
                    40000
                )
            ).toEqual(40000);
            expect(
                getCooperativeCloseOverlap(
                    [{ closingTxid: 'coop', limboBalance: 47151 }],
                    ['coop'],
                    0
                )
            ).toEqual(0);
        });

        it('returns 0 for missing input', () => {
            expect(
                getCooperativeCloseOverlap(undefined as any, ['coop'], 1000)
            ).toEqual(0);
            expect(
                getCooperativeCloseOverlap(
                    [{ closingTxid: 'coop', limboBalance: 1000 }],
                    undefined as any,
                    1000
                )
            ).toEqual(0);
        });
    });
});
