import { NativeModules } from 'react-native';

const { ZipUtils } = NativeModules;

export const zipFolder = (
    sourcePath: string,
    destPath: string
): Promise<void> => ZipUtils.zipFolder(sourcePath, destPath);

export const unzipFile = (zipPath: string, destPath: string): Promise<void> =>
    ZipUtils.unzipFile(zipPath, destPath);

export const encryptFile = (
    inputPath: string,
    outputPath: string,
    passphrase: string
): Promise<void> => ZipUtils.encryptFile(inputPath, outputPath, passphrase);

export const decryptFile = (
    inputPath: string,
    outputPath: string,
    passphrase: string
): Promise<void> => ZipUtils.decryptFile(inputPath, outputPath, passphrase);

/**
 * In-memory counterparts to encryptFile/decryptFile. Both operate on
 * base64-encoded raw bytes and share the same wire format:
 * [0x01 version][16-byte salt][12-byte IV][ciphertext][16-byte GCM tag]
 * with PBKDF2-HMAC-SHA256 (100,000 iterations) key derivation and
 * AES-256-GCM.
 *
 * encryptString: base64 plaintext bytes in -> base64 wire blob out.
 * decryptString: base64 wire blob in -> base64 plaintext bytes out.
 */
export const encryptString = (
    plaintextBase64: string,
    passphrase: string
): Promise<string> => ZipUtils.encryptString(plaintextBase64, passphrase);

export const decryptString = (
    dataBase64: string,
    passphrase: string
): Promise<string> => ZipUtils.decryptString(dataBase64, passphrase);
