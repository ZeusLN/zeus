// A wallet whose config is on the device but whose data directory is not is
// restored from VSS by its first start. These tests cover a first start that
// does not get to the end of that restore.

// the files on the device; they outlive the JS context
const mockFiles = new Set<string>();
const mockInitializeNode = jest.fn();

jest.mock('react-native', () => ({
    Platform: { OS: 'android' }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/files',
    exists: async (path: string) =>
        [...mockFiles].some((f) => f === path || f.startsWith(`${path}/`)),
    mkdir: async () => undefined,
    writeFile: async (path: string) => {
        mockFiles.add(path);
    },
    unlink: async (path: string) => {
        for (const f of [...mockFiles]) {
            if (f === path || f.startsWith(`${path}/`)) mockFiles.delete(f);
        }
    }
}));

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        crypto: { mnemonicToSeed: async () => '00'.repeat(64) },
        utils: {
            initializeNode: (...args: any[]) => mockInitializeNode(...args)
        },
        node: {
            start: async () => undefined,
            syncWallets: async () => undefined,
            status: async () => ({ latestRgsSnapshotTimestamp: 1 })
        }
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

const LOCAL_DB = '/files/ldk-node/abc-123/ldk_node_data.sqlite';
const RESTORE_MARKER = '/files/ldk-node/abc-123.restoring';

// every app launch gets a JS context of its own
const launchApp = () => {
    let utils: any;
    jest.isolateModules(() => {
        utils = require('./LdkNodeUtils');
    });
    return {
        startWallet: () =>
            utils.startLdkNodeWallet({
                nodeDir: 'abc-123',
                seedMnemonic: 'x',
                network: 'mainnet'
            }),
        deleteWallet: () => utils.deleteLdkNodeWallet('abc-123')
    };
};

// ldk-node creates the local DB as soon as the build begins
const buildCompletes = async () => {
    mockFiles.add(LOCAL_DB);
    return {};
};
const buildNeverReturns = () => {
    mockFiles.add(LOCAL_DB);
    return new Promise(() => {});
};
// the build thread is still in the wallet directory and cleans up later
const buildTimesOut = async () => {
    mockFiles.add(LOCAL_DB);
    throw Object.assign(new Error('VSS server did not respond'), {
        code: 'vss_error'
    });
};

const failOnVssErrorOfBuild = (n: number) =>
    mockInitializeNode.mock.calls[n][0].failOnVssError;

describe('startLdkNodeWallet after an interrupted restore', () => {
    beforeEach(() => {
        mockFiles.clear();
        mockInitializeNode.mockReset();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('starts the restore over when the previous one died with the process', async () => {
        mockInitializeNode.mockImplementationOnce(buildNeverReturns);
        launchApp().startWallet();
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(failOnVssErrorOfBuild(0)).toBe(true);

        let partialDbWasThere: boolean | undefined;
        mockInitializeNode.mockImplementationOnce(() => {
            partialDbWasThere = mockFiles.has(LOCAL_DB);
            return buildCompletes();
        });
        await launchApp().startWallet();

        expect(failOnVssErrorOfBuild(1)).toBe(true);
        expect(partialDbWasThere).toBe(false);
    });

    it('leaves the cleanup to the native module while the process lives', async () => {
        const app = launchApp();
        mockInitializeNode.mockImplementationOnce(buildTimesOut);
        await expect(app.startWallet()).rejects.toThrow('did not respond');

        let partialDbWasThere: boolean | undefined;
        mockInitializeNode.mockImplementationOnce(() => {
            partialDbWasThere = mockFiles.has(LOCAL_DB);
            return buildCompletes();
        });
        await app.startWallet();

        expect(failOnVssErrorOfBuild(1)).toBe(true);
        expect(partialDbWasThere).toBe(true);
    });

    it('treats the wallet as local once a restore has completed', async () => {
        mockInitializeNode.mockImplementation(buildCompletes);
        await launchApp().startWallet();
        await launchApp().startWallet();

        expect(failOnVssErrorOfBuild(0)).toBe(true);
        expect(failOnVssErrorOfBuild(1)).toBe(false);
        expect([...mockFiles]).toEqual([LOCAL_DB]);
    });

    it('leaves nothing of an interrupted restore behind when the wallet is deleted', async () => {
        mockInitializeNode.mockImplementationOnce(buildNeverReturns);
        launchApp().startWallet();
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect([...mockFiles].sort()).toEqual([RESTORE_MARKER, LOCAL_DB]);

        await launchApp().deleteWallet();

        expect([...mockFiles]).toEqual([]);
    });
});
