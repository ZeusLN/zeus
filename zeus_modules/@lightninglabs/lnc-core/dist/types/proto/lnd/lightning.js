"use strict";
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Failure_FailureCode = exports.HTLCAttempt_HTLCStatus = exports.Payment_PaymentStatus = exports.Invoice_InvoiceState = exports.ChannelEventUpdate_UpdateType = exports.PendingChannelsResponse_ForceClosedChannel_AnchorState = exports.PeerEvent_EventType = exports.Peer_SyncType = exports.ChannelCloseSummary_ClosureType = exports.UpdateFailure = exports.FeatureBit = exports.PaymentFailureReason = exports.InvoiceHTLCState = exports.NodeMetricType = exports.ResolutionOutcome = exports.ResolutionType = exports.Initiator = exports.CommitmentType = exports.AddressType = exports.CoinSelectionStrategy = exports.OutputScriptType = void 0;
var OutputScriptType;
(function (OutputScriptType) {
    OutputScriptType["SCRIPT_TYPE_PUBKEY_HASH"] = "SCRIPT_TYPE_PUBKEY_HASH";
    OutputScriptType["SCRIPT_TYPE_SCRIPT_HASH"] = "SCRIPT_TYPE_SCRIPT_HASH";
    OutputScriptType["SCRIPT_TYPE_WITNESS_V0_PUBKEY_HASH"] = "SCRIPT_TYPE_WITNESS_V0_PUBKEY_HASH";
    OutputScriptType["SCRIPT_TYPE_WITNESS_V0_SCRIPT_HASH"] = "SCRIPT_TYPE_WITNESS_V0_SCRIPT_HASH";
    OutputScriptType["SCRIPT_TYPE_PUBKEY"] = "SCRIPT_TYPE_PUBKEY";
    OutputScriptType["SCRIPT_TYPE_MULTISIG"] = "SCRIPT_TYPE_MULTISIG";
    OutputScriptType["SCRIPT_TYPE_NULLDATA"] = "SCRIPT_TYPE_NULLDATA";
    OutputScriptType["SCRIPT_TYPE_NON_STANDARD"] = "SCRIPT_TYPE_NON_STANDARD";
    OutputScriptType["SCRIPT_TYPE_WITNESS_UNKNOWN"] = "SCRIPT_TYPE_WITNESS_UNKNOWN";
    OutputScriptType["SCRIPT_TYPE_WITNESS_V1_TAPROOT"] = "SCRIPT_TYPE_WITNESS_V1_TAPROOT";
    OutputScriptType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(OutputScriptType = exports.OutputScriptType || (exports.OutputScriptType = {}));
var CoinSelectionStrategy;
(function (CoinSelectionStrategy) {
    /**
     * STRATEGY_USE_GLOBAL_CONFIG - Use the coin selection strategy defined in the global configuration
     * (lnd.conf).
     */
    CoinSelectionStrategy["STRATEGY_USE_GLOBAL_CONFIG"] = "STRATEGY_USE_GLOBAL_CONFIG";
    /** STRATEGY_LARGEST - Select the largest available coins first during coin selection. */
    CoinSelectionStrategy["STRATEGY_LARGEST"] = "STRATEGY_LARGEST";
    /** STRATEGY_RANDOM - Randomly select the available coins during coin selection. */
    CoinSelectionStrategy["STRATEGY_RANDOM"] = "STRATEGY_RANDOM";
    CoinSelectionStrategy["UNRECOGNIZED"] = "UNRECOGNIZED";
})(CoinSelectionStrategy = exports.CoinSelectionStrategy || (exports.CoinSelectionStrategy = {}));
/**
 * `AddressType` has to be one of:
 *
 * - `p2wkh`: Pay to witness key hash (`WITNESS_PUBKEY_HASH` = 0)
 * - `np2wkh`: Pay to nested witness key hash (`NESTED_PUBKEY_HASH` = 1)
 * - `p2tr`: Pay to taproot pubkey (`TAPROOT_PUBKEY` = 4)
 */
var AddressType;
(function (AddressType) {
    AddressType["WITNESS_PUBKEY_HASH"] = "WITNESS_PUBKEY_HASH";
    AddressType["NESTED_PUBKEY_HASH"] = "NESTED_PUBKEY_HASH";
    AddressType["UNUSED_WITNESS_PUBKEY_HASH"] = "UNUSED_WITNESS_PUBKEY_HASH";
    AddressType["UNUSED_NESTED_PUBKEY_HASH"] = "UNUSED_NESTED_PUBKEY_HASH";
    AddressType["TAPROOT_PUBKEY"] = "TAPROOT_PUBKEY";
    AddressType["UNUSED_TAPROOT_PUBKEY"] = "UNUSED_TAPROOT_PUBKEY";
    AddressType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AddressType = exports.AddressType || (exports.AddressType = {}));
var CommitmentType;
(function (CommitmentType) {
    /** UNKNOWN_COMMITMENT_TYPE - Returned when the commitment type isn't known or unavailable. */
    CommitmentType["UNKNOWN_COMMITMENT_TYPE"] = "UNKNOWN_COMMITMENT_TYPE";
    /**
     * LEGACY - A channel using the legacy commitment format having tweaked to_remote
     * keys.
     */
    CommitmentType["LEGACY"] = "LEGACY";
    /**
     * STATIC_REMOTE_KEY - A channel that uses the modern commitment format where the key in the
     * output of the remote party does not change each state. This makes back
     * up and recovery easier as when the channel is closed, the funds go
     * directly to that key.
     */
    CommitmentType["STATIC_REMOTE_KEY"] = "STATIC_REMOTE_KEY";
    /**
     * ANCHORS - A channel that uses a commitment format that has anchor outputs on the
     * commitments, allowing fee bumping after a force close transaction has
     * been broadcast.
     */
    CommitmentType["ANCHORS"] = "ANCHORS";
    /**
     * SCRIPT_ENFORCED_LEASE - A channel that uses a commitment type that builds upon the anchors
     * commitment format, but in addition requires a CLTV clause to spend outputs
     * paying to the channel initiator. This is intended for use on leased channels
     * to guarantee that the channel initiator has no incentives to close a leased
     * channel before its maturity date.
     */
    CommitmentType["SCRIPT_ENFORCED_LEASE"] = "SCRIPT_ENFORCED_LEASE";
    /**
     * SIMPLE_TAPROOT - A channel that uses musig2 for the funding output, and the new tapscript
     * features where relevant.
     */
    CommitmentType["SIMPLE_TAPROOT"] = "SIMPLE_TAPROOT";
    /**
     * SIMPLE_TAPROOT_OVERLAY - Identical to the SIMPLE_TAPROOT channel type, but with extra functionality.
     * This channel type also commits to additional meta data in the tapscript
     * leaves for the scripts in a channel.
     */
    CommitmentType["SIMPLE_TAPROOT_OVERLAY"] = "SIMPLE_TAPROOT_OVERLAY";
    CommitmentType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(CommitmentType = exports.CommitmentType || (exports.CommitmentType = {}));
var Initiator;
(function (Initiator) {
    Initiator["INITIATOR_UNKNOWN"] = "INITIATOR_UNKNOWN";
    Initiator["INITIATOR_LOCAL"] = "INITIATOR_LOCAL";
    Initiator["INITIATOR_REMOTE"] = "INITIATOR_REMOTE";
    Initiator["INITIATOR_BOTH"] = "INITIATOR_BOTH";
    Initiator["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Initiator = exports.Initiator || (exports.Initiator = {}));
var ResolutionType;
(function (ResolutionType) {
    ResolutionType["TYPE_UNKNOWN"] = "TYPE_UNKNOWN";
    /** ANCHOR - We resolved an anchor output. */
    ResolutionType["ANCHOR"] = "ANCHOR";
    /**
     * INCOMING_HTLC - We are resolving an incoming htlc on chain. This if this htlc is
     * claimed, we swept the incoming htlc with the preimage. If it is timed
     * out, our peer swept the timeout path.
     */
    ResolutionType["INCOMING_HTLC"] = "INCOMING_HTLC";
    /**
     * OUTGOING_HTLC - We are resolving an outgoing htlc on chain. If this htlc is claimed,
     * the remote party swept the htlc with the preimage. If it is timed out,
     * we swept it with the timeout path.
     */
    ResolutionType["OUTGOING_HTLC"] = "OUTGOING_HTLC";
    /** COMMIT - We force closed and need to sweep our time locked commitment output. */
    ResolutionType["COMMIT"] = "COMMIT";
    ResolutionType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ResolutionType = exports.ResolutionType || (exports.ResolutionType = {}));
var ResolutionOutcome;
(function (ResolutionOutcome) {
    /** OUTCOME_UNKNOWN - Outcome unknown. */
    ResolutionOutcome["OUTCOME_UNKNOWN"] = "OUTCOME_UNKNOWN";
    /** CLAIMED - An output was claimed on chain. */
    ResolutionOutcome["CLAIMED"] = "CLAIMED";
    /** UNCLAIMED - An output was left unclaimed on chain. */
    ResolutionOutcome["UNCLAIMED"] = "UNCLAIMED";
    /**
     * ABANDONED - ResolverOutcomeAbandoned indicates that an output that we did not
     * claim on chain, for example an anchor that we did not sweep and a
     * third party claimed on chain, or a htlc that we could not decode
     * so left unclaimed.
     */
    ResolutionOutcome["ABANDONED"] = "ABANDONED";
    /**
     * FIRST_STAGE - If we force closed our channel, our htlcs need to be claimed in two
     * stages. This outcome represents the broadcast of a timeout or success
     * transaction for this two stage htlc claim.
     */
    ResolutionOutcome["FIRST_STAGE"] = "FIRST_STAGE";
    /** TIMEOUT - A htlc was timed out on chain. */
    ResolutionOutcome["TIMEOUT"] = "TIMEOUT";
    ResolutionOutcome["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ResolutionOutcome = exports.ResolutionOutcome || (exports.ResolutionOutcome = {}));
var NodeMetricType;
(function (NodeMetricType) {
    NodeMetricType["UNKNOWN"] = "UNKNOWN";
    NodeMetricType["BETWEENNESS_CENTRALITY"] = "BETWEENNESS_CENTRALITY";
    NodeMetricType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(NodeMetricType = exports.NodeMetricType || (exports.NodeMetricType = {}));
var InvoiceHTLCState;
(function (InvoiceHTLCState) {
    InvoiceHTLCState["ACCEPTED"] = "ACCEPTED";
    InvoiceHTLCState["SETTLED"] = "SETTLED";
    InvoiceHTLCState["CANCELED"] = "CANCELED";
    InvoiceHTLCState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(InvoiceHTLCState = exports.InvoiceHTLCState || (exports.InvoiceHTLCState = {}));
var PaymentFailureReason;
(function (PaymentFailureReason) {
    /** FAILURE_REASON_NONE - Payment isn't failed (yet). */
    PaymentFailureReason["FAILURE_REASON_NONE"] = "FAILURE_REASON_NONE";
    /** FAILURE_REASON_TIMEOUT - There are more routes to try, but the payment timeout was exceeded. */
    PaymentFailureReason["FAILURE_REASON_TIMEOUT"] = "FAILURE_REASON_TIMEOUT";
    /**
     * FAILURE_REASON_NO_ROUTE - All possible routes were tried and failed permanently. Or were no
     * routes to the destination at all.
     */
    PaymentFailureReason["FAILURE_REASON_NO_ROUTE"] = "FAILURE_REASON_NO_ROUTE";
    /** FAILURE_REASON_ERROR - A non-recoverable error has occured. */
    PaymentFailureReason["FAILURE_REASON_ERROR"] = "FAILURE_REASON_ERROR";
    /**
     * FAILURE_REASON_INCORRECT_PAYMENT_DETAILS - Payment details incorrect (unknown hash, invalid amt or
     * invalid final cltv delta)
     */
    PaymentFailureReason["FAILURE_REASON_INCORRECT_PAYMENT_DETAILS"] = "FAILURE_REASON_INCORRECT_PAYMENT_DETAILS";
    /** FAILURE_REASON_INSUFFICIENT_BALANCE - Insufficient local balance. */
    PaymentFailureReason["FAILURE_REASON_INSUFFICIENT_BALANCE"] = "FAILURE_REASON_INSUFFICIENT_BALANCE";
    /** FAILURE_REASON_CANCELED - The payment was canceled. */
    PaymentFailureReason["FAILURE_REASON_CANCELED"] = "FAILURE_REASON_CANCELED";
    PaymentFailureReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(PaymentFailureReason = exports.PaymentFailureReason || (exports.PaymentFailureReason = {}));
var FeatureBit;
(function (FeatureBit) {
    FeatureBit["DATALOSS_PROTECT_REQ"] = "DATALOSS_PROTECT_REQ";
    FeatureBit["DATALOSS_PROTECT_OPT"] = "DATALOSS_PROTECT_OPT";
    FeatureBit["INITIAL_ROUING_SYNC"] = "INITIAL_ROUING_SYNC";
    FeatureBit["UPFRONT_SHUTDOWN_SCRIPT_REQ"] = "UPFRONT_SHUTDOWN_SCRIPT_REQ";
    FeatureBit["UPFRONT_SHUTDOWN_SCRIPT_OPT"] = "UPFRONT_SHUTDOWN_SCRIPT_OPT";
    FeatureBit["GOSSIP_QUERIES_REQ"] = "GOSSIP_QUERIES_REQ";
    FeatureBit["GOSSIP_QUERIES_OPT"] = "GOSSIP_QUERIES_OPT";
    FeatureBit["TLV_ONION_REQ"] = "TLV_ONION_REQ";
    FeatureBit["TLV_ONION_OPT"] = "TLV_ONION_OPT";
    FeatureBit["EXT_GOSSIP_QUERIES_REQ"] = "EXT_GOSSIP_QUERIES_REQ";
    FeatureBit["EXT_GOSSIP_QUERIES_OPT"] = "EXT_GOSSIP_QUERIES_OPT";
    FeatureBit["STATIC_REMOTE_KEY_REQ"] = "STATIC_REMOTE_KEY_REQ";
    FeatureBit["STATIC_REMOTE_KEY_OPT"] = "STATIC_REMOTE_KEY_OPT";
    FeatureBit["PAYMENT_ADDR_REQ"] = "PAYMENT_ADDR_REQ";
    FeatureBit["PAYMENT_ADDR_OPT"] = "PAYMENT_ADDR_OPT";
    FeatureBit["MPP_REQ"] = "MPP_REQ";
    FeatureBit["MPP_OPT"] = "MPP_OPT";
    FeatureBit["WUMBO_CHANNELS_REQ"] = "WUMBO_CHANNELS_REQ";
    FeatureBit["WUMBO_CHANNELS_OPT"] = "WUMBO_CHANNELS_OPT";
    FeatureBit["ANCHORS_REQ"] = "ANCHORS_REQ";
    FeatureBit["ANCHORS_OPT"] = "ANCHORS_OPT";
    FeatureBit["ANCHORS_ZERO_FEE_HTLC_REQ"] = "ANCHORS_ZERO_FEE_HTLC_REQ";
    FeatureBit["ANCHORS_ZERO_FEE_HTLC_OPT"] = "ANCHORS_ZERO_FEE_HTLC_OPT";
    FeatureBit["ROUTE_BLINDING_REQUIRED"] = "ROUTE_BLINDING_REQUIRED";
    FeatureBit["ROUTE_BLINDING_OPTIONAL"] = "ROUTE_BLINDING_OPTIONAL";
    FeatureBit["AMP_REQ"] = "AMP_REQ";
    FeatureBit["AMP_OPT"] = "AMP_OPT";
    FeatureBit["UNRECOGNIZED"] = "UNRECOGNIZED";
})(FeatureBit = exports.FeatureBit || (exports.FeatureBit = {}));
var UpdateFailure;
(function (UpdateFailure) {
    UpdateFailure["UPDATE_FAILURE_UNKNOWN"] = "UPDATE_FAILURE_UNKNOWN";
    UpdateFailure["UPDATE_FAILURE_PENDING"] = "UPDATE_FAILURE_PENDING";
    UpdateFailure["UPDATE_FAILURE_NOT_FOUND"] = "UPDATE_FAILURE_NOT_FOUND";
    UpdateFailure["UPDATE_FAILURE_INTERNAL_ERR"] = "UPDATE_FAILURE_INTERNAL_ERR";
    UpdateFailure["UPDATE_FAILURE_INVALID_PARAMETER"] = "UPDATE_FAILURE_INVALID_PARAMETER";
    UpdateFailure["UNRECOGNIZED"] = "UNRECOGNIZED";
})(UpdateFailure = exports.UpdateFailure || (exports.UpdateFailure = {}));
var ChannelCloseSummary_ClosureType;
(function (ChannelCloseSummary_ClosureType) {
    ChannelCloseSummary_ClosureType["COOPERATIVE_CLOSE"] = "COOPERATIVE_CLOSE";
    ChannelCloseSummary_ClosureType["LOCAL_FORCE_CLOSE"] = "LOCAL_FORCE_CLOSE";
    ChannelCloseSummary_ClosureType["REMOTE_FORCE_CLOSE"] = "REMOTE_FORCE_CLOSE";
    ChannelCloseSummary_ClosureType["BREACH_CLOSE"] = "BREACH_CLOSE";
    ChannelCloseSummary_ClosureType["FUNDING_CANCELED"] = "FUNDING_CANCELED";
    ChannelCloseSummary_ClosureType["ABANDONED"] = "ABANDONED";
    ChannelCloseSummary_ClosureType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChannelCloseSummary_ClosureType = exports.ChannelCloseSummary_ClosureType || (exports.ChannelCloseSummary_ClosureType = {}));
var Peer_SyncType;
(function (Peer_SyncType) {
    /** UNKNOWN_SYNC - Denotes that we cannot determine the peer's current sync type. */
    Peer_SyncType["UNKNOWN_SYNC"] = "UNKNOWN_SYNC";
    /** ACTIVE_SYNC - Denotes that we are actively receiving new graph updates from the peer. */
    Peer_SyncType["ACTIVE_SYNC"] = "ACTIVE_SYNC";
    /** PASSIVE_SYNC - Denotes that we are not receiving new graph updates from the peer. */
    Peer_SyncType["PASSIVE_SYNC"] = "PASSIVE_SYNC";
    /** PINNED_SYNC - Denotes that this peer is pinned into an active sync. */
    Peer_SyncType["PINNED_SYNC"] = "PINNED_SYNC";
    Peer_SyncType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Peer_SyncType = exports.Peer_SyncType || (exports.Peer_SyncType = {}));
var PeerEvent_EventType;
(function (PeerEvent_EventType) {
    PeerEvent_EventType["PEER_ONLINE"] = "PEER_ONLINE";
    PeerEvent_EventType["PEER_OFFLINE"] = "PEER_OFFLINE";
    PeerEvent_EventType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(PeerEvent_EventType = exports.PeerEvent_EventType || (exports.PeerEvent_EventType = {}));
/**
 * There are three resolution states for the anchor:
 * limbo, lost and recovered. Derive the current state
 * from the limbo and recovered balances.
 */
var PendingChannelsResponse_ForceClosedChannel_AnchorState;
(function (PendingChannelsResponse_ForceClosedChannel_AnchorState) {
    /** LIMBO - The recovered_balance is zero and limbo_balance is non-zero. */
    PendingChannelsResponse_ForceClosedChannel_AnchorState["LIMBO"] = "LIMBO";
    /** RECOVERED - The recovered_balance is non-zero. */
    PendingChannelsResponse_ForceClosedChannel_AnchorState["RECOVERED"] = "RECOVERED";
    /** LOST - A state that is neither LIMBO nor RECOVERED. */
    PendingChannelsResponse_ForceClosedChannel_AnchorState["LOST"] = "LOST";
    PendingChannelsResponse_ForceClosedChannel_AnchorState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(PendingChannelsResponse_ForceClosedChannel_AnchorState = exports.PendingChannelsResponse_ForceClosedChannel_AnchorState || (exports.PendingChannelsResponse_ForceClosedChannel_AnchorState = {}));
var ChannelEventUpdate_UpdateType;
(function (ChannelEventUpdate_UpdateType) {
    ChannelEventUpdate_UpdateType["OPEN_CHANNEL"] = "OPEN_CHANNEL";
    ChannelEventUpdate_UpdateType["CLOSED_CHANNEL"] = "CLOSED_CHANNEL";
    ChannelEventUpdate_UpdateType["ACTIVE_CHANNEL"] = "ACTIVE_CHANNEL";
    ChannelEventUpdate_UpdateType["INACTIVE_CHANNEL"] = "INACTIVE_CHANNEL";
    ChannelEventUpdate_UpdateType["PENDING_OPEN_CHANNEL"] = "PENDING_OPEN_CHANNEL";
    ChannelEventUpdate_UpdateType["FULLY_RESOLVED_CHANNEL"] = "FULLY_RESOLVED_CHANNEL";
    ChannelEventUpdate_UpdateType["CHANNEL_FUNDING_TIMEOUT"] = "CHANNEL_FUNDING_TIMEOUT";
    ChannelEventUpdate_UpdateType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ChannelEventUpdate_UpdateType = exports.ChannelEventUpdate_UpdateType || (exports.ChannelEventUpdate_UpdateType = {}));
var Invoice_InvoiceState;
(function (Invoice_InvoiceState) {
    Invoice_InvoiceState["OPEN"] = "OPEN";
    Invoice_InvoiceState["SETTLED"] = "SETTLED";
    Invoice_InvoiceState["CANCELED"] = "CANCELED";
    Invoice_InvoiceState["ACCEPTED"] = "ACCEPTED";
    Invoice_InvoiceState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Invoice_InvoiceState = exports.Invoice_InvoiceState || (exports.Invoice_InvoiceState = {}));
var Payment_PaymentStatus;
(function (Payment_PaymentStatus) {
    /**
     * UNKNOWN - Deprecated. This status will never be returned.
     *
     * @deprecated
     */
    Payment_PaymentStatus["UNKNOWN"] = "UNKNOWN";
    /** IN_FLIGHT - Payment has inflight HTLCs. */
    Payment_PaymentStatus["IN_FLIGHT"] = "IN_FLIGHT";
    /** SUCCEEDED - Payment is settled. */
    Payment_PaymentStatus["SUCCEEDED"] = "SUCCEEDED";
    /** FAILED - Payment is failed. */
    Payment_PaymentStatus["FAILED"] = "FAILED";
    /** INITIATED - Payment is created and has not attempted any HTLCs. */
    Payment_PaymentStatus["INITIATED"] = "INITIATED";
    Payment_PaymentStatus["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Payment_PaymentStatus = exports.Payment_PaymentStatus || (exports.Payment_PaymentStatus = {}));
var HTLCAttempt_HTLCStatus;
(function (HTLCAttempt_HTLCStatus) {
    HTLCAttempt_HTLCStatus["IN_FLIGHT"] = "IN_FLIGHT";
    HTLCAttempt_HTLCStatus["SUCCEEDED"] = "SUCCEEDED";
    HTLCAttempt_HTLCStatus["FAILED"] = "FAILED";
    HTLCAttempt_HTLCStatus["UNRECOGNIZED"] = "UNRECOGNIZED";
})(HTLCAttempt_HTLCStatus = exports.HTLCAttempt_HTLCStatus || (exports.HTLCAttempt_HTLCStatus = {}));
var Failure_FailureCode;
(function (Failure_FailureCode) {
    /**
     * RESERVED - The numbers assigned in this enumeration match the failure codes as
     * defined in BOLT #4. Because protobuf 3 requires enums to start with 0,
     * a RESERVED value is added.
     */
    Failure_FailureCode["RESERVED"] = "RESERVED";
    Failure_FailureCode["INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS"] = "INCORRECT_OR_UNKNOWN_PAYMENT_DETAILS";
    Failure_FailureCode["INCORRECT_PAYMENT_AMOUNT"] = "INCORRECT_PAYMENT_AMOUNT";
    Failure_FailureCode["FINAL_INCORRECT_CLTV_EXPIRY"] = "FINAL_INCORRECT_CLTV_EXPIRY";
    Failure_FailureCode["FINAL_INCORRECT_HTLC_AMOUNT"] = "FINAL_INCORRECT_HTLC_AMOUNT";
    Failure_FailureCode["FINAL_EXPIRY_TOO_SOON"] = "FINAL_EXPIRY_TOO_SOON";
    Failure_FailureCode["INVALID_REALM"] = "INVALID_REALM";
    Failure_FailureCode["EXPIRY_TOO_SOON"] = "EXPIRY_TOO_SOON";
    Failure_FailureCode["INVALID_ONION_VERSION"] = "INVALID_ONION_VERSION";
    Failure_FailureCode["INVALID_ONION_HMAC"] = "INVALID_ONION_HMAC";
    Failure_FailureCode["INVALID_ONION_KEY"] = "INVALID_ONION_KEY";
    Failure_FailureCode["AMOUNT_BELOW_MINIMUM"] = "AMOUNT_BELOW_MINIMUM";
    Failure_FailureCode["FEE_INSUFFICIENT"] = "FEE_INSUFFICIENT";
    Failure_FailureCode["INCORRECT_CLTV_EXPIRY"] = "INCORRECT_CLTV_EXPIRY";
    Failure_FailureCode["CHANNEL_DISABLED"] = "CHANNEL_DISABLED";
    Failure_FailureCode["TEMPORARY_CHANNEL_FAILURE"] = "TEMPORARY_CHANNEL_FAILURE";
    Failure_FailureCode["REQUIRED_NODE_FEATURE_MISSING"] = "REQUIRED_NODE_FEATURE_MISSING";
    Failure_FailureCode["REQUIRED_CHANNEL_FEATURE_MISSING"] = "REQUIRED_CHANNEL_FEATURE_MISSING";
    Failure_FailureCode["UNKNOWN_NEXT_PEER"] = "UNKNOWN_NEXT_PEER";
    Failure_FailureCode["TEMPORARY_NODE_FAILURE"] = "TEMPORARY_NODE_FAILURE";
    Failure_FailureCode["PERMANENT_NODE_FAILURE"] = "PERMANENT_NODE_FAILURE";
    Failure_FailureCode["PERMANENT_CHANNEL_FAILURE"] = "PERMANENT_CHANNEL_FAILURE";
    Failure_FailureCode["EXPIRY_TOO_FAR"] = "EXPIRY_TOO_FAR";
    Failure_FailureCode["MPP_TIMEOUT"] = "MPP_TIMEOUT";
    Failure_FailureCode["INVALID_ONION_PAYLOAD"] = "INVALID_ONION_PAYLOAD";
    Failure_FailureCode["INVALID_ONION_BLINDING"] = "INVALID_ONION_BLINDING";
    /** INTERNAL_FAILURE - An internal error occurred. */
    Failure_FailureCode["INTERNAL_FAILURE"] = "INTERNAL_FAILURE";
    /** UNKNOWN_FAILURE - The error source is known, but the failure itself couldn't be decoded. */
    Failure_FailureCode["UNKNOWN_FAILURE"] = "UNKNOWN_FAILURE";
    /**
     * UNREADABLE_FAILURE - An unreadable failure result is returned if the received failure message
     * cannot be decrypted. In that case the error source is unknown.
     */
    Failure_FailureCode["UNREADABLE_FAILURE"] = "UNREADABLE_FAILURE";
    Failure_FailureCode["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Failure_FailureCode = exports.Failure_FailureCode || (exports.Failure_FailureCode = {}));
