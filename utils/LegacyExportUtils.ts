import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';

import {
    CSV_SHARE_STAGING_DIR,
    LEGACY_CSV_EXPORT_REGEX,
    purgeCsvShareStaging
} from './ActivityCsvUtils';
import { NODE_CONFIG_EXPORT_EXT } from './NodeConfigUtils';
import { localeString } from './LocaleUtils';

// Older builds wrote activity CSVs and wallet config backups (connection
// credentials, not always encrypted) to the iOS Documents directory, which
// the Files app showed as the ZEUS folder. File sharing is now disabled, so
// those files are invisible to the user but still swept into iCloud/iTunes
// backups. They are not deleted behind the user's back: the startup
// migration only records that they exist, and after unlock the user is
// asked once per launch to share them (then they are deleted) or delete
// them. The cleanup flag is set only after one of those two choices.
export const LEGACY_EXPORT_CLEANUP_KEY = 'legacy-export-file-cleanup';
export const LEGACY_EXPORT_PROMPT_KEY = 'legacy-export-file-prompt';

export interface LegacyExportFiles {
    config: string[];
    csv: string[];
}

const totalFiles = (files: LegacyExportFiles) =>
    files.config.length + files.csv.length;

// Same patterns clearAllData purges with. Returns null when the directory
// cannot be listed, so callers retry on a later launch instead of treating
// "unknown" as "nothing there".
export const listLegacyExportFiles =
    async (): Promise<LegacyExportFiles | null> => {
        const files: LegacyExportFiles = { config: [], csv: [] };
        if (Platform.OS !== 'ios') return files;
        try {
            const entries = await RNFS.readDir(RNFS.DocumentDirectoryPath);
            for (const entry of entries) {
                if (!entry.isFile()) continue;
                if (entry.name.endsWith(NODE_CONFIG_EXPORT_EXT)) {
                    files.config.push(entry.path);
                } else if (LEGACY_CSV_EXPORT_REGEX.test(entry.name)) {
                    files.csv.push(entry.path);
                }
            }
            return files;
        } catch (e) {
            console.warn('Error listing legacy export files:', e);
            return null;
        }
    };

const markLegacyExportCleanupDone = async () => {
    await EncryptedStorage.setItem(LEGACY_EXPORT_CLEANUP_KEY, 'true');
    await EncryptedStorage.removeItem(LEGACY_EXPORT_PROMPT_KEY);
};

// Startup migration step. Never deletes anything.
export const checkLegacyExportFiles = async (): Promise<void> => {
    if (await EncryptedStorage.getItem(LEGACY_EXPORT_CLEANUP_KEY)) return;
    if (Platform.OS !== 'ios') {
        // Android Downloads stays user-visible; only clearAllData sweeps it
        await EncryptedStorage.setItem(LEGACY_EXPORT_CLEANUP_KEY, 'true');
        return;
    }
    const files = await listLegacyExportFiles();
    if (!files) return;
    if (totalFiles(files) === 0) {
        await markLegacyExportCleanupDone();
        return;
    }
    await EncryptedStorage.setItem(
        LEGACY_EXPORT_PROMPT_KEY,
        JSON.stringify({ config: files.config.length, csv: files.csv.length })
    );
};

const getPendingLegacyExports = async (): Promise<LegacyExportFiles | null> => {
    if (await EncryptedStorage.getItem(LEGACY_EXPORT_CLEANUP_KEY)) {
        return null;
    }
    if (!(await EncryptedStorage.getItem(LEGACY_EXPORT_PROMPT_KEY))) {
        return null;
    }
    const files = await listLegacyExportFiles();
    if (!files) return null;
    if (totalFiles(files) === 0) {
        await markLegacyExportCleanupDone();
        return null;
    }
    return files;
};

// Deletes exactly the listed files. The flag is set even when an unlink
// fails, so a file the app cannot remove does not prompt on every launch.
export const deleteLegacyExports = async (
    files: LegacyExportFiles
): Promise<void> => {
    for (const path of [...files.config, ...files.csv]) {
        try {
            await RNFS.unlink(path);
        } catch (e) {
            console.warn('Error deleting legacy export file:', e);
        }
    }
    await markLegacyExportCleanupDone();
};

const stagedName = (name: string) =>
    name.replace(/[\u0000-\u001f\u007f#?%*:"<>|/\\]/g, '_');

// Shares copies staged in the app-private share cache (the originals are
// deleted right after, and a receiver may still be reading), then deletes
// the originals. Returns false, keeping the originals and the pending
// prompt, when staging fails or the user closes the sheet without sharing.
export const shareLegacyExports = async (
    files: LegacyExportFiles
): Promise<boolean> => {
    // Loaded lazily, as in shareCsvFiles: this module is in the
    // SettingsStore graph via the startup migration
    const Share = require('react-native-share').default;
    const dir = `${RNFS.CachesDirectoryPath}/${CSV_SHARE_STAGING_DIR}`;
    try {
        await purgeCsvShareStaging();
        await RNFS.mkdir(dir);
        const used = new Set<string>();
        const staged: string[] = [];
        for (const path of [...files.config, ...files.csv]) {
            let name = stagedName(path.split('/').pop() || 'export');
            if (used.has(name)) name = `${used.size}_${name}`;
            used.add(name);
            const dest = `${dir}/${name}`;
            await RNFS.copyFile(path, dest);
            staged.push(dest);
        }
        // failOnCancel: a closed sheet must not count as a share
        await Share.open({
            urls: staged.map((path) => `file://${path}`),
            failOnCancel: true
        });
    } catch (e) {
        // nothing was handed off, so the staged copies can go now
        await purgeCsvShareStaging();
        console.warn('Legacy export files not shared:', e);
        return false;
    }
    await deleteLegacyExports(files);
    return true;
};

// One prompt per launch; Not now (or a cancelled share) asks again on the
// next launch, so no file is lost without an explicit choice.
let promptedThisSession = false;

export const resetLegacyExportPromptSession = () => {
    promptedThisSession = false;
};

export const promptLegacyExportCleanup = async (): Promise<void> => {
    if (Platform.OS !== 'ios' || promptedThisSession) return;
    promptedThisSession = true;

    let files: LegacyExportFiles | null;
    try {
        files = await getPendingLegacyExports();
    } catch (e) {
        console.warn('Error checking legacy export files:', e);
        return;
    }
    if (!files) return;

    const pending = files;
    let message = localeString('views.Wallet.legacyExports.message', {
        total: totalFiles(pending),
        configs: pending.config.length,
        csvs: pending.csv.length
    });
    if (pending.config.length > 0) {
        message += `\n\n${localeString(
            'views.Wallet.legacyExports.configWarning'
        )}`;
    }

    Alert.alert(
        localeString('views.Wallet.legacyExports.title'),
        message,
        [
            {
                text: localeString('views.Wallet.legacyExports.notNow'),
                style: 'cancel'
            },
            {
                text: localeString('general.delete'),
                style: 'destructive',
                onPress: () => deleteLegacyExports(pending)
            },
            {
                text: localeString('general.share'),
                onPress: async () => {
                    await shareLegacyExports(pending);
                }
            }
        ],
        { cancelable: false }
    );
};
