// Jest applies this mock to every test that loads react-native-fs, because
// the real module reads NativeModules.RNFSManager at import time. Tests that
// need other paths or behavior can still pass their own jest.mock factory.
export const DocumentDirectoryPath = '/docs';
export const CachesDirectoryPath = '/cache';
export const DownloadDirectoryPath = '/public-downloads';

export const exists = jest.fn().mockResolvedValue(false);
export const mkdir = jest.fn().mockResolvedValue(undefined);
export const readDir = jest.fn().mockResolvedValue([]);
export const unlink = jest.fn().mockResolvedValue(undefined);
export const writeFile = jest.fn().mockResolvedValue(undefined);

// The real module is CommonJS, so `import RNFS from 'react-native-fs'` and
// require('react-native-fs') both see these fields.
export default {
    DocumentDirectoryPath,
    CachesDirectoryPath,
    DownloadDirectoryPath,
    exists,
    mkdir,
    readDir,
    unlink,
    writeFile
};
