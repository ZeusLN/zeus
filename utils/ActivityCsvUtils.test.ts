import {
    getFormattedDateTime,
    convertActivityToCsv,
    sanitizeCsvFileName,
    shareCsvFiles,
    purgeCsvShareStaging,
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
    mkdir: jest.fn(),
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

    describe('sanitizeCsvFileName', () => {
        it('keeps ordinary names, including spaces, intact', () => {
            expect(sanitizeCsvFileName('my activity.csv')).toBe(
                'my activity.csv'
            );
            expect(
                sanitizeCsvFileName('zeus_20250212_140719_onchain.csv')
            ).toBe('zeus_20250212_140719_onchain.csv');
        });

        it('reduces path-traversal names to a basename', () => {
            expect(sanitizeCsvFileName('../../Documents/evil.csv')).toBe(
                'evil.csv'
            );
            expect(sanitizeCsvFileName('2024/01-export.csv')).toBe(
                '01-export.csv'
            );
            expect(sanitizeCsvFileName('a\\b.csv')).toBe('b.csv');
        });

        it('strips characters that corrupt file:// URLs', () => {
            // # parses as a URL fragment on both platforms, ? as a query,
            // % as a broken escape sequence
            expect(sanitizeCsvFileName('report#1.csv')).toBe('report1.csv');
            expect(sanitizeCsvFileName('is it done?.csv')).toBe(
                'is it done.csv'
            );
            expect(sanitizeCsvFileName('progress 50%.csv')).toBe(
                'progress 50.csv'
            );
        });

        it('appends the csv extension when missing', () => {
            expect(sanitizeCsvFileName('taxes')).toBe('taxes.csv');
        });

        it('falls back to a timestamped default when nothing survives', () => {
            expect(sanitizeCsvFileName('###.csv')).toMatch(
                /^zeus_\d{8}_\d{6}\.csv$/
            );
            expect(sanitizeCsvFileName('..')).toMatch(
                /^zeus_\d{8}_\d{6}\.csv$/
            );
            expect(sanitizeCsvFileName('')).toMatch(/^zeus_\d{8}_\d{6}\.csv$/);
        });
    });

    describe('shareCsvFiles', () => {
        const stagingDir = '/mock/caches/path/csv-share-staging';

        beforeEach(() => {
            jest.clearAllMocks();
            (RNFS.exists as jest.Mock).mockResolvedValue(false);
            (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);
            (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
            (RNFS.mkdir as jest.Mock).mockResolvedValue(undefined);
            (Share.open as jest.Mock).mockResolvedValue(undefined);
        });

        it('stages files in a cache subdir and hands them to the share sheet', async () => {
            await shareCsvFiles([
                { fileName: 'a.csv', csvData: 'a,data' },
                { fileName: 'b.csv', csvData: 'b,data' }
            ]);

            expect(RNFS.mkdir).toHaveBeenCalledWith(stagingDir);
            expect(RNFS.writeFile).toHaveBeenCalledWith(
                `${stagingDir}/a.csv`,
                'a,data',
                'utf8'
            );
            expect(RNFS.writeFile).toHaveBeenCalledWith(
                `${stagingDir}/b.csv`,
                'b,data',
                'utf8'
            );
            expect(Share.open).toHaveBeenCalledWith({
                urls: [
                    `file://${stagingDir}/a.csv`,
                    `file://${stagingDir}/b.csv`
                ],
                type: 'text/csv',
                failOnCancel: false
            });
        });

        it('sanitizes user-supplied file names before staging', async () => {
            await shareCsvFiles([
                { fileName: '../../evil#name.csv', csvData: 'a,data' }
            ]);

            expect(RNFS.writeFile).toHaveBeenCalledWith(
                `${stagingDir}/evilname.csv`,
                'a,data',
                'utf8'
            );
        });

        it('leaves staged files in place after Share.open settles', async () => {
            // the receiving app may still be streaming the FileProvider URI
            // when the promise resolves; cleanup happens on the next share
            // and in clearAllData
            await shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }]);

            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('sweeps the previous staging dir before sharing', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }]);

            expect(RNFS.unlink).toHaveBeenCalledWith(stagingDir);
            expect(RNFS.unlink).toHaveBeenCalledTimes(1);
        });

        it('sweeps staging and rethrows when the share fails', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            (Share.open as jest.Mock).mockRejectedValue(
                new Error('share failed')
            );
            // pre-share sweep finds nothing, failure sweep sees the dir
            (RNFS.exists as jest.Mock)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

            await expect(
                shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }])
            ).rejects.toThrow('share failed');

            expect(RNFS.unlink).toHaveBeenCalledWith(stagingDir);
            consoleErrorSpy.mockRestore();
        });

        it('sweeps staging when a write fails mid-flight', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            (RNFS.writeFile as jest.Mock).mockRejectedValue(
                new Error('disk full')
            );
            (RNFS.exists as jest.Mock)
                .mockResolvedValueOnce(false)
                .mockResolvedValue(true);

            await expect(
                shareCsvFiles([{ fileName: 'a.csv', csvData: 'a,data' }])
            ).rejects.toThrow('disk full');

            expect(RNFS.unlink).toHaveBeenCalledWith(stagingDir);
            expect(Share.open).not.toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('purgeCsvShareStaging', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);
        });

        it('removes the staging dir when present', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await purgeCsvShareStaging();

            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/mock/caches/path/csv-share-staging'
            );
        });

        it('does nothing when the staging dir is absent', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(false);

            await purgeCsvShareStaging();

            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('swallows unlink errors', async () => {
            const consoleWarnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            (RNFS.exists as jest.Mock).mockResolvedValue(true);
            (RNFS.unlink as jest.Mock).mockRejectedValue(new Error('locked'));

            await expect(purgeCsvShareStaging()).resolves.toBeUndefined();

            consoleWarnSpy.mockRestore();
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

        it('matches every export shape released builds generated', () => {
            for (const suffix of [
                'ln_invoices',
                'ln_payments',
                'onchain',
                'invoice',
                'payment',
                'invoice_payment',
                'transaction'
            ]) {
                expect(
                    LEGACY_CSV_EXPORT_REGEX.test(
                        `zeus_20250212_140719_${suffix}.csv`
                    )
                ).toBe(true);
            }
            expect(
                LEGACY_CSV_EXPORT_REGEX.test(
                    'zeus_20250212_140719_ln_payments (2).csv'
                )
            ).toBe(true);
        });

        it('does not match user files that merely share the prefix', () => {
            // e.g. an export the user renamed while keeping the timestamp
            expect(
                LEGACY_CSV_EXPORT_REGEX.test(
                    'zeus_20250212_140719_personal-tax.csv'
                )
            ).toBe(false);
            expect(
                LEGACY_CSV_EXPORT_REGEX.test(
                    'zeus_20250212_140719_invoice_backup.csv'
                )
            ).toBe(false);
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

        it('does nothing on Android by default', async () => {
            (Platform.OS as any) = 'android';

            await purgeLegacyActivityCsvExports();

            expect(RNFS.readDir).not.toHaveBeenCalled();
        });

        it('sweeps Android Downloads when asked to (full wipe)', async () => {
            (Platform.OS as any) = 'android';
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                {
                    name: 'zeus_20250212_140719_transaction.csv',
                    path: '/mock/download/path/zeus_20250212_140719_transaction.csv',
                    isFile: () => true
                },
                {
                    name: 'unrelated.csv',
                    path: '/mock/download/path/unrelated.csv',
                    isFile: () => true
                }
            ]);

            await purgeLegacyActivityCsvExports(true);

            expect(RNFS.readDir).toHaveBeenCalledWith('/mock/download/path');
            expect(RNFS.unlink).toHaveBeenCalledTimes(1);
            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/mock/download/path/zeus_20250212_140719_transaction.csv'
            );
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
