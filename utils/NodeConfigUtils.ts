import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import * as CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { scrypt } from 'scrypt-js';
import SettingsStore, { Node } from '../stores/SettingsStore';

export const EXPORT_FORMAT_VERSION = 2;

const KDF_NAME = 'scrypt';
const CIPHER_NAME = 'aes-256-gcm';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// An imported file is untrusted input and scrypt allocates roughly 128 * N * r
// bytes, so unbounded parameters would let a malicious backup exhaust memory
// during import. These ceilings stay well above the cost we write ourselves so
// that the parameters remain tunable without invalidating existing files.
const MAX_SCRYPT_N = 1 << 20;
const MAX_SCRYPT_R = 16;
const MAX_SCRYPT_P = 4;

interface ScryptParams {
    name: string;
    N: number;
    r: number;
    p: number;
    dkLen: number;
    salt: string;
}

interface NodeConfigPayload {
    nodes: Node[];
}

interface UnencryptedExport {
    version: number;
    encrypted: false;
    data: NodeConfigPayload;
}

interface EncryptedExportV1 {
    version: 1;
    encrypted: true;
    data: string;
}

interface EncryptedExportV2 {
    version: 2;
    encrypted: true;
    kdf: ScryptParams;
    cipher: string;
    iv: string;
    tag: string;
    data: string;
}

export type NodeConfigExport =
    | UnencryptedExport
    | EncryptedExportV1
    | EncryptedExportV2;

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

// NFKC keeps visually identical passwords byte-identical across platforms whose
// input methods emit different Unicode compositions. Hermes does not guarantee
// String.prototype.normalize, so fall back to the raw string rather than fail.
const passwordBytes = (password: string): Buffer => {
    const normalized =
        typeof password.normalize === 'function'
            ? password.normalize('NFKC')
            : password;
    return Buffer.from(normalized, 'utf8');
};

// Bound the KDF parameters and cipher name into the GCM tag so neither can be
// altered without the authentication check failing.
const additionalData = (kdf: ScryptParams): Buffer =>
    Buffer.from(
        `zeus-node-config|v${EXPORT_FORMAT_VERSION}|${kdf.name}|${kdf.N}|${kdf.r}|${kdf.p}|${kdf.dkLen}|${CIPHER_NAME}`,
        'utf8'
    );

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0;

const assertValidScryptParams = (kdf: ScryptParams | undefined) => {
    if (!kdf || kdf.name !== KDF_NAME) {
        throw new Error('Unsupported key derivation function');
    }
    if (
        !isPositiveInteger(kdf.N) ||
        !isPositiveInteger(kdf.r) ||
        !isPositiveInteger(kdf.p) ||
        !isPositiveInteger(kdf.dkLen)
    ) {
        throw new Error('Invalid key derivation parameters');
    }
    // scrypt requires N to be a power of two greater than one.
    if (kdf.N < 2 || (kdf.N & (kdf.N - 1)) !== 0 || kdf.N > MAX_SCRYPT_N) {
        throw new Error('Invalid key derivation parameters');
    }
    if (kdf.r > MAX_SCRYPT_R || kdf.p > MAX_SCRYPT_P) {
        throw new Error('Invalid key derivation parameters');
    }
    if (kdf.dkLen !== KEY_BYTES) {
        throw new Error('Invalid key derivation parameters');
    }
    if (typeof kdf.salt !== 'string' || !kdf.salt) {
        throw new Error('Invalid key derivation parameters');
    }
};

export type ProgressHandler = (progress: number) => void;

// scrypt-js only breaks its work into chunks and returns to the event loop when
// a progress callback is supplied; without one it runs the whole derivation in
// a single synchronous block and freezes the UI thread. The callback is
// therefore always passed, even when no caller is listening.
const deriveKey = async (
    password: string,
    kdf: ScryptParams,
    onProgress?: ProgressHandler
): Promise<Buffer> => {
    const derived = await scrypt(
        passwordBytes(password),
        Buffer.from(kdf.salt, 'base64'),
        kdf.N,
        kdf.r,
        kdf.p,
        kdf.dkLen,
        (progress: number) => {
            onProgress?.(progress);
        }
    );
    return Buffer.from(derived);
};

const parseNodes = (decryptedString: string): Node[] => {
    const decoded = JSON.parse(decryptedString);

    if (
        !decoded ||
        typeof decoded !== 'object' ||
        !Array.isArray(decoded.nodes)
    ) {
        throw new Error('Invalid data structure');
    }

    return decoded.nodes;
};

const encryptPayload = async (
    payload: NodeConfigPayload,
    password: string,
    onProgress?: ProgressHandler
): Promise<EncryptedExportV2> => {
    const salt = crypto.randomBytes(SALT_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);

    const kdf: ScryptParams = {
        name: KDF_NAME,
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        dkLen: KEY_BYTES,
        salt: salt.toString('base64')
    };

    const key = await deriveKey(password, kdf, onProgress);
    const cipher = crypto.createCipheriv(CIPHER_NAME, key, iv);
    cipher.setAAD(additionalData(kdf));

    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
        cipher.final()
    ]);

    return {
        version: 2,
        encrypted: true,
        kdf,
        cipher: CIPHER_NAME,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: ciphertext.toString('base64')
    };
};

export const createExportFileContent = async (
    nodes: Node[],
    useEncryption: boolean,
    password?: string,
    onProgress?: ProgressHandler
): Promise<string> => {
    const payload: NodeConfigPayload = { nodes };

    if (!useEncryption) {
        const unencrypted: UnencryptedExport = {
            version: EXPORT_FORMAT_VERSION,
            encrypted: false,
            data: payload
        };
        return JSON.stringify(unencrypted);
    }

    // Returning an unencrypted file here would silently contradict the user's
    // choice to encrypt, so treat a missing password as a hard failure.
    if (!password) {
        throw new Error('A password is required to encrypt the export');
    }

    return JSON.stringify(await encryptPayload(payload, password, onProgress));
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

        await RNFS.writeFile(filePath, fileContent, 'utf8');

        return filePath;
    } catch (err) {
        console.error('Failed to save node config file:', err);
        throw err;
    }
};

// Version 1 used CryptoJS.AES.encrypt in string-password mode, which derives
// the key with a single MD5 pass (EVP_BytesToKey) and authenticates nothing.
// It is retained for import only so that existing backups stay readable.
const decryptV1 = (encryptedData: string, password: string): Node[] => {
    const decryptedString = CryptoJS.AES.decrypt(
        encryptedData,
        password
    ).toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
        throw new Error('Decryption failed - wrong password?');
    }

    return parseNodes(decryptedString);
};

const decryptV2 = async (
    exportData: EncryptedExportV2,
    password: string,
    onProgress?: ProgressHandler
): Promise<Node[]> => {
    assertValidScryptParams(exportData.kdf);

    if (exportData.cipher !== CIPHER_NAME) {
        throw new Error('Unsupported cipher');
    }

    const iv = Buffer.from(exportData.iv, 'base64');
    const tag = Buffer.from(exportData.tag, 'base64');

    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
        throw new Error('Invalid encryption envelope');
    }

    const key = await deriveKey(password, exportData.kdf, onProgress);
    const decipher = crypto.createDecipheriv(CIPHER_NAME, key, iv);
    decipher.setAAD(additionalData(exportData.kdf));
    decipher.setAuthTag(tag);

    let plaintext: Buffer;
    try {
        // final() verifies the tag, so a wrong password and a modified file are
        // both rejected here rather than surfacing as malformed JSON later.
        plaintext = Buffer.concat([
            decipher.update(Buffer.from(exportData.data, 'base64')),
            decipher.final()
        ]);
    } catch (error) {
        throw new Error('Decryption failed - wrong password or altered file');
    }

    return parseNodes(plaintext.toString('utf8'));
};

export const decryptExportData = async (
    exportData: NodeConfigExport,
    password: string,
    onProgress?: ProgressHandler
): Promise<Node[]> => {
    if (!exportData.encrypted) {
        throw new Error('Export is not encrypted');
    }

    // Callers surface and log the failure; re-logging it here would duplicate
    // every wrong-password attempt in the device logs.
    return exportData.version === 1
        ? decryptV1(exportData.data, password)
        : decryptV2(exportData, password, onProgress);
};
