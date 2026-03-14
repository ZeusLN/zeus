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
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should fetch LNURL data and return a payment request', async () => {
            const callbackUrl = 'https://pay.zeusln.app/callback';
            const expectedPr = 'lnbc1000n1ptest...';

            mockFetch
                .mockResolvedValueOnce({
                    json: () => ({ callback: callbackUrl })
                })
                .mockResolvedValueOnce({
                    json: () => ({ pr: expectedPr })
                });

            const result = await loadDonationLnurl('1000');

            expect(result).toBe(expectedPr);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenNthCalledWith(
                1,
                'GET',
                'https://pay.zeusln.app/.well-known/lnurlp/tips'
            );
            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                `${callbackUrl}?amount=1000000`
            );
        });

        it('should convert donation amount to millisats', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    json: () => ({ callback: 'https://example.com/cb' })
                })
                .mockResolvedValueOnce({
                    json: () => ({ pr: 'lnbc...' })
                });

            await loadDonationLnurl('500');

            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                'https://example.com/cb?amount=500000'
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
                .mockResolvedValueOnce({
                    json: () => ({ callback: 'https://example.com/cb' })
                })
                .mockRejectedValueOnce(new Error('Callback failed'));

            const result = await loadDonationLnurl('1000');

            expect(result).toBeNull();
            expect(mockConsoleError).toHaveBeenCalled();
        });

        it('should handle decimal donation amounts', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    json: () => ({ callback: 'https://example.com/cb' })
                })
                .mockResolvedValueOnce({
                    json: () => ({ pr: 'lnbc...' })
                });

            await loadDonationLnurl('21.5');

            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                'GET',
                'https://example.com/cb?amount=21500'
            );
        });
    });
});
