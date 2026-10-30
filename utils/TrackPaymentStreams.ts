import { lnrpc } from '../proto/lightning';

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
 * Both transports multiplex every track stream onto one event channel
 * with no request correlation. Updates are attributed by the hash they
 * carry. Errors carry none, so an error fails every lookup still waiting
 * for its stream's first update (any of those streams may be the one that
 * errored) and forgets those streams; a forgotten stream that later
 * delivers an update is taken back. Streams that already answered keep
 * serving their latest update: they exist on the node, and an error from
 * one can only mean it ended early, which the max age covers.
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
    // stream hasn't answered within `timeoutMs`. `open` may attach the
    // shared listener before starting the stream.
    lookup = (
        hash: string,
        timeoutMs: number,
        open: () => unknown
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

    // An update for `hash` arrived. A terminal update ends the stream, so
    // the next lookup opens a new one (which answers and closes at once).
    // An in-flight update for a hash with no stream comes from one that
    // was forgotten when an error arrived before its first update (the
    // error may have been another stream's): it is still open, so serve
    // from it again instead of opening another on the next lookup.
    update = (hash: string, payment: P, terminal: boolean) => {
        const key = hash.toLowerCase();
        let stream = this.streams.get(key);
        if (!stream) {
            if (terminal) return;
            stream = { openedAt: Date.now(), waiters: new Set() };
            this.streams.set(key, stream);
        }
        stream.latest = payment;
        const waiters = [...stream.waiters];
        stream.waiters.clear();
        if (terminal) this.forget(key);
        waiters.forEach((waiter) => waiter.resolve(payment));
    };

    // An error with no hash arrived on the shared channel.
    fail = (error: any) => {
        const failed: Waiter<P>[] = [];
        for (const [key, stream] of [...this.streams]) {
            if (stream.latest !== undefined) continue;
            failed.push(...stream.waiters);
            this.forget(key);
        }
        failed.forEach((waiter) => waiter.reject(error));
    };

    // Forgets every stream, e.g. when the node stops and they all end.
    // Waiting lookups are left to their timeouts.
    clear = () => {
        this.streams.clear();
        this.options.onIdle?.();
    };

    private start = (key: string, stream: Stream<P>, open: () => unknown) => {
        const failOpen = (error: any) => {
            if (this.streams.get(key) !== stream) return;
            this.forget(key);
            const failed = [...stream.waiters];
            stream.waiters.clear();
            failed.forEach((waiter) =>
                waiter.reject(
                    error instanceof Error
                        ? error
                        : new Error(error?.message || String(error))
                )
            );
        };
        try {
            Promise.resolve(open()).catch(failOpen);
        } catch (error) {
            failOpen(error);
        }
    };

    private forget = (key: string) => {
        this.streams.delete(key);
        if (this.streams.size === 0) this.options.onIdle?.();
    };
}
