import {
    getFormattedDateTime,
    convertActivityToCsv,
    saveCsvFile,
    CSV_KEYS
} from '.././utils/ActivityCsvUtils';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

jest.mock('react-native-fs', () => ({
    DownloadDirectoryPath: '/mock/download/path',
    DocumentDirectoryPath: '/mock/document/path',
    writeFile: jest.fn()
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

    describe('saveCsvFile', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('writes the CSV file to the correct path on Android', async () => {
            (Platform.OS as any) = 'android';
            (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

            await saveCsvFile('test.csv', 'mock,csv,data');

            expect(RNFS.writeFile).toHaveBeenCalledWith(
                '/mock/download/path/test.csv',
                'mock,csv,data',
                'utf8'
            );
        });

        it('writes the CSV file to the correct path on iOS', async () => {
            (Platform.OS as any) = 'ios';
            (RNFS.writeFile as jest.Mock).mockResolvedValue(undefined);

            await saveCsvFile('test.csv', 'mock,csv,data');

            expect(RNFS.writeFile).toHaveBeenCalledWith(
                '/mock/document/path/test.csv',
                'mock,csv,data',
                'utf8'
            );
        });

        it('throws an error when file writing fails (but suppresses console error)', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            (RNFS.writeFile as jest.Mock).mockRejectedValue(
                new Error('File write failed')
            );

            await expect(
                saveCsvFile('test.csv', 'mock,csv,data')
            ).rejects.toThrow('File write failed');

            consoleErrorSpy.mockRestore();
        });
    });
});
