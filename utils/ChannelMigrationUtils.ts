import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNRestart from 'react-native-restart';
import { localeString } from './LocaleUtils';

import Storage from '../storage';

export const CHANNEL_MIGRATION_ACTIVE = 'channel_migration_active';

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
    lndDir: string | any,
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

        console.log('Opening Share Sheet...');

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

        console.log(' Export successful. Locking wallet...');

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
        RNRestart.Restart();
    }
};

export const restoreChannels = async (
    sourceUri: string,
    fileName: string,
    lndDir: string,
    isTestnet: boolean,
    setLoading?: (loading: boolean) => void
) => {
    try {
        if (setLoading) setLoading(true);

        console.log(`Restoring from: ${sourceUri}`);

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

        console.log(`Target Destination: ${destPath}`);

        if (await RNFS.exists(destPath)) {
            await RNFS.unlink(destPath);
        }
        await RNFS.copyFile(sourceUri, destPath);

        if (setLoading) setLoading(false);

        Alert.alert(
            localeString('views.Tools.nodeConfigExportImport.importSuccess'),
            `${localeString(
                'views.Tools.migration.import.success.text1'
            )}\n\n` +
                `ⓘ ${localeString(
                    'views.Tools.migration.import.success.text2'
                )}`,
            [
                {
                    text: localeString('views.Wallet.restart'),
                    onPress: () => RNRestart.Restart()
                }
            ],
            { cancelable: false }
        );
    } catch (error) {
        console.error('Import Failed:', error);
        if (setLoading) setLoading(false);
        Alert.alert(localeString('general.error'));
    }
};
