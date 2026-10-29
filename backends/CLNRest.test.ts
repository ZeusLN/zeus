// Import-time scaffolding, as in LND.test.ts. CoreLightningRequestHandler
// additionally has to be stubbed because it and CLNRest import each other
// and it does `new CLNRest()` at module scope: with CLNRest as the entry
// point the cycle resolves with CLNRest still undefined. getURL touches
// none of these.
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn(), config: jest.fn() }
}));
jest.mock('../stores/Stores');
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
import Payment from '../models/Payment';
import { paymentCreationTimeMs } from '../utils/PaymentLookupUtils';

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

describe('CLNRest.watchInvoicePaid', () => {
    const paid = (sats: number) => ({
        status: 'paid',
        amount_received_msat: sats * 1000,
        bolt11: 'lnbc1test'
    });
    const unpaid = () => ({ status: 'unpaid', amount_msat: 7100000 });

    let cln: CLNRest;
    let lookupInvoice: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        cln = new CLNRest();
        lookupInvoice = jest.spyOn(cln, 'lookupInvoice');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const tick = async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
    };

    it('fires once the watched invoice is paid', async () => {
        lookupInvoice.mockResolvedValue(paid(7100));
        const onPaid = jest.fn();
        cln.watchInvoicePaid({ rHash: 'abcd' }, onPaid);

        await tick();

        expect(lookupInvoice).toHaveBeenCalledWith({ r_hash: 'abcd' });
        expect(onPaid).toHaveBeenCalledTimes(1);
        expect(onPaid.mock.calls[0][0].amountSat).toBe(7100);
    });

    it('fires for an amountless invoice paid any amount', async () => {
        lookupInvoice.mockResolvedValue(paid(500));
        const onPaid = jest.fn();
        cln.watchInvoicePaid({ rHash: 'abcd' }, onPaid);

        await tick();

        expect(onPaid).toHaveBeenCalledTimes(1);
    });

    it('does not fire while the invoice is unpaid', async () => {
        lookupInvoice.mockResolvedValue(unpaid());
        const onPaid = jest.fn();
        cln.watchInvoicePaid({ rHash: 'abcd' }, onPaid);

        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(2);
        expect(onPaid).not.toHaveBeenCalled();
    });

    it('stops polling once unsubscribed', async () => {
        lookupInvoice.mockResolvedValue(unpaid());
        const unsubscribe = cln.watchInvoicePaid({ rHash: 'abcd' }, jest.fn());

        await tick();
        unsubscribe();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(1);
    });
});

// Runs the query getPayments sends to /v1/sql against an in-memory SQLite
// sendpays table (CLN's sql plugin is SQLite too), one row per payment part.
describe('CLNRest.getPayments', () => {
    const { DatabaseSync } = require('node:sqlite');

    const getPaymentsFor = async (
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
        return payments;
    };

    const paymentsFor = async (
        parts: Array<{ hash: string; groupid: number; status: string }>
    ) =>
        Object.fromEntries(
            (await getPaymentsFor(parts)).map((p: any) => [
                p.payment_hash,
                p.status
            ])
        );

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

    // each part carries amount_msat 5000000 and amount_sent_msat 5000500
    it('sums the in-flight parts of a pending group, skipping failed ones', async () => {
        const [payment] = await getPaymentsFor([
            { hash: 'mpp', groupid: 1, status: 'failed' },
            { hash: 'mpp', groupid: 1, status: 'pending' },
            { hash: 'mpp', groupid: 1, status: 'pending' }
        ]);

        expect(payment.amount_msat).toBe(10000000);
        expect(payment.amount_sent_msat).toBe(10001000);
    });

    it('counts pending parts of a complete group in both amounts', async () => {
        const [payment] = await getPaymentsFor([
            { hash: 'mpp', groupid: 1, status: 'complete' },
            { hash: 'mpp', groupid: 1, status: 'pending' }
        ]);

        expect(payment.status).toBe('complete');
        expect(payment.amount_msat).toBe(10000000);
        expect(payment.amount_sent_msat).toBe(10001000);
        expect(new Payment(payment).getFee).toBe('1');
    });

    it('skips failed parts of a complete group', async () => {
        const [payment] = await getPaymentsFor([
            { hash: 'mpp', groupid: 1, status: 'failed' },
            { hash: 'mpp', groupid: 1, status: 'complete' },
            { hash: 'mpp', groupid: 1, status: 'complete' }
        ]);

        expect(payment.amount_msat).toBe(10000000);
        expect(payment.amount_sent_msat).toBe(10001000);
    });

    it('reports no amount for a group whose parts all failed', async () => {
        const [payment] = await getPaymentsFor([
            { hash: 'mpp', groupid: 1, status: 'failed' },
            { hash: 'mpp', groupid: 1, status: 'failed' }
        ]);

        expect(payment.amount_msat).toBe(0);
        expect(payment.amount_sent_msat).toBeNull();
    });
});

describe('CLNRest.createWithdrawalRequest', () => {
    it('takes the amount in sats and requests it in msat', async () => {
        const cln = new CLNRest();
        cln.postRequest = jest.fn().mockResolvedValue({ bolt12: 'lnr1...' });

        await cln.createWithdrawalRequest({
            amount: '100',
            description: 'pocket money'
        });

        expect(cln.postRequest).toHaveBeenCalledWith('/v1/invoicerequest', {
            amount: 100_000,
            description: 'pocket money'
        });
    });
});

describe('CLNRest.lookupPayment', () => {
    const HASH = 'ab'.repeat(32);
    const pay = (overrides: Record<string, unknown>) => ({
        payment_hash: HASH,
        status: 'failed',
        created_at: 1700000000,
        destination: '02' + 'cd'.repeat(32),
        ...overrides
    });
    const lookup = (pays: any[]) => {
        const cln: any = new CLNRest();
        cln.postRequest = jest.fn().mockResolvedValue({ pays });
        return cln.lookupPayment({ payment_hash: HASH }).then((result: any) => {
            expect(cln.postRequest).toHaveBeenCalledWith('/v1/listpays', {
                payment_hash: HASH
            });
            return result;
        });
    };

    it('answers null when listpays has no entry for the hash', async () => {
        await expect(lookup([])).resolves.toBeNull();
    });

    it('exposes created_at where the stale-attempt check reads it', async () => {
        const result = await lookup([pay({ status: 'complete' })]);
        expect(paymentCreationTimeMs(result)).toBe(1700000000 * 1000);
        expect(new Payment(result).getTimestamp).toBe('1700000000');
    });

    it('prefers a settled retry group over failed ones', async () => {
        const result = await lookup([
            pay({ status: 'failed', created_at: 1 }),
            pay({ status: 'complete', created_at: 2, preimage: 'ff' }),
            pay({ status: 'failed', created_at: 3 })
        ]);
        expect(result.status).toBe('SUCCEEDED');
        expect(result.creation_date).toBe('2');
        expect(result.preimage).toBe('ff');
    });

    it('prefers a pending group over failed ones and maps it to IN_FLIGHT', async () => {
        const result = await lookup([
            pay({ status: 'failed', created_at: 1 }),
            pay({ status: 'pending', created_at: 2 })
        ]);
        expect(result.status).toBe('IN_FLIGHT');
        expect(result.creation_date).toBe('2');
    });

    it('falls back to the last failed group', async () => {
        const result = await lookup([
            pay({ status: 'failed', created_at: 1 }),
            pay({ status: 'failed', created_at: 2 })
        ]);
        expect(result.status).toBe('FAILED');
        expect(result.creation_date).toBe('2');
    });
});
