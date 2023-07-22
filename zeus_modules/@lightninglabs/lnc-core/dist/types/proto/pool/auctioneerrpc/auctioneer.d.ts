export declare enum ChannelType {
    /** TWEAKLESS - The channel supports static to_remote keys. */
    TWEAKLESS = "TWEAKLESS",
    /** ANCHORS - The channel uses an anchor-based commitment. */
    ANCHORS = "ANCHORS",
    /**
     * SCRIPT_ENFORCED_LEASE - The channel build upon the anchor-based commitment and requires an
     * additional CLTV of the channel lease maturity on any commitment and HTLC
     * outputs that pay directly to the channel initiator (the seller).
     */
    SCRIPT_ENFORCED_LEASE = "SCRIPT_ENFORCED_LEASE",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AuctionAccountState {
    /** STATE_PENDING_OPEN - The account's funding transaction is not yet confirmed on-chain. */
    STATE_PENDING_OPEN = "STATE_PENDING_OPEN",
    /** STATE_OPEN - The account is fully open and confirmed on-chain. */
    STATE_OPEN = "STATE_OPEN",
    /**
     * STATE_EXPIRED - The account is still open but the CLTV expiry has passed and the trader can
     * close it without the auctioneer's key. Orders for accounts in this state
     * won't be accepted.
     */
    STATE_EXPIRED = "STATE_EXPIRED",
    /**
     * STATE_PENDING_UPDATE - The account was modified by a deposit or withdrawal and is currently waiting
     * for the modifying transaction to confirm.
     */
    STATE_PENDING_UPDATE = "STATE_PENDING_UPDATE",
    /**
     * STATE_CLOSED - The account is closed. The auctioneer doesn't track whether the closing
     * transaction is already confirmed on-chain or not.
     */
    STATE_CLOSED = "STATE_CLOSED",
    /** STATE_PENDING_BATCH - The account has recently participated in a batch and is not yet confirmed. */
    STATE_PENDING_BATCH = "STATE_PENDING_BATCH",
    /**
     * STATE_EXPIRED_PENDING_UPDATE - The account has reached the expiration height while it had a pending update
     * that hasn't yet confirmed. This allows accounts to be renewed once
     * confirmed and expired.
     */
    STATE_EXPIRED_PENDING_UPDATE = "STATE_EXPIRED_PENDING_UPDATE",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum OrderChannelType {
    /** ORDER_CHANNEL_TYPE_UNKNOWN - Used to set defaults when a trader doesn't specify a channel type. */
    ORDER_CHANNEL_TYPE_UNKNOWN = "ORDER_CHANNEL_TYPE_UNKNOWN",
    /**
     * ORDER_CHANNEL_TYPE_PEER_DEPENDENT - The channel type will vary per matched channel based on the features shared
     * between its participants.
     */
    ORDER_CHANNEL_TYPE_PEER_DEPENDENT = "ORDER_CHANNEL_TYPE_PEER_DEPENDENT",
    /**
     * ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED - A channel type that builds upon the anchors commitment format to enforce
     * channel lease maturities in the commitment and HTLC outputs that pay to the
     * channel initiator/seller.
     */
    ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED = "ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum AuctionType {
    /**
     * AUCTION_TYPE_BTC_INBOUND_LIQUIDITY - Default auction type where the bidder is paying for getting bitcoin inbound
     * liqiudity from the asker.
     */
    AUCTION_TYPE_BTC_INBOUND_LIQUIDITY = "AUCTION_TYPE_BTC_INBOUND_LIQUIDITY",
    /**
     * AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY - Auction type where the bidder is paying the asker to accept a channel
     * (bitcoin outbound liquidity) from the bidder.
     */
    AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY = "AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum NodeTier {
    /**
     * TIER_DEFAULT - The default node tier. This value will be determined at run-time by the
     * current order version.
     */
    TIER_DEFAULT = "TIER_DEFAULT",
    /**
     * TIER_0 - Tier 0, bid with this tier are opting out of the smaller "higher
     * quality" pool of nodes to match their bids. Nodes in this tier are
     * considered to have "no rating".
     */
    TIER_0 = "TIER_0",
    /**
     * TIER_1 - Tier 1, the "base" node tier. Nodes in this tier are shown to have a
     * higher degree of up time and route-ability compared to the rest of the
     * nodes in the network. This is the current default node tier when
     * submitting bid orders.
     */
    TIER_1 = "TIER_1",
    UNRECOGNIZED = "UNRECOGNIZED"
}
/** Channel announcement constraints for matched channels. */
export declare enum ChannelAnnouncementConstraints {
    ANNOUNCEMENT_NO_PREFERENCE = "ANNOUNCEMENT_NO_PREFERENCE",
    ONLY_ANNOUNCED = "ONLY_ANNOUNCED",
    ONLY_UNANNOUNCED = "ONLY_UNANNOUNCED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
/** Channel confirmation constraints for matched channels. */
export declare enum ChannelConfirmationConstraints {
    CONFIRMATION_NO_PREFERENCE = "CONFIRMATION_NO_PREFERENCE",
    ONLY_CONFIRMED = "ONLY_CONFIRMED",
    ONLY_ZEROCONF = "ONLY_ZEROCONF",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum OrderState {
    ORDER_SUBMITTED = "ORDER_SUBMITTED",
    ORDER_CLEARED = "ORDER_CLEARED",
    ORDER_PARTIALLY_FILLED = "ORDER_PARTIALLY_FILLED",
    ORDER_EXECUTED = "ORDER_EXECUTED",
    ORDER_CANCELED = "ORDER_CANCELED",
    ORDER_EXPIRED = "ORDER_EXPIRED",
    ORDER_FAILED = "ORDER_FAILED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum DurationBucketState {
    /**
     * NO_MARKET - NO_MARKET indicates that this bucket doesn't actually exist, in that no
     * market is present for this market.
     */
    NO_MARKET = "NO_MARKET",
    /**
     * MARKET_CLOSED - MARKET_CLOSED indicates that this market exists, but that it isn't currently
     * running.
     */
    MARKET_CLOSED = "MARKET_CLOSED",
    /**
     * ACCEPTING_ORDERS - ACCEPTING_ORDERS indicates that we're accepting orders for this bucket, but
     * not yet clearing for this duration.
     */
    ACCEPTING_ORDERS = "ACCEPTING_ORDERS",
    /**
     * MARKET_OPEN - MARKET_OPEN indicates that we're accepting orders, and fully clearing the
     * market for this duration.
     */
    MARKET_OPEN = "MARKET_OPEN",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface ReserveAccountRequest {
    /** The desired value of the account in satoshis. */
    accountValue: string;
    /** The block height at which the account should expire. */
    accountExpiry: number;
    /** The trader's account key. */
    traderKey: Uint8Array | string;
    /** The account version. Must be set to 0 for legacy (non-taproot) accounts. */
    version: number;
}
export interface ReserveAccountResponse {
    /**
     * The base key of the auctioneer. This key should be tweaked with the trader's
     * per-batch tweaked key to obtain the corresponding per-batch tweaked
     * auctioneer key. Or, in case of the version 1, Taproot enabled account, the
     * trader and auctioneer key will be combined into a MuSig2 combined key that
     * is static throughout the lifetime of the account. The on-chain uniqueness of
     * the generated output will be ensured by the merkle root hash that is applied
     * as a tweak to the MuSig2 combined internal key. The merkle root hash is
     * either the hash of the timeout script path (which uses the trader key
     * tweaked with the per-batch key) directly or the root of a tree with one leaf
     * that is the timeout script path and a leaf that is a Taro commitment (which
     * is a root hash by itself).
     */
    auctioneerKey: Uint8Array | string;
    /**
     * The initial per-batch key to be used for the account. For every cleared
     * batch that the account participates in, this key will be incremented by the
     * base point of its curve, resulting in a new key for both the trader and
     * auctioneer in every batch.
     */
    initialBatchKey: Uint8Array | string;
}
export interface ServerInitAccountRequest {
    /**
     * Transaction output of the account. Has to be unspent and be a P2WSH of
     * the account script below. The amount must also exactly correspond to the
     * account value below.
     */
    accountPoint: OutPoint | undefined;
    /**
     * The script used to create the account point. For version 1 (Taproot enabled)
     * accounts this represents the 32-byte (x-only) Taproot public key with the
     * combined MuSig2 key of the auctioneer's key and the trader's key with the
     * expiry script path applied as a single tapscript leaf.
     */
    accountScript: Uint8Array | string;
    /**
     * The value of the account in satoshis. Must match the amount of the
     * account_point output.
     */
    accountValue: string;
    /** The block height at which the account should expire. */
    accountExpiry: number;
    /** The trader's account key. */
    traderKey: Uint8Array | string;
    /**
     * The user agent string that identifies the software running on the user's
     * side. This can be changed in the user's client software but it _SHOULD_
     * conform to the following pattern and use less than 256 characters:
     *    Agent-Name/semver-version(/additional-info)
     * Examples:
     *    poold/v0.4.2-beta/commit=3b635821,initiator=pool-cli
     *    litd/v0.4.0-alpha/commit=326d754,initiator=lit-ui
     */
    userAgent: string;
    /** The account version. Must be set to 0 for legacy (non-taproot) accounts. */
    version: number;
}
export interface ServerInitAccountResponse {
}
export interface ServerSubmitOrderRequest {
    /** Submit an ask order. */
    ask: ServerAsk | undefined;
    /** Submit a bid order. */
    bid: ServerBid | undefined;
    /**
     * The user agent string that identifies the software running on the user's
     * side. This can be changed in the user's client software but it _SHOULD_
     * conform to the following pattern and use less than 256 characters:
     *    Agent-Name/semver-version(/additional-info)
     * Examples:
     *    poold/v0.4.2-beta/commit=3b635821,initiator=pool-cli
     *    litd/v0.4.0-alpha/commit=326d754,initiator=lit-ui
     */
    userAgent: string;
}
export interface ServerSubmitOrderResponse {
    /** Order failed with the given reason. */
    invalidOrder: InvalidOrder | undefined;
    /** Order was accepted. */
    accepted: boolean | undefined;
}
export interface ServerCancelOrderRequest {
    /** The preimage to the order's unique nonce. */
    orderNoncePreimage: Uint8Array | string;
}
export interface ServerCancelOrderResponse {
}
export interface ClientAuctionMessage {
    /**
     * Signal the intent to receive updates about a certain account and start
     * by sending the commitment part of the authentication handshake. This is
     * step 1 of the 3-way handshake.
     */
    commit: AccountCommitment | undefined;
    /**
     * Subscribe to update and interactive order execution events for account
     * given and all its orders. Contains the final signature and is step 3 of
     * the 3-way authentication handshake.
     */
    subscribe: AccountSubscription | undefined;
    /** Accept the orders to be matched. */
    accept: OrderMatchAccept | undefined;
    /** Reject a whole batch. */
    reject: OrderMatchReject | undefined;
    /**
     * The channel funding negotiations with the matched peer were successful
     * and the inputs to spend from the accounts are now signed.
     */
    sign: OrderMatchSign | undefined;
    /**
     * The trader has lost its database and is trying to recover their
     * accounts. This message can be sent after the successful completion of
     * the 3-way authentication handshake where it will be established if the
     * account exists on the auctioneer's side. This message must only be sent
     * if the auctioneer knows of the account, otherwise it will regard it as a
     * critical error and terminate the connection.
     */
    recover: AccountRecovery | undefined;
}
export interface AccountCommitment {
    /**
     * The SHA256 hash of the trader's account key and a 32 byte random nonce.
     * commit_hash = SHA256(accountPubKey || nonce)
     */
    commitHash: Uint8Array | string;
    /**
     * The batch verification protocol version the client is using. Clients that
     * don't use the latest version will be declined to connect and participate in
     * an auction. The user should then be informed that a software update is
     * required.
     */
    batchVersion: number;
}
export interface AccountSubscription {
    /** The trader's account key of the account to subscribe to. */
    traderKey: Uint8Array | string;
    /** The random 32 byte nonce the trader used to create the commitment hash. */
    commitNonce: Uint8Array | string;
    /**
     * The signature over the auth_hash which is the hash of the commitment and
     * challenge. The signature is created with the trader's account key they
     * committed to.
     * auth_hash = SHA256(SHA256(accountPubKey || nonce) || challenge)
     */
    authSig: Uint8Array | string;
}
export interface OrderMatchAccept {
    /**
     * The batch ID this acceptance message refers to. Must be set to avoid out-of-
     * order responses from disrupting the batching process.
     */
    batchId: Uint8Array | string;
}
export interface OrderMatchReject {
    /** The ID of the batch to reject. */
    batchId: Uint8Array | string;
    /** The reason/error string for the rejection. */
    reason: string;
    /** The reason as a code. */
    reasonCode: OrderMatchReject_RejectReason;
    /**
     * The map of order nonces the trader was matched with but doesn't accept. The
     * map contains the _other_ trader's order nonces and the reason for rejecting
     * them. This can be a subset of the whole list of orders presented as matches
     * if the trader only wants to reject some of them. This map is only
     * considered by the auctioneer if the main reason_code is set to
     * PARTIAL_REJECT. Otherwise it is assumed that the whole batch was faulty for
     * some reason and that the trader rejects all orders contained. The auctioneer
     * will only accept a certain number of these partial rejects before a trader's
     * account is removed completely from the current batch. Abusing this
     * functionality can also lead to a ban of the trader.
     *
     * The order nonces are hex encoded strings because the protobuf map doesn't
     * allow raw bytes to be the map key type.
     */
    rejectedOrders: {
        [key: string]: OrderReject;
    };
}
export declare enum OrderMatchReject_RejectReason {
    /** UNKNOWN - The reason cannot be mapped to a specific code. */
    UNKNOWN = "UNKNOWN",
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
     * PARTIAL_REJECT - The client rejects some of the orders, not the full batch. When this
     * code is set, the rejected_orders map must be set.
     */
    PARTIAL_REJECT = "PARTIAL_REJECT",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface OrderMatchReject_RejectedOrdersEntry {
    key: string;
    value: OrderReject | undefined;
}
export interface OrderReject {
    /** The reason/error string for the rejection. */
    reason: string;
    /** The reason as a code. */
    reasonCode: OrderReject_OrderRejectReason;
}
export declare enum OrderReject_OrderRejectReason {
    /**
     * DUPLICATE_PEER - The trader's client has a preference to only match orders with peers it
     * doesn't already have channels with. The order that is rejected with this
     * reason type comes from a peer that the trader already has channels with.
     */
    DUPLICATE_PEER = "DUPLICATE_PEER",
    /**
     * CHANNEL_FUNDING_FAILED - The trader's client couldn't connect to the remote node of the matched
     * order or the channel funding could not be initialized for another
     * reason. This could also be the rejecting node's fault if their
     * connection is not stable. Using this code can have a negative impact on
     * the reputation score of both nodes, depending on the number of errors
     * recorded.
     */
    CHANNEL_FUNDING_FAILED = "CHANNEL_FUNDING_FAILED",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface ChannelInfo {
    /** The identifying type of the channel. */
    type: ChannelType;
    /** The node's identifying public key. */
    localNodeKey: Uint8Array | string;
    /** The remote node's identifying public key. */
    remoteNodeKey: Uint8Array | string;
    /**
     * The node's base public key used within the non-delayed pay-to-self output on
     * the commitment transaction.
     */
    localPaymentBasePoint: Uint8Array | string;
    /**
     * RemotePaymentBasePoint is the remote node's base public key used within the
     * non-delayed pay-to-self output on the commitment transaction.
     */
    remotePaymentBasePoint: Uint8Array | string;
}
export interface OrderMatchSign {
    /** The ID of the batch that the signatures are meant for. */
    batchId: Uint8Array | string;
    /**
     * A map with the signatures to spend the accounts being spent in a batch
     * transaction. The map key corresponds to the trader's account key of the
     * account in the batch transaction. The account key/ID has to be hex encoded
     * into a string because protobuf doesn't allow bytes as a map key data type.
     * For version 1 (Taproot enabled) accounts, this merely represents a partial
     * MuSig2 signature that can be combined into a full signature by the auction
     * server by adding its own partial signature. A set of nonces will be provided
     * by the trader for each v1 account to allow finalizing the MuSig2 signing
     * session.
     */
    accountSigs: {
        [key: string]: Uint8Array | string;
    };
    /**
     * The information for each channel created as part of a batch that's submitted
     * to the auctioneer to ensure they can properly enforce a channel's service
     * lifetime. Entries are indexed by the string representation of a channel's
     * outpoint.
     */
    channelInfos: {
        [key: string]: ChannelInfo;
    };
    /**
     * A set of 66-byte nonces for each version 1 (Taproot enabled) account. The
     * nonces can be used to produce a MuSig2 partial signature to spend the
     * account using the key spend path, which is a MuSig2 combined key of the
     * auctioneer key and the trader key.
     */
    traderNonces: {
        [key: string]: Uint8Array | string;
    };
}
export interface OrderMatchSign_AccountSigsEntry {
    key: string;
    value: Uint8Array | string;
}
export interface OrderMatchSign_ChannelInfosEntry {
    key: string;
    value: ChannelInfo | undefined;
}
export interface OrderMatchSign_TraderNoncesEntry {
    key: string;
    value: Uint8Array | string;
}
export interface AccountRecovery {
    /** The trader's account key of the account to recover. */
    traderKey: Uint8Array | string;
}
export interface ServerAuctionMessage {
    /**
     * Step 2 of the 3-way authentication handshake. Contains the
     * authentication challenge. Subscriptions sent by the trader must sign
     * the message SHA256(SHA256(accountPubKey || nonce) || challenge)
     * with their account key to prove ownership of said key.
     */
    challenge: ServerChallenge | undefined;
    /**
     * The trader has subscribed to account updates successfully, the 3-way
     * authentication handshake completed normally.
     */
    success: SubscribeSuccess | undefined;
    /**
     * An error occurred during any part of the communication. The trader
     * should inspect the error code and act accordingly.
     */
    error: SubscribeError | undefined;
    /**
     * The auctioneer has matched a set of orders into a batch and now
     * instructs the traders to validate the batch and prepare for order
     * execution. Because traders have the possibility of backing out of a
     * batch, multiple of these messages with the SAME batch_id can be sent.
     */
    prepare: OrderMatchPrepare | undefined;
    /**
     * This message is sent after all traders send back an OrderMatchAccept
     * method. It signals that the traders should execute their local funding
     * protocol, then send signatures for their account inputs.
     */
    sign: OrderMatchSignBegin | undefined;
    /**
     * All traders have accepted and signed the batch and the final transaction
     * was broadcast.
     */
    finalize: OrderMatchFinalize | undefined;
    /**
     * The answer to a trader's request for account recovery. This message
     * contains all information that is needed to restore the account to
     * working order on the trader side.
     */
    account: AuctionAccount | undefined;
}
export interface ServerChallenge {
    /**
     * The unique challenge for each stream that has to be signed with the trader's
     * account key for each account subscription.
     */
    challenge: Uint8Array | string;
    /** The commit hash the challenge was created for. */
    commitHash: Uint8Array | string;
}
export interface SubscribeSuccess {
    /** The trader's account key this message is referring to. */
    traderKey: Uint8Array | string;
}
export interface MatchedMarket {
    /**
     * Maps a user's own order_nonce to the opposite order type they were matched
     * with. The order_nonce is a 32 byte hex encoded string because bytes is not
     * allowed as a map key data type in protobuf.
     */
    matchedOrders: {
        [key: string]: MatchedOrder;
    };
    /**
     * The uniform clearing price rate in parts per billion that was used for this
     * batch.
     */
    clearingPriceRate: number;
}
export interface MatchedMarket_MatchedOrdersEntry {
    key: string;
    value: MatchedOrder | undefined;
}
export interface OrderMatchPrepare {
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    matchedOrders: {
        [key: string]: MatchedOrder;
    };
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    clearingPriceRate: number;
    /**
     * A list of the user's own accounts that are being spent by the matched
     * orders. The list contains the differences that would be applied by the
     * server when executing the orders.
     */
    chargedAccounts: AccountDiff[];
    /** The fee parameters used to calculate the execution fees. */
    executionFee: ExecutionFee | undefined;
    /** The batch transaction with all non-witness data. */
    batchTransaction: Uint8Array | string;
    /**
     * Fee rate of the batch transaction, expressed in satoshis per 1000 weight
     * units (sat/kW).
     */
    feeRateSatPerKw: string;
    /**
     * Fee rebate in satoshis, offered if another batch participant wants to pay
     * more fees for a faster confirmation.
     */
    feeRebateSat: string;
    /** The 32 byte unique identifier of this batch. */
    batchId: Uint8Array | string;
    /**
     * The batch verification protocol version the server is using. Clients that
     * don't support this version MUST return an `OrderMatchAccept` message with
     * an empty list of orders so the batch can continue. The user should then be
     * informed that a software update is required.
     */
    batchVersion: number;
    /**
     * Maps the distinct lease duration markets to the orders that were matched
     * within and the discovered market clearing price.
     */
    matchedMarkets: {
        [key: number]: MatchedMarket;
    };
    /**
     * The earliest absolute height in the chain in which the batch transaction can
     * be found within. This will be used by traders to base off their absolute
     * channel lease maturity height.
     */
    batchHeightHint: number;
}
export interface OrderMatchPrepare_MatchedOrdersEntry {
    key: string;
    value: MatchedOrder | undefined;
}
export interface OrderMatchPrepare_MatchedMarketsEntry {
    key: number;
    value: MatchedMarket | undefined;
}
export interface TxOut {
    /** The value of the transaction output in satoshis. */
    value: string;
    /** The public key script of the output. */
    pkScript: Uint8Array | string;
}
export interface OrderMatchSignBegin {
    /** The 32 byte unique identifier of this batch. */
    batchId: Uint8Array | string;
    /**
     * A set of 66-byte nonces for each version 1 (Taproot enabled) account. The
     * nonces can be used to produce a MuSig2 partial signature to spend the
     * account using the key spend path, which is a MuSig2 combined key of the
     * auctioneer key and the trader key.
     */
    serverNonces: {
        [key: string]: Uint8Array | string;
    };
    /**
     * The full list of UTXO information for each of the inputs being spent. This
     * is required when spending one or more Taproot enabled (account version 1)
     * outputs.
     */
    prevOutputs: TxOut[];
}
export interface OrderMatchSignBegin_ServerNoncesEntry {
    key: string;
    value: Uint8Array | string;
}
export interface OrderMatchFinalize {
    /** The unique identifier of the finalized batch. */
    batchId: Uint8Array | string;
    /** The final transaction ID of the published batch transaction. */
    batchTxid: Uint8Array | string;
}
export interface SubscribeError {
    /** The string representation of the subscription error. */
    error: string;
    /** The error code of the subscription error. */
    errorCode: SubscribeError_Error;
    /**
     * The trader's account key this error is referring to. This is not set if
     * the error code is SERVER_SHUTDOWN as that error is only sent once per
     * connection and not per individual subscription.
     */
    traderKey: Uint8Array | string;
    /**
     * The auctioneer's partial account information as it was stored when creating
     * the reservation. This is only set if the error code is
     * INCOMPLETE_ACCOUNT_RESERVATION. Only the fields value, expiry, trader_key,
     * auctioneer_key, batch_key and height_hint will be set in that
     * case.
     */
    accountReservation: AuctionAccount | undefined;
}
export declare enum SubscribeError_Error {
    /** UNKNOWN - The error cannot be mapped to a specific code. */
    UNKNOWN = "UNKNOWN",
    /**
     * SERVER_SHUTDOWN - The server is shutting down for maintenance. Traders should close the
     * long-lived stream/connection and try to connect again after some time.
     */
    SERVER_SHUTDOWN = "SERVER_SHUTDOWN",
    /**
     * ACCOUNT_DOES_NOT_EXIST - The account the trader tried to subscribe to does not exist in the
     * auctioneer's database.
     */
    ACCOUNT_DOES_NOT_EXIST = "ACCOUNT_DOES_NOT_EXIST",
    /**
     * INCOMPLETE_ACCOUNT_RESERVATION - The account the trader tried to subscribe to was never completed and a
     * reservation for it is still pending.
     */
    INCOMPLETE_ACCOUNT_RESERVATION = "INCOMPLETE_ACCOUNT_RESERVATION",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface AuctionAccount {
    /**
     * The value of the account in satoshis. Must match the amount of the
     * account_point output.
     */
    value: string;
    /** The block height at which the account should expire. */
    expiry: number;
    /** The trader's account key. */
    traderKey: Uint8Array | string;
    /** The long term auctioneer's account key. */
    auctioneerKey: Uint8Array | string;
    /** The current batch key used to create the account output. */
    batchKey: Uint8Array | string;
    /** The current state of the account as the auctioneer sees it. */
    state: AuctionAccountState;
    /**
     * The block height of the last change to the account's output. Can be used to
     * scan the chain for the output's spend state more efficiently.
     */
    heightHint: number;
    /**
     * Transaction output of the account. Depending on the state of the account,
     * this output might have been spent.
     */
    outpoint: OutPoint | undefined;
    /**
     * The latest transaction of an account. This is only known by the auctioneer
     * after the account has met its initial funding confirmation.
     */
    latestTx: Uint8Array | string;
    /** The account version. Will be set to 0 for legacy (non-taproot) accounts. */
    version: number;
}
export interface MatchedOrder {
    /**
     * The bids the trader's own order was matched against. This list is empty if
     * the trader's order was a bid order itself.
     */
    matchedBids: MatchedBid[];
    /**
     * The asks the trader's own order was matched against. This list is empty if
     * the trader's order was an ask order itself.
     */
    matchedAsks: MatchedAsk[];
}
export interface MatchedAsk {
    /** The ask order that was matched against. */
    ask: ServerAsk | undefined;
    /** The number of units that were filled from/by this matched order. */
    unitsFilled: number;
}
export interface MatchedBid {
    /** The ask order that was matched against. */
    bid: ServerBid | undefined;
    /** The number of units that were filled from/by this matched order. */
    unitsFilled: number;
}
export interface AccountDiff {
    /** The final balance of the account after the executed batch. */
    endingBalance: string;
    /**
     * Depending on the amount of the final balance of the account, the remainder
     * is either sent to a new on-chain output, extended off-chain or fully
     * consumed by the batch and its fees.
     */
    endingState: AccountDiff_AccountState;
    /**
     * If the account was re-created on-chain then the new account's index in the
     * transaction is set here. If the account was fully spent or the remainder was
     * extended off-chain then no new account outpoint is created and -1 is
     * returned here.
     */
    outpointIndex: number;
    /** The trader's account key this diff is referring to. */
    traderKey: Uint8Array | string;
    /**
     * The new account expiry height used to verify the batch. If the batch is
     * successfully executed the account must update its expiry height to this
     * value.
     */
    newExpiry: number;
    /**
     * The new account version used to verify the batch. If this is non-zero, it
     * means the account was automatically upgraded to the given version during the
     * batch execution.
     */
    newVersion: number;
}
export declare enum AccountDiff_AccountState {
    OUTPUT_RECREATED = "OUTPUT_RECREATED",
    OUTPUT_DUST_EXTENDED_OFFCHAIN = "OUTPUT_DUST_EXTENDED_OFFCHAIN",
    OUTPUT_DUST_ADDED_TO_FEES = "OUTPUT_DUST_ADDED_TO_FEES",
    OUTPUT_FULLY_SPENT = "OUTPUT_FULLY_SPENT",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface ServerOrder {
    /** The trader's account key of the account to use for the order. */
    traderKey: Uint8Array | string;
    /** Fixed order rate in parts per billion. */
    rateFixed: number;
    /** Order amount in satoshis. */
    amt: string;
    minChanAmt: string;
    /** Order nonce of 32 byte length, acts as unique order identifier. */
    orderNonce: Uint8Array | string;
    /**
     * Signature of the order's digest, signed with the user's account key. The
     * signature must be fixed-size LN wire format encoded. Version 0 includes the
     * fields version, rate_fixed, amt, max_batch_fee_rate_sat_per_kw and
     * lease_duration_blocks in the order digest.
     */
    orderSig: Uint8Array | string;
    /**
     * The multi signature key of the node creating the order, will be used for the
     * target channel's funding TX 2-of-2 multi signature output.
     */
    multiSigKey: Uint8Array | string;
    /** The pubkey of the node creating the order. */
    nodePub: Uint8Array | string;
    /** The network addresses of the node creating the order. */
    nodeAddr: NodeAddress[];
    /** The type of the channel that should be opened. */
    channelType: OrderChannelType;
    /**
     * Maximum fee rate the trader is willing to pay for the batch transaction,
     * expressed in satoshis per 1000 weight units (sat/kW).
     */
    maxBatchFeeRateSatPerKw: string;
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
export interface ServerBid {
    /** The common fields shared between both ask and bid order types. */
    details: ServerOrder | undefined;
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
     * dubbed a "sidecar channel") then this boolean needs to be set to true. The
     * multi_sig_key, node_pub and node_addr fields of the order details must then
     * correspond to the recipient node's details.
     */
    isSidecarChannel: boolean;
    /** Signals if this bid is interested in an announced or unannounced channel. */
    unannouncedChannel: boolean;
    /** Signals if this bid is interested in a zero conf channel or not. */
    zeroConfChannel: boolean;
}
export interface ServerAsk {
    /** The common fields shared between both ask and bid order types. */
    details: ServerOrder | undefined;
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
export interface CancelOrder {
    orderNonce: Uint8Array | string;
}
export interface InvalidOrder {
    orderNonce: Uint8Array | string;
    failReason: InvalidOrder_FailReason;
    failString: string;
}
export declare enum InvalidOrder_FailReason {
    INVALID_AMT = "INVALID_AMT",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface ServerInput {
    /** The outpoint that the input corresponds to. */
    outpoint: OutPoint | undefined;
    /**
     * The signature script required by the input. This only applies to NP2WKH
     * inputs.
     */
    sigScript: Uint8Array | string;
}
export interface ServerOutput {
    /** The value, in satoshis, of the output. */
    value: string;
    /** The script of the output to send the value to. */
    script: Uint8Array | string;
}
export interface ServerModifyAccountRequest {
    /** The trader's account key of the account to be modified. */
    traderKey: Uint8Array | string;
    /**
     * An additional set of inputs that can be included in the spending transaction
     * of an account. These can be used to deposit more funds into an account.
     * These must be under control of the backing lnd node's wallet.
     */
    newInputs: ServerInput[];
    /**
     * An additional set of outputs that can be included in the spending
     * transaction of an account. These can be used to withdraw funds from an
     * account.
     */
    newOutputs: ServerOutput[];
    /** The new parameters to apply for the account. */
    newParams: ServerModifyAccountRequest_NewAccountParameters | undefined;
    /**
     * A set of 66-byte nonces for each version 1 (Taproot enabled) account. The
     * nonces can be used to produce a MuSig2 partial signature to spend the
     * account using the key spend path, which is a MuSig2 combined key of the
     * auctioneer key and the trader key.
     */
    traderNonces: Uint8Array | string;
    /**
     * The full list of UTXO information for each of the inputs being spent. This
     * is required when spending a Taproot enabled (account version 1) output or
     * when adding additional Taproot inputs.
     */
    prevOutputs: TxOut[];
}
export interface ServerModifyAccountRequest_NewAccountParameters {
    /** The new value of the account. */
    value: string;
    /** The new expiry of the account as an absolute height. */
    expiry: number;
    /** The new version of the account. */
    version: number;
}
export interface ServerModifyAccountResponse {
    /**
     * The auctioneer's signature that allows a trader to broadcast a transaction
     * spending from an account output. For version 1 (Taproot enabled) accounts,
     * this merely represents a partial MuSig2 signature that can be combined into
     * a full signature by the trader daemon by adding its own partial signature. A
     * set of nonces will be provided by the server (in case this is a v1 account)
     * to allow finalizing the MuSig2 signing session.
     */
    accountSig: Uint8Array | string;
    /**
     * An optional set of 66-byte nonces for a version 1 (Taproot enabled) account
     * spend. The nonces can be used to produce a MuSig2 partial signature to spend
     * the account using the key spend path, which is a MuSig2 combined key of the
     * auctioneer key and the trader key.
     */
    serverNonces: Uint8Array | string;
}
export interface ServerOrderStateRequest {
    orderNonce: Uint8Array | string;
}
export interface ServerOrderStateResponse {
    /** The state the order currently is in. */
    state: OrderState;
    /**
     * The number of currently unfilled units of this order. This will be equal to
     * the total amount of units until the order has reached the state PARTIAL_FILL
     * or EXECUTED.
     */
    unitsUnfulfilled: number;
}
export interface TermsRequest {
}
export interface TermsResponse {
    /** The maximum account size in satoshis currently allowed by the auctioneer. */
    maxAccountValue: string;
    /**
     * Deprecated, use explicit order duration from lease_duration_buckets.
     *
     * @deprecated
     */
    maxOrderDurationBlocks: number;
    /** The execution fee charged per matched order. */
    executionFee: ExecutionFee | undefined;
    /**
     * Deprecated, use lease_duration_buckets.
     *
     * @deprecated
     */
    leaseDurations: {
        [key: number]: boolean;
    };
    /** The confirmation target to use for fee estimation of the next batch. */
    nextBatchConfTarget: number;
    /**
     * The fee rate, in satoshis per kiloweight, estimated to use for the next
     * batch.
     */
    nextBatchFeeRateSatPerKw: string;
    /**
     * The absolute unix timestamp at which the auctioneer will attempt to clear
     * the next batch.
     */
    nextBatchClearTimestamp: string;
    /**
     * The set of lease durations the market is currently accepting and the state
     * the duration buckets currently are in.
     */
    leaseDurationBuckets: {
        [key: number]: DurationBucketState;
    };
    /**
     * The value used by the auctioneer to determine if an account expiry height
     * needs to be extended after participating in a batch and for how long.
     */
    autoRenewExtensionBlocks: number;
}
export interface TermsResponse_LeaseDurationsEntry {
    key: number;
    value: boolean;
}
export interface TermsResponse_LeaseDurationBucketsEntry {
    key: number;
    value: DurationBucketState;
}
export interface RelevantBatchRequest {
    /** The unique identifier of the batch. */
    id: Uint8Array | string;
    /**
     * The set of accounts the trader is interested in retrieving information
     * for within the batch. Each account is identified by its trader key.
     */
    accounts: Uint8Array | string[];
}
export interface RelevantBatch {
    /** The version of the batch. */
    version: number;
    /** The unique identifier of the batch. */
    id: Uint8Array | string;
    /**
     * The set of modifications that should be applied to the requested accounts as
     * a result of this batch.
     */
    chargedAccounts: AccountDiff[];
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    matchedOrders: {
        [key: string]: MatchedOrder;
    };
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    clearingPriceRate: number;
    /** The fee parameters used to calculate the execution fees. */
    executionFee: ExecutionFee | undefined;
    /** The batch transaction including all witness data. */
    transaction: Uint8Array | string;
    /**
     * Fee rate of the batch transaction, expressed in satoshis per 1000 weight
     * units (sat/kW).
     */
    feeRateSatPerKw: string;
    /** The unix timestamp in nanoseconds the batch was made. */
    creationTimestampNs: string;
    /**
     * Maps the distinct lease duration markets to the orders that were matched
     * within and the discovered market clearing price.
     */
    matchedMarkets: {
        [key: number]: MatchedMarket;
    };
}
export interface RelevantBatch_MatchedOrdersEntry {
    key: string;
    value: MatchedOrder | undefined;
}
export interface RelevantBatch_MatchedMarketsEntry {
    key: number;
    value: MatchedMarket | undefined;
}
export interface ExecutionFee {
    /** The base fee in satoshis charged per order, regardless of the matched size. */
    baseFee: string;
    /** The fee rate in parts per million. */
    feeRate: string;
}
export interface NodeAddress {
    network: string;
    addr: string;
}
export interface OutPoint {
    /** Raw bytes representing the transaction id. */
    txid: Uint8Array | string;
    /** The index of the output on the transaction. */
    outputIndex: number;
}
export interface AskSnapshot {
    /** The version of the order. */
    version: number;
    /** The period of time the channel will survive for. */
    leaseDurationBlocks: number;
    /** The true bid price of the order in parts per billion. */
    rateFixed: number;
    /** The channel type to be created. */
    chanType: OrderChannelType;
}
export interface BidSnapshot {
    /** The version of the order. */
    version: number;
    /** The period of time the matched channel should be allocated for. */
    leaseDurationBlocks: number;
    /** The true bid price of the order in parts per billion. */
    rateFixed: number;
    /** The channel type to be created. */
    chanType: OrderChannelType;
}
export interface MatchedOrderSnapshot {
    /** The full ask order that was matched. */
    ask: AskSnapshot | undefined;
    /** The full bid order that was matched. */
    bid: BidSnapshot | undefined;
    /** The fixed rate premium that was matched, expressed in parts-ber-billion. */
    matchingRate: number;
    /** The total number of satoshis that were bought. */
    totalSatsCleared: string;
    /** The total number of units that were matched. */
    unitsMatched: number;
}
export interface BatchSnapshotRequest {
    /** The unique identifier of the batch encoded as a compressed pubkey. */
    batchId: Uint8Array | string;
}
export interface MatchedMarketSnapshot {
    /** The set of all orders matched in the batch. */
    matchedOrders: MatchedOrderSnapshot[];
    /**
     * The uniform clearing price rate in parts per billion that was used for this
     * batch.
     */
    clearingPriceRate: number;
}
export interface BatchSnapshotResponse {
    /** The version of the batch. */
    version: number;
    /** The unique identifier of the batch. */
    batchId: Uint8Array | string;
    /** The unique identifier of the prior batch. */
    prevBatchId: Uint8Array | string;
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    clearingPriceRate: number;
    /**
     * Deprecated, use matched_markets.
     *
     * @deprecated
     */
    matchedOrders: MatchedOrderSnapshot[];
    /** The txid of the batch transaction. */
    batchTxId: string;
    /** The batch transaction including all witness data. */
    batchTx: Uint8Array | string;
    /** The fee rate, in satoshis per kiloweight, of the batch transaction. */
    batchTxFeeRateSatPerKw: string;
    /** The unix timestamp in nanoseconds the batch was made. */
    creationTimestampNs: string;
    /**
     * Maps the distinct lease duration markets to the orders that were matched
     * within and the discovered market clearing price.
     */
    matchedMarkets: {
        [key: number]: MatchedMarketSnapshot;
    };
}
export interface BatchSnapshotResponse_MatchedMarketsEntry {
    key: number;
    value: MatchedMarketSnapshot | undefined;
}
export interface ServerNodeRatingRequest {
    /** The target node to obtain ratings information for. */
    nodePubkeys: Uint8Array | string[];
}
export interface NodeRating {
    /** The pubkey for the node these ratings belong to. */
    nodePubkey: Uint8Array | string;
    /** The tier of the target node. */
    nodeTier: NodeTier;
}
export interface ServerNodeRatingResponse {
    /** A series of node ratings for each of the queried nodes. */
    nodeRatings: NodeRating[];
}
export interface BatchSnapshotsRequest {
    /**
     * The unique identifier of the first batch to return, encoded as a compressed
     * pubkey. This represents the newest/most current batch to fetch. If this is
     * empty or a zero batch ID, the most recent finalized batch is used as the
     * starting point to go back from.
     */
    startBatchId: Uint8Array | string;
    /** The number of batches to return at most, including the start batch. */
    numBatchesBack: number;
}
export interface BatchSnapshotsResponse {
    /** The list of batches requested. */
    batches: BatchSnapshotResponse[];
}
export interface MarketInfoRequest {
}
export interface MarketInfo {
    /** The number of open/pending ask orders per node tier. */
    numAsks: MarketInfo_TierValue[];
    /** The number of open/pending bid orders per node tier. */
    numBids: MarketInfo_TierValue[];
    /**
     * The total number of open/unmatched units in open/pending ask orders per node
     * tier.
     */
    askOpenInterestUnits: MarketInfo_TierValue[];
    /**
     * The total number of open/unmatched units in open/pending bid orders per node
     * tier.
     */
    bidOpenInterestUnits: MarketInfo_TierValue[];
}
export interface MarketInfo_TierValue {
    tier: NodeTier;
    value: number;
}
export interface MarketInfoResponse {
    /**
     * A map of all markets identified by their lease duration and the current
     * set of statistics.
     */
    markets: {
        [key: number]: MarketInfo;
    };
}
export interface MarketInfoResponse_MarketsEntry {
    key: number;
    value: MarketInfo | undefined;
}
export interface ChannelAuctioneer {
    reserveAccount(request?: DeepPartial<ReserveAccountRequest>): Promise<ReserveAccountResponse>;
    initAccount(request?: DeepPartial<ServerInitAccountRequest>): Promise<ServerInitAccountResponse>;
    modifyAccount(request?: DeepPartial<ServerModifyAccountRequest>): Promise<ServerModifyAccountResponse>;
    submitOrder(request?: DeepPartial<ServerSubmitOrderRequest>): Promise<ServerSubmitOrderResponse>;
    cancelOrder(request?: DeepPartial<ServerCancelOrderRequest>): Promise<ServerCancelOrderResponse>;
    orderState(request?: DeepPartial<ServerOrderStateRequest>): Promise<ServerOrderStateResponse>;
    subscribeBatchAuction(request?: DeepPartial<ClientAuctionMessage>, onMessage?: (msg: ServerAuctionMessage) => void, onError?: (err: Error) => void): void;
    subscribeSidecar(request?: DeepPartial<ClientAuctionMessage>, onMessage?: (msg: ServerAuctionMessage) => void, onError?: (err: Error) => void): void;
    terms(request?: DeepPartial<TermsRequest>): Promise<TermsResponse>;
    relevantBatchSnapshot(request?: DeepPartial<RelevantBatchRequest>): Promise<RelevantBatch>;
    batchSnapshot(request?: DeepPartial<BatchSnapshotRequest>): Promise<BatchSnapshotResponse>;
    nodeRating(request?: DeepPartial<ServerNodeRatingRequest>): Promise<ServerNodeRatingResponse>;
    batchSnapshots(request?: DeepPartial<BatchSnapshotsRequest>): Promise<BatchSnapshotsResponse>;
    marketInfo(request?: DeepPartial<MarketInfoRequest>): Promise<MarketInfoResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=auctioneer.d.ts.map