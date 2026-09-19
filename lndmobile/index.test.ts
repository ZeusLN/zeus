// Import-time scaffolding: LndMobileUtils pulls in device info, stores,
// and the native module at import time, so it is replaced wholesale with
// a controllable in-process event emitter plus a checkLndStreamErrorResponse
// stand-in that mirrors the real contract (EOF sentinel, transient null,
// Error otherwise). The native transport in ./utils is stubbed; the
// protobuf codecs stay real so events round-trip through actual encoding.
jest.mock('../utils/LndMobileUtils', () => {
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    return {
        __emitter: emitter,
        LndMobileEventEmitter: {
            addListener: (name: string, cb: (e: any) => void) => {
                emitter.on(name, cb);
                return {
                    remove: () => emitter.removeListener(name, cb)
                };
            }
        },
        checkLndStreamErrorResponse: (_name: string, e: any) => {
            if (!e || typeof e !== 'object') return new Error('invalid');
            if (e.error_code) {
                const desc = e.error_desc || '';
                if (desc === 'EOF') return 'EOF';
                if (desc === 'transient') return null;
                return new Error(desc);
            }
            return null;
        }
    };
});
jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: jest.fn(async () => 'stream started'),
    sendBidiStreamCommand: jest.fn(),
    writeToStream: jest.fn(),
    decodeStreamResult: jest.requireActual('./utils').decodeStreamResult
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));

import {
    listPayments,
    sendKeysendPaymentV2,
    sendPaymentV2Sync,
    trackPaymentV2
} from './index';
import { sendCommand, sendStreamCommand } from './utils';
import { lnrpc, routerrpc } from '../proto/lightning';
import Base64Utils from '../utils/Base64Utils';

const { __emitter: emitter } = jest.requireMock('../utils/LndMobileUtils');

const HASH_HEX =
    '9f1459d8a2ac9353e6e229e4d85b11d1830b6a25f7f3f1786a107ecfd86f5d34';
const OTHER_HASH_HEX = 'ab'.repeat(32);

const paymentEvent = (
    payment_hash: string,
    status: lnrpc.Payment.PaymentStatus
) => ({
    data: Base64Utils.bytesToBase64(
        lnrpc.Payment.encode(
            lnrpc.Payment.create({ payment_hash, status })
        ).finish()
    )
});

const emit = (event: any) => emitter.emit('RouterTrackPaymentV2', event);

describe('trackPaymentV2', () => {
    afterEach(() => {
        emitter.removeAllListeners('RouterTrackPaymentV2');
        jest.useRealTimers();
    });

    it('sends a TrackPaymentRequest for the hash', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.SUCCEEDED));
        await promise;

        const call = (sendStreamCommand as jest.Mock).mock.calls.at(-1)[0];
        expect(call.method).toBe('RouterTrackPaymentV2');
        expect(call.request).toBe(routerrpc.TrackPaymentRequest);
        expect(Base64Utils.bytesToHex(call.options.payment_hash)).toBe(
            HASH_HEX
        );
        expect(call.options.no_inflight_updates).toBe(false);
    });

    it('resolves with the first update carrying its hash, whatever the status', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        // another lookup's update on the shared channel must not answer
        emit(
            paymentEvent(OTHER_HASH_HEX, lnrpc.Payment.PaymentStatus.SUCCEEDED)
        );
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.IN_FLIGHT));

        const payment = await promise;
        expect(payment.payment_hash).toBe(HASH_HEX);
        expect(payment.status).toBe(lnrpc.Payment.PaymentStatus.IN_FLIGHT);
    });

    it('matches the hash case-insensitively', async () => {
        const promise = trackPaymentV2(HASH_HEX.toUpperCase());
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.SUCCEEDED));
        await expect(promise).resolves.toMatchObject({
            payment_hash: HASH_HEX
        });
    });

    it('rejects with the stream error (NOT_FOUND surfaces to the caller)', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        emit({ error_code: 5, error_desc: "payment isn't initiated" });
        await expect(promise).rejects.toThrow("payment isn't initiated");
    });

    it('ignores EOF, transient errors, and payload-less events', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        emit({ error_code: 1, error_desc: 'EOF' });
        emit({ error_code: 1, error_desc: 'transient' });
        emit({});
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.FAILED));
        await expect(promise).resolves.toMatchObject({
            status: lnrpc.Payment.PaymentStatus.FAILED
        });
    });

    it('rejects with a timeout when the stream never answers', async () => {
        jest.useFakeTimers();
        const promise = trackPaymentV2(HASH_HEX);
        jest.advanceTimersByTime(10001);
        await expect(promise).rejects.toThrow('Request timeout');
    });

    it('removes its listener once settled', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        expect(emitter.listenerCount('RouterTrackPaymentV2')).toBe(1);
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.SUCCEEDED));
        await promise;
        expect(emitter.listenerCount('RouterTrackPaymentV2')).toBe(0);
    });
});

describe('sendPaymentV2Sync', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // the node never answers on the stream
        (sendStreamCommand as jest.Mock).mockResolvedValue('');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns an outcome-unknown result when the forced timeout fires', async () => {
        jest.setSystemTime(1_700_000_000_000);
        const result = sendPaymentV2Sync({
            payment_request: 'lnbc1fake',
            timeout_seconds: 60
        });

        await jest.advanceTimersByTimeAsync(61_000);

        // without payment_timed_out the store reports a failure and
        // releases the send guard while the payment may still settle
        await expect(result).resolves.toEqual({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true,
            dispatch_deadline_ms: 1_700_000_000_000
        });
    });

    it('does not time out before timeout_seconds + 1', async () => {
        let settled = false;
        sendPaymentV2Sync({
            payment_request: 'lnbc1fake',
            timeout_seconds: 60
        }).then(() => (settled = true));

        await jest.advanceTimersByTimeAsync(60_999);
        expect(settled).toBe(false);
    });
});

describe('sendKeysendPaymentV2', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // the node never answers on the stream
        (sendStreamCommand as jest.Mock).mockResolvedValue('');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const keysend = () =>
        sendKeysendPaymentV2({
            dest: '02'.repeat(33),
            amt: 1000,
            payment_hash: Buffer.from('ab'.repeat(32), 'hex').toString('base64')
        });

    it('returns an outcome-unknown result when the forced timeout fires', async () => {
        jest.setSystemTime(1_700_000_000_000);
        const result = keysend();

        await jest.advanceTimersByTimeAsync(61_000);

        // a keysend retry uses a fresh preimage, so a failure here could
        // double-pay if the original HTLC later settles
        await expect(result).resolves.toEqual({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true,
            dispatch_deadline_ms: 1_700_000_000_000
        });
    });

    it('does not time out before 61 seconds', async () => {
        let settled = false;
        keysend().then(() => (settled = true));

        await jest.advanceTimersByTimeAsync(60_999);
        expect(settled).toBe(false);
    });

    it('uses the timeout_seconds the store sends', async () => {
        (sendStreamCommand as jest.Mock).mockClear();
        let settled = false;
        sendKeysendPaymentV2({
            dest: '02'.repeat(33),
            amt: 1000,
            payment_hash: Buffer.from('ab'.repeat(32), 'hex').toString(
                'base64'
            ),
            timeout_seconds: 30
        }).then(() => (settled = true));

        expect(
            (sendStreamCommand as jest.Mock).mock.calls[0][0].options
                .timeout_seconds
        ).toBe(30);
        await jest.advanceTimersByTimeAsync(30_999);
        expect(settled).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(settled).toBe(true);
    });
});

describe('concurrent RouterSendPaymentV2 calls', () => {
    const HASH_A = 'aa'.repeat(32);
    const HASH_B = 'bb'.repeat(32);
    // BOLT 11 spec vector; its payment_hash is pinned by the spec
    const SPEC_PAYMENT_REQUEST =
        'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
    const SPEC_PAYMENT_HASH =
        '0001020304050607080900010203040506070809000102030405060708090102';
    const { SUCCEEDED, FAILED } = lnrpc.Payment.PaymentStatus;

    // the native bridge sends every call's events to every listener
    const emitPayment = (
        payment_hash: string,
        status: lnrpc.Payment.PaymentStatus
    ) =>
        emitter.emit('RouterSendPaymentV2', paymentEvent(payment_hash, status));
    const listeners = () => emitter.listenerCount('RouterSendPaymentV2');
    const keysend = (hashHex: string) =>
        sendKeysendPaymentV2({
            dest: '02'.repeat(33),
            amt: 1000,
            payment_hash: Buffer.from(hashHex, 'hex').toString('base64')
        });

    beforeEach(() => {
        // earlier tests leave calls that never got an event
        emitter.removeAllListeners('RouterSendPaymentV2');
        jest.useFakeTimers();
        (sendStreamCommand as jest.Mock).mockResolvedValue('');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("gives each keysend its own result when B's event comes before A's", async () => {
        const a = keysend(HASH_A);
        const b = keysend(HASH_B);
        let aSettled = false;
        a.then(() => (aSettled = true));

        emitPayment(HASH_B, SUCCEEDED);
        await expect(b).resolves.toMatchObject({
            payment_hash: HASH_B,
            status: SUCCEEDED
        });
        await jest.advanceTimersByTimeAsync(0);

        // A's listener must survive B's event, or A never resolves
        expect(aSettled).toBe(false);
        expect(listeners()).toBe(1);

        emitPayment(HASH_A, FAILED);
        await expect(a).resolves.toMatchObject({
            payment_hash: HASH_A,
            status: FAILED
        });
        expect(listeners()).toBe(0);
    });

    it("keeps an invoice payment waiting through a keysend's event", async () => {
        const invoice = sendPaymentV2Sync({
            payment_request: SPEC_PAYMENT_REQUEST,
            timeout_seconds: 60
        });
        const b = keysend(HASH_B);
        let invoiceSettled = false;
        invoice.then(() => (invoiceSettled = true));

        emitPayment(HASH_B, SUCCEEDED);
        await expect(b).resolves.toMatchObject({ payment_hash: HASH_B });
        await jest.advanceTimersByTimeAsync(0);
        expect(invoiceSettled).toBe(false);

        emitPayment(SPEC_PAYMENT_HASH, SUCCEEDED);
        await expect(invoice).resolves.toMatchObject({
            payment_hash: SPEC_PAYMENT_HASH
        });
    });
});

describe('listPayments', () => {
    beforeEach(() => {
        (sendCommand as jest.Mock).mockReset().mockResolvedValue({});
    });

    const options = () => (sendCommand as jest.Mock).mock.calls[0][0].options;

    it('passes creation_date_start as a Long', async () => {
        await listPayments({
            maxPayments: 50,
            reversed: false,
            creationDateStart: 1_700_000_000
        });

        expect(String(options().creation_date_start)).toBe('1700000000');
        expect(String(options().max_payments)).toBe('50');
        expect(options().include_incomplete).toBe(true);
        expect(options().reversed).toBeUndefined();
    });

    it('omits creation_date_start without a bound', async () => {
        await listPayments({ maxPayments: 50, reversed: true });

        expect(options().creation_date_start).toBeUndefined();
        expect(options().reversed).toBe(true);
    });
});
