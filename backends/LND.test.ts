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

describe('LND.watchInvoicePaid', () => {
    // a settled lookupInvoice result paying `sats`
    const settled = (sats: number) => ({
        settled: true,
        state: 'SETTLED',
        amt_paid_sat: String(sats),
        payment_request: 'lnbc1test'
    });
    const open = () => ({ settled: false, state: 'OPEN', value: '7100' });

    let lnd: LND;
    let lookupInvoice: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        lnd = new LND();
        lookupInvoice = jest.spyOn(lnd, 'lookupInvoice');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    // advance one poll interval and let the lookup promise settle
    const tick = async () => {
        jest.advanceTimersByTime(5000);
        await Promise.resolve();
        await Promise.resolve();
    };

    it('fires when the paid sat amount covers the watched sat amount', async () => {
        lookupInvoice.mockResolvedValue(settled(7100));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID', value: '7100' }, onPaid);

        await tick();

        expect(lookupInvoice).toHaveBeenCalledWith({ r_hash: '010203' });
        expect(onPaid).toHaveBeenCalledTimes(1);
        expect(onPaid).toHaveBeenCalledWith({
            amountSat: 7100,
            tx: 'lnbc1test'
        });
    });

    it('fires for an amountless watch (empty or missing value)', async () => {
        lookupInvoice.mockResolvedValue(settled(500));
        const onEmpty = jest.fn();
        const onMissing = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID', value: '' }, onEmpty);
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onMissing);

        await tick();

        expect(onEmpty).toHaveBeenCalledTimes(1);
        expect(onMissing).toHaveBeenCalledTimes(1);
    });

    it('does not fire while the invoice is unpaid', async () => {
        lookupInvoice.mockResolvedValue(open());
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID', value: '7100' }, onPaid);

        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(2);
        expect(onPaid).not.toHaveBeenCalled();
    });

    it('does not fire when less than the watched amount was paid', async () => {
        lookupInvoice.mockResolvedValue(settled(7099));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID', value: '7100' }, onPaid);

        await tick();

        expect(onPaid).not.toHaveBeenCalled();
    });

    it('stops polling once unsubscribed', async () => {
        lookupInvoice.mockResolvedValue(open());
        const unsubscribe = lnd.watchInvoicePaid(
            { rHash: 'AQID', value: '7100' },
            jest.fn()
        );

        await tick();
        unsubscribe();
        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(1);
    });

    it('stops polling after firing', async () => {
        lookupInvoice.mockResolvedValue(settled(7100));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID', value: '7100' }, onPaid);

        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(1);
        expect(onPaid).toHaveBeenCalledTimes(1);
    });
});

describe('LND.watchOnchainReceived', () => {
    const tx = (amount: string) => ({
        transactions: [
            {
                tx_hash: 'txid1',
                num_confirmations: 0,
                dest_addresses: ['bc1qwatched'],
                output_details: [{ address: 'bc1qwatched', amount }]
            }
        ]
    });

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const tick = async () => {
        jest.advanceTimersByTime(7000);
        await Promise.resolve();
        await Promise.resolve();
    };

    it('fires when the output covers the watched sat amount', async () => {
        const lnd = new LND();
        jest.spyOn(lnd, 'getTransactions').mockResolvedValue(tx('7100'));
        const onReceived = jest.fn();
        lnd.watchOnchainReceived(
            {
                address: 'bc1qwatched',
                value: '7100',
                numConfPreference: 0
            },
            onReceived
        );

        await tick();

        expect(onReceived).toHaveBeenCalledWith({
            amountSat: 7100,
            txid: 'txid1'
        });
    });

    it('fires for an amountless watch with no value', async () => {
        const lnd = new LND();
        jest.spyOn(lnd, 'getTransactions').mockResolvedValue(tx('500'));
        const onReceived = jest.fn();
        lnd.watchOnchainReceived(
            { address: 'bc1qwatched', numConfPreference: 0 },
            onReceived
        );

        await tick();

        expect(onReceived).toHaveBeenCalledTimes(1);
    });

    it('does not fire for a smaller output', async () => {
        const lnd = new LND();
        jest.spyOn(lnd, 'getTransactions').mockResolvedValue(tx('7099'));
        const onReceived = jest.fn();
        lnd.watchOnchainReceived(
            {
                address: 'bc1qwatched',
                value: '7100',
                numConfPreference: 0
            },
            onReceived
        );

        await tick();

        expect(onReceived).not.toHaveBeenCalled();
    });
});
