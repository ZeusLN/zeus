import {
    PAYMENT_LOOKUP_PAGE_SIZE,
    findPaymentByHash,
    isPaymentLookupInconclusive,
    paymentCreationTimeMs
} from './PaymentLookupUtils';

const HASH = 'ab'.repeat(32);
const BOUND = 1_700_000_000;

const payment = (i: number) => ({
    payment_hash: i.toString(16).padStart(64, '0'),
    creation_date: String(BOUND + i)
});
const page = (count: number, extra: any[] = []) => ({
    payments: [
        ...Array.from({ length: count }, (_, i) => payment(i + 1)),
        ...extra
    ]
});

describe('findPaymentByHash', () => {
    it('finds the payment on the bounded ascending page with one request', async () => {
        const target = {
            payment_hash: HASH.toUpperCase(),
            status: 'IN_FLIGHT'
        };
        const fetchPage = jest.fn().mockResolvedValue(page(3, [target]));

        await expect(findPaymentByHash(fetchPage, HASH, BOUND)).resolves.toBe(
            target
        );
        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith({
            maxPayments: PAYMENT_LOOKUP_PAGE_SIZE,
            reversed: false,
            creationDateStart: BOUND
        });
    });

    it('resolves null when neither pass sees the payment and the bounded page is partial', async () => {
        const fetchPage = jest
            .fn()
            .mockResolvedValueOnce(page(3))
            .mockResolvedValueOnce(page(PAYMENT_LOOKUP_PAGE_SIZE));

        await expect(
            findPaymentByHash(fetchPage, HASH, BOUND)
        ).resolves.toBeNull();
        expect(fetchPage).toHaveBeenLastCalledWith({
            maxPayments: PAYMENT_LOOKUP_PAGE_SIZE,
            reversed: true
        });
    });

    it('rejects as inconclusive when a full bounded page misses', async () => {
        const fetchPage = jest
            .fn()
            .mockResolvedValueOnce(page(PAYMENT_LOOKUP_PAGE_SIZE))
            .mockResolvedValueOnce(page(PAYMENT_LOOKUP_PAGE_SIZE));

        const error = await findPaymentByHash(fetchPage, HASH, BOUND).catch(
            (e) => e
        );
        expect(isPaymentLookupInconclusive(error)).toBe(true);
    });

    it('finds a payment created before the bound via the newest page (device clock ahead of the node)', async () => {
        const target = {
            payment_hash: HASH,
            creation_date: String(BOUND - 60)
        };
        const fetchPage = jest
            .fn()
            // the node filters out everything created before the bound
            .mockResolvedValueOnce({ payments: [] })
            .mockResolvedValueOnce(page(10, [target]));

        await expect(findPaymentByHash(fetchPage, HASH, BOUND)).resolves.toBe(
            target
        );
    });

    it('prefers the newest page over an inconclusive bounded page', async () => {
        const target = { payment_hash: HASH };
        const fetchPage = jest
            .fn()
            .mockResolvedValueOnce(page(PAYMENT_LOOKUP_PAGE_SIZE))
            .mockResolvedValueOnce(page(3, [target]));

        await expect(findPaymentByHash(fetchPage, HASH, BOUND)).resolves.toBe(
            target
        );
    });

    it('without a bound, scans only the newest page and treats a full miss as inconclusive', async () => {
        const fetchPage = jest
            .fn()
            .mockResolvedValue(page(PAYMENT_LOOKUP_PAGE_SIZE));

        const error = await findPaymentByHash(fetchPage, HASH).catch((e) => e);
        expect(isPaymentLookupInconclusive(error)).toBe(true);
        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith({
            maxPayments: PAYMENT_LOOKUP_PAGE_SIZE,
            reversed: true
        });
    });

    it('without a bound, resolves null on a partial newest page', async () => {
        const fetchPage = jest.fn().mockResolvedValue(page(3));
        await expect(findPaymentByHash(fetchPage, HASH)).resolves.toBeNull();
    });

    it('passes transport failures through as ordinary rejections', async () => {
        const fetchPage = jest.fn().mockRejectedValue(new Error('offline'));
        const error = await findPaymentByHash(fetchPage, HASH, BOUND).catch(
            (e) => e
        );
        expect(error.message).toBe('offline');
        expect(isPaymentLookupInconclusive(error)).toBe(false);
    });
});

describe('paymentCreationTimeMs', () => {
    it('prefers creation_time_ns for sub-second precision', () => {
        expect(
            paymentCreationTimeMs({
                creation_time_ns: '1700000000123456789',
                creation_date: '1700000000'
            })
        ).toBe(1700000000123);
    });

    it('falls back to creation_date seconds', () => {
        expect(paymentCreationTimeMs({ creation_date: '1700000000' })).toBe(
            1700000000000
        );
    });

    it('reads embedded LND Long values through toString', () => {
        expect(
            paymentCreationTimeMs({
                creation_time_ns: { toString: () => '0' },
                creation_date: { toString: () => '1700000000' }
            })
        ).toBe(1700000000000);
    });

    it('returns null without a usable creation time', () => {
        expect(paymentCreationTimeMs({})).toBeNull();
        expect(paymentCreationTimeMs(null)).toBeNull();
        expect(
            paymentCreationTimeMs({ creation_time_ns: 'x', creation_date: '' })
        ).toBeNull();
    });
});
