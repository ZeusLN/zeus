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
import Base64Utils from '../utils/Base64Utils';

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

    describe('scan fallback', () => {
        const HASH = 'ab'.repeat(32);

        // the track stream times out (payment in flight), then each
        // ListPayments page resolves in order
        const lndWithPages = (...pages: any[]) => {
            const lnd = new LND();
            const getRequest = jest
                .fn()
                .mockRejectedValueOnce(new Error('Request timeout'));
            pages.forEach((p) => getRequest.mockResolvedValueOnce(p));
            (lnd as any).getRequest = getRequest;
            return { lnd, getRequest };
        };

        it('scans ascending from creation_date_start, then the newest page', async () => {
            const { lnd, getRequest } = lndWithPages(
                { payments: [] },
                { payments: [] }
            );

            await expect(
                lnd.lookupPayment({
                    payment_hash: HASH,
                    creation_date_start: 1700000000
                })
            ).resolves.toBeNull();
            expect(getRequest.mock.calls.map(([route]) => route)).toEqual([
                `/v2/router/track/${Base64Utils.base64ToBase64Url(
                    Base64Utils.hexToBase64(HASH)
                )}`,
                '/v1/payments?include_incomplete=true&max_payments=50&reversed=false&creation_date_start=1700000000',
                '/v1/payments?include_incomplete=true&max_payments=50&reversed=true'
            ]);
        });

        it('matches the payment hash case-insensitively', async () => {
            const target = {
                payment_hash: HASH.toUpperCase(),
                status: 'SUCCEEDED'
            };
            const { lnd, getRequest } = lndWithPages({ payments: [target] });

            await expect(
                lnd.lookupPayment({
                    payment_hash: HASH,
                    creation_date_start: 1700000000
                })
            ).resolves.toBe(target);
            expect(getRequest).toHaveBeenCalledTimes(2);
        });

        it('rejects as inconclusive when a full bounded page misses', async () => {
            const fullPage = {
                payments: Array.from({ length: 50 }, (_, i) => ({
                    payment_hash: i.toString(16).padStart(64, '0')
                }))
            };
            const { lnd } = lndWithPages(fullPage, { payments: [] });

            await expect(
                lnd.lookupPayment({
                    payment_hash: HASH,
                    creation_date_start: 1700000000
                })
            ).rejects.toMatchObject({ name: 'PaymentLookupInconclusive' });
        });
    });
});
