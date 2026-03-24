import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNRestart from 'react-native-restart';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as CryptoJS from 'crypto-js';

import { localeString } from './LocaleUtils';
import { stopLnd } from './LndMobileUtils';
import BackendUtils from './BackendUtils';
import { signMessageNodePubkey } from '../lndmobile/wallet';
import Base64Utils from './Base64Utils';
import { sleep } from './SleepUtils';

import { BACKUPS_HOST } from '../stores/ChannelBackupStore';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

const VALID_CHANNEL_DB_EXTENSIONS = ['.zeusbackup'];

interface ChannelBackupBundle {
    version: number;
    files: Record<string, string>;
}

/**
 * On Android, DocumentPicker returns content:// URIs which RNFS cannot
 * read directly. Copy the file to a temp path and return that path instead.
 */
const resolveToLocalPath = async (uri: string): Promise<string> => {
    if (Platform.OS !== 'android' || !uri.startsWith('content://')) {
        return uri;
    }
    const tempPath = `${RNFS.CachesDirectoryPath}/zeus-import-temp.zeusbackup`;
    await RNFS.copyFile(uri, tempPath);
    return tempPath;
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
 * Uploads the graph data bundle to Olympus
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

        const network = isTestnet ? 'testnet' : 'mainnet';
        const rootPath = Platform.select({
            android: RNFS.DocumentDirectoryPath,
            ios: `${RNFS.LibraryDirectoryPath}/Application Support`
        });
        const graphDir = `${rootPath}/${lndDir}/data/graph/${network}`;

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
        if (!statusAuth.success || !statusAuth.verification)
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
                if (!uploadAuth.success || !uploadAuth.verification)
                    throw new Error('Invalid auth response');

                console.log('Signing upload challenge...');
                const uploadSignData = await BackendUtils.signMessage(
                    uploadAuth.verification
                );
                const uploadSignature =
                    uploadSignData.zbase || uploadSignData.signature;

                try {
                    if (setStatus)
                        setStatus(
                            localeString(
                                'views.Tools.migration.export.stoppingLnd'
                            )
                        );
                    console.log('Stopping LND for backup...');
                    await stopLnd();
                    await sleep(5000);
                } catch (e: any) {
                    if (e?.message?.includes?.('closed')) {
                        console.log('LND stopped successfully.');
                    } else {
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
                }

                if (setStatus)
                    setStatus(
                        localeString(
                            'views.Tools.migration.export.buildingBundle'
                        )
                    );
                const bundle: ChannelBackupBundle = {
                    version: 2,
                    files: {}
                };
                const items = await RNFS.readDir(graphDir);
                for (const item of items) {
                    if (!item.isFile()) continue;
                    const name = item.path.substring(
                        item.path.lastIndexOf('/') + 1
                    );
                    bundle.files[name] = await ReactNativeBlobUtil.fs.readFile(
                        item.path,
                        'base64'
                    );
                }

                // Encrypt the JSON bundle using seed
                if (setStatus)
                    setStatus(
                        localeString('views.Tools.migration.export.encrypting')
                    );
                console.log('Encrypting backup...');
                const bundleJson = JSON.stringify(bundle);
                const encryptedBackup = CryptoJS.AES.encrypt(
                    bundleJson,
                    seedArray
                ).toString();

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
                        backup: encryptedBackup
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
                    await Storage.setItem(
                        CHANNEL_MIGRATION_ACTIVE,
                        JSON.stringify({ migrationStatus: true, lndDir })
                    );

                    Alert.alert(
                        localeString('views.Tools.migration.export.success'),
                        localeString(
                            'views.Tools.migration.export.success.text'
                        ),
                        [
                            {
                                text: localeString('views.Wallet.restart'),
                                onPress: () => RNRestart.Restart()
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
                                onPress: () => RNRestart.Restart()
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
                            onPress: () => RNRestart.Restart()
                        }
                    ],
                    { cancelable: false }
                );
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
 * Downloads and restores the graph data bundle from Olympus
 */
export const restoreChannelBackupFromOlympus = async (
    lndDir: string,
    isTestnet: boolean,
    pubkey: string,
    seedArray: string
) => {
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
        if (!statusAuth.success || !statusAuth.verification)
            throw new Error('Invalid auth response');

        console.log('Signing status challenge...');
        const statusSignData = await signMessageNodePubkey(
            Base64Utils.stringToUint8Array(statusAuth.verification)
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
            return;
        }

        const userConfirmed = await new Promise<boolean>((resolve) => {
            const dateStr = new Date(last_backup_at).toLocaleString();
            Alert.alert(
                localeString('views.Tools.migration.import.backupFound'),
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
            return;
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
        if (!restoreAuth.success || !restoreAuth.verification)
            throw new Error('Invalid auth response');

        console.log('Signing restore challenge...');
        const restoreSignData = await signMessageNodePubkey(
            Base64Utils.stringToUint8Array(restoreAuth.verification)
        );
        const restoreSignature = restoreSignData.signature;

        // 3. Download the encrypted backup
        console.log('Downloading encrypted backup...');
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

        if (restoreResponse.info().status !== 200) {
            let errorMsg = 'Download failed';
            try {
                const errorJson = restoreResponse.json();
                if (errorJson.error) errorMsg = errorJson.error;
            } catch (e) {}
            throw new Error(errorMsg);
        }

        // 4. Decrypt the payload
        console.log('Decrypting backup...');
        const encryptedBackupString = await restoreResponse.text();

        try {
            const jsonCheck = JSON.parse(encryptedBackupString);
            if (jsonCheck && jsonCheck.success === false) {
                throw new Error(`Backend Error: ${jsonCheck.error}`);
            }
        } catch (e: any) {
            if (e?.message?.includes('Backend Error')) throw e;
        }

        const decryptedBytes = CryptoJS.AES.decrypt(
            encryptedBackupString,
            seedArray
        );
        const bundleJson = decryptedBytes.toString(CryptoJS.enc.Utf8);

        if (!bundleJson) {
            throw new Error(
                'Decryption failed. Incorrect seed or corrupted file.'
            );
        }

        const bundle: ChannelBackupBundle = JSON.parse(bundleJson);

        if (!bundle.files) {
            throw new Error('Invalid backup bundle format');
        }

        // 5. Stop LND before overwriting the active database
        const MAX_RECOVERY_WAIT_ATTEMPTS = 60; // ~5 minutes
        for (let attempt = 1; ; attempt++) {
            try {
                console.log('Stopping LND for restore...');
                await stopLnd();
                await sleep(5000);
                break;
            } catch (e: any) {
                if (e?.message?.includes?.('closed')) {
                    console.log('LND stopped successfully.');
                    break;
                }
                if (e?.message?.includes?.('wallet recovery in progress')) {
                    if (attempt >= MAX_RECOVERY_WAIT_ATTEMPTS) {
                        console.error(
                            `Wallet recovery still in progress after ${attempt} attempts`
                        );
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
                console.error('Failed to stop LND:', e.message);
                throw new Error(
                    localeString('views.Tools.migration.export.failedToStopLnd')
                );
            }
        }

        // 6. Build the destination path
        const network = isTestnet ? 'testnet' : 'mainnet';
        const rootPath = Platform.select({
            android: RNFS.DocumentDirectoryPath,
            ios: `${RNFS.LibraryDirectoryPath}/Application Support`
        });
        const destFolder = `${rootPath}/${lndDir}/data/graph/${network}`;

        // 7. Clean existing files and restore from bundle
        if (!(await RNFS.exists(destFolder))) {
            await RNFS.mkdir(destFolder);
        }

        try {
            const existing = await RNFS.readDir(destFolder);
            for (const item of existing) {
                if (item.isFile()) {
                    await RNFS.unlink(item.path);
                }
            }
        } catch (e) {}

        for (const [name, base64Data] of Object.entries(bundle.files)) {
            const destPath = `${destFolder}/${name}`;
            await ReactNativeBlobUtil.fs.writeFile(
                destPath,
                base64Data,
                'base64'
            );
        }
    } catch (error: any) {
        console.error('Restore Flow Failed', error);
        throw error;
    }
};

/**
 * Exports the graph data bundle to a local .zeusbackup file
 * On Android, saves directly to Downloads; on iOS, opens share sheet
 */
export const exportChannelDb = async (
    lndDir: string,
    isTestnet: boolean,
    setStatus?: (message: string | null) => void
) => {
    try {
        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.stoppingLnd'));

        const network = isTestnet ? 'testnet' : 'mainnet';
        const rootPath = Platform.select({
            android: RNFS.DocumentDirectoryPath,
            ios: `${RNFS.LibraryDirectoryPath}/Application Support`
        });
        const graphDir = `${rootPath}/${lndDir}/data/graph/${network}`;

        if (!(await RNFS.exists(graphDir))) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.databaseNotFound')
            );
            if (setStatus) setStatus(null);
            return;
        }

        try {
            console.log('Stopping LND for export...');
            await stopLnd();
            await sleep(5000);
        } catch (e: any) {
            if (e?.message?.includes?.('closed')) {
                console.log('LND stopped successfully.');
            } else {
                console.error('Failed to stop LND:', e.message);
                if (setStatus) setStatus(null);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.Tools.migration.export.failedToStopLnd')
                );
                return;
            }
        }

        const backupFileName = `zeus-lnd-${network}-${Date.now()}.zeusbackup`;

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
                localeString('views.Tools.migration.export.buildingBundle')
            );
        const bundle: ChannelBackupBundle = { version: 2, files: {} };
        const items = await RNFS.readDir(graphDir);
        for (const item of items) {
            if (!item.isFile()) continue;
            const name = item.path.substring(item.path.lastIndexOf('/') + 1);
            bundle.files[name] = await ReactNativeBlobUtil.fs.readFile(
                item.path,
                'base64'
            );
        }

        await RNFS.writeFile(stagingPath, JSON.stringify(bundle), 'utf8');

        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.savingFile'));

        const finishExport = async () => {
            if (setStatus) setStatus(null);
            await Storage.setItem(
                CHANNEL_MIGRATION_ACTIVE,
                JSON.stringify({ migrationStatus: true, lndDir })
            );
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
                        onPress: () => RNRestart.Restart()
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
                            onPress: () => RNRestart.Restart()
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
                            onPress: () => RNRestart.Restart()
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
                    onPress: () => RNRestart.Restart()
                }
            ],
            { cancelable: false }
        );
    }
};

/**
 * Exports channel.db directly as a raw binary file for bolt DB wallets.
 */
export const exportChannelDbBolt = async (
    lndDir: string,
    isTestnet: boolean,
    setStatus?: (message: string | null) => void
) => {
    try {
        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.stoppingLnd'));

        const network = isTestnet ? 'testnet' : 'mainnet';
        const rootPath = Platform.select({
            android: RNFS.DocumentDirectoryPath,
            ios: `${RNFS.LibraryDirectoryPath}/Application Support`
        });
        const channelDbPath = `${rootPath}/${lndDir}/data/graph/${network}/channel.db`;

        if (!(await RNFS.exists(channelDbPath))) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.databaseNotFound')
            );
            if (setStatus) setStatus(null);
            return;
        }

        try {
            console.log('Stopping LND for export...');
            await stopLnd();
            await sleep(5000);
        } catch (e: any) {
            if (e?.message?.includes?.('closed')) {
                console.log('LND stopped successfully.');
            } else {
                console.error('Failed to stop LND:', e.message);
                if (setStatus) setStatus(null);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.Tools.migration.export.failedToStopLnd')
                );
                return;
            }
        }

        const backupFileName = `zeus-lnd-bolt-${network}-${Date.now()}.zeusbackup`;

        if (setStatus)
            setStatus(localeString('views.Tools.migration.export.savingFile'));

        const finishExport = async () => {
            if (setStatus) setStatus(null);
            await Storage.setItem(
                CHANNEL_MIGRATION_ACTIVE,
                JSON.stringify({ migrationStatus: true, lndDir })
            );
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
                        onPress: () => RNRestart.Restart()
                    }
                ],
                { cancelable: false }
            );
        };

        if (Platform.OS === 'android') {
            const downloadPath = `${RNFS.DownloadDirectoryPath}/${backupFileName}`;
            await RNFS.copyFile(channelDbPath, downloadPath);
            await finishExport();
            return;
        }

        const stagingPath = `${RNFS.DocumentDirectoryPath}/${backupFileName}`;
        await RNFS.copyFile(channelDbPath, stagingPath);

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
                            onPress: () => RNRestart.Restart()
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
                            onPress: () => RNRestart.Restart()
                        }
                    ],
                    { cancelable: false }
                );
                return;
            }

            throw err;
        }
    } catch (error) {
        console.error('Bolt DB Export Failed:', error);
        if (setStatus) setStatus(null);
        Alert.alert(
            localeString('general.error'),
            undefined,
            [
                {
                    text: localeString('views.Wallet.restart'),
                    onPress: () => RNRestart.Restart()
                }
            ],
            { cancelable: false }
        );
    }
};

/**
 * Imports a raw bolt DB channel.db from a backup file.
 */
export const importChannelDbBolt = async (
    sourceUri: string,
    lndDir: string,
    isTestnet: boolean
) => {
    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });

    const destFolder = `${rootPath}/${lndDir}/data/graph/${
        isTestnet ? 'testnet' : 'mainnet'
    }`;

    if (!(await RNFS.exists(destFolder))) {
        await RNFS.mkdir(destFolder);
    }

    const localPath = await resolveToLocalPath(sourceUri);
    const destPath = `${destFolder}/channel.db`;

    // Remove existing channel.db if present
    if (await RNFS.exists(destPath)) {
        await RNFS.unlink(destPath);
    }

    await RNFS.copyFile(localPath, destPath);
};

/**
 * Imports a .zeusbackup file. Checks whether it's a JSON bundle
 * (SQLite) or a raw channel.db (bolt DB) and handles accordingly.
 */
export const importChannelDb = async (
    sourceUri: string,
    fileName: string,
    lndDir: string,
    isTestnet: boolean
) => {
    const validation = await validateChannelBackupFile(sourceUri, fileName);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const localPath = await resolveToLocalPath(sourceUri);

    // Detect format by reading just the first byte.
    // JSON bundles (SQLite) start with '{', raw bolt DB files don't.
    const firstByte = await RNFS.read(localPath, 1, 0, 'utf8');
    const isJsonBundle = firstByte === '{';

    if (!isJsonBundle) {
        await importChannelDbBolt(localPath, lndDir, isTestnet);
        return;
    }

    const content = await RNFS.readFile(localPath, 'utf8');
    const bundle: ChannelBackupBundle = JSON.parse(content);

    if (!bundle.files) {
        throw new Error('Invalid backup bundle format');
    }

    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });

    const destFolder = `${rootPath}/${lndDir}/data/graph/${
        isTestnet ? 'testnet' : 'mainnet'
    }`;

    if (!(await RNFS.exists(destFolder))) {
        await RNFS.mkdir(destFolder);
    }

    try {
        const existing = await RNFS.readDir(destFolder);
        for (const item of existing) {
            if (item.isFile()) {
                await RNFS.unlink(item.path);
            }
        }
    } catch (e) {}

    for (const [name, base64Data] of Object.entries(bundle.files)) {
        const destPath = `${destFolder}/${name}`;
        await ReactNativeBlobUtil.fs.writeFile(destPath, base64Data, 'base64');
    }
};
