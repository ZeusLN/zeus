import {
    getFormattedDateTime,
    convertActivityToCsv,
    shareCsvFiles,
    purgeLegacyActivityCsvExports,
    LEGACY_CSV_EXPORT_REGEX,
    CSV_KEYS
} from '.././utils/ActivityCsvUtils';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { Platform } from 'react-native';

jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/mock/download/path',
    DocumentDirectoryPath: '/mock/document/path',
    CachesDirectoryPath: '/mock/caches/path',
    writeFile: jest.fn(),
    exists: jest.fn(),
    unlink: jest.fn(),
    readDir: jest.fn()
}));

jest.mock('react-native-share', () => ({
    __esModule: true,
    default: { open: jest.fn() }
}));

jest.mock('react-native', () => ({
    Platform: { OS: 'android' }
}));

describe('activityCsvUtils', () => {
    describe('getFormattedDateTime', () => {
        it('returns a properly formatted timestamp', () => {
            const result = getFormattedDateTime();
            expect(result).toMatch(/^\d{8}_\d{6}$/); // Example: 20250212_140719
        });
    });

    describe('convertActivityToCsv', () => {
        it('correctly formats Invoice CSV data', async () => {
            const mockInvoices = [
                {
                    getAmount: 1500,
                    getPaymentRequest: 'inv_req123',
                    getRHash: 'hash_inv1',
                    getMemo: 'Test Memo',
                    getNote: 'Test Note',
                    getCreationDate: '2024-02-10',
                    formattedTimeUntilExpiry: '30 min'
                },
                {
                    getAmount: 3000,
                    getPaymentRequest: 'inv_req456',
                    getRHash: 'hash_inv2',
                    getMemo: '',
                    getNote: '',
                    getCreationDate: '2024-02-11',
                    formattedTimeUntilExpiry: '1 hour'
                }
            ];

            const result = await convertActivityToCsv(
                mockInvoices,
                CSV_KEYS.invoice
            );
            expect(result).toContain(
                '"1500","inv_req123","hash_inv1","Test Memo","Test Note","2024-02-10","30 min"'
            );
            expect(result).toContain(
                '"3000","inv_req456","hash_inv2","","","2024-02-11","1 hour"'
            );
        });

        it('correctly formats Payment CSV data', async () => {
            const mockPayments = [
                {
                    getDestination: 'dest123',
                    getPaymentRequest: 'pay_req123',
                    paymentHash: 'hash_pay1',
                    getAmount: 800,
                    getMemo: 'Payment Memo',
                    getNote: 'Payment Note',
                    getDate: '2024-02-09'
                },
                {
                    getDestination: 'dest456',
                    getPaymentRequest: 'pay_req456',
                    paymentHash: 'hash_pay2',
                    getAmount: 1600,
                    getMemo: '',
                    getNote: '',
                    getDate: '2024-02-08'
                }
            ];

            const result = await convertActivityToCsv(
                mockPayments,
                CSV_KEYS.payment
            );
            expect(result).toContain(
                '"dest123","pay_req123","hash_pay1","800","Payment Memo","Payment Note","2024-02-09"'
            );
            expect(result).toContain(
                '"dest456","pay_req456","hash_pay2","1600","","","2024-02-08"'
            );
        });

        it('correctly formats Transaction CSV data', async () => {
            const mockTransactions = [
                {
                    tx: 'txhash1',
                    getAmount: 2000,
                    getFee: 50,
                    getNote: 'Tx Note1',
                    getDate: '2024-02-07'
                },
                {
                    tx: 'txhash2',
                    getAmount: 5000,
                    getFee: 100,
                    getNote: '',
                    getDate: '2024-02-06'
                }
            ];

            const result = await convertActivityToCsv(
                mockTransactions,
                CSV_KEYS.transaction
            );
            expect(result).toContain(
                '"txhash1","2000","50","Tx Note1","2024-02-07"'
            );
            expect(result).toContain('"txhash2","5000","100","","2024-02-06"');
        });

        it('handles missing fields for Invoice CSV', async () => {
            const mockInvoices = [{ getAmount: 1500 }];
            const result = await convertActivityToCsv(
                mockInvoices,
                CSV_KEYS.invoice
            );
            expect(result).toContain('"1500","","","","","",""');
        });

        it('handles missing fields for Payment CSV', async () => {
            const mockPayments = [{ getDestination: 'dest123' }];
            const result = await convertActivityToCsv(
                mockPayments,
                CSV_KEYS.payment
            );
            expect(result).toContain('"dest123","","","","","",""');
        });

        it('handles missing fields for Transaction CSV', async () => {
            const mockTransactions = [{ tx: 'txhash1', getAmount: 2000 }];
            const result = await convertActivityToCsv(
                mockTransactions,
                CSV_KEYS.transaction
            );
            expect(result).toContain('"txhash1","2000","","",""');
        });
    });

    describe('shareCsvFiles', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            (RNFS.exists as jest.Mock).mockResolvedValue(false);
            (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
            (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
            (Share.open as jest.Mock).mockResolvedValue(undefined);
        });

        it('stages files in cache and hands them to the share sheet', async () => {
            await shareCsvFiles([
                { fileName: 'a.csv', csvData: 'a,data' },
                { fileName: 'b.csv', csvData: 'b,data' }
            ]);

            expect(RNFS.writeFile).toHaveBeenCalledWith(
                '/mock/caches/path/a.csv',
                'a,data',
                'utf8'
            );
            expect(RNFS.writeFile).toHaveBeenCalledWith(
                '/mock/caches/path/b.csv',
                'b,data',
                'utf8'
            );
            expect(Share.open).toHaveBeenCalledWith({
                urls: [
                    'file:///mock/caches/path/a.csv',
                    'file:///mock/caches/path/b.csv'
                ],
                type: 'text/csv',
                failOnCancel: false
            });
        });

        it('unlinks staging files after a successful share', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }]);

            expect(RNFS.unlink).toHaveBeenCalledWith('/mock/caches/path/a.csv');
        });

        it('unlinks staging files and rethrows when the share fails', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            (Share.open as jest.Mock).mockRejectedValue(
                new Error('share failed')
            );
            // staging write succeeds, then cleanup sees the file
            (RNFS.exists as jest.Mock)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

            await expect(
                shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }])
            ).rejects.toThrow('share failed');

            expect(RNFS.unlink).toHaveBeenCalledWith('/mock/caches/path/a.csv');
            consoleErrorSpy.mockRestore();
        });
    });

    describe('purgeLegacyActivityCsvExports', () => {
        const entry = (name: string, isFile = true) => ({
            name,
            path: `/mock/document/path/${name}`,
            isFile: () => isFile
        });

        beforeEach(() => {
            jest.clearAllMocks();
            (Platform.OS as any) = 'ios';
            (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
        });

        it('matches only ZEUS-named CSV exports', () => {
            expect(
                LEGACY_CSV_EXPORT_REGEX.test('zeus_20250212_140719_invoice.csv')
            ).toBe(true);
            expect(
                LEGACY_CSV_EXPORT_REGEX.test(
                    'zeus_20250212_140719_ln_payments (2).csv'
                )
            ).toBe(true);
            expect(LEGACY_CSV_EXPORT_REGEX.test('myexport.csv')).toBe(false);
            expect(LEGACY_CSV_EXPORT_REGEX.test('notes.txt')).toBe(false);
        });

        it('deletes only matching files from iOS Documents', async () => {
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                entry('zeus_20250212_140719_invoice.csv'),
                entry('zeus_20250212_140719_onchain (1).csv'),
                entry('myexport.csv'),
                entry('ldk-node', false)
            ]);

            await purgeLegacyActivityCsvExports();

            expect(RNFS.readDir).toHaveBeenCalledWith('/mock/document/path');
            expect(RNFS.unlink).toHaveBeenCalledTimes(2);
            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/mock/document/path/zeus_20250212_140719_invoice.csv'
            );
            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/mock/document/path/zeus_20250212_140719_onchain (1).csv'
            );
        });

        it('does nothing on Android', async () => {
            (Platform.OS as any) = 'android';

            await purgeLegacyActivityCsvExports();

            expect(RNFS.readDir).not.toHaveBeenCalled();
        });

        it('swallows readDir and unlink errors', async () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            (RNFS.readDir as jest.Mock).mockRejectedValue(
                new Error('no access')
            );

            await expect(
                purgeLegacyActivityCsvExports()
            ).resolves.toBeUndefined();

            (RNFS.readDir as jest.Mock).mockResolvedValue([
                entry('zeus_20250212_140719_invoice.csv')
            ]);
            (RNFS.unlink as jest.Mock).mockRejectedValue(
                new Error('unlink denied')
            );

            await expect(
                purgeLegacyActivityCsvExports()
            ).resolves.toBeUndefined();

            consoleWarnSpy.mockRestore();
        });
    });
});
