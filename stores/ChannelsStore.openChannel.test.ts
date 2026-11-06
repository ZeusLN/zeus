jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('../utils/BackendUtils', () => ({
    isLNDBased: jest.fn(() => true),
    supportsChannelMemo: jest.fn(() => true),
    openChannelSync: jest.fn(),
    openChannelStream: jest.fn(),
    fundPsbt: jest.fn(),
    signPsbt: jest.fn(),
    fundingStateStep: jest.fn(),
    connectPeer: jest.fn(),
    getPendingChannels: jest.fn(),
    getChannels: jest.fn(),
    supportsClosedChannels: () => false,
    supportsPendingChannels: () => false
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));

import ChannelsStore from './ChannelsStore';
import BackendUtils from '../utils/BackendUtils';
import OpenChannelRequest from '../models/OpenChannelRequest';
import { OPEN_MEMO_PREFIX } from '../utils/ChannelOpenUtils';

const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
const supportsChannelMemo = BackendUtils.supportsChannelMemo as jest.Mock;
const openChannelSync = BackendUtils.openChannelSync as jest.Mock;
const getPendingChannels = BackendUtils.getPendingChannels as jest.Mock;
const getChannels = BackendUtils.getChannels as jest.Mock;
const openChannelStream = BackendUtils.openChannelStream as jest.Mock;
const fundPsbt = BackendUtils.fundPsbt as jest.Mock;
const signPsbt = BackendUtils.signPsbt as jest.Mock;
const fundingStateStep = BackendUtils.fundingStateStep as jest.Mock;
const connectPeer = BackendUtils.connectPeer as jest.Mock;

// cln-rest skips the node-info enrichment reaction; the open path only
// looks at the implementation to decide whether to keep the host
const makeStore = () =>
    new ChannelsStore(
        { implementation: 'cln-rest' } as any,
        { setPendingCloseBalance: jest.fn() } as any
    );

const open = (store: ChannelsStore) =>
    (store as any).openChannel(
        new OpenChannelRequest({
            node_pubkey_string: '02peer',
            local_funding_amount: '100000',
            sat_per_vbyte: '2',
            account: 'default'
        })
    );

const sentRequest = () => openChannelSync.mock.calls[0][0];

// runs the open, then every lookup and the 5s waits between them
const settle = async () => {
    for (let i = 0; i < 4; i++) await jest.advanceTimersByTimeAsync(5000);
};

describe('ChannelsStore.openChannel through openChannelSync', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        isLNDBased.mockReturnValue(true);
        supportsChannelMemo.mockReturnValue(true);
        getPendingChannels.mockResolvedValue({ pending_open_channels: [] });
        getChannels.mockResolvedValue({ channels: [] });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('attaches a memo on LND nodes that store one', async () => {
        openChannelSync.mockResolvedValue({
            funding_txid_str: 'abc',
            output_index: 0
        });
        open(makeStore());
        await settle();

        expect(sentRequest().memo.startsWith(OPEN_MEMO_PREFIX)).toBe(true);
    });

    it('attaches no memo where the node cannot store one', async () => {
        supportsChannelMemo.mockReturnValue(false);
        openChannelSync.mockResolvedValue({
            funding_txid_str: 'abc',
            output_index: 0
        });
        open(makeStore());
        await settle();

        expect(sentRequest().memo).toBeUndefined();
    });

    it('reports a timed out open that went through as opened', async () => {
        openChannelSync.mockRejectedValue(
            new Error('lnrpc.Lightning.OpenChannelSync timed out after 60000ms')
        );
        getPendingChannels.mockImplementation(async () => ({
            pending_open_channels: [
                {
                    channel: {
                        channel_point: 'funding:1',
                        memo: sentRequest().memo
                    }
                }
            ]
        }));
        const store = makeStore();
        open(store);
        await settle();

        expect(store.channelSuccess).toBe(true);
        expect(store.funding_txid_str).toBe('funding');
        expect(store.output_index).toBe(1);
        expect(store.errorOpenChannel).toBe(false);
        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.openingChannel).toBe(false);
    });

    it('blocks a second open when a timed out one cannot be found', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).toHaveBeenCalledTimes(3);
        expect(store.channelSuccess).toBe(false);
        expect(store.errorOpenChannel).toBe(true);
        expect(store.openOutcomeUnknown).toBe(true);
        expect(store.errorMsgChannel).toBe(
            'stores.ChannelsStore.openOutcomeUnknown'
        );
        expect(store.openingChannel).toBe(false);
    });

    it('treats a timeout as unknown without looking when no memo was sent', async () => {
        supportsChannelMemo.mockReturnValue(false);
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(true);
    });

    it('shows a node error as before, without looking it up', async () => {
        openChannelSync.mockRejectedValue(new Error('peer is not online'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.errorMsgChannel).toBe('peer is not online');
    });

    it('blocks a second open after a timeout on other backends', async () => {
        // e.g. CLN's fundchannel past the 30s REST timeout
        isLNDBased.mockReturnValue(false);
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(sentRequest().memo).toBeUndefined();
        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(true);
        expect(store.errorMsgChannel).toBe(
            'stores.ChannelsStore.openOutcomeUnknown'
        );
    });

    it('shows a node error as before on other backends', async () => {
        isLNDBased.mockReturnValue(false);
        openChannelSync.mockRejectedValue(new Error('peer is not online'));
        const store = makeStore();
        open(store);
        await settle();

        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.errorMsgChannel).toBe('peer is not online');
    });

    it('drops a lookup result that lands after a reset', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        let answerLookup: (pending: any) => void = () => undefined;
        getPendingChannels.mockReturnValueOnce(
            new Promise((resolve) => {
                answerLookup = resolve;
            })
        );
        const store = makeStore();
        open(store);
        // the open has timed out and the lookup is waiting on its first call
        await jest.advanceTimersByTimeAsync(0);
        expect(getPendingChannels).toHaveBeenCalledTimes(1);
        store.resetOpenChannel();
        answerLookup({
            pending_open_channels: [
                {
                    channel: {
                        channel_point: 'funding:1',
                        memo: sentRequest().memo
                    }
                }
            ]
        });
        await settle();

        expect(store.channelSuccess).toBe(false);
        expect(store.funding_txid_str).toBe(null);
    });

    it('does not look up an open that timed out after a reset', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        store.resetOpenChannel();
        await settle();

        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(getChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(false);
    });

    it('drops an unknown outcome that lands after a reset', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await jest.advanceTimersByTimeAsync(0);
        store.resetOpenChannel();
        await settle();

        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.errorOpenChannel).toBe(false);
        expect(store.errorMsgChannel).toBe(null);
    });

    it("does not end a newer open with an earlier open's error", async () => {
        let rejectFirst: (error: Error) => void = () => undefined;
        openChannelSync.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectFirst = reject;
            })
        );
        const store = makeStore();
        open(store);

        openChannelSync.mockReturnValueOnce(new Promise(() => undefined));
        open(store);
        rejectFirst(new Error('peer is not online'));
        await settle();

        expect(store.errorOpenChannel).toBe(false);
        expect(store.errorMsgChannel).toBeFalsy();
        expect(store.openingChannel).toBe(true);
    });

    it('clears an unknown outcome when the open screen resets', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();
        expect(store.openOutcomeUnknown).toBe(true);

        store.resetOpenChannel();
        expect(store.openOutcomeUnknown).toBe(false);
    });
});

describe('ChannelsStore.syncOpensInFlight', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        isLNDBased.mockReturnValue(true);
        supportsChannelMemo.mockReturnValue(true);
        getPendingChannels.mockResolvedValue({ pending_open_channels: [] });
        getChannels.mockResolvedValue({ channels: [] });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('counts an open until it settles, across a reset', async () => {
        let rejectOpen: (error: Error) => void = () => undefined;
        openChannelSync.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectOpen = reject;
            })
        );
        const store = makeStore();
        expect(store.syncOpensInFlight).toBe(0);
        open(store);
        expect(store.syncOpensInFlight).toBe(1);

        // the user leaves the spinner and comes back to the screen
        store.resetOpenChannel();
        expect(store.openingChannel).toBe(false);
        expect(store.syncOpensInFlight).toBe(1);

        rejectOpen(new Error('Request timeout'));
        await settle();
        expect(store.syncOpensInFlight).toBe(0);
    });

    it('counts a timed out open until its lookup finishes', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);

        // first lookup done, waiting 5s before the second
        await jest.advanceTimersByTimeAsync(0);
        expect(getPendingChannels).toHaveBeenCalledTimes(1);
        expect(store.syncOpensInFlight).toBe(1);

        await settle();
        expect(getPendingChannels).toHaveBeenCalledTimes(3);
        expect(store.syncOpensInFlight).toBe(0);
    });

    it.each([
        [
            'an open',
            () =>
                openChannelSync.mockResolvedValue({
                    funding_txid_str: 'abc',
                    output_index: 0
                })
        ],
        [
            'a node error',
            () =>
                openChannelSync.mockRejectedValue(
                    new Error('peer is not online')
                )
        ],
        [
            'a timeout found by memo',
            () => {
                openChannelSync.mockRejectedValue(new Error('Request timeout'));
                getPendingChannels.mockImplementation(async () => ({
                    pending_open_channels: [
                        {
                            channel: {
                                channel_point: 'funding:1',
                                memo: sentRequest().memo
                            }
                        }
                    ]
                }));
            }
        ]
    ])('stops counting after %s', async (_outcome, setUp) => {
        setUp();
        const store = makeStore();
        open(store);
        await settle();

        expect(store.syncOpensInFlight).toBe(0);
    });

    it('counts each open', async () => {
        openChannelSync.mockReturnValue(new Promise(() => undefined));
        const store = makeStore();
        open(store);
        open(store);

        expect(store.syncOpensInFlight).toBe(2);
    });
});

describe('ChannelsStore.openChannel through openChannelStream', () => {
    const PSBT = 'cHNidP8BAFICAAAAAQ==';
    const never = () => new Promise<any>(() => undefined);

    const held = () => {
        let resolve: (value: any) => void = () => undefined;
        let reject: (error: Error) => void = () => undefined;
        const promise = new Promise<any>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    const psbtFund = (pending_chan_id: string) => ({
        result: {
            pending_chan_id,
            psbt_fund: {
                funding_address: `bc1q${pending_chan_id}`,
                funding_amount: 1,
                psbt: PSBT
            }
        }
    });

    // an account other than the default one funds the channel through a
    // PSBT, so the open goes through openChannelStream
    const openStreamed = (store: ChannelsStore) =>
        (store as any).openChannel(
            new OpenChannelRequest({
                node_pubkey_string: '02peer',
                local_funding_amount: '100000',
                sat_per_vbyte: '2',
                account: 'imported'
            })
        );

    // as OpenChannel does on mount
    const enterScreen = (store: ChannelsStore) => store.resetOpenChannel();

    const fundingSteps = () =>
        fundingStateStep.mock.calls.map(([step]: any) => step);

    const flush = async () => {
        for (let i = 0; i < 10; i++) {
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    };

    beforeEach(() => {
        jest.useRealTimers();
        [
            openChannelStream,
            fundPsbt,
            signPsbt,
            fundingStateStep,
            connectPeer,
            openChannelSync
        ].forEach((mock) => mock.mockReset());
        // a newer open stays pending unless a test answers it
        openChannelStream.mockImplementation(never);
        openChannelSync.mockImplementation(never);
        fundPsbt.mockResolvedValue({ funded_psbt: PSBT });
        signPsbt.mockResolvedValue({ signed_psbt: PSBT });
        fundingStateStep.mockResolvedValue({});
    });

    it('shows a current streamed open as opened', async () => {
        openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);
        await flush();

        expect(fundingSteps()).toEqual([
            { psbt_verify: { funded_psbt: PSBT, pending_chan_id: 'chan-1' } },
            {
                psbt_finalize: { signed_psbt: PSBT, pending_chan_id: 'chan-1' }
            }
        ]);
        expect(store.channelSuccess).toBe(true);
        expect(store.errorOpenChannel).toBe(false);
        expect(store.openingChannel).toBe(false);
    });

    it.each([
        [
            'the stream',
            (error: Error) => openChannelStream.mockRejectedValueOnce(error)
        ],
        [
            'funding the PSBT',
            (error: Error) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                fundPsbt.mockRejectedValueOnce(error);
            }
        ],
        [
            'verifying the PSBT',
            (error: Error) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                fundingStateStep.mockRejectedValueOnce(error);
            }
        ],
        [
            'publishing',
            (error: Error) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                fundingStateStep.mockResolvedValueOnce({
                    publish_error: error.message
                });
            }
        ]
    ])('shows a current streamed open failing at %s', async (_, failWith) => {
        failWith(new Error('peer is not online'));
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);
        await flush();

        expect(store.errorOpenChannel).toBe(true);
        expect(store.errorMsgChannel).toBe('peer is not online');
        expect(store.openingChannel).toBe(false);
        expect(store.channelSuccess).toBe(false);
    });

    it("hands a current open's unsigned PSBT to the PSBT screen", async () => {
        openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
        // an imported account has no keys on the node
        signPsbt.mockRejectedValue(new Error('no keys'));
        fundingStateStep.mockImplementation(async (step: any) =>
            step.psbt_finalize ? { publish_error: 'not signed' } : {}
        );
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);
        await flush();

        expect(store.funded_psbt).toBe(PSBT);
        expect(store.errorOpenChannel).toBe(true);
        expect(store.openingChannel).toBe(false);
    });

    it("does not show a superseded open's channel as the newer open's", async () => {
        const first = held();
        openChannelStream.mockReturnValueOnce(first.promise);
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);

        // the user leaves the spinner, comes back and opens again
        enterScreen(store);
        openStreamed(store);
        first.resolve(psbtFund('chan-1'));
        await flush();

        expect(store.channelSuccess).toBe(false);
        expect(store.errorOpenChannel).toBe(false);
        expect(store.openingChannel).toBe(true);
        expect(store.funding_txid_str).toBe(null);
        // the earlier open still funds its own channel on the node, and
        // its channel stays out of the newer open's list
        expect(fundingSteps()).toEqual([
            { psbt_verify: { funded_psbt: PSBT, pending_chan_id: 'chan-1' } },
            {
                psbt_finalize: { signed_psbt: PSBT, pending_chan_id: 'chan-1' }
            }
        ]);
        expect(store.pending_chan_ids).toEqual([]);
    });

    it.each([
        [
            'the stream',
            (hold: Promise<any>) => openChannelStream.mockReturnValueOnce(hold)
        ],
        [
            'funding the PSBT',
            (hold: Promise<any>) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                fundPsbt.mockReturnValueOnce(hold);
            }
        ],
        [
            'verifying the PSBT',
            (hold: Promise<any>) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                fundingStateStep.mockReturnValueOnce(hold);
            }
        ]
    ])(
        "does not end a newer open with a superseded open's error at %s",
        async (_, holdAt) => {
            const step = held();
            holdAt(step.promise);
            const store = makeStore();
            enterScreen(store);
            openStreamed(store);
            await flush();

            enterScreen(store);
            openStreamed(store);
            step.reject(new Error('peer is not online'));
            await flush();

            expect(store.errorOpenChannel).toBe(false);
            expect(store.errorMsgChannel).toBe(null);
            // submit stays disabled while the newer open runs
            expect(store.openingChannel).toBe(true);
        }
    );

    it("does not end a newer open with a superseded open's publish error", async () => {
        const verify = held();
        openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
        fundingStateStep.mockReturnValueOnce(verify.promise);
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);
        await flush();

        enterScreen(store);
        openStreamed(store);
        verify.resolve({ publish_error: 'peer is not online' });
        await flush();

        expect(store.errorOpenChannel).toBe(false);
        expect(store.errorMsgChannel).toBe(null);
        expect(store.openingChannel).toBe(true);
    });

    it.each([
        ['is refused', (finalize: any) => finalize.reject(new Error('no'))],
        [
            'reports a publish error',
            (finalize: any) => finalize.resolve({ publish_error: 'not signed' })
        ]
    ])(
        "does not hand a superseded open's PSBT to the PSBT screen when its finalize %s",
        async (_, land) => {
            const finalize = held();
            openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
            signPsbt.mockRejectedValue(new Error('no keys'));
            fundingStateStep.mockImplementation((step: any) =>
                step.psbt_finalize ? finalize.promise : Promise.resolve({})
            );
            const store = makeStore();
            enterScreen(store);
            openStreamed(store);
            await flush();
            expect(fundingSteps()).toHaveLength(2);

            enterScreen(store);
            openStreamed(store);
            land(finalize);
            await flush();

            // OpenChannel navigates to the PSBT screen when this is set
            expect(store.funded_psbt).toBe('');
            expect(store.errorOpenChannel).toBe(false);
            expect(store.openingChannel).toBe(true);
        }
    );

    it('funds a newer open with only its own channel when a superseded stream lands mid-open', async () => {
        const first = held();
        const secondFunding = held();
        openChannelStream
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce(psbtFund('chan-2'));
        fundPsbt
            .mockReturnValueOnce(secondFunding.promise)
            .mockResolvedValueOnce({ funded_psbt: 'psbt-1' });
        // keep each open's PSBT so the steps show which open sent them
        signPsbt.mockResolvedValue({});
        const store = makeStore();
        enterScreen(store);
        openStreamed(store);

        enterScreen(store);
        openStreamed(store);
        await flush();
        first.resolve(psbtFund('chan-1'));
        await flush();
        secondFunding.resolve({ funded_psbt: 'psbt-2' });
        await flush();

        expect(fundingSteps()).toHaveLength(4);
        expect(fundingSteps()).toEqual(
            expect.arrayContaining([
                {
                    psbt_verify: {
                        funded_psbt: 'psbt-1',
                        pending_chan_id: 'chan-1'
                    }
                },
                {
                    psbt_finalize: {
                        signed_psbt: 'psbt-1',
                        pending_chan_id: 'chan-1'
                    }
                },
                {
                    psbt_verify: {
                        funded_psbt: 'psbt-2',
                        pending_chan_id: 'chan-2'
                    }
                },
                {
                    psbt_finalize: {
                        signed_psbt: 'psbt-2',
                        pending_chan_id: 'chan-2'
                    }
                }
            ])
        );
        expect(store.pending_chan_ids).toEqual(['chan-2']);
        expect(store.channelSuccess).toBe(true);
        expect(store.openingChannel).toBe(false);
    });

    it.each([
        ['connects', (connect: any) => connect.resolve({})],
        [
            'was already connected',
            (connect: any) =>
                connect.reject(new Error('already connected to peer'))
        ]
    ])(
        'does not open a channel when a peer that %s lands after a reset',
        async (_, land) => {
            const connect = held();
            connectPeer.mockReturnValueOnce(connect.promise);
            const store = makeStore();
            const connecting = store.connectPeer(
                new OpenChannelRequest({
                    node_pubkey_string: '02peer',
                    host: 'peer.example.com:9735',
                    local_funding_amount: '100000',
                    sat_per_vbyte: '2',
                    account: 'default'
                })
            );
            await flush();

            // the user leaves while the peer connects and comes back
            enterScreen(store);
            land(connect);
            await connecting;
            await flush();

            expect(store.channelRequest).toBeFalsy();
            expect(openChannelSync).not.toHaveBeenCalled();
            expect(openChannelStream).not.toHaveBeenCalled();
        }
    );

    describe('syncOpensInFlight', () => {
        const openBatch = (store: ChannelsStore, extra = 1) =>
            (store as any).openChannel(
                new OpenChannelRequest({
                    node_pubkey_string: '02peer',
                    local_funding_amount: '100000',
                    sat_per_vbyte: '2',
                    account: 'default',
                    additionalChannels: Array.from(
                        { length: extra },
                        (_, i) => ({
                            node_pubkey_string: `02extra${i}`,
                            satAmount: '50000'
                        })
                    )
                })
            );

        it('counts a streamed open until it finishes, across a reset', async () => {
            const first = held();
            openChannelStream.mockReturnValueOnce(first.promise);
            const store = makeStore();
            enterScreen(store);
            openStreamed(store);
            expect(store.syncOpensInFlight).toBe(1);

            // the user leaves the spinner and comes back to the screen
            enterScreen(store);
            expect(store.openingChannel).toBe(false);
            // so OpenChannel offers no second open yet
            expect(store.syncOpensInFlight).toBe(1);

            first.resolve(psbtFund('chan-1'));
            await flush();
            expect(store.syncOpensInFlight).toBe(0);
        });

        it.each([
            ['opens', () => undefined],
            [
                'fails at the stream',
                () => {
                    // drop the answer queued below
                    openChannelStream.mockReset();
                    openChannelStream.mockRejectedValueOnce(
                        new Error('peer is not online')
                    );
                }
            ],
            [
                'fails funding the PSBT',
                () => fundPsbt.mockRejectedValueOnce(new Error('no funds'))
            ],
            [
                'fails verifying the PSBT',
                () =>
                    fundingStateStep.mockRejectedValueOnce(
                        new Error('psbt invalid')
                    )
            ],
            [
                'gets a publish error on verify',
                () =>
                    fundingStateStep.mockResolvedValueOnce({
                        publish_error: 'peer is not online'
                    })
            ],
            [
                'fails finalizing',
                () =>
                    fundingStateStep.mockImplementation(async (step: any) => {
                        if (step.psbt_finalize) throw new Error('no');
                        return {};
                    })
            ],
            [
                'hands the PSBT to the user to sign',
                () => {
                    signPsbt.mockRejectedValue(new Error('no keys'));
                    fundingStateStep.mockImplementation(async (step: any) =>
                        step.psbt_finalize
                            ? { publish_error: 'not signed' }
                            : {}
                    );
                }
            ]
        ])('stops counting a streamed open that %s', async (_, setUp) => {
            openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
            setUp();
            const store = makeStore();
            enterScreen(store);
            openStreamed(store);
            expect(store.syncOpensInFlight).toBe(1);

            await flush();
            expect(store.syncOpensInFlight).toBe(0);
        });

        it.each([
            ['opens', (first: any) => first.resolve(psbtFund('chan-1'))],
            [
                'fails',
                (first: any) => first.reject(new Error('peer is not online'))
            ]
        ])(
            'stops counting a superseded streamed open that %s',
            async (_, land) => {
                const first = held();
                openChannelStream.mockReturnValueOnce(first.promise);
                const store = makeStore();
                enterScreen(store);
                openStreamed(store);

                enterScreen(store);
                openStreamed(store);
                expect(store.syncOpensInFlight).toBe(2);

                land(first);
                await flush();
                // the newer open is still pending
                expect(store.syncOpensInFlight).toBe(1);
            }
        );

        it('counts a batch open once until the batch finishes', async () => {
            const last = held();
            openChannelStream
                .mockResolvedValueOnce(psbtFund('chan-a'))
                .mockReturnValueOnce(last.promise);
            const store = makeStore();
            enterScreen(store);
            openBatch(store);
            await flush();
            expect(store.syncOpensInFlight).toBe(1);

            last.resolve(psbtFund('chan-b'));
            await flush();
            expect(store.channelSuccess).toBe(true);
            expect(store.syncOpensInFlight).toBe(0);
        });

        it('stops counting a batch once when a channel fails', async () => {
            openChannelStream
                .mockResolvedValueOnce(psbtFund('chan-a'))
                .mockRejectedValueOnce(new Error('peer is not online'))
                .mockResolvedValueOnce(psbtFund('chan-c'));
            const store = makeStore();
            enterScreen(store);
            openBatch(store, 2);
            expect(store.syncOpensInFlight).toBe(1);

            await flush();
            // the batch stops at the failed channel, so the last one is
            // not opened
            expect(openChannelStream).toHaveBeenCalledTimes(2);
            expect(store.syncOpensInFlight).toBe(0);
        });
    });

    describe('a silent connectPeer', () => {
        // the LSP connects ZEUS makes on its own (LSPStore info refresh,
        // the LSP invoice in InvoicesStore, the LSPS1 screen)
        const lspConnect = (store: ChannelsStore) =>
            store.connectPeer(
                {
                    node_pubkey_string: '03lsp',
                    host: 'lsp.example.com:9735',
                    local_funding_amount: ''
                } as any,
                false,
                true,
                true
            );

        const userConnect = (store: ChannelsStore, connectPeerOnly = false) =>
            store.connectPeer(
                new OpenChannelRequest({
                    node_pubkey_string: '02peer',
                    host: 'peer.example.com:9735',
                    local_funding_amount: '100000',
                    sat_per_vbyte: '2',
                    account: 'default'
                }),
                false,
                connectPeerOnly
            );

        const openState = (store: ChannelsStore) => ({
            channelSuccess: store.channelSuccess,
            openingChannel: store.openingChannel,
            errorOpenChannel: store.errorOpenChannel,
            errorMsgChannel: store.errorMsgChannel,
            funding_txid_str: store.funding_txid_str,
            output_index: store.output_index,
            funded_psbt: store.funded_psbt,
            pending_chan_ids: [...store.pending_chan_ids],
            channelRequest: store.channelRequest,
            peerSuccess: store.peerSuccess,
            connectingToPeer: store.connectingToPeer,
            errorPeerConnect: store.errorPeerConnect,
            errorMsgPeer: store.errorMsgPeer
        });

        const lspAnswers: Array<[string, () => void]> = [
            ['connects', () => connectPeer.mockResolvedValueOnce({})],
            [
                'fails',
                () =>
                    connectPeer.mockRejectedValueOnce(
                        new Error('peer is not online')
                    )
            ]
        ];

        it.each(lspAnswers)(
            "lets the user's channel open when a silent connect %s during the user's connect",
            async (_, lspAnswer) => {
                const user = held();
                connectPeer.mockReturnValueOnce(user.promise);
                const store = makeStore();
                enterScreen(store);
                const connecting = userConnect(store);
                await flush();

                lspAnswer();
                await lspConnect(store).catch(() => undefined);
                expect(store.connectingToPeer).toBe(true);

                user.resolve({});
                await connecting;
                await flush();

                expect(openChannelSync).toHaveBeenCalledTimes(1);
                expect(
                    openChannelSync.mock.calls[0][0].node_pubkey_string
                ).toBe('02peer');
                expect(store.openingChannel).toBe(true);
            }
        );

        it.each(lspAnswers)(
            'keeps an open running when a silent connect %s',
            async (_, lspAnswer) => {
                const first = held();
                openChannelSync.mockReturnValueOnce(first.promise);
                const store = makeStore();
                enterScreen(store);
                open(store);

                lspAnswer();
                await lspConnect(store).catch(() => undefined);
                // submit stays disabled while the open runs
                expect(store.openingChannel).toBe(true);

                first.resolve({ funding_txid_str: 'abc', output_index: 0 });
                await flush();

                expect(store.channelSuccess).toBe(true);
                expect(store.funding_txid_str).toBe('abc');
            }
        );

        it.each(lspAnswers)(
            "leaves an opened channel's state alone when a silent connect %s",
            async (_, lspAnswer) => {
                openChannelSync.mockResolvedValueOnce({
                    funding_txid_str: 'abc',
                    output_index: 0
                });
                const store = makeStore();
                enterScreen(store);
                open(store);
                await flush();
                expect(store.channelSuccess).toBe(true);
                const before = openState(store);

                lspAnswer();
                await lspConnect(store).catch(() => undefined);

                expect(openState(store)).toEqual(before);
            }
        );

        it.each(lspAnswers)(
            'leaves a PSBT handed to the user alone when a silent connect %s',
            async (_, lspAnswer) => {
                openChannelStream.mockResolvedValueOnce(psbtFund('chan-1'));
                signPsbt.mockRejectedValue(new Error('no keys'));
                fundingStateStep.mockImplementation(async (step: any) =>
                    step.psbt_finalize ? { publish_error: 'not signed' } : {}
                );
                const store = makeStore();
                enterScreen(store);
                openStreamed(store);
                await flush();
                expect(store.funded_psbt).toBe(PSBT);
                expect(store.pending_chan_ids).toEqual(['chan-1']);
                const before = openState(store);

                lspAnswer();
                await lspConnect(store).catch(() => undefined);

                expect(openState(store)).toEqual(before);
            }
        );

        it.each(lspAnswers)(
            "leaves the user's peer error alone when a silent connect %s",
            async (_, lspAnswer) => {
                connectPeer.mockRejectedValueOnce(
                    new Error('connection refused')
                );
                const store = makeStore();
                enterScreen(store);
                await userConnect(store, true).catch(() => undefined);
                expect(store.errorMsgPeer).toBe('connection refused');
                const before = openState(store);

                lspAnswer();
                await lspConnect(store).catch(() => undefined);

                expect(openState(store)).toEqual(before);
            }
        );

        it("still resets an opened channel's state for the user's own connect", async () => {
            openChannelSync.mockResolvedValueOnce({
                funding_txid_str: 'abc',
                output_index: 0
            });
            connectPeer.mockResolvedValueOnce({});
            const store = makeStore();
            enterScreen(store);
            open(store);
            await flush();
            expect(store.channelSuccess).toBe(true);

            await userConnect(store, true);

            expect(store.channelSuccess).toBe(false);
            expect(store.funding_txid_str).toBe(null);
            expect(store.peerSuccess).toBe(true);
        });

        it("still drops an open's result after the user's own connect", async () => {
            const first = held();
            openChannelSync.mockReturnValueOnce(first.promise);
            connectPeer.mockResolvedValueOnce({});
            const store = makeStore();
            enterScreen(store);
            open(store);

            await userConnect(store, true);
            first.resolve({ funding_txid_str: 'abc', output_index: 0 });
            await flush();

            expect(store.channelSuccess).toBe(false);
            expect(store.funding_txid_str).toBe(null);
        });
    });
});
