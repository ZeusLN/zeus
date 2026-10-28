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
                stop: jest.fn()
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

import { Tor, TorError } from 'react-native-nitro-tor';
import {
    doTorRequest,
    isOnionHttpsUrl,
    RequestMethod,
    torHttpRequest
} from './TorUtils';
import {
    isNodeResponse,
    isPaymentRefusedAsDuplicate
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
const requestMock = Tor.http.request as jest.Mock;

const respond = (statusCode: number, body: string, headers = {}) =>
    requestMock.mockResolvedValue({ statusCode, headers, body });

describe('doTorRequest errors', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
    });
});

describe('doTorRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
            followRedirects: true
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

    it('follows redirects by default', async () => {
        respond(200, '{}');
        await torHttpRequest({
            url: 'https://service.example/lnurl',
            method: RequestMethod.GET
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
        return { utils, tor };
    };

    it('starts Tor with the data directory, SOCKS port and timeout', async () => {
        const { utils, tor } = load();
        tor.daemon.start.mockResolvedValue(RUNNING);
        await utils.doTorRequest('https://node.onion/v1/x', 'get');
        expect(tor.daemon.start).toHaveBeenCalledWith({
            dataDirectory: '/tmp/tor_data',
            socksPort: 9056,
            bootstrapTimeoutMs: 30000
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
