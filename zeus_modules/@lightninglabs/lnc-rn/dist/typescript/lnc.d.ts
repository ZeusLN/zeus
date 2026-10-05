import { LndApi } from '@lightninglabs/lnc-core';
import { CredentialStore, LncConfig } from './types/lnc';
export default class LNC {
    _namespace: string;
    credentials: CredentialStore;
    lnd: LndApi;
    private _emitter;
    private _subscriptions;
    private _requestTimeoutMs;
    private _initPromise;
    private _initError;
    private _dialing;
    constructor(lncConfig?: LncConfig);
    onLocalPrivCreate: (keyHex: string) => void;
    onRemoteKeyReceive: (keyHex: string) => void;
    onAuthData: (keyHex: string) => void;
    isConnected(): Promise<any>;
    /**
     * Whether a dial started by connect() is still in progress. The native
     * client keeps retrying on its own until it connects, so callers should
     * wait on it rather than dial or re-initialize.
     */
    isDialing(): Promise<boolean>;
    status(): Promise<any>;
    expiry(): Promise<Date>;
    isReadOnly(): Promise<any>;
    hasPerms(permission: string): Promise<any>;
    /**
     * Connects to the LNC proxy server
     * @returns a promise that resolves when the connection is established
     */
    connect(): Promise<any>;
    /**
     * Disconnects from the proxy server.
     *
     * Awaitable: callers that immediately re-init the same namespace must
     * know the previous connection is closed first, because InitLNC replaces
     * the namespace's mobile client outright without closing what was there.
     *
     * A dial that is still in progress cannot be stopped, so it is left
     * running with its key listeners attached: when it completes, the remote
     * key it reports still has to reach this namespace's credential store
     * (a pairing phrase is single use). Calling the native Disconnect here
     * would do nothing until the dial lands, and would close it if it landed
     * in between, leaving _dialing set with no dial behind it.
     */
    disconnect(): Promise<void>;
    /**
     * Stops listening for key events without touching the native client.
     * Used when this instance is replaced by a fresh InitLNC on the same
     * namespace, which then owns that namespace's events.
     */
    dispose(): void;
    private _forNamespace;
    private _removeSubscriptions;
    /**
     * Emulates a GRPC request but uses the mobile client instead to communicate with the LND node
     * @param method the GRPC method to call on the service
     * @param request The GRPC request message to send
     */
    request<TRes>(method: string, request?: object): Promise<TRes>;
    /**
     * Subscribes to a GRPC server-streaming endpoint and executes the `onMessage` handler
     * when a new message is received from the server
     * @param method the GRPC method to call on the service
     * @param request the GRPC request message to send
     * @param onMessage the callback function to execute when a new message is received
     * @param onError the callback function to execute when an error is received
     */
    subscribe(method: string, request?: object): string;
}
//# sourceMappingURL=lnc.d.ts.map