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

import ReactNativeBlobUtil from 'react-native-blob-util';
import LND from './LND';
import { settingsStore } from '../stores/Stores';
import { localeString } from '../utils/LocaleUtils';
import {
    isNodeResponse,
    isPaymentRefusedAsDuplicate
} from '../utils/PaymentLookupUtils';

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
        listeners: { [event: string]: Array<(e: any) => void> } = {};
        constructor() {
            sockets.push(this);
        }
        addEventListener(event: string, fn: (e: any) => void) {
            (this.listeners[event] ||= []).push(fn);
        }
        send() {}
        emit(event: string, e: any = {}) {
            (this.listeners[event] || []).forEach((fn) => fn(e));
        }
    }

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

    // LSPStore keeps this socket to avoid opening one per fetch and to
    // close it on reset
    it('returns the socket it opened', () => {
        const ws = new LND().subscribeCustomMessages(jest.fn(), jest.fn());
        expect(sockets).toHaveLength(1);
        expect(ws).toBe(sockets[0]);
    });

    // LSPStore's error handler relies on these shapes: a string for a
    // socket error, the stream's error object for a server error
    describe('error callback', () => {
        const certWarning = localeString('backends.LND.wsReq.warning');

        it('passes the certificate warning with the socket error message', () => {
            const onError = jest.fn();
            new LND().subscribeCustomMessages(jest.fn(), onError);

            sockets[0].emit('error', { message: 'SSL handshake failed' });

            expect(onError).toHaveBeenCalledWith(
                `${certWarning} (SSL handshake failed)`
            );
        });

        it('passes the certificate warning alone when the socket error has no message', () => {
            const onError = jest.fn();
            new LND().subscribeCustomMessages(jest.fn(), onError);

            sockets[0].emit('error', {});

            expect(onError).toHaveBeenCalledWith(certWarning);
        });

        it('passes the error object from a stream message', () => {
            const onResponse = jest.fn();
            const onError = jest.fn();
            new LND().subscribeCustomMessages(onResponse, onError);
            const error = { code: 2, message: 'permission denied' };

            sockets[0].emit('message', { data: JSON.stringify({ error }) });

            expect(onError).toHaveBeenCalledWith(error);
            expect(onResponse).not.toHaveBeenCalled();
        });
    });
});

describe('LND WebSocket calls whose socket closes', () => {
    const connectionError = localeString(
        'backends.LND.restReq.connectionError'
    );
    const psbtFund = { result: { psbt_fund: { psbt: 'cHNidP8=' } } };

    const calls: [string, (lnd: LND) => Promise<any>][] = [
        ['wsReq', (lnd) => lnd.wsReq('/v1/route', 'POST', {}) as Promise<any>],
        [
            'openChannelStream',
            (lnd) =>
                lnd.openChannelStream({
                    node_pubkey_string: '02ab'
                } as any) as Promise<any>
        ]
    ];

    const realWebSocket = global.WebSocket;
    let listeners: { [event: string]: (e?: any) => void };
    let lnd: LND;

    beforeEach(() => {
        listeners = {};
        (global as any).WebSocket = jest.fn(() => ({
            send: jest.fn(),
            addEventListener: (event: string, listener: (e?: any) => void) => {
                listeners[event] = listener;
            }
        }));
        lnd = new LND();
        jest.spyOn(lnd, 'getURL').mockReturnValue('wss://node.example.com');
    });

    afterEach(() => {
        global.WebSocket = realWebSocket;
    });

    it.each(calls)(
        '%s rejects, rather than throws, when there was no response',
        async (_name, call) => {
            const outcome = call(lnd).catch((error: any) => error);
            expect(() => listeners.close()).not.toThrow();
            expect(await outcome).toBe(connectionError);
        }
    );

    it.each(calls)(
        "%s keeps the node's error when the socket closes after it",
        async (_name, call) => {
            const outcome = call(lnd).catch((error: any) => error);
            listeners.message({
                data: JSON.stringify({ error: { message: 'peer offline' } })
            });
            expect(() => listeners.close()).not.toThrow();
            expect(await outcome).toEqual({ message: 'peer offline' });
        }
    );

    it.each(calls)(
        '%s resolves with the last response before the close',
        async (_name, call) => {
            const outcome = call(lnd);
            listeners.message({ data: JSON.stringify({ result: 1 }) });
            listeners.message({ data: JSON.stringify({ result: 2 }) });
            listeners.close();
            await expect(outcome).resolves.toEqual({ result: 2 });
        }
    );

    it('openChannelStream does not throw when the peer cancels after psbt_fund', async () => {
        // the funding PSBT is out for signing: psbt_fund has settled the
        // promise and the stream carries nothing else until LND ends it
        const outcome = lnd.openChannelStream({
            node_pubkey_string: '02ab'
        } as any);
        listeners.message({ data: JSON.stringify(psbtFund) });
        listeners.message({
            data: JSON.stringify({
                error: { message: 'remote canceled funding' }
            })
        });
        expect(() => listeners.close()).not.toThrow();
        await expect(outcome).resolves.toEqual(psbtFund);
    });
});

describe('LND.openChannelStream', () => {
    const realWebSocket = global.WebSocket;

    afterEach(() => {
        global.WebSocket = realWebSocket;
    });

    it('sends the close address, as openChannelSync does', () => {
        const send = jest.fn();
        (global as any).WebSocket = jest.fn(() => ({
            send,
            addEventListener: (event: string, listener: () => void) =>
                event === 'open' && listener()
        }));
        const lnd = new LND();
        jest.spyOn(lnd, 'getURL').mockReturnValue('wss://node.example.com');

        lnd.openChannelStream({
            node_pubkey_string: '02ab',
            local_funding_amount: '500000',
            close_address: 'bc1qclose',
            funding_shim: { psbt_shim: { pending_chan_id: 'id' } }
        } as any);

        expect(JSON.parse(send.mock.calls[0][0]).close_address).toBe(
            'bc1qclose'
        );
    });
});

describe('LND.lookupPayment', () => {
    const HASH = 'ab'.repeat(32);

    const lndWithPages = (...pages: any[]) => {
        const lnd = new LND();
        const getRequest = jest.fn();
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
        expect(getRequest).toHaveBeenCalledTimes(1);
    });
});

describe('LND.restReq errors', () => {
    const fetchResolving = (response: any) =>
        (ReactNativeBlobUtil.config as jest.Mock).mockReturnValue({
            fetch: jest.fn().mockResolvedValue(response)
        });

    it('tags an error status as a response from the node', async () => {
        const body = JSON.stringify({
            code: 2,
            message: 'invoice expired'
        });
        fetchResolving({
            info: () => ({ status: 500 }),
            json: () => JSON.parse(body),
            data: body
        });

        const error = await new LND()
            .restReq({}, 'https://node:8080/v2/router/send', 'POST', {})
            .catch((e: any) => e);

        expect(error.message).toContain('invoice expired');
        expect(isNodeResponse(error)).toBe(true);
        expect(isPaymentRefusedAsDuplicate(error)).toBe(false);
    });

    it("tags a stream's AlreadyExists error chunk as a duplicate refusal", async () => {
        // grpc-gateway writes a stream error before any message with the
        // HTTP status for the gRPC code (409) and the code in error.code
        const body = JSON.stringify({
            error: { code: 6, message: 'invoice is already paid' }
        });
        fetchResolving({
            info: () => ({ status: 409 }),
            json: () => JSON.parse(body),
            data: body
        });

        const error = await new LND()
            .restReq({}, 'https://node:8080/v2/router/send', 'POST', {
                id: 'already-paid'
            })
            .catch((e: any) => e);

        expect(error.message).toContain('invoice is already paid');
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
        async (_label, status, body) => {
            fetchResolving({
                info: () => ({ status }),
                json: () => JSON.parse(body),
                data: body
            });

            const error = await new LND()
                .restReq({}, 'https://node:8080/v2/router/send', 'POST', {
                    id: `proxy-${status}`
                })
                .catch((e: any) => e);

            expect(error).toBeInstanceOf(Error);
            expect(isNodeResponse(error)).toBe(false);
            expect(isPaymentRefusedAsDuplicate(error)).toBe(false);
        }
    );

    it('does not tag a JSON error body without a gRPC code', async () => {
        const body = JSON.stringify({ message: 'no healthy upstream' });
        fetchResolving({
            info: () => ({ status: 503 }),
            json: () => JSON.parse(body),
            data: body
        });

        const error = await new LND()
            .restReq({}, 'https://node:8080/v2/router/send', 'POST', {
                id: 'json-no-code'
            })
            .catch((e: any) => e);

        expect(isNodeResponse(error)).toBe(false);
    });

    it('does not tag a transport failure', async () => {
        (ReactNativeBlobUtil.config as jest.Mock).mockReturnValue({
            fetch: jest.fn().mockRejectedValue(new Error('connection lost'))
        });

        const error = await new LND()
            .restReq({}, 'https://node:8080/v2/router/send', 'POST', {
                id: 'transport'
            })
            .catch((e: any) => e);

        expect(isNodeResponse(error)).toBe(false);
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

    it('keeps max_transactions 0 on an explicit range', async () => {
        const heights = Array.from({ length: 600 }, (_, i) => 899_401 + i);
        const { lnd, urls } = serve(heights);

        const { transactions } = await lnd.getTransactions({
            start_height: 899_401,
            max_transactions: 0
        });

        expect(transactions).toHaveLength(600);
        expect(urls).toEqual([
            '/v1/transactions?end_height=-1&start_height=899401&max_transactions=0'
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
