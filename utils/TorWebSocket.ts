import { NativeEventEmitter, NativeModules } from 'react-native';

import { ensureTorStarted, SOCKS_PORT } from './TorUtils';

const { TorWebSocketModule } = NativeModules;

type TorWebSocketEventType = 'open' | 'message' | 'error' | 'close';
type TorWebSocketListener = (event: any) => void;

let sharedEmitter: NativeEventEmitter | null = null;
let nextSocketId = 0;

const getEmitter = (): NativeEventEmitter => {
    if (!sharedEmitter) {
        sharedEmitter = new NativeEventEmitter(TorWebSocketModule);
    }
    return sharedEmitter;
};

/**
 * A WebSocket routed through the Tor SOCKS proxy started by
 * react-native-nitro-tor. React Native's global WebSocket has no proxy
 * support, so a direct socket while Tor is enabled would leak the node
 * host and the user's IP to network observers; this class is the
 * Tor-honoring transport for the LND streaming endpoints.
 *
 * Implements the subset of the React Native WebSocket API the LND
 * backend uses: addEventListener('open' | 'message' | 'error' |
 * 'close'), send(), and close(). Event payload shapes match RN's
 * (message events carry `data`, error events carry `message`).
 *
 * Fails closed by design: if the native transport is unavailable or Tor
 * cannot start, the socket reports error + close and never falls back
 * to a direct clearnet connection.
 */
export default class TorWebSocket {
    private id = `tor-ws-${++nextSocketId}`;
    private listeners: Partial<
        Record<TorWebSocketEventType, TorWebSocketListener[]>
    > = {};
    private subscriptions: { remove: () => void }[] = [];
    private closed = false;

    constructor(url: string, headers: Record<string, string> = {}) {
        if (!TorWebSocketModule) {
            // fail closed: never fall back to a clearnet socket
            setTimeout(() => {
                this.dispatch('error', {
                    message: 'Tor WebSocket native module unavailable'
                });
                this.dispatch('close', {});
            }, 0);
            return;
        }

        const emitter = getEmitter();
        this.subscriptions = [
            emitter.addListener('TorWebSocketOpen', (e) =>
                this.route('open', e)
            ),
            emitter.addListener('TorWebSocketMessage', (e) =>
                this.route('message', e)
            ),
            emitter.addListener('TorWebSocketError', (e) =>
                this.route('error', e)
            ),
            emitter.addListener('TorWebSocketClose', (e) =>
                this.route('close', e)
            )
        ];

        ensureTorStarted()
            .then(() => {
                if (!this.closed) {
                    TorWebSocketModule.connect(
                        this.id,
                        url,
                        headers,
                        SOCKS_PORT
                    );
                }
            })
            .catch((e: any) => {
                this.dispatch('error', {
                    message: e?.message ? e.message : String(e)
                });
                this.dispatch('close', {});
                this.cleanup();
            });
    }

    addEventListener(type: TorWebSocketEventType, cb: TorWebSocketListener) {
        (this.listeners[type] = this.listeners[type] || []).push(cb);
    }

    send(data: string) {
        if (TorWebSocketModule && !this.closed) {
            TorWebSocketModule.send(this.id, data);
        }
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        if (TorWebSocketModule) {
            TorWebSocketModule.close(this.id);
        }
        this.cleanup();
    }

    private route(type: TorWebSocketEventType, event: any) {
        if (!event || event.id !== this.id) return;
        this.dispatch(type, event);
        if (type === 'close') {
            this.closed = true;
            this.cleanup();
        }
    }

    private dispatch(type: TorWebSocketEventType, event: any) {
        (this.listeners[type] || []).forEach((cb) => cb(event));
    }

    private cleanup() {
        this.subscriptions.forEach((s) => s.remove());
        this.subscriptions = [];
    }
}
