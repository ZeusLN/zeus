import {
    getCooperativeCloseOverlap,
    getCooperativeCloses,
    getExternalUnconfirmedBalance,
    getForceCloseSweepOverlap,
    getForceCloses
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
                txids: ['payjoin'],
                transactions: [
                    { txid: 'payjoin', amount: 50000, spentTxids: ['a', 'b'] }
                ]
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
                {
                    amount: 50000,
                    txids: ['deposit'],
                    transactions: [
                        { txid: 'deposit', amount: 50000, spentTxids: [] }
                    ]
                }
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

    describe('getForceCloses', () => {
        it('returns the closing txid and limbo balance', () => {
            expect(
                getForceCloses([
                    {
                        closing_txid: 'commit',
                        limbo_balance: '96860',
                        pending_htlcs: []
                    }
                ])
            ).toEqual([{ txids: ['commit'], limboBalance: 96860 }]);
        });

        it('adds the txids second-level HTLC sweeps spend from', () => {
            // a first-stage HTLC sits on the commitment transaction, a
            // second-stage one on its own HTLC transaction
            expect(
                getForceCloses([
                    {
                        closing_txid: 'commit',
                        limbo_balance: '120000',
                        pending_htlcs: [
                            { outpoint: 'commit:2', stage: 1 },
                            { outpoint: 'htlc:0', stage: 2 }
                        ]
                    }
                ])
            ).toEqual([{ txids: ['commit', 'htlc'], limboBalance: 120000 }]);
        });

        it('skips entries without a closing txid', () => {
            expect(getForceCloses([{ limbo_balance: '1000' }, null])).toEqual(
                []
            );
            expect(getForceCloses(undefined as any)).toEqual([]);
        });
    });

    describe('getForceCloseSweepOverlap', () => {
        // Channel outputs are not wallet UTXOs, so lnd lists them with
        // is_our_output false. A sweep's net amount is what it pays the
        // wallet minus any wallet inputs, so it is always below what it spent.
        const sweepOf = (txid: string, amount: number, ...spent: string[]) => ({
            tx_hash: txid,
            amount: String(amount),
            total_fees: '0',
            num_confirmations: 0,
            previous_outpoints: spent.map((outpoint) => ({
                outpoint,
                is_our_output: false
            }))
        });

        // What BalancePane shows on the pending line for these closes
        const pendingLine = (
            limbo: number,
            external: number,
            overlap: number
        ) => limbo + external - overlap;

        it('counts a force close with an unconfirmed sweep once', () => {
            // regtest vector from #4740: 96,860 sats of limbo, swept one
            // block before maturity for 96,395 sats after a 465 sat fee
            const external = getExternalUnconfirmedBalance(
                [sweepOf('sweep', 96395, 'commit:0')],
                96395
            );
            const overlap = getForceCloseSweepOverlap(
                getForceCloses([
                    {
                        closing_txid: 'commit',
                        limbo_balance: '96860',
                        pending_htlcs: []
                    }
                ]),
                external.transactions,
                96860
            );
            expect(overlap).toEqual(96395);
            // the sweep output is no longer counted a second time; only the
            // 465 sat fee stays on the pending line until it confirms
            expect(pendingLine(96860, external.amount, overlap)).toEqual(96860);
        });

        it('keeps a locked commitment output when its anchor is batched with another sweep', () => {
            // x is 50 blocks from maturity: 100,000 sats locked plus a
            // 330 sat anchor. y is mature, 46,860 sats. The sweeper
            // batches x's anchor with y's commitment output, 500 sat fee.
            const external = getExternalUnconfirmedBalance(
                [sweepOf('batch', 46690, 'x:3', 'y:0')],
                46690
            );
            const overlap = getForceCloseSweepOverlap(
                getForceCloses([
                    { closing_txid: 'x', limbo_balance: '100330' },
                    { closing_txid: 'y', limbo_balance: '46860' }
                ]),
                external.transactions,
                147190
            );
            expect(overlap).toEqual(46690);
            // x's 100,000 locked sats plus the 46,690 sat sweep output,
            // with the 500 sat fee counted until the sweep confirms
            expect(pendingLine(147190, external.amount, overlap)).toEqual(
                147190
            );
        });

        it('keeps a locked commitment output when only its anchor is swept', () => {
            // a lone anchor sweep nets 130 sats after a 200 sat fee, while
            // the 100,000 sat commitment output is still locked
            const external = getExternalUnconfirmedBalance(
                [sweepOf('anchor', 130, 'commit:3')],
                130
            );
            const overlap = getForceCloseSweepOverlap(
                getForceCloses([
                    { closing_txid: 'commit', limbo_balance: '100330' }
                ]),
                external.transactions,
                100330
            );
            expect(overlap).toEqual(130);
            expect(pendingLine(100330, external.amount, overlap)).toEqual(
                100330
            );
        });

        it('keeps the limbo balance until the sweep is broadcast', () => {
            // an external deposit spends someone else's outputs
            const external = getExternalUnconfirmedBalance(
                [sweepOf('deposit', 50000, 'elsewhere:1')],
                50000
            );
            expect(
                getForceCloseSweepOverlap(
                    [{ txids: ['commit'], limboBalance: 96860 }],
                    external.transactions,
                    96860
                )
            ).toEqual(0);
        });

        it('leaves an unswept HTLC in limbo', () => {
            // 96,860 of the 120,000 sat limbo is the commitment output;
            // the rest is an HTLC that is not swept yet
            const external = getExternalUnconfirmedBalance(
                [sweepOf('sweep', 96395, 'commit:0')],
                96395
            );
            expect(
                getForceCloseSweepOverlap(
                    [{ txids: ['commit', 'htlc'], limboBalance: 120000 }],
                    external.transactions,
                    120000
                )
            ).toEqual(96395);
        });

        it('joins a second-level HTLC sweep on the HTLC transaction', () => {
            const external = getExternalUnconfirmedBalance(
                [sweepOf('htlcsweep', 23000, 'htlc:0')],
                23000
            );
            expect(
                getForceCloseSweepOverlap(
                    [{ txids: ['commit', 'htlc'], limboBalance: 120000 }],
                    external.transactions,
                    120000
                )
            ).toEqual(23000);
        });

        it('counts each sweep of one channel', () => {
            const external = getExternalUnconfirmedBalance(
                [
                    sweepOf('sweep', 96395, 'commit:0'),
                    sweepOf('htlcsweep', 23000, 'htlc:0')
                ],
                119395
            );
            expect(
                getForceCloseSweepOverlap(
                    [{ txids: ['commit', 'htlc'], limboBalance: 120000 }],
                    external.transactions,
                    120000
                )
            ).toEqual(119395);
        });

        it('counts a sweep batched across channels once', () => {
            // lnd's sweeper spends both commitment outputs in one tx
            const external = getExternalUnconfirmedBalance(
                [sweepOf('batch', 96395, 'a:0', 'b:1')],
                96395
            );
            expect(
                getForceCloseSweepOverlap(
                    [
                        { txids: ['a'], limboBalance: 50000 },
                        { txids: ['b'], limboBalance: 46860 }
                    ],
                    external.transactions,
                    96860
                )
            ).toEqual(96395);
        });

        it('groups channels linked through a shared sweep', () => {
            // a and c share no sweep with each other, but both share one
            // with b, so all three settle together
            const external = getExternalUnconfirmedBalance(
                [
                    sweepOf('ab', 60000, 'a:0', 'b:0'),
                    sweepOf('bc', 40000, 'b:1', 'c:0')
                ],
                100000
            );
            expect(
                getForceCloseSweepOverlap(
                    [
                        { txids: ['a'], limboBalance: 30000 },
                        { txids: ['c'], limboBalance: 20000 },
                        { txids: ['b'], limboBalance: 55000 }
                    ],
                    external.transactions,
                    105000
                )
            ).toEqual(100000);
        });

        it('clamps to the pending close balance', () => {
            const external = getExternalUnconfirmedBalance(
                [sweepOf('sweep', 96395, 'commit:0')],
                96395
            );
            const closes = [{ txids: ['commit'], limboBalance: 96860 }];
            expect(
                getForceCloseSweepOverlap(closes, external.transactions, 90000)
            ).toEqual(90000);
            expect(
                getForceCloseSweepOverlap(closes, external.transactions, 0)
            ).toEqual(0);
        });

        it('returns 0 for missing input', () => {
            expect(
                getForceCloseSweepOverlap(undefined as any, [], 1000)
            ).toEqual(0);
            expect(
                getForceCloseSweepOverlap(
                    [{ txids: ['commit'], limboBalance: 1000 }],
                    undefined as any,
                    1000
                )
            ).toEqual(0);
        });
    });
});
