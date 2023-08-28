/* eslint-disable */

export interface ConfRequest {
    /**
     * The transaction hash for which we should request a confirmation notification
     * for. If set to a hash of all zeros, then the confirmation notification will
     * be requested for the script instead.
     */
    txid: Uint8Array | string;
    /**
     * An output script within a transaction with the hash above which will be used
     * by light clients to match block filters. If the transaction hash is set to a
     * hash of all zeros, then a confirmation notification will be requested for
     * this script instead.
     */
    script: Uint8Array | string;
    /**
     * The number of desired confirmations the transaction/output script should
     * reach before dispatching a confirmation notification.
     */
    numConfs: number;
    /**
     * The earliest height in the chain for which the transaction/output script
     * could have been included in a block. This should in most cases be set to the
     * broadcast height of the transaction/output script.
     */
    heightHint: number;
    /**
     * If true, then the block that mines the specified txid/script will be
     * included in eventual the notification event.
     */
    includeBlock: boolean;
}

export interface ConfDetails {
    /** The raw bytes of the confirmed transaction. */
    rawTx: Uint8Array | string;
    /** The hash of the block in which the confirmed transaction was included in. */
    blockHash: Uint8Array | string;
    /**
     * The height of the block in which the confirmed transaction was included
     * in.
     */
    blockHeight: number;
    /** The index of the confirmed transaction within the block. */
    txIndex: number;
    /**
     * The raw bytes of the block that mined the transaction. Only included if
     * include_block was set in the request.
     */
    rawBlock: Uint8Array | string;
}

/** TODO(wilmer): need to know how the client will use this first. */
export interface Reorg {}

export interface ConfEvent {
    /**
     * An event that includes the confirmation details of the request
     * (txid/ouput script).
     */
    conf: ConfDetails | undefined;
    /**
     * An event send when the transaction of the request is reorged out of the
     * chain.
     */
    reorg: Reorg | undefined;
}

export interface Outpoint {
    /** The hash of the transaction. */
    hash: Uint8Array | string;
    /** The index of the output within the transaction. */
    index: number;
}

export interface SpendRequest {
    /**
     * The outpoint for which we should request a spend notification for. If set to
     * a zero outpoint, then the spend notification will be requested for the
     * script instead. A zero or nil outpoint is not supported for Taproot spends
     * because the output script cannot reliably be computed from the witness alone
     * and the spent output script is not always available in the rescan context.
     * So an outpoint must _always_ be specified when registering a spend
     * notification for a Taproot output.
     */
    outpoint: Outpoint | undefined;
    /**
     * The output script for the outpoint above. This will be used by light clients
     * to match block filters. If the outpoint is set to a zero outpoint, then a
     * spend notification will be requested for this script instead.
     */
    script: Uint8Array | string;
    /**
     * The earliest height in the chain for which the outpoint/output script could
     * have been spent. This should in most cases be set to the broadcast height of
     * the outpoint/output script.
     */
    heightHint: number;
}

export interface SpendDetails {
    /** The outpoint was that spent. */
    spendingOutpoint: Outpoint | undefined;
    /** The raw bytes of the spending transaction. */
    rawSpendingTx: Uint8Array | string;
    /** The hash of the spending transaction. */
    spendingTxHash: Uint8Array | string;
    /** The input of the spending transaction that fulfilled the spend request. */
    spendingInputIndex: number;
    /** The height at which the spending transaction was included in a block. */
    spendingHeight: number;
}

export interface SpendEvent {
    /**
     * An event that includes the details of the spending transaction of the
     * request (outpoint/output script).
     */
    spend: SpendDetails | undefined;
    /**
     * An event sent when the spending transaction of the request was
     * reorged out of the chain.
     */
    reorg: Reorg | undefined;
}

export interface BlockEpoch {
    /** The hash of the block. */
    hash: Uint8Array | string;
    /** The height of the block. */
    height: number;
}

/**
 * ChainNotifier is a service that can be used to get information about the
 * chain backend by registering notifiers for chain events.
 */
export interface ChainNotifier {
    /**
     * RegisterConfirmationsNtfn is a synchronous response-streaming RPC that
     * registers an intent for a client to be notified once a confirmation request
     * has reached its required number of confirmations on-chain.
     *
     * A confirmation request must have a valid output script. It is also possible
     * to give a transaction ID. If the transaction ID is not set, a notification
     * is sent once the output script confirms. If the transaction ID is also set,
     * a notification is sent once the output script confirms in the given
     * transaction.
     */
    registerConfirmationsNtfn(
        request?: DeepPartial<ConfRequest>,
        onMessage?: (msg: ConfEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * RegisterSpendNtfn is a synchronous response-streaming RPC that registers an
     * intent for a client to be notification once a spend request has been spent
     * by a transaction that has confirmed on-chain.
     *
     * A client can specify whether the spend request should be for a particular
     * outpoint  or for an output script by specifying a zero outpoint.
     */
    registerSpendNtfn(
        request?: DeepPartial<SpendRequest>,
        onMessage?: (msg: SpendEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * RegisterBlockEpochNtfn is a synchronous response-streaming RPC that
     * registers an intent for a client to be notified of blocks in the chain. The
     * stream will return a hash and height tuple of a block for each new/stale
     * block in the chain. It is the client's responsibility to determine whether
     * the tuple returned is for a new or stale block in the chain.
     *
     * A client can also request a historical backlog of blocks from a particular
     * point. This allows clients to be idempotent by ensuring that they do not
     * missing processing a single block within the chain.
     */
    registerBlockEpochNtfn(
        request?: DeepPartial<BlockEpoch>,
        onMessage?: (msg: BlockEpoch) => void,
        onError?: (err: Error) => void
    ): void;
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
