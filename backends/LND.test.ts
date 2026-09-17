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
    nodeInfoStore: { nodeInfo: { version: '' } }
}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    isOnionHttpsUrl: jest.fn(),
    RequestMethod: {}
}));

import LND from './LND';
import { nodeInfoStore } from '../stores/Stores';

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

describe('LND activity date filtering', () => {
    let lnd: LND;
    let getRequest: jest.SpyInstance;

    beforeEach(() => {
        lnd = new LND();
        getRequest = jest
            .spyOn(lnd, 'getRequest')
            .mockResolvedValue({ invoices: [], payments: [] });
    });

    afterEach(() => jest.restoreAllMocks());

    it('passes invoice date bounds to LND 0.16 and keeps the default limit', async () => {
        nodeInfoStore.nodeInfo.version = '0.16.0-beta';

        await lnd.getInvoices({
            creationDateStart: 1_700_000_000,
            creationDateEnd: 1_700_086_399
        });

        expect(getRequest).toHaveBeenCalledWith(
            '/v1/invoices?reversed=true&num_max_invoices=500' +
                '&creation_date_start=1700000000' +
                '&creation_date_end=1700086399'
        );
    });

    it('passes payment date bounds to supported LND nodes', async () => {
        nodeInfoStore.nodeInfo.version = '0.20.0-beta';

        await lnd.getPayments({
            creationDateStart: 1_700_000_000,
            creationDateEnd: 1_700_086_399
        });

        expect(getRequest).toHaveBeenCalledWith(
            '/v1/payments?include_incomplete=true&max_payments=500' +
                '&reversed=true&creation_date_start=1700000000' +
                '&creation_date_end=1700086399'
        );
    });

    it('falls back to the existing requests on pre-0.16 nodes', async () => {
        nodeInfoStore.nodeInfo.version = '0.15.5-beta';

        await lnd.getInvoices({ creationDateStart: 1_700_000_000 });
        await lnd.getPayments({ creationDateEnd: 1_700_086_399 });

        expect(getRequest).toHaveBeenNthCalledWith(
            1,
            '/v1/invoices?reversed=true&num_max_invoices=500'
        );
        expect(getRequest).toHaveBeenNthCalledWith(
            2,
            '/v1/payments?include_incomplete=true&max_payments=500' +
                '&reversed=true'
        );
    });

    it('safely falls back when the node version is unavailable', async () => {
        nodeInfoStore.nodeInfo = {};

        await lnd.getInvoices({ creationDateEnd: 1_700_086_399 });
        await lnd.getPayments({ creationDateStart: 1_700_000_000 });

        expect(getRequest).toHaveBeenNthCalledWith(
            1,
            '/v1/invoices?reversed=true&num_max_invoices=500'
        );
        expect(getRequest).toHaveBeenNthCalledWith(
            2,
            '/v1/payments?include_incomplete=true&max_payments=500' +
                '&reversed=true'
        );
    });
});
