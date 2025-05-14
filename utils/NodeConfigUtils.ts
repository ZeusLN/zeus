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

export const saveNodeConfigExportFile = async (
    fileName: string,
    fileContent: string
): Promise<string> => {
    try {
        const filePath =
            Platform.OS === 'android'
                ? `${RNFS.DownloadDirectoryPath}/${fileName}`
                : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        console.log(`Saving node config to: ${filePath}`);
        await RNFS.writeFile(filePath, fileContent, 'utf8');

        return filePath;
    } catch (err) {
        console.error('Failed to save node config file:', err);
        throw err;
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
