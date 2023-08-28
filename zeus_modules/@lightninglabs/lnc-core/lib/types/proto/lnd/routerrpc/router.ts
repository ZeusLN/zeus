/* eslint-disable */
import type {
    Failure_FailureCode,
    RouteHint,
    FeatureBit,
    Route,
    Failure,
    HTLCAttempt,
    ChannelPoint,
    Payment
} from '../lightning';

export enum FailureDetail {
    UNKNOWN = 'UNKNOWN',
    NO_DETAIL = 'NO_DETAIL',
    ONION_DECODE = 'ONION_DECODE',
    LINK_NOT_ELIGIBLE = 'LINK_NOT_ELIGIBLE',
    ON_CHAIN_TIMEOUT = 'ON_CHAIN_TIMEOUT',
    HTLC_EXCEEDS_MAX = 'HTLC_EXCEEDS_MAX',
    INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
    INCOMPLETE_FORWARD = 'INCOMPLETE_FORWARD',
    HTLC_ADD_FAILED = 'HTLC_ADD_FAILED',
    FORWARDS_DISABLED = 'FORWARDS_DISABLED',
    INVOICE_CANCELED = 'INVOICE_CANCELED',
    INVOICE_UNDERPAID = 'INVOICE_UNDERPAID',
    INVOICE_EXPIRY_TOO_SOON = 'INVOICE_EXPIRY_TOO_SOON',
    INVOICE_NOT_OPEN = 'INVOICE_NOT_OPEN',
    MPP_INVOICE_TIMEOUT = 'MPP_INVOICE_TIMEOUT',
    ADDRESS_MISMATCH = 'ADDRESS_MISMATCH',
    SET_TOTAL_MISMATCH = 'SET_TOTAL_MISMATCH',
    SET_TOTAL_TOO_LOW = 'SET_TOTAL_TOO_LOW',
    SET_OVERPAID = 'SET_OVERPAID',
    UNKNOWN_INVOICE = 'UNKNOWN_INVOICE',
    INVALID_KEYSEND = 'INVALID_KEYSEND',
    MPP_IN_PROGRESS = 'MPP_IN_PROGRESS',
    CIRCULAR_ROUTE = 'CIRCULAR_ROUTE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum PaymentState {
    /** IN_FLIGHT - Payment is still in flight. */
    IN_FLIGHT = 'IN_FLIGHT',
    /** SUCCEEDED - Payment completed successfully. */
    SUCCEEDED = 'SUCCEEDED',
    /** FAILED_TIMEOUT - There are more routes to try, but the payment timeout was exceeded. */
    FAILED_TIMEOUT = 'FAILED_TIMEOUT',
    /**
     * FAILED_NO_ROUTE - All possible routes were tried and failed permanently. Or were no
     * routes to the destination at all.
     */
    FAILED_NO_ROUTE = 'FAILED_NO_ROUTE',
    /** FAILED_ERROR - A non-recoverable error has occurred. */
    FAILED_ERROR = 'FAILED_ERROR',
    /**
     * FAILED_INCORRECT_PAYMENT_DETAILS - Payment details incorrect (unknown hash, invalid amt or
     * invalid final cltv delta)
     */
    FAILED_INCORRECT_PAYMENT_DETAILS = 'FAILED_INCORRECT_PAYMENT_DETAILS',
    /** FAILED_INSUFFICIENT_BALANCE - Insufficient local balance. */
    FAILED_INSUFFICIENT_BALANCE = 'FAILED_INSUFFICIENT_BALANCE',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum ResolveHoldForwardAction {
    SETTLE = 'SETTLE',
    FAIL = 'FAIL',
    RESUME = 'RESUME',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export enum ChanStatusAction {
    ENABLE = 'ENABLE',
    DISABLE = 'DISABLE',
    AUTO = 'AUTO',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface SendPaymentRequest {
    /** The identity pubkey of the payment recipient */
    dest: Uint8Array | string;
    /**
     * Number of satoshis to send.
     *
     * The fields amt and amt_msat are mutually exclusive.
     */
    amt: string;
    /**
     * Number of millisatoshis to send.
     *
     * The fields amt and amt_msat are mutually exclusive.
     */
    amtMsat: string;
    /** The hash to use within the payment's HTLC */
    paymentHash: Uint8Array | string;
    /**
     * The CLTV delta from the current height that should be used to set the
     * timelock for the final hop.
     */
    finalCltvDelta: number;
    /** An optional payment addr to be included within the last hop of the route. */
    paymentAddr: Uint8Array | string;
    /**
     * A bare-bones invoice for a payment within the Lightning Network.  With the
     * details of the invoice, the sender has all the data necessary to send a
     * payment to the recipient. The amount in the payment request may be zero. In
     * that case it is required to set the amt field as well. If no payment request
     * is specified, the following fields are required: dest, amt and payment_hash.
     */
    paymentRequest: string;
    /**
     * An upper limit on the amount of time we should spend when attempting to
     * fulfill the payment. This is expressed in seconds. If we cannot make a
     * successful payment within this time frame, an error will be returned.
     * This field must be non-zero.
     */
    timeoutSeconds: number;
    /**
     * The maximum number of satoshis that will be paid as a fee of the payment.
     * If this field is left to the default value of 0, only zero-fee routes will
     * be considered. This usually means single hop routes connecting directly to
     * the destination. To send the payment without a fee limit, use max int here.
     *
     * The fields fee_limit_sat and fee_limit_msat are mutually exclusive.
     */
    feeLimitSat: string;
    /**
     * The maximum number of millisatoshis that will be paid as a fee of the
     * payment. If this field is left to the default value of 0, only zero-fee
     * routes will be considered. This usually means single hop routes connecting
     * directly to the destination. To send the payment without a fee limit, use
     * max int here.
     *
     * The fields fee_limit_sat and fee_limit_msat are mutually exclusive.
     */
    feeLimitMsat: string;
    /**
     * Deprecated, use outgoing_chan_ids. The channel id of the channel that must
     * be taken to the first hop. If zero, any channel may be used (unless
     * outgoing_chan_ids are set).
     *
     * @deprecated
     */
    outgoingChanId: string;
    /**
     * The channel ids of the channels are allowed for the first hop. If empty,
     * any channel may be used.
     */
    outgoingChanIds: string[];
    /** The pubkey of the last hop of the route. If empty, any hop may be used. */
    lastHopPubkey: Uint8Array | string;
    /**
     * An optional maximum total time lock for the route. This should not exceed
     * lnd's `--max-cltv-expiry` setting. If zero, then the value of
     * `--max-cltv-expiry` is enforced.
     */
    cltvLimit: number;
    /** Optional route hints to reach the destination through private channels. */
    routeHints: RouteHint[];
    /**
     * An optional field that can be used to pass an arbitrary set of TLV records
     * to a peer which understands the new records. This can be used to pass
     * application specific data during the payment attempt. Record types are
     * required to be in the custom range >= 65536. When using REST, the values
     * must be encoded as base64.
     */
    destCustomRecords: { [key: string]: Uint8Array | string };
    /** If set, circular payments to self are permitted. */
    allowSelfPayment: boolean;
    /**
     * Features assumed to be supported by the final node. All transitive feature
     * dependencies must also be set properly. For a given feature bit pair, either
     * optional or remote may be set, but not both. If this field is nil or empty,
     * the router will try to load destination features from the graph as a
     * fallback.
     */
    destFeatures: FeatureBit[];
    /**
     * The maximum number of partial payments that may be use to complete the full
     * amount.
     */
    maxParts: number;
    /**
     * If set, only the final payment update is streamed back. Intermediate updates
     * that show which htlcs are still in flight are suppressed.
     */
    noInflightUpdates: boolean;
    /**
     * The largest payment split that should be attempted when making a payment if
     * splitting is necessary. Setting this value will effectively cause lnd to
     * split more aggressively, vs only when it thinks it needs to. Note that this
     * value is in milli-satoshis.
     */
    maxShardSizeMsat: string;
    /** If set, an AMP-payment will be attempted. */
    amp: boolean;
    /**
     * The time preference for this payment. Set to -1 to optimize for fees
     * only, to 1 to optimize for reliability only or a value inbetween for a mix.
     */
    timePref: number;
}

export interface SendPaymentRequest_DestCustomRecordsEntry {
    key: string;
    value: Uint8Array | string;
}

export interface TrackPaymentRequest {
    /** The hash of the payment to look up. */
    paymentHash: Uint8Array | string;
    /**
     * If set, only the final payment update is streamed back. Intermediate updates
     * that show which htlcs are still in flight are suppressed.
     */
    noInflightUpdates: boolean;
}

export interface TrackPaymentsRequest {
    /**
     * If set, only the final payment updates are streamed back. Intermediate
     * updates that show which htlcs are still in flight are suppressed.
     */
    noInflightUpdates: boolean;
}

export interface RouteFeeRequest {
    /** The destination once wishes to obtain a routing fee quote to. */
    dest: Uint8Array | string;
    /** The amount one wishes to send to the target destination. */
    amtSat: string;
}

export interface RouteFeeResponse {
    /**
     * A lower bound of the estimated fee to the target destination within the
     * network, expressed in milli-satoshis.
     */
    routingFeeMsat: string;
    /**
     * An estimate of the worst case time delay that can occur. Note that callers
     * will still need to factor in the final CLTV delta of the last hop into this
     * value.
     */
    timeLockDelay: string;
}

export interface SendToRouteRequest {
    /** The payment hash to use for the HTLC. */
    paymentHash: Uint8Array | string;
    /** Route that should be used to attempt to complete the payment. */
    route: Route | undefined;
    /**
     * Whether the payment should be marked as failed when a temporary error is
     * returned from the given route. Set it to true so the payment won't be
     * failed unless a terminal error is occurred, such as payment timeout, no
     * routes, incorrect payment details, or insufficient funds.
     */
    skipTempErr: boolean;
}

export interface SendToRouteResponse {
    /** The preimage obtained by making the payment. */
    preimage: Uint8Array | string;
    /** The failure message in case the payment failed. */
    failure: Failure | undefined;
}

export interface ResetMissionControlRequest {}

export interface ResetMissionControlResponse {}

export interface QueryMissionControlRequest {}

/** QueryMissionControlResponse contains mission control state. */
export interface QueryMissionControlResponse {
    /** Node pair-level mission control state. */
    pairs: PairHistory[];
}

export interface XImportMissionControlRequest {
    /** Node pair-level mission control state to be imported. */
    pairs: PairHistory[];
    /**
     * Whether to force override MC pair history. Note that even with force
     * override the failure pair is imported before the success pair and both
     * still clamp existing failure/success amounts.
     */
    force: boolean;
}

export interface XImportMissionControlResponse {}

/** PairHistory contains the mission control state for a particular node pair. */
export interface PairHistory {
    /** The source node pubkey of the pair. */
    nodeFrom: Uint8Array | string;
    /** The destination node pubkey of the pair. */
    nodeTo: Uint8Array | string;
    history: PairData | undefined;
}

export interface PairData {
    /** Time of last failure. */
    failTime: string;
    /**
     * Lowest amount that failed to forward rounded to whole sats. This may be
     * set to zero if the failure is independent of amount.
     */
    failAmtSat: string;
    /**
     * Lowest amount that failed to forward in millisats. This may be
     * set to zero if the failure is independent of amount.
     */
    failAmtMsat: string;
    /** Time of last success. */
    successTime: string;
    /** Highest amount that we could successfully forward rounded to whole sats. */
    successAmtSat: string;
    /** Highest amount that we could successfully forward in millisats. */
    successAmtMsat: string;
}

export interface GetMissionControlConfigRequest {}

export interface GetMissionControlConfigResponse {
    /** Mission control's currently active config. */
    config: MissionControlConfig | undefined;
}

export interface SetMissionControlConfigRequest {
    /**
     * The config to set for mission control. Note that all values *must* be set,
     * because the full config will be applied.
     */
    config: MissionControlConfig | undefined;
}

export interface SetMissionControlConfigResponse {}

export interface MissionControlConfig {
    /**
     * Deprecated, use AprioriParameters. The amount of time mission control will
     * take to restore a penalized node or channel back to 50% success probability,
     * expressed in seconds. Setting this value to a higher value will penalize
     * failures for longer, making mission control less likely to route through
     * nodes and channels that we have previously recorded failures for.
     *
     * @deprecated
     */
    halfLifeSeconds: string;
    /**
     * Deprecated, use AprioriParameters. The probability of success mission
     * control should assign to hop in a route where it has no other information
     * available. Higher values will make mission control more willing to try hops
     * that we have no information about, lower values will discourage trying these
     * hops.
     *
     * @deprecated
     */
    hopProbability: number;
    /**
     * Deprecated, use AprioriParameters. The importance that mission control
     * should place on historical results, expressed as a value in [0;1]. Setting
     * this value to 1 will ignore all historical payments and just use the hop
     * probability to assess the probability of success for each hop. A zero value
     * ignores hop probability completely and relies entirely on historical
     * results, unless none are available.
     *
     * @deprecated
     */
    weight: number;
    /** The maximum number of payment results that mission control will store. */
    maximumPaymentResults: number;
    /**
     * The minimum time that must have passed since the previously recorded failure
     * before we raise the failure amount.
     */
    minimumFailureRelaxInterval: string;
    /**
     * ProbabilityModel defines which probability estimator should be used in
     * pathfinding. Note that the bimodal estimator is experimental.
     */
    model: MissionControlConfig_ProbabilityModel;
    apriori: AprioriParameters | undefined;
    bimodal: BimodalParameters | undefined;
}

export enum MissionControlConfig_ProbabilityModel {
    APRIORI = 'APRIORI',
    BIMODAL = 'BIMODAL',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface BimodalParameters {
    /**
     * NodeWeight defines how strongly other previous forwardings on channels of a
     * router should be taken into account when computing a channel's probability
     * to route. The allowed values are in the range [0, 1], where a value of 0
     * means that only direct information about a channel is taken into account.
     */
    nodeWeight: number;
    /**
     * ScaleMsat describes the scale over which channels statistically have some
     * liquidity left. The value determines how quickly the bimodal distribution
     * drops off from the edges of a channel. A larger value (compared to typical
     * channel capacities) means that the drop off is slow and that channel
     * balances are distributed more uniformly. A small value leads to the
     * assumption of very unbalanced channels.
     */
    scaleMsat: string;
    /**
     * DecayTime describes the information decay of knowledge about previous
     * successes and failures in channels. The smaller the decay time, the quicker
     * we forget about past forwardings.
     */
    decayTime: string;
}

export interface AprioriParameters {
    /**
     * The amount of time mission control will take to restore a penalized node
     * or channel back to 50% success probability, expressed in seconds. Setting
     * this value to a higher value will penalize failures for longer, making
     * mission control less likely to route through nodes and channels that we
     * have previously recorded failures for.
     */
    halfLifeSeconds: string;
    /**
     * The probability of success mission control should assign to hop in a route
     * where it has no other information available. Higher values will make mission
     * control more willing to try hops that we have no information about, lower
     * values will discourage trying these hops.
     */
    hopProbability: number;
    /**
     * The importance that mission control should place on historical results,
     * expressed as a value in [0;1]. Setting this value to 1 will ignore all
     * historical payments and just use the hop probability to assess the
     * probability of success for each hop. A zero value ignores hop probability
     * completely and relies entirely on historical results, unless none are
     * available.
     */
    weight: number;
    /**
     * The fraction of a channel's capacity that we consider to have liquidity. For
     * amounts that come close to or exceed the fraction, an additional penalty is
     * applied. A value of 1.0 disables the capacity factor. Allowed values are in
     * [0.75, 1.0].
     */
    capacityFraction: number;
}

export interface QueryProbabilityRequest {
    /** The source node pubkey of the pair. */
    fromNode: Uint8Array | string;
    /** The destination node pubkey of the pair. */
    toNode: Uint8Array | string;
    /** The amount for which to calculate a probability. */
    amtMsat: string;
}

export interface QueryProbabilityResponse {
    /** The success probability for the requested pair. */
    probability: number;
    /** The historical data for the requested pair. */
    history: PairData | undefined;
}

export interface BuildRouteRequest {
    /**
     * The amount to send expressed in msat. If set to zero, the minimum routable
     * amount is used.
     */
    amtMsat: string;
    /**
     * CLTV delta from the current height that should be used for the timelock
     * of the final hop
     */
    finalCltvDelta: number;
    /**
     * The channel id of the channel that must be taken to the first hop. If zero,
     * any channel may be used.
     */
    outgoingChanId: string;
    /**
     * A list of hops that defines the route. This does not include the source hop
     * pubkey.
     */
    hopPubkeys: Uint8Array | string[];
    /** An optional payment addr to be included within the last hop of the route. */
    paymentAddr: Uint8Array | string;
}

export interface BuildRouteResponse {
    /** Fully specified route that can be used to execute the payment. */
    route: Route | undefined;
}

export interface SubscribeHtlcEventsRequest {}

/**
 * HtlcEvent contains the htlc event that was processed. These are served on a
 * best-effort basis; events are not persisted, delivery is not guaranteed
 * (in the event of a crash in the switch, forward events may be lost) and
 * some events may be replayed upon restart. Events consumed from this package
 * should be de-duplicated by the htlc's unique combination of incoming and
 * outgoing channel id and htlc id. [EXPERIMENTAL]
 */
export interface HtlcEvent {
    /**
     * The short channel id that the incoming htlc arrived at our node on. This
     * value is zero for sends.
     */
    incomingChannelId: string;
    /**
     * The short channel id that the outgoing htlc left our node on. This value
     * is zero for receives.
     */
    outgoingChannelId: string;
    /**
     * Incoming id is the index of the incoming htlc in the incoming channel.
     * This value is zero for sends.
     */
    incomingHtlcId: string;
    /**
     * Outgoing id is the index of the outgoing htlc in the outgoing channel.
     * This value is zero for receives.
     */
    outgoingHtlcId: string;
    /** The time in unix nanoseconds that the event occurred. */
    timestampNs: string;
    /**
     * The event type indicates whether the htlc was part of a send, receive or
     * forward.
     */
    eventType: HtlcEvent_EventType;
    forwardEvent: ForwardEvent | undefined;
    forwardFailEvent: ForwardFailEvent | undefined;
    settleEvent: SettleEvent | undefined;
    linkFailEvent: LinkFailEvent | undefined;
    subscribedEvent: SubscribedEvent | undefined;
    finalHtlcEvent: FinalHtlcEvent | undefined;
}

export enum HtlcEvent_EventType {
    UNKNOWN = 'UNKNOWN',
    SEND = 'SEND',
    RECEIVE = 'RECEIVE',
    FORWARD = 'FORWARD',
    UNRECOGNIZED = 'UNRECOGNIZED'
}

export interface HtlcInfo {
    /** The timelock on the incoming htlc. */
    incomingTimelock: number;
    /** The timelock on the outgoing htlc. */
    outgoingTimelock: number;
    /** The amount of the incoming htlc. */
    incomingAmtMsat: string;
    /** The amount of the outgoing htlc. */
    outgoingAmtMsat: string;
}

export interface ForwardEvent {
    /** Info contains details about the htlc that was forwarded. */
    info: HtlcInfo | undefined;
}

export interface ForwardFailEvent {}

export interface SettleEvent {
    /** The revealed preimage. */
    preimage: Uint8Array | string;
}

export interface FinalHtlcEvent {
    settled: boolean;
    offchain: boolean;
}

export interface SubscribedEvent {}

export interface LinkFailEvent {
    /** Info contains details about the htlc that we failed. */
    info: HtlcInfo | undefined;
    /** FailureCode is the BOLT error code for the failure. */
    wireFailure: Failure_FailureCode;
    /**
     * FailureDetail provides additional information about the reason for the
     * failure. This detail enriches the information provided by the wire message
     * and may be 'no detail' if the wire message requires no additional metadata.
     */
    failureDetail: FailureDetail;
    /** A string representation of the link failure. */
    failureString: string;
}

export interface PaymentStatus {
    /** Current state the payment is in. */
    state: PaymentState;
    /** The pre-image of the payment when state is SUCCEEDED. */
    preimage: Uint8Array | string;
    /** The HTLCs made in attempt to settle the payment [EXPERIMENTAL]. */
    htlcs: HTLCAttempt[];
}

export interface CircuitKey {
    /** / The id of the channel that the is part of this circuit. */
    chanId: string;
    /** / The index of the incoming htlc in the incoming channel. */
    htlcId: string;
}

export interface ForwardHtlcInterceptRequest {
    /**
     * The key of this forwarded htlc. It defines the incoming channel id and
     * the index in this channel.
     */
    incomingCircuitKey: CircuitKey | undefined;
    /** The incoming htlc amount. */
    incomingAmountMsat: string;
    /** The incoming htlc expiry. */
    incomingExpiry: number;
    /**
     * The htlc payment hash. This value is not guaranteed to be unique per
     * request.
     */
    paymentHash: Uint8Array | string;
    /**
     * The requested outgoing channel id for this forwarded htlc. Because of
     * non-strict forwarding, this isn't necessarily the channel over which the
     * packet will be forwarded eventually. A different channel to the same peer
     * may be selected as well.
     */
    outgoingRequestedChanId: string;
    /** The outgoing htlc amount. */
    outgoingAmountMsat: string;
    /** The outgoing htlc expiry. */
    outgoingExpiry: number;
    /** Any custom records that were present in the payload. */
    customRecords: { [key: string]: Uint8Array | string };
    /** The onion blob for the next hop */
    onionBlob: Uint8Array | string;
    /**
     * The block height at which this htlc will be auto-failed to prevent the
     * channel from force-closing.
     */
    autoFailHeight: number;
}

export interface ForwardHtlcInterceptRequest_CustomRecordsEntry {
    key: string;
    value: Uint8Array | string;
}

/**
 * ForwardHtlcInterceptResponse enables the caller to resolve a previously hold
 * forward. The caller can choose either to:
 * - `Resume`: Execute the default behavior (usually forward).
 * - `Reject`: Fail the htlc backwards.
 * - `Settle`: Settle this htlc with a given preimage.
 */
export interface ForwardHtlcInterceptResponse {
    /**
     * The key of this forwarded htlc. It defines the incoming channel id and
     * the index in this channel.
     */
    incomingCircuitKey: CircuitKey | undefined;
    /** The resolve action for this intercepted htlc. */
    action: ResolveHoldForwardAction;
    /** The preimage in case the resolve action is Settle. */
    preimage: Uint8Array | string;
    /**
     * Encrypted failure message in case the resolve action is Fail.
     *
     * If failure_message is specified, the failure_code field must be set
     * to zero.
     */
    failureMessage: Uint8Array | string;
    /**
     * Return the specified failure code in case the resolve action is Fail. The
     * message data fields are populated automatically.
     *
     * If a non-zero failure_code is specified, failure_message must not be set.
     *
     * For backwards-compatibility reasons, TEMPORARY_CHANNEL_FAILURE is the
     * default value for this field.
     */
    failureCode: Failure_FailureCode;
}

export interface UpdateChanStatusRequest {
    chanPoint: ChannelPoint | undefined;
    action: ChanStatusAction;
}

export interface UpdateChanStatusResponse {}

/**
 * Router is a service that offers advanced interaction with the router
 * subsystem of the daemon.
 */
export interface Router {
    /**
     * SendPaymentV2 attempts to route a payment described by the passed
     * PaymentRequest to the final destination. The call returns a stream of
     * payment updates.
     */
    sendPaymentV2(
        request?: DeepPartial<SendPaymentRequest>,
        onMessage?: (msg: Payment) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * TrackPaymentV2 returns an update stream for the payment identified by the
     * payment hash.
     */
    trackPaymentV2(
        request?: DeepPartial<TrackPaymentRequest>,
        onMessage?: (msg: Payment) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * TrackPayments returns an update stream for every payment that is not in a
     * terminal state. Note that if payments are in-flight while starting a new
     * subscription, the start of the payment stream could produce out-of-order
     * and/or duplicate events. In order to get updates for every in-flight
     * payment attempt make sure to subscribe to this method before initiating any
     * payments.
     */
    trackPayments(
        request?: DeepPartial<TrackPaymentsRequest>,
        onMessage?: (msg: Payment) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * EstimateRouteFee allows callers to obtain a lower bound w.r.t how much it
     * may cost to send an HTLC to the target end destination.
     */
    estimateRouteFee(
        request?: DeepPartial<RouteFeeRequest>
    ): Promise<RouteFeeResponse>;
    /**
     * Deprecated, use SendToRouteV2. SendToRoute attempts to make a payment via
     * the specified route. This method differs from SendPayment in that it
     * allows users to specify a full route manually. This can be used for
     * things like rebalancing, and atomic swaps. It differs from the newer
     * SendToRouteV2 in that it doesn't return the full HTLC information.
     *
     * @deprecated
     */
    sendToRoute(
        request?: DeepPartial<SendToRouteRequest>
    ): Promise<SendToRouteResponse>;
    /**
     * SendToRouteV2 attempts to make a payment via the specified route. This
     * method differs from SendPayment in that it allows users to specify a full
     * route manually. This can be used for things like rebalancing, and atomic
     * swaps.
     */
    sendToRouteV2(
        request?: DeepPartial<SendToRouteRequest>
    ): Promise<HTLCAttempt>;
    /**
     * ResetMissionControl clears all mission control state and starts with a clean
     * slate.
     */
    resetMissionControl(
        request?: DeepPartial<ResetMissionControlRequest>
    ): Promise<ResetMissionControlResponse>;
    /**
     * QueryMissionControl exposes the internal mission control state to callers.
     * It is a development feature.
     */
    queryMissionControl(
        request?: DeepPartial<QueryMissionControlRequest>
    ): Promise<QueryMissionControlResponse>;
    /**
     * XImportMissionControl is an experimental API that imports the state provided
     * to the internal mission control's state, using all results which are more
     * recent than our existing values. These values will only be imported
     * in-memory, and will not be persisted across restarts.
     */
    xImportMissionControl(
        request?: DeepPartial<XImportMissionControlRequest>
    ): Promise<XImportMissionControlResponse>;
    /** GetMissionControlConfig returns mission control's current config. */
    getMissionControlConfig(
        request?: DeepPartial<GetMissionControlConfigRequest>
    ): Promise<GetMissionControlConfigResponse>;
    /**
     * SetMissionControlConfig will set mission control's config, if the config
     * provided is valid.
     */
    setMissionControlConfig(
        request?: DeepPartial<SetMissionControlConfigRequest>
    ): Promise<SetMissionControlConfigResponse>;
    /**
     * Deprecated. QueryProbability returns the current success probability
     * estimate for a given node pair and amount. The call returns a zero success
     * probability if no channel is available or if the amount violates min/max
     * HTLC constraints.
     */
    queryProbability(
        request?: DeepPartial<QueryProbabilityRequest>
    ): Promise<QueryProbabilityResponse>;
    /**
     * BuildRoute builds a fully specified route based on a list of hop public
     * keys. It retrieves the relevant channel policies from the graph in order to
     * calculate the correct fees and time locks.
     */
    buildRoute(
        request?: DeepPartial<BuildRouteRequest>
    ): Promise<BuildRouteResponse>;
    /**
     * SubscribeHtlcEvents creates a uni-directional stream from the server to
     * the client which delivers a stream of htlc events.
     */
    subscribeHtlcEvents(
        request?: DeepPartial<SubscribeHtlcEventsRequest>,
        onMessage?: (msg: HtlcEvent) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * Deprecated, use SendPaymentV2. SendPayment attempts to route a payment
     * described by the passed PaymentRequest to the final destination. The call
     * returns a stream of payment status updates.
     *
     * @deprecated
     */
    sendPayment(
        request?: DeepPartial<SendPaymentRequest>,
        onMessage?: (msg: PaymentStatus) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * Deprecated, use TrackPaymentV2. TrackPayment returns an update stream for
     * the payment identified by the payment hash.
     *
     * @deprecated
     */
    trackPayment(
        request?: DeepPartial<TrackPaymentRequest>,
        onMessage?: (msg: PaymentStatus) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * HtlcInterceptor dispatches a bi-directional streaming RPC in which
     * Forwarded HTLC requests are sent to the client and the client responds with
     * a boolean that tells LND if this htlc should be intercepted.
     * In case of interception, the htlc can be either settled, cancelled or
     * resumed later by using the ResolveHoldForward endpoint.
     */
    htlcInterceptor(
        request?: DeepPartial<ForwardHtlcInterceptResponse>,
        onMessage?: (msg: ForwardHtlcInterceptRequest) => void,
        onError?: (err: Error) => void
    ): void;
    /**
     * UpdateChanStatus attempts to manually set the state of a channel
     * (enabled, disabled, or auto). A manual "disable" request will cause the
     * channel to stay disabled until a subsequent manual request of either
     * "enable" or "auto".
     */
    updateChanStatus(
        request?: DeepPartial<UpdateChanStatusRequest>
    ): Promise<UpdateChanStatusResponse>;
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
