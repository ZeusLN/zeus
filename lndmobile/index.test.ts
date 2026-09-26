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
jest.mock('../stores/Stores', () => ({
    settingsStore: { settings: {} },
    nodeInfoStore: { nodeInfo: {} }
}));

import { trackPaymentV2 } from './index';
import { sendStreamCommand } from './utils';
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
        const assertion = expect(promise).rejects.toThrow('Request timeout');
        jest.advanceTimersByTime(10001);
        await assertion;
    });

    it('removes its listener once settled', async () => {
        const promise = trackPaymentV2(HASH_HEX);
        expect(emitter.listenerCount('RouterTrackPaymentV2')).toBe(1);
        emit(paymentEvent(HASH_HEX, lnrpc.Payment.PaymentStatus.SUCCEEDED));
        await promise;
        expect(emitter.listenerCount('RouterTrackPaymentV2')).toBe(0);
    });
});
