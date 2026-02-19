"use strict";
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidOrder_FailReason = exports.AccountDiff_AccountState = exports.SubscribeError_Error = exports.OrderReject_OrderRejectReason = exports.OrderMatchReject_RejectReason = exports.DurationBucketState = exports.OrderState = exports.ChannelConfirmationConstraints = exports.ChannelAnnouncementConstraints = exports.NodeTier = exports.AuctionType = exports.OrderChannelType = exports.AuctionAccountState = exports.ChannelType = void 0;
var ChannelType;
(function (ChannelType) {
    /** TWEAKLESS - The channel supports static to_remote keys. */
    ChannelType["TWEAKLESS"] = "TWEAKLESS";
    /** ANCHORS - The channel uses an anchor-based commitment. */
    ChannelType["ANCHORS"] = "ANCHORS";
    /**
     * SCRIPT_ENFORCED_LEASE - The channel build upon the anchor-based commitment and requires an
     * additional CLTV of the channel lease maturity on any commitment and HTLC
     * outputs that pay directly to the channel initiator (the seller).
     */
    ChannelType["SCRIPT_ENFORCED_LEASE"] = "SCRIPT_ENFORCED_LEASE";
    ChannelType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChannelType = exports.ChannelType || (exports.ChannelType = {}));
var AuctionAccountState;
(function (AuctionAccountState) {
    /** STATE_PENDING_OPEN - The account's funding transaction is not yet confirmed on-chain. */
    AuctionAccountState["STATE_PENDING_OPEN"] = "STATE_PENDING_OPEN";
    /** STATE_OPEN - The account is fully open and confirmed on-chain. */
    AuctionAccountState["STATE_OPEN"] = "STATE_OPEN";
    /**
     * STATE_EXPIRED - The account is still open but the CLTV expiry has passed and the trader can
     * close it without the auctioneer's key. Orders for accounts in this state
     * won't be accepted.
     */
    AuctionAccountState["STATE_EXPIRED"] = "STATE_EXPIRED";
    /**
     * STATE_PENDING_UPDATE - The account was modified by a deposit or withdrawal and is currently waiting
     * for the modifying transaction to confirm.
     */
    AuctionAccountState["STATE_PENDING_UPDATE"] = "STATE_PENDING_UPDATE";
    /**
     * STATE_CLOSED - The account is closed. The auctioneer doesn't track whether the closing
     * transaction is already confirmed on-chain or not.
     */
    AuctionAccountState["STATE_CLOSED"] = "STATE_CLOSED";
    /** STATE_PENDING_BATCH - The account has recently participated in a batch and is not yet confirmed. */
    AuctionAccountState["STATE_PENDING_BATCH"] = "STATE_PENDING_BATCH";
    /**
     * STATE_EXPIRED_PENDING_UPDATE - The account has reached the expiration height while it had a pending update
     * that hasn't yet confirmed. This allows accounts to be renewed once
     * confirmed and expired.
     */
    AuctionAccountState["STATE_EXPIRED_PENDING_UPDATE"] = "STATE_EXPIRED_PENDING_UPDATE";
    AuctionAccountState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AuctionAccountState = exports.AuctionAccountState || (exports.AuctionAccountState = {}));
var OrderChannelType;
(function (OrderChannelType) {
    /** ORDER_CHANNEL_TYPE_UNKNOWN - Used to set defaults when a trader doesn't specify a channel type. */
    OrderChannelType["ORDER_CHANNEL_TYPE_UNKNOWN"] = "ORDER_CHANNEL_TYPE_UNKNOWN";
    /**
     * ORDER_CHANNEL_TYPE_PEER_DEPENDENT - The channel type will vary per matched channel based on the features shared
     * between its participants.
     */
    OrderChannelType["ORDER_CHANNEL_TYPE_PEER_DEPENDENT"] = "ORDER_CHANNEL_TYPE_PEER_DEPENDENT";
    /**
     * ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED - A channel type that builds upon the anchors commitment format to enforce
     * channel lease maturities in the commitment and HTLC outputs that pay to the
     * channel initiator/seller.
     */
    OrderChannelType["ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED"] = "ORDER_CHANNEL_TYPE_SCRIPT_ENFORCED";
    OrderChannelType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OrderChannelType = exports.OrderChannelType || (exports.OrderChannelType = {}));
var AuctionType;
(function (AuctionType) {
    /**
     * AUCTION_TYPE_BTC_INBOUND_LIQUIDITY - Default auction type where the bidder is paying for getting bitcoin inbound
     * liqiudity from the asker.
     */
    AuctionType["AUCTION_TYPE_BTC_INBOUND_LIQUIDITY"] = "AUCTION_TYPE_BTC_INBOUND_LIQUIDITY";
    /**
     * AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY - Auction type where the bidder is paying the asker to accept a channel
     * (bitcoin outbound liquidity) from the bidder.
     */
    AuctionType["AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY"] = "AUCTION_TYPE_BTC_OUTBOUND_LIQUIDITY";
    AuctionType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AuctionType = exports.AuctionType || (exports.AuctionType = {}));
var NodeTier;
(function (NodeTier) {
    /**
     * TIER_DEFAULT - The default node tier. This value will be determined at run-time by the
     * current order version.
     */
    NodeTier["TIER_DEFAULT"] = "TIER_DEFAULT";
    /**
     * TIER_0 - Tier 0, bid with this tier are opting out of the smaller "higher
     * quality" pool of nodes to match their bids. Nodes in this tier are
     * considered to have "no rating".
     */
    NodeTier["TIER_0"] = "TIER_0";
    /**
     * TIER_1 - Tier 1, the "base" node tier. Nodes in this tier are shown to have a
     * higher degree of up time and route-ability compared to the rest of the
     * nodes in the network. This is the current default node tier when
     * submitting bid orders.
     */
    NodeTier["TIER_1"] = "TIER_1";
    NodeTier["UNRECOGNIZED"] = "UNRECOGNIZED";
})(NodeTier = exports.NodeTier || (exports.NodeTier = {}));
/** Channel announcement constraints for matched channels. */
var ChannelAnnouncementConstraints;
(function (ChannelAnnouncementConstraints) {
    ChannelAnnouncementConstraints["ANNOUNCEMENT_NO_PREFERENCE"] = "ANNOUNCEMENT_NO_PREFERENCE";
    ChannelAnnouncementConstraints["ONLY_ANNOUNCED"] = "ONLY_ANNOUNCED";
    ChannelAnnouncementConstraints["ONLY_UNANNOUNCED"] = "ONLY_UNANNOUNCED";
    ChannelAnnouncementConstraints["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChannelAnnouncementConstraints = exports.ChannelAnnouncementConstraints || (exports.ChannelAnnouncementConstraints = {}));
/** Channel confirmation constraints for matched channels. */
var ChannelConfirmationConstraints;
(function (ChannelConfirmationConstraints) {
    ChannelConfirmationConstraints["CONFIRMATION_NO_PREFERENCE"] = "CONFIRMATION_NO_PREFERENCE";
    ChannelConfirmationConstraints["ONLY_CONFIRMED"] = "ONLY_CONFIRMED";
    ChannelConfirmationConstraints["ONLY_ZEROCONF"] = "ONLY_ZEROCONF";
    ChannelConfirmationConstraints["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChannelConfirmationConstraints = exports.ChannelConfirmationConstraints || (exports.ChannelConfirmationConstraints = {}));
var OrderState;
(function (OrderState) {
    OrderState["ORDER_SUBMITTED"] = "ORDER_SUBMITTED";
    OrderState["ORDER_CLEARED"] = "ORDER_CLEARED";
    OrderState["ORDER_PARTIALLY_FILLED"] = "ORDER_PARTIALLY_FILLED";
    OrderState["ORDER_EXECUTED"] = "ORDER_EXECUTED";
    OrderState["ORDER_CANCELED"] = "ORDER_CANCELED";
    OrderState["ORDER_EXPIRED"] = "ORDER_EXPIRED";
    OrderState["ORDER_FAILED"] = "ORDER_FAILED";
    OrderState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OrderState = exports.OrderState || (exports.OrderState = {}));
var DurationBucketState;
(function (DurationBucketState) {
    /**
     * NO_MARKET - NO_MARKET indicates that this bucket doesn't actually exist, in that no
     * market is present for this market.
     */
    DurationBucketState["NO_MARKET"] = "NO_MARKET";
    /**
     * MARKET_CLOSED - MARKET_CLOSED indicates that this market exists, but that it isn't currently
     * running.
     */
    DurationBucketState["MARKET_CLOSED"] = "MARKET_CLOSED";
    /**
     * ACCEPTING_ORDERS - ACCEPTING_ORDERS indicates that we're accepting orders for this bucket, but
     * not yet clearing for this duration.
     */
    DurationBucketState["ACCEPTING_ORDERS"] = "ACCEPTING_ORDERS";
    /**
     * MARKET_OPEN - MARKET_OPEN indicates that we're accepting orders, and fully clearing the
     * market for this duration.
     */
    DurationBucketState["MARKET_OPEN"] = "MARKET_OPEN";
    DurationBucketState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(DurationBucketState = exports.DurationBucketState || (exports.DurationBucketState = {}));
var OrderMatchReject_RejectReason;
(function (OrderMatchReject_RejectReason) {
    /** UNKNOWN - The reason cannot be mapped to a specific code. */
    OrderMatchReject_RejectReason["UNKNOWN"] = "UNKNOWN";
    /**
     * SERVER_MISBEHAVIOR - The client didn't come up with the same result as the server and is
     * rejecting the batch because of that.
     */
    OrderMatchReject_RejectReason["SERVER_MISBEHAVIOR"] = "SERVER_MISBEHAVIOR";
    /**
     * BATCH_VERSION_MISMATCH - The client doesn't support the current batch verification version the
     * server is using.
     */
    OrderMatchReject_RejectReason["BATCH_VERSION_MISMATCH"] = "BATCH_VERSION_MISMATCH";
    /**
     * PARTIAL_REJECT - The client rejects some of the orders, not the full batch. When this
     * code is set, the rejected_orders map must be set.
     */
    OrderMatchReject_RejectReason["PARTIAL_REJECT"] = "PARTIAL_REJECT";
    OrderMatchReject_RejectReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OrderMatchReject_RejectReason = exports.OrderMatchReject_RejectReason || (exports.OrderMatchReject_RejectReason = {}));
var OrderReject_OrderRejectReason;
(function (OrderReject_OrderRejectReason) {
    /**
     * DUPLICATE_PEER - The trader's client has a preference to only match orders with peers it
     * doesn't already have channels with. The order that is rejected with this
     * reason type comes from a peer that the trader already has channels with.
     */
    OrderReject_OrderRejectReason["DUPLICATE_PEER"] = "DUPLICATE_PEER";
    /**
     * CHANNEL_FUNDING_FAILED - The trader's client couldn't connect to the remote node of the matched
     * order or the channel funding could not be initialized for another
     * reason. This could also be the rejecting node's fault if their
     * connection is not stable. Using this code can have a negative impact on
     * the reputation score of both nodes, depending on the number of errors
     * recorded.
     */
    OrderReject_OrderRejectReason["CHANNEL_FUNDING_FAILED"] = "CHANNEL_FUNDING_FAILED";
    OrderReject_OrderRejectReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OrderReject_OrderRejectReason = exports.OrderReject_OrderRejectReason || (exports.OrderReject_OrderRejectReason = {}));
var SubscribeError_Error;
(function (SubscribeError_Error) {
    /** UNKNOWN - The error cannot be mapped to a specific code. */
    SubscribeError_Error["UNKNOWN"] = "UNKNOWN";
    /**
     * SERVER_SHUTDOWN - The server is shutting down for maintenance. Traders should close the
     * long-lived stream/connection and try to connect again after some time.
     */
    SubscribeError_Error["SERVER_SHUTDOWN"] = "SERVER_SHUTDOWN";
    /**
     * ACCOUNT_DOES_NOT_EXIST - The account the trader tried to subscribe to does not exist in the
     * auctioneer's database.
     */
    SubscribeError_Error["ACCOUNT_DOES_NOT_EXIST"] = "ACCOUNT_DOES_NOT_EXIST";
    /**
     * INCOMPLETE_ACCOUNT_RESERVATION - The account the trader tried to subscribe to was never completed and a
     * reservation for it is still pending.
     */
    SubscribeError_Error["INCOMPLETE_ACCOUNT_RESERVATION"] = "INCOMPLETE_ACCOUNT_RESERVATION";
    SubscribeError_Error["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SubscribeError_Error = exports.SubscribeError_Error || (exports.SubscribeError_Error = {}));
var AccountDiff_AccountState;
(function (AccountDiff_AccountState) {
    AccountDiff_AccountState["OUTPUT_RECREATED"] = "OUTPUT_RECREATED";
    AccountDiff_AccountState["OUTPUT_DUST_EXTENDED_OFFCHAIN"] = "OUTPUT_DUST_EXTENDED_OFFCHAIN";
    AccountDiff_AccountState["OUTPUT_DUST_ADDED_TO_FEES"] = "OUTPUT_DUST_ADDED_TO_FEES";
    AccountDiff_AccountState["OUTPUT_FULLY_SPENT"] = "OUTPUT_FULLY_SPENT";
    AccountDiff_AccountState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AccountDiff_AccountState = exports.AccountDiff_AccountState || (exports.AccountDiff_AccountState = {}));
var InvalidOrder_FailReason;
(function (InvalidOrder_FailReason) {
    InvalidOrder_FailReason["INVALID_AMT"] = "INVALID_AMT";
    InvalidOrder_FailReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(InvalidOrder_FailReason = exports.InvalidOrder_FailReason || (exports.InvalidOrder_FailReason = {}));
