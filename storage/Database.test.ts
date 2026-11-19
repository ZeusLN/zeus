// In-memory file system for the paths Database.ts touches
const mockFiles = new Set<string>();
// Switches for failure cases, and a count of connections closed
const mockFaults = {
    plaintext: false,
    transaction: false,
    closes: 0,
    // SQL that should throw when executed on a keyed connection
    failSql: null as string | null,
    // every statement executed on a keyed connection, in order
    sql: [] as string[]
};
jest.mock('react-native-fs', () => ({
    __esModule: true,
    default: {
        DocumentDirectoryPath: '/docs',
        LibraryDirectoryPath: '/library',
        exists: jest.fn(async (p: string) =>
            [...mockFiles].some((f) => f === p || f.startsWith(p + '/'))
        ),
        mkdir: jest.fn(async () => undefined),
        unlink: jest.fn(async (p: string) => {
            for (const f of [...mockFiles]) {
                if (f === p || f.startsWith(p + '/')) mockFiles.delete(f);
            }
        }),
        moveFile: jest.fn(async (from: string, to: string) => {
            mockFiles.delete(from);
            mockFiles.add(to);
            const entry = mockDbs.get(from);
            if (entry) {
                mockDbs.delete(from);
                mockDbs.set(to, entry);
            }
        })
    }
}));

const mockPlatform = { OS: 'ios' };
jest.mock('react-native', () => ({
    get Platform() {
        return mockPlatform;
    }
}));

// Each database file remembers the key that created it. Opening with any
// other key fails the way SQLCipher does.
const mockDbs = new Map<string, { key?: string; sqlite: any }>();
jest.mock('@op-engineering/op-sqlite', () => ({
    open: jest.fn(
        ({
            name,
            location,
            encryptionKey
        }: {
            name: string;
            location: string;
            encryptionKey?: string;
        }) => {
            const path = `${location}/${name}`;
            let entry = mockDbs.get(path);
            if (!entry) {
                entry = {
                    key: encryptionKey,
                    sqlite: require('./testing/nodeSqliteDb').makeNodeSqliteDb()
                };
                mockDbs.set(path, entry);
                mockFiles.add(path);
            }
            // An unkeyed open reads the file only if it is plaintext
            const wrongKey = encryptionKey
                ? entry.key !== encryptionKey
                : !mockFaults.plaintext;
            const { sqlite } = entry;
            let closed = false;
            const guard = () => {
                if (closed) throw new Error('closed');
                if (wrongKey) throw new Error('file is not a database');
            };
            return {
                execute: async (sql: string, params?: any[]) => {
                    guard();
                    if (encryptionKey) {
                        mockFaults.sql.push(sql);
                        if (sql === mockFaults.failSql) {
                            throw new Error('disk I/O error');
                        }
                    }
                    return sqlite.execute(sql, params);
                },
                transaction: async (fn: any) => {
                    guard();
                    if (mockFaults.transaction) throw new Error('disk full');
                    return sqlite.transaction(fn);
                },
                close: jest.fn(() => {
                    closed = true;
                    mockFaults.closes++;
                })
            };
        }
    )
}));

// Keychain stand-in that can be made to fail
const mockKeychain = new Map<string, string>();
const mockKeychainFails = { read: false };
jest.mock('./index', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async (k: string) => {
            if (mockKeychainFails.read) throw new Error('mockKeychain locked');
            return mockKeychain.has(k) ? mockKeychain.get(k) : false;
        }),
        setItem: jest.fn(async (k: string, v: string) => {
            mockKeychain.set(k, v);
            return true;
        }),
        removeItem: jest.fn(async (k: string) => {
            mockKeychain.delete(k);
            return true;
        })
    }
}));

import RNFS from 'react-native-fs';
import { open } from '@op-engineering/op-sqlite';
import {
    DB_KEY_STORAGE_KEY,
    __resetDatabaseForTests,
    getDatabase,
    wipeDatabase
} from './Database';

const IOS_DIR = '/library/Application Support/zeus-db';
const DB_PATH = `${IOS_DIR}/zeus.db`;

// A fresh process: forgets the open handle but keeps mockFiles and mockKeychain
const newSession = () => __resetDatabaseForTests();

describe('Database', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
        mockFiles.clear();
        mockDbs.clear();
        mockKeychain.clear();
        mockKeychainFails.read = false;
        mockFaults.plaintext = false;
        mockFaults.transaction = false;
        mockFaults.closes = 0;
        mockFaults.failSql = null;
        mockFaults.sql = [];
        mockPlatform.OS = 'ios';
        newSession();
        jest.clearAllMocks();
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => warn.mockRestore());

    it('creates the database with a new 256-bit key and the schema', async () => {
        const db = await getDatabase();

        const key = mockKeychain.get(DB_KEY_STORAGE_KEY)!;
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(open).toHaveBeenCalledWith({
            name: 'zeus.db',
            location: IOS_DIR,
            encryptionKey: `x'${key}'`
        });
        expect(
            (await db!.execute('PRAGMA user_version')).rows[0].user_version
        ).toBe(1);
        const tables = await db!.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        );
        expect(tables.rows.map((r: any) => r.name)).toEqual([
            'lnurlpay_metadata',
            'lnurlpay_tx'
        ]);
    });

    it('excludes the iOS directory from backups', async () => {
        await getDatabase();

        expect(RNFS.mkdir).toHaveBeenCalledWith(IOS_DIR, {
            NSURLIsExcludedFromBackupKey: true
        });
    });

    it('keeps the Android database in app-private files', async () => {
        mockPlatform.OS = 'android';

        await getDatabase();

        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ location: '/docs/zeus-db' })
        );
        expect(RNFS.mkdir).toHaveBeenCalledWith('/docs/zeus-db', {});
    });

    it('reopens an existing database with its key in a later session', async () => {
        const first = await getDatabase();
        await first!.execute(
            "INSERT INTO lnurlpay_metadata VALUES ('m', 'meta', 1)"
        );
        const key = mockKeychain.get(DB_KEY_STORAGE_KEY);

        newSession();
        const second = await getDatabase();

        expect(mockKeychain.get(DB_KEY_STORAGE_KEY)).toBe(key);
        expect(
            (await second!.execute('SELECT metadata FROM lnurlpay_metadata'))
                .rows
        ).toEqual([{ metadata: 'meta' }]);
    });

    it('never reuses a key left behind when the database file is gone', async () => {
        mockKeychain.set(DB_KEY_STORAGE_KEY, 'a'.repeat(64));

        await getDatabase();

        const key = mockKeychain.get(DB_KEY_STORAGE_KEY);
        expect(key).not.toBe('a'.repeat(64));
        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ encryptionKey: `x'${key}'` })
        );
    });

    it('moves a database aside and starts over when its key is gone', async () => {
        await getDatabase();
        newSession();
        mockKeychain.delete(DB_KEY_STORAGE_KEY);

        const db = await getDatabase();

        expect(mockFiles.has(`${IOS_DIR}/zeus.db.unreadable`)).toBe(true);
        expect(mockFiles.has(DB_PATH)).toBe(true);
        expect(db).not.toBeNull();
        expect(mockKeychain.get(DB_KEY_STORAGE_KEY)).toMatch(/^[0-9a-f]{64}$/);
    });

    it('moves a database aside when its key does not open it', async () => {
        await getDatabase();
        newSession();
        mockKeychain.set(DB_KEY_STORAGE_KEY, 'b'.repeat(64));

        const db = await getDatabase();

        expect(mockFiles.has(`${IOS_DIR}/zeus.db.unreadable`)).toBe(true);
        expect(db).not.toBeNull();
        expect(mockKeychain.get(DB_KEY_STORAGE_KEY)).not.toBe('b'.repeat(64));
    });

    it('leaves the database alone when the key cannot be read', async () => {
        await getDatabase();
        const key = mockKeychain.get(DB_KEY_STORAGE_KEY);
        newSession();
        mockKeychainFails.read = true;

        await expect(getDatabase()).resolves.toBeNull();

        expect(mockFiles.has(`${IOS_DIR}/zeus.db.unreadable`)).toBe(false);
        expect(mockKeychain.get(DB_KEY_STORAGE_KEY)).toBe(key);
    });

    it('leaves the database alone when opening fails for another reason', async () => {
        await getDatabase();
        newSession();
        (open as jest.Mock).mockImplementationOnce(() => {
            throw new Error('disk I/O error');
        });

        await expect(getDatabase()).resolves.toBeNull();

        expect(mockFiles.has(`${IOS_DIR}/zeus.db.unreadable`)).toBe(false);
    });

    it('tries again after a failed open', async () => {
        mockKeychainFails.read = true;
        await getDatabase();
        newSession();
        await getDatabase(); // fresh install path never reads the key
        newSession();
        mockKeychainFails.read = true;
        await expect(getDatabase()).resolves.toBeNull();

        mockKeychainFails.read = false;

        await expect(getDatabase()).resolves.not.toBeNull();
    });

    it('deletes the database and key on wipe and refuses to reopen', async () => {
        await getDatabase();

        await wipeDatabase();

        expect(mockFiles.size).toBe(0);
        expect(mockKeychain.has(DB_KEY_STORAGE_KEY)).toBe(false);
        await expect(getDatabase()).resolves.toBeNull();
        expect(mockFiles.size).toBe(0);
    });

    it('refuses and deletes a database file that is not encrypted', async () => {
        mockFaults.plaintext = true;

        await expect(getDatabase()).resolves.toBeNull();

        expect(mockFiles.has(DB_PATH)).toBe(false);
        // the unkeyed probe and the database itself
        expect(mockFaults.closes).toBe(2);
        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ readOnly: true })
        );
    });

    it('closes the connection when the schema step fails', async () => {
        mockFaults.transaction = true;

        await expect(getDatabase()).resolves.toBeNull();
        expect(mockFaults.closes).toBe(1);

        newSession();
        mockFaults.transaction = false;
        await expect(getDatabase()).resolves.not.toBeNull();
    });

    it('closes an existing database whose schema step fails, and keeps it', async () => {
        await getDatabase();
        newSession();
        mockFaults.closes = 0;
        mockFaults.transaction = true;
        // a database still on the previous schema version
        const entry = mockDbs.get(DB_PATH)!;
        await entry.sqlite.execute('PRAGMA user_version = 0');

        await expect(getDatabase()).resolves.toBeNull();

        expect(mockFaults.closes).toBe(1);
        expect(mockFiles.has(DB_PATH)).toBe(true);
        expect(mockFiles.has(`${IOS_DIR}/zeus.db.unreadable`)).toBe(false);
    });

    it('switches to WAL with synchronous NORMAL on every open', async () => {
        const first = await getDatabase();

        expect(mockFaults.sql).toContain('PRAGMA journal_mode = WAL');
        expect(
            (await first!.execute('PRAGMA synchronous')).rows[0].synchronous
        ).toBe(1);

        // synchronous is per connection, so a later session sets it again
        newSession();
        mockFaults.sql = [];
        const second = await getDatabase();
        expect(mockFaults.sql).toContain('PRAGMA synchronous = NORMAL');
        expect(
            (await second!.execute('PRAGMA synchronous')).rows[0].synchronous
        ).toBe(1);
    });

    it('sets the journal mode only after the schema and the encryption check', async () => {
        await getDatabase();

        const wal = mockFaults.sql.indexOf('PRAGMA journal_mode = WAL');
        expect(wal).toBeGreaterThan(
            mockFaults.sql.indexOf('PRAGMA user_version')
        );
        // the unkeyed probe ran first and found the file encrypted
        expect(open).toHaveBeenCalledWith(
            expect.objectContaining({ readOnly: true })
        );
    });

    it('stays usable with the default journal when WAL cannot be enabled', async () => {
        mockFaults.failSql = 'PRAGMA journal_mode = WAL';

        const db = await getDatabase();

        expect(db).not.toBeNull();
        expect(
            (await db!.execute('SELECT count(*) AS n FROM lnurlpay_tx')).rows[0]
                .n
        ).toBe(0);
        expect(warn).toHaveBeenCalledWith(
            '[Database] Could not enable WAL',
            expect.any(Error)
        );
    });

    it('never changes the journal of a file that is not encrypted', async () => {
        mockFaults.plaintext = true;

        await expect(getDatabase()).resolves.toBeNull();

        expect(mockFaults.sql).not.toContain('PRAGMA journal_mode = WAL');
    });
});
