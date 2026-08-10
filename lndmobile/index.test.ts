jest.mock('react-native', () => ({
    NativeModules: { LndMobile: {}, LndMobileTools: {} }
}));
jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: jest.fn(),
    decodeStreamResult: jest.fn()
}));
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: {
        addListener: jest.fn(() => ({ remove: jest.fn() }))
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
