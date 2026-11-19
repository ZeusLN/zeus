jest.mock('react-native-nitro-tor', () => {
    class TorError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.name = 'TorError';
            this.code = code;
        }
    }
    return {
        Tor: {
            daemon: {
                start: jest.fn(),
                stop: jest.fn(),
                getStatus: jest.fn(),
                subscribe: jest.fn(),
                requestNewIdentity: jest.fn()
            },
            http: {
                request: jest.fn()
            }
        },
        TorError
    };
});

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: jest.fn()
}));

import { Tor, TorError } from 'react-native-nitro-tor';
import {
    doTorRequest,
    isOnionHttpsUrl,
    restartTor,
    RequestMethod,
    setTorRequestOutcomeListener,
    torHttpRequest
} from './TorUtils';
import { mayHaveBeenSent } from './OnchainSendUtils';
import {
    isNodeResponse,
    isPaymentRefusedAsDuplicate,
    isRequestNotSent
} from './PaymentLookupUtils';

describe('TorUtils', () => {
    describe('isOnionHttpsUrl', () => {
        it('returns true for an HTTPS v3 .onion URL', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true regardless of port', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion:8443/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true for a multi-label .onion hostname', () => {
            expect(isOnionHttpsUrl('https://api.xyz.onion/v1/getinfo')).toBe(
                true
            );
        });

        it('returns true even when the hostname is mixed case', () => {
            expect(isOnionHttpsUrl('https://XYZ.ONION/v1/getinfo')).toBe(true);
        });

        it('returns false for an HTTP .onion URL (no TLS to bypass)', () => {
            expect(isOnionHttpsUrl('http://xyz.onion/v1/getinfo')).toBe(false);
        });

        it('returns false for a clearnet HTTPS URL', () => {
            expect(isOnionHttpsUrl('https://example.com/v1/getinfo')).toBe(
                false
            );
        });

        it('returns false when .onion appears in the path', () => {
            expect(
                isOnionHttpsUrl('https://example.com/xyz.onion/v1/getinfo')
            ).toBe(false);
        });

        it('returns false when .onion appears in a query string', () => {
            expect(isOnionHttpsUrl('https://example.com/?host=xyz.onion')).toBe(
                false
            );
        });

        it('returns false when .onion appears in a fragment', () => {
            expect(isOnionHttpsUrl('https://example.com/#xyz.onion')).toBe(
                false
            );
        });

        it('returns false for hostnames that merely contain "onion"', () => {
            expect(isOnionHttpsUrl('https://onion-router.example.com/')).toBe(
                false
            );
        });

        it('returns false for a hostname where .onion is a non-trailing label', () => {
            expect(isOnionHttpsUrl('https://xyz.onion.evil.com/')).toBe(false);
        });

        it('returns false for a hostname suffixed with .onion-like text', () => {
            expect(isOnionHttpsUrl('https://foo.onionspoof.com/')).toBe(false);
        });

        it('returns false for unrelated schemes pointing at .onion', () => {
            expect(isOnionHttpsUrl('ws://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('wss://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('ftp://xyz.onion/file')).toBe(false);
        });

        it('returns false for invalid / unparseable URLs', () => {
            expect(isOnionHttpsUrl('')).toBe(false);
            expect(isOnionHttpsUrl('not a url')).toBe(false);
            expect(isOnionHttpsUrl('xyz.onion')).toBe(false); // no scheme
            expect(isOnionHttpsUrl('://xyz.onion')).toBe(false);
        });
    });
});

const RUNNING = {
    state: 'running',
    socksAddress: '127.0.0.1:9056',
    controlAddress: '127.0.0.1:9051',
    connectivity: { network: 'up', circuitEstablished: true }
};

const startMock = Tor.daemon.start as jest.Mock;
const getStatusMock = Tor.daemon.getStatus as jest.Mock;
const requestMock = Tor.http.request as jest.Mock;

const respond = (statusCode: number, body: string, headers = {}) =>
    requestMock.mockResolvedValue({ statusCode, headers, body });

const daemon = Tor.daemon as jest.Mocked<typeof Tor.daemon>;
const request = requestMock;
const ONION = 'https://xyz.onion/v1/getinfo';

const ok = (body: string, statusCode = 200) => ({
    statusCode,
    headers: {},
    body
});

describe('doTorRequest errors', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setTorRequestOutcomeListener(null);
        getStatusMock.mockResolvedValue(RUNNING);
        startMock.mockResolvedValue(RUNNING);
    });

    it('tags an error status as a response from the node', async () => {
        respond(500, JSON.stringify({ code: 2, message: 'invoice expired' }));

        const error = await doTorRequest(
            'https://node.onion:8080/v2/router/send',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.message).toBe('invoice expired');
        expect(isNodeResponse(error)).toBe(true);
        expect(isPaymentRefusedAsDuplicate(error)).toBe(false);
    });

    it("tags a stream's AlreadyExists error chunk as a duplicate refusal", async () => {
        respond(
            409,
            JSON.stringify({
                error: { code: 6, message: 'invoice is already paid' }
            })
        );

        const error = await doTorRequest(
            'https://node.onion:8080/v2/router/send',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.message).toBe('invoice is already paid');
        expect(isPaymentRefusedAsDuplicate(error)).toBe(true);
    });

    it.each([
        ['a 502 HTML page', 502, '<html>Bad Gateway</html>'],
        ['a 504 with an empty body', 504, ''],
        [
            'a 503 from envoy',
            503,
            'upstream connect error or disconnect/reset before headers'
        ],
        ['a JSON body without a gRPC code', 503, '{"message":"no upstream"}'],
        [
            'a 502 JSON body with an HTTP status code',
            502,
            '{"code":502,"message":"Bad Gateway"}'
        ],
        [
            'a 503 JSON error chunk with an HTTP status code',
            503,
            '{"error":{"code":503,"message":"Service Unavailable"}}'
        ],
        [
            'a 504 JSON body with a string code',
            504,
            '{"code":"UPSTREAM_TIMEOUT","message":"upstream timed out"}'
        ]
    ])(
        'does not tag %s from a proxy as a response from the node',
        async (_label, statusCode, body) => {
            respond(statusCode, body);

            const error = await doTorRequest(
                'https://node.onion:8080/v2/router/send',
                RequestMethod.POST,
                '{}'
            ).catch((e: any) => e);

            expect(error).toBeInstanceOf(Error);
            expect(isNodeResponse(error)).toBe(false);
        }
    );

    it.each([
        ['an Error', new Error('Tor bootstrap timed out')],
        ['a string', 'Tor bootstrap timed out']
    ])(
        'tags a start that rejects with %s as not sent',
        async (_, rejection) => {
            // a fresh module, so Tor isn't already started from earlier tests
            let fresh: any;
            let tor: any;
            jest.isolateModules(() => {
                tor = require('react-native-nitro-tor').Tor;
                fresh = require('./TorUtils');
            });
            tor.daemon.getStatus.mockResolvedValue({ state: 'stopped' });
            tor.daemon.start.mockRejectedValueOnce(rejection);

            const error = await fresh
                .doTorRequest(
                    'https://node.onion:8080/v1/transactions',
                    fresh.RequestMethod.POST,
                    '{}'
                )
                .catch((e: any) => e);

            expect(error.message).toBe('Tor bootstrap timed out');
            expect(isRequestNotSent(error)).toBe(true);
            expect(mayHaveBeenSent(error, 'lnd')).toBe(false);
            expect(mayHaveBeenSent(error, 'cln-rest')).toBe(false);
            expect(tor.http.request).not.toHaveBeenCalled();
        }
    );

    it.each([
        ['an error object with no message', '{"error":{"code":1}}', 'HTTP 500'],
        [
            'a non-string nested message',
            '{"message":"outer","error":{"message":123}}',
            'outer'
        ],
        [
            'an empty nested message',
            '{"message":"outer","error":{"message":""}}',
            'outer'
        ],
        ['a string error', '{"error":"Not authorized"}', 'Not authorized'],
        ['a non-JSON body', 'Bad Gateway', 'Bad Gateway'],
        ['an empty body', '', 'HTTP 500']
    ])('throws the right message for %s', async (_label, body, expected) => {
        respond(500, body);

        const error = await doTorRequest(
            'https://node.onion:8080/v1/pay',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(expected);
    });

    it('does not tag a transport failure', async () => {
        requestMock.mockRejectedValue(
            new TorError('HTTP_TRANSPORT_ERROR', 'circuit closed')
        );

        const error = await doTorRequest(
            'https://node.onion:8080/v2/router/send',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.message).toBe('circuit closed');
        expect(isNodeResponse(error)).toBe(false);
        expect(error.httpStatus).toBeUndefined();
    });

    it.each([
        ['a gRPC error', 500, '{"code":2,"message":"invoice expired"}'],
        ["a proxy's error page", 502, '<html>Bad Gateway</html>']
    ])('records the HTTP status of %s', async (_, statusCode, body) => {
        respond(statusCode, body);

        const error = await doTorRequest(
            'https://node.onion:8080/v1/transactions',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.httpStatus).toBe(statusCode);
    });
});

describe('doTorRequest errors for a CLNRest send', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setTorRequestOutcomeListener(null);
        getStatusMock.mockResolvedValue(RUNNING);
        startMock.mockResolvedValue(RUNNING);
    });

    const torError = async (statusCode: number, body: string) => {
        requestMock.mockResolvedValueOnce({ statusCode, headers: {}, body });
        return doTorRequest(
            'https://node.onion:3010/v1/withdraw',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);
    };

    it.each([
        ['an unaffordable withdraw', 301, 'Could not afford 500000000sat'],
        ['an invalid parameter', -32602, 'destination: should be an address'],
        ['a code inside the gRPC range', 4, 'some CLN error']
    ])(
        "keeps clnrest's JSON-RPC code for %s, which offers Try Again",
        async (_, code, message) => {
            const error = await torError(
                500,
                JSON.stringify({ code, message })
            );

            expect(error.message).toBe(message);
            expect(error.jsonRpcCode).toBe(code);
            expect(mayHaveBeenSent(error, 'cln-rest')).toBe(false);
        }
    );

    it.each([
        ["a proxy's 520", 520, 'error code: 520'],
        [
            'a 500 without a JSON-RPC body',
            500,
            '<html>Internal Server Error</html>'
        ]
    ])('treats %s as possibly sent', async (_, status, body) => {
        const error = await torError(status, body);

        expect(error.jsonRpcCode).toBeUndefined();
        expect(mayHaveBeenSent(error, 'cln-rest')).toBe(true);
    });

    it("still reads lnd's gRPC transport code over Tor as possibly sent", async () => {
        const error = await torError(
            503,
            JSON.stringify({ code: 14, message: 'transport is closing' })
        );

        expect(mayHaveBeenSent(error, 'lnd')).toBe(true);
    });
});

describe('doTorRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setTorRequestOutcomeListener(null);
        getStatusMock.mockResolvedValue(RUNNING);
        startMock.mockResolvedValue(RUNNING);
    });

    it('returns the parsed JSON body', async () => {
        respond(200, '{"alias":"node"}');
        await expect(
            doTorRequest('https://node.onion/v1/getinfo', RequestMethod.GET)
        ).resolves.toEqual({ alias: 'node' });
    });

    it('returns a non-JSON body as a string', async () => {
        respond(200, 'ok');
        await expect(
            doTorRequest('https://node.onion/v1/getinfo', RequestMethod.GET)
        ).resolves.toBe('ok');
    });

    it('returns undefined for an empty body', async () => {
        respond(200, '');
        await expect(
            doTorRequest('https://node.onion/v1/getinfo', RequestMethod.GET)
        ).resolves.toBeUndefined();
    });

    it('falls back to the status code when an error has no body', async () => {
        respond(404, '');
        const error = await doTorRequest(
            'https://node.onion/v1/x',
            RequestMethod.GET
        ).catch((e: any) => e);
        expect(error.message).toBe('HTTP 404');
    });

    it('rejects a 3xx response', async () => {
        respond(302, '', { location: ['https://elsewhere.example/'] });
        const error = await doTorRequest(
            'https://node.onion/v1/x',
            RequestMethod.GET
        ).catch((e: any) => e);
        expect(error.message).toBe('HTTP 302');
    });

    it.each([RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE])(
        'does not follow redirects for %s',
        async (method) => {
            respond(200, '{}');
            await doTorRequest(
                'https://node.onion/v1/x',
                method,
                '{}',
                { 'Grpc-Metadata-macaroon': 'abcd' },
                true
            );
            const request = requestMock.mock.calls[0][0];
            expect(request.allowInvalidCertificates).toBe(true);
            expect(request.followRedirects).toBe(false);
        }
    );

    it('sends a POST with its body, headers and the default timeout', async () => {
        respond(200, '{}');
        await doTorRequest(
            'https://node.onion:8080/v1/invoices',
            RequestMethod.POST,
            '{"value":1}',
            { 'Grpc-Metadata-macaroon': 'abcd', 'X-Count': 2, 'X-Skip': null }
        );
        expect(requestMock).toHaveBeenCalledWith({
            url: 'https://node.onion:8080/v1/invoices',
            method: 'POST',
            headers: { 'Grpc-Metadata-macaroon': 'abcd', 'X-Count': '2' },
            body: '{"value":1}',
            timeoutMs: 60000,
            allowInvalidCertificates: false,
            followRedirects: false
        });
    });

    it('sends an empty body for a POST without data', async () => {
        respond(200, '{}');
        await doTorRequest('https://node.onion/v1/x', RequestMethod.POST);
        expect(requestMock.mock.calls[0][0].body).toBe('');
    });

    it.each([RequestMethod.GET, RequestMethod.DELETE])(
        'sends no body for %s',
        async (method) => {
            respond(200, '{}');
            await doTorRequest('https://node.onion/v1/x', method, 'ignored');
            const request = requestMock.mock.calls[0][0];
            expect(request.method).toBe(method.toUpperCase());
            expect(request.body).toBeUndefined();
        }
    );

    it('accepts headers as a JSON string', async () => {
        respond(200, '{}');
        await doTorRequest(
            'https://node.onion/v1/x',
            RequestMethod.GET,
            undefined,
            '{"Authorization":"Bearer t"}'
        );
        expect(requestMock.mock.calls[0][0].headers).toEqual({
            Authorization: 'Bearer t'
        });
    });

    it('passes a caller timeout through', async () => {
        respond(200, '{}');
        await doTorRequest(
            'https://node.onion/v2/router/send',
            RequestMethod.POST,
            '{}',
            undefined,
            false,
            180000
        );
        expect(requestMock.mock.calls[0][0].timeoutMs).toBe(180000);
    });

    it('allows invalid certificates for an https .onion URL', async () => {
        respond(200, '{}');
        await doTorRequest(
            'https://node.onion/v1/x',
            RequestMethod.GET,
            undefined,
            undefined,
            true
        );
        expect(requestMock.mock.calls[0][0].allowInvalidCertificates).toBe(
            true
        );
    });

    it('ignores trustInvalidCerts for a clearnet URL', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        respond(200, '{}');
        await doTorRequest(
            'https://node.example.com/v1/x',
            RequestMethod.GET,
            undefined,
            undefined,
            true
        );
        expect(requestMock.mock.calls[0][0].allowInvalidCertificates).toBe(
            false
        );
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('rejects an unsupported method without sending a request', async () => {
        const error = await doTorRequest(
            'https://node.onion/v1/x',
            'put' as RequestMethod
        ).catch((e: any) => e);
        expect(error.message).toBe('Unsupported method: put');
        expect(requestMock).not.toHaveBeenCalled();
    });
});

describe('torHttpRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        setTorRequestOutcomeListener(null);
        getStatusMock.mockResolvedValue(RUNNING);
        startMock.mockResolvedValue(RUNNING);
    });

    it('returns status, headers and raw body without throwing on 3xx', async () => {
        respond(302, 'moved', {
            location: ['https://service.example/next'],
            'set-cookie': ['a=1', 'b=2']
        });
        await expect(
            torHttpRequest({
                url: 'https://service.example/lnurl',
                method: RequestMethod.GET
            })
        ).resolves.toEqual({
            statusCode: 302,
            headers: {
                location: ['https://service.example/next'],
                'set-cookie': ['a=1', 'b=2']
            },
            body: 'moved'
        });
    });

    it('returns a 5xx response without throwing', async () => {
        respond(500, '{"status":"ERROR"}');
        const response = await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET
        });
        expect(response.statusCode).toBe(500);
        expect(response.body).toBe('{"status":"ERROR"}');
    });

    it('forwards followRedirects: false', async () => {
        respond(200, '{}');
        await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET,
            followRedirects: false
        });
        expect(requestMock.mock.calls[0][0].followRedirects).toBe(false);
    });

    it('does not follow redirects by default', async () => {
        respond(200, '{}');
        await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET
        });
        expect(requestMock.mock.calls[0][0].followRedirects).toBe(false);
    });

    it('forwards followRedirects: true', async () => {
        respond(200, '{}');
        await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET,
            followRedirects: true
        });
        expect(requestMock.mock.calls[0][0].followRedirects).toBe(true);
    });

    it('fills in missing headers and body', async () => {
        requestMock.mockResolvedValue({ statusCode: 204 });
        await expect(
            torHttpRequest({
                url: 'https://service.example/lnurl',
                method: RequestMethod.GET
            })
        ).resolves.toEqual({ statusCode: 204, headers: {}, body: '' });
    });

    it('rejects with the native error on a transport failure', async () => {
        const nativeError = new TorError('HTTP_TIMEOUT', 'operation timed out');
        requestMock.mockRejectedValue(nativeError);
        await expect(
            torHttpRequest({
                url: 'https://service.example/lnurl',
                method: RequestMethod.GET
            })
        ).rejects.toBe(nativeError);
    });
});

describe('Tor daemon status and request outcomes', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
        jest.resetAllMocks();
        setTorRequestOutcomeListener(null);
        daemon.getStatus.mockResolvedValue(RUNNING as any);
        daemon.start.mockResolvedValue(RUNNING as any);
        request.mockResolvedValue(ok('{}'));
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => warn.mockRestore());

    it('starts the daemon when it is not running', async () => {
        daemon.getStatus.mockResolvedValueOnce({ state: 'stopped' });

        await doTorRequest(ONION, RequestMethod.GET);

        expect(daemon.start).toHaveBeenCalledWith({
            dataDirectory: '/tmp/tor_data',
            socksPort: 9056,
            bootstrapTimeoutMs: 90000
        });
    });

    it('does not start the daemon when it is already running', async () => {
        await doTorRequest(ONION, RequestMethod.GET);

        expect(daemon.start).not.toHaveBeenCalled();
    });

    it('starts the daemon again after it dies following a successful start', async () => {
        daemon.getStatus
            .mockResolvedValueOnce({ state: 'stopped' })
            .mockResolvedValueOnce(RUNNING as any)
            .mockResolvedValueOnce({
                state: 'failed',
                error: { code: 'TOR_STOPPED', message: 'gone' }
            });

        await doTorRequest(ONION, RequestMethod.GET);
        await doTorRequest(ONION, RequestMethod.GET);
        await doTorRequest(ONION, RequestMethod.GET);

        expect(daemon.start).toHaveBeenCalledTimes(2);
    });

    it('starts the daemon again for torHttpRequest after it dies', async () => {
        daemon.getStatus
            .mockResolvedValueOnce({ state: 'stopped' })
            .mockResolvedValueOnce({ state: 'stopped' });

        await torHttpRequest({ url: ONION, method: RequestMethod.GET });
        await torHttpRequest({ url: ONION, method: RequestMethod.GET });

        expect(daemon.start).toHaveBeenCalledTimes(2);
    });

    it('keeps the start restartTor began when the start it replaced settles', async () => {
        const flush = () => new Promise((r) => setImmediate(r));
        daemon.getStatus.mockResolvedValue({ state: 'stopped' });
        let failFirst: (e: Error) => void = () => {};
        let finishSecond: (v: any) => void = () => {};
        daemon.start
            .mockReturnValueOnce(
                new Promise((_, reject) => (failFirst = reject))
            )
            .mockReturnValueOnce(
                new Promise((resolve) => (finishSecond = resolve))
            );
        daemon.stop.mockImplementation(async () => {
            failFirst(
                new TorError('TOR_STOPPED', 'Tor stopped during startup')
            );
        });

        const first = doTorRequest(ONION, RequestMethod.GET).catch(
            (e: any) => e
        );
        await flush();
        const restart = restartTor();
        await flush();
        // the start restartTor began is still running, so a new request
        // has to wait for it rather than start a third
        const second = doTorRequest(ONION, RequestMethod.GET);
        await flush();
        expect(daemon.start).toHaveBeenCalledTimes(2);

        daemon.getStatus.mockResolvedValue(RUNNING as any);
        finishSecond(RUNNING);
        await restart;
        await expect(second).resolves.toEqual({});
        // the request whose start was stopped waits for the restart
        await expect(first).resolves.toEqual({});
        expect(daemon.start).toHaveBeenCalledTimes(2);
    });

    it('rejects unsupported methods before touching the daemon', async () => {
        await expect(
            doTorRequest(ONION, 'patch' as RequestMethod)
        ).rejects.toThrow('Unsupported method: patch');
        expect(daemon.getStatus).not.toHaveBeenCalled();
    });

    it('reports a success to the outcome listener, including HTTP errors', async () => {
        const listener = jest.fn();
        setTorRequestOutcomeListener(listener);
        request.mockResolvedValueOnce(ok('{}'));
        request.mockResolvedValueOnce(ok('', 500));

        await doTorRequest(ONION, RequestMethod.GET);
        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow();

        expect(listener.mock.calls).toEqual([
            [true, ONION],
            [true, ONION]
        ]);
    });

    it('reports a 3xx from torHttpRequest as a success, since the host answered', async () => {
        const listener = jest.fn();
        setTorRequestOutcomeListener(listener);
        request.mockResolvedValueOnce({
            statusCode: 302,
            headers: { location: ['https://elsewhere.example/'] },
            body: ''
        });

        await torHttpRequest({ url: ONION, method: RequestMethod.GET });

        expect(listener.mock.calls).toEqual([[true, ONION]]);
    });

    it('reports transport failures to the outcome listener', async () => {
        const listener = jest.fn();
        setTorRequestOutcomeListener(listener);
        request.mockRejectedValue(
            new TorError('HTTP_TIMEOUT', 'request timed out')
        );

        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow(
            'request timed out'
        );

        expect(listener).toHaveBeenCalledWith(false, ONION);
    });

    it('reports transport failures from torHttpRequest', async () => {
        const listener = jest.fn();
        setTorRequestOutcomeListener(listener);
        request.mockRejectedValue(
            new TorError('HTTP_TRANSPORT_ERROR', 'circuit closed')
        );

        await expect(
            torHttpRequest({ url: ONION, method: RequestMethod.GET })
        ).rejects.toThrow('circuit closed');

        expect(listener).toHaveBeenCalledWith(false, ONION);
    });

    it('does not report caller errors as transport failures', async () => {
        const listener = jest.fn();
        setTorRequestOutcomeListener(listener);
        request.mockRejectedValue(
            new TorError('INVALID_REQUEST', 'url must not be empty')
        );

        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow();

        expect(listener).not.toHaveBeenCalled();
    });

    it('retries a GET once when Tor stopped mid-request (Restart Tor)', async () => {
        request
            .mockRejectedValueOnce(
                new TorError(
                    'TOR_STOPPED',
                    'Tor stopped before the HTTP request completed'
                )
            )
            .mockResolvedValueOnce(ok('{"alias":"node"}'));
        daemon.getStatus
            .mockResolvedValueOnce(RUNNING as any)
            .mockResolvedValueOnce({ state: 'stopped' });

        await expect(doTorRequest(ONION, RequestMethod.GET)).resolves.toEqual({
            alias: 'node'
        });

        expect(request).toHaveBeenCalledTimes(2);
        expect(daemon.start).toHaveBeenCalledTimes(1);
    });

    it('does not retry a POST that Tor stopped mid-request, since the node may have received it', async () => {
        request.mockRejectedValue(
            new TorError(
                'TOR_STOPPED',
                'Tor stopped before the HTTP request completed'
            )
        );

        await expect(
            doTorRequest(ONION, RequestMethod.POST, '{"amt":1}')
        ).rejects.toThrow('Tor stopped');

        expect(request).toHaveBeenCalledTimes(1);
    });

    it('retries any method once when Tor was not running, since nothing was sent', async () => {
        request
            .mockRejectedValueOnce(
                new TorError('NOT_RUNNING', 'Tor is not running')
            )
            .mockResolvedValueOnce(ok('{}'));

        await doTorRequest(ONION, RequestMethod.POST, '{"amt":1}');

        expect(request).toHaveBeenCalledTimes(2);
    });

    it('gives up after one retry', async () => {
        request.mockRejectedValue(
            new TorError(
                'TOR_STOPPED',
                'Tor stopped before the HTTP request completed'
            )
        );

        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow(
            'Tor stopped'
        );

        expect(request).toHaveBeenCalledTimes(2);
    });

    it('retries a GET that hit a transport error because Tor restarted during it', async () => {
        // On device a GET cut off mid SOCKS connect by Restart Tor
        // fails with HTTP_TRANSPORT_ERROR, not TOR_STOPPED
        daemon.stop.mockResolvedValue(undefined);
        let restart: Promise<void> = Promise.resolve();
        request
            .mockImplementationOnce(() => {
                restart = restartTor();
                return Promise.reject(
                    new TorError(
                        'HTTP_TRANSPORT_ERROR',
                        'socks connect error: unexpected end of file'
                    )
                );
            })
            .mockResolvedValueOnce(ok('{"alias":"node"}'));

        await expect(doTorRequest(ONION, RequestMethod.GET)).resolves.toEqual({
            alias: 'node'
        });
        await restart;

        expect(request).toHaveBeenCalledTimes(2);
    });

    it('resends only after the restart has finished', async () => {
        let finishStop: () => void = () => {};
        daemon.stop.mockReturnValue(
            new Promise<void>((resolve) => (finishStop = resolve))
        );
        daemon.getStatus
            .mockResolvedValueOnce(RUNNING as any)
            .mockResolvedValue({ state: 'stopped' });
        let restart: Promise<void> = Promise.resolve();
        request
            .mockImplementationOnce(() => {
                restart = restartTor();
                return Promise.reject(
                    new TorError('TOR_STOPPED', 'Tor stopped')
                );
            })
            .mockResolvedValueOnce(ok('{}'));

        const pending = doTorRequest(ONION, RequestMethod.GET);
        await new Promise((r) => setImmediate(r));
        expect(request).toHaveBeenCalledTimes(1);

        finishStop();
        await pending;
        await restart;

        expect(request).toHaveBeenCalledTimes(2);
        expect(daemon.start.mock.invocationCallOrder[0]).toBeLessThan(
            request.mock.invocationCallOrder[1]
        );
    });

    it('does not retry a transport error when Tor was not restarted', async () => {
        request.mockRejectedValue(
            new TorError('HTTP_TRANSPORT_ERROR', 'connection refused')
        );

        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow(
            'connection refused'
        );

        expect(request).toHaveBeenCalledTimes(1);
    });

    it('does not retry a POST transport error even when Tor restarted', async () => {
        daemon.stop.mockResolvedValue(undefined);
        let restart: Promise<void> = Promise.resolve();
        request.mockImplementationOnce(() => {
            restart = restartTor();
            return Promise.reject(
                new TorError('HTTP_TRANSPORT_ERROR', 'unexpected end of file')
            );
        });

        await expect(
            doTorRequest(ONION, RequestMethod.POST, '{"amt":1}')
        ).rejects.toThrow('unexpected end of file');
        await restart;

        expect(request).toHaveBeenCalledTimes(1);
    });

    it('survives Restart Tor stopping the start it was waiting on', async () => {
        // Seen on iOS: requests waiting for Tor to start failed with
        // "Tor stopped during startup" when Restart Tor stopped that
        // start, although nothing had been sent yet
        daemon.getStatus.mockResolvedValue({ state: 'stopped' });
        let failStart: (e: Error) => void = () => {};
        daemon.start
            .mockReturnValueOnce(
                new Promise((_, reject) => (failStart = reject))
            )
            .mockResolvedValue(RUNNING as any);
        daemon.stop.mockImplementation(async () => {
            failStart(
                new TorError('TOR_STOPPED', 'Tor stopped during startup')
            );
        });

        const get = doTorRequest(ONION, RequestMethod.GET);
        const post = doTorRequest(ONION, RequestMethod.POST, '{"a":1}');
        await new Promise((r) => setImmediate(r));
        const restart = restartTor();

        await expect(get).resolves.toEqual({});
        await expect(post).resolves.toEqual({});
        await restart;
        expect(request).toHaveBeenCalledTimes(2);
    });

    it('still fails a start that fails with no restart involved', async () => {
        daemon.getStatus.mockResolvedValue({ state: 'stopped' });
        daemon.start.mockRejectedValue(
            new TorError('BOOTSTRAP_TIMEOUT', 'timed out')
        );

        await expect(doTorRequest(ONION, RequestMethod.GET)).rejects.toThrow(
            'timed out'
        );
        expect(request).not.toHaveBeenCalled();
    });

    it('resends a torHttpRequest GET that Tor stopped mid-request, keeping followRedirects', async () => {
        request
            .mockRejectedValueOnce(new TorError('TOR_STOPPED', 'Tor stopped'))
            .mockResolvedValueOnce({
                statusCode: 302,
                headers: { location: ['https://service.example/next'] },
                body: ''
            });

        const response = await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET,
            followRedirects: true
        });

        expect(response.statusCode).toBe(302);
        expect(request).toHaveBeenCalledTimes(2);
        expect(request.mock.calls[1][0].followRedirects).toBe(true);
    });

    it('still returns the response when the outcome listener throws', async () => {
        setTorRequestOutcomeListener(() => {
            throw new Error('listener bug');
        });
        request.mockResolvedValueOnce(ok('{"alias":"node"}'));

        await expect(doTorRequest(ONION, RequestMethod.GET)).resolves.toEqual({
            alias: 'node'
        });
        expect(warn).toHaveBeenCalled();
    });
});

describe('Tor start', () => {
    // ensureTorStarted keeps its promise in module state, so each test
    // loads a fresh copy of TorUtils
    const load = () => {
        let utils: any;
        let tor: any;
        jest.isolateModules(() => {
            utils = require('./TorUtils');
            tor = require('react-native-nitro-tor').Tor;
        });
        jest.resetAllMocks();
        tor.http.request.mockResolvedValue({
            statusCode: 200,
            headers: {},
            body: '{}'
        });
        // The daemon runs once the latest start() resolved and no stop()
        // came after it
        tor.daemon.getStatus.mockImplementation(async () => {
            const starts = tor.daemon.start.mock;
            const stops = tor.daemon.stop.mock.invocationCallOrder;
            const lastStart = starts.invocationCallOrder.length - 1;
            if (lastStart < 0) return { state: 'stopped' };
            if (
                stops.length > 0 &&
                stops[stops.length - 1] > starts.invocationCallOrder[lastStart]
            ) {
                return { state: 'stopped' };
            }
            try {
                await starts.results[lastStart].value;
                return RUNNING;
            } catch {
                return { state: 'stopped' };
            }
        });
        return { utils, tor };
    };

    it('starts Tor with the data directory, SOCKS port and timeout', async () => {
        const { utils, tor } = load();
        tor.daemon.start.mockResolvedValue(RUNNING);
        await utils.doTorRequest('https://node.onion/v1/x', 'get');
        expect(tor.daemon.start).toHaveBeenCalledWith({
            dataDirectory: '/tmp/tor_data',
            socksPort: 9056,
            bootstrapTimeoutMs: 90000
        });
    });

    it('starts Tor once for concurrent and later requests', async () => {
        const { utils, tor } = load();
        tor.daemon.start.mockResolvedValue(RUNNING);
        await Promise.all([
            utils.doTorRequest('https://node.onion/v1/a', 'get'),
            utils.doTorRequest('https://node.onion/v1/b', 'get')
        ]);
        await utils.doTorRequest('https://node.onion/v1/c', 'get');
        expect(tor.daemon.start).toHaveBeenCalledTimes(1);
        expect(tor.http.request).toHaveBeenCalledTimes(3);
    });

    it('rejects with the start error and retries the start on the next request', async () => {
        const { utils, tor } = load();
        tor.daemon.start
            .mockRejectedValueOnce(new Error('bootstrap timed out'))
            .mockResolvedValueOnce(RUNNING);

        await expect(
            utils.doTorRequest('https://node.onion/v1/x', 'get')
        ).rejects.toThrow('bootstrap timed out');
        expect(tor.http.request).not.toHaveBeenCalled();

        await expect(
            utils.doTorRequest('https://node.onion/v1/x', 'get')
        ).resolves.toEqual({});
        expect(tor.daemon.start).toHaveBeenCalledTimes(2);
    });

    it('restartTor stops the daemon and starts it again', async () => {
        const { utils, tor } = load();
        tor.daemon.start.mockResolvedValue(RUNNING);
        tor.daemon.stop.mockResolvedValue(undefined);
        await utils.doTorRequest('https://node.onion/v1/x', 'get');

        await utils.restartTor();

        expect(tor.daemon.stop).toHaveBeenCalledTimes(1);
        expect(tor.daemon.start).toHaveBeenCalledTimes(2);
        expect(tor.daemon.stop.mock.invocationCallOrder[0]).toBeLessThan(
            tor.daemon.start.mock.invocationCallOrder[1]
        );
    });
});
