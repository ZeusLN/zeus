import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import EncryptedStorage from 'react-native-encrypted-storage';

import {
    LEGACY_CSV_EXPORT_REGEX,
    createShareStagingDir,
    dedupeFileNames,
    removeShareStagingDir,
    sweepStaleShareStaging
} from './ActivityCsvUtils';
import { NODE_CONFIG_EXPORT_EXT } from './NodeConfigUtils';
import { localeString } from './LocaleUtils';

// Older builds wrote activity CSVs and wallet config backups (connection
// credentials, not always encrypted) to the iOS Documents directory, which
// the Files app showed as the ZEUS folder. File sharing is now disabled, so
// those files are invisible to the user but still swept into iCloud/iTunes
// backups. They are not deleted behind the user's back: the startup
// migration only records that they exist, and after unlock, outside the POS
// till, the user is asked once per launch to share them (then they are
// deleted) or delete them. The cleanup flag is set only after one of those
// two choices.
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

// Shares copies staged in this share's own subdir of the app-private share
// cache (the originals are deleted right after, and a receiver may still be
// reading), then deletes the originals. Returns false, keeping the
// originals and the pending prompt, when staging fails or the user closes
// the sheet without sharing.
export const shareLegacyExports = async (
    files: LegacyExportFiles
): Promise<boolean> => {
    // Loaded lazily, as in shareCsvFiles: this module is in the
    // SettingsStore graph via the startup migration
    const Share = require('react-native-share').default;
    const sources = [...files.config, ...files.csv];
    let dir: string | undefined;
    try {
        await sweepStaleShareStaging();
        dir = await createShareStagingDir();
        const names = dedupeFileNames(
            sources.map((path) => stagedName(path.split('/').pop() || 'export'))
        );
        const staged: string[] = [];
        for (let i = 0; i < sources.length; i++) {
            const dest = `${dir}/${names[i]}`;
            await RNFS.copyFile(sources[i], dest);
            staged.push(dest);
        }
        // failOnCancel: a closed sheet must not count as a share
        await Share.open({
            urls: staged.map((path) => `file://${path}`),
            failOnCancel: true
        });
    } catch (e) {
        // nothing was handed off, so this share's copies can go now
        if (dir) await removeShareStagingDir(dir);
        console.warn('Legacy export files not shared:', e);
        return false;
    }
    await deleteLegacyExports(files);
    return true;
};

// The parts of SettingsStore the prompt checks. Typed here instead of
// imported: this module is in the SettingsStore graph via the startup
// migration.
export interface LegacyExportPromptSession {
    loginRequired: () => unknown;
    posViewActive: () => unknown;
}

// One prompt per launch; Not now (or a cancelled share) asks again on the
// next launch, so no file is lost without an explicit choice.
let promptedThisSession = false;

export const resetLegacyExportPromptSession = () => {
    promptedThisSession = false;
};

// Called by Wallet at the end of its startup path and by the Lockscreen (or
// protectedNavigation, without a login method) when the user leaves the POS
// till for the wallet, which does not rerun that path. Never shown over the
// Lockscreen or the till: a call made there does not use up this launch's
// prompt, so a later exit from POS still shows it.
export const promptLegacyExportCleanup = async (
    session: LegacyExportPromptSession
): Promise<void> => {
    if (Platform.OS !== 'ios' || promptedThisSession) return;
    if (session.loginRequired() || session.posViewActive()) return;
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
    const total = totalFiles(pending);
    const configs = pending.config.length;
    const csvs = pending.csv.length;
    // literal keys, so check-locales can find them
    let message = localeString(
        total === 1
            ? 'views.Wallet.legacyExports.messageSingular'
            : 'views.Wallet.legacyExports.message',
        {
            files: localeString(
                total === 1
                    ? 'views.Wallet.legacyExports.filesSingular'
                    : 'views.Wallet.legacyExports.files',
                { count: total }
            ),
            configs: localeString(
                configs === 1
                    ? 'views.Wallet.legacyExports.configsSingular'
                    : 'views.Wallet.legacyExports.configs',
                { count: configs }
            ),
            csvs: localeString(
                csvs === 1
                    ? 'views.Wallet.legacyExports.csvsSingular'
                    : 'views.Wallet.legacyExports.csvs',
                { count: csvs }
            )
        }
    );
    if (configs > 0) {
        message += `\n\n${localeString(
            'views.Wallet.legacyExports.configWarning'
        )}`;
    }

    // iOS lists three or more actions top to bottom in this order, except
    // that the cancel action always goes last, so this shows Share, Delete,
    // Not now
    Alert.alert(
        localeString('views.Wallet.legacyExports.title'),
        message,
        [
            {
                text: localeString('general.share'),
                onPress: async () => {
                    await shareLegacyExports(pending);
                }
            },
            {
                text: localeString('general.delete'),
                style: 'destructive',
                onPress: () => deleteLegacyExports(pending)
            },
            {
                text: localeString('views.Wallet.legacyExports.notNow'),
                style: 'cancel'
            }
        ],
        { cancelable: false }
    );
};
