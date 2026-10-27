jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({
    Transaction: { fromHex: () => ({ getId: () => 'batchtxid' }) }
}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        isLNDBased: jest.fn(() => true),
        supportsOnchainSendMax: jest.fn(() => true),
        sendCoins: jest.fn(),
        getTransactions: jest.fn(),
        getClass: jest.fn(() => ({ publishTransaction: true })),
        fundPsbt: jest.fn(),
        finalizePsbt: jest.fn(),
        publishTransaction: jest.fn()
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import TransactionsStore from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';
import { SEND_LABEL_PREFIX } from '../utils/OnchainSendUtils';
import {
    markHttpStatus,
    markJsonRpcCode,
    markRequestNotSent,
    markRestErrorResponse
} from '../utils/PaymentLookupUtils';

const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
const sendCoins = BackendUtils.sendCoins as jest.Mock;
const getTransactions = BackendUtils.getTransactions as jest.Mock;
const fundPsbt = BackendUtils.fundPsbt as jest.Mock;
const finalizePsbt = BackendUtils.finalizePsbt as jest.Mock;
const publishTransaction = BackendUtils.publishTransaction as jest.Mock;

const newStore = (currentBlockHeight = 800000, implementation = 'lnd') =>
    new TransactionsStore(
        { implementation, settings: {} } as any,
        { nodeInfo: { currentBlockHeight } } as any,
        { resetOpenChannel: jest.fn() } as any,
        { getCombinedBalance: jest.fn() } as any,
        {} as any
    );

const request = () => ({
    addr: 'bc1qrecipient',
    amount: '100000',
    sat_per_vbyte: '2'
});

// lnd's REST gateway answers a refused send with HTTP 500 and a gRPC code
const lndError = (message: string) =>
    markRestErrorResponse(new Error(message), 2, 500);

// clnrest answers a refused withdraw with HTTP 500 and a JSON-RPC body
const clnError = (message: string) =>
    markJsonRpcCode(markHttpStatus(new Error(message), 500), {
        code: 301,
        message
    });

// LND's REST gateway answers with a gRPC transport code when it can't reach
// lnd, or the call to lnd broke off
const gatewayError = (code: number, status: number, message: string) =>
    markRestErrorResponse(new Error(message), code, status);

// runs the send, then every lookup and the 5s waits between them
const settle = async () => {
    for (let i = 0; i < 4; i++) await jest.advanceTimersByTimeAsync(5000);
};

describe('TransactionsStore.sendCoins', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        isLNDBased.mockReset().mockReturnValue(true);
        sendCoins.mockReset();
        getTransactions.mockReset();
        fundPsbt.mockReset().mockResolvedValue({ funded_psbt: 'cHNidP8B' });
        finalizePsbt.mockReset().mockResolvedValue({ raw_final_tx: '0200' });
        publishTransaction.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('labels sends on LND backends', async () => {
        sendCoins.mockResolvedValue({ txid: 'abc' });
        newStore().sendCoins(request());
        await settle();

        const sent = sendCoins.mock.calls[0][0];
        expect(sent.label.startsWith(SEND_LABEL_PREFIX)).toBe(true);
        expect(sent).toMatchObject(request());
    });

    it('does not label sends on other backends', async () => {
        isLNDBased.mockReturnValue(false);
        sendCoins.mockResolvedValue({ txid: 'abc' });
        newStore().sendCoins(request());
        await settle();

        expect(sendCoins.mock.calls[0][0]).not.toHaveProperty('label');
    });

    it('reports a send that answers in time', async () => {
        sendCoins.mockResolvedValue({ txid: 'abc' });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('abc');
        expect(getTransactions).not.toHaveBeenCalled();
    });

    it('reports a timed out send that was broadcast as sent', async () => {
        sendCoins.mockRejectedValue(
            new Error('lnrpc.Lightning.SendCoins timed out after 60000ms')
        );
        getTransactions.mockImplementation(async () => ({
            transactions: [
                {
                    tx_hash: 'broadcast',
                    label: sendCoins.mock.calls[0][0].label
                }
            ]
        }));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('broadcast');
        expect(store.error).toBe(false);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('only looks in recent blocks and unconfirmed transactions', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        newStore(800000).sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledWith({
            start_height: 799994
        });
    });

    it('looks through all transactions when the height is unknown', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        newStore(0).sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledWith(undefined);
    });

    it('offers no retry when a timed out send cannot be found', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({
            transactions: [{ tx_hash: 'older', label: 'ZEUS send ffff' }]
        });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(getTransactions).toHaveBeenCalledTimes(3);
        expect(store.publishSuccess).toBe(false);
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error_msg).toBe(
            'stores.TransactionsStore.sendOutcomeUnknown'
        );
        expect(store.loading).toBe(false);
    });

    it('offers no retry when the lookups fail too', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockRejectedValue(new Error('Request timeout'));
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error).toBe(true);
    });

    it('shows a node error as before, without looking it up', async () => {
        sendCoins.mockRejectedValue(
            lndError('insufficient funds available to construct transaction')
        );
        const store = newStore();
        store.sendCoins(request());
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error_msg).toBe(
            'insufficient funds available to construct transaction'
        );
    });

    it('offers no retry for a timeout on backends that do not label', async () => {
        // e.g. CLN's withdraw past the 30s REST timeout
        isLNDBased.mockReturnValue(false);
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        const store = newStore(800000, 'cln-rest');
        store.sendCoins(request());
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error).toBe(true);
        expect(store.loading).toBe(false);
        expect(store.error_msg).toBe(
            'stores.TransactionsStore.sendOutcomeUnknown'
        );
    });

    it('shows a node error as before on backends that do not label', async () => {
        isLNDBased.mockReturnValue(false);
        sendCoins.mockRejectedValue(clnError('insufficient funds'));
        const store = newStore(800000, 'cln-rest');
        store.sendCoins(request());
        await settle();

        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error_msg).toBe('insufficient funds');
    });

    it('drops a lookup result that lands after a reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockImplementation(async () => ({
            transactions: [
                {
                    tx_hash: 'old',
                    label: sendCoins.mock.calls[0][0].label
                }
            ]
        }));
        const store = newStore();
        store.sendCoins(request());
        // the send has timed out and the lookup is waiting on its first call
        store.reset();
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('drops an unknown outcome that lands after a reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await jest.advanceTimersByTimeAsync(0);
        store.reset();
        await settle();

        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBe(null);
    });

    it("does not report an earlier send's txid for a newer send", async () => {
        sendCoins.mockRejectedValueOnce(new Error('Request timeout'));
        let answerLookup: (result: any) => void = () => undefined;
        getTransactions.mockReturnValueOnce(
            new Promise((resolve) => {
                answerLookup = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(request());
        await jest.advanceTimersByTimeAsync(0);
        expect(getTransactions).toHaveBeenCalledTimes(1);

        // the newer send is still waiting on the node when the earlier
        // send's lookup finds it
        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        answerLookup({
            transactions: [
                { tx_hash: 'old', label: sendCoins.mock.calls[0][0].label }
            ]
        });
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.loading).toBe(true);
    });

    it("does not end a newer send with an earlier send's error", async () => {
        let rejectFirst: (error: Error) => void = () => undefined;
        sendCoins.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectFirst = reject;
            })
        );
        const store = newStore();
        store.sendCoins(request());

        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        rejectFirst(new Error('insufficient funds'));
        await settle();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBe(null);
        expect(store.loading).toBe(true);
    });

    it('clears an unknown outcome when the next send starts', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await settle();
        expect(store.sendOutcomeUnknown).toBe(true);

        sendCoins.mockReturnValue(new Promise(() => undefined));
        store.sendCoins(request());
        expect(store.sendOutcomeUnknown).toBe(false);
    });

    it('clears an unknown outcome on reset', async () => {
        sendCoins.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({ transactions: [] });
        const store = newStore();
        store.sendCoins(request());
        await settle();

        store.reset();
        expect(store.sendOutcomeUnknown).toBe(false);
    });
    it('drops a send that answers after a reset', async () => {
        let answer: (data: any) => void = () => undefined;
        sendCoins.mockReturnValueOnce(
            new Promise((resolve) => {
                answer = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(request());
        store.reset();
        answer({ txid: 'old' });
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
    });

    it("does not report an earlier send's answer for a newer send", async () => {
        let answer: (data: any) => void = () => undefined;
        sendCoins.mockReturnValueOnce(
            new Promise((resolve) => {
                answer = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(request());

        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        answer({ txid: 'old' });
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.loading).toBe(true);
    });

    it('skips the lookup for a send that timed out after a reset', async () => {
        let rejectFirst: (error: Error) => void = () => undefined;
        sendCoins.mockReturnValueOnce(
            new Promise((_, reject) => {
                rejectFirst = reject;
            })
        );
        const store = newStore();
        store.sendCoins(request());
        store.reset();
        rejectFirst(new Error('Request timeout'));
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.sendOutcomeUnknown).toBe(false);
    });

    describe('after a failure other than a timeout', () => {
        const foundByLabel = () =>
            getTransactions.mockImplementation(async () => ({
                transactions: [
                    {
                        tx_hash: 'broadcast',
                        label: sendCoins.mock.calls[0][0].label
                    }
                ]
            }));

        it.each([
            [
                'a dropped connection over REST',
                'lnd',
                new Error('unexpected end of stream')
            ],
            [
                "a proxy's gateway error over REST",
                'lnd',
                markHttpStatus(new Error('Bad Gateway'), 502)
            ],
            [
                'a dropped LNC connection',
                'lightning-node-connect',
                new Error(
                    'rpc error: code = Unavailable desc = transport is closing'
                )
            ],
            [
                "the REST gateway's Canceled",
                'lnd',
                gatewayError(1, 499, 'context canceled')
            ],
            [
                "the REST gateway's DeadlineExceeded",
                'lnd',
                gatewayError(4, 504, 'context deadline exceeded')
            ],
            [
                "the REST gateway's Internal",
                'lnd',
                gatewayError(13, 500, 'stream terminated by RST_STREAM')
            ],
            [
                "the REST gateway's Unavailable",
                'lnd',
                gatewayError(14, 503, 'transport is closing')
            ],
            [
                "Cloudflare's 520 over REST",
                'lnd',
                markHttpStatus(new Error('error code: 520'), 520)
            ]
        ])(
            'reports a send found after %s as sent',
            async (_, implementation, error) => {
                sendCoins.mockRejectedValue(error);
                foundByLabel();
                const store = newStore(800000, implementation as string);
                store.sendCoins(request());
                await settle();

                expect(store.publishSuccess).toBe(true);
                expect(store.txid).toBe('broadcast');
                expect(store.error).toBe(false);
            }
        );

        it("offers no retry when a send after the REST gateway's Unavailable is not found", async () => {
            sendCoins.mockRejectedValue(
                gatewayError(14, 503, 'transport is closing')
            );
            getTransactions.mockResolvedValue({ transactions: [] });
            const store = newStore();
            store.sendCoins(request());
            await settle();

            expect(getTransactions).toHaveBeenCalledTimes(3);
            expect(store.sendOutcomeUnknown).toBe(true);
        });

        it('offers no retry when a send after a dropped connection is not found', async () => {
            sendCoins.mockRejectedValue(new Error('connection closed'));
            getTransactions.mockResolvedValue({ transactions: [] });
            const store = newStore();
            store.sendCoins(request());
            await settle();

            expect(getTransactions).toHaveBeenCalledTimes(3);
            expect(store.sendOutcomeUnknown).toBe(true);
            expect(store.error_msg).toBe(
                'stores.TransactionsStore.sendOutcomeUnknown'
            );
        });

        it.each([
            [
                'an LNC node error',
                'lightning-node-connect',
                new Error(
                    'rpc error: code = Unknown desc = insufficient funds available to construct transaction'
                )
            ],
            [
                'an LNC connection that is not ready',
                'lightning-node-connect',
                new Error('RPC connection not ready')
            ],
            [
                "a proxy's refusal over REST",
                'lnd',
                markHttpStatus(new Error('Unauthorized'), 401)
            ],
            [
                'an LNC client that is reconnecting',
                'lightning-node-connect',
                markRequestNotSent(
                    new Error(
                        'Failed to connect the LNC client to the proxy server'
                    )
                )
            ],
            ['Tor not running', 'lnd', new Error('Tor service not running')],
            [
                'a refused connection to an offline node',
                'lnd',
                new Error(
                    'Failed to connect to node.example.com/203.0.113.5:8080'
                )
            ],
            [
                'an unresolved CLNRest host on iOS',
                'cln-rest',
                new Error(
                    'A server with the specified hostname could not be found.'
                )
            ],
            [
                'an embedded LND error',
                'embedded-lnd',
                new Error(
                    'insufficient funds available to construct transaction'
                )
            ]
        ])('offers Try Again after %s', async (_, implementation, error) => {
            sendCoins.mockRejectedValue(error);
            const store = newStore(800000, implementation as string);
            store.sendCoins(request());
            await settle();

            expect(getTransactions).not.toHaveBeenCalled();
            expect(store.error).toBe(true);
            expect(store.sendOutcomeUnknown).toBe(false);
        });

        it("offers no retry after Cloudflare's 520 in front of CLNRest", async () => {
            isLNDBased.mockReturnValue(false);
            sendCoins.mockRejectedValue(
                markHttpStatus(new Error('error code: 520'), 520)
            );
            const store = newStore(800000, 'cln-rest');
            store.sendCoins(request());
            await settle();

            expect(store.sendOutcomeUnknown).toBe(true);
        });

        it('offers no retry after a dropped CLNRest connection', async () => {
            isLNDBased.mockReturnValue(false);
            sendCoins.mockRejectedValue(new Error('unexpected end of stream'));
            const store = newStore(800000, 'cln-rest');
            store.sendCoins(request());
            await settle();

            expect(getTransactions).not.toHaveBeenCalled();
            expect(store.sendOutcomeUnknown).toBe(true);
        });
    });
});

describe('TransactionsStore.sendCoins with additional outputs', () => {
    const batchedRequest = () => ({
        ...request(),
        account: 'default',
        additional_outputs: [
            { address: 'bc1qsecond', amount: '5000', satAmount: '5000' }
        ]
    });

    beforeEach(() => {
        jest.useFakeTimers();
        isLNDBased.mockReset().mockReturnValue(true);
        sendCoins.mockReset();
        getTransactions.mockReset();
        fundPsbt.mockReset().mockResolvedValue({ funded_psbt: 'cHNidP8B' });
        finalizePsbt.mockReset().mockResolvedValue({ raw_final_tx: '0200' });
        publishTransaction.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('reports a published transaction', async () => {
        publishTransaction.mockResolvedValue({});
        const store = newStore();
        store.sendCoins(batchedRequest());
        await settle();

        expect(sendCoins).not.toHaveBeenCalled();
        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('batchtxid');
        expect(getTransactions).not.toHaveBeenCalled();
    });

    it('reports a timed out publish that went out as sent', async () => {
        publishTransaction.mockRejectedValue(new Error('Request timeout'));
        getTransactions.mockResolvedValue({
            transactions: [
                { tx_hash: 'other', label: '' },
                { tx_hash: 'batchtxid', label: '' }
            ]
        });
        const store = newStore();
        store.sendCoins(batchedRequest());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('batchtxid');
        expect(store.error).toBe(false);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('offers no retry when a timed out publish cannot be found', async () => {
        publishTransaction.mockRejectedValue(
            new Error(
                'lnrpc.WalletKit.PublishTransaction timed out after 60000ms'
            )
        );
        getTransactions.mockResolvedValue({
            transactions: [{ tx_hash: 'other', label: '' }]
        });
        const store = newStore();
        store.sendCoins(batchedRequest());
        await settle();

        expect(getTransactions).toHaveBeenCalledTimes(3);
        expect(store.publishSuccess).toBe(false);
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(true);
        expect(store.error_msg).toBe(
            'stores.TransactionsStore.sendOutcomeUnknown'
        );
        expect(store.loading).toBe(false);
    });

    it('looks up a publish whose connection dropped', async () => {
        publishTransaction.mockRejectedValue(
            new Error('unexpected end of stream')
        );
        getTransactions.mockResolvedValue({
            transactions: [{ tx_hash: 'batchtxid', label: '' }]
        });
        const store = newStore();
        store.sendCoins(batchedRequest());
        await settle();

        expect(store.publishSuccess).toBe(true);
        expect(store.txid).toBe('batchtxid');
        expect(store.sendOutcomeUnknown).toBe(false);
    });

    it('shows a publish error as before, without looking it up', async () => {
        publishTransaction.mockResolvedValue({
            publish_error: 'insufficient fee'
        });
        const store = newStore();
        store.sendCoins(batchedRequest());
        await settle();

        expect(getTransactions).not.toHaveBeenCalled();
        expect(store.error).toBe(true);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.error_msg).toBe('insufficient fee');
    });

    // Send A's finalizePsbt answers after a reset and a newer send B,
    // which is still waiting on the node
    const finalizeAfterNewerSend = async () => {
        let finalizeA: (data: any) => void = () => undefined;
        finalizePsbt.mockReturnValueOnce(
            new Promise((resolve) => {
                finalizeA = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(batchedRequest());
        await jest.advanceTimersByTimeAsync(0);
        expect(finalizePsbt).toHaveBeenCalledTimes(1);

        store.reset();
        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        finalizeA({ raw_final_tx: '0200' });
        await settle();
        return store;
    };

    const expectNewerSendPending = (store: any) => {
        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.error).toBe(false);
        expect(store.sendOutcomeUnknown).toBe(false);
        expect(store.loading).toBe(true);
    };

    it.each([
        ['found', [{ tx_hash: 'batchtxid' }]],
        ['missing', []]
    ])(
        'does not publish an earlier send finalized after a newer send (lookup %s)',
        async (_, transactions) => {
            publishTransaction.mockRejectedValue(new Error('Request timeout'));
            getTransactions.mockResolvedValue({ transactions });
            const store = await finalizeAfterNewerSend();

            expect(publishTransaction).not.toHaveBeenCalled();
            expect(getTransactions).not.toHaveBeenCalled();
            expectNewerSendPending(store);
        }
    );

    it.each([
        ['found', [{ tx_hash: 'batchtxid' }]],
        ['missing', []]
    ])(
        'does not end a newer send with an earlier publish timeout (lookup %s)',
        async (_, transactions) => {
            let rejectPublish: (error: Error) => void = () => undefined;
            publishTransaction.mockReturnValueOnce(
                new Promise((_resolve, reject) => {
                    rejectPublish = reject;
                })
            );
            getTransactions.mockResolvedValue({ transactions });
            const store = newStore();
            store.sendCoins(batchedRequest());
            await jest.advanceTimersByTimeAsync(0);
            expect(publishTransaction).toHaveBeenCalledTimes(1);

            sendCoins.mockReturnValueOnce(new Promise(() => undefined));
            store.sendCoins(request());
            rejectPublish(new Error('Request timeout'));
            await settle();

            expect(getTransactions).not.toHaveBeenCalled();
            expectNewerSendPending(store);
        }
    );

    it('does not end a newer send with an earlier finalize error', async () => {
        let rejectFinalize: (error: Error) => void = () => undefined;
        finalizePsbt.mockReturnValueOnce(
            new Promise((_resolve, reject) => {
                rejectFinalize = reject;
            })
        );
        const store = newStore();
        store.sendCoins(batchedRequest());
        await jest.advanceTimersByTimeAsync(0);

        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        rejectFinalize(new Error('finalize failed'));
        await settle();

        expectNewerSendPending(store);
    });

    it('does not end a newer send with an earlier publish error', async () => {
        let answerPublish: (data: any) => void = () => undefined;
        publishTransaction.mockReturnValueOnce(
            new Promise((resolve) => {
                answerPublish = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(batchedRequest());
        await jest.advanceTimersByTimeAsync(0);

        sendCoins.mockReturnValueOnce(new Promise(() => undefined));
        store.sendCoins(request());
        answerPublish({ publish_error: 'insufficient fee' });
        await settle();

        expectNewerSendPending(store);
    });

    it('does not finalize an earlier send funded after a reset', async () => {
        let answerFund: (data: any) => void = () => undefined;
        fundPsbt.mockReturnValueOnce(
            new Promise((resolve) => {
                answerFund = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(batchedRequest());
        store.reset();
        answerFund({ funded_psbt: 'cHNidP8B' });
        await settle();

        expect(finalizePsbt).not.toHaveBeenCalled();
        expect(publishTransaction).not.toHaveBeenCalled();
    });

    it('drops a publish lookup result that lands after a reset', async () => {
        publishTransaction.mockRejectedValue(new Error('Request timeout'));
        let answerLookup: (result: any) => void = () => undefined;
        getTransactions.mockReturnValueOnce(
            new Promise((resolve) => {
                answerLookup = resolve;
            })
        );
        const store = newStore();
        store.sendCoins(batchedRequest());
        await jest.advanceTimersByTimeAsync(0);
        expect(getTransactions).toHaveBeenCalledTimes(1);

        store.reset();
        answerLookup({ transactions: [{ tx_hash: 'batchtxid' }] });
        await settle();

        expect(store.txid).toBe(null);
        expect(store.publishSuccess).toBe(false);
        expect(store.sendOutcomeUnknown).toBe(false);
    });
});
