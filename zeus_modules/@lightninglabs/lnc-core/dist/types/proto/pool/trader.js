"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRejectReason = exports.MatchState = exports.AccountState = exports.AccountVersion = void 0;
var AccountVersion;
(function (AccountVersion) {
    /**
     * ACCOUNT_VERSION_LND_DEPENDENT - Let the version of lnd decide. If a version of lnd >= 0.15.0-beta is
     * detected then a Taproot account is created. For earlier versions a legacy
     * account is created. If a version of lnd >= 0.16.0-beta is detected, then a
     * Taproot v2 account is created.
     */
    AccountVersion["ACCOUNT_VERSION_LND_DEPENDENT"] = "ACCOUNT_VERSION_LND_DEPENDENT";
    /** ACCOUNT_VERSION_LEGACY - A legacy SegWit v0 p2wsh account with a single script. */
    AccountVersion["ACCOUNT_VERSION_LEGACY"] = "ACCOUNT_VERSION_LEGACY";
    /**
     * ACCOUNT_VERSION_TAPROOT - A Taproot enabled account with MuSig2 combined internal key and the expiry
     * script as a single tap script leaf.
     */
    AccountVersion["ACCOUNT_VERSION_TAPROOT"] = "ACCOUNT_VERSION_TAPROOT";
    /**
     * ACCOUNT_VERSION_TAPROOT_V2 - A Taproot enabled account with MuSig2 combined internal key and the expiry
     * script as a single tap script leaf. This version uses the MuSig2 v1.0.0-rc2
     * protocol for creating the combined internal key. This can only be selected
     * when the connected lnd version is >= 0.16.0-beta.
     */
    AccountVersion["ACCOUNT_VERSION_TAPROOT_V2"] = "ACCOUNT_VERSION_TAPROOT_V2";
    AccountVersion["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AccountVersion = exports.AccountVersion || (exports.AccountVersion = {}));
var AccountState;
(function (AccountState) {
    /** PENDING_OPEN - The state of an account when it is pending its confirmation on-chain. */
    AccountState["PENDING_OPEN"] = "PENDING_OPEN";
    /**
     * PENDING_UPDATE - The state of an account when it has undergone an update on-chain either as
     * part of a matched order or a trader modification and it is pending its
     * confirmation on-chain.
     */
    AccountState["PENDING_UPDATE"] = "PENDING_UPDATE";
    /** OPEN - The state of an account once it has confirmed on-chain. */
    AccountState["OPEN"] = "OPEN";
    /**
     * EXPIRED - The state of an account once its expiration has been reached and its closing
     * transaction has confirmed.
     */
    AccountState["EXPIRED"] = "EXPIRED";
    /**
     * PENDING_CLOSED - The state of an account when we're waiting for the closing transaction of
     * an account to confirm that required cooperation with the auctioneer.
     */
    AccountState["PENDING_CLOSED"] = "PENDING_CLOSED";
    /** CLOSED - The state of an account once its closing transaction has confirmed. */
    AccountState["CLOSED"] = "CLOSED";
    /**
     * RECOVERY_FAILED - The state of an account that indicates that the account was attempted to be
     * recovered but failed because the opening transaction wasn't found by lnd.
     * This could be because it was never published or it never confirmed. Then the
     * funds are SAFU and the account can be considered to never have been opened
     * in the first place.
     */
    AccountState["RECOVERY_FAILED"] = "RECOVERY_FAILED";
    /** PENDING_BATCH - The account has recently participated in a batch and is not yet confirmed. */
    AccountState["PENDING_BATCH"] = "PENDING_BATCH";
    AccountState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AccountState = exports.AccountState || (exports.AccountState = {}));
var MatchState;
(function (MatchState) {
    /** PREPARE - The OrderMatchPrepare message from the auctioneer was received initially. */
    MatchState["PREPARE"] = "PREPARE";
    /**
     * ACCEPTED - The OrderMatchPrepare message from the auctioneer was processed successfully
     * and the batch was accepted.
     */
    MatchState["ACCEPTED"] = "ACCEPTED";
    /**
     * REJECTED - The order was rejected by the trader daemon, either as an answer to a
     * OrderMatchSignBegin or OrderMatchFinalize message from the auctioneer.
     */
    MatchState["REJECTED"] = "REJECTED";
    /**
     * SIGNED - The OrderMatchSignBegin message from the auctioneer was processed
     * successfully.
     */
    MatchState["SIGNED"] = "SIGNED";
    /**
     * FINALIZED - The OrderMatchFinalize message from the auctioneer was processed
     * successfully.
     */
    MatchState["FINALIZED"] = "FINALIZED";
    MatchState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(MatchState = exports.MatchState || (exports.MatchState = {}));
var MatchRejectReason;
(function (MatchRejectReason) {
    /** NONE - No reject occurred, this is the default value. */
    MatchRejectReason["NONE"] = "NONE";
    /**
     * SERVER_MISBEHAVIOR - The client didn't come up with the same result as the server and is
     * rejecting the batch because of that.
     */
    MatchRejectReason["SERVER_MISBEHAVIOR"] = "SERVER_MISBEHAVIOR";
    /**
     * BATCH_VERSION_MISMATCH - The client doesn't support the current batch verification version the
     * server is using.
     */
    MatchRejectReason["BATCH_VERSION_MISMATCH"] = "BATCH_VERSION_MISMATCH";
    /**
     * PARTIAL_REJECT_COLLATERAL - The client rejects some of the orders, not the full batch. This reason is
     * set on matches for orders that were in the same batch as partial reject ones
     * but were not themselves rejected.
     */
    MatchRejectReason["PARTIAL_REJECT_COLLATERAL"] = "PARTIAL_REJECT_COLLATERAL";
    /**
     * PARTIAL_REJECT_DUPLICATE_PEER - The trader's client has a preference to only match orders with peers it
     * doesn't already have channels with. The order that is rejected with this
     * reason type comes from a peer that the trader already has channels with.
     */
    MatchRejectReason["PARTIAL_REJECT_DUPLICATE_PEER"] = "PARTIAL_REJECT_DUPLICATE_PEER";
    /**
     * PARTIAL_REJECT_CHANNEL_FUNDING_FAILED - The trader's client couldn't connect to the remote node of the matched
     * order or the channel funding could not be initialized for another
     * reason. This could also be the rejecting node's fault if their
     * connection is not stable. Using this code can have a negative impact on
     * the reputation score of both nodes, depending on the number of errors
     * recorded.
     */
    MatchRejectReason["PARTIAL_REJECT_CHANNEL_FUNDING_FAILED"] = "PARTIAL_REJECT_CHANNEL_FUNDING_FAILED";
    MatchRejectReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(MatchRejectReason = exports.MatchRejectReason || (exports.MatchRejectReason = {}));
