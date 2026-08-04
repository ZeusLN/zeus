jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn()
}));

// DonationUtils.test.ts
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
    calculateDonationAmount,
    findDonationPercentageIndex,
    loadDonationLnurl
} from './DonationUtils';

const mockFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const mockConsoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

describe('DonationUtils', () => {
    describe('calculateDonationAmount', () => {
        it('should return correct donation amount with rounding down', () => {
            expect(calculateDonationAmount(1000, 25)).toBe(250);
            expect(calculateDonationAmount(999, 25)).toBe(249);
            expect(calculateDonationAmount(1, 33)).toBe(0);
        });

        it('should handle string inputs', () => {
            expect(calculateDonationAmount('5000', 10)).toBe(500);
        });

        it('should default to zero on falsy requestAmount', () => {
            expect(calculateDonationAmount(0, 10)).toBe(0);
            expect(calculateDonationAmount(undefined as any, 10)).toBe(0);
        });
    });

    describe('findDonationPercentageIndex', () => {
        const options = [5, 10, 20];

        it('should return correct index for exact match', () => {
            expect(findDonationPercentageIndex(5, options)).toBe(0);
            expect(findDonationPercentageIndex(10, options)).toBe(1);
            expect(findDonationPercentageIndex(20, options)).toBe(2);
        });

        it('should return null for non-matching percentage', () => {
            expect(findDonationPercentageIndex(23, options)).toBe(null);
        });
    });

    describe('loadDonationLnurl', () => {
        const CALLBACK_URL =
            'https://pay.zeusln.app/BTC/UILNURL/pay/lnaddress/tips';
        const DONATION_METADATA =
            '[["text/identifier","tips@pay.zeusln.app"],["text/plain","Paid to ZEUS (Order ID: )"]]';
        // Real 21 sat (21000 msat) invoice issued by pay.zeusln.app whose
        // description_hash is sha256(DONATION_METADATA)
        const DONATION_INVOICE_21_SATS =
            'lnbc210n1p48zdsvpp5jkksnqvq4dpf67e4u6n3d3e4hn7lee6wt2g9rquwgavxgca0wzhqhp5tlfzg0jpxjddu0htpe54lkrd5n0zqce9rqwwk24g0lrxqmkhhsdscqzzsxqzuzsp5sehyhye2sn5vlauqz6cnrw58qjz65yzy3782ruk22pyanehhvdgq9qxpqysgq98pyfpyajv4myx7rtcm8jhs8g7jqpgahjsvlsvjcznzx4ljy9gyzvtfca7dldwst0tlmuygshy7re60zfys0d94w8ym6jky6jax4ylcqg4uz05';
        // BOLT11 spec reference vector with no amount
        const NO_AMOUNT_INVOICE =
            'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap2r09nt4ndd0unm3z9u5t48y6ucv4r5sg7lk98c77ctvjczkspk5qprc90gx';

        const mockLnurlParams = (overrides: any = {}) => ({
            json: () => ({
                callback: CALLBACK_URL,
                metadata: DONATION_METADATA,
                ...overrides
            })
        });

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should fetch LNURL data and return a verified payment request', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            const result = await loadDonationLnurl('21');

            expect(result).toBe(DONATION_INVOICE_21_SATS);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenNthCalledWith(
                1,
                'GET',
                'https://pay.zeusln.app/.well-known/lnurlp/tips'
            );
            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                `${CALLBACK_URL}?amount=21000`
            );
        });

        it('should convert donation amount to millisats', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            await loadDonationLnurl('500');

            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                `${CALLBACK_URL}?amount=500000`
            );
        });

        it('should return null on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await loadDonationLnurl('1000');

            expect(result).toBeNull();
            expect(mockConsoleError).toHaveBeenCalledWith(
                'loadLnurl error:',
                expect.any(Error)
            );
        });

        it('should return null when callback request fails', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockRejectedValueOnce(new Error('Callback failed'));

            const result = await loadDonationLnurl('1000');

            expect(result).toBeNull();
            expect(mockConsoleError).toHaveBeenCalled();
        });

        it('should handle decimal donation amounts', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            await loadDonationLnurl('21.5');

            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                `${CALLBACK_URL}?amount=21500`
            );
        });

        it('should reject an invoice whose amount does not match the request', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            const result = await loadDonationLnurl('22');

            expect(result).toBeNull();
        });

        it('should reject an invoice with no amount', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: NO_AMOUNT_INVOICE })
                });

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
        });

        it('should reject an undecodable payment request', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams())
                .mockResolvedValueOnce({
                    json: () => ({ pr: 'not-an-invoice' })
                });

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
        });

        it('should reject a callback off the donation domain without calling it', async () => {
            mockFetch.mockResolvedValueOnce(
                mockLnurlParams({ callback: 'https://evil.com/cb' })
            );

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should reject a lookalike callback domain', async () => {
            mockFetch.mockResolvedValueOnce(
                mockLnurlParams({
                    callback: 'https://pay.zeusln.app.evil.com/cb'
                })
            );

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should reject an invoice whose description_hash does not commit to the metadata', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    mockLnurlParams({
                        metadata:
                            '[["text/plain","Tampered metadata for a different payee"]]'
                    })
                )
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
        });

        it('should reject when the LNURL params omit metadata', async () => {
            mockFetch
                .mockResolvedValueOnce(mockLnurlParams({ metadata: undefined }))
                .mockResolvedValueOnce({
                    json: () => ({ pr: DONATION_INVOICE_21_SATS })
                });

            const result = await loadDonationLnurl('21');

            expect(result).toBeNull();
        });

        it('should reject invalid donation amounts without any network call', async () => {
            expect(await loadDonationLnurl('0')).toBeNull();
            expect(await loadDonationLnurl('-21')).toBeNull();
            expect(await loadDonationLnurl('abc')).toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});
