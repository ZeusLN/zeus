const mockMkdir = jest.fn();
const mockExists = jest.fn();

jest.mock('react-native', () => ({
    Platform: { OS: 'ios' }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/mock/documents',
    mkdir: (...args: any[]) => mockMkdir(...args),
    exists: (...args: any[]) => mockExists(...args),
    unlink: jest.fn()
}));

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('./VssAuthUtils', () => ({
    deriveVssSigningKeyFromSeed: jest.fn()
}));

import { Platform } from 'react-native';
import {
    createLdkNodeDirectory,
    ensureLdkNodeBackupExclusion,
    getLdkNodeBaseDirectory,
    getLdkNodeStoragePath
} from './LdkNodeUtils';

describe('LdkNodeUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Platform as any).OS = 'ios';
    });

    describe('getLdkNodeBaseDirectory', () => {
        it('returns the shared ldk-node directory under Documents', () => {
            expect(getLdkNodeBaseDirectory()).toEqual('/mock/documents/ldk-node');
        });
    });

    describe('getLdkNodeStoragePath', () => {
        it('returns the wallet directory under the shared base directory', () => {
            expect(getLdkNodeStoragePath('abc-123')).toEqual(
                '/mock/documents/ldk-node/abc-123'
            );
        });
    });

    describe('ensureLdkNodeBackupExclusion', () => {
        it('applies the iOS backup exclusion flag to the base directory', async () => {
            mockMkdir.mockResolvedValue(undefined);

            await ensureLdkNodeBackupExclusion();

            expect(mockMkdir).toHaveBeenCalledTimes(1);
            expect(mockMkdir).toHaveBeenCalledWith('/mock/documents/ldk-node', {
                NSURLIsExcludedFromBackupKey: true
            });
        });

        it('does nothing on Android', async () => {
            (Platform as any).OS = 'android';

            await ensureLdkNodeBackupExclusion();

            expect(mockMkdir).not.toHaveBeenCalled();
        });

        it('never throws when setting the flag fails', async () => {
            const warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockMkdir.mockRejectedValue(new Error('resource value failed'));

            await expect(
                ensureLdkNodeBackupExclusion()
            ).resolves.toBeUndefined();

            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    describe('createLdkNodeDirectory', () => {
        it('excludes the base directory and creates a missing wallet directory', async () => {
            mockMkdir.mockResolvedValue(undefined);
            mockExists.mockResolvedValue(false);

            const path = await createLdkNodeDirectory('abc-123');

            expect(path).toEqual('/mock/documents/ldk-node/abc-123');
            expect(mockMkdir).toHaveBeenCalledWith('/mock/documents/ldk-node', {
                NSURLIsExcludedFromBackupKey: true
            });
            expect(mockMkdir).toHaveBeenCalledWith(
                '/mock/documents/ldk-node/abc-123'
            );
        });

        it('still applies the exclusion when the wallet directory exists', async () => {
            mockMkdir.mockResolvedValue(undefined);
            mockExists.mockResolvedValue(true);

            const path = await createLdkNodeDirectory('abc-123');

            expect(path).toEqual('/mock/documents/ldk-node/abc-123');
            expect(mockMkdir).toHaveBeenCalledTimes(1);
            expect(mockMkdir).toHaveBeenCalledWith('/mock/documents/ldk-node', {
                NSURLIsExcludedFromBackupKey: true
            });
        });
    });
});
