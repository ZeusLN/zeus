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

    it('starts each stream with its own request id', () => {
        const open = jest.fn();
        streams.lookup(HASH, 10000, open);
        streams.lookup(OTHER_HASH, 10000, open);

        expect(open.mock.calls[0][0]).toEqual(expect.any(String));
        expect(open.mock.calls[1][0]).not.toEqual(open.mock.calls[0][0]);
    });

    it('fails only the stream an error names', async () => {
        const openHeld = jest.fn();
        const openUnknown = jest.fn();
        const held = streams.lookup(HASH, 10000, openHeld);
        const unknown = streams.lookup(OTHER_HASH, 10000, openUnknown);
        const error = new Error("payment isn't initiated");

        streams.fail(error, openUnknown.mock.calls[0][0]);
        await expect(unknown).rejects.toBe(error);
        expect(streams.size).toBe(1);

        // the held payment's lookup still gets its own stream's answer
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(held).resolves.toEqual({ status: 'IN_FLIGHT' });
        expect(openHeld).toHaveBeenCalledTimes(1);
    });

    it('ends an answered stream on its error, so the next lookup reopens', async () => {
        const open = jest.fn();
        const lookup = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await lookup;

        streams.fail(new Error('stream ended'), open.mock.calls[0][0]);
        expect(streams.size).toBe(0);
        expect(onIdle).toHaveBeenCalledTimes(1);

        streams.lookup(HASH, 10000, open);
        expect(open).toHaveBeenCalledTimes(2);
    });

    it('drops errors that name no tracked stream', async () => {
        const lookup = streams.lookup(HASH, 10000, jest.fn());

        streams.fail(new Error('untagged'), undefined);
        streams.fail(new Error('untagged'), '');
        streams.fail(new Error('gone'), 'not-a-stream');
        expect(streams.size).toBe(1);

        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(lookup).resolves.toEqual({ status: 'IN_FLIGHT' });
    });

    it('ignores the error of a stream replaced after the max age', async () => {
        const open = jest.fn();
        const first = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await first;

        jest.advanceTimersByTime(MAX_AGE_MS);
        const fresh = streams.lookup(HASH, 10000, open);
        streams.fail(new Error('old stream ended'), open.mock.calls[0][0]);
        expect(streams.size).toBe(1);

        streams.update(HASH, { status: 'SUCCEEDED' }, true);
        await expect(fresh).resolves.toEqual({ status: 'SUCCEEDED' });
    });

    it('takes back a replaced stream that answers after its replacement failed', async () => {
        const open = jest.fn();
        const first = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await first;

        jest.advanceTimersByTime(MAX_AGE_MS);
        const fresh = streams.lookup(HASH, 10000, open);
        streams.fail(new Error('transport dropped'), open.mock.calls[1][0]);
        await expect(fresh).rejects.toThrow('transport dropped');
        expect(streams.size).toBe(0);

        // the first stream is still open on the node
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await expect(streams.lookup(HASH, 10000, open)).resolves.toEqual({
            status: 'IN_FLIGHT'
        });
        expect(open).toHaveBeenCalledTimes(2);
    });

    it('ends a taken-back stream on its own error', async () => {
        const open = jest.fn();
        const first = streams.lookup(HASH, 10000, open);
        streams.update(HASH, { status: 'IN_FLIGHT' }, false);
        await first;
        const firstId = open.mock.calls[0][0];

        jest.advanceTimersByTime(MAX_AGE_MS);
        const fresh = streams.lookup(HASH, 10000, open);
        streams.fail(new Error('transport dropped'), open.mock.calls[1][0]);
        await expect(fresh).rejects.toThrow('transport dropped');

        // the first stream answers again and is taken back under its id,
        // so its EOF ends it and the next lookup reopens
        streams.update(HASH, { status: 'IN_FLIGHT' }, false, firstId);
        expect(streams.size).toBe(1);
        streams.fail(new Error('EOF'), firstId);
        expect(streams.size).toBe(0);
        streams.lookup(HASH, 10000, open).catch(() => {});
        await flush();
        expect(open).toHaveBeenCalledTimes(3);
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
