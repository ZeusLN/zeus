// Request core of the LND REST backend: request()/restReq() URL, header
// and body assembly, the in-flight call cache, the non-2xx error fallback,
// the transport timeout race, the payLightningInvoice timeout race, and
// the supports*() capability flags. LND.test.ts covers getURL on its own.

jest.mock('react-native-blob-util', () => {
    const fetch = jest.fn();
    return {
        __esModule: true,
        default: { fetch, config: jest.fn(() => ({ fetch })) }
    };
});
jest.mock('../stores/Stores');
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import { settingsStore, nodeInfoStore } from '../stores/Stores';
import { doTorRequest, isOnionHttpsUrl } from '../utils/TorUtils';
import LND from './LND';

const mockConfig = ReactNativeBlobUtil.config as jest.Mock;
const mockFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const mockTorRequest = doTorRequest as jest.Mock;
const mockIsOnion = isOnionHttpsUrl as unknown as jest.Mock;
const settings = settingsStore as any;
const nodeInfo = nodeInfoStore as any;

const CONNECTION_ERROR = 'Connection error';
const PAYMENT_TIMED_OUT =
    'Payment timed out. It may be in transit, meaning it may complete momentarily or it may go on to fail. Check the Activity view to track its progress.';
// payLightningInvoice's timed-out shape for a call made at startMs: the
// request is torn down natively 5s past timeout_seconds
const timedOut = (startMs: number, timeoutSeconds: number) => ({
    payment_error: PAYMENT_TIMED_OUT,
    payment_timed_out: true,
    dispatch_deadline_ms: startMs + (timeoutSeconds + 5) * 1000
});

// shape of a react-native-blob-util FetchBlobResponse
const response = (status: number, data: any, json?: () => any) => ({
    info: () => ({ status }),
    data,
    json: json || (() => JSON.parse(data))
});

const resetSettings = () => {
    for (const key of Object.keys(settings)) delete settings[key];
    Object.assign(settings, {
        settings: {},
        host: 'https://node.example.com',
        port: '8080',
        macaroonHex: 'deadbeef',
        certVerification: false,
        enableTor: false
    });
};

describe('LND request core', () => {
    let lnd: LND;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch.mockReset();
        mockConfig.mockClear();
        mockTorRequest.mockReset();
        mockIsOnion.mockReset();
        resetSettings();
        lnd = new LND();
        lnd.clearCachedCalls();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('request assembly (non-Tor)', () => {
        it('issues a GET with the macaroon header, JSON content type and no body', async () => {
            mockFetch.mockResolvedValue(response(200, '{"alias":"bob"}'));

            await expect(lnd.getMyNodeInfo()).resolves.toEqual({
                alias: 'bob'
            });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            const [method, url, headers, body] = mockFetch.mock.calls[0];
            expect(method).toBe('get');
            expect(url).toBe('https://node.example.com:8080/v1/getinfo');
            expect(headers).toEqual({
                'Grpc-Metadata-macaroon': 'deadbeef',
                'Content-Type': 'application/json'
            });
            expect(body).toBeNull();
        });

        it('serializes POST bodies as JSON', async () => {
            mockFetch.mockResolvedValue(response(200, '{"peer":"ok"}'));

            await lnd.connectPeer({ addr: { pubkey: '02ab', host: 'h:9735' } });

            const [method, url, , body] = mockFetch.mock.calls[0];
            expect(method).toBe('post');
            expect(url).toBe('https://node.example.com:8080/v1/peers');
            expect(JSON.parse(body)).toEqual({
                addr: { pubkey: '02ab', host: 'h:9735' }
            });
        });

        it('issues DELETE requests', async () => {
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.deleteRequest('/v1/peers/02ab');

            expect(mockFetch.mock.calls[0][0]).toBe('delete');
            expect(mockFetch.mock.calls[0][1]).toBe(
                'https://node.example.com:8080/v1/peers/02ab'
            );
        });

        it('appends params as a query string', async () => {
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.getBlockchainBalance({
                account: 'default',
                min_confs: 1
            });

            expect(mockFetch.mock.calls[0][1]).toBe(
                'https://node.example.com:8080/v1/balance/blockchain?account=default&min_confs=1'
            );
        });

        it('falls back to the LndHub URL and access token', async () => {
            Object.assign(settings, {
                host: undefined,
                port: undefined,
                macaroonHex: undefined,
                lndhubUrl: 'https://hub.example.com',
                accessToken: 'tok123'
            });
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.getChannels();

            const [, url, headers] = mockFetch.mock.calls[0];
            expect(url).toBe('https://hub.example.com/v1/channels');
            expect(headers['Grpc-Metadata-macaroon']).toBe('tok123');
        });

        it('prefers the macaroon over the access token', async () => {
            settings.accessToken = 'tok123';
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.getChannels();

            expect(mockFetch.mock.calls[0][2]['Grpc-Metadata-macaroon']).toBe(
                'deadbeef'
            );
        });

        it('trusts any cert unless certVerification is on', async () => {
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.getChannels();
            expect(mockConfig).toHaveBeenLastCalledWith({
                trusty: true,
                timeout: 30000
            });

            settings.certVerification = true;
            await lnd.getPendingChannels();
            expect(mockConfig).toHaveBeenLastCalledWith({
                trusty: false,
                timeout: 30000
            });
        });

        it('passes a request-scoped timeout to the native transport', async () => {
            mockFetch.mockResolvedValue(response(200, '{}'));

            await lnd.postRequest('/v1/anything', { a: 1 }, 12345);

            expect(mockConfig).toHaveBeenLastCalledWith({
                trusty: true,
                timeout: 12345
            });
        });

        it('uses the WebSocket header casing for ws requests', () => {
            expect(lnd.getHeaders('abc', true)).toEqual({
                'Grpc-Metadata-Macaroon': 'abc'
            });
            expect(lnd.getHeaders('abc')).toEqual({
                'Grpc-Metadata-macaroon': 'abc'
            });
        });
    });

    describe('2xx response parsing', () => {
        it('returns the last complete line of a newline-delimited stream', async () => {
            mockFetch.mockResolvedValue(
                response(
                    200,
                    '{"result":{"step":1}}\n{"result":{"step":2}}\n',
                    () => {
                        throw new Error('json() must not be used');
                    }
                )
            );

            await expect(lnd.getRequest('/v1/stream')).resolves.toEqual({
                result: { step: 2 }
            });
        });

        it('treats any status under 300 as success', async () => {
            mockFetch.mockResolvedValue(response(299, '{"ok":true}'));

            await expect(lnd.getRequest('/v1/x')).resolves.toEqual({
                ok: true
            });
        });
    });

    describe('error fallback on status >= 300', () => {
        it('throws the raw body string even when it holds error.message', async () => {
            // The errorInfo extraction throws inside its own try, so the
            // catch always replaces it with the raw body when data is a
            // string. errorToUserFriendly parses the JSON downstream.
            const body = '{"error":{"message":"nested message"}}';
            mockFetch.mockResolvedValue(response(500, body));

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(body);
        });

        it('throws the raw body string for a top-level message', async () => {
            const body = '{"code":2,"message":"invoice is already paid"}';
            mockFetch.mockResolvedValue(response(400, body));

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(body);
        });

        it('throws the raw body when it is not JSON', async () => {
            mockFetch.mockResolvedValue(response(502, 'Bad Gateway'));

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(
                'Bad Gateway'
            );
        });

        it('does not log the node URL or route of a failed request', async () => {
            const invoice = 'lnbc1500n1pfailedrequestinvoice';
            mockFetch.mockResolvedValue(response(500, 'internal error'));

            await expect(lnd.decodePaymentRequest([invoice])).rejects.toThrow(
                'internal error'
            );

            expect(console.log).toHaveBeenCalledWith(
                'REST request failed:',
                expect.any(String)
            );
            const logged = JSON.stringify(
                (console.log as jest.Mock).mock.calls
            );
            expect(logged).not.toContain('node.example.com');
            expect(logged).not.toContain(invoice);
        });

        it('treats status 300 as an error', async () => {
            // valid JSON, so a success branch would resolve instead
            mockFetch.mockResolvedValue(response(300, '{"code":3}'));

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow('{"code":3}');
        });

        it('throws the connection error when the body is not a string', async () => {
            mockFetch.mockResolvedValue(
                response(500, undefined, () => ({
                    error: { message: 'nested message' }
                }))
            );

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(
                CONNECTION_ERROR
            );
        });

        it('throws the connection error for an empty body', async () => {
            mockFetch.mockResolvedValue(
                response(500, '', () => {
                    throw new SyntaxError('Unexpected end of JSON input');
                })
            );

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(
                CONNECTION_ERROR
            );
        });

        it('passes a transport rejection through unchanged', async () => {
            mockFetch.mockRejectedValue(new Error('Network request failed'));

            await expect(lnd.getRequest('/v1/x')).rejects.toThrow(
                'Network request failed'
            );
        });
    });

    describe('transport timeout race (non-Tor)', () => {
        it('rejects with "Request timeout" after the 30s default', async () => {
            mockFetch.mockReturnValue(new Promise(() => {}));

            const result = lnd.getRequest('/v1/slow');
            const settled = jest.fn();
            result.then(settled, settled);

            await jest.advanceTimersByTimeAsync(29999);
            expect(settled).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            await expect(result).rejects.toThrow('Request timeout');
        });

        it('uses the request-scoped timeout when given', async () => {
            mockFetch.mockReturnValue(new Promise(() => {}));

            const result = lnd.postRequest('/v1/slow', {}, 5000);
            const settled = jest.fn();
            result.then(settled, settled);

            await jest.advanceTimersByTimeAsync(4999);
            expect(settled).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            await expect(result).rejects.toThrow('Request timeout');
        });

        it('returns the response when it arrives before the timeout', async () => {
            let resolveFetch: (v: any) => void = () => {};
            mockFetch.mockReturnValue(
                new Promise((res) => {
                    resolveFetch = res;
                })
            );

            const result = lnd.getRequest('/v1/slow');
            await jest.advanceTimersByTimeAsync(29000);
            resolveFetch(response(200, '{"late":false}'));

            await expect(result).resolves.toEqual({ late: false });
        });
    });

    describe('in-flight call cache', () => {
        it('shares one fetch between identical concurrent requests', async () => {
            let resolveFetch: (v: any) => void = () => {};
            mockFetch.mockReturnValue(
                new Promise((res) => {
                    resolveFetch = res;
                })
            );

            const a = lnd.getChannels();
            const b = lnd.getChannels();
            resolveFetch(response(200, '{"channels":[]}'));

            await expect(a).resolves.toEqual({ channels: [] });
            await expect(b).resolves.toEqual({ channels: [] });
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('keys the cache on the body as well as the URL', async () => {
            mockFetch.mockImplementation(
                (_m: string, _u: string, _h: any, body: string) =>
                    Promise.resolve(response(200, body))
            );

            const [a, b] = await Promise.all([
                lnd.postRequest('/v1/x', { n: 1 }),
                lnd.postRequest('/v1/x', { n: 2 })
            ]);

            expect(a).toEqual({ n: 1 });
            expect(b).toEqual({ n: 2 });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('issues a fresh request once the previous one resolved', async () => {
            mockFetch
                .mockResolvedValueOnce(response(200, '{"n":1}'))
                .mockResolvedValueOnce(response(200, '{"n":2}'));

            await expect(lnd.getChannels()).resolves.toEqual({ n: 1 });
            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
        });

        it('evicts a rejected request so a retry hits the network', async () => {
            mockFetch
                .mockResolvedValueOnce(response(500, 'boom'))
                .mockResolvedValueOnce(response(200, '{"n":2}'));

            await expect(lnd.getChannels()).rejects.toThrow('boom');
            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['single-line', '<html>bad gateway</html>'],
            ['multi-line', '<html>\n<body>bad gateway</body>\n</html>\n']
        ])(
            'rejects a 2xx with a %s non-JSON body and lets a retry through',
            async (_label, body) => {
                mockFetch
                    .mockResolvedValueOnce(response(200, body))
                    .mockResolvedValueOnce(response(200, '{"n":2}'));

                await expect(lnd.getChannels()).rejects.toThrow(SyntaxError);
                await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
                expect(mockFetch).toHaveBeenCalledTimes(2);
            }
        );

        it('evicts a timed-out request so a retry hits the network', async () => {
            mockFetch
                .mockReturnValueOnce(new Promise(() => {}))
                .mockResolvedValueOnce(response(200, '{"n":2}'));

            const first = lnd.getChannels();
            const firstError = first.catch((e: Error) => e);
            await jest.advanceTimersByTimeAsync(30000);
            expect((await firstError).message).toBe('Request timeout');

            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('clearCachedCalls drops in-flight entries', async () => {
            mockFetch
                .mockReturnValueOnce(new Promise(() => {}))
                .mockResolvedValueOnce(response(200, '{"n":2}'));

            lnd.getChannels();
            lnd.clearCachedCalls();

            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Tor path', () => {
        beforeEach(() => {
            settings.enableTor = true;
            settings.host = 'https://abc.onion';
        });

        it('routes through doTorRequest with the onion TLS bypass and a stringified body', async () => {
            mockIsOnion.mockReturnValue(true);
            mockTorRequest.mockResolvedValue({ peer: 'ok' });

            await expect(
                lnd.postRequest('/v1/peers', { perm: true }, 7000)
            ).resolves.toEqual({ peer: 'ok' });

            expect(mockFetch).not.toHaveBeenCalled();
            expect(mockIsOnion).toHaveBeenCalledWith(
                'https://abc.onion:8080/v1/peers'
            );
            expect(mockTorRequest).toHaveBeenCalledWith(
                'https://abc.onion:8080/v1/peers',
                'post',
                '{"perm":true}',
                {
                    'Grpc-Metadata-macaroon': 'deadbeef',
                    'Content-Type': 'application/json'
                },
                true,
                7000
            );
        });

        it('keeps strict TLS for clearnet over Tor and leaves the timeout to doTorRequest', async () => {
            settings.host = 'https://node.example.com';
            mockIsOnion.mockReturnValue(false);
            mockTorRequest.mockResolvedValue({});

            await lnd.getChannels();

            const args = mockTorRequest.mock.calls[0];
            expect(args[4]).toBe(false);
            expect(args[5]).toBeUndefined();
        });

        it('issues a fresh Tor request once the previous one resolved', async () => {
            mockTorRequest
                .mockResolvedValueOnce({ n: 1 })
                .mockResolvedValueOnce({ n: 2 });

            await expect(lnd.getChannels()).resolves.toEqual({ n: 1 });
            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
            expect(mockTorRequest).toHaveBeenCalledTimes(2);
        });

        it('evicts a rejected Tor request so a retry hits the network', async () => {
            mockTorRequest
                .mockRejectedValueOnce(new Error('tor circuit failed'))
                .mockResolvedValueOnce({ n: 2 });

            await expect(lnd.getChannels()).rejects.toThrow(
                'tor circuit failed'
            );
            await expect(lnd.getChannels()).resolves.toEqual({ n: 2 });
            expect(mockTorRequest).toHaveBeenCalledTimes(2);
        });

        it('shares one Tor request between identical concurrent calls', async () => {
            mockTorRequest.mockResolvedValue({ channels: [] });

            const [a, b] = await Promise.all([
                lnd.getChannels(),
                lnd.getChannels()
            ]);

            expect(a).toEqual({ channels: [] });
            expect(b).toEqual({ channels: [] });
            expect(mockTorRequest).toHaveBeenCalledTimes(1);
        });
    });
});

describe('LND.payLightningInvoice timeout race', () => {
    let lnd: LND;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        mockFetch.mockReset();
        mockConfig.mockClear();
        resetSettings();
        lnd = new LND();
        lnd.clearCachedCalls();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('posts to /v2/router/send with self-payment allowed and pubkey stripped', async () => {
        mockFetch.mockResolvedValue(
            response(200, '{"result":{"status":"SUCCEEDED"}}\n')
        );

        const result = await lnd.payLightningInvoice({
            payment_request: 'lnbc1...',
            pubkey: '02ab',
            timeout_seconds: 10
        });

        expect(result).toEqual({ result: { status: 'SUCCEEDED' } });
        const [method, url, , body] = mockFetch.mock.calls[0];
        expect(method).toBe('post');
        expect(url).toBe('https://node.example.com:8080/v2/router/send');
        expect(JSON.parse(body)).toEqual({
            payment_request: 'lnbc1...',
            timeout_seconds: 10,
            allow_self_payment: true
        });
    });

    it('sets the transport timeout 5s past timeout_seconds', async () => {
        mockFetch.mockResolvedValue(response(200, '{}'));

        await lnd.payLightningInvoice({ timeout_seconds: 10 });

        expect(mockConfig).toHaveBeenLastCalledWith({
            trusty: true,
            timeout: 15000
        });
    });

    it('returns the timed-out shape 1s after timeout_seconds when the node has not answered', async () => {
        mockFetch.mockReturnValue(new Promise(() => {}));

        const start = Date.now();
        const result = lnd.payLightningInvoice({ timeout_seconds: 10 });
        const settled = jest.fn();
        result.then(settled, settled);

        await jest.advanceTimersByTimeAsync(10999);
        expect(settled).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toEqual(timedOut(start, 10));
    });

    it('resolves the timed-out shape, not the transport rejection, when nothing answers', async () => {
        // the transport race fires at 15s; the forced timeout must win
        mockFetch.mockReturnValue(new Promise(() => {}));

        const start = Date.now();
        const result = lnd.payLightningInvoice({ timeout_seconds: 10 });
        await jest.advanceTimersByTimeAsync(20000);
        await expect(result).resolves.toEqual(timedOut(start, 10));
    });

    it('defaults to a 60s timeout when timeout_seconds is missing or not numeric', async () => {
        mockFetch.mockReturnValue(new Promise(() => {}));

        for (const data of [{}, { timeout_seconds: 'abc' }]) {
            lnd.clearCachedCalls();
            const start = Date.now();
            const result = lnd.payLightningInvoice(data);
            const settled = jest.fn();
            result.then(settled, settled);

            await jest.advanceTimersByTimeAsync(60999);
            expect(settled).not.toHaveBeenCalled();
            await jest.advanceTimersByTimeAsync(1);
            await expect(result).resolves.toEqual(timedOut(start, 60));
            expect(mockConfig).toHaveBeenLastCalledWith({
                trusty: true,
                timeout: 65000
            });
        }
    });

    it('returns the node response when the payment settles before the timeout', async () => {
        let resolveFetch: (v: any) => void = () => {};
        mockFetch.mockReturnValue(
            new Promise((res) => {
                resolveFetch = res;
            })
        );

        const result = lnd.payLightningInvoice({ timeout_seconds: 10 });
        await jest.advanceTimersByTimeAsync(10500);
        resolveFetch(
            response(
                200,
                '{"result":{"status":"IN_FLIGHT"}}\n{"result":{"status":"SUCCEEDED"}}\n'
            )
        );

        await expect(result).resolves.toEqual({
            result: { status: 'SUCCEEDED' }
        });
    });

    it('rejects with the node error when the payment fails before the timeout', async () => {
        const body = '{"code":2,"message":"invoice is already paid"}';
        mockFetch.mockResolvedValue(response(409, body));

        await expect(
            lnd.payLightningInvoice({ timeout_seconds: 10 })
        ).rejects.toThrow(body);
    });

    // The transport deadline (timeout_seconds + 5) is set past the forced
    // timeout so it never fires first; the safety net covers it doing so
    it("returns the timed-out shape when the transport rejects with 'Request timeout' first", async () => {
        const start = Date.now();
        jest.spyOn(lnd, 'postRequest').mockRejectedValue(
            new Error('Request timeout')
        );

        await expect(
            lnd.payLightningInvoice({ timeout_seconds: 10 })
        ).resolves.toEqual(timedOut(start, 10));
    });

    it('rethrows any other transport rejection', async () => {
        jest.spyOn(lnd, 'postRequest').mockRejectedValue(
            new Error('connection lost')
        );

        await expect(
            lnd.payLightningInvoice({ timeout_seconds: 10 })
        ).rejects.toThrow('connection lost');
    });

    it('ignores a node answer that arrives after the forced timeout', async () => {
        let resolveFetch: (v: any) => void = () => {};
        mockFetch.mockReturnValue(
            new Promise((res) => {
                resolveFetch = res;
            })
        );

        const start = Date.now();
        const result = lnd.payLightningInvoice({ timeout_seconds: 10 });
        await jest.advanceTimersByTimeAsync(11000);
        resolveFetch(response(200, '{"result":{"status":"SUCCEEDED"}}\n'));
        await jest.advanceTimersByTimeAsync(0);

        await expect(result).resolves.toEqual(timedOut(start, 10));
    });
});

describe('LND capability flags', () => {
    const lnd = new LND();

    const staticFlags: Array<[keyof LND, boolean]> = [
        ['supportsWatchtowerClient', true],
        ['supportsPeers', true],
        ['supportsMessageSigning', true],
        ['supportsMessageVerification', true],
        ['requiresVerifyPubkey', false],
        ['supportsLnurlAuth', true],
        ['supportsOnchainBalance', true],
        ['supportsOnchainSends', true],
        ['supportsOnchainReceiving', true],
        ['supportsUnconfirmedTransactionOrigin', true],
        ['supportsLightningSends', true],
        ['supportsKeysend', true],
        ['supportsChannelManagement', true],
        ['supportsCircularRebalancing', true],
        ['supportsForceClose', true],
        ['supportsPendingChannels', true],
        ['supportsClosedChannels', true],
        ['supportsAccountImportRescan', false],
        ['supportsRouting', true],
        ['supportsNodeInfo', true],
        ['supportsWithdrawalRequests', false],
        ['singleFeesEarnedTotal', false],
        ['supportsAddressTypeSelection', true],
        ['supportsNestedSegWit', true],
        ['supportsBumpFee', true],
        ['supportsOnchainSendFeeRate', true],
        ['supportsChannelOpenFeeRate', true],
        ['supportsChannelOpenMinConfs', true],
        ['supportsFlowLSP', true],
        ['supportsNetworkInfo', true],
        ['supportsCustomPreimages', true],
        ['supportsSweep', true],
        ['supportsOnchainBatching', true],
        ['supportsChannelBatching', true],
        ['supportsChannelFundMax', true],
        ['supportsLSPScustomMessage', true],
        ['supportsLSPS1rest', true],
        ['supportsOffers', false],
        ['supportsListingOffers', false],
        ['supportsBolt12Address', false],
        ['supportsCustomFeeLimit', true],
        ['isLNDBased', true],
        ['supportsForwardingHistory', true],
        ['supportsCashuWallet', false],
        ['supportsAddressMessageSigning', true],
        ['supportsSettingInvoiceExpiration', true],
        ['supportsNostrWalletConnectService', true],
        ['supportsPaymentLookup', true]
    ];

    it.each(staticFlags)('%s() returns %s', (flag, expected) => {
        nodeInfo.nodeInfo = { version: '0.0.1-beta' };
        expect((lnd[flag] as () => boolean)()).toBe(expected);
    });

    // minimum LND version for each version-gated flag
    const gatedFlags: Array<[keyof LND, string, string]> = [
        ['supportsMPP', '0.10.0-beta', '0.9.2-beta'],
        ['supportsHopPicking', '0.11.0-beta', '0.10.9-beta'],
        ['supportsCoinControl', '0.12.0-beta', '0.11.9-beta'],
        ['supportsAMP', '0.13.0-beta', '0.12.9-beta'],
        ['supportsAccounts', '0.13.0-beta', '0.12.9-beta'],
        ['supportsTaproot', '0.15.0-beta', '0.14.9-beta'],
        ['supportsChannelCoinControl', '0.17.0-beta', '0.16.9-beta'],
        ['supportsSimpleTaprootChannels', '0.17.0-beta', '0.16.9-beta'],
        ['supportsAddressesWithDerivationPaths', '0.18.0-beta', '0.17.9-beta'],
        ['supportInboundFees', '0.18.0-beta', '0.17.9-beta'],
        ['supportsOnchainSendMax', '0.18.3-beta', '0.18.2-beta'],
        ['supportsBolt11BlindedRoutes', '0.18.3-beta', '0.18.2-beta']
    ];

    it.each(gatedFlags)(
        '%s() is true from %s and false at %s',
        (flag, atMin, belowMin) => {
            const check = lnd[flag] as () => boolean;

            nodeInfo.nodeInfo = { version: `${atMin} commit=v${atMin}` };
            expect(check()).toBe(true);

            nodeInfo.nodeInfo = { version: `${belowMin} commit=v${belowMin}` };
            expect(check()).toBe(false);
        }
    );

    it('treats a missing node version as unsupported for gated flags', () => {
        nodeInfo.nodeInfo = {};
        expect(lnd.supportsMPP()).toBe(false);
        expect(lnd.supportsTaproot()).toBe(false);
        expect(lnd.supportsKeysend()).toBe(true);
    });

    it('enables every gated flag on a current release', () => {
        nodeInfo.nodeInfo = { version: '0.20.0-beta commit=v0.20.0-beta' };
        for (const [flag] of gatedFlags) {
            expect((lnd[flag] as () => boolean)()).toBe(true);
        }
    });
});
