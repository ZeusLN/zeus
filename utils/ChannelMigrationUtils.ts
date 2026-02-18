import { Alert, Platform, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNRestart from 'react-native-restart';
import ReactNativeBlobUtil from 'react-native-blob-util';
import * as CryptoJS from 'crypto-js';

import { localeString } from './LocaleUtils';
import { sleep } from '../utils/SleepUtils';
import BackendUtils from './BackendUtils';
import { signMessageNodePubkey } from '../lndmobile/wallet';
import Base64Utils from './Base64Utils';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

const BACKUPS_HOST = 'http://localhost:1337';

const VALID_CHANNEL_DB_EXTENSIONS = ['.sqlite', '.db'];

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
        const stat = await RNFS.stat(fileUri);
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
 * Helper to find the path of the channel DB
 */
export const getChannelDbPathInfo = async (
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean
) => {
    const network = isTestnet ? 'testnet' : 'mainnet';
    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });
    const basePath = `${rootPath}/${lndDir}/data/graph/${network}`;
    const fileName = isSqlite ? 'channel.sqlite' : 'channel.db';
    const fullPath = `${basePath}/${fileName}`;

    if (await RNFS.exists(fullPath)) {
        return { path: fullPath, type: isSqlite ? 'sqlite' : 'bolt' };
    }
    return null;
};

/**
 * Uploads the current Channel DB to the Server
 */
export const uploadChannelBackupToOlympus = async (
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean,
    pubkey: string,
    seedArray: string,
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

        const dbInfo = await getChannelDbPathInfo(lndDir, isTestnet, isSqlite);

        if (!dbInfo) {
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
                    await NativeModules.LndMobile.stopLnd();
                    await sleep(5000);
                } catch (e) {
                    console.log('LND Stop Error', e);
                }

                console.log(`Reading backup file: ${dbInfo.path}`);
                const backupBase64 = await ReactNativeBlobUtil.fs.readFile(
                    dbInfo.path,
                    'base64'
                );

                // encrypt using seeds
                console.log('Encrypting backup...');
                const encryptedBackup = CryptoJS.AES.encrypt(
                    backupBase64,
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

                const json = await backupResponse.json();
                console.log('Upload response:', json);

                if (setLoading) setLoading(false);

                if (backupResponse.info().status === 200 && json.success) {
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
                            )
                    );
                }
            } catch (e) {
                console.error('Upload failed:', e);
                if (setLoading) setLoading(false);
                Alert.alert(
                    localeString('general.error'),
                    localeString('views.Tools.migration.export.failedToUpload')
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
 * Downloads and restores the Channel DB from the server
 */
export const restoreChannelBackupFromOlympus = async (
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean,
    pubkey: string,
    seedArray: string,
    setLoading?: (loading: boolean) => void,
    skipRestart?: boolean
) => {
    try {
        if (setLoading) setLoading(true);

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
            if (setLoading) setLoading(false);
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
            if (setLoading) setLoading(false);
            return false;
        }

        // 2. Sign the challenge
        console.log('Signing challenge...');
        const messageSignData = await signMessageNodePubkey(
            Base64Utils.stringToUint8Array(verification)
        );
        const signature = messageSignData.signature;

        // 3. Request the file from the recover endpoint
        console.log('Downloading encrypted backup...');
        console.log('Request payload:', {
            message: verification,
            signature
        });
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
        console.log('Decrypting backup...', restoreResponse);
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
        const backupBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);

        if (!backupBase64) {
            throw new Error(
                'Decryption failed. Incorrect seed or corrupted file.'
            );
        }

        // 5. Stop LND before overwriting the active database
        try {
            console.log('Stopping LND for restore...');
            await NativeModules.LndMobile.stopLnd();
            await sleep(5000);
        } catch (e) {
            console.log('LND Stop Error', e);
        }

        // 6. Build the destination path
        const network = isTestnet ? 'testnet' : 'mainnet';
        const rootPath = Platform.select({
            android: RNFS.DocumentDirectoryPath,
            ios: `${RNFS.LibraryDirectoryPath}/Application Support`
        });
        const destFolder = `${rootPath}/${lndDir}/data/graph/${network}`;
        const dbName = isSqlite ? 'channel.sqlite' : 'channel.db';
        const destPath = `${destFolder}/${dbName}`;

        // 7. Save the restored file to the device
        if (!(await RNFS.exists(destFolder))) {
            await RNFS.mkdir(destFolder);
        }
        if (await RNFS.exists(destPath)) {
            await RNFS.unlink(destPath);
        }

        console.log(`Writing restored file to: ${destPath}`);
        await ReactNativeBlobUtil.fs.writeFile(
            destPath,
            backupBase64,
            'base64'
        );

        if (setLoading) setLoading(false);

        // 8. Success
        if (!skipRestart) {
            Alert.alert(
                localeString('general.success'),
                localeString('views.Tools.migration.import.restoreSuccess'),
                [
                    {
                        text: localeString('views.Wallet.restart'),
                        onPress: () => {
                            RNRestart.Restart();
                        }
                    }
                ],
                { cancelable: false }
            );
        }
        return true;
    } catch (error: any) {
        console.error('Restore Flow Failed', error);
        if (setLoading) setLoading(false);
        if (!skipRestart) {
            Alert.alert(
                localeString('general.error'),
                error.message ||
                    localeString('views.Tools.migration.import.restoreFailed')
            );
        }
        throw error;
    }
};

export const exportChannelDb = async (
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean,
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

        const dbPath = await getChannelDbPathInfo(lndDir, isTestnet, isSqlite);

        if (!dbPath) {
            Alert.alert(
                localeString('general.error'),
                localeString('views.Tools.migration.databaseNotFound')
            );
            if (setLoading) setLoading(false);
            return;
        }

        try {
            await NativeModules.LndMobile.stopLnd();
            await sleep(5000);
        } catch (e: any) {
            if (e?.message?.includes?.('closed')) {
                console.log('LND stopped successfully.');
            } else {
                console.error('Failed to stop LND:', e.message);
                if (setLoading) setLoading(false);
                Alert.alert(localeString('general.error'));
                return;
            }
        }

        const { path, type } = dbPath;
        const extension = type === 'sqlite' ? 'sqlite' : 'db';
        const backupFileName = `zeus-channels-${
            isTestnet ? 'testnet' : 'mainnet'
        }-${Date.now()}.${extension}`;
        const stagingPath = `${RNFS.DocumentDirectoryPath}/${backupFileName}`;

        if (await RNFS.exists(stagingPath)) {
            await RNFS.unlink(stagingPath);
        }

        await RNFS.copyFile(path, stagingPath);

        if (setLoading) setLoading(false);

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
            return;
        }

        await Storage.setItem(
            CHANNEL_MIGRATION_ACTIVE,
            JSON.stringify({ migrationStatus: true, lndDir })
        );
        await RNFS.unlink(stagingPath);

        Alert.alert(
            localeString('views.Tools.migration.export.success'),
            localeString('views.Tools.migration.export.success.text'),
            [
                {
                    text: localeString('views.Wallet.restart'),
                    onPress: () => RNRestart.Restart()
                }
            ],
            { cancelable: false }
        );
    } catch (error) {
        console.error('Export Failed:', error);
        if (setLoading) setLoading(false);
        Alert.alert(localeString('general.error'));
    }
};

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

    const isSqliteBackup = fileName.toLowerCase().endsWith('.sqlite');
    const dbName = isSqliteBackup ? 'channel.sqlite' : 'channel.db';

    const rootPath = Platform.select({
        android: RNFS.DocumentDirectoryPath,
        ios: `${RNFS.LibraryDirectoryPath}/Application Support`
    });

    const destFolder = `${rootPath}/${lndDir}/data/graph/${
        isTestnet ? 'testnet' : 'mainnet'
    }`;
    const destPath = `${destFolder}/${dbName}`;

    if (!(await RNFS.exists(destFolder))) {
        await RNFS.mkdir(destFolder);
    }

    if (await RNFS.exists(destPath)) {
        await RNFS.unlink(destPath);
    }
    await RNFS.copyFile(sourceUri, destPath);
};
