import { Alert, Platform, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNRestart from 'react-native-restart';
import { localeString } from './LocaleUtils';
import { sleep } from '../utils/SleepUtils';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

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

export const getChannelDbPath = async (
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

export const exportChannelDb = async (
    lndDir: string,
    isTestnet: boolean,
    isSqlite: boolean,
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

        const dbPath = await getChannelDbPath(lndDir, isTestnet, isSqlite);

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
