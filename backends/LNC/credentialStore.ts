import EncryptedStorage from 'react-native-encrypted-storage';
import { CredentialStore } from '@lightninglabs/lnc-rn';
import hashjs from 'hash.js';

const STORAGE_KEY = 'lnc-rn';

const hash = (stringToHash: string) =>
    hashjs.sha256().update(stringToHash).digest('hex');

/**
 * A wrapper around `EncryptedStorage` used to store sensitive data required
 * by LNC to reconnect after the initial pairing process has been completed.
 */
export default class LncCredentialStore implements CredentialStore {
    // the data to store in EncryptedStorage
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

    /**
     * Constructs a new `LncCredentialStore` instance
     */
    constructor(pairingPhrase?: string) {
        if (pairingPhrase) this.pairingPhrase = pairingPhrase;
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
        this.persisted.serverHost = host;
        this._save();
    }

    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    get pairingPhrase() {
        return this._pairingPhrase;
    }

    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    set pairingPhrase(phrase: string) {
        this._pairingPhrase = phrase;
        this.persisted.pairingPhrase = phrase;
        this.load(phrase);
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
        const key = `${STORAGE_KEY}:${hash(this._pairingPhrase)}`;
        EncryptedStorage.removeItem(key);
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

    /** Loads persisted data from EncryptedStorage */
    async load(pairingPhrase?: string) {
        // only load if pairingPhrase is set
        if (!pairingPhrase) return;
        try {
            const key = `${STORAGE_KEY}:${hash(pairingPhrase)}`;
            const json = await EncryptedStorage.getItem(key);
            if (json) {
                this.persisted = JSON.parse(json);
                this._localKey = this.persisted.localKey;
                this._remoteKey = this.persisted.remoteKey;
            }
            return;
        } catch (error) {
            const msg = (error as Error).message;
            throw new Error(`Failed to load secure data: ${msg}`);
        }
    }

    //
    // Private functions only used internally
    //

    /** Saves persisted data to EncryptedStorage */
    private _save() {
        // only save if localKey and remoteKey is set
        if (!this._localKey) return;
        if (!this._remoteKey) return;
        const key = `${STORAGE_KEY}:${hash(this._pairingPhrase)}`;
        EncryptedStorage.setItem(key, JSON.stringify(this.persisted));
    }
}

export { STORAGE_KEY, hash };
