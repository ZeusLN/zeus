/* eslint-disable */
export interface ForceAutoLoopRequest {}

export interface ForceAutoLoopResponse {}

/**
 * Debug is a service that exposes endpoints intended for testing purposes. These
 * endpoints should not operate on mainnet, and should only be included if loop is
 * built with the dev build tag.
 */
export interface Debug {
    /**
     * ForceAutoLoop is intended for *testing purposes only* and will not work on
     * mainnet. This endpoint ticks our autoloop timer, triggering automated
     * dispatch of a swap if one is suggested.
     */
    forceAutoLoop(
        request?: DeepPartial<ForceAutoLoopRequest>
    ): Promise<ForceAutoLoopResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
