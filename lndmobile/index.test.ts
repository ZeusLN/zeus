jest.mock('react-native', () => ({
    NativeModules: { LndMobile: {}, LndMobileTools: {} }
}));
jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: jest.fn(),
    // test events carry the decoded lnrpc.Payment as JSON
    decodeStreamResult: jest.fn(({ base64Result }) => JSON.parse(base64Result))
}));
// the RouterSendPaymentV2 listeners currently registered
const mockListeners = new Set<(event: any) => void>();
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: {
        addListener: jest.fn((_event: string, callback: any) => {
            mockListeners.add(callback);
            return { remove: () => mockListeners.delete(callback) };
        })
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import { listPayments, sendKeysendPaymentV2, sendPaymentV2Sync } from './index';
import { sendCommand, sendStreamCommand } from './utils';

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

    // the native bridge sends every call's events to every listener
    const emit = (payment: object) =>
        Array.from(mockListeners).forEach((callback) =>
            callback({ data: JSON.stringify(payment) })
        );
    const keysend = (hashHex: string) =>
        sendKeysendPaymentV2({
            dest: '02'.repeat(33),
            amt: 1000,
            payment_hash: Buffer.from(hashHex, 'hex').toString('base64')
        });

    beforeEach(() => {
        // earlier tests leave calls that never got an event
        mockListeners.clear();
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

        emit({ payment_hash: HASH_B, status: 'SUCCEEDED' });
        await expect(b).resolves.toEqual({
            payment_hash: HASH_B,
            status: 'SUCCEEDED'
        });
        await jest.advanceTimersByTimeAsync(0);

        // A's listener must survive B's event, or A never resolves
        expect(aSettled).toBe(false);
        expect(mockListeners.size).toBe(1);

        emit({ payment_hash: HASH_A, status: 'FAILED' });
        await expect(a).resolves.toEqual({
            payment_hash: HASH_A,
            status: 'FAILED'
        });
        expect(mockListeners.size).toBe(0);
    });

    it("keeps an invoice payment waiting through a keysend's event", async () => {
        const invoice = sendPaymentV2Sync({
            payment_request: SPEC_PAYMENT_REQUEST,
            timeout_seconds: 60
        });
        const b = keysend(HASH_B);
        let invoiceSettled = false;
        invoice.then(() => (invoiceSettled = true));

        emit({ payment_hash: HASH_B, status: 'SUCCEEDED' });
        await expect(b).resolves.toMatchObject({ payment_hash: HASH_B });
        await jest.advanceTimersByTimeAsync(0);
        expect(invoiceSettled).toBe(false);

        emit({ payment_hash: SPEC_PAYMENT_HASH, status: 'SUCCEEDED' });
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
        expect(options().reversed).toBe(false);
    });

    it('omits creation_date_start without a bound', async () => {
        await listPayments({ maxPayments: 50, reversed: true });

        expect(options().creation_date_start).toBeUndefined();
        expect(options().reversed).toBe(true);
    });

    it('requests the newest 1000 payments by default', async () => {
        await listPayments();

        expect((sendCommand as jest.Mock).mock.calls[0][0].method).toBe(
            'ListPayments'
        );
        expect(options().reversed).toBe(true);
        expect(options().include_incomplete).toBe(true);
        expect(String(options().max_payments)).toBe('1000');
    });

    it('requests the newest page when only maxPayments is given', async () => {
        await listPayments({ maxPayments: 50 });

        expect(options().reversed).toBe(true);
        expect(String(options().max_payments)).toBe('50');
    });

    it('pages forward from the oldest payment when reversed is false', async () => {
        await listPayments({ reversed: false });

        expect(options().reversed).toBe(false);
    });
});
