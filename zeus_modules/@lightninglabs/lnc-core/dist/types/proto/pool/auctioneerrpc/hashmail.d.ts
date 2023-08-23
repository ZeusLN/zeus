export interface PoolAccountAuth {
    /** The account key being used to authenticate. */
    acctKey: Uint8Array | string;
    /** A valid signature over the stream ID being used. */
    streamSig: Uint8Array | string;
}
export interface SidecarAuth {
    /**
     * A valid sidecar ticket that has been signed (offered) by a Pool account in
     * the active state.
     */
    ticket: string;
}
export interface CipherBoxAuth {
    /** A description of the stream one is attempting to initialize. */
    desc: CipherBoxDesc | undefined;
    acctAuth: PoolAccountAuth | undefined;
    sidecarAuth: SidecarAuth | undefined;
}
export interface DelCipherBoxResp {
}
/** TODO(roasbeef): payment request, node key, etc, etc */
export interface CipherChallenge {
}
export interface CipherError {
}
export interface CipherSuccess {
    desc: CipherBoxDesc | undefined;
}
export interface CipherInitResp {
    /**
     * CipherSuccess is returned if the initialization of the cipher box was
     * successful.
     */
    success: CipherSuccess | undefined;
    /**
     * CipherChallenge is returned if the authentication mechanism was revoked
     * or needs to be refreshed.
     */
    challenge: CipherChallenge | undefined;
    /**
     * CipherError is returned if the authentication mechanism failed to
     * validate.
     */
    error: CipherError | undefined;
}
export interface CipherBoxDesc {
    streamId: Uint8Array | string;
}
export interface CipherBox {
    desc: CipherBoxDesc | undefined;
    msg: Uint8Array | string;
}
/**
 * HashMail exposes a simple synchronous network stream that can be used for
 * various types of synchronization and coordination. The service allows
 * authenticated users to create a simplex stream call a cipher box. Once the
 * stream is created, any user that knows of the stream ID can read/write from
 * the stream, but only a single user can be on either side at a time.
 */
export interface HashMail {
    /**
     * NewCipherBox creates a new cipher box pipe/stream given a valid
     * authentication mechanism. If the authentication mechanism has been revoked,
     * or needs to be changed, then a CipherChallenge message is returned.
     * Otherwise the method will either be accepted or rejected.
     */
    newCipherBox(request?: DeepPartial<CipherBoxAuth>): Promise<CipherInitResp>;
    /**
     * DelCipherBox attempts to tear down an existing cipher box pipe. The same
     * authentication mechanism used to initially create the stream MUST be
     * specified.
     */
    delCipherBox(request?: DeepPartial<CipherBoxAuth>): Promise<DelCipherBoxResp>;
    /**
     * SendStream opens up the write side of the passed CipherBox pipe. Writes
     * will be non-blocking up to the buffer size of the pipe. Beyond that writes
     * will block until completed.
     */
    sendStream(request?: DeepPartial<CipherBox>): Promise<CipherBoxDesc>;
    /**
     * RecvStream opens up the read side of the passed CipherBox pipe. This method
     * will block until a full message has been read as this is a message based
     * pipe/stream abstraction.
     */
    recvStream(request?: DeepPartial<CipherBoxDesc>, onMessage?: (msg: CipherBox) => void, onError?: (err: Error) => void): void;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=hashmail.d.ts.map