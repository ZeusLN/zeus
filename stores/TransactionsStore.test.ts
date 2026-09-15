jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => require('crypto').randomBytes(n)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        payLightningInvoice: jest.fn(),
        sendKeysend: jest.fn(),
        lookupPayment: jest.fn(),
        supportsPaymentLookup: jest.fn(() => true),
        isLNDBased: jest.fn(() => true)
    }
}));
jest.mock('../utils/Bolt11Utils', () => ({
    __esModule: true,
    default: {
        decode: jest.fn(() => ({ payment_hash: 'ab'.repeat(32) }))
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (s: string) => s
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));
jest.mock('../utils/RatingUtils', () => ({
    RATING_MODAL_TRIGGER_DELAY: 1000
}));

import TransactionsStore, {
    PAYMENT_TRACK_POLL_MS,
    PAYMENT_TRACK_MAX_FAILURES
} from './TransactionsStore';
import BackendUtils from '../utils/BackendUtils';

// 64-char hex: normalizePaymentHash rejects anything that isn't a real hash
const HASH = 'ab'.repeat(32);

const newStore = () =>
    new TransactionsStore(
        { implementation: 'lnd', enableTor: false, settings: {} } as any,
        {} as any,
        {} as any,
        {} as any,
        { checkAndTriggerRatingModal: jest.fn() } as any
    );

const flush = () => jest.advanceTimersByTimeAsync(0);
const advancePoll = () => jest.advanceTimersByTimeAsync(PAYMENT_TRACK_POLL_MS);

describe('TransactionsStore payment tracking (issue #4317)', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(true);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('holds the guard on an IN_FLIGHT result and tracks to SUCCEEDED', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        // the first lookup fires immediately when tracking starts; the
        // terminal result lands on the second poll
        (BackendUtils.lookupPayment as jest.Mock)
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({ status: 'IN_FLIGHT', payment_hash: HASH })
            .mockResolvedValueOnce({
                status: 'SUCCEEDED',
                payment_hash: HASH,
                payment_preimage: 'deadbeef'
            });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // stream ended non-terminal: guard must stay armed
        expect(store.paymentInFlight).toBe(true);
        expect(store.status).toBe('IN_FLIGHT');

        await advancePoll();
        expect(store.paymentInFlight).toBe(true);

        await advancePoll();
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('treats a client-side timeout as unknown and surfaces the tracked FAILED outcome', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            payment_error: 'views.SendingLightning.paymentTimedOut',
            payment_timed_out: true
        });
        // hold the first lookup open so the ambiguous state is observable
        let resolveLookup: (value: any) => void = () => {};
        (BackendUtils.lookupPayment as jest.Mock).mockReturnValue(
            new Promise((resolve) => {
                resolveLookup = resolve;
            })
        );

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        // outcome unknown: no error yet, guard held, in-transit UI
        expect(store.paymentInFlight).toBe(true);
        expect(store.error).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');

        resolveLookup({
            status: 'FAILED',
            failure_reason: 'FAILURE_REASON_TIMEOUT',
            payment_hash: HASH
        });
        await flush();
        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.status).toBe('FAILED');
    });

    it('replaces a transport error with success when the payment settled anyway', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('connection closed')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.error).toBe(false);
    });

    it('releases the guard when the node has no record of the payment', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockRejectedValue(
            new Error('invoice is invalid')
        );
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue(null);

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('invoice is invalid');
    });

    it('gives up after consecutive failed lookups and releases the guard', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockRejectedValue(
            new Error('node unreachable')
        );

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        for (let i = 0; i < PAYMENT_TRACK_MAX_FAILURES; i++) {
            await advancePoll();
        }
        expect(store.paymentInFlight).toBe(false);
        expect(BackendUtils.lookupPayment).toHaveBeenCalledTimes(
            PAYMENT_TRACK_MAX_FAILURES
        );
    });

    it('keeps the pre-tracking behavior on backends without payment lookup', async () => {
        (BackendUtils.supportsPaymentLookup as jest.Mock).mockReturnValue(
            false
        );
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();

        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        expect(BackendUtils.lookupPayment).not.toHaveBeenCalled();
    });

    it('ignores a second send while a tracked payment is unresolved', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(BackendUtils.payLightningInvoice).toHaveBeenCalledTimes(1);
    });

    it('lets an unscoped handlePayment (Rebalance view path) stop tracking and clear the guard', async () => {
        (BackendUtils.payLightningInvoice as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });
        (BackendUtils.lookupPayment as jest.Mock).mockResolvedValue({
            status: 'IN_FLIGHT',
            payment_hash: HASH
        });

        const store = newStore();
        store.sendPayment({ payment_request: 'lnbc1fake' });
        await flush();
        expect(store.paymentInFlight).toBe(true);

        store.handlePayment({
            status: 'SUCCEEDED',
            payment_hash: HASH,
            payment_preimage: 'deadbeef'
        });
        expect(store.paymentInFlight).toBe(false);
        expect(store.status).toBe('SUCCEEDED');

        // the orphaned tracking loop must exit without resurrecting state
        const calls = (BackendUtils.lookupPayment as jest.Mock).mock.calls
            .length;
        await advancePoll();
        await advancePoll();
        expect(
            (BackendUtils.lookupPayment as jest.Mock).mock.calls.length
        ).toBeLessThanOrEqual(calls + 1);
        expect(store.paymentInFlight).toBe(false);
    });
});
