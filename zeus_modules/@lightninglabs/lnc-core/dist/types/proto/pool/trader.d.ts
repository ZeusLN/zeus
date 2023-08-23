import type { OrderState, OrderChannelType, AuctionType, NodeTier, ChannelAnnouncementConstraints, ChannelConfirmationConstraints, DurationBucketState, OutPoint, InvalidOrder, ExecutionFee, NodeRating, MarketInfo, BatchSnapshotResponse, BatchSnapshotsResponse, BatchSnapshotRequest, BatchSnapshotsRequest } from './auctioneerrpc/auctioneer';
export declare enum AccountVersion {
    /**
     * ACCOUNT_VERSION_LND_DEPENDENT - Let the version of lnd decide. If a version of lnd >= 0.15.0-beta is
     * detected then a Taproot account is created. For earlier versions a legacy
     * account is created. If a version of lnd >= 0.16.0-beta is detected, then a
     * Taproot v2 account is created.
     */
    ACCOUNT_VERSION_LND_DEPENDENT = "ACCOUNT_VERSION_LND_DEPENDENT",
    /** ACCOUNT_VERSION_LEGACY - A legacy SegWit v0 p2wsh account with a single script. */
    ACCOUNT_VERSION_LEGACY = "ACCOUNT_VERSION_LEGACY",
    /**
     * ACCOUNT_VERSION_TAPROOT - A Taproot enabled account with MuSig2 combined internal key and the expiry
     * script as a single tap script leaf.
     */
    ACCOUNT_VERSION_TAPROOT = "ACCOUNT_VERSION_TAPROOT",
    /**
     * ACCOUNT_VERSION_TAPROOT_V2 - A Taproot enabled account with MuSig2 combined internal key and the expiry
     * script as a single tap script leaf. This version uses the MuSig2 v1.0.0-rc2
     * protocol for creating the combined internal key. This can only be selected
     * when the connected lnd version is >= 0.16.0-beta.
     */
    ACCOUNT_VERSION_TAPROOT_V2 = "ACCOUNT_VERSION_TAPROOT_V2",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AccountState {
    /** PENDING_OPEN - The state of an account when it is pending its confirmation on-chain. */
    PENDING_OPEN = "PENDING_OPEN",
    /**
     * PENDING_UPDATE - The state of an account when it has undergone an update on-chain either as
     * part of a matched order or a trader modification and it is pending its
     * confirmation on-chain.
     */
    PENDING_UPDATE = "PENDING_UPDATE",
    /** OPEN - The state of an account once it has confirmed on-chain. */
    OPEN = "OPEN",
    /**
     * EXPIRED - The state of an account once its expiration has been reached and its closing
     * transaction has confirmed.
     */
    EXPIRED = "EXPIRED",
    /**
     * PENDING_CLOSED - The state of an account when we're waiting for the closing transaction of
     * an account to confirm that required cooperation with the auctioneer.
     */
    PENDING_CLOSED = "PENDING_CLOSED",
    /** CLOSED - The state of an account once its closing transaction has confirmed. */
    CLOSED = "CLOSED",
    /**
     * RECOVERY_FAILED - The state of an account that indicates that the account was attempted to be
     * recovered but failed because the opening transaction wasn't found by lnd.
     * This could be because it was never published or it never confirmed. Then the
     * funds are SAFU and the account can be considered to never have been opened
     * in the first place.
     */
    RECOVERY_FAILED = "RECOVERY_FAILED",
    /** PENDING_BATCH - The account has recently participated in a batch and is not yet confirmed. */
    PENDING_BATCH = "PENDING_BATCH",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum MatchState {
    /** PREPARE - The OrderMatchPrepare message from the auctioneer was received initially. */
    PREPARE = "PREPARE",
    /**
     * ACCEPTED - The OrderMatchPrepare message from the auctioneer was processed successfully
     * and the batch was accepted.
     */
    ACCEPTED = "ACCEPTED",
    /**
     * REJECTED - The order was rejected by the trader daemon, either as an answer to a
     * OrderMatchSignBegin or OrderMatchFinalize message from the auctioneer.
     */
    REJECTED = "REJECTED",
    /**
     * SIGNED - The OrderMatchSignBegin message from the auctioneer was processed
     * successfully.
     */
    SIGNED = "SIGNED",
    /**
     * FINALIZED - The OrderMatchFinalize message from the auctioneer was processed
     * successfully.
     */
    FINALIZED = "FINALIZED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum MatchRejectReason {
    /** NONE - No reject occurred, this is the default value. */
    NONE = "NONE",
    /**
     * SERVER_MISBEHAVIOR - The client didn't come up with the same result as the server and is
     * rejecting the batch because of that.
     */
    SERVER_MISBEHAVIOR = "SERVER_MISBEHAVIOR",
    /**
     * BATCH_VERSION_MISMATCH - The client doesn't support the current batch verification version the
     * server is using.
     */
    BATCH_VERSION_MISMATCH = "BATCH_VERSION_MISMATCH",
    /**
     * PARTIAL_REJECT_COLLATERAL - The client rejects some of the orders, not the full batch. This reason is
     * set on matches for orders that were in the same batch as partial reject ones
     * but were not themselves rejected.
     */
    PARTIAL_REJECT_COLLATERAL = "PARTIAL_REJECT_COLLATERAL",
    /**
     * PARTIAL_REJECT_DUPLICATE_PEER - The trader's client has a preference to only match orders with peers it
     * doesn't already have channels with. The order that is rejected with this
     * reason type comes from a peer that the trader already has channels with.
     */
    PARTIAL_REJECT_DUPLICATE_PEER = "PARTIAL_REJECT_DUPLICATE_PEER",
    /**
     * PARTIAL_REJECT_CHANNEL_FUNDING_FAILED - The trader's client couldn't connect to the remote node of the matched
     * order or the channel funding could not be initialized for another
     * reason. This could also be the rejecting node's fault if their
     * connection is not stable. Using this code can have a negative impact on
     * the reputation score of both nodes, depending on the number of errors
     * recorded.
     */
    PARTIAL_REJECT_CHANNEL_FUNDING_FAILED = "PARTIAL_REJECT_CHANNEL_FUNDING_FAILED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface InitAccountRequest {
    accountValue: string;
    absoluteHeight: number | undefined;
    relativeHeight: number | undefined;
    /** The target number of blocks that the transaction should be confirmed in. */
    confTarget: number | undefined;
    /**
     * The fee rate, in satoshis per kw, to use for the initial funding
     * transaction.
     */
    feeRateSatPerKw: string | undefined;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of pool. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (poold, LiT) and the method used for opening
     * the account (pool CLI, LiT UI, other 3rd party UI).
     */
    initiator: string;
    /** The version of account to create. */
    version: AccountVersion;
}
export interface QuoteAccountRequest {
    accountValue: string;
    /** The target number of blocks that the transaction should be confirmed in. */
    confTarget: number | undefined;
}
export interface QuoteAccountResponse {
    minerFeeRateSatPerKw: string;
    minerFeeTotal: string;
}
export interface ListAccountsRequest {
    /** Only list accounts that are still active. */
    activeOnly: boolean;
}
export interface ListAccountsResponse {
    accounts: Account[];
}
export interface Output {
    /** The value, in satoshis, of the output. */
    valueSat: string;
    /** The address corresponding to the output. */
    address: string;
}
export interface OutputWithFee {
    /** The address corresponding to the output. */
    address: string;
    /** The target number of blocks that the transaction should be confirmed in. */
    confTarget: number | undefined;
    /** The fee rate, in satoshis per kw, to use for the withdrawal transaction. */
    feeRateSatPerKw: string | undefined;
}
export interface OutputsWithImplicitFee {
    outputs: Output[];
}
export interface CloseAccountRequest {
    /** The trader key associated with the account that will be closed. */
    traderKey: Uint8Array | string;
    /**
     * A single output/address to which the remaining funds of the account will
     * be sent to at the specified fee. If an address is not specified, then
     * the funds are sent to an address the backing lnd node controls.
     */
    outputWithFee: OutputWithFee | undefined;
    /**
     * The outputs to which the remaining funds of the account will be sent to.
     * This should only be used when wanting to create two or more outputs,
     * otherwise OutputWithFee should be used instead. The fee of the account's
     * closing transaction is implicitly defined by the combined value of all
     * outputs.
     */
    outputs: OutputsWithImplicitFee | undefined;
}
export interface CloseAccountResponse {
    /** The hash of the closing transaction. */
    closeTxid: Uint8Array | string;
}
export interface WithdrawAccountRequest {
    /**
     * The trader key associated with the account that funds will be withdrawed
     * from.
     */
    traderKey: Uint8Array | string;
    /** The outputs we'll withdraw funds from the account into. */
    outputs: Output[];
    /** The fee rate, in satoshis per kw, to use for the withdrawal transaction. */
    feeRateSatPerKw: string;
    /** The new absolute expiration height of the account. */
    absoluteExpiry: number | undefined;
    /** The new relative expiration height of the account. */
    relativeExpiry: number | undefined;
    /**
     * The new version of the account. If this is set and is a valid version
     * greater than the account's current version, then the account is upgraded to
     * that version during the withdrawal.
     */
    newVersion: AccountVersion;
}
export interface WithdrawAccountResponse {
    /** The state of the account after processing the withdrawal. */
    account: Account | undefined;
    /** The transaction used to withdraw funds from the account. */
    withdrawTxid: Uint8Array | string;
}
export interface DepositAccountRequest {
    /**
     * The trader key associated with the account that funds will be deposited
     * into.
     */
    traderKey: Uint8Array | string;
    /** The amount in satoshis to deposit into the account. */
    amountSat: string;
    /** The fee rate, in satoshis per kw, to use for the deposit transaction. */
    feeRateSatPerKw: string;
    /** The new absolute expiration height of the account. */
    absoluteExpiry: number | undefined;
    /** The new relative expiration height of the account. */
    relativeExpiry: number | undefined;
    /**
     * The new version of the account. If this is set and is a valid version
     * greater than the account's current version, then the account is upgraded to
     * that version during the deposit.
     */
    newVersion: AccountVersion;
}
export interface DepositAccountResponse {
    /** The state of the account after processing the deposit. */
    account: Account | undefined;
    /** The transaction used to deposit funds into the account. */
    depositTxid: Uint8Array | string;
}
export interface RenewAccountRequest {
    /** The key associated with the account to renew. */
    accountKey: Uint8Array | string;
    /** The new absolute expiration height of the account. */
    absoluteExpiry: number | undefined;
    /** The new relative expiration height of the account. */
    relativeExpiry: number | undefined;
    /** The fee rate, in satoshis per kw, to use for the renewal transaction. */
    feeRateSatPerKw: string;
    /**
     * The new version of the account. If this is set and is a valid version
     * greater than the account's current version, then the account is upgraded to
     * that version during the renewal.
     */
    newVersion: AccountVersion;
}
export interface RenewAccountResponse {
    /** The state of the account after processing the renewal. */
    account: Account | undefined;
    /** The transaction used to renew the expiration of the account. */
    renewalTxid: Uint8Array | string;
}
export interface BumpAccountFeeRequest {
    /** The trader key associated with the account that will have its fee bumped. */
    traderKey: Uint8Array | string;
    /**
     * The new fee rate, in satoshis per kw, to use for the child of the account
     * transaction.
     */
    feeRateSatPerKw: string;
}
export interface BumpAccountFeeResponse {
}
export interface Account {
    /**
     * The identifying component of an account. This is the key used for the trader
     * in the 2-of-2 multi-sig construction of an account with an auctioneer.
     */
    traderKey: Uint8Array | string;
    /**
     * The current outpoint associated with the account. This will change every
     * time the account has been updated.
     */
    outpoint: OutPoint | undefined;
    /** The current total amount of satoshis in the account. */
    value: string;
    /**
     * The amount of satoshis in the account that is available, meaning not
     * allocated to any oustanding orders.
     */
    availableBalance: string;
    /** The height at which the account will expire. */
    expirationHeight: number;
    /** The current state of the account. */
    state: AccountState;
    /** The hash of the account's latest transaction. */
    latestTxid: Uint8Array | string;
    /** The current version of the account. */
    version: AccountVersion;
}
export interface SubmitOrderRequest {
    ask: Ask | undefined;
    bid: Bid | undefined;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of pool. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (poold, LiT) and the method used for
     * submitting the order (pool CLI, LiT UI, other 3rd party UI).
     */
    initiator: string;
}
export interface SubmitOrderResponse {
    /** Order failed with the given reason. */
    invalidOrder: InvalidOrder | undefined;
    /** The order nonce of the accepted order. */
    acceptedOrderNonce: Uint8Array | string | undefined;
    /**
     * In case a bid order was submitted for a sidecar ticket, that ticket is
     * updated with the new state and bid order nonce.
     */
    updatedSidecarTicket: string;
}
export interface ListOrdersRequest {
    /**
     * Can be set to true to list the orders including all events, which can be
     * very verbose.
     */
    verbose: boolean;
    /** Only list orders that are still active. */
    activeOnly: boolean;
}
export interface ListOrdersResponse {
    asks: Ask[];
    bids: Bid[];
}
export interface CancelOrderRequest {
    orderNonce: Uint8Array | string;
}
export interface CancelOrderResponse {
}
export interface Order {
    /** The trader's account key of the account that is used for the order. */
    traderKey: Uint8Array | string;
    /** Fixed order rate in parts per billion. */
    rateFixed: number;
    /** Order amount in satoshis. */
    amt: string;
    /**
     * Maximum fee rate the trader is willing to pay for the batch transaction,
     * expressed in satoshis per 1000 weight units (sat/KW).
     */
    maxBatchFeeRateSatPerKw: string;
    /** Order nonce, acts as unique order identifier. */
    orderNonce: Uint8Array | string;
    /** The state the order currently is in. */
    state: OrderState;
    /** The number of order units the amount corresponds to. */
    units: number;
    /**
     * The number of currently unfilled units of this order. This will be equal to
     * the total amount of units until the order has reached the state PARTIAL_FILL
     * or EXECUTED.
     */
    unitsUnfulfilled: number;
    /**
     * The value reserved from the account by this order to ensure the account
     * can pay execution and chain fees in case it gets matched.
     */
    reservedValueSat: string;
    /** The unix timestamp in nanoseconds the order was first created/submitted. */
    creationTimestampNs: string;
    /**
     * A list of events that were emitted for this order. This field is only set
     * when the verbose flag is set to true in the request.
     */
    events: OrderEvent[];
    /** The minimum number of order units that must be matched per order pair. */
    minUnitsMatch: number;
    /** The channel type to use for the resulting matched channels. */
    channelType: OrderChannelType;
    /**
     * List of nodes that will be allowed to match with our order. Incompatible
     * with the `not_allowed_node_ids` field.
     */
    allowedNodeIds: Uint8Array | string[];
    /**
     * List of nodes that won't be allowed to match with our order. Incompatible
     * with the `allowed_node_ids` field.
     */
    notAllowedNodeIds: Uint8Array | string[];
    /** Auction type where this order must be considered during the matching. */
    auctionType: AuctionType;
    /**
     * Flag used to signal that this order can be shared in public market
     * places.
     */
    isPublic: boolean;
}
export interface Bid {
    /** The common fields shared between both ask and bid order types. */
    details: Order | undefined;
    /**
     * Required number of blocks that a channel opened as a result of this bid
     * should be kept open.
     */
    leaseDurationBlocks: number;
    /**
     * The version of the order format that is used. Will be increased once new
     * features are added.
     */
    version: number;
    /**
     * The minimum node tier this order should be matched with. Only asks backed by
     * a node this tier or higher will be eligible for matching with this bid.
     */
    minNodeTier: NodeTier;
    /**
     * Give the incoming channel that results from this bid being matched an
     * initial outbound balance by adding additional funds from the taker's account
     * into the channel. As a simplification for the execution protocol and the
     * channel reserve calculations the min_chan_amt must be set to the full order
     * amount. For the inbound liquidity market the self_chan_balance can be at
     * most the same as the order amount.
     */
    selfChanBalance: string;
    /**
     * If this bid order is meant to lease a channel for another node (which is
     * dubbed a "sidecar channel") then this ticket contains all information
     * required for setting up that sidecar channel. The ticket is expected to be
     * the base58 encoded ticket, including the prefix and the checksum.
     */
    sidecarTicket: string;
    /** Signals if this bid is interested in an announced or unannounced channel. */
    unannouncedChannel: boolean;
    /** Signals if this bid is interested in a zero conf channel or not. */
    zeroConfChannel: boolean;
}
export interface Ask {
    /** The common fields shared between both ask and bid order types. */
    details: Order | undefined;
    /**
     * The number of blocks the liquidity provider is willing to provide the
     * channel funds for.
     */
    leaseDurationBlocks: number;
    /**
     * The version of the order format that is used. Will be increased once new
     * features are added.
     */
    version: number;
    /** The constraints for selling the liquidity based on channel discoverability. */
    announcementConstraints: ChannelAnnouncementConstraints;
    /**
     * The constraints for selling the liquidity based on the number of
     * blocks before considering the channel confirmed.
     */
    confirmationConstraints: ChannelConfirmationConstraints;
}
export interface QuoteOrderRequest {
    /** Order amount in satoshis. */
    amt: string;
    /** Fixed order rate in parts per billion. */
    rateFixed: number;
    /**
     * Required number of blocks that a channel opened as a result of this bid
     * should be kept open.
     */
    leaseDurationBlocks: number;
    /**
     * Maximum fee rate the trader is willing to pay for the batch transaction,
     * expressed in satoshis per 1000 weight units (sat/KW).
     */
    maxBatchFeeRateSatPerKw: string;
    /** The minimum number of order units that must be matched per order pair. */
    minUnitsMatch: number;
}
export interface QuoteOrderResponse {
    /**
     * The total order premium in satoshis for filling the entire order. This
     * represents the interest amount paid to the maker by the taker excluding any
     * execution or chain fees.
     */
    totalPremiumSat: string;
    /** The fixed order rate expressed as a fraction instead of parts per billion. */
    ratePerBlock: number;
    /** The fixed order rate expressed as a percentage instead of parts per billion. */
    ratePercent: number;
    /**
     * The total execution fee in satoshis that needs to be paid to the auctioneer
     * for executing the entire order.
     */
    totalExecutionFeeSat: string;
    /**
     * The worst case chain fees that need to be paid if fee rates spike up to the
     * max_batch_fee_rate_sat_per_kw value specified in the request. This value is
     * highly dependent on the min_units_match parameter as well since the
     * calculation assumes chain fees for the chain footprint of opening
     * amt/min_units_match channels (hence worst case calculation).
     */
    worstCaseChainFeeSat: string;
}
export interface OrderEvent {
    /**
     * The unix timestamp in nanoseconds the event was emitted at. This is the
     * primary key of the event and is unique across the database.
     */
    timestampNs: string;
    /** The human readable representation of the event. */
    eventStr: string;
    /** The order was updated in the database. */
    stateChange: UpdatedEvent | undefined;
    /** The order was involved in a match making attempt. */
    matched: MatchEvent | undefined;
}
export interface UpdatedEvent {
    /**
     * The state of the order previous to the change. This is what the state
     * changed from.
     */
    previousState: OrderState;
    /**
     * The new state of the order after the change. This is what the state changed
     * to.
     */
    newState: OrderState;
    /** The units that were filled at the time of the event. */
    unitsFilled: number;
}
export interface MatchEvent {
    /** The state of the match making process the order went through. */
    matchState: MatchState;
    /** The number of units that would be (or were) filled with this match. */
    unitsFilled: number;
    /** The nonce of the order we were matched to. */
    matchedOrder: Uint8Array | string;
    /**
     * The reason why the trader daemon rejected the order. Is only set if
     * match_state is set to REJECTED.
     */
    rejectReason: MatchRejectReason;
}
export interface RecoverAccountsRequest {
    /**
     * Recover the latest account states without interacting with the
     * Lightning Labs server.
     */
    fullClient: boolean;
    /**
     * Number of accounts that we are trying to recover. Used during the
     * full_client recovery process.
     */
    accountTarget: number;
    /**
     * Auctioneer's public key. Used during the full_client recovery process.
     * This field should be left empty for testnet/mainnet, its value is already
     * hardcoded in our codebase.
     */
    auctioneerKey: string;
    /**
     * Initial block height. We won't try to look for any account with an expiry
     * height smaller than this value. Used during the full_client recovery
     * process.
     */
    heightHint: number;
    /**
     * bitcoind/btcd instance address. Used during the full_client recovery
     * process.
     */
    bitcoinHost: string;
    /**
     * bitcoind/btcd user name. Used during the full_client recovery
     * process.
     */
    bitcoinUser: string;
    /**
     * bitcoind/btcd password. Used during the full_client recovery
     * process.
     */
    bitcoinPassword: string;
    /**
     * Use HTTP POST mode? bitcoind only supports this mode. Used during the
     * full_client recovery process.
     */
    bitcoinHttppostmode: boolean;
    /**
     * Use TLS to connect? bitcoind only supports non-TLS connections. Used
     * during the full_client recovery process.
     */
    bitcoinUsetls: boolean;
    /**
     * Path to btcd's TLS certificate, if TLS is enabled. Used  during the
     * full_client recovery process.
     */
    bitcoinTlspath: string;
}
export interface RecoverAccountsResponse {
    /** The number of accounts that were recovered. */
    numRecoveredAccounts: number;
}
export interface AccountModificationFeesRequest {
}
export interface AccountModificationFee {
    /** Modification action type. */
    action: string;
    /** Transaction ID. */
    txid: string;
    /** Action transaction block height. */
    blockHeight: number;
    /** Action transaction timestamp. */
    timestamp: string;
    /** Action transaction output amount. */
    outputAmount: string;
    /**
     * A flag which is true if fee value has not been set, and is otherwise
     * false.
     */
    feeNull: boolean | undefined;
    /** Action transaction fee value. */
    feeValue: string | undefined;
}
export interface ListOfAccountModificationFees {
    modificationFees: AccountModificationFee[];
}
export interface AccountModificationFeesResponse {
    /** A map from account key to an ordered list of account modification fees. */
    accounts: {
        [key: string]: ListOfAccountModificationFees;
    };
}
export interface AccountModificationFeesResponse_AccountsEntry {
    key: string;
    value: ListOfAccountModificationFees | undefined;
}
export interface AuctionFeeRequest {
}
export interface AuctionFeeResponse {
    /** The execution fee charged per matched order. */
    executionFee: ExecutionFee | undefined;
}
export interface Lease {
    /** The outpoint of the channel created. */
    channelPoint: OutPoint | undefined;
    /** The amount, in satoshis, of the channel created. */
    channelAmtSat: string;
    /** The intended duration, in blocks, of the channel created. */
    channelDurationBlocks: number;
    /** The absolute height that this channel lease expires. */
    channelLeaseExpiry: number;
    /** The premium, in satoshis, either paid or received for the offered liquidity. */
    premiumSat: string;
    /**
     * The execution fee, in satoshis, charged by the auctioneer for the channel
     * created.
     */
    executionFeeSat: string;
    /**
     * The fee, in satoshis, charged by the auctioneer for the batch execution
     * transaction that created this lease.
     */
    chainFeeSat: string;
    /**
     * The actual fixed rate expressed in parts per billionth this lease was
     * bought/sold at.
     */
    clearingRatePrice: string;
    /**
     * The actual fixed rate of the bid/ask, this should always be 'better' than
     * the clearing_rate_price.
     */
    orderFixedRate: string;
    /** The order executed that resulted in the channel created. */
    orderNonce: Uint8Array | string;
    /**
     * The unique identifier for the order that was matched with that resulted
     * in the channel created.
     */
    matchedOrderNonce: Uint8Array | string;
    /** Whether this channel was purchased from another trader or not. */
    purchased: boolean;
    /** The pubkey of the node that this channel was bought/sold from. */
    channelRemoteNodeKey: Uint8Array | string;
    /** The tier of the node that this channel was bought/sold from. */
    channelNodeTier: NodeTier;
    /** The self channel balance that was pushed to the recipient. */
    selfChanBalance: string;
    /** Whether the channel was leased as a sidecar channel (bid orders only). */
    sidecarChannel: boolean;
}
export interface LeasesRequest {
    /**
     * An optional list of batches to retrieve the leases of. If empty, leases
     * throughout all batches are returned.
     */
    batchIds: Uint8Array | string[];
    /**
     * An optional list of accounts to retrieve the leases of. If empty, leases
     * for all accounts are returned.
     */
    accounts: Uint8Array | string[];
}
export interface LeasesResponse {
    /** The relevant list of leases purchased or sold within the auction. */
    leases: Lease[];
    /** The total amount of satoshis earned from the leases returned. */
    totalAmtEarnedSat: string;
    /** The total amount of satoshis paid for the leases returned. */
    totalAmtPaidSat: string;
}
export interface TokensRequest {
}
export interface TokensResponse {
    /** List of all tokens the daemon knows of, including old/expired tokens. */
    tokens: LsatToken[];
}
export interface LsatToken {
    /** The base macaroon that was baked by the auth server. */
    baseMacaroon: Uint8Array | string;
    /** The payment hash of the payment that was paid to obtain the token. */
    paymentHash: Uint8Array | string;
    /**
     * The preimage of the payment hash, knowledge of this is proof that the
     * payment has been paid. If the preimage is set to all zeros, this means the
     * payment is still pending and the token is not yet fully valid.
     */
    paymentPreimage: Uint8Array | string;
    /** The amount of millisatoshis that was paid to get the token. */
    amountPaidMsat: string;
    /** The amount of millisatoshis paid in routing fee to pay for the token. */
    routingFeePaidMsat: string;
    /** The creation time of the token as UNIX timestamp in seconds. */
    timeCreated: string;
    /** Indicates whether the token is expired or still valid. */
    expired: boolean;
    /**
     * Identifying attribute of this token in the store. Currently represents the
     * file name of the token where it's stored on the file system.
     */
    storageName: string;
}
export interface LeaseDurationRequest {
}
export interface LeaseDurationResponse {
    /**
     * Deprecated, use lease_duration_buckets.
     *
     * @deprecated
     */
    leaseDurations: {
        [key: number]: boolean;
    };
    /**
     * The set of lease durations the market is currently accepting and the state
     * the duration buckets currently are in.
     */
    leaseDurationBuckets: {
        [key: number]: DurationBucketState;
    };
}
export interface LeaseDurationResponse_LeaseDurationsEntry {
    key: number;
    value: boolean;
}
export interface LeaseDurationResponse_LeaseDurationBucketsEntry {
    key: number;
    value: DurationBucketState;
}
export interface NextBatchInfoRequest {
}
export interface NextBatchInfoResponse {
    /**
     * The confirmation target the auctioneer will use for fee estimation of the
     * next batch.
     */
    confTarget: number;
    /**
     * The fee rate, in satoshis per kiloweight, estimated by the auctioneer to use
     * for the next batch.
     */
    feeRateSatPerKw: string;
    /**
     * The absolute unix timestamp in seconds at which the auctioneer will attempt
     * to clear the next batch.
     */
    clearTimestamp: string;
    /**
     * The value used by the auctioneer to determine if an account expiry height
     * needs to be extended after participating in a batch and for how long.
     */
    autoRenewExtensionBlocks: number;
}
export interface NodeRatingRequest {
    /** The target node to obtain ratings information for. */
    nodePubkeys: Uint8Array | string[];
}
export interface NodeRatingResponse {
    /** A series of node ratings for each of the queried nodes. */
    nodeRatings: NodeRating[];
}
export interface GetInfoRequest {
}
export interface GetInfoResponse {
    /** The version of the Pool daemon that is running. */
    version: string;
    /** The total number of accounts in the local database. */
    accountsTotal: number;
    /**
     * The total number of accounts that are in an active, non-archived state,
     * including expired accounts.
     */
    accountsActive: number;
    /** The total number of accounts that are active but have expired. */
    accountsActiveExpired: number;
    /** The total number of accounts that are in an archived/closed state. */
    accountsArchived: number;
    /** The total number of orders in the local database. */
    ordersTotal: number;
    /**
     * The total number of active/pending orders that are still waiting for
     * execution.
     */
    ordersActive: number;
    /** The total number of orders that have been archived. */
    ordersArchived: number;
    /** The current block height as seen by the connected lnd node. */
    currentBlockHeight: number;
    /** The number of batches an account of this node was ever involved in. */
    batchesInvolved: number;
    /** Our lnd node's rating as judged by the auctioneer server. */
    nodeRating: NodeRating | undefined;
    /** The number of available LSAT tokens. */
    lsatTokens: number;
    /**
     * Indicates whether there is an active subscription connection to the
     * auctioneer. This will never be true if there is no active account. If there
     * are active accounts, this value represents the network connection status to
     * the auctioneer server.
     */
    subscribedToAuctioneer: boolean;
    /**
     * Indicates whether the global `--newnodesonly` command line flag or
     * `newnodesonly=true` configuration parameter was set on the Pool trader
     * daemon.
     */
    newNodesOnly: boolean;
    /**
     * A map of all markets identified by their lease duration and the current
     * set of statistics such as number of open orders and total units of open
     * interest.
     */
    marketInfo: {
        [key: number]: MarketInfo;
    };
}
export interface GetInfoResponse_MarketInfoEntry {
    key: number;
    value: MarketInfo | undefined;
}
export interface StopDaemonRequest {
}
export interface StopDaemonResponse {
}
export interface OfferSidecarRequest {
    /**
     * If false, then only the trader_key, unit, self_chan_balance, and
     * lease_duration_blocks need to be set in the bid below. Otherwise, the
     * fields as they're set when submitting a bid need to be filled in.
     */
    autoNegotiate: boolean;
    /**
     * The bid template that will be used to populate the initial sidecar ticket
     * as well as auto negotiate the remainig steps of the sidecar channel if
     * needed.
     */
    bid: Bid | undefined;
}
export interface SidecarTicket {
    /**
     * The complete sidecar ticket in its string encoded form which is base58
     * encoded, has a human readable prefix ('sidecar...') and a checksum built in.
     * The string encoded version will only be used on the trader side of the API.
     * All requests to the auctioneer expect the ticket to be in its raw, tlv
     * encoded byte form.
     */
    ticket: string;
}
export interface DecodedSidecarTicket {
    /** The unique, pseudorandom identifier of the ticket. */
    id: Uint8Array | string;
    /** The version of the ticket encoding format. */
    version: number;
    /** The state of the ticket. */
    state: string;
    /** The offered channel capacity in satoshis. */
    offerCapacity: string;
    /** The offered push amount in satoshis. */
    offerPushAmount: string;
    /** The offered lease duration in blocks. */
    offerLeaseDurationBlocks: number;
    /** The public key the offer was signed with. */
    offerSignPubkey: Uint8Array | string;
    /** The signature over the offer's digest. */
    offerSignature: Uint8Array | string;
    /** Whether the offer was created with the automatic order creation flag. */
    offerAuto: boolean;
    /** The recipient node's public identity key. */
    recipientNodePubkey: Uint8Array | string;
    /**
     * The recipient node's channel multisig public key to be used for the sidecar
     * channel.
     */
    recipientMultisigPubkey: Uint8Array | string;
    /** The index used when deriving the above multisig pubkey. */
    recipientMultisigPubkeyIndex: number;
    /** The nonce of the bid order created for this sidecar ticket. */
    orderBidNonce: Uint8Array | string;
    /**
     * The signature over the order's digest, signed with the private key that
     * corresponds to the offer_sign_pubkey.
     */
    orderSignature: Uint8Array | string;
    /** The pending channel ID of the sidecar channel during the execution phase. */
    executionPendingChannelId: Uint8Array | string;
    /** The original, base58 encoded ticket. */
    encodedTicket: string;
    /**
     * If true, the channel acceptor for this ticket will expect an unannounced
     * channel.
     */
    offerUnannouncedChannel: boolean;
    /**
     * If true, the channel acceptor for this ticket will expect a zero conf
     * channel.
     */
    offerZeroConfChannel: boolean;
}
export interface RegisterSidecarRequest {
    /**
     * The sidecar ticket to register and add the node and channel funding
     * information to. The ticket must be in the state "offered".
     */
    ticket: string;
    /**
     * If this value is True, then the daemon will attempt to finish negotiating
     * the details of the sidecar channel automatically in the background. The
     * progress of the ticket can be monitored using the SidecarState RPC. In
     * addition, if this flag is set, then this method will _block_ until the
     * sidecar negotiation either finishes or breaks down.
     */
    autoNegotiate: boolean;
}
export interface ExpectSidecarChannelRequest {
    /**
     * The sidecar ticket to expect an incoming channel for. The ticket must be in
     * the state "ordered".
     */
    ticket: string;
}
export interface ExpectSidecarChannelResponse {
}
export interface ListSidecarsRequest {
    /**
     * The optional sidecar ID to filter for. If set, the result should either be
     * a single ticket or no ticket in most cases. But because the ID is just 8
     * bytes and is randomly generated, there could be collisions, especially since
     * tickets can also be crafted by a malicious party and given to any node.
     * That's why the offer's public key is also used as an identifying element
     * since that cannot easily be forged without also producing a valid signature.
     * So an attacker cannot overwrite a ticket a node offered by themselves
     * offering a ticket with the same ID and tricking the victim into registering
     * that. Long story sort, there could be multiple tickets with the same ID but
     * different offer public keys, which is why those keys should be checked as
     * well.
     */
    sidecarId: Uint8Array | string;
}
export interface ListSidecarsResponse {
    tickets: DecodedSidecarTicket[];
}
export interface CancelSidecarRequest {
    sidecarId: Uint8Array | string;
}
export interface CancelSidecarResponse {
}
export interface Trader {
    /**
     * pool: `getinfo`
     * GetInfo returns general information about the state of the Pool trader
     * daemon.
     */
    getInfo(request?: DeepPartial<GetInfoRequest>): Promise<GetInfoResponse>;
    /**
     * pool: `stop`
     * Stop gracefully shuts down the Pool trader daemon.
     */
    stopDaemon(request?: DeepPartial<StopDaemonRequest>): Promise<StopDaemonResponse>;
    /**
     * QuoteAccount gets a fee quote to fund an account of the given size with the
     * given confirmation target. If the connected lnd wallet doesn't have enough
     * balance to fund an account of the requested size, an error is returned.
     */
    quoteAccount(request?: DeepPartial<QuoteAccountRequest>): Promise<QuoteAccountResponse>;
    /**
     * pool: `accounts new`
     * InitAccount creates a new account with the requested size and expiration,
     * funding it from the wallet of the connected lnd node.
     */
    initAccount(request?: DeepPartial<InitAccountRequest>): Promise<Account>;
    /**
     * pool: `accounts list`
     * ListAccounts returns a list of all accounts known to the trader daemon and
     * their current state.
     */
    listAccounts(request?: DeepPartial<ListAccountsRequest>): Promise<ListAccountsResponse>;
    /**
     * pool: `accounts close`
     * CloseAccount closes an account and returns the funds locked in that account
     * to the connected lnd node's wallet.
     */
    closeAccount(request?: DeepPartial<CloseAccountRequest>): Promise<CloseAccountResponse>;
    /**
     * pool: `accounts withdraw`
     * WithdrawAccount splits off parts of the account balance into the specified
     * outputs while recreating the account with a reduced balance.
     */
    withdrawAccount(request?: DeepPartial<WithdrawAccountRequest>): Promise<WithdrawAccountResponse>;
    /**
     * pool: `accounts deposit`
     * DepositAccount adds more funds from the connected lnd node's wallet to an
     * account.
     */
    depositAccount(request?: DeepPartial<DepositAccountRequest>): Promise<DepositAccountResponse>;
    /**
     * pool: `accounts renew`
     * RenewAccount renews the expiration of an account.
     */
    renewAccount(request?: DeepPartial<RenewAccountRequest>): Promise<RenewAccountResponse>;
    /**
     * pool: `accounts bumpfee`
     * BumpAccountFee attempts to bump the fee of an account's transaction through
     * child-pays-for-parent (CPFP). Since the CPFP is performed through the
     * backing lnd node, the account transaction must contain an output under its
     * control for a successful bump. If a CPFP has already been performed for an
     * account, and this RPC is invoked again, then a replacing transaction (RBF)
     * of the child will be broadcast.
     */
    bumpAccountFee(request?: DeepPartial<BumpAccountFeeRequest>): Promise<BumpAccountFeeResponse>;
    /**
     * pool: `accounts recover`
     * RecoverAccounts queries the auction server for this trader daemon's accounts
     * in case we lost our local account database.
     */
    recoverAccounts(request?: DeepPartial<RecoverAccountsRequest>): Promise<RecoverAccountsResponse>;
    /**
     * pool: `accounts listfees`
     * AccountModificationFees returns a map from account key to an ordered list of
     * account action modification fees.
     */
    accountModificationFees(request?: DeepPartial<AccountModificationFeesRequest>): Promise<AccountModificationFeesResponse>;
    /**
     * pool: `orders submit`
     * SubmitOrder creates a new ask or bid order and submits for the given account
     * and submits it to the auction server for matching.
     */
    submitOrder(request?: DeepPartial<SubmitOrderRequest>): Promise<SubmitOrderResponse>;
    /**
     * pool: `orders list`
     * ListOrders returns a list of all active and archived orders that are
     * currently known to the trader daemon.
     */
    listOrders(request?: DeepPartial<ListOrdersRequest>): Promise<ListOrdersResponse>;
    /**
     * pool: `orders cancel`
     * CancelOrder cancels an active order with the auction server to remove it
     * from future matching.
     */
    cancelOrder(request?: DeepPartial<CancelOrderRequest>): Promise<CancelOrderResponse>;
    /**
     * QuoteOrder calculates the premium, execution fees and max batch fee rate for
     * an order based on the given order parameters.
     */
    quoteOrder(request?: DeepPartial<QuoteOrderRequest>): Promise<QuoteOrderResponse>;
    /**
     * pool: `auction fee`
     * AuctionFee returns the current auction order execution fee specified by the
     * auction server.
     */
    auctionFee(request?: DeepPartial<AuctionFeeRequest>): Promise<AuctionFeeResponse>;
    /**
     * pool: `auction leasedurations`
     * LeaseDurations returns the current set of valid lease duration in the
     * market as is, and also information w.r.t if the market is currently active.
     */
    leaseDurations(request?: DeepPartial<LeaseDurationRequest>): Promise<LeaseDurationResponse>;
    /**
     * pool: `auction nextbatchinfo`
     * NextBatchInfo returns information about the next batch the auctioneer will
     * perform.
     */
    nextBatchInfo(request?: DeepPartial<NextBatchInfoRequest>): Promise<NextBatchInfoResponse>;
    /**
     * pool: `auction snapshot`
     * BatchSnapshot returns the snapshot of a past batch identified by its ID.
     * If no ID is provided, the snapshot of the last finalized batch is returned.
     * Deprecated, use BatchSnapshots instead.
     */
    batchSnapshot(request?: DeepPartial<BatchSnapshotRequest>): Promise<BatchSnapshotResponse>;
    /**
     * pool: `listauth`
     * GetLsatTokens returns all LSAT tokens the daemon ever paid for.
     */
    getLsatTokens(request?: DeepPartial<TokensRequest>): Promise<TokensResponse>;
    /**
     * pool: `auction leases`
     * Leases returns the list of channels that were either purchased or sold by
     * the trader within the auction.
     */
    leases(request?: DeepPartial<LeasesRequest>): Promise<LeasesResponse>;
    /**
     * pool: `auction ratings`
     * Returns the Node Tier information for this target Lightning node, and other
     * related ranking information.
     */
    nodeRatings(request?: DeepPartial<NodeRatingRequest>): Promise<NodeRatingResponse>;
    /**
     * pool: `auction snapshot`
     * BatchSnapshots returns a list of batch snapshots starting at the start batch
     * ID and going back through the history of batches, returning at most the
     * number of specified batches. A maximum of 100 snapshots can be queried in
     * one call. If no start batch ID is provided, the most recent finalized batch
     * is used as the starting point to go back from.
     */
    batchSnapshots(request?: DeepPartial<BatchSnapshotsRequest>): Promise<BatchSnapshotsResponse>;
    /**
     * pool: `sidecar offer`
     * OfferSidecar is step 1/4 of the sidecar negotiation between the provider
     * (the trader submitting the bid order) and the recipient (the trader
     * receiving the sidecar channel).
     * This step must be run by the provider. The result is a sidecar ticket with
     * an offer to lease a sidecar channel for the recipient. The offer will be
     * signed with the provider's lnd node public key. The ticket returned by this
     * call will have the state "offered".
     */
    offerSidecar(request?: DeepPartial<OfferSidecarRequest>): Promise<SidecarTicket>;
    /**
     * pool: `sidecar register`
     * RegisterSidecarRequest is step 2/4 of the sidecar negotiation between the
     * provider (the trader submitting the bid order) and the recipient (the trader
     * receiving the sidecar channel).
     * This step must be run by the recipient. The result is a sidecar ticket with
     * the recipient's node information and channel funding multisig pubkey filled
     * in. The ticket returned by this call will have the state "registered".
     */
    registerSidecar(request?: DeepPartial<RegisterSidecarRequest>): Promise<SidecarTicket>;
    /**
     * pool: `sidecar expectchannel`
     * ExpectSidecarChannel is step 4/4 of the sidecar negotiation between the
     * provider (the trader submitting the bid order) and the recipient (the trader
     * receiving the sidecar channel).
     * This step must be run by the recipient once the provider has submitted the
     * bid order for the sidecar channel. From this point onwards the Pool trader
     * daemon of both the provider as well as the recipient need to be online to
     * receive and react to match making events from the server.
     */
    expectSidecarChannel(request?: DeepPartial<ExpectSidecarChannelRequest>): Promise<ExpectSidecarChannelResponse>;
    /**
     * pool: `sidecar printticket`
     * Decodes the base58 encoded sidecar ticket into its individual data fields
     * for a more human-readable representation.
     */
    decodeSidecarTicket(request?: DeepPartial<SidecarTicket>): Promise<DecodedSidecarTicket>;
    /**
     * pool: `sidecar list`
     * ListSidecars lists all sidecar tickets currently in the local database. This
     * includes tickets offered by our node as well as tickets that our node is the
     * recipient of. Optionally a ticket ID can be provided to filter the tickets.
     */
    listSidecars(request?: DeepPartial<ListSidecarsRequest>): Promise<ListSidecarsResponse>;
    /**
     * pool: `sidecar cancel`
     * CancelSidecar cancels the execution of a specific sidecar ticket. Depending
     * on the state of the sidecar ticket its associated bid order might be
     * canceled as well (if this ticket was offered by our node).
     */
    cancelSidecar(request?: DeepPartial<CancelSidecarRequest>): Promise<CancelSidecarResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=trader.d.ts.map