const mockConnect = jest.fn();
const mockSend = jest.fn();
const mockClose = jest.fn();

type Handler = (event: any) => void;
const nativeListeners: { [event: string]: Handler[] } = {};

const emitNative = (event: string, payload: any) => {
    (nativeListeners[event] || []).forEach((handler) => handler(payload));
};

jest.mock('react-native', () => ({
    NativeModules: {
        TorWebSocketModule: {
            connect: (...args: any[]) => mockConnect(...args),
            send: (...args: any[]) => mockSend(...args),
            close: (...args: any[]) => mockClose(...args)
        }
    },
    NativeEventEmitter: class {
        addListener(event: string, handler: Handler) {
            (nativeListeners[event] = nativeListeners[event] || []).push(
                handler
            );
            return {
                remove: () => {
                    const idx = nativeListeners[event].indexOf(handler);
                    if (idx !== -1) nativeListeners[event].splice(idx, 1);
                }
            };
        }
    }
}));

const mockEnsureTorStarted = jest.fn();
jest.mock('./TorUtils', () => ({
    ensureTorStarted: () => mockEnsureTorStarted(),
    SOCKS_PORT: 9056
}));

import TorWebSocket from './TorWebSocket';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TorWebSocket', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.keys(nativeListeners).forEach(
            (key) => delete nativeListeners[key]
        );
        mockEnsureTorStarted.mockResolvedValue(undefined);
    });

    it('connects through the SOCKS port after Tor is started', async () => {
        const ws = new TorWebSocket('wss://node.example:8080/v1/x', {
            'Grpc-Metadata-Macaroon': 'beef'
        });
        expect(ws).toBeTruthy();
        expect(mockConnect).not.toHaveBeenCalled();

        await flush();

        expect(mockEnsureTorStarted).toHaveBeenCalled();
        expect(mockConnect).toHaveBeenCalledWith(
            expect.any(String),
            'wss://node.example:8080/v1/x',
            { 'Grpc-Metadata-Macaroon': 'beef' },
            9056
        );
    });

    it('routes native events only to the owning socket', async () => {
        const first = new TorWebSocket('wss://a.example/x');
        const second = new TorWebSocket('wss://b.example/x');
        await flush();

        const firstId = mockConnect.mock.calls[0][0];
        const secondId = mockConnect.mock.calls[1][0];
        expect(firstId).not.toEqual(secondId);

        const firstMessages: any[] = [];
        const secondMessages: any[] = [];
        first.addEventListener('message', (e) => firstMessages.push(e.data));
        second.addEventListener('message', (e) => secondMessages.push(e.data));

        emitNative('TorWebSocketMessage', { id: firstId, data: 'one' });
        emitNative('TorWebSocketMessage', { id: secondId, data: 'two' });

        expect(firstMessages).toEqual(['one']);
        expect(secondMessages).toEqual(['two']);
    });

    it('delivers open, error, and close events with RN-compatible shapes', async () => {
        const ws = new TorWebSocket('wss://a.example/x');
        await flush();
        const id = mockConnect.mock.calls[0][0];

        const events: string[] = [];
        let errorMessage: string | undefined;
        ws.addEventListener('open', () => events.push('open'));
        ws.addEventListener('error', (e) => {
            events.push('error');
            errorMessage = e.message;
        });
        ws.addEventListener('close', () => events.push('close'));

        emitNative('TorWebSocketOpen', { id });
        emitNative('TorWebSocketError', { id, message: 'boom' });
        emitNative('TorWebSocketClose', { id });

        expect(events).toEqual(['open', 'error', 'close']);
        expect(errorMessage).toEqual('boom');
    });

    it('sends through the native module and stops after close', async () => {
        const ws = new TorWebSocket('wss://a.example/x');
        await flush();
        const id = mockConnect.mock.calls[0][0];

        ws.send('{"accept":true}');
        expect(mockSend).toHaveBeenCalledWith(id, '{"accept":true}');

        ws.close();
        expect(mockClose).toHaveBeenCalledWith(id);

        ws.send('late');
        expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('does not connect when closed before Tor finished starting', async () => {
        let resolveStart: () => void = () => {};
        mockEnsureTorStarted.mockReturnValue(
            new Promise<void>((resolve) => {
                resolveStart = resolve;
            })
        );

        const ws = new TorWebSocket('wss://a.example/x');
        ws.close();
        resolveStart();
        await flush();

        expect(mockConnect).not.toHaveBeenCalled();
    });

    it('fails closed with error + close when Tor cannot start', async () => {
        mockEnsureTorStarted.mockRejectedValue(new Error('no tor'));

        const ws = new TorWebSocket('wss://a.example/x');
        const events: any[] = [];
        ws.addEventListener('error', (e) => events.push(e.message));
        ws.addEventListener('close', () => events.push('close'));

        await flush();

        expect(events).toEqual(['no tor', 'close']);
        expect(mockConnect).not.toHaveBeenCalled();
    });
});
