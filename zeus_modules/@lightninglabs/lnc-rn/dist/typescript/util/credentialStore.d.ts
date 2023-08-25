import { CredentialStore } from '../types/lnc';
export default class LncCredentialStore implements CredentialStore {
    private _serverHost;
    private _localKey;
    private _remoteKey;
    private _pairingPhrase;
    /**
     * Constructs a new `LncCredentialStore` instance
     */
    constructor(pairingPhrase?: string);
    /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
    get serverHost(): string;
    /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
    set serverHost(host: string);
    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    get pairingPhrase(): string;
    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    set pairingPhrase(phrase: string);
    /** Stores the local private key which LNC uses to reestablish a connection */
    get localKey(): string;
    /** Stores the local private key which LNC uses to reestablish a connection */
    set localKey(key: string);
    /** Stores the remote static key which LNC uses to reestablish a connection */
    get remoteKey(): string;
    /** Stores the remote static key which LNC uses to reestablish a connection */
    set remoteKey(key: string);
    /**
     * Read-only field which should return `true` if the client app has prior
     * credentials persisted in teh store
     */
    get isPaired(): boolean;
    /** Clears any persisted data in the store */
    clear(): void;
}
//# sourceMappingURL=credentialStore.d.ts.map