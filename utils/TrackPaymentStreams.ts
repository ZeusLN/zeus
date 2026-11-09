import { lnrpc } from '../proto/lightning';
import { newStreamRequestId } from './StreamRequestUtils';

// how long a TrackPaymentV2 stream's latest update is served before a
// lookup opens a fresh stream. A stream that dies without a terminal
// update (the node stopped, the transport dropped) would otherwise keep
// answering with a stale in-flight state; a stale in-flight answer only
// delays a terminal result, so this bounds the delay
export const TRACK_PAYMENT_STREAM_MAX_AGE_MS = 60000;

// SUCCEEDED or FAILED, as lnrpc's enum number (embedded LND) or name (LNC)
export const isTerminalPaymentStatus = (status: unknown): boolean =>
    status === lnrpc.Payment.PaymentStatus.SUCCEEDED ||
    status === lnrpc.Payment.PaymentStatus.FAILED ||
    status === 'SUCCEEDED' ||
    status === 'FAILED';

type Waiter<P> = {
    resolve: (payment: P) => void;
    reject: (error: any) => void;
};

type Stream<P> = {
    openedAt: number;
    // the id the stream was started with, echoed on each of its events
    requestId?: string;
    latest?: P;
    waiters: Set<Waiter<P>>;
};

/**
 * One TrackPaymentV2 stream per payment hash, shared by every lookup of
 * that hash. On embedded LND and LNC a track stream can't be cancelled
 * from JS and stays open until the payment is terminal, so opening one
 * per lookup piles them up while a payment is held (one per tracker
 * poll). Here the first lookup opens a stream and later lookups get its
 * latest update until it ends or ages out.
 *
 * Both transports emit every track stream's events under one name. Each
 * stream is started with its own request id, which the native modules
 * echo on all of its events, so an error or EOF (which carry no hash)
 * ends only the stream it names. Updates are attributed by the hash they
 * carry, so one from a stream replaced after the max age still counts
 * for its hash.
 */
export default class TrackPaymentStreams<P> {
    private streams = new Map<string, Stream<P>>();

    constructor(
        private readonly options: {
            maxAgeMs: number;
            // the last stream was forgotten: the shared listener can go
            onIdle?: () => void;
        }
    ) {}

    get size() {
        return this.streams.size;
    }

    // Resolves with the latest update for `hash`, opening a stream with
    // `open` when none is live, and rejects with 'Request timeout' if the
    // stream hasn't answered within `timeoutMs`. `open` starts the stream
    // with the request id it is given and may attach the shared listener
    // first.
    lookup = (
        hash: string,
        timeoutMs: number,
        open: (requestId: string) => unknown
    ): Promise<P> => {
        const key = hash.toLowerCase();
        let stream = this.streams.get(key);
        let opening = false;
        if (stream && Date.now() - stream.openedAt >= this.options.maxAgeMs) {
            // lookups already waiting on the old stream move to the new one
            stream = { openedAt: Date.now(), waiters: stream.waiters };
            this.streams.set(key, stream);
            opening = true;
        } else if (stream?.latest !== undefined) {
            return Promise.resolve(stream.latest);
        } else if (!stream) {
            stream = { openedAt: Date.now(), waiters: new Set() };
            this.streams.set(key, stream);
            opening = true;
        }

        const waiters = stream.waiters;
        const promise = new Promise<P>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.streams.get(key)?.waiters.delete(waiter);
                reject(new Error('Request timeout'));
            }, timeoutMs);
            const waiter: Waiter<P> = {
                resolve: (payment) => {
                    clearTimeout(timer);
                    resolve(payment);
                },
                reject: (error) => {
                    clearTimeout(timer);
                    reject(error);
                }
            };
            waiters.add(waiter);
        });
        // opened after the waiter is registered, so a failure to open
        // reaches it
        if (opening) this.start(key, stream, open);
        return promise;
    };

    // An update for `hash` arrived on the stream started with `requestId`.
    // A terminal update ends the stream, so the next lookup opens a new one
    // (which answers and closes at once). An in-flight update for a hash
    // with no stream comes from one that is still open but no longer
    // tracked, e.g. a stream replaced after the max age whose replacement
    // then failed: serve from it again instead of opening another on the
    // next lookup, under its own request id so its error or EOF can end it.
    update = (
        hash: string,
        payment: P,
        terminal: boolean,
        requestId?: unknown
    ) => {
        const key = hash.toLowerCase();
        let stream = this.streams.get(key);
        if (!stream) {
            if (terminal) return;
            stream = { openedAt: Date.now(), waiters: new Set() };
            if (typeof requestId === 'string' && requestId !== '') {
                stream.requestId = requestId;
            }
            this.streams.set(key, stream);
        }
        stream.latest = payment;
        const waiters = [...stream.waiters];
        stream.waiters.clear();
        if (terminal) this.forget(key);
        waiters.forEach((waiter) => waiter.resolve(payment));
    };

    // An error or EOF event arrived. It ends the stream started with
    // `requestId`: that stream's waiting lookups fail and the next lookup
    // opens a new one. Events without the id of a tracked stream belong to
    // streams already replaced or forgotten and are dropped. lnd sends EOF
    // only after a stream's terminal update, which has already forgotten
    // it, so an EOF that ends a stream here is one that closed without a
    // terminal update.
    fail = (error: any, requestId: unknown) => {
        if (typeof requestId !== 'string' || requestId === '') return;
        for (const [key, stream] of this.streams) {
            if (stream.requestId === requestId) {
                this.end(key, stream, error);
                return;
            }
        }
    };

    // Forgets every stream, e.g. when the node stops and they all end.
    // Waiting lookups are left to their timeouts.
    clear = () => {
        this.streams.clear();
        this.options.onIdle?.();
    };

    private start = (
        key: string,
        stream: Stream<P>,
        open: (requestId: string) => unknown
    ) => {
        const requestId = newStreamRequestId();
        stream.requestId = requestId;
        const failOpen = (error: any) =>
            this.end(
                key,
                stream,
                error instanceof Error
                    ? error
                    : new Error(error?.message || String(error))
            );
        try {
            Promise.resolve(open(requestId)).catch(failOpen);
        } catch (error) {
            failOpen(error);
        }
    };

    // Forgets a stream that has ended and fails the lookups waiting on it.
    private end = (key: string, stream: Stream<P>, error: any) => {
        if (this.streams.get(key) !== stream) return;
        this.forget(key);
        const failed = [...stream.waiters];
        stream.waiters.clear();
        failed.forEach((waiter) => waiter.reject(error));
    };

    private forget = (key: string) => {
        this.streams.delete(key);
        if (this.streams.size === 0) this.options.onIdle?.();
    };
}
