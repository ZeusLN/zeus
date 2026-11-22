import { bytesToHex } from '@noble/hashes/utils.js';
import {
    extractNamecoinValue,
    NamecoinElectrumXClient,
    namecoinElectrumScriptHash
} from './NamecoinElectrumX';
import type { NamecoinWebSocketFactory } from './NamecoinElectrumX';

const TX_ID = '11'.repeat(32);
const PUBKEY = '42'.repeat(32);
const VALUE = JSON.stringify({ nostr: { pubkey: PUBKEY } });

type Request = {
    id: number;
    method: string;
    params: unknown[];
};
type Handler = (request: Request) => unknown;

class FakeWebSocket {
    private readonly listeners = new Map<
        string,
        Array<(event: { data?: unknown }) => void>
    >();
    readonly sent: Request[] = [];
    closed = false;

    constructor(
        private readonly handler: Handler,
        openBehavior: 'open' | 'error' | 'never' = 'open'
    ) {
        queueMicrotask(() => {
            if (openBehavior === 'open') this.emit('open', {});
            if (openBehavior === 'error') this.emit('error', {});
        });
    }

    addEventListener(
        type: string,
        listener: (event: { data?: unknown }) => void
    ): void {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    send(data: string): void {
        if (this.closed) throw new Error('socket closed');
        const request = JSON.parse(data) as Request;
        this.sent.push(request);
        queueMicrotask(() => {
            if (this.closed) return;
            try {
                this.emit('message', {
                    data: JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        result: this.handler(request)
                    })
                });
            } catch (error) {
                this.emit('message', {
                    data: JSON.stringify({
                        jsonrpc: '2.0',
                        id: request.id,
                        error: { message: String(error) }
                    })
                });
            }
        });
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.emit('close', {});
    }

    private emit(type: string, event: { data?: unknown }): void {
        for (const listener of this.listeners.get(type) ?? []) {
            listener(event);
        }
    }
}

const encodePush = (data: Uint8Array): number[] => {
    if (data.length < 0x4c) return [data.length, ...data];
    if (data.length <= 0xff) return [0x4c, data.length, ...data];
    return [0x4d, data.length & 0xff, (data.length >> 8) & 0xff, ...data];
};

const nameScript = (
    name: string,
    value: string,
    firstUpdate: boolean = false
): string => {
    const nameBytes = new global.TextEncoder().encode(name);
    const valueBytes = new global.TextEncoder().encode(value);
    const randomBytes = new global.TextEncoder().encode('random');
    return bytesToHex(
        Uint8Array.from([
            firstUpdate ? 0x52 : 0x53,
            ...encodePush(nameBytes),
            ...(firstUpdate ? encodePush(randomBytes) : []),
            ...encodePush(valueBytes),
            0x6d,
            0x75,
            0x51
        ])
    );
};

const transaction = (
    name: string = 'd/testls',
    value: string = VALUE,
    firstUpdate: boolean = false
) => ({
    vout: [
        { scriptPubKey: { hex: '00' } },
        { scriptPubKey: { hex: nameScript(name, value, firstUpdate) } }
    ]
});

const successfulHandler = (
    value: string = VALUE,
    options: {
        history?: unknown;
        currentHeight?: number;
        latestHeight?: number;
        firstUpdate?: boolean;
        name?: string;
    } = {}
): Handler => {
    const name = options.name ?? 'd/testls';
    return (request) => {
        switch (request.method) {
            case 'server.version':
                return ['ElectrumX 1.20.1', '1.4'];
            case 'blockchain.scripthash.get_history':
                return (
                    options.history ?? [
                        {
                            tx_hash: TX_ID,
                            height: options.latestHeight ?? 849000
                        }
                    ]
                );
            case 'blockchain.transaction.get':
                return transaction(name, value, options.firstUpdate);
            case 'blockchain.headers.subscribe':
                return { height: options.currentHeight ?? 850000 };
            default:
                throw new Error('unexpected method');
        }
    };
};

const factoryFor = (
    handlers: Record<
        string,
        { handler: Handler; openBehavior?: 'open' | 'error' | 'never' }
    >,
    sockets: FakeWebSocket[] = []
): NamecoinWebSocketFactory => {
    return (url) => {
        const behavior = handlers[url];
        if (!behavior) throw new Error('unexpected URL ' + url);
        const socket = new FakeWebSocket(
            behavior.handler,
            behavior.openBehavior ?? 'open'
        );
        sockets.push(socket);
        return socket;
    };
};

describe('Namecoin ElectrumX script and transaction parsing', () => {
    it('matches the canonical d/testls Electrum scripthash', () => {
        expect(namecoinElectrumScriptHash('d/testls')).toBe(
            'b519574e96740a4b3627674a0708e71a73e654a95117fc828b8e177a0579ab42'
        );
    });

    it('extracts NAME_UPDATE values with PUSHDATA2 lengths', () => {
        const longValue = JSON.stringify({
            nostr: { pubkey: PUBKEY, relays: ['wss://'.repeat(30)] }
        });
        expect(
            extractNamecoinValue(transaction('d/testls', longValue), 'd/testls')
        ).toBe(longValue);
    });

    it('extracts NAME_FIRSTUPDATE values after the random push', () => {
        expect(
            extractNamecoinValue(
                transaction('d/testls', VALUE, true),
                'd/testls'
            )
        ).toBe(VALUE);
    });

    it('does not return a value for a different name', () => {
        expect(
            extractNamecoinValue(transaction('d/other'), 'd/testls')
        ).toBeNull();
    });
});

describe('NamecoinElectrumXClient', () => {
    it('runs the name_show RPC flow and returns the current value', async () => {
        const sockets: FakeWebSocket[] = [];
        const factory = factoryFor(
            {
                'wss://one': { handler: successfulHandler() }
            },
            sockets
        );
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one'],
            webSocketFactory: factory
        });

        await expect(client.fetchNameValue('d/testls')).resolves.toBe(VALUE);
        expect(sockets[0].sent.map((request) => request.method)).toEqual([
            'server.version',
            'blockchain.scripthash.get_history',
            'blockchain.transaction.get',
            'blockchain.headers.subscribe'
        ]);
        expect(sockets[0].sent[1].params).toEqual([
            'b519574e96740a4b3627674a0708e71a73e654a95117fc828b8e177a0579ab42'
        ]);
        expect(sockets[0].sent[2].params).toEqual([TX_ID, true]);
        expect(sockets[0].closed).toBe(true);
    });

    it('falls back after a transport failure', async () => {
        const factory = factoryFor({
            'wss://one': {
                handler: successfulHandler(),
                openBehavior: 'error'
            },
            'wss://two': { handler: successfulHandler() }
        });
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one', 'wss://two'],
            webSocketFactory: factory
        });

        await expect(client.fetchNameValue('d/testls')).resolves.toBe(VALUE);
    });

    it('falls back when a history transaction lacks the requested name', async () => {
        const sockets: FakeWebSocket[] = [];
        const factory = factoryFor(
            {
                'wss://one': {
                    handler: successfulHandler(VALUE, { name: 'd/other' })
                },
                'wss://two': { handler: successfulHandler() }
            },
            sockets
        );
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one', 'wss://two'],
            webSocketFactory: factory
        });

        await expect(client.fetchNameValue('d/testls')).resolves.toBe(VALUE);
        expect(sockets).toHaveLength(2);
    });

    it('does not fall back after a definitive empty history', async () => {
        const sockets: FakeWebSocket[] = [];
        const factory = factoryFor(
            {
                'wss://one': {
                    handler: successfulHandler(VALUE, { history: [] })
                },
                'wss://two': { handler: successfulHandler() }
            },
            sockets
        );
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one', 'wss://two'],
            webSocketFactory: factory
        });

        await expect(client.fetchNameValue('d/testls')).resolves.toBeNull();
        expect(sockets).toHaveLength(1);
    });

    it('treats names at the expiry depth as not found', async () => {
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one'],
            webSocketFactory: factoryFor({
                'wss://one': {
                    handler: successfulHandler(VALUE, {
                        latestHeight: 814000,
                        currentHeight: 850000
                    })
                }
            })
        });

        await expect(client.fetchNameValue('d/testls')).resolves.toBeNull();
    });

    it('closes a stalled socket and enforces the attempt timeout', async () => {
        const sockets: FakeWebSocket[] = [];
        const factory = factoryFor(
            {
                'wss://one': {
                    handler: successfulHandler(),
                    openBehavior: 'never'
                }
            },
            sockets
        );
        const client = new NamecoinElectrumXClient({
            servers: ['wss://one'],
            webSocketFactory: factory,
            serverTimeoutMs: 10
        });

        await expect(client.fetchNameValue('d/testls')).rejects.toThrow(
            'timed out'
        );
        expect(sockets[0].closed).toBe(true);
    });
});
