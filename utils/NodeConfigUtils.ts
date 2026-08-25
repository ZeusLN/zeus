import RNFS from 'react-native-fs';
import { saveDocuments } from '@react-native-documents/picker';
import * as CryptoJS from 'crypto-js';
import moment from 'moment';

import SettingsStore, { Node } from '../stores/SettingsStore';
import { encryptFile, decryptFile } from './ZipUtils';

// Bump when the on-disk export format changes. v1 = legacy CryptoJS
// passphrase-mode blob (import-only, permanent). v2 = native AES-256-GCM
// (PBKDF2-HMAC-SHA256) blob, base64-wrapped in the JSON envelope below.
export const EXPORT_FORMAT_VERSION = 2;

// The export password is the only thing standing between a captured backup and
// the node credentials inside it, so hold it to a floor rather than accepting
// anything non-empty.
export const MIN_EXPORT_PASSWORD_LENGTH = 8;

// Measures the password by its non-whitespace-padded length so a run of spaces
// cannot pass for a passphrase. The password itself is never trimmed - export
// and import must agree on the exact bytes fed to the KDF, or a backup written
// with a leading space would no longer open.
export const isValidExportPassword = (password: string): boolean =>
    !!password && password.trim().length >= MIN_EXPORT_PASSWORD_LENGTH;

interface NodeConfigExport {
    version: number;
    encrypted: boolean;
    data:
        | {
              nodes: Node[];
          }
        | string;
}

const safeUnlink = async (path: string): Promise<void> => {
    try {
        if (await RNFS.exists(path)) {
            await RNFS.unlink(path);
        }
    } catch (e) {
        console.warn('Failed to remove temp node-config file:', e);
    }
};

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

// Encrypts the selected node configs with the user's password using the native
// AES-256-GCM primitive (ZipUtils, PBKDF2-HMAC-SHA256), then prompts the user
// for a destination via the system save dialog (SAF on Android, the Files
// exporter on iOS), staged from app-private cache. Nothing is written to
// shared storage unprompted, and the export is never produced in plaintext.
// Resolves once the encrypted file has been written to the chosen
// destination; rejects with OPERATION_CANCELED if the user dismisses the
// dialog.
export const exportNodeConfigs = async (
    nodes: Node[],
    password: string
): Promise<void> => {
    // The UI enforces a confirmed password, but guard here too so this API can
    // never produce an unencrypted or trivially-keyed export.
    if (!isValidExportPassword(password)) {
        throw new Error(
            `A password of at least ${MIN_EXPORT_PASSWORD_LENGTH} characters is required to export node configs`
        );
    }

    const timestamp = moment().format('YYYYMMDD-HHmmss');
    const filename = `${timestamp}.zeus-wallet-config-backup`;

    const cacheDir = RNFS.CachesDirectoryPath;
    const plainPath = `${cacheDir}/zeus-nodeconfig-plain.tmp`;
    const encPath = `${cacheDir}/zeus-nodeconfig-enc.tmp`;
    const stagingPath = `${cacheDir}/${filename}`;

    try {
        await safeUnlink(plainPath);
        await safeUnlink(encPath);

        // Sweep the share-sheet staging dir used by earlier builds of this
        // flow, in case a ciphertext envelope is still lingering in cache.
        await safeUnlink(`${cacheDir}/nodeconfig-exports`);

        // 1. Stage the plaintext payload (the native crypto API is file-based).
        const payload = JSON.stringify({ nodes });
        await RNFS.writeFile(plainPath, payload, 'utf8');

        // 2. Native PBKDF2-HMAC-SHA256 + AES-256-GCM. Output wire format is
        //    [version=0x01][salt(16)][iv(12)][ciphertext+GCM tag].
        await encryptFile(plainPath, encPath, password);

        // Plaintext is no longer needed - remove it as early as possible.
        await safeUnlink(plainPath);

        // 3. Wrap the GCM blob (base64) in a UTF-8 JSON envelope so the import
        //    side stays JSON.parse-based and the file is valid text.
        const encryptedBase64 = await RNFS.readFile(encPath, 'base64');
        await safeUnlink(encPath);

        const envelope: NodeConfigExport = {
            version: EXPORT_FORMAT_VERSION,
            encrypted: true,
            data: encryptedBase64
        };
        await RNFS.writeFile(stagingPath, JSON.stringify(envelope), 'utf8');

        // 4. Present the system save dialog. saveDocuments copies the staged
        //    envelope into the user-chosen destination before resolving, so
        //    unlike a share sheet there are no lazy readers and the staging
        //    file can be removed in finally.
        const [result] = await saveDocuments({
            sourceUris: [`file://${stagingPath}`],
            fileName: filename,
            mimeType: 'application/json',
            copy: true
        });
        if (result?.error) {
            throw new Error(result.error);
        }
    } finally {
        await safeUnlink(plainPath);
        await safeUnlink(encPath);
        await safeUnlink(stagingPath);
    }
};

// Decrypts a v2 (native AES-256-GCM) export blob. Throws on a wrong password
// (the native layer rejects on GCM tag mismatch).
export const decryptExportDataV2 = async (
    encryptedBase64: string,
    password: string
): Promise<Node[]> => {
    const cacheDir = RNFS.CachesDirectoryPath;
    const encPath = `${cacheDir}/zeus-nodeconfig-import-enc.tmp`;
    const plainPath = `${cacheDir}/zeus-nodeconfig-import-plain.tmp`;

    try {
        await safeUnlink(encPath);
        await safeUnlink(plainPath);

        await RNFS.writeFile(encPath, encryptedBase64, 'base64');
        await decryptFile(encPath, plainPath, password);
        await safeUnlink(encPath);

        const decryptedString = await RNFS.readFile(plainPath, 'utf8');
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
    } finally {
        await safeUnlink(encPath);
        await safeUnlink(plainPath);
    }
};

// Legacy v1 decrypt: CryptoJS passphrase mode (EVP_BytesToKey, MD5, 1
// iteration). Kept permanently so previously-exported backups remain
// importable. No longer used for new exports.
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
