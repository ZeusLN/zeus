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

import Storage from '../storage';

import { sleep } from './SleepUtils';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

const BACKUPS_HOST =
    Platform.OS === 'android'
        ? 'http://10.0.2.2:1337'
        : 'http://localhost:1337';

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
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

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
            if (setLoading) setLoading(false);
            return;
        }

        // Authenticate
        console.log('Authenticating...');
        const authResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({ pubkey })
        );

        if (authResponse.info().status !== 200) {
            throw new Error('Authentication failed');
        }

        const { verification, success, last_backup_at } = authResponse.json();
        if (!success || !verification) throw new Error('Invalid auth response');

        const proceedToUpload = async () => {
            try {
                // sign with our pubkey
                console.log('Signing challenge...');
                const messageSignData = await BackendUtils.signMessage(
                    verification
                );
                const signature =
                    messageSignData.zbase || messageSignData.signature;

                try {
                    console.log('Stopping LND for backup...');
                    await stopLnd();
                    await sleep(5000);
                } catch (e: any) {
                    if (e?.message?.includes?.('closed')) {
                        console.log('LND stopped successfully.');
                    } else {
                        console.error('Failed to stop LND:', e.message);
                        if (setLoading) setLoading(false);
                        Alert.alert(
                            localeString('general.error'),
                            localeString(
                                'views.Tools.migration.export.failedToStopLnd'
                            )
                        );
                        return;
                    }
                }

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
                console.log('Encrypting backup...');
                const bundleJson = JSON.stringify(bundle);
                const encryptedBackup = CryptoJS.AES.encrypt(
                    bundleJson,
                    seedArray
                ).toString();

                // upload to the server
                console.log('Uploading encrypted backup...');
                const backupResponse = await ReactNativeBlobUtil.fetch(
                    'POST',
                    `${BACKUPS_HOST}/api/channels-backup`,
                    { 'Content-Type': 'application/json' },
                    JSON.stringify({
                        pubkey,
                        message: verification,
                        signature,
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

                if (setLoading) setLoading(false);

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
                if (setLoading) setLoading(false);
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
                            if (setLoading) setLoading(false);
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
        if (setLoading) setLoading(false);
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
        // 1. Authenticate
        const authResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/auth`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({ pubkey })
        );

        if (authResponse.info().status !== 200) {
            throw new Error('Authentication failed');
        }

        const { verification, success, last_backup_at } = authResponse.json();
        if (!success || !verification) throw new Error('Invalid auth response');

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

        // 2. Sign the challenge
        console.log('Signing challenge...');
        const messageSignData = await signMessageNodePubkey(
            Base64Utils.stringToUint8Array(verification)
        );
        const signature = messageSignData.signature;

        // 3. Download the encrypted backup
        console.log('Downloading encrypted backup...');
        const restoreResponse = await ReactNativeBlobUtil.fetch(
            'POST',
            `${BACKUPS_HOST}/api/restore-channels`,
            { 'Content-Type': 'application/json' },
            JSON.stringify({
                pubkey,
                message: verification,
                signature
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
        try {
            console.log('Stopping LND for restore...');
            await stopLnd();
            await sleep(5000);
        } catch (e: any) {
            if (e?.message?.includes?.('closed')) {
                console.log('LND stopped successfully.');
            } else {
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
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

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
            if (setLoading) setLoading(false);
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
                if (setLoading) setLoading(false);
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

        if (setLoading) setLoading(false);

        const finishExport = async () => {
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
        if (setLoading) setLoading(false);
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
 * Imports a graph data bundle from a local .zeusbackup file
 * Validates the file, cleans the destination directory, and writes all files
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
    const content = await RNFS.readFile(localPath, 'utf8');
    const bundle: ChannelBackupBundle = JSON.parse(content);

    if (!bundle.files) {
        throw new Error('Invalid backup bundle format');
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
