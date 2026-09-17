const mockPlatform = { OS: 'ios' };

// Read through a getter: jest hoists this factory above the `const` above
// it, so a direct reference captures the value while it is still in TDZ
jest.mock('react-native', () => ({
    get Platform() {
        return mockPlatform;
    }
}));

jest.mock('react-native-fs', () => ({
    CachesDirectoryPath: '/cache',
    DocumentDirectoryPath: '/documents',
    exists: jest.fn(),
    unlink: jest.fn(),
    readDir: jest.fn()
}));

import RNFS from 'react-native-fs';

import {
    CHANNEL_EXPORT_STAGING_DIR,
    channelExportStagingPath,
    purgeChannelExportStaging,
    purgeLegacyChannelExports,
    LEGACY_CHANNEL_EXPORT_REGEX
} from './ChannelExportStagingUtils';

const file = (name: string) => ({
    name,
    path: `/documents/${name}`,
    isFile: () => true,
    isDirectory: () => false
});

describe('ChannelExportStagingUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatform.OS = 'ios';
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('channelExportStagingPath', () => {
        it('sits in app-private cache, never in Documents', () => {
            expect(channelExportStagingPath()).toBe(
                `/cache/${CHANNEL_EXPORT_STAGING_DIR}`
            );
        });
    });

    describe('purgeChannelExportStaging', () => {
        it('removes the staging directory when it exists', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);

            await purgeChannelExportStaging();

            expect(RNFS.unlink).toHaveBeenCalledWith(
                `/cache/${CHANNEL_EXPORT_STAGING_DIR}`
            );
        });

        it('is a no-op when the staging directory is absent', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(false);

            await purgeChannelExportStaging();

            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('swallows unlink failures', async () => {
            (RNFS.exists as jest.Mock).mockResolvedValue(true);
            (RNFS.unlink as jest.Mock).mockRejectedValue(new Error('EPERM'));

            await expect(purgeChannelExportStaging()).resolves.toBeUndefined();
        });
    });

    describe('LEGACY_CHANNEL_EXPORT_REGEX', () => {
        it.each([
            'zeus-lnd-mainnet-1736899200000.zip',
            'zeus-lnd-testnet-1736899200000.zip'
        ])('matches the shape released builds generated: %s', (name) => {
            expect(LEGACY_CHANNEL_EXPORT_REGEX.test(name)).toBe(true);
        });

        it.each([
            // networks exportChannelDb never names
            'zeus-lnd-regtest-1736899200000.zip',
            'zeus-lnd-signet-1736899200000.zip',
            // not a timestamp
            'zeus-lnd-mainnet-abc.zip',
            'zeus-lnd-mainnet-.zip',
            // user files that merely share the prefix
            'my-zeus-lnd-mainnet-1736899200000.zip',
            'zeus-lnd-mainnet-1736899200000.zip.bak',
            'zeus-lnd-mainnet-1736899200000 (1).zip',
            // unrelated ZEUS exports
            'zeus_20250212_140719_onchain.csv'
        ])('leaves %s alone', (name) => {
            expect(LEGACY_CHANNEL_EXPORT_REGEX.test(name)).toBe(false);
        });
    });

    describe('purgeLegacyChannelExports', () => {
        it('does nothing on Android, which never staged in Documents', async () => {
            mockPlatform.OS = 'android';

            await purgeLegacyChannelExports();

            expect(RNFS.readDir).not.toHaveBeenCalled();
            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('deletes only matching files from iOS Documents', async () => {
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                file('zeus-lnd-mainnet-1736899200000.zip'),
                file('zeus-lnd-testnet-1736899200001.zip'),
                file('holiday-photos.zip'),
                file('zeus-lnd-mainnet-notatimestamp.zip')
            ]);

            await purgeLegacyChannelExports();

            expect(RNFS.readDir).toHaveBeenCalledWith('/documents');
            expect(RNFS.unlink).toHaveBeenCalledTimes(2);
            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/documents/zeus-lnd-mainnet-1736899200000.zip'
            );
            expect(RNFS.unlink).toHaveBeenCalledWith(
                '/documents/zeus-lnd-testnet-1736899200001.zip'
            );
        });

        it('skips directories whose name would otherwise match', async () => {
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                {
                    name: 'zeus-lnd-mainnet-1736899200000.zip',
                    path: '/documents/zeus-lnd-mainnet-1736899200000.zip',
                    isFile: () => false,
                    isDirectory: () => true
                }
            ]);

            await purgeLegacyChannelExports();

            expect(RNFS.unlink).not.toHaveBeenCalled();
        });

        it('keeps going after a failed unlink', async () => {
            (RNFS.readDir as jest.Mock).mockResolvedValue([
                file('zeus-lnd-mainnet-1736899200000.zip'),
                file('zeus-lnd-testnet-1736899200001.zip')
            ]);
            (RNFS.unlink as jest.Mock)
                .mockRejectedValueOnce(new Error('EPERM'))
                .mockResolvedValueOnce(undefined);

            await expect(purgeLegacyChannelExports()).resolves.toBeUndefined();
            expect(RNFS.unlink).toHaveBeenCalledTimes(2);
        });

        it('swallows a readDir failure', async () => {
            (RNFS.readDir as jest.Mock).mockRejectedValue(new Error('ENOENT'));

            await expect(purgeLegacyChannelExports()).resolves.toBeUndefined();
        });
    });
});
