import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { localeString } from './LocaleUtils';
import { restartApp, stopNodeAndRestart } from './RestartUtils';
import { stopLnd } from './LndMobileUtils';
import BackendUtils from './BackendUtils';
import { isValidAuthChallenge } from './AuthChallengeUtils';
import { signMessageNodePubkey } from '../lndmobile/wallet';
import Base64Utils from './Base64Utils';
import { isReservedSigningMessage } from './LnurlAuthUtils';
import { sleep } from './SleepUtils';
import { zipFolder, unzipFile, encryptFile, decryptFile } from './ZipUtils';

import { BACKUPS_HOST } from '../stores/ChannelBackupStore';
import { settingsStore } from '../stores/Stores';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

/**
 * The lndDirs of all wallets that are locked after a channel export. Records
 * written by versions that could lock only one wallet hold a single lndDir.
 */
const getMigrationLockedDirs = async (): Promise<string[]> => {
    const stored = await Storage.getItem(CHANNEL_MIGRATION_ACTIVE);
    if (!stored) return [];
    try {
        const migrationData = JSON.parse(stored);
        if (!migrationData?.migrationStatus) return [];
        if (Array.isArray(migrationData.lndDirs)) return migrationData.lndDirs;
        return migrationData.lndDir ? [migrationData.lndDir] : [];
    } catch (e) {
        console.error('Failed to parse migration data:', e);
        return [];
    }
};

// lndDir repeats the last entry of lndDirs so that older app versions, which
// only read lndDir, still lock the most recently exported wallet
const setMigrationLockedDirs = async (lndDirs: string[]): Promise<void> => {
    if (lndDirs.length === 0) {
        await Storage.removeItem(CHANNEL_MIGRATION_ACTIVE);
        return;
    }
    await Storage.setItem(
        CHANNEL_MIGRATION_ACTIVE,
        JSON.stringify({
            migrationStatus: true,
            lndDir: lndDirs[lndDirs.length - 1],
            lndDirs
        })
    );
};

const lockWalletForMigration = async (lndDir: string): Promise<void> => {
    const otherDirs = (await getMigrationLockedDirs()).filter(
        (dir) => dir !== lndDir
    );
    await setMigrationLockedDirs([...otherDirs, lndDir]);
};

export const unlockWalletFromMigration = async (
    lndDir: string
): Promise<void> => {
    const otherDirs = (await getMigrationLockedDirs()).filter(
        (dir) => dir !== lndDir
    );
    await setMigrationLockedDirs(otherDirs);
};

const VALID_CHANNEL_DB_EXTENSIONS = ['.zip'];

const getGraphDir = (lndDir: string, isTestnet: boolean): string => {
    const network = isTestnet ? 'testnet' : 'mainnet';
    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });
    return `${rootPath}/${lndDir}/data/graph/${network}`;
};

/**
 * Checks whether graph data exists on disk, so export can be offered
 * even when the node isn't running. Note this can't distinguish
 * whether the node ever had channels: lnd creates the graph DB files
 * on first start.
 */
export const graphDataExists = async (
    lndDir: string,
    isTestnet: boolean
): Promise<boolean> => {
    try {
        const graphDir = getGraphDir(lndDir, isTestnet);
        if (!(await RNFS.exists(graphDir))) return false;
        const entries = await RNFS.readDir(graphDir);
        return entries.length > 0;
    } catch (e) {
        console.error('Failed to check for graph data on disk:', e);
        return false;
    }
};

const stopLndSafely = async (): Promise<void> => {
    try {
        await stopLnd();
        await sleep(5000);
    } catch (e: any) {
        if (e?.message?.includes?.('closed')) return;
        throw e;
    }
};

// Best-effort removal of temporary files a flow created in the cache
// dir. Errors are ignored so they never replace the flow's own error.
const removeStagingFiles = async (paths: string[]): Promise<void> => {
    for (const path of paths) {
        try {
            if (await RNFS.exists(path)) await RNFS.unlink(path);
        } catch (e) {}
    }
};

// Copies of the channel database that the import, export and Olympus flows
// stage in app cache. Matched by prefix because the Olympus and export
// names embed a timestamp.
const CHANNEL_DB_STAGING_PREFIXES = [
    'zeus-import-temp',
    'zeus-olympus-backup-',
    'zeus-olympus-restore-',
    'zeus-lnd-'
];

/**
 * Deletes every channel database copy staged in app cache, including a
 * backup that was picked but never imported. Never throws.
 */
export const purgeChannelDbStagingFiles = async (): Promise<void> => {
    let entries: RNFS.ReadDirItem[];
    try {
        entries = await RNFS.readDir(RNFS.CachesDirectoryPath);
    } catch (e) {
        console.warn('Failed to list app cache for staged channel data:', e);
        return;
    }

    for (const entry of entries) {
        if (
            !CHANNEL_DB_STAGING_PREFIXES.some((prefix) =>
                entry.name.startsWith(prefix)
            )
        ) {
            continue;
        }
        try {
            await RNFS.unlink(entry.path);
        } catch (e) {
            console.warn('Failed to delete staged channel data:', e);
        }
    }
};

const resolveToLocalPath = async (uri: string): Promise<string> => {
    const ext = uri.toLowerCase().endsWith('.db') ? '.db' : '.zip';
    const tempPath = `${RNFS.CachesDirectoryPath}/zeus-import-temp${ext}`;

    if (Platform.OS === 'android' && uri.startsWith('content://')) {
        await RNFS.copyFile(uri, tempPath);
        return tempPath;
    }

    if (Platform.OS === 'ios') {
        let filePath = uri;
        if (filePath.startsWith('file://')) {
            filePath = decodeURIComponent(filePath.replace('file://', ''));
        }
        if (await RNFS.exists(filePath)) {
            if (await RNFS.exists(tempPath)) {
                await RNFS.unlink(tempPath);
            }
            await RNFS.copyFile(filePath, tempPath);
            return tempPath;
        }

        if (await RNFS.exists(tempPath)) {
            return tempPath;
        }

        return filePath;
    }

    return uri;
};

/**
 * lnd opens only the channel database of its configured backend
 * (channel.db for bolt, channel.sqlite for SQLite) and creates an empty
 * one when that file is missing. Check that the unzipped backup provided
 * it with data in it, so a backup of the other type, one with no database,
 * or an archive the unzip could not read is reported as an error instead
 * of a restore with no channels. The files in the directory are removed
 * before throwing: both callers empty it before they unzip, so these are
 * the files the unzip wrote.
 */
const assertChannelDbRestored = async (
    graphDir: string,
    isSqlite: boolean
): Promise<void> => {
    const file = isSqlite ? 'channel.sqlite' : 'channel.db';
    const otherFile = isSqlite ? 'channel.db' : 'channel.sqlite';
    const entries = await RNFS.readDir(graphDir);
    const hasData = (name: string): boolean =>
        entries.some(
            (item) =>
                item.isFile() && item.name === name && Number(item.size) > 0
        );
    if (hasData(file)) return;

    for (const item of entries) {
        if (item.isFile()) await RNFS.unlink(item.path).catch(() => {});
    }
    if (hasData(otherFile)) {
        throw new Error(
            localeString('views.Tools.migration.import.databaseMismatch', {
                backupType: isSqlite ? 'Bolt' : 'SQLite',
                selectedType: isSqlite ? 'SQLite' : 'Bolt'
            })
        );
    }
    throw new Error(
        localeString('views.Tools.migration.import.databaseMissing', { file })
    );
};

/**
 * Validates a channel backup file before import
 * Checks extension, file existence, and non-empty size
 */
export const validateChannelBackupFile = async (
    fileUri: string,
    fileName: string
): Promise<{ valid: boolean; error?: string }> => {
    const lowerFileName = fileName.toLowerCase();
    const hasValidExtension = VALID_CHANNEL_DB_EXTENSIONS.some((ext) =>
        lowerFileName.endsWith(ext)
    );

    if (!hasValidExtension) {
        return {
            valid: false,
            error: localeString('views.Tools.migration.import.invalidExtension')
        };
    }

    try {
        const localPath = await resolveToLocalPath(fileUri);
        const stat = await RNFS.stat(localPath);
        if (!stat.size || stat.size === 0) {
            return {
                valid: false,
                error: localeString('views.Tools.migration.import.emptyFile')
            };
        }
    } catch (e) {
        return {
            valid: false,
            error: localeString('views.Tools.migration.import.fileNotFound')
        };
    }

    return { valid: true };
};

/**
 * Uploads the graph data to Olympus
 */
export const uploadChannelBackupToOlympus = async (
    lndDir: string,
    isTestnet: boolean,
    pubkey: string,
    seedArray: string,
    setStatus?: (message: string | null) => void
) => {
    try {
        if (setStatus)
            setStatus(
                localeString('views.Tools.migration.export.authenticating')
            );

        const graphDir = getGraphDir(lndDir, isTestnet);

        if (!(await RNFS.exists(graphDir))) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.export.dbNotFound')
            );
            if (setStatus) setStatus(null);
            return;
        }

        // 1. Authentication for status to check for existing backup
        console.log('Authenticating for status check...');
        const statusAuthResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({ pubkey })
        );

        if (statusAuthResponse.info().status !== 200) {
            throw new Error('Authentication failed');
        }

        const statusAuth = statusAuthResponse.json();
        if (
            !statusAuth.success ||
            !isValidAuthChallenge(statusAuth.verification)
        )
            throw new Error('Invalid auth response');

        console.log('Signing status challenge...');
        const statusSignData = await BackendUtils.signMessage(
            statusAuth.verification
        );
        const statusSignature =
            statusSignData.zbase || statusSignData.signature;

        if (setStatus)
            setStatus(
                localeString('views.Tools.migration.export.checkingStatus')
            );
        console.log('Checking backup status...');
        const statusResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/status`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey,
                signature: statusSignature,
                message: statusAuth.verification
            })
        );

        if (statusResponse.info().status !== 200) {
            throw new Error('Status check failed');
        }

        const statusJson = statusResponse.json();
        if (!statusJson.success)
            throw new Error(statusJson.error || 'Status check failed');

        const last_backup_at = statusJson.last_backup_at;

        const proceedToUpload = async () => {
            const stagingPaths: string[] = [];
            try {
                if (setStatus)
                    setStatus(
                        localeString(
                            'views.Tools.migration.export.authenticating'
                        )
                    );
                console.log('Authenticating for uploading backup...');
                const uploadAuthResponse = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${BACKUPS_HOST}/api/auth`,
                    { 'Content-Type': 'application/json' },
                    JSON.stringify({ pubkey })
                );

                if (uploadAuthResponse.info().status !== 200) {
                    throw new Error('Authentication failed');
                }

                const uploadAuth = uploadAuthResponse.json();
                if (
                    !uploadAuth.success ||
                    !isValidAuthChallenge(uploadAuth.verification)
                )
                    throw new Error('Invalid auth response');

                console.log('Signing upload challenge...');
                const uploadSignData = await BackendUtils.signMessage(
                    uploadAuth.verification
                );
                const uploadSignature =
                    uploadSignData.zbase || uploadSignData.signature;

                if (setStatus)
                    setStatus(
                        localeString('views.Tools.migration.export.stoppingLnd')
                    );
                try {
                    await stopLndSafely();
                } catch (e: any) {
                    console.error('Failed to stop LND:', e.message);
                    if (setStatus) setStatus(null);
                    Alert.alert(
                        localeString('general.error'),
                        localeString(
                            'views.Tools.migration.export.failedToStopLnd'
                        )
                    );
                    return;
                }

                if (setStatus)
                    setStatus(
                        localeString(
                            'views.Tools.migration.export.zippingBackup'
                        )
                    );
                const timestamp = Date.now();
                const tempZipPath = `${RNFS.CachesDirectoryPath}/zeus-olympus-backup-${timestamp}.zip`;
                const tempEncPath = `${RNFS.CachesDirectoryPath}/zeus-olympus-backup-${timestamp}.enc`;
                stagingPaths.push(tempZipPath, tempEncPath);
                await zipFolder(graphDir, tempZipPath);

                if (setStatus)
                    setStatus(
                        localeString('views.Tools.migration.export.encrypting')
                    );
                await encryptFile(tempZipPath, tempEncPath, seedArray);
                await RNFS.unlink(tempZipPath);

                const encryptedBase64 = await ReactNativeBlobUtil.fs.readFile(
                    tempEncPath,
                    'base64'
                );
                await RNFS.unlink(tempEncPath);

                // upload to the server
                if (setStatus)
                    setStatus(
                        localeString('views.Tools.migration.export.uploading')
                    );
                console.log('Uploading encrypted backup...');
                const backupResponse = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${BACKUPS_HOST}/api/channels-backup`,
                    { 'Content-Type': 'application/json' },
                    JSON.stringify({
                        pubkey,
                        message: uploadAuth.verification,
                        signature: uploadSignature,
                        backup: encryptedBase64
                    })
                );

                const status = backupResponse.info().status;
                if (status === 413) {
                    throw new Error('Backup too large for server');
                }

                let json;
                try {
                    json = backupResponse.json();
                } catch (e) {
                    throw new Error(
                        `Server returned non-JSON response (HTTP ${status})`
                    );
                }
                console.log('Upload response:', json);

                if (setStatus) setStatus(null);

                if (status === 200 && json.success) {
                    await lockWalletForMigration(lndDir);

                    Alert.alert(
                        localeString('views.Tools.migration.export.success'),
                        localeString(
                            'views.Tools.migration.export.success.text'
                        ),
                        [
                            {
                                text: localeString('views.Wallet.restart'),
                                onPress: () => restartApp()
                            }
                        ],
                        { cancelable: false }
                    );
                } else {
                    Alert.alert(
                        localeString('general.error'),
                        json.error ||
                            localeString(
                                'views.Tools.migration.export.failedToUpload'
                            ),
                        [
                            {
                                text: localeString('views.Wallet.restart'),
                                onPress: () => restartApp()
                            }
                        ],
                        { cancelable: false }
                    );
                }
            } catch (e) {
                console.error('Upload failed:', e);
                if (setStatus) setStatus(null);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.Tools.migration.export.failedToUpload'),
                    [
                        {
                            text: localeString('views.Wallet.restart'),
                            onPress: () => stopNodeAndRestart()
                        }
                    ],
                    { cancelable: false }
                );
            } finally {
                await removeStagingFiles(stagingPaths);
            }
        };

        if (last_backup_at) {
            const dateStr = new Date(last_backup_at).toLocaleString();

            Alert.alert(
                localeString(
                    'views.Tools.migration.export.existingBackupFound'
                ),
                localeString('views.Tools.migration.export.replaceBackup', {
                    date: dateStr
                }),
                [
                    {
                        text: localeString('general.cancel'),
                        style: 'cancel',
                        onPress: () => {
                            if (setStatus) setStatus(null);
                        }
                    },
                    {
                        text: localeString(
                            'views.Tools.migration.export.replace'
                        ),
                        style: 'destructive',
                        onPress: proceedToUpload
                    }
                ]
            );
        } else {
            await proceedToUpload();
        }
    } catch (error) {
        console.error(error);
        if (setStatus) setStatus(null);
        Alert.alert(
            localeString('general.error'),
            localeString('views.Tools.migration.export.failedToUpload')
        );
    }
};

/**
 * Signs an Olympus auth challenge with the node key. The restore flow calls
 * lndmobile directly, so it does not go through the reserved-phrase check in
 * BackendUtils.signMessage and has to apply it here.
 */
const signOlympusChallenge = async (challenge: string) => {
    if (isReservedSigningMessage(challenge)) {
        throw new Error(
            'Refusing to sign the LNURL-auth key derivation phrase'
        );
    }
    return await signMessageNodePubkey(Base64Utils.utf8ToBytes(challenge));
};

/**
 * Downloads and restores the graph data from Olympus
 */
export const restoreChannelBackupFromOlympus = async (
    lndDir: string,
    isTestnet: boolean,
    pubkey: string,
    seedArray: string,
    isSqlite: boolean
): Promise<boolean> => {
    const stagingPaths: string[] = [];
    try {
        // 1. Authentication for status to check for existing backup
        console.log('Authenticating for status check...');
        const statusAuthResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({ pubkey })
        );

        if (statusAuthResponse.info().status !== 200) {
            throw new Error('Authentication failed');
        }

        const statusAuth = statusAuthResponse.json();
        if (
            !statusAuth.success ||
            !isValidAuthChallenge(statusAuth.verification)
        )
            throw new Error('Invalid auth response');

        console.log('Signing status challenge...');
        const statusSignData = await signOlympusChallenge(
            statusAuth.verification
        );
        const statusSignature = statusSignData.signature;

        console.log('Checking backup status...');
        const statusResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/status`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey,
                signature: statusSignature,
                message: statusAuth.verification
            })
        );

        if (statusResponse.info().status !== 200) {
            throw new Error('Status check failed');
        }

        const statusJson = statusResponse.json();
        if (!statusJson.success)
            throw new Error(statusJson.error || 'Status check failed');

        const last_backup_at = statusJson.last_backup_at;

        if (!last_backup_at) {
            await new Promise<void>((resolve) => {
                Alert.alert(
                    localeString('general.error'),
                    localeString(
                        'views.Tools.migration.import.noBackupFoundOlympus'
                    ),
                    [
                        {
                            text: localeString(
                                'views.Tools.migration.import.noBackup'
                            ),
                            onPress: () => resolve()
                        }
                    ],
                    { cancelable: false }
                );
            });
            return false;
        }

        const userConfirmed = await new Promise<boolean>((resolve) => {
            const dateStr = new Date(last_backup_at).toLocaleString();
            Alert.alert(
                localeString('views.Tools.migration.export.backupFound'),
                localeString(
                    'views.Tools.migration.import.backupFoundMessage',
                    { date: dateStr }
                ),
                [
                    {
                        text: localeString('general.cancel'),
                        style: 'cancel',
                        onPress: () => resolve(false)
                    },
                    {
                        text: localeString(
                            'views.Settings.EmbeddedNode.restoreChannelBackups.restore'
                        ),
                        onPress: () => resolve(true)
                    }
                ],
                { cancelable: false }
            );
        });

        if (!userConfirmed) {
            return false;
        }

        // 2. Authenticatication for restoring backup
        console.log('Authenticating for restore...');
        const restoreAuthResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({ pubkey })
        );

        if (restoreAuthResponse.info().status !== 200) {
            throw new Error('Authentication failed');
        }

        const restoreAuth = restoreAuthResponse.json();
        if (
            !restoreAuth.success ||
            !isValidAuthChallenge(restoreAuth.verification)
        )
            throw new Error('Invalid auth response');

        console.log('Signing restore challenge...');
        const restoreSignData = await signOlympusChallenge(
            restoreAuth.verification
        );
        const restoreSignature = restoreSignData.signature;

        // 3. Download the encrypted backup
        console.log('Downloading encrypted backup...');
        const timestamp = Date.now();
        const tempEncPath = `${RNFS.CachesDirectoryPath}/zeus-olympus-restore-${timestamp}.enc`;
        const tempZipPath = `${RNFS.CachesDirectoryPath}/zeus-olympus-restore-${timestamp}.zip`;

        const restoreResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/restore-channels`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey,
                message: restoreAuth.verification,
                signature: restoreSignature
            })
        );

        const restoreStatus = restoreResponse.info().status;
        if (restoreStatus !== 200) {
            let errorMsg = 'Download failed';
            try {
                const errorJson = restoreResponse.json();
                if (errorJson.error) errorMsg = errorJson.error;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        // The server stores and returns the backup as a base64 string
        // (it was uploaded as base64 inside a JSON body). Decode it
        // back to raw binary before decrypting.
        const encryptedBase64Response = await restoreResponse.text();
        stagingPaths.push(tempEncPath, tempZipPath);
        await ReactNativeBlobUtil.fs.writeFile(
            tempEncPath,
            encryptedBase64Response,
            'base64'
        );

        // 4. Decrypt the payload
        console.log('Decrypting backup...');
        await decryptFile(tempEncPath, tempZipPath, seedArray);
        await RNFS.unlink(tempEncPath);

        const MAX_RECOVERY_WAIT_ATTEMPTS = 60;
        for (let attempt = 1; ; attempt++) {
            try {
                await stopLnd();
                await sleep(5000);
                break;
            } catch (e: any) {
                if (e?.message?.includes?.('closed')) break;
                if (e?.message?.includes?.('wallet recovery in progress')) {
                    if (attempt >= MAX_RECOVERY_WAIT_ATTEMPTS) {
                        throw new Error(
                            localeString(
                                'views.Tools.migration.export.failedToStopLnd'
                            )
                        );
                    }
                    console.log(
                        `Wallet recovery in progress, waiting 5s (attempt ${attempt}/${MAX_RECOVERY_WAIT_ATTEMPTS})...`
                    );
                    await sleep(5000);
                    continue;
                }
                throw new Error(
                    localeString('views.Tools.migration.export.failedToStopLnd')
                );
            }
        }

        const destFolder = getGraphDir(lndDir, isTestnet);

        if (!(await RNFS.exists(destFolder))) {
            await RNFS.mkdir(destFolder);
        }

        // A file left behind here could pass assertChannelDbRestored in
        // place of the backup's database, so a failed clear fails the restore
        const existing = await RNFS.readDir(destFolder);
        for (const item of existing) {
            if (item.isFile()) await RNFS.unlink(item.path);
        }

        await unzipFile(tempZipPath, destFolder);
        await RNFS.unlink(tempZipPath);
        await assertChannelDbRestored(destFolder, isSqlite);

        return true;
    } catch (error: any) {
        console.error('Restore Flow Failed', error);
        throw error;
    } finally {
        await removeStagingFiles(stagingPaths);
    }
};

/**
 * Exports the graph data as a .zip file
 * On Android, saves directly to Downloads; on iOS, opens share sheet
 */
export const exportChannelDb = async (
    lndDir: string,
    isTestnet: boolean,
    setStatus?: (message: string | null) => void
) => {
    try {
        const graphDir = getGraphDir(lndDir, isTestnet);

        if (!(await RNFS.exists(graphDir))) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.databaseNotFound')
            );
            if (setStatus) setStatus(null);
            return;
        }

        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.stoppingLnd'));
        try {
            await stopLndSafely();
        } catch (e: any) {
            console.error('Failed to stop LND:', e.message);
            if (setStatus) setStatus(null);
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.export.failedToStopLnd')
            );
            return;
        }

        const network = isTestnet ? 'testnet' : 'mainnet';
        const backupFileName = `zeus-lnd-${network}-${Date.now()}.zip`;

        const stagingDir =
            Platform.OS === 'android'
                ? RNFS.CachesDirectoryPath
                : RNFS.DocumentDirectoryPath;
        const stagingPath = `${stagingDir}/${backupFileName}`;

        if (await RNFS.exists(stagingPath)) {
            await RNFS.unlink(stagingPath);
        }

        if (setStatus)
            setStatus(
                localeString('views.Tools.migration.export.zippingBackup')
            );
        await zipFolder(graphDir, stagingPath);

        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.savingFile'));

        const finishExport = async () => {
            if (setStatus) setStatus(null);
            await lockWalletForMigration(lndDir);
            Alert.alert(
                localeString('views.Tools.migration.export.success'),
                localeString(
                    Platform.OS === 'android'
                        ? 'views.Tools.migration.export.success.text.android'
                        : 'views.Tools.migration.export.success.text'
                ),
                [
                    {
                        text: localeString('views.Wallet.restart'),
                        onPress: () => restartApp()
                    }
                ],
                { cancelable: false }
            );
        };

        if (Platform.OS === 'android') {
            const downloadPath = `${RNFS.DownloadDirectoryPath}/${backupFileName}`;
            await RNFS.copyFile(stagingPath, downloadPath);
            await RNFS.unlink(stagingPath);
            await finishExport();
            return;
        }

        // Stopping lnd and zipping take long enough for the user to leave
        // the app and for it to lock in the meantime (or to be suspended
        // and only get here once reopened). The share sheet is presented on
        // top of the Lockscreen, so the archive must not be offered to a
        // locked app.
        if (settingsStore.loginRequired()) {
            // A failed delete must not replace the cancellation notice
            // with the generic export error
            try {
                await RNFS.unlink(stagingPath);
            } catch (e) {
                console.error('Failed to delete the staged export:', e);
            }
            if (setStatus) setStatus(null);
            Alert.alert(
                localeString('views.Tools.migration.export.cancelled'),
                localeString('views.Tools.migration.export.cancelled.text'),
                [
                    {
                        text: localeString('views.Wallet.restart'),
                        onPress: () => RNRestart.Restart(IN_APP_RESTART)
                    }
                ],
                { cancelable: false }
            );
            return;
        }

        try {
            const shareResult = await Share.open({
                title: localeString('views.Tools.migration.export.title'),
                url: `file://${stagingPath}`,
                type: 'application/octet-stream',
                filename: backupFileName,
                failOnCancel: false
            });

            const isDismissed =
                shareResult.dismissedAction || shareResult.success === false;

            if (isDismissed) {
                await RNFS.unlink(stagingPath);
                Alert.alert(
                    localeString('views.Tools.migration.export.cancelled'),
                    localeString('views.Tools.migration.export.cancelled.text'),
                    [
                        {
                            text: localeString('views.Wallet.restart'),
                            onPress: () => restartApp()
                        }
                    ],
                    { cancelable: false }
                );
                return;
            }

            await RNFS.unlink(stagingPath);
            await finishExport();
        } catch (err: any) {
            if (await RNFS.exists(stagingPath)) {
                await RNFS.unlink(stagingPath);
            }

            const errorMsg = err?.message || String(err);
            if (
                errorMsg.includes('User did not share') ||
                errorMsg.includes('cancel')
            ) {
                Alert.alert(
                    localeString('views.Tools.migration.export.cancelled'),
                    localeString('views.Tools.migration.export.cancelled.text'),
                    [
                        {
                            text: localeString('views.Wallet.restart'),
                            onPress: () => restartApp()
                        }
                    ],
                    { cancelable: false }
                );
                return;
            }

            throw err;
        }
    } catch (error) {
        console.error('Export Failed:', error);
        if (setStatus) setStatus(null);
        Alert.alert(
            localeString('general.error'),
            undefined,
            [
                {
                    text: localeString('views.Wallet.restart'),
                    onPress: () => restartApp()
                }
            ],
            { cancelable: false }
        );
    }
};

/**
 * Prompts the user to export channel backup — either to Olympus (SQLite
 * only, requires a running node) or as a local zip file.
 */
export const handleExportChannels = ({
    isSqlite,
    lndDir,
    isTestnet,
    pubkey,
    seedPhrase,
    canUploadToOlympus,
    setStatus
}: {
    isSqlite: boolean;
    lndDir: string;
    isTestnet: boolean;
    pubkey: string;
    seedPhrase: string;
    // Olympus upload signs auth challenges with the node key,
    // so it's only available while the node is running
    canUploadToOlympus: boolean;
    setStatus: (msg: string | null) => void;
}) => {
    const warningText =
        `${localeString('views.Tools.migration.export.text1')}\n\n` +
        `⚠️ ${localeString('views.Tools.migration.export.text2')}`;

    if (isSqlite && canUploadToOlympus) {
        Alert.alert(
            localeString('views.Tools.migration.export.title'),
            warningText,
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('views.Tools.migration.export.olympus'),
                    style: 'default',
                    onPress: async () => {
                        await uploadChannelBackupToOlympus(
                            lndDir,
                            isTestnet,
                            pubkey,
                            seedPhrase,
                            setStatus
                        );
                    }
                },
                {
                    text: localeString('views.Tools.migration.export.local'),
                    style: 'default',
                    onPress: async () => {
                        await exportChannelDb(lndDir, isTestnet, setStatus);
                    }
                }
            ]
        );
    } else {
        Alert.alert(
            localeString('views.Tools.migration.export.title'),
            warningText,
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString('general.ok'),
                    style: 'default',
                    onPress: async () => {
                        await exportChannelDb(lndDir, isTestnet, setStatus);
                    }
                }
            ]
        );
    }
};

/**
 * Imports a channel backup zip file (works for both SQLite and bolt DB).
 * Clears existing files in the graph directory and unzips the backup,
 * which must contain the channel database of the wallet's DB backend.
 */
export const importChannelDb = async (
    sourceUri: string,
    fileName: string,
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean
) => {
    const validation = await validateChannelBackupFile(sourceUri, fileName);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const localPath = await resolveToLocalPath(sourceUri);
    const destFolder = getGraphDir(lndDir, isTestnet);

    if (!(await RNFS.exists(destFolder))) {
        await RNFS.mkdir(destFolder);
    }

    // A file left behind here could pass assertChannelDbRestored in place of
    // the backup's database, so a failed clear fails the import
    const existing = await RNFS.readDir(destFolder);
    for (const item of existing) {
        if (item.isFile()) {
            await RNFS.unlink(item.path);
        }
    }

    try {
        await unzipFile(localPath, destFolder);
    } finally {
        // Remove the copy resolveToLocalPath made, whether or not the unzip
        // worked, but never the file the user picked
        if (
            localPath.startsWith(`${RNFS.CachesDirectoryPath}/zeus-import-temp`)
        ) {
            await RNFS.unlink(localPath).catch(() => {});
        }
    }
    await assertChannelDbRestored(destFolder, isSqlite);
};
