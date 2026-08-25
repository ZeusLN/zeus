import Storage from '../../storage';
import { CredentialStore } from '../../zeus_modules/@lightninglabs/lnc-rn';
import hashjs from 'hash.js';

const LNC_STORAGE_KEY = 'lnc-rn';

const hash = (stringToHash: string) =>
    hashjs.sha256().update(stringToHash).digest('hex');

/**
 * A wrapper around `Storage` used to store sensitive data required
 * by LNC to reconnect after the initial pairing process has been completed.
 */
export default class LncCredentialStore implements CredentialStore {
    // the data to store in Storage
    private persisted = {
        serverHost: '',
        localKey: '',
        remoteKey: '',
        pairingPhrase: ''
    };
    // the decrypted credentials in plain text. these fields are separate from the
    // persisted encrypted fields in order to be able to set the password at any
    // time. we may have plain text values that we need to hold onto until the
    // password is set, or may load encrypted values that we delay decrypting until
    // the password is provided.
    private _localKey = '';
    private _remoteKey = '';
    private _pairingPhrase = '';

    // Serializes every keychain write and gives callers something to await.
    // Writes are triggered from property setters (which cannot be async) that
    // the LNC bridge drives from native callbacks, so without this a wallet
    // switch could tear the store down mid-write. Losing localKey/remoteKey is
    // unrecoverable: an LNC pairing phrase is single use, so a wallet whose
    // keys never landed can never reconnect and has to be re-paired.
    private writeQueue: Promise<void> = Promise.resolve();

    /**
     * Constructs a new `LncCredentialStore` instance
     */
    constructor(pairingPhrase?: string) {
        if (pairingPhrase) this.pairingPhrase = pairingPhrase;
    }

    async initialize() {
        if (this._pairingPhrase) {
            await this._migrateServerHost();
        }
        return this;
    }

    private async _migrateServerHost() {
        try {
            const baseKey = `${LNC_STORAGE_KEY}:${hash(this._pairingPhrase)}`;
            const hostKey = `${baseKey}:host`;
            const hasNewFormat = await Storage.getItem(hostKey);

            // Only migrate if new format doesn't exist yet
            if (!hasNewFormat) {
                const oldData = await Storage.getItem(baseKey);

                if (oldData) {
                    const parsed = JSON.parse(oldData);
                    if (parsed.serverHost) {
                        await Storage.setItem(hostKey, parsed.serverHost);

                        // Remove serverHost from old format
                        delete parsed.serverHost;
                        await Storage.setItem(baseKey, parsed);
                    }
                }
            }
        } catch (error) {
            console.log('Migration failed:', error);
            throw new Error(`Migration failed: ${(error as Error).message}`);
        }
    }

    //
    // Public fields which implement the `CredentialStore` interface
    //

    /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
    get serverHost() {
        return this.persisted.serverHost;
    }

    /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
    set serverHost(host: string) {
        if (this.persisted.serverHost === host) return;
        this.persisted.serverHost = host;
        this._saveServerHost();
    }

    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    get pairingPhrase() {
        return this._pairingPhrase;
    }

    /**
     * Stores the LNC pairing phrase used to initialize the connection to the LNC proxy.
     *
     * In-memory only: the setter used to kick off an unawaited `load()`, which
     * raced the awaited `load()` callers make and could resolve after the
     * connection had already written new keys. Callers must `await load()`.
     */
    set pairingPhrase(phrase: string) {
        this._pairingPhrase = phrase;
        this.persisted.pairingPhrase = phrase;
    }

    /** Stores the local private key which LNC uses to reestablish a connection */
    get localKey() {
        return this._localKey;
    }

    /** Stores the local private key which LNC uses to reestablish a connection */
    set localKey(key: string) {
        this._localKey = key;
        this.persisted.localKey = key;
        this._save();
    }

    /** Stores the remote static key which LNC uses to reestablish a connection */
    get remoteKey() {
        return this._remoteKey;
    }

    /** Stores the remote static key which LNC uses to reestablish a connection */
    set remoteKey(key: string) {
        this._remoteKey = key;
        this.persisted.remoteKey = key;
        this._save();
    }

    /**
     * Read-only field which should return `true` if the client app has prior
     * credentials persisted in teh store
     */
    get isPaired() {
        return !!this.persisted.remoteKey || !!this.persisted.pairingPhrase;
    }

    /** Clears any persisted data in the store */
    clear() {
        const baseKey = `${LNC_STORAGE_KEY}:${hash(this._pairingPhrase)}`;
        Storage.removeItem(baseKey);
        Storage.removeItem(`${baseKey}:host`);
        this.persisted = {
            serverHost: this.persisted.serverHost,
            localKey: '',
            remoteKey: '',
            pairingPhrase: ''
        };
        this._localKey = '';
        this._remoteKey = '';
        this._pairingPhrase = '';
    }

    /** Loads persisted data from Storage */
    async load(pairingPhrase?: string) {
        // only load if pairingPhrase is set
        if (!pairingPhrase) return;
        try {
            const baseKey = `${LNC_STORAGE_KEY}:${hash(pairingPhrase)}`;
            const hostKey = `${baseKey}:host`;
            const json = await Storage.getItem(baseKey);
            const serverHost = await Storage.getItem(hostKey);
            if (json) {
                this.persisted = JSON.parse(json);
                if (serverHost) {
                    this.persisted.serverHost = serverHost;
                }
                this._localKey = this.persisted.localKey;
                this._remoteKey = this.persisted.remoteKey;
            }
            return;
        } catch (error) {
            const msg = (error as Error).message;
            throw new Error(`Failed to load secure data: ${msg}`);
        }
    }

    /**
     * Resolves once every write queued so far has hit the keychain. Callers
     * tearing this store down (wallet switch, reconnect) must await it so a
     * freshly paired wallet's keys are not dropped on the floor.
     */
    async flushWrites() {
        await this.writeQueue;
    }

    //
    // Private functions only used internally
    //

    private _saveServerHost() {
        const hostKey = `${LNC_STORAGE_KEY}:${hash(this._pairingPhrase)}:host`;
        this._enqueue(hostKey, this.persisted.serverHost);
    }

    /** Saves persisted data to Storage */
    private _save() {
        // only save if localKey and remoteKey is set
        if (!this._localKey) return;
        if (!this._remoteKey) return;
        const baseKey = `${LNC_STORAGE_KEY}:${hash(this._pairingPhrase)}`;
        this._enqueue(baseKey, { ...this.persisted });
    }

    private _enqueue(key: string, value: any) {
        this.writeQueue = this.writeQueue
            .then(async () => {
                await Storage.setItem(key, value);
                // Read back: a silently dropped keychain write is the one
                // failure mode this store cannot recover from, so make it
                // loud rather than discovering it on the next launch. An
                // empty value is a deliberate delete in Storage, so there is
                // nothing to read back.
                if (value === '' || value == null) return;
                const readBack = await Storage.getItem(key);
                if (!readBack) {
                    throw new Error(`write to ${key} did not persist`);
                }
            })
            .catch((error) => {
                console.error(
                    'LNC credential store: failed to persist credentials',
                    (error as Error)?.message
                );
            });
    }
}

export { LNC_STORAGE_KEY, hash };
