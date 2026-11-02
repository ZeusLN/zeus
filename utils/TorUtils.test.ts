jest.mock('react-native-nitro-tor', () => ({
    RnTor: {
        startTorIfNotRunning: jest.fn(),
        shutdownService: jest.fn(),
        httpGet: jest.fn(),
        httpPost: jest.fn(),
        httpDelete: jest.fn()
    }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: jest.fn()
}));

import { RnTor } from 'react-native-nitro-tor';
import { doTorRequest, isOnionHttpsUrl, RequestMethod } from './TorUtils';
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

describe('doTorRequest errors', () => {
    beforeEach(() => {
        (RnTor.startTorIfNotRunning as jest.Mock).mockResolvedValue({
            is_success: true
        });
    });

    it('tags an error status as a response from the node', async () => {
        (RnTor.httpPost as jest.Mock).mockResolvedValue({
            status_code: 500,
            body: JSON.stringify({ code: 2, message: 'invoice expired' })
        });

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
        (RnTor.httpPost as jest.Mock).mockResolvedValue({
            status_code: 409,
            body: JSON.stringify({
                error: { code: 6, message: 'invoice is already paid' }
            })
        });

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
        async (_label, status_code, body) => {
            (RnTor.httpPost as jest.Mock).mockResolvedValue({
                status_code,
                body
            });

            const error = await doTorRequest(
                'https://node.onion:8080/v2/router/send',
                RequestMethod.POST,
                '{}'
            ).catch((e: any) => e);

            expect(error).toBeInstanceOf(Error);
            expect(isNodeResponse(error)).toBe(false);
        }
    );

    it('tags a failure to start Tor as not sent', async () => {
        // a fresh module, so Tor isn't already started from earlier tests
        let fresh: any;
        let tor: any;
        jest.isolateModules(() => {
            tor = require('react-native-nitro-tor').RnTor;
            fresh = require('./TorUtils');
        });
        tor.startTorIfNotRunning.mockResolvedValueOnce({
            is_success: false,
            error_message: 'bootstrap timed out'
        });

        const error = await fresh
            .doTorRequest(
                'https://node.onion:8080/v1/transactions',
                fresh.RequestMethod.POST,
                '{}'
            )
            .catch((e: any) => e);

        expect(error.message).toBe('bootstrap timed out');
        expect(isRequestNotSent(error)).toBe(true);
        expect(tor.httpPost).not.toHaveBeenCalledWith(
            expect.objectContaining({
                url: 'https://node.onion:8080/v1/transactions'
            })
        );
    });

    it('does not tag a transport failure', async () => {
        (RnTor.httpPost as jest.Mock).mockResolvedValue({
            error: 'circuit closed'
        });

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
    ])('records the HTTP status of %s', async (_, status_code, body) => {
        (RnTor.httpPost as jest.Mock).mockResolvedValue({ status_code, body });

        const error = await doTorRequest(
            'https://node.onion:8080/v1/transactions',
            RequestMethod.POST,
            '{}'
        ).catch((e: any) => e);

        expect(error.httpStatus).toBe(status_code);
    });
});

describe('doTorRequest errors for a CLNRest send', () => {
    beforeEach(() => {
        (RnTor.startTorIfNotRunning as jest.Mock).mockResolvedValue({
            is_success: true
        });
    });

    const torError = async (status_code: number, body: string) => {
        (RnTor.httpPost as jest.Mock).mockResolvedValueOnce({
            status_code,
            body
        });
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
