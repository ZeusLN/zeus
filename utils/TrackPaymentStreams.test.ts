import { lnrpc } from '../proto/lightning';
import TrackPaymentStreams, {
    isTerminalPaymentStatus
} from './TrackPaymentStreams';

const HASH = 'ab'.repeat(32);
const OTHER_HASH = 'cd'.repeat(32);
const MAX_AGE_MS = 60000;

const flush = () => new Promise(jest.requireActual('timers').setImmediate);

describe('TrackPaymentStreams', () => {
    let onIdle: jest.Mock;
    let streams: TrackPaymentStreams<any>;

    beforeEach(() => {
        jest.useFakeTimers();
        onIdle = jest.fn();
        streams = new TrackPaymentStreams({ maxAgeMs: MAX_AGE_MS, onIdle });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('opens one stream per hash and answers later lookups from its latest update', async () => {
        const open = jest.fn();
        const first = streams.lookup(HASH, 10000, open);
        const second = streams.lookup(HASH.toUpperCase(), 10000, open);
        await flush();
        expect(open).toHaveBeenCalledTimes(1);

        const inFlight = { payment_hash: HASH, status: 'IN_FLIGHT' };
        streams.update(HASH, inFlight, false);
        await expect(first).resolves.toBe(inFlight);
        await expect(second).resolves.toBe(inFlight);

        // a poll while the payment is held reuses the open stream
        await expect(streams.lookup(HASH, 10000, open)).resolves.toBe(inFlight);
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('serves the newest update the stream has delivered', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await lookup;
        streams.update(HASH, { status: 'IN_FLIGHT', htlcs: [1] }, false);

        await expect(streams.lookup(HASH, 10000, open)).resolves.toEqual({
            status: 'IN_FLIGHT',
            htlcs: [1]
        });
    });

    it('opens a new stream after a terminal update', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'SUCCEEDED' }, true);
        await expect(lookup).resolves.toEqual({ status: 'SUCCEEDED' });
        expect(streams.size).toBe(0);
        expect(onIdle).toHaveBeenCalledTimes(1);

        streams.lookup(HASH, 10000, open);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
    });

    it('ignores updates for hashes nobody looked up', async () => {
        const lookup = streams.lookup(HASH, 10000, jest.fn());
        streams.update(OTHER_HASH, { status: 'SUCCEEDED' }, true);
        expect(streams.size).toBe(1);

        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(lookup).resolves.toEqual({ status: 'IN_FLIGHT' });
    });

    it('reopens a stream older than the max age', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await lookup;

        // the stream may have died without a terminal update
        jest.advanceTimersByTime(MAX_AGE_MS);
        const fresh = streams.lookup(HASH, 10000, open);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);

        streams.update(HASH, { status: 'SUCCEEDED' }, true);
        await expect(fresh).resolves.toEqual({ status: 'SUCCEEDED' });
    });

    it('fails only lookups whose stream has not answered yet', async () => {
        const answered = streams.lookup(OTHER_HASH, 10000, jest.fn());
        streams.update(OTHER_HASH, { status: 'IN_FLIGHT' }, false);
        await answered;

        const waiting = streams.lookup(HASH, 10000, jest.fn());
        const error = new Error("payment isn't initiated");
        streams.fail(error);

        await expect(waiting).rejects.toBe(error);
        // the answered stream exists on the node and keeps serving
        await expect(
            streams.lookup(OTHER_HASH, 10000, jest.fn())
        ).resolves.toEqual({ status: 'IN_FLIGHT' });
        expect(streams.size).toBe(1);
    });

    it('takes back a stream that answers after an error forgot it', async () => {
        // the error was another stream's NOT_FOUND, delivered before this
        // stream's first update
        const open = jest.fn();
        const waiting = streams.lookup(HASH, 10000, open);
        streams.fail(new Error("payment isn't initiated"));
        await expect(waiting).rejects.toThrow("payment isn't initiated");
        expect(streams.size).toBe(0);

        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(streams.lookup(HASH, 10000, open)).resolves.toEqual({
            status: 'IN_FLIGHT'
        });
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('ignores a terminal update for a hash with no stream', () => {
        streams.update(HASH, { status: 'SUCCEEDED' }, true);
        expect(streams.size).toBe(0);
    });

    it('rejects with a timeout and keeps the stream for the next lookup', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        jest.advanceTimersByTime(10000);
        await expect(lookup).rejects.toThrow('Request timeout');

        // a slow stream isn't reopened on every poll
        const next = streams.lookup(HASH, 10000, open);
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(next).resolves.toEqual({ status: 'IN_FLIGHT' });
    });

    it('rejects and forgets the stream when opening it fails', async () => {
        const lookup = streams.lookup(HASH, 10000, () => {
            throw new Error('not connected');
        });
        await expect(lookup).rejects.toThrow('not connected');
        expect(streams.size).toBe(0);
        expect(onIdle).toHaveBeenCalledTimes(1);
    });

    it('forgets every stream on clear', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await lookup;

        streams.clear();
        expect(streams.size).toBe(0);
        expect(onIdle).toHaveBeenCalled();
        streams.lookup(HASH, 10000, open);
        await flush();
        expect(open).toHaveBeenCalledTimes(2);
    });
});

describe('isTerminalPaymentStatus', () => {
    it('accepts SUCCEEDED and FAILED as enum numbers or names', () => {
        expect(
            isTerminalPaymentStatus(lnrpc.Payment.PaymentStatus.SUCCEEDED)
        ).toBe(true);
        expect(
            isTerminalPaymentStatus(lnrpc.Payment.PaymentStatus.FAILED)
        ).toBe(true);
        expect(isTerminalPaymentStatus('SUCCEEDED')).toBe(true);
        expect(isTerminalPaymentStatus('FAILED')).toBe(true);
    });

    it('rejects in-flight and unknown states', () => {
        expect(
            isTerminalPaymentStatus(lnrpc.Payment.PaymentStatus.IN_FLIGHT)
        ).toBe(false);
        expect(
            isTerminalPaymentStatus(lnrpc.Payment.PaymentStatus.INITIATED)
        ).toBe(false);
        expect(isTerminalPaymentStatus('IN_FLIGHT')).toBe(false);
        expect(isTerminalPaymentStatus(undefined)).toBe(false);
    });
});
