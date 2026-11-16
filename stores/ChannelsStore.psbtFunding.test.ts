jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: () => Buffer.alloc(32)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    connectPeer: jest.fn(),
    openChannelStream: jest.fn(),
    openChannelSync: jest.fn(),
    fundPsbt: jest.fn(),
    signPsbt: jest.fn(),
    fundingStateStep: jest.fn(),
    publishTransaction: jest.fn(),
    getClass: () => ({ publishTransaction: true }),
    isLNDBased: () => true
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => String(e)
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import ChannelsStore from './ChannelsStore';
import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

const bitcoin = require('bitcoinjs-lib');

const PUBKEY =
    '03cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
const P2WPKH = Buffer.from(`0014${'11'.repeat(20)}`, 'hex');
const FUNDING_INPUTS = [
    { txid: 'aa'.repeat(32), vout: 1 },
    { txid: 'bb'.repeat(32), vout: 0 }
];
const OTHER_INPUTS = [{ txid: 'cc'.repeat(32), vout: 0 }];
// the channel's 2-of-2 output, then the change
const P2WSH = Buffer.from(`0020${'22'.repeat(32)}`, 'hex');
const FUNDING_OUTPUTS = [
    { script: P2WSH, value: 100000 },
    { script: P2WPKH, value: 49000 }
];
const OTHER_P2WPKH = Buffer.from(`0014${'33'.repeat(20)}`, 'hex');

type Output = { script: Buffer; value: number };

const psbtSpending = (
    inputs: Array<{ txid: string; vout: number }>,
    signed = false,
    outputs: Array<Output> = FUNDING_OUTPUTS
) => {
    const psbt = new bitcoin.Psbt();
    inputs.forEach(({ txid, vout }, index) => {
        psbt.addInput({
            hash: txid,
            index: vout,
            witnessUtxo: { script: P2WPKH, value: 100000 }
        });
        if (signed) {
            psbt.updateInput(index, {
                finalScriptWitness: Buffer.from('00', 'hex')
            });
        }
    });
    outputs.forEach((output) => psbt.addOutput(output));
    return psbt.toBase64();
};

const txSpending = (
    inputs: Array<{ txid: string; vout: number }>,
    outputs: Array<Output> = FUNDING_OUTPUTS
) => {
    const tx = new bitcoin.Transaction();
    inputs.forEach(({ txid, vout }) =>
        tx.addInput(Buffer.from(txid, 'hex').reverse(), vout)
    );
    outputs.forEach(({ script, value }) => tx.addOutput(script, value));
    return tx.toHex();
};

// what the PSBT and TxHex screens are given for the same transaction
const bothForms = (
    inputs: Array<{ txid: string; vout: number }>,
    outputs: Array<Output>
) => [
    { psbt: psbtSpending(inputs, true, outputs) },
    { txHex: txSpending(inputs, outputs) }
];

const PSBT = psbtSpending(FUNDING_INPUTS);

const flushPromises = () => new Promise(setImmediate);

const openRequest = (account: string) =>
    ({
        node_pubkey_string: PUBKEY,
        host: '203.0.113.7:9735',
        local_funding_amount: '100000',
        sat_per_vbyte: '2',
        account
    } as any);

// LND cannot sign for an imported account, so its own attempt to finalize
// fails and the PSBT is left for the user to sign on an external signer
const lndWaitsForSigner = (pending_chan_id: string) => {
    jest.mocked(BackendUtils.openChannelStream).mockResolvedValue({
        result: {
            pending_chan_id,
            psbt_fund: { funding_address: 'bc1qfunding', funding_amount: 1 }
        }
    });
    jest.mocked(BackendUtils.fundingStateStep).mockImplementation((step: any) =>
        step.psbt_finalize
            ? Promise.reject(new Error('not signed'))
            : Promise.resolve({})
    );
};

// The PSBT and TxHex screens hand a signed funding transaction back to LND's
// funding flow only while pending_chan_ids is set. If anything drops it while
// the PSBT is out for signing, they publish the transaction themselves and the
// funds land in the channel's 2-of-2 output outside the funding flow.
describe('ChannelsStore PSBT funding flow', () => {
    let channelsStore: ChannelsStore;
    let transactionsStore: TransactionsStore;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.mocked(BackendUtils.connectPeer).mockResolvedValue({});
        jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
            funded_psbt: PSBT
        });
        jest.mocked(BackendUtils.signPsbt).mockResolvedValue({});
        lndWaitsForSigner('chan-1');

        channelsStore = new ChannelsStore(
            { implementation: 'lnd' } as any,
            {} as any
        );
        transactionsStore = new TransactionsStore(
            { implementation: 'lnd', settings: {} } as any,
            {} as any,
            channelsStore,
            {} as any,
            {} as any
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();
    });

    it('has the channel loaded while the PSBT is out for signing', () => {
        expect(channelsStore.funded_psbt).toBe(PSBT);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when the open channel form is reset', () => {
        // what mounting another OpenChannel screen (a node URI from a link,
        // NFC tag or shared image) or the channels pane does
        channelsStore.resetOpenChannel();

        expect(channelsStore.funded_psbt).toBe('');
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when a peer is connected', async () => {
        // the silent connect from LSPStore.getLSPInfo and InvoicesStore
        await channelsStore.connectPeer(
            openRequest('default'),
            false,
            true,
            true
        );
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);

        // connect peer only, from the form
        await channelsStore.connectPeer(openRequest('default'), false, true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when another transaction is broadcast', async () => {
        jest.mocked(BackendUtils.publishTransaction).mockResolvedValue({});

        await transactionsStore.broadcast('00');

        expect(transactionsStore.publishSuccess).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('keeps the channel when LND refuses the signed PSBT', async () => {
        await transactionsStore.finalizePsbtAndBroadcastChannel(
            PSBT,
            channelsStore.pending_chan_ids
        );

        expect(transactionsStore.error).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('drops the channel once LND has finalized the signed PSBT', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await transactionsStore.finalizePsbtAndBroadcastChannel(
            PSBT,
            channelsStore.pending_chan_ids
        );

        expect(BackendUtils.fundingStateStep).toHaveBeenLastCalledWith({
            psbt_finalize: { signed_psbt: PSBT, pending_chan_id: 'chan-1' }
        });
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel once LND has finalized the signed transaction', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await transactionsStore.finalizeTxHexAndBroadcastChannel(
            '00',
            channelsStore.pending_chan_ids
        );

        expect(BackendUtils.fundingStateStep).toHaveBeenLastCalledWith({
            psbt_finalize: { final_raw_tx: '00', pending_chan_id: 'chan-1' }
        });
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    // The PSBT and TxHex screens call these with the transaction the user
    // signed and the channels it was matched to
    const finalizers: Array<[string, (ids: Array<string>) => Promise<void>]> = [
        [
            'PSBT',
            (ids) =>
                transactionsStore.finalizePsbtAndBroadcastChannel(PSBT, ids)
        ],
        [
            'transaction',
            (ids) =>
                transactionsStore.finalizeTxHexAndBroadcastChannel(
                    txSpending(FUNDING_INPUTS),
                    ids
                )
        ]
    ];

    // LND holds the user's psbt_finalize for chan-1 until the returned
    // function is called. Its own attempt to finalize any other channel
    // fails, so that channel's PSBT is left for the user to sign.
    const deferFinalizeOfFirstChannel = () => {
        let settle: (data: any) => void = () => {};
        jest.mocked(BackendUtils.fundingStateStep).mockImplementation(
            (step: any) => {
                if (!step.psbt_finalize) return Promise.resolve({});
                if (step.psbt_finalize.pending_chan_id !== 'chan-1') {
                    return Promise.reject(new Error('not signed'));
                }
                return new Promise((resolve) => {
                    settle = resolve;
                });
            }
        );
        return (data: any) => settle(data);
    };

    describe.each(finalizers)('with a signed %s', (_, finalize) => {
        it('keeps a newer channel whose PSBT is out for signing when the older one is finalized', async () => {
            const otherPsbt = psbtSpending(OTHER_INPUTS);
            const settle = deferFinalizeOfFirstChannel();
            const finalized = finalize(
                channelsStore.pendingChanIdsFor({ psbt: PSBT })
            );

            jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
                funded_psbt: otherPsbt
            });
            jest.mocked(BackendUtils.openChannelStream).mockResolvedValue({
                result: {
                    pending_chan_id: 'chan-2',
                    psbt_fund: {
                        funding_address: 'bc1qfunding',
                        funding_amount: 1
                    }
                }
            });
            await channelsStore.connectPeer(openRequest('signer'));
            await flushPromises();
            expect(channelsStore.funded_psbt).toBe(otherPsbt);

            settle({});
            await finalized;

            expect(transactionsStore.publishSuccess).toBe(true);
            expect(channelsStore.funded_psbt).toBe(otherPsbt);
            expect(channelsStore.pending_chan_ids).toEqual(['chan-2']);
            expect(
                channelsStore.pendingChanIdsFor({ psbt: otherPsbt })
            ).toEqual(['chan-2']);
            expect(
                channelsStore.pendingChanIdsFor({
                    txHex: txSpending(OTHER_INPUTS)
                })
            ).toEqual(['chan-2']);
        });

        it('keeps a newer open that is still in progress when the older channel is finalized', async () => {
            const otherPsbt = psbtSpending(OTHER_INPUTS);
            const settle = deferFinalizeOfFirstChannel();
            const finalized = finalize(
                channelsStore.pendingChanIdsFor({ psbt: PSBT })
            );

            jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
                funded_psbt: otherPsbt
            });
            let answerOpen: (data: any) => void = () => {};
            jest.mocked(BackendUtils.openChannelStream).mockReturnValue(
                new Promise((resolve) => {
                    answerOpen = resolve;
                })
            );
            await channelsStore.connectPeer(openRequest('signer'));
            await flushPromises();
            expect(channelsStore.openingChannel).toBe(true);
            expect(channelsStore.pending_chan_ids).toEqual([]);

            settle({});
            await finalized;

            expect(transactionsStore.publishSuccess).toBe(true);
            expect(channelsStore.openingChannel).toBe(true);

            // the newer open is still the current one: its PSBT is handed
            // to the user and matched to its channel
            answerOpen({
                result: {
                    pending_chan_id: 'chan-2',
                    psbt_fund: {
                        funding_address: 'bc1qfunding',
                        funding_amount: 1
                    }
                }
            });
            await flushPromises();

            expect(channelsStore.funded_psbt).toBe(otherPsbt);
            expect(channelsStore.pending_chan_ids).toEqual(['chan-2']);
            expect(
                channelsStore.pendingChanIdsFor({ psbt: otherPsbt })
            ).toEqual(['chan-2']);
        });

        it('drops the channel, its PSBT and its match when no other open started', async () => {
            const settle = deferFinalizeOfFirstChannel();
            // a copy: the channels are compared by ID
            const finalized = finalize([
                ...channelsStore.pendingChanIdsFor({ psbt: PSBT })
            ]);

            settle({});
            await finalized;

            expect(transactionsStore.publishSuccess).toBe(true);
            expect(channelsStore.funded_psbt).toBe('');
            expect(channelsStore.pending_chan_ids).toEqual([]);
            expect(channelsStore.pending_funding_tx_keys).toEqual([]);
            expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([]);
        });

        it.each([
            ['reports a publish error', { publish_error: 'bad-txns' }],
            ['rejects the call', undefined]
        ])('keeps the channel and its PSBT when LND %s', async (_, data) => {
            jest.mocked(BackendUtils.fundingStateStep).mockImplementation(() =>
                data
                    ? Promise.resolve(data)
                    : Promise.reject(new Error('not signed'))
            );

            await finalize(channelsStore.pendingChanIdsFor({ psbt: PSBT }));

            expect(transactionsStore.error).toBe(true);
            expect(transactionsStore.publishSuccess).toBe(false);
            expect(channelsStore.funded_psbt).toBe(PSBT);
            expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
            expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([
                'chan-1'
            ]);
        });
    });

    // A batch is finalized with the ID of its last channel, and every one of
    // its channels has to be the store's for the flow to be the same one
    it.each([
        ['another channel', ['chan-2']],
        ['a batch that ends with the channel', ['chan-0', 'chan-1']],
        ['a batch that starts with the channel', ['chan-1', 'chan-2']],
        ['no channel', []]
    ])('keeps the channel when %s was finalized', (_, ids) => {
        channelsStore.resetFinalizedChannels(ids);

        expect(channelsStore.funded_psbt).toBe(PSBT);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
        expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([
            'chan-1'
        ]);
    });

    it('replaces the channel when another one is opened', async () => {
        lndWaitsForSigner('chan-2');

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.pending_chan_ids).toEqual(['chan-2']);
    });

    it('drops the channel when LND finalizes without a signer', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.channelSuccess).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when no PSBT could be funded for it', async () => {
        jest.mocked(BackendUtils.fundPsbt).mockRejectedValue(
            new Error('insufficient funds')
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.errorOpenChannel).toBe(true);
        expect(channelsStore.funded_psbt).toBe('');
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when LND rejects the open', async () => {
        jest.mocked(BackendUtils.openChannelStream).mockRejectedValue(
            new Error('peer disconnected')
        );

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.errorOpenChannel).toBe(true);
        expect(channelsStore.pending_chan_ids).toEqual([]);
    });

    it('drops the channel when the wallet changes', () => {
        channelsStore.reset();

        expect(channelsStore.pending_chan_ids).toEqual([]);
        expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([]);
    });

    it('matches the signed funding transaction to the channel', () => {
        // the form reset that no longer drops the channel
        channelsStore.resetOpenChannel();

        expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([
            'chan-1'
        ]);
        expect(
            channelsStore.pendingChanIdsFor({
                psbt: psbtSpending(FUNDING_INPUTS, true)
            })
        ).toEqual(['chan-1']);
        // inputs in another order
        expect(
            channelsStore.pendingChanIdsFor({
                txHex: txSpending([...FUNDING_INPUTS].reverse())
            })
        ).toEqual(['chan-1']);
    });

    // A send from an external account, a scanned PSBT or a sweep reaches the
    // same screens while an abandoned funding flow still has its ID set
    it('matches no channel to a transaction that spends other outpoints', () => {
        channelsStore.resetOpenChannel();

        expect(
            channelsStore.pendingChanIdsFor({
                psbt: psbtSpending(OTHER_INPUTS)
            })
        ).toEqual([]);
        expect(
            channelsStore.pendingChanIdsFor({
                txHex: txSpending(OTHER_INPUTS)
            })
        ).toEqual([]);
        // a subset of the funding inputs is a different transaction
        expect(
            channelsStore.pendingChanIdsFor({
                txHex: txSpending(FUNDING_INPUTS.slice(0, 1))
            })
        ).toEqual([]);
        expect(channelsStore.pendingChanIdsFor({ psbt: 'not a psbt' })).toEqual(
            []
        );
        expect(channelsStore.pendingChanIdsFor({ txHex: 'zz' })).toEqual([]);
        expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
    });

    it('matches the transaction extracted from the signed funding PSBT', () => {
        channelsStore.resetOpenChannel();
        const txHex = bitcoin.Psbt.fromBase64(
            psbtSpending(FUNDING_INPUTS, true)
        )
            .extractTransaction(true)
            .toHex();

        expect(channelsStore.pendingChanIdsFor({ txHex })).toEqual(['chan-1']);
    });

    // A send from the same external account can be funded with the inputs
    // an abandoned funding flow left behind. LND would refuse it as the
    // funding transaction on every try.
    it.each([
        [
            'pays another address',
            [FUNDING_OUTPUTS[0], { script: OTHER_P2WPKH, value: 49000 }]
        ],
        [
            'pays another amount',
            [FUNDING_OUTPUTS[0], { script: P2WPKH, value: 49001 }]
        ],
        [
            'has its outputs in another order',
            [FUNDING_OUTPUTS[1], FUNDING_OUTPUTS[0]]
        ],
        ['leaves an output out', [FUNDING_OUTPUTS[0]]],
        [
            'adds an output',
            [...FUNDING_OUTPUTS, { script: OTHER_P2WPKH, value: 1000 }]
        ]
    ])(
        'matches no channel to a transaction that spends the funding inputs but %s',
        (_, outputs) => {
            channelsStore.resetOpenChannel();

            bothForms(FUNDING_INPUTS, outputs).forEach((tx) =>
                expect(channelsStore.pendingChanIdsFor(tx)).toEqual([])
            );

            // the channel is still waiting for its own transaction
            expect(channelsStore.pending_chan_ids).toEqual(['chan-1']);
            expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([
                'chan-1'
            ]);
            expect(
                channelsStore.pendingChanIdsFor({
                    txHex: txSpending(FUNDING_INPUTS)
                })
            ).toEqual(['chan-1']);
        }
    );

    it('does not take an output for a spent outpoint', () => {
        // an output whose script and value read like the second funding
        // input, in a transaction that spends only the first
        const [first, second] = FUNDING_INPUTS;
        const outputs = [
            {
                script: Buffer.from(second.txid, 'hex').reverse(),
                value: second.vout
            },
            ...FUNDING_OUTPUTS
        ];

        expect(
            channelsStore.pendingChanIdsFor({
                txHex: txSpending([first], outputs)
            })
        ).toEqual([]);
    });

    it('matches no channel once LND has finalized it', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({});

        await transactionsStore.finalizePsbtAndBroadcastChannel(
            PSBT,
            channelsStore.pendingChanIdsFor({ psbt: PSBT })
        );

        expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([]);
    });

    it('matches the new funding PSBT when another channel is opened', async () => {
        const otherPsbt = psbtSpending(OTHER_INPUTS);
        jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
            funded_psbt: otherPsbt
        });
        lndWaitsForSigner('chan-2');

        await channelsStore.connectPeer(openRequest('signer'));
        await flushPromises();

        expect(channelsStore.pendingChanIdsFor({ psbt: PSBT })).toEqual([]);
        expect(channelsStore.pendingChanIdsFor({ psbt: otherPsbt })).toEqual([
            'chan-2'
        ]);
    });
});
