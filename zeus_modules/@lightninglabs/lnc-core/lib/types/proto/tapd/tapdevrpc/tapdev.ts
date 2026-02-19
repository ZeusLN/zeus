/* eslint-disable */
import type { Addr } from '../taprootassets';

/**
 * ProofTransferType is the type of proof transfer attempt. The transfer is
 * either a proof delivery to the transfer counterparty or receiving a proof
 * from the transfer counterparty. Note that the transfer counterparty is
 * usually the proof courier service.
 */
export enum ProofTransferType {
    /**
     * PROOF_TRANSFER_TYPE_SEND - This value indicates that the proof transfer attempt is a delivery to the
     * transfer counterparty.
     */
    PROOF_TRANSFER_TYPE_SEND = 'PROOF_TRANSFER_TYPE_SEND',
    /**
     * PROOF_TRANSFER_TYPE_RECEIVE - This value indicates that the proof transfer attempt is a receive from
     * the transfer counterparty.
     */
    PROOF_TRANSFER_TYPE_RECEIVE = 'PROOF_TRANSFER_TYPE_RECEIVE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface ImportProofRequest {
    proofFile: Uint8Array | string;
    genesisPoint: string;
}

export interface ImportProofResponse {}

export interface SubscribeSendAssetEventNtfnsRequest {}

export interface SendAssetEvent {
    /** An event which indicates that a send state is about to be executed. */
    executeSendStateEvent: ExecuteSendStateEvent | undefined;
    /**
     * An event which indicates that the proof transfer backoff wait period
     * will start imminently.
     */
    proofTransferBackoffWaitEvent: ProofTransferBackoffWaitEvent | undefined;
}

export interface ExecuteSendStateEvent {
    /** Execute timestamp (microseconds). */
    timestamp: string;
    /** The send state that is about to be executed. */
    sendState: string;
}

export interface ProofTransferBackoffWaitEvent {
    /** Transfer attempt timestamp (microseconds). */
    timestamp: string;
    /** Backoff is the active backoff wait duration. */
    backoff: string;
    /**
     * Tries counter is the number of tries we've made so far during the
     * course of the current backoff procedure to deliver the proof to the
     * receiver.
     */
    triesCounter: string;
    /** The type of proof transfer attempt. */
    transferType: ProofTransferType;
}

export interface SubscribeReceiveAssetEventNtfnsRequest {}

export interface AssetReceiveCompleteEvent {
    /** Event creation timestamp. */
    timestamp: string;
    /** The address that received the asset. */
    address: Addr | undefined;
    /** The outpoint of the transaction that was used to receive the asset. */
    outpoint: string;
}

export interface ReceiveAssetEvent {
    /**
     * An event which indicates that the proof transfer backoff wait period
     * will start imminently.
     */
    proofTransferBackoffWaitEvent: ProofTransferBackoffWaitEvent | undefined;
    /** An event which indicates that an asset receive process has finished. */
    assetReceiveCompleteEvent: AssetReceiveCompleteEvent | undefined;
}

export interface TapDev {
    /**
     * tapcli: `dev importproof`
     * Deprecated, use the new taprpc.RegisterTransfer RPC instead! ImportProof
     * attempts to import a proof file into the daemon. If successful,
     * a new asset will be inserted on disk, spendable using the specified target
     * script key, and internal key.
     * NOTE: This RPC will be removed with the next major release.
     *
     * @deprecated
     */
    importProof(
        request?: DeepPartial<ImportProofRequest>
    ): Promise<ImportProofResponse>;
    /**
     * SubscribeSendAssetEventNtfns registers a subscription to the event
     * notification stream which relates to the asset sending process.
     */
    subscribeSendAssetEventNtfns(
        request?: DeepPartial<SubscribeSendAssetEventNtfnsRequest>,
        onMessage?: (msg: SendAssetEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * SubscribeReceiveAssetEventNtfns registers a subscription to the event
     * notification stream which relates to the asset receive process.
     */
    subscribeReceiveAssetEventNtfns(
        request?: DeepPartial<SubscribeReceiveAssetEventNtfnsRequest>,
        onMessage?: (msg: ReceiveAssetEvent) => void,
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
