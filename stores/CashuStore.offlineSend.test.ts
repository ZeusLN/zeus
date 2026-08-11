// In-memory backing for the Storage mock plus a shared call-order log so
// tests can assert persist-before-destroy ordering between Storage writes
// and CashuDevKit.removeProofs.
const mockCallLog: string[] = [];
const mockBacking: Record<string, string> = {};
const mockProofPool: { current: any[] } = { current: [] };

jest.mock('./Stores', () => ({
    activityStore: { getSortedActivity: jest.fn() },
    connectivityStore: {
        isOffline: true,
        onReconnect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn()
    },
    contactStore: {}
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_NOSTR_RELAYS: []
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (key: string) =>
            key in mockBacking ? mockBacking[key] : false
        ),
        setItem: jest.fn(async (key: string, value: any) => {
            mockBacking[key] =
                typeof value === 'string' ? value : JSON.stringify(value);
            mockCallLog.push(`setItem:${key}`);
        }),
        removeItem: jest.fn(async (key: string) => {
            delete mockBacking[key];
        })
    }
}));

jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        getUnspentProofs: jest.fn(async () => [...mockProofPool.current]),
        removeProofs: jest.fn(async (ys: string[]) => {
            mockCallLog.push(`removeProofs:${ys.join(',')}`);
            mockProofPool.current = mockProofPool.current.filter(
                (p) => !ys.includes(p.y)
            );
        }),
        getMintBalance: jest.fn(async () =>
            mockProofPool.current.reduce((sum, p) => sum + p.amount, 0)
        ),
        getBalances: jest.fn(async () => ({})),
        getTotalBalance: jest.fn(async () =>
            mockProofPool.current.reduce((sum, p) => sum + p.amount, 0)
        ),
        send: jest.fn()
    }
}));

jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: class NDK {},
    NDKEvent: class NDKEvent {},
    NDKKind: {}
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fs: { dirs: {} } }
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/MigrationUtils', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('../utils/NostrMintBackup', () => ({
    deriveMintBackupKeypair: jest.fn(),
    backupMintsToNostr: jest.fn(),
    restoreMintsFromNostr: jest.fn()
}));

jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000',
    getUpgradeBackgroundColor: () => '#000'
}));

jest.mock('../NavigationService', () => ({}));

import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';
import CashuStore from './CashuStore';

const mockGetUnspentProofs = CashuDevKit.getUnspentProofs as jest.Mock;
const mockRemoveProofs = CashuDevKit.removeProofs as jest.Mock;
const mockGetMintBalance = CashuDevKit.getMintBalance as jest.Mock;

const NODE_DIR = 'testnode';
const MINT_URL = 'https://mint.example.com';
const PENDING_KEY = `${NODE_DIR}-cashu-pending-offline-sends`;
const SENT_KEY = `${NODE_DIR}-cashu-sent-tokens`;

const proof = (amount: number, tag: string) => ({
    amount,
    secret: `secret-${tag}`,
    c: `c-${tag}`,
    keyset_id: 'keyset-1',
    y: `y-${tag}`
});

function buildStore() {
    const settingsStore: any = {
        lndDir: NODE_DIR,
        implementation: 'embedded-lnd'
    };
    const store = new CashuStore(
        settingsStore,
        {} as any,
        {} as any,
        {} as any
    );
    store.cdkInitialized = true;
    store.selectedMintUrl = MINT_URL;
    store.sentTokens = [];
    return store;
}

const getPendingRecords = () =>
    PENDING_KEY in mockBacking ? JSON.parse(mockBacking[PENDING_KEY]) : [];
const getSentTokens = () =>
    SENT_KEY in mockBacking ? JSON.parse(mockBacking[SENT_KEY]) : [];

describe('CashuStore offline send safety', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCallLog.length = 0;
        for (const key of Object.keys(mockBacking)) delete mockBacking[key];
        mockProofPool.current = [];
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    describe('sendTokenCDK offline path', () => {
        it('persists the pending record before deleting proofs', async () => {
            mockProofPool.current = [proof(16, 'a')];
            const store = buildStore();

            const token = await store.sendTokenCDK(MINT_URL, 16);

            const pendingWrite = mockCallLog.indexOf(`setItem:${PENDING_KEY}`);
            const proofRemoval = mockCallLog.findIndex((entry) =>
                entry.startsWith('removeProofs:')
            );
            expect(pendingWrite).toBeGreaterThanOrEqual(0);
            expect(proofRemoval).toBeGreaterThanOrEqual(0);
            expect(pendingWrite).toBeLessThan(proofRemoval);

            // The record written before removal carries everything needed
            // for recovery: the encoded token and the proofs with y values.
            expect(token.encoded.startsWith('cashuA')).toBe(true);
            const [record] = getPendingRecords();
            expect(record.encodedToken).toBe(token.encoded);
            expect(record.mintUrl).toBe(MINT_URL);
            expect(record.value).toBe(16);
            expect(record.proofs.map((p: any) => p.y)).toEqual(['y-a']);
        });

        it('greedily selects largest proofs first and reports overpay total', async () => {
            mockProofPool.current = [proof(4, 'a'), proof(16, 'b')];
            const store = buildStore();

            const token = await store.sendTokenCDK(MINT_URL, 8);

            expect(token.value).toBe(16);
            expect(mockRemoveProofs).toHaveBeenCalledWith(['y-b']);
        });

        it('throws on insufficient proofs without touching storage or proofs', async () => {
            mockProofPool.current = [proof(4, 'a')];
            const store = buildStore();

            await expect(store.sendTokenCDK(MINT_URL, 8)).rejects.toThrow(
                'Insufficient proofs'
            );
            expect(getPendingRecords()).toEqual([]);
            expect(mockRemoveProofs).not.toHaveBeenCalled();
        });

        it('serializes concurrent offline sends so proofs are never double-selected', async () => {
            mockProofPool.current = [proof(16, 'a'), proof(16, 'b')];
            const store = buildStore();

            const [tokenA, tokenB] = await Promise.all([
                store.sendTokenCDK(MINT_URL, 16),
                store.sendTokenCDK(MINT_URL, 16)
            ]);

            const removals = mockRemoveProofs.mock.calls.map(
                (call) => call[0] as string[]
            );
            expect(removals).toHaveLength(2);
            expect(new Set(removals.flat()).size).toBe(2);
            expect(tokenA.encoded).not.toBe(tokenB.encoded);
        });

        it('fails the second concurrent send when the pool is exhausted', async () => {
            mockProofPool.current = [proof(16, 'a')];
            const store = buildStore();

            const results = await Promise.allSettled([
                store.sendTokenCDK(MINT_URL, 16),
                store.sendTokenCDK(MINT_URL, 16)
            ]);

            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('rejected');
            expect(mockRemoveProofs).toHaveBeenCalledTimes(1);
        });
    });

    describe('mintToken', () => {
        it('clears the pending record only after the sent token is persisted', async () => {
            mockProofPool.current = [proof(16, 'a')];
            const store = buildStore();

            const result = await store.mintToken({ memo: '', value: '16' });

            expect(result).toBeDefined();
            expect(getSentTokens()).toHaveLength(1);
            expect(getSentTokens()[0].encodedToken).toBe(result!.token);
            expect(getPendingRecords()).toEqual([]);

            const sentWrite = mockCallLog.indexOf(`setItem:${SENT_KEY}`);
            const finalizeWrite = mockCallLog.lastIndexOf(
                `setItem:${PENDING_KEY}`
            );
            expect(sentWrite).toBeGreaterThanOrEqual(0);
            expect(finalizeWrite).toBeGreaterThan(sentWrite);
        });

        it('refuses re-entry while a send is already in flight', async () => {
            mockProofPool.current = [proof(16, 'a')];
            const store = buildStore();
            store.mintingToken = true;

            const result = await store.mintToken({ memo: '', value: '16' });

            expect(result).toBeUndefined();
            expect(mockGetMintBalance).not.toHaveBeenCalled();
            expect(mockRemoveProofs).not.toHaveBeenCalled();
        });
    });

    describe('reconcilePendingOfflineSends', () => {
        const seedPendingRecord = (
            proofs: any[],
            encodedToken = 'cashuAtest'
        ) => {
            mockBacking[PENDING_KEY] = JSON.stringify([
                {
                    id: 'r1',
                    mintUrl: MINT_URL,
                    encodedToken,
                    value: proofs.reduce((sum, p) => sum + p.amount, 0),
                    memo: '',
                    createdAt: 1754900000000,
                    proofs
                }
            ]);
        };

        it('drops the record when all proofs survived (crash before removal)', async () => {
            const proofs = [proof(16, 'a'), proof(8, 'b')];
            mockProofPool.current = [...proofs];
            seedPendingRecord(proofs);
            const store = buildStore();

            await store.reconcilePendingOfflineSends();

            expect(getPendingRecords()).toEqual([]);
            expect(store.sentTokens).toHaveLength(0);
            expect(mockRemoveProofs).not.toHaveBeenCalled();
        });

        it('promotes the token when all proofs are gone (crash before persist)', async () => {
            const proofs = [proof(16, 'a')];
            mockProofPool.current = [];
            seedPendingRecord(proofs);
            const store = buildStore();

            await store.reconcilePendingOfflineSends();

            expect(getPendingRecords()).toEqual([]);
            expect(store.sentTokens).toHaveLength(1);
            const promoted = store.sentTokens![0];
            expect(promoted.encodedToken).toBe('cashuAtest');
            expect(promoted.sent).toBe(true);
            expect(promoted.spent).toBe(false);
            expect(getSentTokens()).toHaveLength(1);
            expect(mockRemoveProofs).not.toHaveBeenCalled();
        });

        it('removes leftover proofs before promoting on partial deletion', async () => {
            const proofs = [proof(16, 'a'), proof(8, 'b')];
            mockProofPool.current = [proof(8, 'b')];
            seedPendingRecord(proofs);
            const store = buildStore();

            await store.reconcilePendingOfflineSends();

            expect(mockRemoveProofs).toHaveBeenCalledWith(['y-b']);
            expect(store.sentTokens).toHaveLength(1);
            expect(getPendingRecords()).toEqual([]);
        });

        it('does not duplicate a token already recorded in sentTokens', async () => {
            const proofs = [proof(16, 'a')];
            mockProofPool.current = [];
            seedPendingRecord(proofs, 'cashuAdup');
            const store = buildStore();
            store.sentTokens = [{ encodedToken: 'cashuAdup' } as any];

            await store.reconcilePendingOfflineSends();

            expect(store.sentTokens).toHaveLength(1);
            expect(getPendingRecords()).toEqual([]);
        });

        it('keeps the record for retry when the proof lookup fails', async () => {
            const proofs = [proof(16, 'a')];
            seedPendingRecord(proofs);
            mockGetUnspentProofs.mockRejectedValueOnce(new Error('db error'));
            const store = buildStore();

            await store.reconcilePendingOfflineSends();

            const records = getPendingRecords();
            expect(records).toHaveLength(1);
            expect(records[0].attempts).toBe(1);
            expect(store.sentTokens).toHaveLength(0);
        });

        it('is a no-op when CDK is not initialized', async () => {
            seedPendingRecord([proof(16, 'a')]);
            const store = buildStore();
            store.cdkInitialized = false;

            await store.reconcilePendingOfflineSends();

            expect(getPendingRecords()).toHaveLength(1);
            expect(Storage.getItem).not.toHaveBeenCalled();
        });
    });
});
