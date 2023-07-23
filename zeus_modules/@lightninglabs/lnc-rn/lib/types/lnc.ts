export interface LncConfig {
    /**
     * Specify a custom Lightning Node Connect proxy server. If not specified we'll
     * default to `mailbox.terminal.lightning.today:443`.
     */
    serverHost?: string;
    /**
     * Identifier name used for each connection. You can maintain multiple
     * connections if you use different namespaces. If not specified we'll default
     * to `default`.
     */
    namespace?: string;
    /**
     * The LNC pairing phrase used to initialize the connection to the LNC proxy.
     * This value will be passed along to the credential store.
     */
    pairingPhrase?: string;
    /**
     * Custom store used to save & load the pairing phrase and keys needed to
     * connect to the proxy server.
     */
    credentialStore?: CredentialStore;
}

/**
 * The interface that must be implemented to provide `LNC` instances with storage
 * for its persistent data. These fields will be read and written to during the
 * authentication and connection process.
 */
export interface CredentialStore {
    /** Stores the LNC pairing phrase used to initialize the connection to the LNC proxy */
    pairingPhrase: string;
    /** Stores the host:port of the Lightning Node Connect proxy server to connect to */
    serverHost: string;
    /** Stores the local private key which LNC uses to reestablish a connection */
    localKey: string;
    /** Stores the remote static key which LNC uses to reestablish a connection */
    remoteKey: string;
    /**
     * Read-only field which should return `true` if the client app has prior
     * credentials persisted in the store
     */
    isPaired: boolean;
    /** Clears any persisted data in the store */
    clear(): void;
}
