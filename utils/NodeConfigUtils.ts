import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import * as CryptoJS from 'crypto-js';
import SettingsStore, { Node } from '../stores/SettingsStore';

interface NodeConfigExport {
    version: number;
    encrypted: boolean;
    data:
        | {
              nodes: Node[];
          }
        | string;
}

export const saveNodeConfigs = async (
    nodes: Node[],
    settingsStore: SettingsStore
): Promise<void> => {
    const { settings } = settingsStore;
    const existingNodes = settings.nodes || [];
    const updatedNodes = [...existingNodes, ...nodes];
    await settingsStore.updateSettings({
        nodes: updatedNodes
    });
};

export const createExportFileContent = (
    nodes: Node[],
    useEncryption: boolean,
    password?: string
): string => {
    const nodeConfigExport: NodeConfigExport = {
        version: 1,
        encrypted: useEncryption && !!password,
        data: {
            nodes
        }
    };

    if (useEncryption && password) {
        const encryptedData = CryptoJS.AES.encrypt(
            JSON.stringify(nodeConfigExport.data),
            password
        ).toString();

        return JSON.stringify({
            version: 1,
            encrypted: true,
            data: encryptedData
        });
    }

    return JSON.stringify(nodeConfigExport);
};

export const NODE_CONFIG_EXPORT_EXT = '.zeus-wallet-config-backup';

// Stages the export in app-private cache and hands it to the system share
// sheet so the user explicitly picks a destination. Wallet config exports
// carry connection credentials (macaroons, runes, NWC URLs), so they must
// never be written to shared storage directly. The staging file is unlinked
// after every share attempt.
export const shareNodeConfigExportFile = async (
    fileName: string,
    fileContent: string
): Promise<void> => {
    // Loaded lazily: react-native-share touches native modules at import
    // time, and this util sits in the SettingsStore module graph via the
    // legacy-export purge below
    const Share = require('react-native-share').default;
    const stagingPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
    try {
        if (await RNFS.exists(stagingPath)) await RNFS.unlink(stagingPath);
        await RNFS.writeFile(stagingPath, fileContent, 'utf8');

        await Share.open({
            url: `file://${stagingPath}`,
            type: 'application/json',
            filename: fileName,
            failOnCancel: false
        });
    } catch (err) {
        console.error('Failed to share node config file:', err);
        throw err;
    } finally {
        try {
            if (await RNFS.exists(stagingPath)) await RNFS.unlink(stagingPath);
        } catch (e) {
            console.warn('Error deleting node config staging file:', e);
        }
    }
};

// Best-effort removal of wallet config exports that older builds wrote to
// shared storage (Android public Downloads, iOS Files-visible Documents).
// They carry connection credentials, are optionally encrypted, and nothing
// ever deleted them. Best-effort only: under Android scoped storage the file
// can only be removed by the install that created it, and a failed unlink
// can never succeed on a later retry.
export const purgeLegacyNodeConfigExports = async (): Promise<void> => {
    const dir =
        Platform.OS === 'android'
            ? RNFS.DownloadDirectoryPath
            : RNFS.DocumentDirectoryPath;
    try {
        const entries = await RNFS.readDir(dir);
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(NODE_CONFIG_EXPORT_EXT)) {
                try {
                    await RNFS.unlink(entry.path);
                    console.log(
                        'Legacy wallet config export deleted:',
                        entry.path
                    );
                } catch (e) {
                    console.warn(
                        'Error deleting legacy wallet config export:',
                        e
                    );
                }
            }
        }
    } catch (e) {
        console.warn('Error purging legacy wallet config exports:', e);
    }
};

export const decryptExportData = (
    encryptedData: string,
    password: string
): Node[] => {
    try {
        const decryptedString = CryptoJS.AES.decrypt(
            encryptedData,
            password
        ).toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            throw new Error('Decryption failed - wrong password?');
        }

        const decryptedData: NodeConfigExport['data'] =
            JSON.parse(decryptedString);

        if (
            typeof decryptedData === 'string' ||
            !decryptedData ||
            !Array.isArray(decryptedData.nodes)
        ) {
            throw new Error('Invalid data structure');
        }

        return decryptedData.nodes;
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
};
