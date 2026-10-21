const mockMkdir = jest.fn();
const mockExists = jest.fn();
const mockStart = jest.fn();
const mockInitializeNode = jest.fn();

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
    default: {
        node: { start: (...args: any[]) => mockStart(...args) },
        utils: {
            initializeNode: (...args: any[]) => mockInitializeNode(...args)
        },
        crypto: { mnemonicToSeed: async () => '00' }
    }
}));

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('./VssAuthUtils', () => ({
    deriveVssSigningKeyFromSeed: () => ({
        privateKey: new Uint8Array(32),
        publicKey: new Uint8Array(33)
    })
}));

import { Platform } from 'react-native';
import {
    createLdkNodeDirectory,
    createLdkNodeWallet,
    getActiveLsps2NodeId,
    ensureLdkNodeBackupExclusion,
    getLdkNodeBaseDirectory,
    getLdkNodeStoragePath,
    startLdkNodeWallet
} from './LdkNodeUtils';

describe('LdkNodeUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Platform as any).OS = 'ios';
    });

    describe('getLdkNodeBaseDirectory', () => {
        it('returns the shared ldk-node directory under Documents', () => {
            expect(getLdkNodeBaseDirectory()).toEqual(
                '/mock/documents/ldk-node'
            );
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

    describe('startLdkNodeWallet', () => {
        it('applies the backup exclusion before the node starts', async () => {
            const warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockMkdir.mockResolvedValue(undefined);
            // 'boom' doesn't match shouldRetry (LDK_NODE_NOT_INITIALIZED)
            // or the fee-rate branches, so start fails fast and rethrows
            mockStart.mockRejectedValue(new Error('boom'));

            await expect(
                startLdkNodeWallet({
                    nodeDir: 'abc-123',
                    seedMnemonic: 'x',
                    network: 'mainnet',
                    skipInit: true
                })
            ).rejects.toThrow('boom');

            expect(mockMkdir).toHaveBeenCalledWith('/mock/documents/ldk-node', {
                NSURLIsExcludedFromBackupKey: true
            });
            expect(mockMkdir.mock.invocationCallOrder[0]).toBeLessThan(
                mockStart.mock.invocationCallOrder[0]
            );
            warnSpy.mockRestore();
        });
    });
});

describe('getActiveLsps2NodeId', () => {
    const lsps2Config = {
        nodeId: '02a8a7efb269645f1ca1e39637e72f74d45e8ec766c80cc184531d5453149695e6',
        address: '127.0.0.1:9735'
    };
    const create = () =>
        createLdkNodeWallet({
            nodeDir: 'dir',
            seedMnemonic: 'seed',
            network: 'mutinynet',
            lsps2Config
        });

    beforeEach(() => {
        jest.clearAllMocks();
        mockMkdir.mockResolvedValue(undefined);
        mockExists.mockResolvedValue(true);
    });

    it('records the LSPS2 LSP the built node registered', async () => {
        mockInitializeNode.mockResolvedValue({
            lsps2NodeId: lsps2Config.nodeId
        });

        await create();

        expect(mockInitializeNode).toHaveBeenCalledWith(
            expect.objectContaining({ lsps2Config })
        );
        expect(getActiveLsps2NodeId()).toEqual(lsps2Config.nodeId);
    });

    it('clears it when the next build registers none', async () => {
        mockInitializeNode.mockResolvedValueOnce({
            lsps2NodeId: lsps2Config.nodeId
        });
        await create();

        mockInitializeNode.mockResolvedValueOnce({});
        await create();

        expect(getActiveLsps2NodeId()).toBeUndefined();
    });

    it('clears it when the build fails', async () => {
        mockInitializeNode.mockResolvedValueOnce({
            lsps2NodeId: lsps2Config.nodeId
        });
        await create();

        mockInitializeNode.mockRejectedValueOnce({ code: 'vss_error' });
        await expect(create()).rejects.toEqual({ code: 'vss_error' });

        expect(getActiveLsps2NodeId()).toBeUndefined();
    });
});
