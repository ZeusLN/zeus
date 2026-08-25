const store: Record<string, string> = {};
const mockGetItem = jest.fn(async (key: string) => store[key] ?? false);
const mockSetItem = jest.fn(async (key: string, value: any) => {
    store[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return true;
});
const mockRemoveItem = jest.fn(async (key: string) => {
    delete store[key];
    return true;
});

jest.mock('../../storage', () => ({
    __esModule: true,
    default: {
        getItem: (...args: any[]) => (mockGetItem as any)(...args),
        setItem: (...args: any[]) => (mockSetItem as any)(...args),
        removeItem: (...args: any[]) => (mockRemoveItem as any)(...args)
    }
}));

jest.mock('../../zeus_modules/@lightninglabs/lnc-rn', () => ({}));

import LncCredentialStore, { LNC_STORAGE_KEY, hash } from './credentialStore';

const PHRASE = 'abandon ability able about above absent absorb abstract';
const BASE_KEY = `${LNC_STORAGE_KEY}:${hash(PHRASE)}`;
const HOST_KEY = `${BASE_KEY}:host`;

const seed = (value: Record<string, string>) => {
    store[BASE_KEY] = JSON.stringify(value);
};

describe('LNC credentialStore', () => {
    beforeEach(() => {
        for (const key of Object.keys(store)) delete store[key];
        jest.clearAllMocks();
    });

    describe('pairing phrase', () => {
        it('is held in memory without touching storage', () => {
            const credentials = new LncCredentialStore(PHRASE);

            expect(credentials.pairingPhrase).toBe(PHRASE);
            // the setter used to fire an unawaited load(), which raced the
            // awaited load() callers make and could resolve after the
            // connection had already written new keys
            expect(mockGetItem).not.toHaveBeenCalled();
        });
    });

    describe('load', () => {
        it('populates the keys from storage', async () => {
            seed({
                serverHost: '',
                localKey: 'local-abc',
                remoteKey: 'remote-def',
                pairingPhrase: PHRASE
            });

            const credentials = new LncCredentialStore(PHRASE);
            await credentials.load(PHRASE);

            expect(credentials.localKey).toBe('local-abc');
            expect(credentials.remoteKey).toBe('remote-def');
            expect(credentials.isPaired).toBe(true);
        });

        it('prefers the standalone host key over the legacy blob', async () => {
            seed({
                serverHost: 'stale.example.com:443',
                localKey: 'local-abc',
                remoteKey: 'remote-def',
                pairingPhrase: PHRASE
            });
            store[HOST_KEY] = 'lnc.zeusln.app:443';

            const credentials = new LncCredentialStore(PHRASE);
            await credentials.load(PHRASE);

            expect(credentials.serverHost).toBe('lnc.zeusln.app:443');
        });

        it('is a no-op without a pairing phrase', async () => {
            const credentials = new LncCredentialStore();
            await credentials.load(undefined);

            expect(credentials.localKey).toBe('');
            expect(mockGetItem).not.toHaveBeenCalled();
        });
    });

    describe('persistence', () => {
        it('does not write a half-paired session', async () => {
            const credentials = new LncCredentialStore(PHRASE);

            credentials.localKey = 'local-abc';
            await credentials.flushWrites();

            expect(mockSetItem).not.toHaveBeenCalled();
        });

        it('writes both keys once the pairing completes', async () => {
            const credentials = new LncCredentialStore(PHRASE);

            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-def';
            await credentials.flushWrites();

            expect(JSON.parse(store[BASE_KEY])).toMatchObject({
                localKey: 'local-abc',
                remoteKey: 'remote-def',
                pairingPhrase: PHRASE
            });
        });

        it('flushWrites resolves only after the write lands', async () => {
            let release: () => void = () => {};
            mockSetItem.mockImplementationOnce(async (key: string, value) => {
                await new Promise<void>((resolve) => (release = resolve));
                store[key] =
                    typeof value === 'string' ? value : JSON.stringify(value);
                return true;
            });

            const credentials = new LncCredentialStore(PHRASE);
            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-def';

            let flushed = false;
            const flush = credentials.flushWrites().then(() => {
                flushed = true;
            });

            await Promise.resolve();
            expect(flushed).toBe(false);

            release();
            await flush;
            expect(flushed).toBe(true);
            expect(store[BASE_KEY]).toBeDefined();
        });

        it('serializes concurrent writes in order', async () => {
            const credentials = new LncCredentialStore(PHRASE);

            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-1';
            credentials.remoteKey = 'remote-2';
            await credentials.flushWrites();

            const writes = mockSetItem.mock.calls
                .filter((call) => call[0] === BASE_KEY)
                .map((call) => (call[1] as any).remoteKey);
            expect(writes).toEqual(['remote-1', 'remote-2']);
            expect(JSON.parse(store[BASE_KEY]).remoteKey).toBe('remote-2');
        });

        it('reports a dropped write instead of failing silently', async () => {
            const consoleError = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            // keychain accepted the write but nothing came back on read
            mockSetItem.mockImplementationOnce(async () => true);

            const credentials = new LncCredentialStore(PHRASE);
            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-def';

            await expect(credentials.flushWrites()).resolves.toBeUndefined();
            expect(consoleError).toHaveBeenCalledWith(
                'LNC credential store: failed to persist credentials',
                expect.stringContaining('did not persist')
            );

            consoleError.mockRestore();
        });

        it('keeps persisting after a failed write', async () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            mockSetItem.mockImplementationOnce(async () => {
                throw new Error('keychain unavailable');
            });

            const credentials = new LncCredentialStore(PHRASE);
            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-def';
            await credentials.flushWrites();

            credentials.remoteKey = 'remote-ghi';
            await credentials.flushWrites();

            expect(JSON.parse(store[BASE_KEY]).remoteKey).toBe('remote-ghi');
        });
    });

    describe('serverHost', () => {
        it('writes to the standalone host key', async () => {
            const credentials = new LncCredentialStore(PHRASE);

            credentials.serverHost = 'lnc.zeusln.app:443';
            await credentials.flushWrites();

            expect(store[HOST_KEY]).toBe('lnc.zeusln.app:443');
        });

        it('skips a redundant write', async () => {
            const credentials = new LncCredentialStore(PHRASE);

            credentials.serverHost = 'lnc.zeusln.app:443';
            await credentials.flushWrites();
            mockSetItem.mockClear();

            credentials.serverHost = 'lnc.zeusln.app:443';
            await credentials.flushWrites();

            expect(mockSetItem).not.toHaveBeenCalled();
        });
    });

    describe('clear', () => {
        it('removes both storage keys', async () => {
            const credentials = new LncCredentialStore(PHRASE);
            credentials.localKey = 'local-abc';
            credentials.remoteKey = 'remote-def';
            credentials.serverHost = 'lnc.zeusln.app:443';
            await credentials.flushWrites();

            credentials.clear();

            expect(mockRemoveItem).toHaveBeenCalledWith(BASE_KEY);
            expect(mockRemoveItem).toHaveBeenCalledWith(HOST_KEY);
            expect(credentials.localKey).toBe('');
            expect(credentials.remoteKey).toBe('');
            expect(credentials.isPaired).toBe(false);
        });
    });
});
