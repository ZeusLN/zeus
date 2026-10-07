// Import-time scaffolding, as in LND.test.ts. CoreLightningRequestHandler
// additionally has to be stubbed because it and CLNRest import each other
// and it does `new CLNRest()` at module scope: with CLNRest as the entry
// point the cycle resolves with CLNRest still undefined. getURL touches
// none of these.
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
jest.mock('./CoreLightningRequestHandler', () => ({
    getBalance: jest.fn(),
    getChainTransactions: jest.fn(),
    getOffchainBalance: jest.fn(),
    listPeers: jest.fn(),
    listClosedChannels: jest.fn(),
    listPeerChannels: jest.fn()
}));

import CLNRest, { sqlLimit } from './CLNRest';

// CLNRest's own `getURL` is not reachable with ws=true today — its single
// caller passes no ws argument — so these lock in the anchored behaviour
// against the day it acquires one, and keep it in step with LND.getURL.
describe('CLNRest.getURL', () => {
    const cln = new CLNRest();
    const url = (host: string, port: string | number = '', ws = false) =>
        cln.getURL(host, port, '/v1/route', ws);

    describe('scheme rewriting for WebSocket URLs', () => {
        it('rewrites https to wss and http to ws', () => {
            expect(url('https://node.example.com', 3010, true)).toBe(
                'wss://node.example.com:3010/v1/route'
            );
            expect(url('http://192.168.1.5', 3010, true)).toBe(
                'ws://192.168.1.5:3010/v1/route'
            );
        });

        it('leaves a host containing "http" in its name intact', () => {
            expect(url('https://httpbin.org', 3010, true)).toBe(
                'wss://httpbin.org:3010/v1/route'
            );
        });

        it('leaves an http host containing "https" in its name intact', () => {
            expect(url('http://myhttpserver.local', 3010, true)).toBe(
                'ws://myhttpserver.local:3010/v1/route'
            );
        });
    });

    describe('without the ws flag', () => {
        it('leaves the scheme alone', () => {
            expect(url('https://node.example.com', 3010)).toBe(
                'https://node.example.com:3010/v1/route'
            );
            expect(url('https://httpbin.org', 3010)).toBe(
                'https://httpbin.org:3010/v1/route'
            );
        });

        it('defaults a schemeless host to https', () => {
            expect(url('node.example.com', 3010)).toBe(
                'https://node.example.com:3010/v1/route'
            );
        });

        it('strips a trailing slash before appending the route', () => {
            expect(
                cln.getURL('https://node.example.com/', '', '/v1/route')
            ).toBe('https://node.example.com/v1/route');
        });
    });
});

describe('sqlLimit', () => {
    it('passes positive integers through', () => {
        expect(sqlLimit(20)).toBe(20);
        expect(sqlLimit(1)).toBe(1);
    });

    it('falls back to 150 for anything else', () => {
        expect(sqlLimit(undefined)).toBe(150);
        expect(sqlLimit(0)).toBe(150);
        expect(sqlLimit(-5)).toBe(150);
        expect(sqlLimit(2.5)).toBe(150);
        expect(sqlLimit('1; DROP TABLE invoices' as any)).toBe(150);
    });
});

describe('CLNRest invoice and payment limits', () => {
    const queryFor = async (
        call: (cln: CLNRest) => Promise<any>
    ): Promise<string> => {
        const cln = new CLNRest();
        const postRequest = jest.fn().mockResolvedValue({ rows: [] });
        cln.postRequest = postRequest as any;
        await call(cln);
        return postRequest.mock.calls[0][1].query;
    };

    it('limits payments to the requested count', async () => {
        const query = await queryFor((cln) =>
            cln.getPayments({ maxPayments: 20 })
        );
        expect(query).toMatch(/limit 20$/);
    });

    it('keeps the 150 default for payments', async () => {
        const query = await queryFor((cln) => cln.getPayments());
        expect(query).toMatch(/limit 150$/);
    });

    it('limits invoices to the requested count', async () => {
        const query = await queryFor((cln) => cln.getInvoices({ limit: 20 }));
        expect(query).toMatch(/LIMIT 20;$/);
    });
});
