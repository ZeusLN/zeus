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

import CLNRest from './CLNRest';

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

// Runs the query getPayments sends to /v1/sql against an in-memory SQLite
// sendpays table (CLN's sql plugin is SQLite too), one row per payment part.
describe('CLNRest.getPayments', () => {
    const { DatabaseSync } = require('node:sqlite');

    const paymentsFor = async (
        parts: Array<{ hash: string; groupid: number; status: string }>
    ) => {
        const db = new DatabaseSync(':memory:');
        db.exec(
            `create table sendpays (created_index integer primary key,
            payment_hash text, groupid integer, partid integer, status text,
            destination text, created_at integer, description text,
            bolt11 text, bolt12 text, amount_sent_msat integer,
            amount_msat integer, payment_preimage text)`
        );
        const insert = db.prepare(
            `insert into sendpays (payment_hash, groupid, partid, status,
            created_at, amount_sent_msat, amount_msat, payment_preimage)
            values (?, ?, ?, ?, 0, 5000500, 5000000, ?)`
        );
        parts.forEach((p, i) =>
            insert.run(
                p.hash,
                p.groupid,
                i,
                p.status,
                p.status === 'complete' ? 'aa'.repeat(32) : null
            )
        );

        const cln = new CLNRest();
        (cln as any).postRequest = jest.fn(
            async (_route: string, { query }: { query: string }) => ({
                rows: db
                    .prepare(query)
                    .all()
                    .map((row: any) => Object.values(row))
            })
        );
        const { payments } = await cln.getPayments();
        return Object.fromEntries(
            payments.map((p: any) => [p.payment_hash, p.status])
        );
    };

    it('reports an MPP group with failed and pending parts as pending', async () => {
        expect(
            await paymentsFor([
                { hash: 'mpp', groupid: 1, status: 'failed' },
                { hash: 'mpp', groupid: 1, status: 'pending' },
                { hash: 'mpp', groupid: 1, status: 'pending' }
            ])
        ).toEqual({ mpp: 'pending' });
    });

    it('reports a group with any complete part as complete', async () => {
        expect(
            await paymentsFor([
                { hash: 'mpp', groupid: 1, status: 'failed' },
                { hash: 'mpp', groupid: 1, status: 'complete' },
                { hash: 'mpp', groupid: 1, status: 'complete' }
            ])
        ).toEqual({ mpp: 'complete' });
    });

    it('reports a group whose parts all failed as failed', async () => {
        expect(
            await paymentsFor([
                { hash: 'mpp', groupid: 1, status: 'failed' },
                { hash: 'mpp', groupid: 1, status: 'failed' }
            ])
        ).toEqual({ mpp: 'failed' });
    });

    it('reports single-part payments by their own status', async () => {
        expect(
            await paymentsFor([
                { hash: 'a', groupid: 1, status: 'complete' },
                { hash: 'b', groupid: 2, status: 'pending' },
                { hash: 'c', groupid: 3, status: 'failed' }
            ])
        ).toEqual({ a: 'complete', b: 'pending', c: 'failed' });
    });
});
