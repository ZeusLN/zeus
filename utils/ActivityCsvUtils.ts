import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

import { toCsvRow } from './CsvUtils';

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
                toCsvRow(keysToInclude.map((field) => item[field.value]))
            )
            .join('\n');

        return `${header}\n${rows}`;
    } catch (err) {
        console.error(err);
        return '';
    }
};

export const CSV_SHARE_STAGING_DIR = 'csv-share-staging';

const csvShareStagingPath = () =>
    `${RNFS.CachesDirectoryPath}/${CSV_SHARE_STAGING_DIR}`;

// The export screens accept a free-form file name. Reduce it to a safe
// basename: path separators would escape the staging dir (and feed unlink
// an arbitrary path), and #/?/% survive into the file:// URL where both
// platforms parse them as fragment/query and resolve the wrong path.
export const sanitizeCsvFileName = (fileName: string): string => {
    const base = fileName.split(/[/\\]/).pop() ?? '';
    const cleaned = base.replace(/[\u0000-\u001f\u007f#?%*:"<>|]/g, '').trim();
    const stem = cleaned.replace(/\.csv$/i, '');
    if (!stem || /^\.+$/.test(stem)) {
        return `zeus_${getFormattedDateTime()}.csv`;
    }
    return `${stem}.csv`;
};

// Removes the whole CSV share staging directory, every share's subdir
// included. Only for clearAllData; a share must never sweep another share's
// files (see sweepStaleShareStaging).
export const purgeCsvShareStaging = async (): Promise<void> => {
    try {
        const dir = csvShareStagingPath();
        if (await RNFS.exists(dir)) await RNFS.unlink(dir);
    } catch (e) {
        console.warn('Error purging CSV share staging:', e);
    }
};

// Staged files cannot be unlinked as soon as Share.open settles: on Android
// the promise resolves when the user picks a chooser target, while the
// receiving app streams the FileProvider URI afterwards, so an immediate
// unlink hands the receiver a dead attachment. Each share therefore stages
// into its own subdir named <creation ms>-<seq>, keeps it after a handoff,
// and later shares and every launch (checkLegacyExportFiles) sweep only
// subdirs older than this, long after any receiver has read them.
// clearAllData sweeps everything on wipe.
export const SHARE_STAGING_TTL_MS = 60 * 60 * 1000;

let shareStagingSeq = 0;

export const createShareStagingDir = async (): Promise<string> => {
    const dir = `${csvShareStagingPath()}/${Date.now()}-${++shareStagingSeq}`;
    await RNFS.mkdir(dir);
    return dir;
};

// Removes one share's own subdir, for when nothing was handed off
export const removeShareStagingDir = async (dir: string): Promise<void> => {
    try {
        await RNFS.unlink(dir);
    } catch (e) {
        console.warn('Error removing CSV share staging:', e);
    }
};

// Removes staging subdirs older than SHARE_STAGING_TTL_MS, plus anything
// that is not a timestamped subdir (files earlier builds of this flow
// staged directly in the root). A recent subdir is never touched.
export const sweepStaleShareStaging = async (
    now: number = Date.now()
): Promise<void> => {
    let entries: Array<{ name: string; path: string; isDirectory(): boolean }>;
    try {
        entries = await RNFS.readDir(csvShareStagingPath());
    } catch (e) {
        // no staging root yet
        return;
    }
    for (const entry of entries) {
        const created = /^(\d+)-\d+$/.exec(entry.name);
        if (
            entry.isDirectory() &&
            created &&
            now - Number(created[1]) < SHARE_STAGING_TTL_MS
        ) {
            continue;
        }
        try {
            await RNFS.unlink(entry.path);
        } catch (e) {
            console.warn('Error sweeping stale CSV share staging:', e);
        }
    }
};

// Makes every name in one share batch unique (case-insensitively, as on
// the default iOS filesystem) by inserting " (n)" before the extension, so
// no staged file overwrites another: sanitizing can map distinct names to
// the same one (a?b.csv and ab.csv both become ab.csv).
export const dedupeFileNames = (names: string[]): string[] => {
    const used = new Set<string>();
    return names.map((name) => {
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let candidate = name;
        let n = 2;
        while (used.has(candidate.toLowerCase())) {
            candidate = `${stem} (${n++})${ext}`;
        }
        used.add(candidate.toLowerCase());
        return candidate;
    });
};

// Stages CSV files in app-private cache and hands them to the system share
// sheet so the user explicitly picks a destination. Never writes to shared
// storage directly: files dropped in Downloads/Documents are readable by
// other tooling and outlive the app.
export const shareCsvFiles = async (
    files: Array<{ fileName: string; csvData: string }>
): Promise<void> => {
    // Loaded lazily: react-native-share touches native modules at import
    // time, and this util sits in the SettingsStore module graph via the
    // legacy-export check
    const Share = require('react-native-share').default;
    await sweepStaleShareStaging();
    const dir = await createShareStagingDir();
    try {
        const names = dedupeFileNames(
            files.map((file) => sanitizeCsvFileName(file.fileName))
        );
        const stagedPaths: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const path = `${dir}/${names[i]}`;
            await RNFS.writeFile(path, files[i].csvData, 'utf8');
            stagedPaths.push(path);
        }

        await Share.open({
            urls: stagedPaths.map((path) => `file://${path}`),
            type: 'text/csv',
            failOnCancel: false
        });
    } catch (err) {
        // Share.open only rejects before any handoff, so nothing can be
        // reading this share's files yet; don't leave partials behind
        await removeShareStagingDir(dir);
        console.error('Failed to share CSV file(s):', err);
        throw err;
    }
};

// Both CSV export flows name their files zeus_<YYYYMMDD>_<HHMMSS>_<type>.csv
// (getFormattedDateTime above). The type alternation covers every suffix any
// released build generated (older builds used _invoice/_payment/
// _invoice_payment/_transaction before the current names), and older builds
// also appended " (n)" to avoid collisions. Anchored to exactly those shapes
// so a user file that merely starts with a ZEUS timestamp (e.g. a renamed
// export) is not swept up.
export const LEGACY_CSV_EXPORT_REGEX =
    /^zeus_\d{8}_\d{6}_(ln_invoices|ln_payments|onchain|invoice|payment|invoice_payment|transaction)( \(\d+\))?\.csv$/i;

// Best-effort removal of CSVs that older builds wrote to shared storage:
// the Files-visible iOS Documents directory (invisible to the user once
// file sharing is disabled, yet still swept into iCloud/iTunes backups) and
// Android Downloads. Only clearAllData calls this, so a panic/duress wipe
// does not leave a transaction history behind in public storage; at
// startup the user is asked instead (LegacyExportUtils).
export const purgeLegacyActivityCsvExports = async (): Promise<void> => {
    const dir =
        Platform.OS === 'ios'
            ? RNFS.DocumentDirectoryPath
            : RNFS.DownloadDirectoryPath;
    try {
        const entries = await RNFS.readDir(dir);
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
