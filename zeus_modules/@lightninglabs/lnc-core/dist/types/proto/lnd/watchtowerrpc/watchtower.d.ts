export interface GetInfoRequest {
}
export interface GetInfoResponse {
    /** The public key of the watchtower. */
    pubkey: Uint8Array | string;
    /** The listening addresses of the watchtower. */
    listeners: string[];
    /** The URIs of the watchtower. */
    uris: string[];
}
/**
 * Watchtower is a service that grants access to the watchtower server
 * functionality of the daemon.
 */
export interface Watchtower {
    /**
     * lncli: tower info
     * GetInfo returns general information concerning the companion watchtower
     * including its public key and URIs where the server is currently
     * listening for clients.
     */
    getInfo(request?: DeepPartial<GetInfoRequest>): Promise<GetInfoResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=watchtower.d.ts.map