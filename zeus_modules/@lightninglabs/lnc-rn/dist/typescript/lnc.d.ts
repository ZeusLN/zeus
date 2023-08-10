import { FaradayApi, LitApi, LndApi, LoopApi, PoolApi } from '@lightninglabs/lnc-core';
import { CredentialStore, LncConfig } from './types/lnc';
export default class LNC {
    _namespace: string;
    credentials: CredentialStore;
    lnd: LndApi;
    loop: LoopApi;
    pool: PoolApi;
    faraday: FaradayApi;
    lit: LitApi;
    constructor(lncConfig?: LncConfig);
    onLocalPrivCreate: (keyHex: string) => void;
    onRemoteKeyReceive: (keyHex: string) => void;
    onAuthData: (keyHex: string) => void;
    isConnected(): Promise<any>;
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
     * Disconnects from the proxy server
     */
    disconnect(): void;
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