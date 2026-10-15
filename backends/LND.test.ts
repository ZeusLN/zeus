// backends/ has no other test files: these mocks stand in for the native
// modules LND.ts pulls in at import time (blob-util, and nitro-tor via
// TorUtils). They are import-time scaffolding only — getURL touches none
// of them.
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

import LND from './LND';
import { settingsStore } from '../stores/Stores';

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

    it('fires once the watched invoice is settled', async () => {
        lookupInvoice.mockResolvedValue(settled(7100));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onPaid);

        await tick();

        expect(lookupInvoice).toHaveBeenCalledWith({ r_hash: '010203' });
        expect(onPaid).toHaveBeenCalledTimes(1);
        expect(onPaid).toHaveBeenCalledWith({
            amountSat: 7100,
            tx: 'lnbc1test'
        });
    });

    it('fires when the node invoice is for less than the Receive amount', async () => {
        // with the Flow LSP, a 1,000 sat Receive creates a node invoice
        // for 1,000 minus the LSP fee
        lookupInvoice.mockResolvedValue(settled(900));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onPaid);

        await tick();

        expect(onPaid).toHaveBeenCalledWith({
            amountSat: 900,
            tx: 'lnbc1test'
        });
    });

    it('does not fire while the invoice is unpaid', async () => {
        lookupInvoice.mockResolvedValue(open());
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onPaid);

        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(2);
        expect(onPaid).not.toHaveBeenCalled();
    });

    it('does not fire for a settled invoice with nothing paid', async () => {
        lookupInvoice.mockResolvedValue(settled(0));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onPaid);

        await tick();

        expect(onPaid).not.toHaveBeenCalled();
    });

    it('stops polling once unsubscribed', async () => {
        lookupInvoice.mockResolvedValue(open());
        const unsubscribe = lnd.watchInvoicePaid({ rHash: 'AQID' }, jest.fn());

        await tick();
        unsubscribe();
        await tick();
        await tick();

        expect(lookupInvoice).toHaveBeenCalledTimes(1);
    });

    it('stops polling after firing', async () => {
        lookupInvoice.mockResolvedValue(settled(7100));
        const onPaid = jest.fn();
        lnd.watchInvoicePaid({ rHash: 'AQID' }, onPaid);

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
                expectedAmountSat: '7100',
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

    it('fires for an amountless watch with no expected amount', async () => {
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
                expectedAmountSat: '7100',
                numConfPreference: 0
            },
            onReceived
        );

        await tick();

        expect(onReceived).not.toHaveBeenCalled();
    });

    it('does not treat a NaN expected amount as amountless', async () => {
        const lnd = new LND();
        jest.spyOn(lnd, 'getTransactions').mockResolvedValue(tx('500'));
        const onReceived = jest.fn();
        lnd.watchOnchainReceived(
            {
                address: 'bc1qwatched',
                expectedAmountSat: NaN,
                numConfPreference: 0
            },
            onReceived
        );

        await tick();

        expect(onReceived).not.toHaveBeenCalled();
    });
});

describe('LND.initChanAcceptor', () => {
    const LSP = '02' + 'aa'.repeat(32);
    const PEER = '03' + 'bb'.repeat(32);
    const OTHER = '03' + 'cc'.repeat(32);

    let sockets: any[];
    const realWebSocket = global.WebSocket;

    class FakeWebSocket {
        listeners: { [event: string]: Array<(e: any) => void> } = {};
        sent: any[] = [];
        constructor() {
            sockets.push(this);
        }
        addEventListener(event: string, fn: (e: any) => void) {
            (this.listeners[event] ||= []).push(fn);
        }
        send(data: string) {
            this.sent.push(JSON.parse(data));
        }
        emit(event: string, e: any = {}) {
            (this.listeners[event] || []).forEach((fn) => fn(e));
        }
    }

    const request = (ws: FakeWebSocket, pubkey: string, wantsZeroConf = true) =>
        ws.emit('message', {
            data: JSON.stringify({
                result: {
                    node_pubkey: Buffer.from(pubkey, 'hex').toString('base64'),
                    pending_chan_id: 'chan',
                    wants_zero_conf: wantsZeroConf
                }
            })
        });

    beforeEach(() => {
        sockets = [];
        (global as any).WebSocket = FakeWebSocket;
        Object.assign(settingsStore as any, {
            host: 'https://node.example.com',
            port: 8080,
            macaroonHex: 'mac'
        });
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        (global as any).WebSocket = realWebSocket;
        jest.mocked(console.log).mockRestore();
    });

    it('returns the socket it opened', () => {
        const ws = new LND().initChanAcceptor({
            getZeroConfPeers: () => [],
            getLspPubkey: () => undefined
        });
        expect(sockets).toHaveLength(1);
        expect(ws).toBe(sockets[0]);
    });

    it('reads the LSP pubkey when a request arrives, not when it opens', () => {
        let lspPubkey: string | undefined;
        new LND().initChanAcceptor({
            getZeroConfPeers: () => undefined,
            getLspPubkey: () => lspPubkey
        });
        const ws = sockets[0];

        // accept is left out (undefined), which lnd reads as false
        request(ws, LSP);
        expect(ws.sent.pop().accept).toBeFalsy();

        // the Flow info reply lands after the socket was opened
        lspPubkey = LSP;
        request(ws, LSP);
        expect(ws.sent.pop()).toEqual({
            accept: true,
            zero_conf: true,
            pending_chan_id: 'chan'
        });

        request(ws, OTHER);
        expect(ws.sent.pop().accept).toBeFalsy();
    });

    it('reads zeroConfPeers when a request arrives', () => {
        let zeroConfPeers: string[] = [];
        new LND().initChanAcceptor({
            getZeroConfPeers: () => zeroConfPeers,
            getLspPubkey: () => LSP
        });
        const ws = sockets[0];

        request(ws, PEER);
        expect(ws.sent.pop()).toMatchObject({ accept: false });

        zeroConfPeers = [PEER];
        request(ws, PEER);
        expect(ws.sent.pop()).toMatchObject({
            accept: true,
            zero_conf: true
        });
    });

    it('does not mark a normal open from the LSP as zero-conf', () => {
        new LND().initChanAcceptor({
            getZeroConfPeers: () => [PEER],
            getLspPubkey: () => LSP
        });
        const ws = sockets[0];

        request(ws, LSP, false);
        const fromLsp = ws.sent.pop();
        expect(fromLsp.accept).toBe(true);
        expect(fromLsp.zero_conf).toBeFalsy();

        request(ws, PEER, false);
        const fromPeer = ws.sent.pop();
        expect(fromPeer.accept).toBe(true);
        expect(fromPeer.zero_conf).toBeFalsy();
    });
});

describe('LND.subscribeCustomMessages', () => {
    const realWebSocket = global.WebSocket;
    let sockets: any[];

    class FakeWebSocket {
        constructor() {
            sockets.push(this);
        }
        addEventListener() {}
    }

    beforeEach(() => {
        sockets = [];
        (global as any).WebSocket = FakeWebSocket;
        Object.assign(settingsStore as any, {
            host: 'https://node.example.com',
            port: 8080,
            macaroonHex: 'mac'
        });
    });

    afterEach(() => {
        (global as any).WebSocket = realWebSocket;
    });

    // LSPStore keeps this socket to avoid opening one per fetch and to
    // close it on reset
    it('returns the socket it opened', () => {
        const ws = new LND().subscribeCustomMessages(jest.fn(), jest.fn());
        expect(sockets).toHaveLength(1);
        expect(ws).toBe(sockets[0]);
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

    it('passes an explicit end height through', async () => {
        const { lnd, urls } = serve([899_990, 899_998, 899_999]);

        const { transactions } = await lnd.getTransactions({
            start_height: 899_997,
            end_height: 899_998
        });

        expect(transactions.map((tx: any) => tx.tx_hash)).toEqual(['h899998']);
        expect(urls).toEqual([
            '/v1/transactions?end_height=899998&start_height=899997&max_transactions=500'
        ]);
    });

    it('treats max_transactions 0 as no cap', async () => {
        const heights = Array.from({ length: 600 }, (_, i) => 899_401 + i);
        const { lnd, urls } = serve(heights, 1);

        const { transactions } = await lnd.getTransactions({
            max_transactions: 0
        });

        expect(transactions).toHaveLength(601);
        expect(urls).toEqual([
            '/v1/transactions?end_height=1&start_height=-1&max_transactions=0'
        ]);
    });
});
