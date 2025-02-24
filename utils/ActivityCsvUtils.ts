import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

//  Keys for CSV export.
export const CSV_KEYS = {
    invoice: [
        { label: 'Amount Paid (sat)', value: 'getAmount' },
        { label: 'Payment Request', value: 'getPaymentRequest' },
        { label: 'Payment Hash', value: 'getRHash' },
        { label: 'Memo', value: 'getMemo' },
        { label: 'Note', value: 'getNote' },
        { label: 'Creation Date', value: 'getCreationDate' },
        { label: 'Expiry', value: 'formattedTimeUntilExpiry' }
    ],
    payment: [
        { label: 'Destination', value: 'getDestination' },
        { label: 'Payment Request', value: 'getPaymentRequest' },
        { label: 'Payment Hash', value: 'paymentHash' },
        { label: 'Amount Paid (sat)', value: 'getAmount' },
        { label: 'Memo', value: 'getMemo' },
        { label: 'Note', value: 'getNote' },
        { label: 'Creation Date', value: 'getDate' }
    ],
    transaction: [
        { label: 'Transaction Hash', value: 'tx' },
        { label: 'Amount (sat)', value: 'getAmount' },
        { label: 'Total Fees (sat)', value: 'getFee' },
        { label: 'Note', value: 'getNote' },
        { label: 'Timestamp', value: 'getDate' }
    ]
};

// Generates a formatted timestamp string for file naming.
export const getFormattedDateTime = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
};

// Converts activity data into a CSV string.
export const convertActivityToCsv = async (
    data: Array<any>,
    keysToInclude: Array<{ label: string; value: string }>
): Promise<string> => {
    if (!data || data.length === 0) return '';

    try {
        const header = keysToInclude.map((field) => field.label).join(',');
        const rows = data
            .map((item) =>
                keysToInclude
                    .map((field) => `"${item[field.value] || ''}"`)
                    .join(',')
            )
            .join('\n');

        return `${header}\n${rows}`;
    } catch (err) {
        console.error(err);
        return '';
    }
};

//Saves CSV file to the device.
export const saveCsvFile = async (fileName: string, csvData: string) => {
    try {
        const filePath =
            Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        console.log(`Saving file to: ${filePath}`);
        await RNFS.writeFile(filePath, csvData, 'utf8');
    } catch (err) {
        console.error('Failed to save CSV file:', err);
        throw err;
    }
};
