/**
 * LDK Node TypeScript Type Definitions
 * React Native bridge for ldk-node Lightning implementation
 */

// ============================================================================
// Enums
// ============================================================================

export type Network = 'bitcoin' | 'testnet' | 'signet' | 'regtest';

export type PaymentDirection = 'inbound' | 'outbound';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

export type PaymentKindType =
    | 'onchain'
    | 'bolt11'
    | 'bolt11Jit'
    | 'bolt12Offer'
    | 'bolt12Refund'
    | 'spontaneous';

export interface PaymentKind {
    type: PaymentKindType;
    // On-chain specific
    txid?: string;
    status?: string;
    // Bolt11 specific
    hash?: string;
    preimage?: string;
    secret?: string;
    // Bolt11Jit specific
    counterpartySkimmedFeeMsat?: number;
    lspFeeLimits?: {
        maxTotalOpeningFeeMsat?: number;
        maxProportionalOpeningFeePpmMsat?: number;
    };
    // Bolt12Offer specific
    offerId?: string;
    // Bolt12Refund specific
    refundId?: string;
}

export type EventType =
    | 'paymentSuccessful'
    | 'paymentFailed'
    | 'paymentReceived'
    | 'paymentClaimable'
    | 'paymentForwarded'
    | 'channelPending'
    | 'channelReady'
    | 'channelClosed'
    | 'splicePending'
    | 'spliceFailed';

export type PaymentFailureReason =
    | 'recipientRejected'
    | 'userAbandoned'
    | 'retriesExhausted'
    | 'paymentExpired'
    | 'routeNotFound'
    | 'unexpectedError'
    | 'unknownRequiredFeatures'
    | 'invoiceRequestExpired'
    | 'invoiceRequestRejected'
    | 'blindedPathCreationFailed';

export type ClosureReason =
    | 'counterpartyForceClosed'
    | 'holderForceClosed'
    | 'legacyCooperativeClosure'
    | 'counterpartyInitiatedCooperativeClosure'
    | 'locallyInitiatedCooperativeClosure'
    | 'commitmentTxConfirmed'
    | 'fundingTimedOut'
    | 'processingError'
    | 'disconnectedPeer'
    | 'outdatedChannelManager'
    | 'counterpartyCoopClosedUnfundedChannel'
    | 'locallyCoopClosedUnfundedChannel'
    | 'fundingBatchClosure'
    | 'htlcsTimedOut'
    | 'peerFeerateTooLow';

export type LightningBalanceType =
    | 'claimableOnChannelClose'
    | 'claimableAwaitingConfirmations'
    | 'contentiousClaimable'
    | 'maybeTimeoutClaimableHtlc'
    | 'maybePreimageClaimableHtlc'
    | 'counterpartyRevokedOutputClaimable';

export type PendingSweepBalanceType =
    | 'pendingBroadcast'
    | 'broadcastAwaitingConfirmation'
    | 'awaitingThresholdConfirmations';

// ============================================================================
// Data Types
// ============================================================================

export interface NodeStatus {
    isRunning: boolean;
    currentBestBlock_height: number;
    currentBestBlock_hash: string;
    latestLightningWalletSyncTimestamp?: number;
    latestOnchainWalletSyncTimestamp?: number;
    latestFeeRateCacheUpdateTimestamp?: number;
    latestRgsSnapshotTimestamp?: number;
    latestNodeAnnouncementBroadcastTimestamp?: number;
}

export interface LightningBalance {
    type: LightningBalanceType;
    channelId: string;
    counterpartyNodeId: string;
    amountSatoshis: number;
    // ClaimableOnChannelClose specific
    transactionFeeSatoshis?: number;
    outboundPaymentHtlcRoundedMsat?: number;
    outboundForwardedHtlcRoundedMsat?: number;
    inboundClaimingHtlcRoundedMsat?: number;
    inboundHtlcRoundedMsat?: number;
    // ClaimableAwaitingConfirmations specific
    confirmationHeight?: number;
    // ContentiousClaimable specific
    timeoutHeight?: number;
    paymentHash?: string;
    paymentPreimage?: string;
    // MaybeTimeoutClaimableHtlc specific
    claimableHeight?: number;
    outboundPayment?: boolean;
    // MaybePreimageClaimableHtlc specific
    expiryHeight?: number;
}

export interface PendingSweepBalance {
    type: PendingSweepBalanceType;
    channelId?: string;
    amountSatoshis: number;
    // BroadcastAwaitingConfirmation specific
    latestBroadcastHeight?: number;
    latestSpendingTxid?: string;
    // AwaitingThresholdConfirmations specific
    confirmationHash?: string;
    confirmationHeight?: number;
}

export interface BalanceDetails {
    totalOnchainBalanceSats: number;
    spendableOnchainBalanceSats: number;
    totalLightningBalanceSats: number;
    lightningBalances: LightningBalance[];
    pendingBalancesFromChannelClosures: PendingSweepBalance[];
}

export interface ChannelDetails {
    channelId: string;
    counterpartyNodeId: string;
    fundingTxo_txid?: string;
    fundingTxo_vout?: number;
    channelValueSats: number;
    unspendablePunishmentReserve?: number;
    userChannelId: string;
    feerateSatPer1000Weight?: number;
    outboundCapacityMsat: number;
    inboundCapacityMsat: number;
    confirmationsRequired?: number;
    confirmations?: number;
    isOutbound: boolean;
    isChannelReady: boolean;
    isUsable: boolean;
    isAnnounced: boolean;
    cltvExpiryDelta?: number;
    counterpartyUnspendablePunishmentReserve: number;
    counterpartyOutboundHtlcMinimumMsat?: number;
    counterpartyOutboundHtlcMaximumMsat?: number;
    counterpartyForwardingInfoFeeBaseMsat?: number;
    counterpartyForwardingInfoFeeProportionalMillionths?: number;
    counterpartyForwardingInfoCltvExpiryDelta?: number;
    nextOutboundHtlcLimitMsat: number;
    nextOutboundHtlcMinimumMsat: number;
    forceCloseSpendDelay?: number;
    inboundHtlcMinimumMsat: number;
    inboundHtlcMaximumMsat?: number;
}

export interface PaymentDetails {
    id: string;
    kind: PaymentKind;
    amountMsat?: number;
    direction: PaymentDirection;
    status: PaymentStatus;
    latestUpdateTimestamp: number;
}

export interface PeerDetails {
    nodeId: string;
    address: string;
    isConnected: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export interface EventPaymentSuccessful {
    type: 'paymentSuccessful';
    paymentId?: string;
    paymentHash: string;
    feePaidMsat?: number;
}

export interface EventPaymentFailed {
    type: 'paymentFailed';
    paymentId?: string;
    paymentHash?: string;
    reason?: PaymentFailureReason;
}

export interface EventPaymentReceived {
    type: 'paymentReceived';
    paymentId?: string;
    paymentHash: string;
    amountMsat: number;
}

export interface EventPaymentClaimable {
    type: 'paymentClaimable';
    paymentId: string;
    paymentHash: string;
    claimableAmountMsat: number;
    claimDeadline?: number;
}

export interface EventPaymentForwarded {
    type: 'paymentForwarded';
    prevChannelId: string;
    nextChannelId: string;
    prevUserChannelId?: string;
    nextUserChannelId?: string;
    prevNodeId?: string;
    nextNodeId?: string;
    totalFeeEarnedMsat?: number;
    skimmedFeeMsat?: number;
    claimFromOnchainTx: boolean;
    outboundAmountForwardedMsat?: number;
}

export interface EventChannelPending {
    type: 'channelPending';
    channelId: string;
    userChannelId: string;
    formerTemporaryChannelId: string;
    counterpartyNodeId: string;
    fundingTxo_txid: string;
    fundingTxo_vout: number;
}

export interface EventChannelReady {
    type: 'channelReady';
    channelId: string;
    userChannelId: string;
    counterpartyNodeId?: string;
    fundingTxo_txid?: string;
    fundingTxo_vout?: number;
}

export interface EventChannelClosed {
    type: 'channelClosed';
    channelId: string;
    userChannelId: string;
    counterpartyNodeId?: string;
    reason?: ClosureReason;
}

export interface EventSplicePending {
    type: 'splicePending';
    channelId: string;
    userChannelId: string;
    counterpartyNodeId: string;
    newFundingTxo_txid: string;
    newFundingTxo_vout: number;
}

export interface EventSpliceFailed {
    type: 'spliceFailed';
    channelId: string;
    userChannelId: string;
    counterpartyNodeId: string;
    abandonedFundingTxo_txid?: string;
    abandonedFundingTxo_vout?: number;
}

export type LdkNodeEvent =
    | EventPaymentSuccessful
    | EventPaymentFailed
    | EventPaymentReceived
    | EventPaymentClaimable
    | EventPaymentForwarded
    | EventChannelPending
    | EventChannelReady
    | EventChannelClosed
    | EventSplicePending
    | EventSpliceFailed;

// ============================================================================
// LSPS1 Types
// ============================================================================

export type Lsps1PaymentState =
    | 'expectedPayment'
    | 'hold'
    | 'paid'
    | 'refunded'
    | 'refundPending'
    | 'overpaidRefundPending';

export interface Lsps1OrderParams {
    lspBalanceSat: number;
    clientBalanceSat: number;
    requiredChannelConfirmations: number;
    fundingConfirmsWithinBlocks: number;
    channelExpiryBlocks: number;
    token?: string;
    announceChannel: boolean;
}

export interface Lsps1Bolt11PaymentInfo {
    invoice: string;
    feeTotalSat: number;
    orderTotalSat: number;
    state: Lsps1PaymentState;
    expiresAt: string;
}

export interface Lsps1OnchainPaymentInfo {
    address: string;
    feeTotalSat: number;
    orderTotalSat: number;
    state: Lsps1PaymentState;
    expiresAt: string;
    minOnchainPaymentConfirmations?: number;
    minFeeFor0conf: number;
    refundOnchainAddress?: string;
}

export interface Lsps1PaymentInfo {
    state?: Lsps1PaymentState;
    feeTotalSat?: number;
    orderTotalSat?: number;
    bolt11Invoice?: Lsps1Bolt11PaymentInfo;
    onchainPayment?: Lsps1OnchainPaymentInfo;
}

export interface Lsps1ChannelInfo {
    fundingTxid: string;
    fundingTxVout: number;
    fundedAt: string;
    expiresAt: string;
}

export interface Lsps1OrderResponse {
    orderId: string;
    orderParams: Lsps1OrderParams;
    paymentInfo: Lsps1PaymentInfo;
    channelInfo?: Lsps1ChannelInfo;
}

export interface Lsps1OrderStatus {
    orderId: string;
    orderParams: Lsps1OrderParams;
    paymentInfo: Lsps1PaymentInfo;
    channelInfo?: Lsps1ChannelInfo;
}

// ============================================================================
// Module Interface
// ============================================================================

export interface ILdkNodeModule {
    // Builder Methods
    createBuilder(): Promise<void>;
    setNetwork(network: Network): Promise<void>;
    setStorageDirPath(path: string): Promise<void>;
    setEsploraServer(serverUrl: string): Promise<void>;
    setGossipSourceRgs(rgsServerUrl: string): Promise<void>;
    setGossipSourceP2p(): Promise<void>;
    setListeningAddresses(addresses: string[]): Promise<void>;

    // Mnemonic Methods
    generateMnemonic(wordCount: number): Promise<string>;

    // Node Build Methods
    buildNode(mnemonic: string, passphrase?: string | null): Promise<void>;

    // Node Lifecycle Methods
    start(): Promise<void>;
    stop(): Promise<void>;
    syncWallets(): Promise<void>;

    // Node Info Methods
    nodeId(): Promise<string>;
    status(): Promise<NodeStatus>;
    listBalances(): Promise<BalanceDetails>;
    networkGraphInfo(): Promise<{ channelCount: number; nodeCount: number }>;

    // Channel Methods
    listChannels(): Promise<ChannelDetails[]>;
    openChannel(
        nodeId: string,
        address: string,
        channelAmountSats: number,
        pushToCounterpartyMsat?: number | null,
        announceChannel?: boolean
    ): Promise<string>;
    closeChannel(
        userChannelId: string,
        counterpartyNodeId: string
    ): Promise<void>;

    // On-chain Methods
    newOnchainAddress(): Promise<string>;
    sendToOnchainAddress(address: string, amountSats: number): Promise<string>;
    sendAllToOnchainAddress(
        address: string,
        retainReserve: boolean
    ): Promise<string>;

    // BOLT11 Payment Methods
    receiveBolt11(
        amountMsat: number,
        description: string,
        expirySecs: number
    ): Promise<{ invoice: string }>;
    receiveVariableAmountBolt11(
        description: string,
        expirySecs: number
    ): Promise<{ invoice: string }>;
    sendBolt11(invoice: string): Promise<string>;
    sendBolt11UsingAmount(invoice: string, amountMsat: number): Promise<string>;

    // Payment Methods
    listPayments(): Promise<PaymentDetails[]>;

    // Peer Methods
    connect(nodeId: string, address: string, persist: boolean): Promise<void>;
    disconnect(nodeId: string): Promise<void>;
    listPeers(): Promise<PeerDetails[]>;

    // Event Methods
    nextEvent(): Promise<LdkNodeEvent | null>;
    waitNextEvent(): Promise<LdkNodeEvent>;
    eventHandled(): Promise<void>;

    // LSPS1 Methods
    setLiquiditySourceLsps1(
        nodeId: string,
        address: string,
        token?: string | null
    ): Promise<void>;
    setLiquiditySourceLsps2(
        nodeId: string,
        address: string,
        token?: string | null
    ): Promise<void>;
    setTrustedPeers0conf(peers: string[]): Promise<void>;
    lsps1RequestChannel(
        lspBalanceSat: number,
        clientBalanceSat: number,
        channelExpiryBlocks: number,
        announceChannel: boolean
    ): Promise<Lsps1OrderResponse>;
    lsps1CheckOrderStatus(orderId: string): Promise<Lsps1OrderStatus>;

    // Message Signing Methods
    signMessage(message: string): Promise<{ signature: string }>;
    verifySignature(
        message: string,
        signature: string,
        publicKey: string
    ): Promise<{ valid: boolean }>;
}

// ============================================================================
// React Native Module Declaration
// ============================================================================

declare module 'react-native' {
    interface NativeModulesStatic {
        LdkNodeModule: ILdkNodeModule;
    }
}
