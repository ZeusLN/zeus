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
//# sourceMappingURL=common.d.ts.map