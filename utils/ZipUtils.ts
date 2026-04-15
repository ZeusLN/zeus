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
