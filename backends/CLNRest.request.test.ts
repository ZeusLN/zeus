// Shared request core of CLNRest (request -> restReq), its error
// fallback, the payment timeout race in payWithTimeout, and the
// capability flags. Kept apart from CLNRest.test.ts so open PRs editing
// that file do not conflict. CoreLightningRequestHandler is stubbed for
// the import cycle described in CLNRest.test.ts.
const mockFetch = jest.fn();
const mockConfig = jest.fn(() => ({ fetch: mockFetch }));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { config: (...args: any[]) => (mockConfig as any)(...args) }
}));

const mockSettingsStore: any = {};
const mockNodeInfoStore: any = { nodeInfo: {} };
// getters: the factory runs when CLNRest is imported, which is hoisted
// above the const declarations
jest.mock('../stores/Stores', () => ({
    get settingsStore() {
        return mockSettingsStore;
    },
    get nodeInfoStore() {
        return mockNodeInfoStore;
    }
}));

const mockDoTorRequest = jest.fn();
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: (...args: any[]) => mockDoTorRequest(...args),
    isOnionHttpsUrl: (url: string) => url.includes('.onion'),
    RequestMethod: {}
}));
jest.mock('./CoreLightningRequestHandler', () => ({
    getBalance: jest.fn(),
    getChainTransactions: jest.fn(),
    getOffchainBalance: jest.fn(),
    listPeers: jest.fn(),
    listClosedChannels: jest.fn(),
    listPeerChannels: jest.fn()
}));
jest.mock('../utils/LocaleUtils');

import CLNRest from './CLNRest';

const CONNECTION_ERROR = 'backends.LND.restReq.connectionError';
const PAYMENT_TIMED_OUT = 'views.SendingLightning.paymentTimedOut';

// Shape of a react-native-blob-util FetchBlobResponse: data is the raw
// body string, json() parses it (and throws on non-JSON).
const blobResponse = (status: number, data: any) => ({
    info: () => ({ status }),
    data,
    json: () => JSON.parse(data)
});

// fetch arguments of the nth call: [method, url, headers, body]
const fetchArgs = (n = 0) => mockFetch.mock.calls[n];

const cln = new CLNRest();

// Fake timers throughout: restReq never clears its own timeout timer, so
// real timers would keep jest alive for 30s after every request.
beforeEach(() => {
    jest.useFakeTimers();
    cln.clearCachedCalls();
    mockFetch.mockReset();
    mockConfig.mockClear();
    mockDoTorRequest.mockReset();
    Object.keys(mockSettingsStore).forEach(
        (key) => delete mockSettingsStore[key]
    );
    Object.assign(mockSettingsStore, {
        host: 'node.example.com',
        port: '3010',
        rune: 'rune-abc',
        certVerification: false,
        enableTor: false
    });
    mockNodeInfoStore.nodeInfo = { version: 'v25.02' };
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

describe('CLNRest.request', () => {
    it('posts JSON to the node URL with the rune header', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{"id":"02ab"}'));

        const result = await cln.postRequest('/v1/getinfo', { a: 1 });

        expect(result).toEqual({ id: '02ab' });
        expect(fetchArgs()).toEqual([
            'post',
            'https://node.example.com:3010/v1/getinfo',
            { Rune: 'rune-abc', 'Content-Type': 'application/json' },
            '{"a":1}'
        ]);
    });

    it('sends no body when there is no data', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{}'));

        await cln.postRequest('/v1/listfunds');

        expect(fetchArgs()[3]).toBeUndefined();
    });

    it('appends params as a query string', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{}'));

        await cln.request('/v1/x', 'get', undefined, { a: 1, b: 'two' });

        expect(fetchArgs()[0]).toBe('get');
        expect(fetchArgs()[1]).toBe(
            'https://node.example.com:3010/v1/x?a=1&b=two'
        );
    });

    it('maps certVerification to trusty and applies the 30s default timeout', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{}'));

        await cln.postRequest('/v1/getinfo');
        mockSettingsStore.certVerification = true;
        await cln.postRequest('/v1/listfunds', undefined, 12000);

        expect(mockConfig.mock.calls).toEqual([
            [{ trusty: true, timeout: 30000 }],
            [{ trusty: false, timeout: 12000 }]
        ]);
    });

    it('parses the last complete line of a newline-delimited body', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{"n":1}\n{"n":2}\n'));

        await expect(cln.postRequest('/v1/stream')).resolves.toEqual({
            n: 2
        });
    });

    it('shares one in-flight request between identical calls', async () => {
        let resolve: (v: any) => void = () => {};
        mockFetch.mockReturnValue(new Promise((r) => (resolve = r)));

        const first = cln.postRequest('/v1/listnodes', { id: 'a' });
        const second = cln.postRequest('/v1/listnodes', { id: 'a' });
        resolve(blobResponse(200, '{"ok":true}'));

        await expect(first).resolves.toEqual({ ok: true });
        await expect(second).resolves.toEqual({ ok: true });
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not share requests whose bodies differ', async () => {
        mockFetch.mockResolvedValue(blobResponse(200, '{}'));

        await Promise.all([
            cln.postRequest('/v1/listnodes', { id: 'a' }),
            cln.postRequest('/v1/listnodes', { id: 'b' })
        ]);

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('issues a fresh request after a failed one', async () => {
        mockFetch
            .mockResolvedValueOnce(blobResponse(500, 'boom'))
            .mockResolvedValueOnce(blobResponse(200, '{"ok":true}'));

        await expect(cln.postRequest('/v1/getinfo')).rejects.toThrow('boom');
        await expect(cln.postRequest('/v1/getinfo')).resolves.toEqual({
            ok: true
        });
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('rejects with "Request timeout" when the node does not answer in time', async () => {
        mockFetch.mockReturnValue(new Promise(() => {}));

        const error = cln
            .postRequest('/v1/getinfo', undefined, 5000)
            .catch((e: Error) => e);
        await jest.advanceTimersByTimeAsync(5000);

        expect(await error).toEqual(new Error('Request timeout'));

        // the timed-out call is evicted from the cache, so a retry
        // reaches the node again
        mockFetch.mockResolvedValue(blobResponse(200, '{"ok":true}'));
        await expect(cln.postRequest('/v1/getinfo')).resolves.toEqual({
            ok: true
        });
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('routes through Tor with the request timeout when enableTor is set', async () => {
        mockSettingsStore.enableTor = true;
        mockSettingsStore.host = 'abc.onion';
        mockDoTorRequest.mockResolvedValue({ ok: true });

        const result = await cln.postRequest('/v1/getinfo', { a: 1 }, 7000);

        expect(result).toEqual({ ok: true });
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockDoTorRequest).toHaveBeenCalledWith(
            'https://abc.onion:3010/v1/getinfo',
            'post',
            '{"a":1}',
            { Rune: 'rune-abc', 'Content-Type': 'application/json' },
            true,
            7000
        );
    });

    it('keeps TLS validation for a clearnet host over Tor', async () => {
        mockSettingsStore.enableTor = true;
        mockDoTorRequest.mockResolvedValue({ ok: true });

        await cln.postRequest('/v1/getinfo');

        expect(mockDoTorRequest).toHaveBeenCalledWith(
            'https://node.example.com:3010/v1/getinfo',
            'post',
            undefined,
            { Rune: 'rune-abc', 'Content-Type': 'application/json' },
            false,
            undefined
        );
    });
});

// restReq's non-2xx branch builds a message from the JSON-RPC body
// (error.message, then message, then error) inside a try block whose own
// catch swallows that throw. The observable message is therefore always
// the raw body when it is a string, and the generic connection error
// otherwise. These tests pin that behaviour, so a fix that surfaces the
// parsed message has to update them.
describe('CLNRest.request error fallback', () => {
    const rejectWith = async (status: number, data: any) => {
        mockFetch.mockResolvedValue(blobResponse(status, data));
        const error = await cln.postRequest('/v1/pay').catch((e) => e);
        expect(error).toBeInstanceOf(Error);
        return error.message;
    };

    it('throws the raw body for a nested JSON-RPC error object', async () => {
        const body = JSON.stringify({
            error: { code: 210, message: 'Destination unknown' }
        });
        expect(await rejectWith(500, body)).toBe(body);
    });

    it('throws the raw body for a top-level message', async () => {
        const body = JSON.stringify({ code: -32602, message: 'bad param' });
        expect(await rejectWith(400, body)).toBe(body);
    });

    it('throws the raw body for a string error field', async () => {
        const body = JSON.stringify({ error: 'Not authorized' });
        expect(await rejectWith(401, body)).toBe(body);
    });

    it('throws the raw body for JSON with no message', async () => {
        const body = JSON.stringify({ code: 1 });
        expect(await rejectWith(500, body)).toBe(body);
    });

    it('throws a non-JSON string body as is', async () => {
        expect(await rejectWith(502, 'Bad Gateway')).toBe('Bad Gateway');
    });

    it('treats status 300 as an error', async () => {
        expect(await rejectWith(300, 'Multiple Choices')).toBe(
            'Multiple Choices'
        );
    });

    it('falls back to the connection error for an empty body', async () => {
        expect(await rejectWith(500, '')).toBe(CONNECTION_ERROR);
    });

    it('falls back to the connection error for a non-string body', async () => {
        const response = {
            info: () => ({ status: 500 }),
            data: { error: { message: 'object body' } },
            json: () => ({ error: { message: 'object body' } })
        };
        mockFetch.mockResolvedValue(response);

        await expect(cln.postRequest('/v1/pay')).rejects.toThrow(
            CONNECTION_ERROR
        );
    });

    it('propagates a transport failure unchanged', async () => {
        mockFetch.mockRejectedValue(new Error('Network request failed'));

        await expect(cln.postRequest('/v1/getinfo')).rejects.toThrow(
            'Network request failed'
        );
    });
});

describe('CLNRest payment timeout race', () => {
    // 32 zero bytes and its SHA256
    const PREIMAGE = '00'.repeat(32);
    const PREIMAGE_HASH =
        '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925';

    const hangingFetch = () => {
        let resolve: (v: any) => void = () => {};
        let reject: (e: any) => void = () => {};
        mockFetch.mockReturnValue(
            new Promise((res, rej) => {
                resolve = res;
                reject = rej;
            })
        );
        return {
            resolve: (v: any) => resolve(v),
            reject: (e: any) => reject(e)
        };
    };

    const settled = (promise: Promise<any>) => {
        const state: { done: boolean; value?: any } = { done: false };
        promise.then((value) => {
            state.done = true;
            state.value = value;
        });
        return state;
    };

    it('returns the payment-timed-out shape one second after retry_for', async () => {
        hangingFetch();

        const result = settled(
            cln.payLightningInvoice({
                payment_request: 'lnbc1',
                timeout_seconds: '30'
            })
        );

        await jest.advanceTimersByTimeAsync(30999);
        expect(result.done).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(result.done).toBe(true);
        // no status: complete, so the timed-out shape is never read as
        // a success
        expect(result.value).toEqual({ payment_error: PAYMENT_TIMED_OUT });
    });

    it('gives the transport four seconds of headroom past the race', async () => {
        hangingFetch();

        cln.payLightningInvoice({
            payment_request: 'lnbc1',
            timeout_seconds: '30'
        });
        await jest.advanceTimersByTimeAsync(0);

        expect(mockConfig).toHaveBeenCalledWith({
            trusty: true,
            timeout: 35000
        });
    });

    it('defaults to a 60 second deadline without timeout_seconds', async () => {
        hangingFetch();

        const result = settled(
            cln.payLightningInvoice({ payment_request: 'lnbc1' })
        );

        await jest.advanceTimersByTimeAsync(60999);
        expect(result.done).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(result.value).toEqual({ payment_error: PAYMENT_TIMED_OUT });
        expect(mockConfig).toHaveBeenCalledWith({
            trusty: true,
            timeout: 65000
        });
    });

    it('returns the xpay result with synthesized status and hash when payment wins', async () => {
        const fetch = hangingFetch();

        const result = settled(
            cln.payLightningInvoice({
                payment_request: 'lnbc1',
                timeout_seconds: '30'
            })
        );
        await jest.advanceTimersByTimeAsync(10000);
        fetch.resolve(
            blobResponse(
                200,
                JSON.stringify({
                    payment_preimage: PREIMAGE,
                    amount_msat: 1000
                })
            )
        );
        await jest.advanceTimersByTimeAsync(0);

        expect(result.value).toEqual({
            payment_preimage: PREIMAGE,
            amount_msat: 1000,
            status: 'complete',
            payment_hash: PREIMAGE_HASH
        });
        // the losing timer must not replace the result
        await jest.advanceTimersByTimeAsync(60000);
        expect(result.value.status).toBe('complete');
    });

    it('ignores a payment that lands after the timeout', async () => {
        const fetch = hangingFetch();

        const result = settled(
            cln.payLightningInvoice({
                payment_request: 'lnbc1',
                timeout_seconds: '10'
            })
        );
        await jest.advanceTimersByTimeAsync(11000);
        fetch.resolve(
            blobResponse(200, JSON.stringify({ payment_preimage: PREIMAGE }))
        );
        await jest.advanceTimersByTimeAsync(0);

        expect(result.value).toEqual({ payment_error: PAYMENT_TIMED_OUT });
    });

    it('rejects with the node error when the payment fails before the deadline', async () => {
        const fetch = hangingFetch();

        const error = cln
            .payLightningInvoice({
                payment_request: 'lnbc1',
                timeout_seconds: '30'
            })
            .catch((e: Error) => e);
        fetch.resolve(blobResponse(500, 'route not found'));
        await jest.advanceTimersByTimeAsync(0);

        expect(await error).toEqual(new Error('route not found'));
    });

    it('races the xkeysend call the same way', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v26.06' };
        const fetch = hangingFetch();

        const timedOut = settled(
            cln.sendKeysend({ pubkey: '02ab', amt: 100, timeout_seconds: 5 })
        );
        await jest.advanceTimersByTimeAsync(6000);
        expect(timedOut.value).toEqual({ payment_error: PAYMENT_TIMED_OUT });
        expect(fetchArgs()[1]).toBe(
            'https://node.example.com:3010/v1/xkeysend'
        );

        fetch.resolve(blobResponse(200, '{}'));
        cln.clearCachedCalls();
        mockFetch.mockResolvedValue(
            blobResponse(200, JSON.stringify({ payment_preimage: PREIMAGE }))
        );
        const paid = settled(
            cln.sendKeysend({ pubkey: '02ab', amt: 100, timeout_seconds: 5 })
        );
        await jest.advanceTimersByTimeAsync(0);
        expect(paid.value).toEqual({
            payment_preimage: PREIMAGE,
            status: 'complete',
            payment_hash: PREIMAGE_HASH
        });
    });

    it('does not add status to a legacy pay result', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.08' };
        mockFetch.mockResolvedValue(
            blobResponse(200, JSON.stringify({ status: 'failed' }))
        );

        const result = await cln.payLightningInvoice({
            payment_request: 'lnbc1',
            timeout_seconds: 30
        });

        expect(result).toEqual({ status: 'failed' });
    });
});

describe('CLNRest payment request bodies', () => {
    const sentBody = () => ({
        url: fetchArgs()[1],
        body: JSON.parse(fetchArgs()[3])
    });

    beforeEach(() => {
        mockFetch.mockResolvedValue(blobResponse(200, '{}'));
    });

    it('uses xpay from v24.11 with an absolute fee cap', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.11' };

        await cln.payLightningInvoice({
            payment_request: 'lnbc1',
            amt: 5,
            fee_limit_sat: 2,
            max_fee_percent: 3,
            timeout_seconds: 30
        });

        expect(sentBody()).toEqual({
            url: 'https://node.example.com:3010/v1/xpay',
            body: {
                invstring: 'lnbc1',
                retry_for: 30,
                amount_msat: 5000,
                maxfee: 2000
            }
        });
    });

    it('uses pay before v24.11, preferring maxfee over maxfeepercent', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.08' };

        await cln.payLightningInvoice({
            payment_request: 'lnbc1',
            fee_limit_sat: 2,
            max_fee_percent: 3,
            timeout_seconds: 30
        });

        expect(sentBody().url).toBe('https://node.example.com:3010/v1/pay');
        expect(sentBody().body).toMatchObject({
            bolt11: 'lnbc1',
            retry_for: 30,
            maxfee: 2000
        });
        expect(sentBody().body).not.toHaveProperty('maxfeepercent');
    });

    it('sends maxfeepercent on legacy pay when only a percent is set', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.08' };

        await cln.payLightningInvoice({
            payment_request: 'lnbc1',
            max_fee_percent: 3
        });

        expect(sentBody().body.maxfeepercent).toBe(3);
        expect(sentBody().body).not.toHaveProperty('maxfee');
    });

    it('uses keysend before v26.06 with maxfee from v24.11', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v25.02' };

        await cln.sendKeysend({ pubkey: '02ab', amt: 100, fee_limit_sat: 5 });

        expect(sentBody()).toEqual({
            url: 'https://node.example.com:3010/v1/keysend',
            body: { destination: '02ab', amount_msat: 100000, maxfee: 5000 }
        });
    });

    it('converts the fee cap to a percent on keysend before v24.11', async () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.08' };

        await cln.sendKeysend({ pubkey: '02ab', amt: 200, fee_limit_sat: 5 });
        expect(sentBody().body.maxfeepercent).toBe(2.5);

        cln.clearCachedCalls();
        mockFetch.mockClear();
        await cln.sendKeysend({ pubkey: '02ab', amt: 2, fee_limit_sat: 5 });
        expect(sentBody().body.maxfeepercent).toBe(100);
    });
});

describe('CLNRest capability flags', () => {
    // Every supports*/requires*/is*/single* flag with its expected value.
    // CLNRest is standalone (it does not extend LND), so each flag is
    // declared here and nothing is inherited.
    const expected: { [flag: string]: boolean } = {
        supportsPeers: true,
        supportsMessageSigning: true,
        supportsMessageVerification: true,
        requiresVerifyPubkey: false,
        supportsAddressMessageSigning: false,
        supportsLnurlAuth: true,
        supportsOnchainBalance: true,
        supportsOnchainSends: true,
        supportsOnchainReceiving: true,
        supportsUnconfirmedTransactionOrigin: false,
        supportsLightningSends: true,
        supportsKeysend: true,
        supportsChannelManagement: true,
        supportsCircularRebalancing: true,
        supportsForceClose: false,
        supportsPendingChannels: false,
        supportsClosedChannels: true,
        supportsMPP: false,
        supportsAMP: false,
        supportsCoinControl: true,
        supportsChannelCoinControl: true,
        supportsHopPicking: false,
        supportsWithdrawalRequests: true,
        supportsAccounts: false,
        supportsRouting: true,
        supportsNodeInfo: true,
        singleFeesEarnedTotal: false,
        supportsAddressTypeSelection: true,
        supportsNestedSegWit: false,
        supportsTaproot: true,
        supportsBumpFee: false,
        supportsOnchainSendFeeRate: true,
        supportsChannelOpenFeeRate: true,
        supportsChannelOpenMinConfs: true,
        supportsFlowLSP: false,
        supportsNetworkInfo: false,
        supportsSimpleTaprootChannels: false,
        supportsCustomPreimages: false,
        supportsSweep: true,
        supportsOnchainSendMax: true,
        supportsOnchainBatching: false,
        supportsChannelBatching: false,
        supportsChannelFundMax: true,
        supportsLSPScustomMessage: false,
        supportsLSPS1rest: true,
        supportsBolt11BlindedRoutes: false,
        supportsAddressesWithDerivationPaths: false,
        supportsOffers: true,
        supportsOffersDirectPay: false,
        supportsListingOffers: true,
        supportsBolt12Address: true,
        supportsCustomFeeLimit: true,
        isLNDBased: false,
        supportsForwardingHistory: true,
        supportInboundFees: false,
        supportsDevTools: true,
        supportsCashuWallet: false,
        supportsSettingInvoiceExpiration: true,
        supportsNostrWalletConnectService: true,
        supportsPaymentLookup: false,
        supportsPaymentLookupByHash: true
    };

    it.each(Object.entries(expected))('%s() returns %s', (flag, value) => {
        expect((cln as any)[flag]()).toBe(value);
    });

    it('has no flag missing from the table', () => {
        const flags = Object.keys(cln).filter(
            (key) =>
                /^(supports?[A-Z]|requires|isLNDBased|single)/.test(key) &&
                typeof (cln as any)[key] === 'function'
        );
        expect(flags.sort()).toEqual(Object.keys(expected).sort());
    });
});

describe('CLNRest.supports', () => {
    it('compares the node version against the minimum', () => {
        mockNodeInfoStore.nodeInfo = { version: 'v24.11' };
        expect(cln.supports('v24.11')).toBe(true);
        expect(cln.supports('v26.06')).toBe(false);
    });

    it('honors an end-of-support version', () => {
        mockNodeInfoStore.nodeInfo = { version: 'v25.05' };
        expect(cln.supports('v24.11', 'v25.02')).toBe(false);
        expect(cln.supports('v24.11', 'v25.05')).toBe(true);
    });

    it('also requires the API version when one is given', () => {
        mockNodeInfoStore.nodeInfo = { version: 'v25.02', api_version: '1.2' };
        expect(cln.supports('v24.11', undefined, '1.2')).toBe(true);
        expect(cln.supports('v24.11', undefined, '1.3')).toBe(false);
    });
});
