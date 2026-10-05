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
