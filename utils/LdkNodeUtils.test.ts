const mockMkdir = jest.fn();
const mockExists = jest.fn();
const mockStart = jest.fn();
const mockInitializeNode = jest.fn();
const mockMnemonicToSeed = jest.fn();
const mockSyncWallets = jest.fn();
const mockStatus = jest.fn();

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
        node: {
            start: (...args: any[]) => mockStart(...args),
            syncWallets: (...args: any[]) => mockSyncWallets(...args),
            status: (...args: any[]) => mockStatus(...args)
        },
        utils: {
            initializeNode: (...args: any[]) => mockInitializeNode(...args)
        },
        crypto: {
            mnemonicToSeed: (...args: any[]) => mockMnemonicToSeed(...args)
        }
    }
}));

jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('./VssAuthUtils', () => ({
    deriveVssSigningKeyFromSeed: () => ({
        privateKey: new Uint8Array([1]),
        publicKey: new Uint8Array([2])
    })
}));

import { Platform } from 'react-native';
import {
    createLdkNodeDirectory,
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
            // 'boom' doesn't match shouldRetry (LDK_NODE_NOT_INITIALIZED),
            // so start fails fast and rethrows
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

        it('rethrows a fee rate start error without syncing', async () => {
            const warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockMkdir.mockResolvedValue(undefined);
            mockStart.mockRejectedValue(
                new Error('FeerateEstimationUpdateFailed')
            );

            await expect(
                startLdkNodeWallet({
                    nodeDir: 'abc-123',
                    seedMnemonic: 'x',
                    network: 'mainnet',
                    skipInit: true
                })
            ).rejects.toThrow('FeerateEstimationUpdateFailed');

            expect(mockSyncWallets).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        describe('VSS while offline', () => {
            const start = (offline: boolean) =>
                startLdkNodeWallet({
                    nodeDir: 'abc-123',
                    seedMnemonic: 'x',
                    network: 'mainnet',
                    vssServerUrl: 'https://vss.example.com',
                    offline
                });

            beforeEach(() => {
                jest.spyOn(console, 'log').mockImplementation(() => {});
                mockMkdir.mockResolvedValue(undefined);
                mockInitializeNode.mockResolvedValue({});
                mockMnemonicToSeed.mockResolvedValue('00');
                mockStart.mockResolvedValue(undefined);
                mockSyncWallets.mockResolvedValue(undefined);
                mockStatus.mockResolvedValue({
                    latestRgsSnapshotTimestamp: 1
                });
            });

            afterEach(() => jest.restoreAllMocks());

            it('builds an existing node without VSS when offline', async () => {
                mockExists.mockResolvedValue(true);

                await start(true);

                const [args] = mockInitializeNode.mock.calls[0];
                expect(args.vssConfig).toBeUndefined();
                expect(args.vssKey).toBeUndefined();
                expect(args.failOnVssError).toBe(false);
                expect(mockMnemonicToSeed).not.toHaveBeenCalled();
            });

            it('keeps VSS and the hard failure when offline without a local DB', async () => {
                mockExists.mockResolvedValue(false);

                await start(true);

                const [args] = mockInitializeNode.mock.calls[0];
                expect(args.vssConfig).toEqual({
                    url: 'https://vss.example.com',
                    storeId: '02'
                });
                expect(args.failOnVssError).toBe(true);
            });

            it('builds an existing node with VSS when online', async () => {
                mockExists.mockResolvedValue(true);

                await start(false);

                const [args] = mockInitializeNode.mock.calls[0];
                expect(args.vssConfig).toEqual({
                    url: 'https://vss.example.com',
                    storeId: '02'
                });
                expect(args.failOnVssError).toBe(false);
            });
        });
    });
});
