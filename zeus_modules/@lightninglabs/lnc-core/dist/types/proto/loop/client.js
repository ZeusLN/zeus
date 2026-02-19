"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSwapsFilter_SwapTypeFilter = exports.StaticAddressLoopInSwapState = exports.DepositState = exports.AutoReason = exports.LiquidityRuleType = exports.FailureReason = exports.SwapState = exports.SwapType = exports.AddressType = void 0;
/**
 * `AddressType` has to be one of:
 *
 * - `unknown`: Unknown address type
 * - `p2tr`: Pay to taproot pubkey (`TAPROOT_PUBKEY` = 1)
 */
var AddressType;
(function (AddressType) {
    AddressType["ADDRESS_TYPE_UNKNOWN"] = "ADDRESS_TYPE_UNKNOWN";
    AddressType["TAPROOT_PUBKEY"] = "TAPROOT_PUBKEY";
    AddressType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AddressType = exports.AddressType || (exports.AddressType = {}));
var SwapType;
(function (SwapType) {
    /** LOOP_OUT - LOOP_OUT indicates an loop out swap (off-chain to on-chain) */
    SwapType["LOOP_OUT"] = "LOOP_OUT";
    /** LOOP_IN - LOOP_IN indicates a loop in swap (on-chain to off-chain) */
    SwapType["LOOP_IN"] = "LOOP_IN";
    SwapType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SwapType = exports.SwapType || (exports.SwapType = {}));
var SwapState;
(function (SwapState) {
    /**
     * INITIATED - INITIATED is the initial state of a swap. At that point, the initiation
     * call to the server has been made and the payment process has been started
     * for the swap and prepayment invoices.
     */
    SwapState["INITIATED"] = "INITIATED";
    /**
     * PREIMAGE_REVEALED - PREIMAGE_REVEALED is reached when the sweep tx publication is first
     * attempted. From that point on, we should consider the preimage to no
     * longer be secret and we need to do all we can to get the sweep confirmed.
     * This state will mostly coalesce with StateHtlcConfirmed, except in the
     * case where we wait for fees to come down before we sweep.
     */
    SwapState["PREIMAGE_REVEALED"] = "PREIMAGE_REVEALED";
    /**
     * HTLC_PUBLISHED - HTLC_PUBLISHED is reached when the htlc tx has been published in a loop in
     * swap.
     */
    SwapState["HTLC_PUBLISHED"] = "HTLC_PUBLISHED";
    /**
     * SUCCESS - SUCCESS is the final swap state that is reached when the sweep tx has
     * the required confirmation depth.
     */
    SwapState["SUCCESS"] = "SUCCESS";
    /**
     * FAILED - FAILED is the final swap state for a failed swap with or without loss of
     * the swap amount.
     */
    SwapState["FAILED"] = "FAILED";
    /**
     * INVOICE_SETTLED - INVOICE_SETTLED is reached when the swap invoice in a loop in swap has been
     * paid, but we are still waiting for the htlc spend to confirm.
     */
    SwapState["INVOICE_SETTLED"] = "INVOICE_SETTLED";
    SwapState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(SwapState = exports.SwapState || (exports.SwapState = {}));
var FailureReason;
(function (FailureReason) {
    /**
     * FAILURE_REASON_NONE - FAILURE_REASON_NONE is set when the swap did not fail, it is either in
     * progress or succeeded.
     */
    FailureReason["FAILURE_REASON_NONE"] = "FAILURE_REASON_NONE";
    /**
     * FAILURE_REASON_OFFCHAIN - FAILURE_REASON_OFFCHAIN indicates that a loop out failed because it wasn't
     * possible to find a route for one or both off chain payments that met the fee
     * and timelock limits required.
     */
    FailureReason["FAILURE_REASON_OFFCHAIN"] = "FAILURE_REASON_OFFCHAIN";
    /**
     * FAILURE_REASON_TIMEOUT - FAILURE_REASON_TIMEOUT indicates that the swap failed because on chain htlc
     * did not confirm before its expiry, or it confirmed too late for us to reveal
     * our preimage and claim.
     */
    FailureReason["FAILURE_REASON_TIMEOUT"] = "FAILURE_REASON_TIMEOUT";
    /**
     * FAILURE_REASON_SWEEP_TIMEOUT - FAILURE_REASON_SWEEP_TIMEOUT indicates that a loop out permanently failed
     * because the on chain htlc wasn't swept before the server revoked the
     * htlc.
     */
    FailureReason["FAILURE_REASON_SWEEP_TIMEOUT"] = "FAILURE_REASON_SWEEP_TIMEOUT";
    /**
     * FAILURE_REASON_INSUFFICIENT_VALUE - FAILURE_REASON_INSUFFICIENT_VALUE indicates that a loop out has failed
     * because the on chain htlc had a lower value than requested.
     */
    FailureReason["FAILURE_REASON_INSUFFICIENT_VALUE"] = "FAILURE_REASON_INSUFFICIENT_VALUE";
    /**
     * FAILURE_REASON_TEMPORARY - FAILURE_REASON_TEMPORARY indicates that a swap cannot continue due to an
     * internal error. Manual intervention such as a restart is required.
     */
    FailureReason["FAILURE_REASON_TEMPORARY"] = "FAILURE_REASON_TEMPORARY";
    /**
     * FAILURE_REASON_INCORRECT_AMOUNT - FAILURE_REASON_INCORRECT_AMOUNT indicates that a loop in permanently failed
     * because the amount extended by an external loop in htlc is insufficient.
     */
    FailureReason["FAILURE_REASON_INCORRECT_AMOUNT"] = "FAILURE_REASON_INCORRECT_AMOUNT";
    /**
     * FAILURE_REASON_ABANDONED - FAILURE_REASON_ABANDONED indicates that a swap permanently failed because
     * the client manually abandoned the swap.
     */
    FailureReason["FAILURE_REASON_ABANDONED"] = "FAILURE_REASON_ABANDONED";
    /**
     * FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE - FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE indicates that a swap
     * wasn't published due to insufficient confirmed balance.
     */
    FailureReason["FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE"] = "FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE";
    /**
     * FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT - FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT indicates that a swap
     * wasn't published due to insufficient confirmed balance.
     */
    FailureReason["FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT"] = "FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT";
    FailureReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(FailureReason = exports.FailureReason || (exports.FailureReason = {}));
var LiquidityRuleType;
(function (LiquidityRuleType) {
    LiquidityRuleType["UNKNOWN"] = "UNKNOWN";
    LiquidityRuleType["THRESHOLD"] = "THRESHOLD";
    LiquidityRuleType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(LiquidityRuleType = exports.LiquidityRuleType || (exports.LiquidityRuleType = {}));
var AutoReason;
(function (AutoReason) {
    AutoReason["AUTO_REASON_UNKNOWN"] = "AUTO_REASON_UNKNOWN";
    /**
     * AUTO_REASON_BUDGET_NOT_STARTED - Budget not started indicates that we do not recommend any swaps because
     * the start time for our budget has not arrived yet.
     */
    AutoReason["AUTO_REASON_BUDGET_NOT_STARTED"] = "AUTO_REASON_BUDGET_NOT_STARTED";
    /**
     * AUTO_REASON_SWEEP_FEES - Sweep fees indicates that the estimated fees to sweep swaps are too high
     * right now.
     */
    AutoReason["AUTO_REASON_SWEEP_FEES"] = "AUTO_REASON_SWEEP_FEES";
    /**
     * AUTO_REASON_BUDGET_ELAPSED - Budget elapsed indicates that the autoloop budget for the period has been
     * elapsed.
     */
    AutoReason["AUTO_REASON_BUDGET_ELAPSED"] = "AUTO_REASON_BUDGET_ELAPSED";
    /**
     * AUTO_REASON_IN_FLIGHT - In flight indicates that the limit on in-flight automatically dispatched
     * swaps has already been reached.
     */
    AutoReason["AUTO_REASON_IN_FLIGHT"] = "AUTO_REASON_IN_FLIGHT";
    /** AUTO_REASON_SWAP_FEE - Swap fee indicates that the server fee for a specific swap is too high. */
    AutoReason["AUTO_REASON_SWAP_FEE"] = "AUTO_REASON_SWAP_FEE";
    /** AUTO_REASON_MINER_FEE - Miner fee indicates that the miner fee for a specific swap is to high. */
    AutoReason["AUTO_REASON_MINER_FEE"] = "AUTO_REASON_MINER_FEE";
    /** AUTO_REASON_PREPAY - Prepay indicates that the prepay fee for a specific swap is too high. */
    AutoReason["AUTO_REASON_PREPAY"] = "AUTO_REASON_PREPAY";
    /**
     * AUTO_REASON_FAILURE_BACKOFF - Failure backoff indicates that a swap has recently failed for this target,
     * and the backoff period has not yet passed.
     */
    AutoReason["AUTO_REASON_FAILURE_BACKOFF"] = "AUTO_REASON_FAILURE_BACKOFF";
    /**
     * AUTO_REASON_LOOP_OUT - Loop out indicates that a loop out swap is currently utilizing the channel,
     * so it is not eligible.
     */
    AutoReason["AUTO_REASON_LOOP_OUT"] = "AUTO_REASON_LOOP_OUT";
    /**
     * AUTO_REASON_LOOP_IN - Loop In indicates that a loop in swap is currently in flight for the peer,
     * so it is not eligible.
     */
    AutoReason["AUTO_REASON_LOOP_IN"] = "AUTO_REASON_LOOP_IN";
    /**
     * AUTO_REASON_LIQUIDITY_OK - Liquidity ok indicates that a target meets the liquidity balance expressed
     * in its rule, so no swap is needed.
     */
    AutoReason["AUTO_REASON_LIQUIDITY_OK"] = "AUTO_REASON_LIQUIDITY_OK";
    /**
     * AUTO_REASON_BUDGET_INSUFFICIENT - Budget insufficient indicates that we cannot perform a swap because we do
     * not have enough pending budget available. This differs from budget elapsed,
     * because we still have some budget available, but we have allocated it to
     * other swaps.
     */
    AutoReason["AUTO_REASON_BUDGET_INSUFFICIENT"] = "AUTO_REASON_BUDGET_INSUFFICIENT";
    /**
     * AUTO_REASON_FEE_INSUFFICIENT - Fee insufficient indicates that the fee estimate for a swap is higher than
     * the portion of total swap amount that we allow fees to consume.
     */
    AutoReason["AUTO_REASON_FEE_INSUFFICIENT"] = "AUTO_REASON_FEE_INSUFFICIENT";
    AutoReason["UNRECOGNIZED"] = "UNRECOGNIZED";
})(AutoReason = exports.AutoReason || (exports.AutoReason = {}));
var DepositState;
(function (DepositState) {
    /** UNKNOWN_STATE - UNKNOWN_STATE is the default state of a deposit. */
    DepositState["UNKNOWN_STATE"] = "UNKNOWN_STATE";
    /**
     * DEPOSITED - DEPOSITED indicates that the deposit has been sufficiently confirmed on
     * chain.
     */
    DepositState["DEPOSITED"] = "DEPOSITED";
    /**
     * WITHDRAWING - WITHDRAWING indicates that the deposit is currently being withdrawn. It
     * flips to WITHDRAWN once the withdrawal transaction has been sufficiently
     * confirmed.
     */
    DepositState["WITHDRAWING"] = "WITHDRAWING";
    /** WITHDRAWN - WITHDRAWN indicates that the deposit has been withdrawn. */
    DepositState["WITHDRAWN"] = "WITHDRAWN";
    /**
     * LOOPING_IN - LOOPING_IN indicates that the deposit is currently being used in a static
     * address loop-in swap.
     */
    DepositState["LOOPING_IN"] = "LOOPING_IN";
    /**
     * LOOPED_IN - LOOPED_IN indicates that the deposit was used in a static address loop-in
     * swap.
     */
    DepositState["LOOPED_IN"] = "LOOPED_IN";
    /**
     * SWEEP_HTLC_TIMEOUT - SWEEP_HTLC_TIMEOUT indicates that the deposit is part of an active loop-in
     * of which the respective htlc was published by the server and the timeout
     * path has opened up for the client to sweep.
     */
    DepositState["SWEEP_HTLC_TIMEOUT"] = "SWEEP_HTLC_TIMEOUT";
    /**
     * HTLC_TIMEOUT_SWEPT - HTLC_TIMEOUT_SWEPT indicates that the timeout path of the htlc has been
     * swept by the client.
     */
    DepositState["HTLC_TIMEOUT_SWEPT"] = "HTLC_TIMEOUT_SWEPT";
    /**
     * PUBLISH_EXPIRED - PUBLISH_EXPIRED indicates that the deposit has expired and the sweep
     * transaction has been published.
     */
    DepositState["PUBLISH_EXPIRED"] = "PUBLISH_EXPIRED";
    /**
     * WAIT_FOR_EXPIRY_SWEEP - WAIT_FOR_EXPIRY_SWEEP indicates that the deposit has expired and the sweep
     * transaction has not yet been sufficiently confirmed.
     */
    DepositState["WAIT_FOR_EXPIRY_SWEEP"] = "WAIT_FOR_EXPIRY_SWEEP";
    /**
     * EXPIRED - EXPIRED indicates that the deposit has expired and the sweep transaction
     * has been sufficiently confirmed.
     */
    DepositState["EXPIRED"] = "EXPIRED";
    DepositState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(DepositState = exports.DepositState || (exports.DepositState = {}));
var StaticAddressLoopInSwapState;
(function (StaticAddressLoopInSwapState) {
    /** UNKNOWN_STATIC_ADDRESS_SWAP_STATE -  */
    StaticAddressLoopInSwapState["UNKNOWN_STATIC_ADDRESS_SWAP_STATE"] = "UNKNOWN_STATIC_ADDRESS_SWAP_STATE";
    /** INIT_HTLC -  */
    StaticAddressLoopInSwapState["INIT_HTLC"] = "INIT_HTLC";
    /** SIGN_HTLC_TX -  */
    StaticAddressLoopInSwapState["SIGN_HTLC_TX"] = "SIGN_HTLC_TX";
    /** MONITOR_INVOICE_HTLC_TX -  */
    StaticAddressLoopInSwapState["MONITOR_INVOICE_HTLC_TX"] = "MONITOR_INVOICE_HTLC_TX";
    /** PAYMENT_RECEIVED -  */
    StaticAddressLoopInSwapState["PAYMENT_RECEIVED"] = "PAYMENT_RECEIVED";
    /** SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT -  */
    StaticAddressLoopInSwapState["SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT"] = "SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT";
    /** MONITOR_HTLC_TIMEOUT_SWEEP -  */
    StaticAddressLoopInSwapState["MONITOR_HTLC_TIMEOUT_SWEEP"] = "MONITOR_HTLC_TIMEOUT_SWEEP";
    /** HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT -  */
    StaticAddressLoopInSwapState["HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT"] = "HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT";
    /** SUCCEEDED -  */
    StaticAddressLoopInSwapState["SUCCEEDED"] = "SUCCEEDED";
    /** SUCCEEDED_TRANSITIONING_FAILED -  */
    StaticAddressLoopInSwapState["SUCCEEDED_TRANSITIONING_FAILED"] = "SUCCEEDED_TRANSITIONING_FAILED";
    /** UNLOCK_DEPOSITS -  */
    StaticAddressLoopInSwapState["UNLOCK_DEPOSITS"] = "UNLOCK_DEPOSITS";
    /** FAILED_STATIC_ADDRESS_SWAP -  */
    StaticAddressLoopInSwapState["FAILED_STATIC_ADDRESS_SWAP"] = "FAILED_STATIC_ADDRESS_SWAP";
    StaticAddressLoopInSwapState["UNRECOGNIZED"] = "UNRECOGNIZED";
})(StaticAddressLoopInSwapState = exports.StaticAddressLoopInSwapState || (exports.StaticAddressLoopInSwapState = {}));
var ListSwapsFilter_SwapTypeFilter;
(function (ListSwapsFilter_SwapTypeFilter) {
    /** ANY - ANY indicates that no filter is applied. */
    ListSwapsFilter_SwapTypeFilter["ANY"] = "ANY";
    /** LOOP_OUT - LOOP_OUT indicates an loop out swap (off-chain to on-chain). */
    ListSwapsFilter_SwapTypeFilter["LOOP_OUT"] = "LOOP_OUT";
    /** LOOP_IN - LOOP_IN indicates a loop in swap (on-chain to off-chain). */
    ListSwapsFilter_SwapTypeFilter["LOOP_IN"] = "LOOP_IN";
    ListSwapsFilter_SwapTypeFilter["UNRECOGNIZED"] = "UNRECOGNIZED";
})(ListSwapsFilter_SwapTypeFilter = exports.ListSwapsFilter_SwapTypeFilter || (exports.ListSwapsFilter_SwapTypeFilter = {}));
