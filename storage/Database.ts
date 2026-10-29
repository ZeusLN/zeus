import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { open } from '@op-engineering/op-sqlite';
import type { DB } from '@op-engineering/op-sqlite';

import Storage from './index';

/**
 * Encrypted SQLite store for app data that does not belong in the keychain
 * (#4471). The database is encrypted with SQLCipher under a random 256-bit
 * key; only that key lives in the keychain, so opening the database costs
 * one keystore read however much data it holds. Credentials and seeds stay
 * in the keychain.
 *
 * Rules this module enforces:
 * - A new database always gets a new key. A key left in the keychain by an
 *   earlier install (iOS keeps keychain items across uninstall) is never
 *   reused, so a key can only ever open the database it was created with.
 * - A database whose key is gone, or that the key does not open, is moved
 *   aside and replaced. Callers keep their keychain fallback, so nothing they
 *   need is only in the database while this is the case.
 * - A keychain read that fails is not a missing key. The database is left
 *   alone and reported unavailable for now, and callers fall back to the
 *   keychain. Treating a locked or failing keychain as "no key" would
 *   replace a good database.
 */

export const DB_KEY_STORAGE_KEY = 'zeus-db-key-v1';
export const DB_NAME = 'zeus.db';
// The previous unreadable database, kept for diagnosis until the next one
export const UNREADABLE_DB_NAME = 'zeus.db.unreadable';
// Table shape, versioned with PRAGMA user_version. Separate from the
// settings blob's settingsVersion, which versions document content.
export const SCHEMA_VERSION = 1;

const SIDECARS = ['', '-wal', '-shm', '-journal'];

const MIGRATIONS: Array<{ toVersion: number; statements: string[] }> = [
    {
        toVersion: 1,
        statements: [
            `CREATE TABLE IF NOT EXISTS lnurlpay_tx (
                payment_hash TEXT PRIMARY KEY NOT NULL,
                domain TEXT,
                lnurl TEXT,
                metadata_hash TEXT,
                success_action TEXT,
                time INTEGER
            )`,
            `CREATE TABLE IF NOT EXISTS lnurlpay_metadata (
                metadata_hash TEXT PRIMARY KEY NOT NULL,
                metadata TEXT NOT NULL,
                last_stored INTEGER NOT NULL
            )`
        ]
    }
];

/**
 * Directory holding the database and its sidecar files. On iOS it sits in
 * Application Support and is excluded from backups as a whole, which covers
 * the -wal and -shm files too: a backed-up copy could never be opened
 * without this device's key. Android keeps it in app-private files, and the
 * manifest already disables backup.
 */
export const getDatabaseDirectory = (): string =>
    Platform.OS === 'ios'
        ? `${RNFS.LibraryDirectoryPath}/Application Support/zeus-db`
        : `${RNFS.DocumentDirectoryPath}/zeus-db`;

const toKeyPragma = (hexKey: string) => `x'${hexKey}'`;

// SQLCipher reports a wrong key as SQLITE_NOTADB, "file is not a database"
const isWrongKeyError = (e: unknown) =>
    /file is not a database|SQLITE_NOTADB|file is encrypted/i.test(
        String((e as any)?.message ?? e)
    );

let openPromise: Promise<DB | null> | null = null;
let db: DB | null = null;
let blocked = false;

const ensureDirectory = async (dir: string) => {
    await RNFS.mkdir(
        dir,
        Platform.OS === 'ios' ? { NSURLIsExcludedFromBackupKey: true } : {}
    );
};

const unlinkIfExists = async (path: string) => {
    if (await RNFS.exists(path)) await RNFS.unlink(path);
};

/** Replace the previous unreadable copy with the current database. */
const moveAside = async (dir: string) => {
    for (const suffix of SIDECARS) {
        await unlinkIfExists(`${dir}/${UNREADABLE_DB_NAME}${suffix}`);
    }
    for (const suffix of SIDECARS) {
        const from = `${dir}/${DB_NAME}${suffix}`;
        if (await RNFS.exists(from)) {
            await RNFS.moveFile(from, `${dir}/${UNREADABLE_DB_NAME}${suffix}`);
        }
    }
};

/** Generate a key, store it and read it back before any database uses it. */
const createKey = async (): Promise<string> => {
    // crypto.getRandomValues is provided by react-native-get-random-values
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const key = Buffer.from(bytes).toString('hex');
    await Storage.setItem(DB_KEY_STORAGE_KEY, key);
    const stored = await Storage.getItem(DB_KEY_STORAGE_KEY);
    if (stored !== key) {
        throw new Error('Database key did not persist');
    }
    return key;
};

export const migrate = async (database: DB) => {
    const result = await database.execute('PRAGMA user_version');
    const current = Number(result.rows?.[0]?.user_version ?? 0);
    for (const { toVersion, statements } of MIGRATIONS) {
        if (current >= toVersion) continue;
        await database.transaction(async (tx) => {
            for (const statement of statements) {
                await tx.execute(statement);
            }
            await tx.execute(`PRAGMA user_version = ${toVersion}`);
        });
    }
};

/** Opens the database and proves the key decrypts it. */
const openWithKey = async (dir: string, key: string): Promise<DB> => {
    const database = open({
        name: DB_NAME,
        location: dir,
        encryptionKey: toKeyPragma(key)
    });
    try {
        // Fails with "file is not a database" when the key does not match
        await database.execute('SELECT count(*) FROM sqlite_master');
        return database;
    } catch (e) {
        database.close();
        throw e;
    }
};

const deleteDatabaseFiles = async (dir: string) => {
    for (const suffix of SIDECARS) {
        await unlinkIfExists(`${dir}/${DB_NAME}${suffix}`);
    }
};

/**
 * Whether the file is unreadable without its key. Opens it a second time,
 * read-only and with no key: SQLCipher encrypts every page, so the query
 * fails ("file is not a database") unless the key was never applied.
 * Nothing in op-sqlite 18.2.5 skips the key, but a later version that did
 * would otherwise store payment data unencrypted. (RNFS.read cannot do this
 * check: it fails on iOS under the New Architecture.)
 */
const isEncrypted = async (dir: string): Promise<boolean> => {
    let probe: DB;
    try {
        probe = open({ name: DB_NAME, location: dir, readOnly: true });
    } catch (e) {
        return isWrongKeyError(e);
    }
    try {
        await probe.execute('SELECT count(*) FROM sqlite_master');
        return false;
    } catch (e) {
        return isWrongKeyError(e);
    } finally {
        probe.close();
    }
};

/**
 * WAL with synchronous=NORMAL. A commit appends to the -wal file instead of
 * rewriting pages in place behind a rollback journal, and syncs only when
 * the log is copied back (a checkpoint). In the #4471 benchmark this made
 * single-row writes 4 to 7 times faster (Android emulator: 4.3 ms to
 * 0.6 ms). An app crash loses no committed data; a power loss can lose the
 * last commits since a checkpoint but does not corrupt the file.
 *
 * journal_mode is stored in the file, synchronous only lasts for the
 * connection, so both are set on every open. If WAL cannot be enabled the
 * database keeps the default rollback journal, which still works.
 */
const enableWal = async (database: DB) => {
    try {
        const result = await database.execute('PRAGMA journal_mode = WAL');
        const mode = result.rows?.[0]?.journal_mode;
        if (mode !== 'wal') {
            console.warn(`[Database] journal_mode is ${mode}, not wal`);
        }
        await database.execute('PRAGMA synchronous = NORMAL');
    } catch (e) {
        console.warn('[Database] Could not enable WAL', e);
    }
};

/**
 * Bring an open database up to date, confirm it is encrypted, then switch
 * it to WAL. On any failure before that the connection is closed; a
 * plaintext file is also deleted.
 */
const prepare = async (dir: string, database: DB): Promise<DB> => {
    try {
        await migrate(database);
    } catch (e) {
        database.close();
        throw e;
    }
    if (!(await isEncrypted(dir))) {
        database.close();
        await deleteDatabaseFiles(dir);
        throw new Error('Database file is not encrypted');
    }
    await enableWal(database);
    return database;
};

const openDatabase = async (): Promise<DB | null> => {
    const dir = getDatabaseDirectory();
    await ensureDirectory(dir);
    const exists = await RNFS.exists(`${dir}/${DB_NAME}`);

    let key: string | false;
    try {
        key = exists ? await Storage.getItem(DB_KEY_STORAGE_KEY) : false;
    } catch (e) {
        console.warn('[Database] Key read failed, database unavailable', e);
        return null;
    }

    if (exists && key) {
        try {
            return await prepare(dir, await openWithKey(dir, key));
        } catch (e) {
            // Only a key that does not decrypt the file justifies replacing
            // it. Any other failure (I/O, a busy file) leaves the database
            // in place for the next attempt.
            if (!isWrongKeyError(e)) {
                console.warn('[Database] Open failed, unavailable', e);
                return null;
            }
            console.warn('[Database] Key does not open the database', e);
        }
    }

    // No database yet, its key is gone, or the key does not open it
    if (exists) await moveAside(dir);
    const freshKey = await createKey();
    return prepare(dir, await openWithKey(dir, freshKey));
};

/**
 * The shared database, or null if it cannot be used right now. A failed
 * open is not cached, so the next call tries again (for example once the
 * keychain is readable).
 */
export const getDatabase = async (): Promise<DB | null> => {
    if (blocked) return null;
    if (db) return db;
    if (!openPromise) {
        openPromise = openDatabase()
            .then((database) => {
                if (blocked) {
                    database?.close();
                    return null;
                }
                db = database;
                return database;
            })
            .catch((e) => {
                console.warn('[Database] Unavailable', e);
                return null;
            })
            .finally(() => {
                openPromise = null;
            });
    }
    return openPromise;
};

/**
 * Close and delete the database and its key, and refuse to reopen it for
 * the rest of this JS context. Used by Clear All Data and the duress wipe,
 * which restart the app afterwards. The key itself is also listed in
 * DataClearUtils' STORAGE_KEYS, so it is cleared there in every location.
 */
export const wipeDatabase = async (): Promise<void> => {
    blocked = true;
    if (openPromise) await openPromise;
    if (db) {
        try {
            db.close();
        } catch (e) {
            console.warn('[Database] Close failed during wipe', e);
        }
        db = null;
    }
    const dir = getDatabaseDirectory();
    if (await RNFS.exists(dir)) await RNFS.unlink(dir);
    await Storage.removeItem(DB_KEY_STORAGE_KEY);
};

/** Test-only: forget the open database and lift the wipe block. */
export const __resetDatabaseForTests = () => {
    db = null;
    openPromise = null;
    blocked = false;
};
