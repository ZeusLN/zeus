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

describe('LND.getTransactions', () => {
    // Follows lnd 0.19+: a negative height is the top of the range, blocks
    // are read backwards when start > end, unconfirmed transactions come
    // after the mined ones, the page is sliced, then sorted by confirmations
    const serve = (confirmedHeights: number[], unconfirmed = 0) => {
        const tip = 900_000;
        const top = 2 ** 31 - 1;
        const lnd = new LND();
        const urls: string[] = [];
        lnd.getRequest = jest.fn(async (route: string) => {
            urls.push(route);
            const params = new URLSearchParams(route.split('?')[1]);
            const startHeight = Number(params.get('start_height') || 0);
            const endHeight = Number(params.get('end_height') || -1);
            const max = Number(params.get('max_transactions'));
            const begin = startHeight < 0 ? top : startHeight;
            const end = endHeight < 0 ? top : endHeight;
            const heights = confirmedHeights
                .filter(
                    (h) =>
                        h >= Math.min(begin, end) && h <= Math.max(begin, end)
                )
                .sort((a, b) => (begin < end ? a - b : b - a));
            const txs = [
                ...heights.map((h) => ({
                    tx_hash: `h${h}`,
                    block_height: h,
                    num_confirmations: tip - h + 1
                })),
                ...(startHeight < 0 || endHeight < 0
                    ? Array.from({ length: unconfirmed }, (_, i) => ({
                          tx_hash: `pending${i}`,
                          block_height: 0,
                          num_confirmations: 0
                      }))
                    : [])
            ];
            const page = max === 0 ? txs : txs.slice(0, max);
            return {
                transactions: page.sort(
                    (a, b) => a.num_confirmations - b.num_confirmations
                )
            };
        }) as any;
        return { lnd, urls };
    };

    it('returns the newest 500 transactions, not the oldest, when there are more', async () => {
        const heights = Array.from({ length: 600 }, (_, i) => 899_401 + i);
        const { lnd, urls } = serve(heights, 1);

        const { transactions } = await lnd.getTransactions();

        expect(transactions).toHaveLength(500);
        expect(transactions[0].tx_hash).toBe('pending0');
        expect(transactions[1].tx_hash).toBe('h900000');
        expect(transactions.map((tx: any) => tx.tx_hash)).not.toContain(
            'h899401'
        );
        expect(urls).toEqual([
            '/v1/transactions?end_height=1&start_height=-1&max_transactions=500',
            '/v1/transactions?end_height=-1&start_height=-1&max_transactions=0'
        ]);
    });

    it('makes one request when the wallet has fewer than 500 transactions', async () => {
        const { lnd, urls } = serve([800_000, 800_001], 1);

        const { transactions } = await lnd.getTransactions();

        expect(transactions.map((tx: any) => tx.tx_hash)).toEqual([
            'pending0',
            'h800001',
            'h800000'
        ]);
        expect(urls).toEqual([
            '/v1/transactions?end_height=1&start_height=-1&max_transactions=500'
        ]);
    });

    it('passes an explicit start height through as a single request', async () => {
        const { lnd, urls } = serve([899_990, 899_998, 899_999]);

        const { transactions } = await lnd.getTransactions({
            start_height: 899_997
        });

        expect(transactions).toHaveLength(2);
        expect(urls).toEqual([
            '/v1/transactions?end_height=-1&start_height=899997&max_transactions=500'
        ]);
    });
});
