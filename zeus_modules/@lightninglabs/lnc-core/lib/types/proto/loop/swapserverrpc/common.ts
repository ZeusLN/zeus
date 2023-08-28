/* eslint-disable */
export interface HopHint {
    /** The public key of the node at the start of the channel. */
    nodeId: string;
    /** The unique identifier of the channel. */
    chanId: string;
    /** The base fee of the channel denominated in millisatoshis. */
    feeBaseMsat: number;
    /**
     * The fee rate of the channel for sending one satoshi across it denominated in
     * millionths of a satoshi.
     */
    feeProportionalMillionths: number;
    /** The time-lock delta of the channel. */
    cltvExpiryDelta: number;
}

export interface RouteHint {
    /**
     * A list of hop hints that when chained together can assist in reaching a
     * specific destination.
     */
    hopHints: HopHint[];
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
