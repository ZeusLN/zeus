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

export const createExportData = (
    nodes: Node[],
    useEncryption: boolean,
    password?: string
): string => {
    const exportData: NodeConfigExport = {
        version: 1,
        encrypted: useEncryption,
        data: {
            nodes
        }
    };

    let exportString = JSON.stringify(exportData);

    if (useEncryption && password) {
        const encryptedData = CryptoJS.AES.encrypt(
            exportString,
            password
        ).toString();

        exportString = JSON.stringify({
            version: 1,
            encrypted: true,
            data: encryptedData
        });
    }

    return exportString;
};

export const saveNodeConfigExportFile = async (
    fileName: string,
    data: string
): Promise<string> => {
    try {
        const filePath =
            Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        console.log(`Saving node config to: ${filePath}`);
        await RNFS.writeFile(filePath, data, 'utf8');

        return filePath;
    } catch (err) {
        console.error('Failed to save node config file:', err);
        throw err;
    }
};

export const decryptExportData = (
    encryptedString: string,
    password: string
): Node[] => {
    try {
        const encryptedData = JSON.parse(encryptedString);

        if (!encryptedData.version || encryptedData.version > 1) {
            throw new Error('Unsupported export version');
        }

        if (!encryptedData.encrypted) {
            throw new Error('Invalid export format or data is not encrypted');
        }

        const decryptedBytes = CryptoJS.AES.decrypt(
            encryptedData.data,
            password
        );
        const decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedString) {
            throw new Error('Decryption failed - wrong password?');
        }

        const decryptedData = JSON.parse(decryptedString);

        if (
            !decryptedData.data?.nodes ||
            !Array.isArray(decryptedData.data.nodes)
        ) {
            throw new Error('Invalid data structure');
        }

        return decryptedData.data.nodes;
    } catch (error) {
        console.error('Decryption error:', error);
        throw error;
    }
};
