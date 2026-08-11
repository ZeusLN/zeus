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

// Stages CSV files in app-private cache and hands them to the system share
// sheet so the user explicitly picks a destination. Never writes to shared
// storage directly: files dropped in Downloads/Documents are readable by
// other tooling and outlive the app. Staging files are unlinked after every
// share attempt.
export const shareCsvFiles = async (
    files: Array<{ fileName: string; csvData: string }>
): Promise<void> => {
    // Loaded lazily: react-native-share touches native modules at import
    // time, and this util sits in the SettingsStore module graph via the
    // legacy-export purge below
    const Share = require('react-native-share').default;
    const stagedPaths: string[] = [];
    try {
        for (const file of files) {
            const path = `${RNFS.CachesDirectoryPath}/${file.fileName}`;
            if (await RNFS.exists(path)) await RNFS.unlink(path);
            await RNFS.writeFile(path, file.csvData, 'utf8');
            stagedPaths.push(path);
        }

        await Share.open({
            urls: stagedPaths.map((path) => `file://${path}`),
            type: 'text/csv',
            failOnCancel: false
        });
    } catch (err) {
        console.error('Failed to share CSV file(s):', err);
        throw err;
    } finally {
        for (const path of stagedPaths) {
            try {
                if (await RNFS.exists(path)) await RNFS.unlink(path);
            } catch (e) {
                console.warn('Error deleting CSV staging file:', e);
            }
        }
    }
};

// Both CSV export flows name their files zeus_<YYYYMMDD>_<HHMMSS>_<type>.csv
// (getFormattedDateTime above); older builds also appended " (n)" suffixes
// to avoid collisions.
export const LEGACY_CSV_EXPORT_REGEX = /^zeus_\d{8}_\d{6}.*\.csv$/i;

// Best-effort removal of CSVs that older builds wrote to the Files-visible
// iOS Documents directory: invisible to the user once file sharing is
// disabled, yet still swept into iCloud/iTunes backups. Android Downloads
// CSVs are intentionally left in place; they hold no credentials and remain
// user-accessible there.
export const purgeLegacyActivityCsvExports = async (): Promise<void> => {
    if (Platform.OS !== 'ios') return;
    try {
        const entries = await RNFS.readDir(RNFS.DocumentDirectoryPath);
        for (const entry of entries) {
            if (entry.isFile() && LEGACY_CSV_EXPORT_REGEX.test(entry.name)) {
                try {
                    await RNFS.unlink(entry.path);
                    console.log('Legacy CSV export deleted:', entry.path);
                } catch (e) {
                    console.warn('Error deleting legacy CSV export:', e);
                }
            }
        }
    } catch (e) {
        console.warn('Error purging legacy CSV exports:', e);
    }
};
