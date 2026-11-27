/*
 * Copyright (c) 2025 Vitor Pamplona
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const NAME_EXPIRE_DEPTH = 36000;
const OP_NAME_FIRSTUPDATE = 0x52;
const OP_NAME_UPDATE = 0x53;
const OP_PUSHDATA1 = 0x4c;
const OP_PUSHDATA2 = 0x4d;
const OP_PUSHDATA4 = 0x4e;

/**
 * Public ElectrumX WSS endpoints with CA-validated certificates. React
 * Native's WebSocket stack performs the platform's normal TLS validation.
 */
export const DEFAULT_NAMECOIN_ELECTRUMX_SERVERS = [
    'wss://electrumx.testls.space:50004/',
    'wss://electrumx2.testls.space:50004/',
    'wss://electrumx2.testls.space:50014/'
] as const;

interface WebSocketEvent {
    data?: unknown;
}

interface WebSocketLike {
    addEventListener(
        type: 'open' | 'error' | 'message' | 'close',
        listener: (event: WebSocketEvent) => void
    ): void;
    send(data: string): void;
    close(): void;
}

export type NamecoinWebSocketFactory = (url: string) => WebSocketLike;

export interface NamecoinElectrumXOptions {
    servers?: readonly string[];
    webSocketFactory?: NamecoinWebSocketFactory;
    /** Shared deadline for all names in one import or delegate traversal. */
    lookupTimeoutMs?: number;
    /** Maximum time for one server attempt, including all RPC calls. */
    serverTimeoutMs?: number;
    now?: () => number;
}

interface HistoryEntry {
    tx_hash: string;
    height: number;
}

interface Transaction {
    vout?: Array<{
        scriptPubKey?: {
            hex?: string;
        };
    }>;
}

interface PendingCall {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

const asError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

/** Minimal JSON-RPC 2.0 over WebSocket, with one in-flight call at a time. */
class ElectrumXRpc {
    private nextId = 0;
    private opened = false;
    private readonly pending = new Map<number, PendingCall>();
    readonly ready: Promise<void>;

    constructor(private readonly socket: WebSocketLike) {
        this.ready = new Promise<void>((resolve, reject) => {
            socket.addEventListener('open', () => {
                this.opened = true;
                resolve();
            });
            socket.addEventListener('error', () => {
                const error = new Error('ElectrumX WebSocket error');
                if (!this.opened) reject(error);
                this.rejectPending(error);
            });
            socket.addEventListener('close', () => {
                const error = new Error('ElectrumX WebSocket closed');
                if (!this.opened) reject(error);
                this.rejectPending(error);
            });
            socket.addEventListener('message', (event) => {
                this.onMessage(event);
            });
        });
    }

    async call<T>(method: string, params: unknown[]): Promise<T> {
        const id = ++this.nextId;
        const request = JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params
        });
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, {
                resolve: (value) => resolve(value as T),
                reject
            });
            try {
                this.socket.send(request);
            } catch (error) {
                this.pending.delete(id);
                reject(asError(error));
            }
        });
    }

    close(): void {
        this.rejectPending(new Error('ElectrumX WebSocket closed'));
        try {
            this.socket.close();
        } catch {
            // The lookup is already complete or failed.
        }
    }

    private rejectPending(error: Error): void {
        for (const pending of this.pending.values()) pending.reject(error);
        this.pending.clear();
    }

    private onMessage(event: WebSocketEvent): void {
        try {
            const data = event.data;
            const text =
                typeof data === 'string'
                    ? data
                    : data instanceof ArrayBuffer
                    ? new global.TextDecoder().decode(data)
                    : null;
            if (text === null) return;
            const message = JSON.parse(text) as {
                id?: unknown;
                result?: unknown;
                error?: unknown;
            };
            if (typeof message.id !== 'number') return;
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) {
                pending.reject(
                    new Error(
                        typeof message.error === 'string'
                            ? message.error
                            : JSON.stringify(message.error)
                    )
                );
            } else {
                pending.resolve(message.result);
            }
        } catch {
            // Notifications and malformed frames cannot satisfy an RPC call.
        }
    }
}

const defaultWebSocketFactory: NamecoinWebSocketFactory = (url) =>
    new WebSocket(url) as unknown as WebSocketLike;

const withTimeout = async <T>(
    operation: Promise<T>,
    timeoutMs: number,
    close: () => void
): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            close();
            reject(new Error('ElectrumX server attempt timed out'));
        }, timeoutMs);
    });
    try {
        return await Promise.race([operation, timeout]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
};

const pushData = (out: number[], data: Uint8Array): void => {
    const length = data.length;
    if (length < OP_PUSHDATA1) {
        out.push(length);
    } else if (length <= 0xff) {
        out.push(OP_PUSHDATA1, length);
    } else if (length <= 0xffff) {
        out.push(OP_PUSHDATA2, length & 0xff, (length >> 8) & 0xff);
    } else {
        throw new Error('Namecoin name is too long');
    }
    for (let index = 0; index < length; index++) out.push(data[index]);
};

/** Build the canonical name-index script used by Namecoin ElectrumX. */
export const buildNamecoinIndexScript = (name: string): Uint8Array => {
    const out: number[] = [OP_NAME_UPDATE];
    pushData(out, new global.TextEncoder().encode(name));
    pushData(out, new Uint8Array(0));
    out.push(0x6d, 0x75, 0x6a); // OP_2DROP OP_DROP OP_RETURN
    return new Uint8Array(out);
};

/** SHA-256 of the name-index script, byte-reversed and hex-encoded. */
export const namecoinElectrumScriptHash = (name: string): string => {
    const digest = sha256(buildNamecoinIndexScript(name));
    return bytesToHex(Uint8Array.from(digest).reverse());
};

const readPushData = (
    script: Uint8Array,
    position: number
): { data: Uint8Array; next: number } | null => {
    if (position >= script.length) return null;
    const opcode = script[position];
    let length: number;
    let dataStart: number;
    if (opcode < OP_PUSHDATA1) {
        length = opcode;
        dataStart = position + 1;
    } else if (opcode === OP_PUSHDATA1) {
        if (position + 2 > script.length) return null;
        length = script[position + 1];
        dataStart = position + 2;
    } else if (opcode === OP_PUSHDATA2) {
        if (position + 3 > script.length) return null;
        length = script[position + 1] | (script[position + 2] << 8);
        dataStart = position + 3;
    } else if (opcode === OP_PUSHDATA4) {
        if (position + 5 > script.length) return null;
        const lengthLong =
            script[position + 1] |
            (script[position + 2] << 8) |
            (script[position + 3] << 16) |
            (script[position + 4] << 24);
        if (lengthLong < 0 || lengthLong > script.length) return null;
        length = lengthLong;
        dataStart = position + 5;
    } else {
        return null;
    }
    const end = dataStart + length;
    if (end > script.length) return null;
    return { data: script.slice(dataStart, end), next: end };
};

/** Parse NAME_UPDATE and NAME_FIRSTUPDATE outputs from a verbose transaction. */
export const extractNamecoinValue = (
    transaction: Transaction,
    expectedName: string
): string | null => {
    if (!Array.isArray(transaction.vout)) return null;
    for (const output of transaction.vout) {
        const hex = output?.scriptPubKey?.hex;
        if (
            typeof hex !== 'string' ||
            (!hex.startsWith('53') && !hex.startsWith('52'))
        ) {
            continue;
        }
        let script: Uint8Array;
        try {
            script = hexToBytes(hex);
        } catch {
            continue;
        }
        const operation = script[0];
        const nameRead = readPushData(script, 1);
        if (!nameRead) continue;
        const valuePosition =
            operation === OP_NAME_FIRSTUPDATE
                ? readPushData(script, nameRead.next)?.next
                : nameRead.next;
        if (valuePosition === undefined) continue;
        const valueRead = readPushData(script, valuePosition);
        if (!valueRead) continue;
        const name = new global.TextDecoder().decode(nameRead.data);
        if (name === expectedName) {
            return new global.TextDecoder().decode(valueRead.data);
        }
    }
    return null;
};

const parseHistory = (value: unknown): HistoryEntry[] => {
    if (!Array.isArray(value)) throw new Error('Invalid ElectrumX history');
    return value.map((entry) => {
        const candidate = entry as Partial<HistoryEntry>;
        if (
            typeof candidate?.tx_hash !== 'string' ||
            !/^[0-9a-f]{64}$/i.test(candidate.tx_hash) ||
            typeof candidate?.height !== 'number' ||
            !Number.isInteger(candidate.height)
        ) {
            throw new Error('Invalid ElectrumX history entry');
        }
        return { tx_hash: candidate.tx_hash, height: candidate.height };
    });
};

/**
 * One shared ElectrumX transport for a complete Namecoin traversal. The
 * deadline is shared by the apex and every imported or delegated name.
 */
export class NamecoinElectrumXClient {
    private readonly servers: readonly string[];
    private readonly webSocketFactory: NamecoinWebSocketFactory;
    private readonly lookupTimeoutMs: number;
    private readonly serverTimeoutMs: number;
    private readonly now: () => number;
    private readonly deadline: number;

    constructor(options: NamecoinElectrumXOptions = {}) {
        this.servers = options.servers ?? DEFAULT_NAMECOIN_ELECTRUMX_SERVERS;
        this.webSocketFactory =
            options.webSocketFactory ?? defaultWebSocketFactory;
        this.lookupTimeoutMs = options.lookupTimeoutMs ?? 40000;
        this.serverTimeoutMs = options.serverTimeoutMs ?? 12000;
        this.now = options.now ?? Date.now;
        this.deadline = this.now() + this.lookupTimeoutMs;
        if (this.servers.length === 0) {
            throw new Error('At least one ElectrumX server is required');
        }
        if (this.lookupTimeoutMs <= 0 || this.serverTimeoutMs <= 0) {
            throw new Error('ElectrumX timeouts must be positive');
        }
    }

    fetchNameValue = async (name: string): Promise<string | null> => {
        let lastError: Error | null = null;
        for (const server of this.servers) {
            const remaining = this.deadline - this.now();
            if (remaining <= 0) {
                throw new Error('Namecoin lookup timed out');
            }
            try {
                return await this.nameShow(
                    name,
                    server,
                    Math.min(this.serverTimeoutMs, remaining)
                );
            } catch (error) {
                // Only transport and protocol failures trigger fallback. An
                // empty history, expired name, or missing matching output is
                // a definitive, fail-closed response from the server.
                lastError = asError(error);
            }
        }
        throw lastError ?? new Error('All ElectrumX servers failed');
    };

    private async nameShow(
        name: string,
        server: string,
        timeoutMs: number
    ): Promise<string | null> {
        const rpc = new ElectrumXRpc(this.webSocketFactory(server));
        const close = () => rpc.close();
        const operation = async (): Promise<string | null> => {
            await rpc.ready;
            await rpc.call('server.version', ['ZeusNamecoin/1.0', '1.4']);
            const history = parseHistory(
                await rpc.call('blockchain.scripthash.get_history', [
                    namecoinElectrumScriptHash(name)
                ])
            );
            if (history.length === 0) return null;
            const latest = history[history.length - 1];
            const transaction = await rpc.call<Transaction>(
                'blockchain.transaction.get',
                [latest.tx_hash, true]
            );
            let currentHeight = 0;
            try {
                const header = await rpc.call<{ height?: unknown }>(
                    'blockchain.headers.subscribe',
                    []
                );
                if (
                    typeof header?.height === 'number' &&
                    Number.isInteger(header.height)
                ) {
                    currentHeight = header.height;
                }
            } catch {
                // Match Amethyst: without a height, skip only the expiry check.
            }
            if (
                currentHeight > 0 &&
                latest.height > 0 &&
                currentHeight - latest.height >= NAME_EXPIRE_DEPTH
            ) {
                return null;
            }
            const value = extractNamecoinValue(transaction, name);
            if (value === null) {
                // A history hit without the expected name output is an
                // inconsistent or malformed server response, not proof that
                // the name is absent. Try another server as Quartz does.
                throw new Error(
                    'ElectrumX transaction did not contain the requested name'
                );
            }
            return value;
        };
        try {
            return await withTimeout(operation(), timeoutMs, close);
        } finally {
            close();
        }
    }
}
