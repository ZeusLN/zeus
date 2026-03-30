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
import { zipFolder, unzipFile } from './ZipUtils';

import { BACKUPS_HOST } from '../stores/ChannelBackupStore';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

const VALID_CHANNEL_DB_EXTENSIONS = ['.zip'];

const getGraphDir = (lndDir: string, isTestnet: boolean): string => {
    const network = isTestnet ? 'testnet' : 'mainnet';
    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });
    return `${rootPath}/${lndDir}/data/graph/${network}`;
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
                const tempZipPath = `${
                    RNFS.CachesDirectoryPath
                }/zeus-olympus-backup-${Date.now()}.zip`;
                await zipFolder(graphDir, tempZipPath);
                const zipBase64 = await ReactNativeBlobUtil.fs.readFile(
                    tempZipPath,
                    'base64'
                );
                await RNFS.unlink(tempZipPath);

                if (setStatus)
                    setStatus(
                        localeString('views.Tools.migration.export.encrypting')
                    );
                const encryptedBackup = CryptoJS.AES.encrypt(
                    zipBase64,
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
 * Downloads and restores the graph data from Olympus
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
        const decryptedStr = decryptedBytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedStr) {
            throw new Error(
                'Decryption failed. Incorrect seed or corrupted file.'
            );
        }

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

        try {
            const existing = await RNFS.readDir(destFolder);
            for (const item of existing) {
                if (item.isFile()) await RNFS.unlink(item.path);
            }
        } catch (e) {}

        const tempZipPath = `${
            RNFS.CachesDirectoryPath
        }/zeus-olympus-restore-${Date.now()}.zip`;
        await ReactNativeBlobUtil.fs.writeFile(
            tempZipPath,
            decryptedStr,
            'base64'
        );
        await unzipFile(tempZipPath, destFolder);
        await RNFS.unlink(tempZipPath);
    } catch (error: any) {
        console.error('Restore Flow Failed', error);
        throw error;
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
 * Prompts the user to export channel backup — either to Olympus (SQLite only)
 * or as a local zip file.
 */
export const handleExportChannels = ({
    isSqlite,
    lndDir,
    isTestnet,
    pubkey,
    seedPhrase,
    setStatus
}: {
    isSqlite: boolean;
    lndDir: string;
    isTestnet: boolean;
    pubkey: string;
    seedPhrase: string;
    setStatus: (msg: string | null) => void;
}) => {
    const warningText =
        `${localeString('views.Tools.migration.export.text1')}\n\n` +
        `⚠️ ${localeString('views.Tools.migration.export.text2')}`;

    if (isSqlite) {
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
 * Clears existing files in the graph directory and unzips the backup.
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
    const destFolder = getGraphDir(lndDir, isTestnet);

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

    await unzipFile(localPath, destFolder);
};
