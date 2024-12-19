/* eslint-disable */
import type { RouteHint } from './swapserverrpc/common';

/**
 * `AddressType` has to be one of:
 *
 * - `unknown`: Unknown address type
 * - `p2tr`: Pay to taproot pubkey (`TAPROOT_PUBKEY` = 1)
 */
export enum AddressType {
    ADDRESS_TYPE_UNKNOWN = 'ADDRESS_TYPE_UNKNOWN',
    TAPROOT_PUBKEY = 'TAPROOT_PUBKEY',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum SwapType {
    /** LOOP_OUT - LOOP_OUT indicates an loop out swap (off-chain to on-chain) */
    LOOP_OUT = 'LOOP_OUT',
    /** LOOP_IN - LOOP_IN indicates a loop in swap (on-chain to off-chain) */
    LOOP_IN = 'LOOP_IN',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum SwapState {
    /**
     * INITIATED - INITIATED is the initial state of a swap. At that point, the initiation
     * call to the server has been made and the payment process has been started
     * for the swap and prepayment invoices.
     */
    INITIATED = 'INITIATED',
    /**
     * PREIMAGE_REVEALED - PREIMAGE_REVEALED is reached when the sweep tx publication is first
     * attempted. From that point on, we should consider the preimage to no
     * longer be secret and we need to do all we can to get the sweep confirmed.
     * This state will mostly coalesce with StateHtlcConfirmed, except in the
     * case where we wait for fees to come down before we sweep.
     */
    PREIMAGE_REVEALED = 'PREIMAGE_REVEALED',
    /**
     * HTLC_PUBLISHED - HTLC_PUBLISHED is reached when the htlc tx has been published in a loop in
     * swap.
     */
    HTLC_PUBLISHED = 'HTLC_PUBLISHED',
    /**
     * SUCCESS - SUCCESS is the final swap state that is reached when the sweep tx has
     * the required confirmation depth.
     */
    SUCCESS = 'SUCCESS',
    /**
     * FAILED - FAILED is the final swap state for a failed swap with or without loss of
     * the swap amount.
     */
    FAILED = 'FAILED',
    /**
     * INVOICE_SETTLED - INVOICE_SETTLED is reached when the swap invoice in a loop in swap has been
     * paid, but we are still waiting for the htlc spend to confirm.
     */
    INVOICE_SETTLED = 'INVOICE_SETTLED',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum FailureReason {
    /**
     * FAILURE_REASON_NONE - FAILURE_REASON_NONE is set when the swap did not fail, it is either in
     * progress or succeeded.
     */
    FAILURE_REASON_NONE = 'FAILURE_REASON_NONE',
    /**
     * FAILURE_REASON_OFFCHAIN - FAILURE_REASON_OFFCHAIN indicates that a loop out failed because it wasn't
     * possible to find a route for one or both off chain payments that met the fee
     * and timelock limits required.
     */
    FAILURE_REASON_OFFCHAIN = 'FAILURE_REASON_OFFCHAIN',
    /**
     * FAILURE_REASON_TIMEOUT - FAILURE_REASON_TIMEOUT indicates that the swap failed because on chain htlc
     * did not confirm before its expiry, or it confirmed too late for us to reveal
     * our preimage and claim.
     */
    FAILURE_REASON_TIMEOUT = 'FAILURE_REASON_TIMEOUT',
    /**
     * FAILURE_REASON_SWEEP_TIMEOUT - FAILURE_REASON_SWEEP_TIMEOUT indicates that a loop out permanently failed
     * because the on chain htlc wasn't swept before the server revoked the
     * htlc.
     */
    FAILURE_REASON_SWEEP_TIMEOUT = 'FAILURE_REASON_SWEEP_TIMEOUT',
    /**
     * FAILURE_REASON_INSUFFICIENT_VALUE - FAILURE_REASON_INSUFFICIENT_VALUE indicates that a loop out has failed
     * because the on chain htlc had a lower value than requested.
     */
    FAILURE_REASON_INSUFFICIENT_VALUE = 'FAILURE_REASON_INSUFFICIENT_VALUE',
    /**
     * FAILURE_REASON_TEMPORARY - FAILURE_REASON_TEMPORARY indicates that a swap cannot continue due to an
     * internal error. Manual intervention such as a restart is required.
     */
    FAILURE_REASON_TEMPORARY = 'FAILURE_REASON_TEMPORARY',
    /**
     * FAILURE_REASON_INCORRECT_AMOUNT - FAILURE_REASON_INCORRECT_AMOUNT indicates that a loop in permanently failed
     * because the amount extended by an external loop in htlc is insufficient.
     */
    FAILURE_REASON_INCORRECT_AMOUNT = 'FAILURE_REASON_INCORRECT_AMOUNT',
    /**
     * FAILURE_REASON_ABANDONED - FAILURE_REASON_ABANDONED indicates that a swap permanently failed because
     * the client manually abandoned the swap.
     */
    FAILURE_REASON_ABANDONED = 'FAILURE_REASON_ABANDONED',
    /**
     * FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE - FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE indicates that a swap
     * wasn't published due to insufficient confirmed balance.
     */
    FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE = 'FAILURE_REASON_INSUFFICIENT_CONFIRMED_BALANCE',
    /**
     * FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT - FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT indicates that a swap
     * wasn't published due to insufficient confirmed balance.
     */
    FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT = 'FAILURE_REASON_INCORRECT_HTLC_AMT_SWEPT',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum LiquidityRuleType {
    UNKNOWN = 'UNKNOWN',
    THRESHOLD = 'THRESHOLD',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum AutoReason {
    AUTO_REASON_UNKNOWN = 'AUTO_REASON_UNKNOWN',
    /**
     * AUTO_REASON_BUDGET_NOT_STARTED - Budget not started indicates that we do not recommend any swaps because
     * the start time for our budget has not arrived yet.
     */
    AUTO_REASON_BUDGET_NOT_STARTED = 'AUTO_REASON_BUDGET_NOT_STARTED',
    /**
     * AUTO_REASON_SWEEP_FEES - Sweep fees indicates that the estimated fees to sweep swaps are too high
     * right now.
     */
    AUTO_REASON_SWEEP_FEES = 'AUTO_REASON_SWEEP_FEES',
    /**
     * AUTO_REASON_BUDGET_ELAPSED - Budget elapsed indicates that the autoloop budget for the period has been
     * elapsed.
     */
    AUTO_REASON_BUDGET_ELAPSED = 'AUTO_REASON_BUDGET_ELAPSED',
    /**
     * AUTO_REASON_IN_FLIGHT - In flight indicates that the limit on in-flight automatically dispatched
     * swaps has already been reached.
     */
    AUTO_REASON_IN_FLIGHT = 'AUTO_REASON_IN_FLIGHT',
    /** AUTO_REASON_SWAP_FEE - Swap fee indicates that the server fee for a specific swap is too high. */
    AUTO_REASON_SWAP_FEE = 'AUTO_REASON_SWAP_FEE',
    /** AUTO_REASON_MINER_FEE - Miner fee indicates that the miner fee for a specific swap is to high. */
    AUTO_REASON_MINER_FEE = 'AUTO_REASON_MINER_FEE',
    /** AUTO_REASON_PREPAY - Prepay indicates that the prepay fee for a specific swap is too high. */
    AUTO_REASON_PREPAY = 'AUTO_REASON_PREPAY',
    /**
     * AUTO_REASON_FAILURE_BACKOFF - Failure backoff indicates that a swap has recently failed for this target,
     * and the backoff period has not yet passed.
     */
    AUTO_REASON_FAILURE_BACKOFF = 'AUTO_REASON_FAILURE_BACKOFF',
    /**
     * AUTO_REASON_LOOP_OUT - Loop out indicates that a loop out swap is currently utilizing the channel,
     * so it is not eligible.
     */
    AUTO_REASON_LOOP_OUT = 'AUTO_REASON_LOOP_OUT',
    /**
     * AUTO_REASON_LOOP_IN - Loop In indicates that a loop in swap is currently in flight for the peer,
     * so it is not eligible.
     */
    AUTO_REASON_LOOP_IN = 'AUTO_REASON_LOOP_IN',
    /**
     * AUTO_REASON_LIQUIDITY_OK - Liquidity ok indicates that a target meets the liquidity balance expressed
     * in its rule, so no swap is needed.
     */
    AUTO_REASON_LIQUIDITY_OK = 'AUTO_REASON_LIQUIDITY_OK',
    /**
     * AUTO_REASON_BUDGET_INSUFFICIENT - Budget insufficient indicates that we cannot perform a swap because we do
     * not have enough pending budget available. This differs from budget elapsed,
     * because we still have some budget available, but we have allocated it to
     * other swaps.
     */
    AUTO_REASON_BUDGET_INSUFFICIENT = 'AUTO_REASON_BUDGET_INSUFFICIENT',
    /**
     * AUTO_REASON_FEE_INSUFFICIENT - Fee insufficient indicates that the fee estimate for a swap is higher than
     * the portion of total swap amount that we allow fees to consume.
     */
    AUTO_REASON_FEE_INSUFFICIENT = 'AUTO_REASON_FEE_INSUFFICIENT',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum DepositState {
    /** UNKNOWN_STATE - UNKNOWN_STATE is the default state of a deposit. */
    UNKNOWN_STATE = 'UNKNOWN_STATE',
    /**
     * DEPOSITED - DEPOSITED indicates that the deposit has been sufficiently confirmed on
     * chain.
     */
    DEPOSITED = 'DEPOSITED',
    /**
     * WITHDRAWING - WITHDRAWING indicates that the deposit is currently being withdrawn. It
     * flips to WITHDRAWN once the withdrawal transaction has been sufficiently
     * confirmed.
     */
    WITHDRAWING = 'WITHDRAWING',
    /** WITHDRAWN - WITHDRAWN indicates that the deposit has been withdrawn. */
    WITHDRAWN = 'WITHDRAWN',
    /**
     * LOOPING_IN - LOOPING_IN indicates that the deposit is currently being used in a static
     * address loop-in swap.
     */
    LOOPING_IN = 'LOOPING_IN',
    /**
     * LOOPED_IN - LOOPED_IN indicates that the deposit was used in a static address loop-in
     * swap.
     */
    LOOPED_IN = 'LOOPED_IN',
    /**
     * SWEEP_HTLC_TIMEOUT - SWEEP_HTLC_TIMEOUT indicates that the deposit is part of an active loop-in
     * of which the respective htlc was published by the server and the timeout
     * path has opened up for the client to sweep.
     */
    SWEEP_HTLC_TIMEOUT = 'SWEEP_HTLC_TIMEOUT',
    /**
     * HTLC_TIMEOUT_SWEPT - HTLC_TIMEOUT_SWEPT indicates that the timeout path of the htlc has been
     * swept by the client.
     */
    HTLC_TIMEOUT_SWEPT = 'HTLC_TIMEOUT_SWEPT',
    /**
     * PUBLISH_EXPIRED - PUBLISH_EXPIRED indicates that the deposit has expired and the sweep
     * transaction has been published.
     */
    PUBLISH_EXPIRED = 'PUBLISH_EXPIRED',
    /**
     * WAIT_FOR_EXPIRY_SWEEP - WAIT_FOR_EXPIRY_SWEEP indicates that the deposit has expired and the sweep
     * transaction has not yet been sufficiently confirmed.
     */
    WAIT_FOR_EXPIRY_SWEEP = 'WAIT_FOR_EXPIRY_SWEEP',
    /**
     * EXPIRED - EXPIRED indicates that the deposit has expired and the sweep transaction
     * has been sufficiently confirmed.
     */
    EXPIRED = 'EXPIRED',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum StaticAddressLoopInSwapState {
    /** UNKNOWN_STATIC_ADDRESS_SWAP_STATE -  */
    UNKNOWN_STATIC_ADDRESS_SWAP_STATE = 'UNKNOWN_STATIC_ADDRESS_SWAP_STATE',
    /** INIT_HTLC -  */
    INIT_HTLC = 'INIT_HTLC',
    /** SIGN_HTLC_TX -  */
    SIGN_HTLC_TX = 'SIGN_HTLC_TX',
    /** MONITOR_INVOICE_HTLC_TX -  */
    MONITOR_INVOICE_HTLC_TX = 'MONITOR_INVOICE_HTLC_TX',
    /** PAYMENT_RECEIVED -  */
    PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
    /** SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT -  */
    SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT = 'SWEEP_STATIC_ADDRESS_HTLC_TIMEOUT',
    /** MONITOR_HTLC_TIMEOUT_SWEEP -  */
    MONITOR_HTLC_TIMEOUT_SWEEP = 'MONITOR_HTLC_TIMEOUT_SWEEP',
    /** HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT -  */
    HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT = 'HTLC_STATIC_ADDRESS_TIMEOUT_SWEPT',
    /** SUCCEEDED -  */
    SUCCEEDED = 'SUCCEEDED',
    /** SUCCEEDED_TRANSITIONING_FAILED -  */
    SUCCEEDED_TRANSITIONING_FAILED = 'SUCCEEDED_TRANSITIONING_FAILED',
    /** UNLOCK_DEPOSITS -  */
    UNLOCK_DEPOSITS = 'UNLOCK_DEPOSITS',
    /** FAILED_STATIC_ADDRESS_SWAP -  */
    FAILED_STATIC_ADDRESS_SWAP = 'FAILED_STATIC_ADDRESS_SWAP',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface LoopOutRequest {
    /** Requested swap amount in sat. This does not include the swap and miner fee. */
    amt: string;
    /** Base58 encoded destination address for the swap. */
    dest: string;
    /**
     * Maximum off-chain fee in sat that may be paid for swap payment to the
     * server. This limit is applied during path finding. Typically this value is
     * taken from the response of the GetQuote call.
     */
    maxSwapRoutingFee: string;
    /**
     * Maximum off-chain fee in sat that may be paid for the prepay to the server.
     * This limit is applied during path finding. Typically this value is taken
     * from the response of the GetQuote call.
     */
    maxPrepayRoutingFee: string;
    /**
     * Maximum we are willing to pay the server for the swap. This value is not
     * disclosed in the swap initiation call, but if the server asks for a
     * higher fee, we abort the swap. Typically this value is taken from the
     * response of the GetQuote call. It includes the prepay amount.
     */
    maxSwapFee: string;
    /** Maximum amount of the swap fee that may be charged as a prepayment. */
    maxPrepayAmt: string;
    /**
     * Maximum in on-chain fees that we are willing to spend. If we want to
     * sweep the on-chain htlc and the fee estimate turns out higher than this
     * value, we cancel the swap. If the fee estimate is lower, we publish the
     * sweep tx.
     *
     * If the sweep tx is not confirmed, we are forced to ratchet up fees until it
     * is swept. Possibly even exceeding max_miner_fee if we get close to the htlc
     * timeout. Because the initial publication revealed the preimage, we have no
     * other choice. The server may already have pulled the off-chain htlc. Only
     * when the fee becomes higher than the swap amount, we can only wait for fees
     * to come down and hope - if we are past the timeout - that the server is not
     * publishing the revocation.
     *
     * max_miner_fee is typically taken from the response of the GetQuote call.
     */
    maxMinerFee: string;
    /**
     * Deprecated, use outgoing_chan_set. The channel to loop out, the channel
     * to loop out is selected based on the lowest routing fee for the swap
     * payment to the server.
     *
     * @deprecated
     */
    loopOutChannel: string;
    /**
     * A restriction on the channel set that may be used to loop out. The actual
     * channel(s) that will be used are selected based on the lowest routing fee
     * for the swap payment to the server.
     */
    outgoingChanSet: string[];
    /**
     * The number of blocks from the on-chain HTLC's confirmation height that it
     * should be swept within.
     */
    sweepConfTarget: number;
    /**
     * The number of confirmations that we require for the on chain htlc that will
     * be published by the server before we reveal the preimage.
     */
    htlcConfirmations: number;
    /**
     * The latest time (in unix seconds) we allow the server to wait before
     * publishing the HTLC on chain. Setting this to a larger value will give the
     * server the opportunity to batch multiple swaps together, and wait for
     * low-fee periods before publishing the HTLC, potentially resulting in a
     * lower total swap fee.
     */
    swapPublicationDeadline: string;
    /**
     * An optional label for this swap. This field is limited to 500 characters
     * and may not start with the prefix [reserved], which is used to tag labels
     * produced by the daemon.
     */
    label: string;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of loop. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (loopd, LiT) and the method used for
     * triggering the swap (loop CLI, autolooper, LiT UI, other 3rd party UI).
     */
    initiator: string;
    /**
     * An alternative destination address source for the swap. This field
     * represents the name of the account in the backing lnd instance.
     * Refer to lnd's wallet import functions for reference.
     */
    account: string;
    /** The address type of the account specified in the account field. */
    accountAddrType: AddressType;
    /**
     * A flag indicating whether the defined destination address does not belong to
     * the wallet. This is used to flag whether this loop out swap could have its
     * associated sweep batched.
     */
    isExternalAddr: boolean;
    /**
     * The reservations to use for the swap. If this field is set, loop will try
     * to use the instant out flow using the given reservations. If the
     * reservations are not sufficient, the swap will fail. The swap amount must
     * be equal to the sum of the amounts of the reservations.
     */
    reservationIds: Uint8Array | string[];
    /**
     * The timeout in seconds to use for off-chain payments. Note that the swap
     * payment is attempted multiple times where each attempt will set this value
     * as the timeout for the payment.
     */
    paymentTimeout: number;
}

export interface LoopInRequest {
    /**
     * Requested swap amount in sat. This does not include the swap and miner
     * fee.
     */
    amt: string;
    /**
     * Maximum we are willing to pay the server for the swap. This value is not
     * disclosed in the swap initiation call, but if the server asks for a
     * higher fee, we abort the swap. Typically this value is taken from the
     * response of the GetQuote call.
     */
    maxSwapFee: string;
    /**
     * Maximum in on-chain fees that we are willing to spend. If we want to
     * publish the on-chain htlc and the fee estimate turns out higher than this
     * value, we cancel the swap.
     *
     * max_miner_fee is typically taken from the response of the GetQuote call.
     */
    maxMinerFee: string;
    /**
     * The last hop to use for the loop in swap. If empty, the last hop is selected
     * based on the lowest routing fee for the swap payment from the server.
     */
    lastHop: Uint8Array | string;
    /**
     * If external_htlc is true, we expect the htlc to be published by an external
     * actor.
     */
    externalHtlc: boolean;
    /** The number of blocks that the on chain htlc should confirm within. */
    htlcConfTarget: number;
    /**
     * An optional label for this swap. This field is limited to 500 characters
     * and may not be one of the reserved values in loop/labels Reserved list.
     */
    label: string;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of loop. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (loopd, LiT) and the method used for
     * triggering the swap (loop CLI, autolooper, LiT UI, other 3rd party UI).
     */
    initiator: string;
    /** Optional route hints to reach the destination through private channels. */
    routeHints: RouteHint[];
    /**
     * Private indicates whether the destination node should be considered
     * private. In which case, loop will generate hophints to assist with
     * probing and payment.
     */
    private: boolean;
}

export interface SwapResponse {
    /**
     * Swap identifier to track status in the update stream that is returned from
     * the Start() call. Currently this is the hash that locks the htlcs.
     * DEPRECATED: To make the API more consistent, this field is deprecated in
     * favor of id_bytes and will be removed in a future release.
     *
     * @deprecated
     */
    id: string;
    /**
     * Swap identifier to track status in the update stream that is returned from
     * the Start() call. Currently this is the hash that locks the htlcs.
     */
    idBytes: Uint8Array | string;
    /**
     * DEPRECATED. This field stores the address of the onchain htlc, but
     * depending on the request, the semantics are different.
     * - For internal loop-in htlc_address contains the address of the
     * native segwit (P2WSH) htlc.
     * /    - For loop-out htlc_address always contains the native segwit (P2WSH)
     * htlc address.
     *
     * @deprecated
     */
    htlcAddress: string;
    /**
     * The native segwit address of the on-chain htlc.
     * Used for both loop-in and loop-out.
     */
    htlcAddressP2wsh: string;
    /** The address of the v3 (taproot) htlc. Used for both loop-in and loop-out. */
    htlcAddressP2tr: string;
    /** A human-readable message received from the loop server. */
    serverMessage: string;
}

export interface MonitorRequest {}

export interface SwapStatus {
    /**
     * Requested swap amount in sat. This does not include the swap and miner
     * fee.
     */
    amt: string;
    /**
     * Swap identifier to track status in the update stream that is returned from
     * the Start() call. Currently this is the hash that locks the htlcs.
     * DEPRECATED: To make the API more consistent, this field is deprecated in
     * favor of id_bytes and will be removed in a future release.
     *
     * @deprecated
     */
    id: string;
    /**
     * Swap identifier to track status in the update stream that is returned from
     * the Start() call. Currently this is the hash that locks the htlcs.
     */
    idBytes: Uint8Array | string;
    /** The type of the swap. */
    type: SwapType;
    /** State the swap is currently in, see State enum. */
    state: SwapState;
    /** A failure reason for the swap, only set if the swap has failed. */
    failureReason: FailureReason;
    /** Initiation time of the swap. */
    initiationTime: string;
    /** Initiation time of the swap. */
    lastUpdateTime: string;
    /**
     * DEPRECATED:  This field stores the address of the onchain htlc.
     * - For internal loop-in htlc_address contains the address of the
     * native segwit (P2WSH) htlc.
     * - For loop-out htlc_address always contains the native segwit (P2WSH)
     * htlc address.
     *
     * @deprecated
     */
    htlcAddress: string;
    /** HTLC address (native segwit), used in loop-in and loop-out swaps. */
    htlcAddressP2wsh: string;
    /** The address of the v3 (taproot) htlc. Used for both loop-in and loop-out. */
    htlcAddressP2tr: string;
    /** Swap server cost */
    costServer: string;
    /** On-chain transaction cost */
    costOnchain: string;
    /** Off-chain routing fees */
    costOffchain: string;
    /** Optional last hop if provided in the loop in request. */
    lastHop: Uint8Array | string;
    /** Optional outgoing channel set if provided in the loop out request. */
    outgoingChanSet: string[];
    /** An optional label given to the swap on creation. */
    label: string;
}

export interface ListSwapsRequest {
    /** Optional filter to only return swaps that match the filter. */
    listSwapFilter: ListSwapsFilter | undefined;
}

export interface ListSwapsFilter {
    /** The type of the swap. */
    swapType: ListSwapsFilter_SwapTypeFilter;
    /** If set, only pending swaps are returned. */
    pendingOnly: boolean;
    /** If specified on creation, the outgoing channel set of the swap. */
    outgoingChanSet: string[];
    /** Label of swap to filter for. */
    label: string;
    /** If specified on creation, the last hop of the swap. */
    loopInLastHop: Uint8Array | string;
}

export enum ListSwapsFilter_SwapTypeFilter {
    /** ANY - ANY indicates that no filter is applied. */
    ANY = 'ANY',
    /** LOOP_OUT - LOOP_OUT indicates an loop out swap (off-chain to on-chain). */
    LOOP_OUT = 'LOOP_OUT',
    /** LOOP_IN - LOOP_IN indicates a loop in swap (on-chain to off-chain). */
    LOOP_IN = 'LOOP_IN',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface ListSwapsResponse {
    /** The list of all currently known swaps and their status. */
    swaps: SwapStatus[];
}

export interface SwapInfoRequest {
    /**
     * The swap identifier which currently is the hash that locks the HTLCs. When
     * using REST, this field must be encoded as URL safe base64.
     */
    id: Uint8Array | string;
}

export interface TermsRequest {}

export interface InTermsResponse {
    /** Minimum swap amount (sat) */
    minSwapAmount: string;
    /** Maximum swap amount (sat) */
    maxSwapAmount: string;
}

export interface OutTermsResponse {
    /** Minimum swap amount (sat) */
    minSwapAmount: string;
    /** Maximum swap amount (sat) */
    maxSwapAmount: string;
    /** The minimally accepted cltv delta of the on-chain htlc. */
    minCltvDelta: number;
    /** The maximally accepted cltv delta of the on-chain htlc. */
    maxCltvDelta: number;
}

export interface QuoteRequest {
    /** The amount to swap in satoshis. */
    amt: string;
    /**
     * The confirmation target that should be used either for the sweep of the
     * on-chain HTLC broadcast by the swap server in the case of a Loop Out, or for
     * the confirmation of the on-chain HTLC broadcast by the swap client in the
     * case of a Loop In.
     */
    confTarget: number;
    /**
     * If external_htlc is true, we expect the htlc to be published by an external
     * actor.
     */
    externalHtlc: boolean;
    /**
     * The latest time (in unix seconds) we allow the server to wait before
     * publishing the HTLC on chain. Setting this to a larger value will give the
     * server the opportunity to batch multiple swaps together, and wait for
     * low-fee periods before publishing the HTLC, potentially resulting in a
     * lower total swap fee. This only has an effect on loop out quotes.
     */
    swapPublicationDeadline: string;
    /**
     * Optionally the client can specify the last hop pubkey when requesting a
     * loop-in quote. This is useful to get better off-chain routing fee from the
     * server.
     */
    loopInLastHop: Uint8Array | string;
    /** Optional route hints to reach the destination through private channels. */
    loopInRouteHints: RouteHint[];
    /**
     * Private indicates whether the destination node should be considered
     * private. In which case, loop will generate hophints to assist with
     * probing and payment.
     */
    private: boolean;
    /**
     * Static address deposit outpoints that will be quoted for. This option only
     * pertains to loop in swaps. Either this or the amt parameter can be set at
     * the same time.
     */
    depositOutpoints: string[];
}

export interface InQuoteResponse {
    /** The fee that the swap server is charging for the swap. */
    swapFeeSat: string;
    /**
     * An estimate of the on-chain fee that needs to be paid to publish the HTLC
     * If a miner fee of 0 is returned, it means the external_htlc flag was set for
     * a loop in and the fee estimation was skipped. If a miner fee of -1 is
     * returned, it means lnd's wallet tried to estimate the fee but was unable to
     * create a sample estimation transaction because not enough funds are
     * available. An information message should be shown to the user in this case.
     */
    htlcPublishFeeSat: string;
    /** On-chain cltv expiry delta */
    cltvDelta: number;
    /** The confirmation target to be used to publish the on-chain HTLC. */
    confTarget: number;
}

export interface OutQuoteResponse {
    /** The fee that the swap server is charging for the swap. */
    swapFeeSat: string;
    /** The part of the swap fee that is requested as a prepayment. */
    prepayAmtSat: string;
    /**
     * An estimate of the on-chain fee that needs to be paid to sweep the HTLC for
     * a loop out.
     */
    htlcSweepFeeSat: string;
    /**
     * The node pubkey where the swap payment needs to be paid
     * to. This can be used to test connectivity before initiating the swap.
     */
    swapPaymentDest: Uint8Array | string;
    /** On-chain cltv expiry delta */
    cltvDelta: number;
    /** The confirmation target to be used for the sweep of the on-chain HTLC. */
    confTarget: number;
}

export interface ProbeRequest {
    /** The amount to probe. */
    amt: string;
    /** Optional last hop of the route to probe. */
    lastHop: Uint8Array | string;
    /** Optional route hints to reach the destination through private channels. */
    routeHints: RouteHint[];
}

export interface ProbeResponse {}

export interface TokensRequest {}

export interface TokensResponse {
    /** List of all tokens the daemon knows of, including old/expired tokens. */
    tokens: L402Token[];
}

export interface FetchL402TokenRequest {}

export interface FetchL402TokenResponse {}

export interface L402Token {
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
    /** The l402 ID of the token. */
    id: string;
}

export interface LoopStats {
    /** Number of currently pending swaps. */
    pendingCount: string;
    /** Number of succeeded swaps. */
    successCount: string;
    /** Number failed swaps. */
    failCount: string;
    /** The sum of all pending swap amounts. */
    sumPendingAmt: string;
    /** The sum of all succeeded swap amounts. */
    sumSucceededAmt: string;
}

export interface GetInfoRequest {}

export interface GetInfoResponse {
    /** The current daemon version. */
    version: string;
    /** The network the daemon is running on. */
    network: string;
    /** Host and port of the loopd grpc server. */
    rpcListen: string;
    /** Host and port of the loopd rest server. */
    restListen: string;
    /** Loop's macaroon path that clients use to talk to the daemon. */
    macaroonPath: string;
    /** Loop's tls cert path */
    tlsCertPath: string;
    /** Statistics about loop outs. */
    loopOutStats: LoopStats | undefined;
    /** Statistics about loop ins. */
    loopInStats: LoopStats | undefined;
}

export interface GetLiquidityParamsRequest {}

export interface LiquidityParameters {
    /** A set of liquidity rules that describe the desired liquidity balance. */
    rules: LiquidityRule[];
    /**
     * The parts per million of swap amount that is allowed to be allocated to swap
     * fees. This value is applied across swap categories and may not be set in
     * conjunction with sweep fee rate, swap fee ppm, routing fee ppm, prepay
     * routing, max prepay and max miner fee.
     */
    feePpm: string;
    /**
     * The limit we place on our estimated sweep cost for a swap in sat/vByte. If
     * the estimated fee for our sweep transaction within the specified
     * confirmation target is above this value, we will not suggest any swaps.
     */
    sweepFeeRateSatPerVbyte: string;
    /**
     * The maximum fee paid to the server for facilitating the swap, expressed
     * as parts per million of the swap volume.
     */
    maxSwapFeePpm: string;
    /**
     * The maximum fee paid to route the swap invoice off chain, expressed as
     * parts per million of the volume being routed.
     */
    maxRoutingFeePpm: string;
    /**
     * The maximum fee paid to route the prepay invoice off chain, expressed as
     * parts per million of the volume being routed.
     */
    maxPrepayRoutingFeePpm: string;
    /** The maximum no-show penalty in satoshis paid for a swap. */
    maxPrepaySat: string;
    /**
     * The maximum miner fee we will pay to sweep the swap on chain. Note that we
     * will not suggest a swap if the estimate is above the sweep limit set by
     * these parameters, and we use the current fee estimate to sweep on chain so
     * this value is only a cap placed on the amount we spend on fees in the case
     * where the swap needs to be claimed on chain, but fees have suddenly spiked.
     */
    maxMinerFeeSat: string;
    /**
     * The number of blocks from the on-chain HTLC's confirmation height that it
     * should be swept within.
     */
    sweepConfTarget: number;
    /**
     * The amount of time we require pass since a channel was part of a failed
     * swap due to off chain payment failure until it will be considered for swap
     * suggestions again, expressed in seconds.
     */
    failureBackoffSec: string;
    /**
     * Set to true to enable automatic dispatch of swaps. All swaps will be limited
     * to the fee categories set by these parameters, and total expenditure will
     * be limited to the autoloop budget.
     */
    autoloop: boolean;
    /**
     * The total budget for automatically dispatched swaps since the budget start
     * time, expressed in satoshis.
     */
    autoloopBudgetSat: string;
    /**
     * Deprecated, use autoloop_budget_refresh_period_sec. The start time for
     * autoloop budget, expressed as a unix timestamp in seconds. If this value is
     * 0, the budget will be applied for all automatically dispatched swaps. Swaps
     * that were completed before this date will not be included in budget
     * calculations.
     *
     * @deprecated
     */
    autoloopBudgetStartSec: string;
    /**
     * The maximum number of automatically dispatched swaps that we allow to be in
     * flight at any point in time.
     */
    autoMaxInFlight: string;
    /**
     * The minimum amount, expressed in satoshis, that the autoloop client will
     * dispatch a swap for. This value is subject to the server-side limits
     * specified by the LoopOutTerms endpoint.
     */
    minSwapAmount: string;
    /**
     * The maximum amount, expressed in satoshis, that the autoloop client will
     * dispatch a swap for. This value is subject to the server-side limits
     * specified by the LoopOutTerms endpoint.
     */
    maxSwapAmount: string;
    /** The confirmation target for loop in on-chain htlcs. */
    htlcConfTarget: number;
    /**
     * The destination address to use for autoloop loop outs. Set to "default" in
     * order to revert to default behavior.
     */
    autoloopDestAddress: string;
    /**
     * The period over which the autoloop budget is refreshed, expressed in
     * seconds.
     */
    autoloopBudgetRefreshPeriodSec: string;
    /**
     * The time at which the autoloop budget was last refreshed, expressed as a
     * UNIX timestamp in seconds.
     */
    autoloopBudgetLastRefresh: string;
    /**
     * Set to true to enable easy autoloop. If set, all channel/peer rules will be
     * overridden and the client will automatically dispatch swaps in order to meet
     * the configured local balance target size. Currently only loop out is
     * supported, meaning that easy autoloop can only reduce the funds that are
     * held as balance in channels.
     */
    easyAutoloop: boolean;
    /**
     * The local balance target size, expressed in satoshis. This is used by easy
     * autoloop to determine how much liquidity should be maintained in channels.
     */
    easyAutoloopLocalTargetSat: string;
    /**
     * An alternative destination address source for the swap. This field
     * represents the name of the account in the backing lnd instance.
     * Refer to lnd's wallet import functions for reference.
     */
    account: string;
    /** The address type of the account specified in the account field. */
    accountAddrType: AddressType;
}

export interface LiquidityRule {
    /**
     * The short channel ID of the channel that this rule should be applied to.
     * This field may not be set when the pubkey field is set.
     */
    channelId: string;
    /** The type of swap that will be dispatched for this rule. */
    swapType: SwapType;
    /**
     * The public key of the peer that this rule should be applied to. This field
     * may not be set when the channel id field is set.
     */
    pubkey: Uint8Array | string;
    /**
     * Type indicates the type of rule that this message rule represents. Setting
     * this value will determine which fields are used in the message. The comments
     * on each field in this message will be prefixed with the LiquidityRuleType
     * they belong to.
     */
    type: LiquidityRuleType;
    /**
     * THRESHOLD: The percentage of total capacity that incoming capacity should
     * not drop beneath.
     */
    incomingThreshold: number;
    /**
     * THRESHOLD: The percentage of total capacity that outgoing capacity should
     * not drop beneath.
     */
    outgoingThreshold: number;
}

export interface SetLiquidityParamsRequest {
    /**
     * Parameters is the desired new set of parameters for the liquidity management
     * subsystem. Note that the current set of parameters will be completely
     * overwritten by the parameters provided (if they are valid), so the full set
     * of parameters should be provided for each call.
     */
    parameters: LiquidityParameters | undefined;
}

export interface SetLiquidityParamsResponse {}

export interface SuggestSwapsRequest {}

export interface Disqualified {
    /** The short channel ID of the channel that was excluded from our suggestions. */
    channelId: string;
    /** The public key of the peer that was excluded from our suggestions. */
    pubkey: Uint8Array | string;
    /** The reason that we excluded the channel from the our suggestions. */
    reason: AutoReason;
}

export interface SuggestSwapsResponse {
    /** The set of recommended loop outs. */
    loopOut: LoopOutRequest[];
    /** The set of recommended loop in swaps */
    loopIn: LoopInRequest[];
    /**
     * Disqualified contains the set of channels that swaps are not recommended
     * for.
     */
    disqualified: Disqualified[];
}

export interface AbandonSwapRequest {
    /**
     * The swap identifier which currently is the hash that locks the HTLCs. When
     * using REST, this field must be encoded as URL safe base64.
     */
    id: Uint8Array | string;
    /**
     * A flag that tries to ensure that the client understands that they are
     * risking loss of funds by abandoning a swap. This could happen if an
     * abandoned swap would wait on a timeout sweep by the client.
     */
    iKnowWhatIAmDoing: boolean;
}

export interface AbandonSwapResponse {}

export interface ListReservationsRequest {}

export interface ListReservationsResponse {
    /** The list of all currently known reservations and their status. */
    reservations: ClientReservation[];
}

export interface ClientReservation {
    /** The reservation id that identifies this reservation. */
    reservationId: Uint8Array | string;
    /** The state the reservation is in. */
    state: string;
    /** The amount that the reservation is for. */
    amount: string;
    /** The transaction id of the reservation. */
    txId: string;
    /** The vout of the reservation. */
    vout: number;
    /** The expiry of the reservation. */
    expiry: number;
}

export interface InstantOutRequest {
    /** The reservations to use for the swap. */
    reservationIds: Uint8Array | string[];
    /**
     * A restriction on the channel set that may be used to loop out. The actual
     * channel(s) that will be used are selected based on the lowest routing fee
     * for the swap payment to the server.
     */
    outgoingChanSet: string[];
    /**
     * An optional address to sweep the onchain funds to. If not set, the funds
     * will be swept to the wallet's internal address.
     */
    destAddr: string;
}

export interface InstantOutResponse {
    /** The hash of the swap preimage. */
    instantOutHash: Uint8Array | string;
    /** The transaction id of the sweep transaction. */
    sweepTxId: string;
    /** The state of the swap. */
    state: string;
}

export interface InstantOutQuoteRequest {
    /** The amount to swap in satoshis. */
    amt: string;
    /** The amount of reservations to use for the swap. */
    numReservations: number;
}

export interface InstantOutQuoteResponse {
    /** The fee that the swap service is charging for the swap. */
    serviceFeeSat: string;
    /**
     * The estimated on-chain fee that needs to be paid to publish the Sweepless
     * Sweep.
     */
    sweepFeeSat: string;
}

export interface ListInstantOutsRequest {}

export interface ListInstantOutsResponse {
    /** The list of all currently known instant out swaps and their status. */
    swaps: InstantOut[];
}

export interface InstantOut {
    /** The swap hash that identifies this swap. */
    swapHash: Uint8Array | string;
    /** The state the swap is in. */
    state: string;
    /** The amount of the swap. */
    amount: string;
    /** The used reservations for the swap. */
    reservationIds: Uint8Array | string[];
    /** The sweep transaction id of the swap. */
    sweepTxId: string;
}

export interface NewStaticAddressRequest {
    /** The client's public key for the 2-of-2 MuSig2 taproot static address. */
    clientKey: Uint8Array | string;
}

export interface NewStaticAddressResponse {
    /** The taproot static address. */
    address: string;
    /** The CSV expiry of the static address. */
    expiry: number;
}

export interface ListUnspentDepositsRequest {
    /** The number of minimum confirmations a utxo must have to be listed. */
    minConfs: number;
    /**
     * The number of maximum confirmations a utxo may have to be listed. A zero
     * value indicates that there is no maximum.
     */
    maxConfs: number;
}

export interface ListUnspentDepositsResponse {
    /** A list of utxos behind the static address. */
    utxos: Utxo[];
}

export interface Utxo {
    /** The static address of the utxo. */
    staticAddress: string;
    /** The value of the unspent coin in satoshis. */
    amountSat: string;
    /** The outpoint in the form txid:index. */
    outpoint: string;
    /** The number of confirmations for the Utxo. */
    confirmations: string;
}

export interface WithdrawDepositsRequest {
    /** The outpoints of the deposits to withdraw. */
    outpoints: OutPoint[];
    /** If set to true, all deposits will be withdrawn. */
    all: boolean;
    /** The address to withdraw the funds to. */
    destAddr: string;
    /** The fee rate in sat/vbyte to use for the withdrawal transaction. */
    satPerVbyte: string;
}

export interface WithdrawDepositsResponse {
    /** The transaction hash of the withdrawal transaction. */
    withdrawalTxHash: string;
    /** The pkscript of the withdrawal transaction. */
    pkScript: string;
}

export interface OutPoint {
    /** Raw bytes representing the transaction id. */
    txidBytes: Uint8Array | string;
    /** Reversed, hex-encoded string representing the transaction id. */
    txidStr: string;
    /** The index of the output on the transaction. */
    outputIndex: number;
}

export interface ListStaticAddressDepositsRequest {
    /** Filters the list of all stored deposits by deposit state. */
    stateFilter: DepositState;
    /** Filters the list of all stored deposits by the outpoint. */
    outpoints: string[];
}

export interface ListStaticAddressDepositsResponse {
    /** A list of all deposits that match the filtered state. */
    filteredDeposits: Deposit[];
}

export interface ListStaticAddressSwapsRequest {}

export interface ListStaticAddressSwapsResponse {
    /** A list of all swaps known static address loop-in swaps. */
    swaps: StaticAddressLoopInSwap[];
}

export interface StaticAddressSummaryRequest {}

export interface StaticAddressSummaryResponse {
    /** The static address of the client. */
    staticAddress: string;
    /** The CSV expiry of the static address. */
    relativeExpiryBlocks: string;
    /** The total number of deposits. */
    totalNumDeposits: number;
    /** The total value of unconfirmed deposits. */
    valueUnconfirmedSatoshis: string;
    /** The total value of confirmed deposits. */
    valueDepositedSatoshis: string;
    /** The total value of all expired deposits. */
    valueExpiredSatoshis: string;
    /** The total value of all deposits that have been withdrawn. */
    valueWithdrawnSatoshis: string;
    /** The total value of all loop-ins that have been finalized. */
    valueLoopedInSatoshis: string;
    /** The total value of all htlc timeout sweeps that the client swept. */
    valueHtlcTimeoutSweepsSatoshis: string;
}

export interface Deposit {
    /** The identifier of the deposit. */
    id: Uint8Array | string;
    /** The state of the deposit. */
    state: DepositState;
    /** The outpoint of the deposit in format txid:index. */
    outpoint: string;
    /** The value of the deposit in satoshis. */
    value: string;
    /** The block height at which the deposit was confirmed. */
    confirmationHeight: string;
    /**
     * The number of blocks that are left until the deposit cannot be used for a
     * loop-in swap anymore.
     */
    blocksUntilExpiry: string;
}

export interface StaticAddressLoopInSwap {
    /** The swap hash of the swap. It represents the unique identifier of the swap. */
    swapHash: Uint8Array | string;
    /**  */
    depositOutpoints: string[];
    /**  */
    state: StaticAddressLoopInSwapState;
    /**
     * The swap amount of the swap. It is the sum of the values of the deposit
     * outpoints that were used for this swap.
     */
    swapAmountSatoshis: string;
    /**
     * The invoiced swap amount. It is the swap amount minus the quoted server
     * fees.
     */
    paymentRequestAmountSatoshis: string;
}

export interface StaticAddressLoopInRequest {
    /** The outpoints of the deposits to loop-in. */
    outpoints: string[];
    /**
     * Maximum satoshis we are willing to pay the server for the swap. This value
     * is not disclosed in the swap initiation call, but if the server asks for a
     * higher fee, we abort the swap. Typically this value is taken from the
     * response of the GetQuote call.
     */
    maxSwapFeeSatoshis: string;
    /**
     * Optionally the client can specify the last hop pubkey when requesting a
     * loop-in quote. This is useful to get better off-chain routing fee from the
     * server.
     */
    lastHop: Uint8Array | string;
    /**
     * An optional label for this swap. This field is limited to 500 characters and
     * may not be one of the reserved values in loop/labels Reserved list.
     */
    label: string;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of loop. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (loopd, LiT) and the method used for
     * triggering the swap (loop CLI, autolooper, LiT UI, other 3rd party UI).
     */
    initiator: string;
    /** Optional route hints to reach the destination through private channels. */
    routeHints: RouteHint[];
    /**
     * Private indicates whether the destination node should be considered private.
     * In which case, loop will generate hop hints to assist with probing and
     * payment.
     */
    private: boolean;
    /**
     * The swap payment timeout allows the user to specify an upper limit for the
     * amount of time the server is allowed to take to fulfill the off-chain swap
     * payment. If the timeout is reached the swap will be aborted on the server
     * side and the client can retry the swap with different parameters.
     */
    paymentTimeoutSeconds: number;
}

export interface StaticAddressLoopInResponse {
    /** The swap hash that identifies this swap. */
    swapHash: Uint8Array | string;
    /** The state the swap is in. */
    state: string;
    /** The amount of the swap. */
    amount: string;
    /** The htlc cltv expiry height of the swap. */
    htlcCltv: number;
    /** The quoted swap fee in satoshis. */
    quotedSwapFeeSatoshis: string;
    /** The maximum total swap fee the client is willing to pay for the swap. */
    maxSwapFeeSatoshis: string;
    /** The block height at which the swap was initiated. */
    initiationHeight: number;
    /** The static address protocol version. */
    protocolVersion: string;
    /** An optional label for this swap. */
    label: string;
    /**
     * An optional identification string that will be appended to the user agent
     * string sent to the server to give information about the usage of loop. This
     * initiator part is meant for user interfaces to add their name to give the
     * full picture of the binary used (loopd, LiT) and the method used for
     * triggering the swap (loop CLI, autolooper, LiT UI, other 3rd party UI).
     */
    initiator: string;
    /**
     * The swap payment timeout allows the user to specify an upper limit for the
     * amount of time the server is allowed to take to fulfill the off-chain swap
     * payment. If the timeout is reached the swap will be aborted on the server
     * side and the client can retry the swap with different parameters.
     */
    paymentTimeoutSeconds: number;
}

/**
 * SwapClient is a service that handles the client side process of onchain/offchain
 * swaps. The service is designed for a single client.
 */
export interface SwapClient {
    /**
     * loop: `out`
     * LoopOut initiates an loop out swap with the given parameters. The call
     * returns after the swap has been set up with the swap server. From that
     * point onwards, progress can be tracked via the SwapStatus stream that is
     * returned from Monitor().
     */
    loopOut(request?: DeepPartial<LoopOutRequest>): Promise<SwapResponse>;
    /**
     * loop: `in`
     * LoopIn initiates a loop in swap with the given parameters. The call
     * returns after the swap has been set up with the swap server. From that
     * point onwards, progress can be tracked via the SwapStatus stream
     * that is returned from Monitor().
     */
    loopIn(request?: DeepPartial<LoopInRequest>): Promise<SwapResponse>;
    /**
     * loop: `monitor`
     * Monitor will return a stream of swap updates for currently active swaps.
     */
    monitor(
        request?: DeepPartial<MonitorRequest>,
        onMessage?: (msg: SwapStatus) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * loop: `listswaps`
     * ListSwaps returns a list of all currently known swaps and their current
     * status.
     */
    listSwaps(
        request?: DeepPartial<ListSwapsRequest>
    ): Promise<ListSwapsResponse>;
    /**
     * loop: `swapinfo`
     * SwapInfo returns all known details about a single swap.
     */
    swapInfo(request?: DeepPartial<SwapInfoRequest>): Promise<SwapStatus>;
    /**
     * loop: `abandonswap`
     * AbandonSwap allows the client to abandon a swap.
     */
    abandonSwap(
        request?: DeepPartial<AbandonSwapRequest>
    ): Promise<AbandonSwapResponse>;
    /**
     * loop: `terms`
     * LoopOutTerms returns the terms that the server enforces for a loop out swap.
     */
    loopOutTerms(
        request?: DeepPartial<TermsRequest>
    ): Promise<OutTermsResponse>;
    /**
     * loop: `quote`
     * LoopOutQuote returns a quote for a loop out swap with the provided
     * parameters.
     */
    loopOutQuote(
        request?: DeepPartial<QuoteRequest>
    ): Promise<OutQuoteResponse>;
    /**
     * loop: `terms`
     * GetTerms returns the terms that the server enforces for swaps.
     */
    getLoopInTerms(
        request?: DeepPartial<TermsRequest>
    ): Promise<InTermsResponse>;
    /**
     * loop: `quote`
     * GetQuote returns a quote for a swap with the provided parameters.
     */
    getLoopInQuote(
        request?: DeepPartial<QuoteRequest>
    ): Promise<InQuoteResponse>;
    /**
     * Probe asks he sever to probe the route to us to have a better upfront
     * estimate about routing fees when loopin-in.
     */
    probe(request?: DeepPartial<ProbeRequest>): Promise<ProbeResponse>;
    /**
     * loop: `listauth`
     * GetL402Tokens returns all L402 tokens the daemon ever paid for.
     */
    getL402Tokens(
        request?: DeepPartial<TokensRequest>
    ): Promise<TokensResponse>;
    /**
     * Deprecated: use GetL402Tokens.
     * This API is provided to maintain backward compatibility with gRPC clients
     * (e.g. `loop listauth`, Terminal Web, RTL).
     * Type LsatToken used by GetLsatTokens in the past was renamed to L402Token,
     * but this does not affect binary encoding, so we can use type L402Token here.
     */
    getLsatTokens(
        request?: DeepPartial<TokensRequest>
    ): Promise<TokensResponse>;
    /**
     * loop: `fetchl402`
     * FetchL402Token fetches an L402 token from the server, this is required in
     * order to receive reservation notifications from the server.
     */
    fetchL402Token(
        request?: DeepPartial<FetchL402TokenRequest>
    ): Promise<FetchL402TokenResponse>;
    /**
     * loop: `getinfo`
     * GetInfo gets basic information about the loop daemon.
     */
    getInfo(request?: DeepPartial<GetInfoRequest>): Promise<GetInfoResponse>;
    /**
     * loop: `getparams`
     * GetLiquidityParams gets the parameters that the daemon's liquidity manager
     * is currently configured with. This may be nil if nothing is configured.
     * [EXPERIMENTAL]: endpoint is subject to change.
     */
    getLiquidityParams(
        request?: DeepPartial<GetLiquidityParamsRequest>
    ): Promise<LiquidityParameters>;
    /**
     * loop: `setparams`
     * SetLiquidityParams sets a new set of parameters for the daemon's liquidity
     * manager. Note that the full set of parameters must be provided, because
     * this call fully overwrites our existing parameters.
     * [EXPERIMENTAL]: endpoint is subject to change.
     */
    setLiquidityParams(
        request?: DeepPartial<SetLiquidityParamsRequest>
    ): Promise<SetLiquidityParamsResponse>;
    /**
     * loop: `suggestswaps`
     * SuggestSwaps returns a list of recommended swaps based on the current
     * state of your node's channels and it's liquidity manager parameters.
     * Note that only loop out suggestions are currently supported.
     * [EXPERIMENTAL]: endpoint is subject to change.
     */
    suggestSwaps(
        request?: DeepPartial<SuggestSwapsRequest>
    ): Promise<SuggestSwapsResponse>;
    /**
     * loop: `listreservations`
     * ListReservations returns a list of all reservations the server opened to us.
     */
    listReservations(
        request?: DeepPartial<ListReservationsRequest>
    ): Promise<ListReservationsResponse>;
    /**
     * loop: `instantout`
     * InstantOut initiates an instant out swap with the given parameters.
     */
    instantOut(
        request?: DeepPartial<InstantOutRequest>
    ): Promise<InstantOutResponse>;
    /**
     * loop: `instantoutquote`
     * InstantOutQuote returns a quote for an instant out swap with the provided
     * parameters.
     */
    instantOutQuote(
        request?: DeepPartial<InstantOutQuoteRequest>
    ): Promise<InstantOutQuoteResponse>;
    /**
     * loop: `listinstantouts`
     * ListInstantOuts returns a list of all currently known instant out swaps and
     * their current status.
     */
    listInstantOuts(
        request?: DeepPartial<ListInstantOutsRequest>
    ): Promise<ListInstantOutsResponse>;
    /**
     * loop: `static newstaticaddress`
     * NewStaticAddress requests a new static address for loop-ins from the server.
     */
    newStaticAddress(
        request?: DeepPartial<NewStaticAddressRequest>
    ): Promise<NewStaticAddressResponse>;
    /**
     * loop: `static listunspentdeposits`
     * ListUnspentDeposits returns a list of utxos deposited at a static address.
     */
    listUnspentDeposits(
        request?: DeepPartial<ListUnspentDepositsRequest>
    ): Promise<ListUnspentDepositsResponse>;
    /**
     * loop:`static withdraw`
     * WithdrawDeposits withdraws a selection or all deposits of a static address.
     */
    withdrawDeposits(
        request?: DeepPartial<WithdrawDepositsRequest>
    ): Promise<WithdrawDepositsResponse>;
    /**
     * loop:`listdeposits`
     * ListStaticAddressDeposits returns a list of filtered static address
     * deposits.
     */
    listStaticAddressDeposits(
        request?: DeepPartial<ListStaticAddressDepositsRequest>
    ): Promise<ListStaticAddressDepositsResponse>;
    /**
     * loop:`listswaps`
     * ListStaticAddressSwaps returns a list of filtered static address
     * swaps.
     */
    listStaticAddressSwaps(
        request?: DeepPartial<ListStaticAddressSwapsRequest>
    ): Promise<ListStaticAddressSwapsResponse>;
    /**
     * loop:`static summary`
     * GetStaticAddressSummary returns a summary of static address related
     * statistics.
     */
    getStaticAddressSummary(
        request?: DeepPartial<StaticAddressSummaryRequest>
    ): Promise<StaticAddressSummaryResponse>;
    /**
     * loop:`static`
     * StaticAddressLoopIn initiates a static address loop-in swap.
     */
    staticAddressLoopIn(
        request?: DeepPartial<StaticAddressLoopInRequest>
    ): Promise<StaticAddressLoopInResponse>;
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
