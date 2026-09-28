jest.mock('react-native-nitro-tor', () => ({
    Tor: {
        daemon: {
            start: jest.fn(),
            stop: jest.fn(),
            getStatus: jest.fn()
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
const mockedGetStatus = Tor.daemon.getStatus as jest.Mock;
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
        mockedGetStatus.mockResolvedValue({ state: 'stopped' });
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

    it('stops a Tor that was already running when this session first used it', async () => {
        mockedGetStatus.mockResolvedValue(RUNNING);
        const torUtils = loadTorUtils();
        await startTor(torUtils);
        expect(mockedStart).not.toHaveBeenCalled();

        await torUtils.clearTorData();

        expect(mockedShutdown).toHaveBeenCalledTimes(1);
        expect(mockedShutdown.mock.invocationCallOrder[0]).toBeLessThan(
            mockedUnlink.mock.invocationCallOrder[0]
        );
    });

    it('does not stop Tor a second time on a second clear', async () => {
        const torUtils = loadTorUtils();
        await startTor(torUtils);
        await torUtils.clearTorData();

        await torUtils.clearTorData();

        expect(mockedShutdown).toHaveBeenCalledTimes(1);
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

    it('waits for a start in progress before stopping Tor', async () => {
        let finishStart: (started: boolean) => void = () => {};
        mockedStart.mockReturnValue(
            new Promise((resolve, reject) => {
                finishStart = (started) =>
                    started
                        ? resolve(RUNNING)
                        : reject(new Error('bootstrap failed'));
            })
        );
        const torUtils = loadTorUtils();
        const request = startTor(torUtils);

        const clearing = torUtils.clearTorData();
        await Promise.resolve();
        expect(mockedShutdown).not.toHaveBeenCalled();

        finishStart(true);
        await clearing;
        await request;

        expect(mockedShutdown).toHaveBeenCalledTimes(1);
        expect(mockedRequest.mock.invocationCallOrder[0]).toBeLessThan(
            mockedShutdown.mock.invocationCallOrder[0]
        );
        expect(mockedShutdown.mock.invocationCallOrder[0]).toBeLessThan(
            mockedUnlink.mock.invocationCallOrder[0]
        );
    });

    it('still stops Tor when the start in progress fails', async () => {
        mockedStart.mockRejectedValue(new Error('bootstrap failed'));
        const torUtils = loadTorUtils();
        const request = startTor(torUtils).catch(() => {});

        await torUtils.clearTorData();
        await request;

        expect(mockedShutdown).toHaveBeenCalledTimes(1);
        expect(mockedUnlink).toHaveBeenCalledTimes(3);
    });

    describe('when Tor does not respond', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        const expectDeletedAfterTimeout = async (
            torUtils: typeof import('./TorUtils')
        ) => {
            let done = false;
            const clearing = torUtils.clearTorData().then(() => {
                done = true;
            });

            await jest.advanceTimersByTimeAsync(
                torUtils.TOR_STOP_TIMEOUT_MS - 1
            );
            expect(done).toBe(false);
            expect(mockedUnlink).not.toHaveBeenCalled();

            await jest.advanceTimersByTimeAsync(1);
            await clearing;
            expect(mockedUnlink).toHaveBeenCalledTimes(3);
        };

        it('deletes the directories when the shutdown never settles', async () => {
            mockedShutdown.mockReturnValue(new Promise(() => {}));
            const torUtils = loadTorUtils();
            await startTor(torUtils);

            await expectDeletedAfterTimeout(torUtils);
        });

        it('deletes the directories when the start in progress never settles', async () => {
            mockedStart.mockReturnValue(new Promise(() => {}));
            const torUtils = loadTorUtils();
            startTor(torUtils);

            await expectDeletedAfterTimeout(torUtils);
            expect(mockedShutdown).not.toHaveBeenCalled();
        });

        const torDirs = [
            '/docs/tor_data',
            '/cache/sifir_sdk',
            '/tmp/sifir_sdk'
        ];
        const unlinkedDirs = () =>
            mockedUnlink.mock.calls.map((call) => call[0]);

        it('deletes the directories again when the start finishes after the timeout', async () => {
            let finishStart: (started: boolean) => void = () => {};
            mockedStart.mockReturnValue(
                new Promise((resolve, reject) => {
                    finishStart = (started) =>
                        started
                            ? resolve(RUNNING)
                            : reject(new Error('bootstrap failed'));
                })
            );
            const torUtils = loadTorUtils();
            const request = startTor(torUtils);

            await expectDeletedAfterTimeout(torUtils);
            expect(mockedShutdown).not.toHaveBeenCalled();

            finishStart(true);
            await request;
            await jest.advanceTimersByTimeAsync(0);

            expect(mockedShutdown).toHaveBeenCalledTimes(1);
            expect(unlinkedDirs()).toEqual([...torDirs, ...torDirs]);
            expect(mockedShutdown.mock.invocationCallOrder[0]).toBeLessThan(
                mockedUnlink.mock.invocationCallOrder[3]
            );
        });

        it('deletes the directories again when the start fails after the timeout', async () => {
            let finishStart: (started: boolean) => void = () => {};
            mockedStart.mockReturnValue(
                new Promise((resolve, reject) => {
                    finishStart = (started) =>
                        started
                            ? resolve(RUNNING)
                            : reject(new Error('bootstrap failed'));
                })
            );
            const torUtils = loadTorUtils();
            const request = startTor(torUtils).catch(() => {});

            await expectDeletedAfterTimeout(torUtils);

            finishStart(false);
            await request;
            await jest.advanceTimersByTimeAsync(0);

            expect(mockedShutdown).toHaveBeenCalledTimes(1);
            expect(unlinkedDirs()).toEqual([...torDirs, ...torDirs]);
        });

        it('deletes the directories again when the shutdown finishes after the timeout', async () => {
            let finishShutdown: () => void = () => {};
            mockedShutdown.mockReturnValue(
                new Promise<void>((resolve) => {
                    finishShutdown = resolve;
                })
            );
            const torUtils = loadTorUtils();
            await startTor(torUtils);

            await expectDeletedAfterTimeout(torUtils);

            finishShutdown();
            await jest.advanceTimersByTimeAsync(0);

            expect(mockedShutdown).toHaveBeenCalledTimes(1);
            expect(unlinkedDirs()).toEqual([...torDirs, ...torDirs]);
        });

        it('deletes the directories again when the shutdown fails after the timeout', async () => {
            let failShutdown: (reason: Error) => void = () => {};
            mockedShutdown.mockReturnValue(
                new Promise((_resolve, reject) => {
                    failShutdown = reject;
                })
            );
            const torUtils = loadTorUtils();
            await startTor(torUtils);

            await expectDeletedAfterTimeout(torUtils);

            failShutdown(new Error('not running'));
            await jest.advanceTimersByTimeAsync(0);

            expect(unlinkedDirs()).toEqual([...torDirs, ...torDirs]);
        });

        it('deletes the directories once when Tor stops before the timeout', async () => {
            let finishStart: (started: boolean) => void = () => {};
            mockedStart.mockReturnValue(
                new Promise((resolve, reject) => {
                    finishStart = (started) =>
                        started
                            ? resolve(RUNNING)
                            : reject(new Error('bootstrap failed'));
                })
            );
            const torUtils = loadTorUtils();
            const request = startTor(torUtils);
            const clearing = torUtils.clearTorData();

            await jest.advanceTimersByTimeAsync(
                torUtils.TOR_STOP_TIMEOUT_MS - 1
            );
            finishStart(true);
            await clearing;
            await request;
            await jest.advanceTimersByTimeAsync(torUtils.TOR_STOP_TIMEOUT_MS);

            expect(mockedShutdown).toHaveBeenCalledTimes(1);
            expect(unlinkedDirs()).toEqual(torDirs);
        });

        it('deletes the directories once when stopping Tor fails before the timeout', async () => {
            mockedShutdown.mockRejectedValue(new Error('not running'));
            const torUtils = loadTorUtils();
            await startTor(torUtils);

            await torUtils.clearTorData();
            await jest.advanceTimersByTimeAsync(torUtils.TOR_STOP_TIMEOUT_MS);

            expect(unlinkedDirs()).toEqual(torDirs);
        });
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
