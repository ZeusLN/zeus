// backends/ has no other test files: these mocks stand in for the native
// modules LND.ts pulls in at import time (blob-util, and nitro-tor via
// TorUtils). They are import-time scaffolding only — getURL touches none
// of them.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

import LND from './LND';

describe('LND.getURL', () => {
    const lnd = new LND();
    const url = (host: string, port: string | number = '', ws = false) =>
        lnd.getURL(host, port, '/v1/route', ws);

    describe('scheme rewriting for WebSocket URLs', () => {
        it('rewrites https to wss and http to ws', () => {
            expect(url('https://node.example.com', 8080, true)).toBe(
                'wss://node.example.com:8080/v1/route'
            );
            expect(url('http://192.168.1.5', 8080, true)).toBe(
                'ws://192.168.1.5:8080/v1/route'
            );
        });

        it('leaves a host containing "http" in its name intact', () => {
            // Regression: a bare string replace rewrites the first match
            // anywhere, so these were sent to a different — and
            // attacker-registrable — host, carrying the macaroon.
            expect(url('https://httpbin.org', 8080, true)).toBe(
                'wss://httpbin.org:8080/v1/route'
            );
            expect(url('https://api.http-relay.com', '', true)).toBe(
                'wss://api.http-relay.com/v1/route'
            );
        });

        it('leaves an http host containing "https" in its name intact', () => {
            // Compounding case: "myhttpserver" contains the substring
            // "https", so this hit the *first* replace and came out with
            // the right scheme but the wrong host.
            expect(url('http://myhttpserver.local', 3000, true)).toBe(
                'ws://myhttpserver.local:3000/v1/route'
            );
        });

        it('rewrites only the scheme, never a later occurrence', () => {
            expect(url('https://http.http', '', true)).toBe(
                'wss://http.http/v1/route'
            );
        });

        it('handles onion hosts', () => {
            expect(url('https://abcdef.onion', 10009, true)).toBe(
                'wss://abcdef.onion:10009/v1/route'
            );
        });

        it('defaults a schemeless host to https, then to wss', () => {
            expect(url('node.example.com', 8080, true)).toBe(
                'wss://node.example.com:8080/v1/route'
            );
            // a schemeless host containing "http" is equally protected
            expect(url('httpbin.org', 8080, true)).toBe(
                'wss://httpbin.org:8080/v1/route'
            );
        });
    });

    describe('without the ws flag', () => {
        it('leaves the scheme alone', () => {
            expect(url('https://node.example.com', 8080)).toBe(
                'https://node.example.com:8080/v1/route'
            );
            expect(url('http://node.example.com', 8080)).toBe(
                'http://node.example.com:8080/v1/route'
            );
        });

        it('does not touch "http" inside a hostname either', () => {
            expect(url('https://httpbin.org', 8080)).toBe(
                'https://httpbin.org:8080/v1/route'
            );
        });
    });

    describe('host and port assembly', () => {
        it('omits the port when falsy', () => {
            expect(url('https://node.example.com')).toBe(
                'https://node.example.com/v1/route'
            );
        });

        it('strips a trailing slash before appending the route', () => {
            expect(
                lnd.getURL('https://node.example.com/', '', '/v1/route')
            ).toBe('https://node.example.com/v1/route');
        });

        it('strips the trailing slash on ws URLs too', () => {
            expect(
                lnd.getURL('https://node.example.com/', '', '/v1/route', true)
            ).toBe('wss://node.example.com/v1/route');
        });
    });
});

describe('LND.lookupPayment', () => {
    // contains both base64url-swapped characters (_ and -) when encoded
    const HASH_HEX =
        '9f1459d8a2ac9353e6e229e4d85b11d1830b6a25f7f3f1786a107ecfd86f5d34';
    const HASH_B64URL = 'nxRZ2KKsk1Pm4ink2FsR0YMLaiX38_F4ahB-z9hvXTQ';

    const makeLnd = () => {
        const lnd: any = new LND();
        lnd.getRequest = jest.fn();
        lnd.getPayments = jest.fn();
        return lnd;
    };

    it('resolves a terminal payment from TrackPaymentV2 without scanning', async () => {
        const lnd = makeLnd();
        const payment = { payment_hash: HASH_HEX, status: 'SUCCEEDED' };
        lnd.getRequest.mockResolvedValue({ result: payment });

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).resolves.toBe(payment);
        expect(lnd.getRequest).toHaveBeenCalledWith(
            `/v2/router/track/${HASH_B64URL}`,
            { no_inflight_updates: true },
            expect.any(Number)
        );
        expect(lnd.getPayments).not.toHaveBeenCalled();
    });

    it('maps a streamed NOT_FOUND error message to null', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockResolvedValue({
            error: { code: 5, message: "payment isn't initiated" }
        });

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).resolves.toBeNull();
        expect(lnd.getPayments).not.toHaveBeenCalled();
    });

    it('maps a thrown NOT_FOUND error to null', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockRejectedValue(new Error("payment isn't initiated"));

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).resolves.toBeNull();
        expect(lnd.getPayments).not.toHaveBeenCalled();
    });

    it('falls back to the anchored scan when the stream times out (in flight)', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockRejectedValue(new Error('Request timeout'));
        const inFlight = {
            payment_hash: HASH_HEX.toUpperCase(),
            status: 'IN_FLIGHT'
        };
        lnd.getPayments.mockResolvedValue({
            payments: [{ payment_hash: 'aa'.repeat(32) }, inFlight]
        });

        await expect(
            lnd.lookupPayment({
                payment_hash: HASH_HEX,
                creation_date_start: 1700000000
            })
        ).resolves.toBe(inFlight);
        expect(lnd.getPayments).toHaveBeenCalledWith({
            maxPayments: 50,
            reversed: false,
            creationDateStart: 1700000000
        });
    });

    it('scans the newest page when no dispatch-time anchor is given', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockRejectedValue(new Error('Request timeout'));
        lnd.getPayments.mockResolvedValue({ payments: [] });

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).resolves.toBeNull();
        expect(lnd.getPayments).toHaveBeenCalledWith({
            maxPayments: 50,
            reversed: true
        });
    });

    it('backs up an unexpected response shape with the scan', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockResolvedValue('');
        const payment = { payment_hash: HASH_HEX, status: 'SUCCEEDED' };
        lnd.getPayments.mockResolvedValue({ payments: [payment] });

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).resolves.toBe(payment);
    });

    it('propagates a failure of both the stream and the scan', async () => {
        const lnd = makeLnd();
        lnd.getRequest.mockRejectedValue(new Error('Network request failed'));
        lnd.getPayments.mockRejectedValue(new Error('Network request failed'));

        await expect(
            lnd.lookupPayment({ payment_hash: HASH_HEX })
        ).rejects.toThrow('Network request failed');
    });
});
