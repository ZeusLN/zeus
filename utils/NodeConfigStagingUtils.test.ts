// The node-config export/import flows stage a plaintext copy of every node
// config, seed phrases included, in app-private cache. Their own finally
// blocks miss it if the process is killed mid-flow, so this sweep is the only
// thing that removes the remnant. It runs on wipe (including the duress wipe)
// and at launch.

// In-memory filesystem keyed by absolute path.
let mockFiles: Record<string, string> = {};
let mockReadDirError: Error | null = null;
const mockUnlinked: string[] = [];

jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/cache',
    exists: (p: string) =>
        Promise.resolve(
            Object.prototype.hasOwnProperty.call(mockFiles, p) ||
                Object.keys(mockFiles).some((f) => f.startsWith(`${p}/`))
        ),
    unlink: (p: string) => {
        mockUnlinked.push(p);
        delete mockFiles[p];
        for (const f of Object.keys(mockFiles)) {
            if (f.startsWith(`${p}/`)) delete mockFiles[f];
        }
        return Promise.resolve();
    },
    readDir: (dir: string) => {
        if (mockReadDirError) return Promise.reject(mockReadDirError);
        const entries = Object.keys(mockFiles)
            .filter((f) => f.startsWith(`${dir}/`))
            .map((f) => f.slice(dir.length + 1))
            // direct children only, as RNFS.readDir is not recursive
            .filter((name) => !name.includes('/'))
            .map((name) => ({
                name,
                path: `${dir}/${name}`,
                isFile: () => true,
                isDirectory: () => false
            }));
        return Promise.resolve(entries);
    }
}));

import {
    nodeConfigStagingPaths,
    purgeNodeConfigStagingFiles
} from './NodeConfigStagingUtils';

const seedPlaintext = JSON.stringify({
    nodes: [{ seedPhrase: ['abandon', 'abandon', 'about'] }]
});

describe('purgeNodeConfigStagingFiles', () => {
    beforeEach(() => {
        mockFiles = {};
        mockReadDirError = null;
        mockUnlinked.length = 0;
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('removes every staged export and import file', async () => {
        const paths = nodeConfigStagingPaths();
        for (const path of Object.values(paths)) {
            mockFiles[path] = seedPlaintext;
        }

        await purgeNodeConfigStagingFiles();

        for (const path of Object.values(paths)) {
            expect(mockFiles[path]).toBeUndefined();
        }
    });

    it('removes plaintext left by a kill mid-export and mid-import', async () => {
        const { exportPlain, importPlain } = nodeConfigStagingPaths();
        mockFiles[exportPlain] = seedPlaintext;
        mockFiles[importPlain] = seedPlaintext;

        await purgeNodeConfigStagingFiles();

        expect(Object.keys(mockFiles)).toEqual([]);
        expect(mockUnlinked).toContain(exportPlain);
        expect(mockUnlinked).toContain(importPlain);
    });

    it('sweeps staged export envelopes left under their user-facing name', async () => {
        mockFiles['/cache/20260921-143000.zeus-wallet-config-backup'] = 'blob';
        mockFiles['/cache/20260101-090000.zeus-wallet-config-backup'] = 'blob';

        await purgeNodeConfigStagingFiles();

        expect(Object.keys(mockFiles)).toEqual([]);
    });

    it('leaves unrelated cache files alone', async () => {
        mockFiles['/cache/some-image.png'] = 'png';
        mockFiles['/cache/notes.txt'] = 'text';

        await purgeNodeConfigStagingFiles();

        expect(Object.keys(mockFiles).sort()).toEqual([
            '/cache/notes.txt',
            '/cache/some-image.png'
        ]);
    });

    it('is a no-op when nothing was staged', async () => {
        await expect(purgeNodeConfigStagingFiles()).resolves.toBeUndefined();
        expect(mockUnlinked).toEqual([]);
    });

    // A wipe must not abort partway because cache is unreadable
    it('still removes the known paths when the cache listing fails', async () => {
        const { exportPlain } = nodeConfigStagingPaths();
        mockFiles[exportPlain] = seedPlaintext;
        mockReadDirError = new Error('EACCES');

        await expect(purgeNodeConfigStagingFiles()).resolves.toBeUndefined();
        expect(mockFiles[exportPlain]).toBeUndefined();
    });

    it('keeps going when a single unlink fails', async () => {
        const { exportPlain, importPlain } = nodeConfigStagingPaths();
        mockFiles[exportPlain] = seedPlaintext;
        mockFiles[importPlain] = seedPlaintext;
        const RNFS = require('react-native-fs');
        const realUnlink = RNFS.unlink;
        RNFS.unlink = jest
            .fn()
            .mockRejectedValueOnce(new Error('EPERM'))
            .mockImplementation(realUnlink);

        await expect(purgeNodeConfigStagingFiles()).resolves.toBeUndefined();
        expect(mockFiles[importPlain]).toBeUndefined();

        RNFS.unlink = realUnlink;
    });
});
