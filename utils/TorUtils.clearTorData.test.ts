jest.mock('react-native-nitro-tor', () => ({
    Tor: {
        daemon: {
            start: jest.fn(),
            stop: jest.fn()
        },
        http: {
            request: jest.fn()
        }
    }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/docs',
    CachesDirectoryPath: '/cache',
    TemporaryDirectoryPath: '/tmp',
    exists: jest.fn(),
    unlink: jest.fn()
}));

import { Tor } from 'react-native-nitro-tor';
import RNFS from 'react-native-fs';

const mockedStart = Tor.daemon.start as jest.Mock;
const mockedShutdown = Tor.daemon.stop as jest.Mock;
const mockedRequest = Tor.http.request as jest.Mock;
const mockedExists = RNFS.exists as jest.Mock;
const mockedUnlink = RNFS.unlink as jest.Mock;

// what Tor.daemon.start resolves with once Tor has bootstrapped
const RUNNING = {
    state: 'running',
    socksAddress: '127.0.0.1:9056',
    controlAddress: '127.0.0.1:9051',
    connectivity: { network: 'up', circuitEstablished: true }
};

// startPromise is module state, so each test loads a fresh copy
const loadTorUtils = (): typeof import('./TorUtils') => {
    let mod: any;
    jest.isolateModules(() => {
        mod = require('./TorUtils');
    });
    return mod;
};

const startTor = async (torUtils: typeof import('./TorUtils')) => {
    await torUtils.doTorRequest(
        'https://example.com',
        torUtils.RequestMethod.GET
    );
};

describe('clearTorData', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockedStart.mockResolvedValue(RUNNING);
        mockedShutdown.mockResolvedValue(undefined);
        mockedRequest.mockResolvedValue({
            statusCode: 200,
            headers: {},
            body: ''
        });
        mockedExists.mockResolvedValue(true);
        mockedUnlink.mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('deletes the current and legacy Tor data directories', async () => {
        const torUtils = loadTorUtils();

        await torUtils.clearTorData();

        expect(mockedUnlink.mock.calls.map((call) => call[0])).toEqual([
            '/docs/tor_data',
            '/cache/sifir_sdk',
            '/tmp/sifir_sdk'
        ]);
    });

    it('skips directories that do not exist', async () => {
        mockedExists.mockImplementation((dir: string) =>
            Promise.resolve(dir === '/docs/tor_data')
        );
        const torUtils = loadTorUtils();

        await torUtils.clearTorData();

        expect(mockedUnlink.mock.calls).toEqual([['/docs/tor_data']]);
    });

    it('does not stop Tor when this session never started it', async () => {
        const torUtils = loadTorUtils();

        await torUtils.clearTorData();

        expect(mockedShutdown).not.toHaveBeenCalled();
    });

    it('stops a running Tor before deleting its data directory', async () => {
        const torUtils = loadTorUtils();
        await startTor(torUtils);

        await torUtils.clearTorData();

        expect(mockedShutdown).toHaveBeenCalledTimes(1);
        expect(mockedShutdown.mock.invocationCallOrder[0]).toBeLessThan(
            mockedUnlink.mock.invocationCallOrder[0]
        );
    });

    it('starts Tor again on the next request after clearing', async () => {
        const torUtils = loadTorUtils();
        await startTor(torUtils);
        await torUtils.clearTorData();

        await startTor(torUtils);

        expect(mockedStart).toHaveBeenCalledTimes(2);
    });

    it('still deletes the directories when stopping Tor fails', async () => {
        mockedShutdown.mockRejectedValue(new Error('not running'));
        const torUtils = loadTorUtils();
        await startTor(torUtils);

        await expect(torUtils.clearTorData()).resolves.toBeUndefined();

        expect(mockedUnlink).toHaveBeenCalledTimes(3);
    });

    it('goes on to the next directory when one cannot be deleted', async () => {
        mockedUnlink.mockImplementation((dir: string) =>
            dir === '/docs/tor_data'
                ? Promise.reject(new Error('busy'))
                : Promise.resolve()
        );
        const torUtils = loadTorUtils();

        await expect(torUtils.clearTorData()).resolves.toBeUndefined();

        expect(mockedUnlink).toHaveBeenCalledTimes(3);
    });
});
