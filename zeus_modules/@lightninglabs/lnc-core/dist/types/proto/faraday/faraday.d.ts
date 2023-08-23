/**
 * Granularity describes the aggregation level at which the Bitcoin price should
 * be queried. Note that setting lower levels of granularity may require more
 * queries to the fiat backend.
 */
export declare enum Granularity {
    UNKNOWN_GRANULARITY = "UNKNOWN_GRANULARITY",
    MINUTE = "MINUTE",
    FIVE_MINUTES = "FIVE_MINUTES",
    FIFTEEN_MINUTES = "FIFTEEN_MINUTES",
    THIRTY_MINUTES = "THIRTY_MINUTES",
    HOUR = "HOUR",
    SIX_HOURS = "SIX_HOURS",
    TWELVE_HOURS = "TWELVE_HOURS",
    DAY = "DAY",
    UNRECOGNIZED = "UNRECOGNIZED"
}
/** FiatBackend is the API endpoint to be used for any fiat related queries. */
export declare enum FiatBackend {
    UNKNOWN_FIATBACKEND = "UNKNOWN_FIATBACKEND",
    /**
     * COINCAP - Use the CoinCap API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coincap.io/v2/assets/bitcoin/history
     */
    COINCAP = "COINCAP",
    /**
     * COINDESK - Use the CoinDesk API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coindesk.com/v1/bpi/historical/close.json
     */
    COINDESK = "COINDESK",
    /** CUSTOM - Use custom price data provided in a CSV file for fiat price information. */
    CUSTOM = "CUSTOM",
    /**
     * COINGECKO - Use the CoinGecko API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coingecko.com/api/v3/coins/bitcoin/market_chart
     */
    COINGECKO = "COINGECKO",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export declare enum EntryType {
    UNKNOWN = "UNKNOWN",
    /** LOCAL_CHANNEL_OPEN - A channel opening transaction for a channel opened by our node. */
    LOCAL_CHANNEL_OPEN = "LOCAL_CHANNEL_OPEN",
    /** REMOTE_CHANNEL_OPEN - A channel opening transaction for a channel opened by a remote node. */
    REMOTE_CHANNEL_OPEN = "REMOTE_CHANNEL_OPEN",
    /** CHANNEL_OPEN_FEE - The on chain fee paid to open a channel. */
    CHANNEL_OPEN_FEE = "CHANNEL_OPEN_FEE",
    /** CHANNEL_CLOSE - A channel closing transaction. */
    CHANNEL_CLOSE = "CHANNEL_CLOSE",
    /**
     * RECEIPT - Receipt of funds. On chain this reflects receives, off chain settlement
     * of invoices.
     */
    RECEIPT = "RECEIPT",
    /**
     * PAYMENT - Payment of funds. On chain this reflects sends, off chain settlement
     * of our payments.
     */
    PAYMENT = "PAYMENT",
    /** FEE - Payment of fees. */
    FEE = "FEE",
    /** CIRCULAR_RECEIPT - Receipt of a payment to ourselves. */
    CIRCULAR_RECEIPT = "CIRCULAR_RECEIPT",
    /** FORWARD - A forward through our node. */
    FORWARD = "FORWARD",
    /** FORWARD_FEE - Fees earned from forwarding. */
    FORWARD_FEE = "FORWARD_FEE",
    /** CIRCULAR_PAYMENT - Sending of a payment to ourselves. */
    CIRCULAR_PAYMENT = "CIRCULAR_PAYMENT",
    /** CIRCULAR_FEE - The fees paid to send an off chain payment to ourselves. */
    CIRCULAR_FEE = "CIRCULAR_FEE",
    /** SWEEP - A transaction that sweeps funds back into our wallet's control. */
    SWEEP = "SWEEP",
    /** SWEEP_FEE - The amount of fees paid for a sweep transaction. */
    SWEEP_FEE = "SWEEP_FEE",
    /** CHANNEL_CLOSE_FEE - The fees paid to close a channel. */
    CHANNEL_CLOSE_FEE = "CHANNEL_CLOSE_FEE",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface CloseRecommendationRequest {
    /**
     * The minimum amount of time in seconds that a channel should have been
     * monitored by lnd to be eligible for close. This value is in place to
     * protect against closing of newer channels.
     */
    minimumMonitored: string;
    /**
     * The data point base close recommendations on. Available options are:
     * Uptime: ratio of channel peer's uptime to the period they have been
     * monitored to.
     * Revenue: the revenue that the channel has produced per block that its
     * funding transaction has been confirmed for.
     */
    metric: CloseRecommendationRequest_Metric;
}
export declare enum CloseRecommendationRequest_Metric {
    UNKNOWN = "UNKNOWN",
    UPTIME = "UPTIME",
    REVENUE = "REVENUE",
    INCOMING_VOLUME = "INCOMING_VOLUME",
    OUTGOING_VOLUME = "OUTGOING_VOLUME",
    TOTAL_VOLUME = "TOTAL_VOLUME",
    UNRECOGNIZED = "UNRECOGNIZED"
}
export interface OutlierRecommendationsRequest {
    /** The parameters that are common to all close recommendations. */
    recRequest: CloseRecommendationRequest | undefined;
    /**
     * The number of inter-quartile ranges a value needs to be beneath the lower
     * quartile/ above the upper quartile to be considered a lower/upper outlier.
     * Lower values will be more aggressive in recommending channel closes, and
     * upper values will be more conservative. Recommended values are 1.5 for
     * aggressive recommendations and 3 for conservative recommendations.
     */
    outlierMultiplier: number;
}
export interface ThresholdRecommendationsRequest {
    /** The parameters that are common to all close recommendations. */
    recRequest: CloseRecommendationRequest | undefined;
    /**
     * The threshold that recommendations will be calculated based on.
     * For uptime: ratio of uptime to observed lifetime beneath which channels
     * will be recommended for closure.
     *
     * For revenue: revenue per block that capital has been committed to the
     * channel beneath which channels will be recommended for closure. This
     * value is provided per block so that channels that have been open for
     * different periods of time can be compared.
     *
     * For incoming volume: The incoming volume per block that capital has
     * been committed to the channel beneath which channels will be recommended
     * for closure. This value is provided per block so that channels that have
     * been open for different periods of time can be compared.
     *
     * For outgoing volume: The outgoing volume per block that capital has been
     * committed to the channel beneath which channels will be recommended for
     * closure. This value is provided per block so that channels that have been
     * open for different periods of time can be compared.
     *
     * For total volume: The total volume per block that capital has been
     * committed to the channel beneath which channels will be recommended for
     * closure. This value is provided per block so that channels that have been
     * open for different periods of time can be compared.
     */
    thresholdValue: number;
}
export interface CloseRecommendationsResponse {
    /**
     * The total number of channels, before filtering out channels that are
     * not eligible for close recommendations.
     */
    totalChannels: number;
    /** The number of channels that were considered for close recommendations. */
    consideredChannels: number;
    /**
     * A set of channel close recommendations. The absence of a channel in this
     * set implies that it was not considered for close because it did not meet
     * the criteria for close recommendations (it is private, or has not been
     * monitored for long enough).
     */
    recommendations: Recommendation[];
}
export interface Recommendation {
    /**
     * The channel point [funding txid: outpoint] of the channel being considered
     * for close.
     */
    chanPoint: string;
    /** The value of the metric that close recommendations were based on. */
    value: number;
    /** A boolean indicating whether we recommend closing the channel. */
    recommendClose: boolean;
}
export interface RevenueReportRequest {
    /**
     * The funding transaction outpoints for the channels to generate a revenue
     * report for. If this is empty, it will be generated for all open and closed
     * channels. Channel funding points should be expressed with the format
     * fundingTxID:outpoint.
     */
    chanPoints: string[];
    /**
     * Start time is beginning of the range over which the report will be
     * generated, expressed as unix epoch offset in seconds.
     */
    startTime: string;
    /**
     * End time is end of the range over which the report will be
     * generated, expressed as unix epoch offset in seconds.
     */
    endTime: string;
}
export interface RevenueReportResponse {
    /**
     * Reports is a set of pairwise revenue report generated for the channel(s)
     * over the period specified.
     */
    reports: RevenueReport[];
}
export interface RevenueReport {
    /**
     * Target channel is the channel that the report is generated for; incoming
     * fields in the report mean that this channel was the incoming channel,
     * and the pair as the outgoing, outgoing fields mean that this channel was
     * the outgoing channel and the peer was the incoming channel.
     */
    targetChannel: string;
    /**
     * Pair reports maps the channel point of a peer that we generated revenue
     * with to a report detailing the revenue.
     */
    pairReports: {
        [key: string]: PairReport;
    };
}
export interface RevenueReport_PairReportsEntry {
    key: string;
    value: PairReport | undefined;
}
export interface PairReport {
    /**
     * Amount outgoing msat is the amount in millisatoshis that arrived
     * on the pair channel to be forwarded onwards by our channel.
     */
    amountOutgoingMsat: string;
    /**
     * Fees outgoing is the amount of fees in millisatoshis that we
     * attribute to the channel for its role as the outgoing channel in
     * forwards.
     */
    feesOutgoingMsat: string;
    /**
     * Amount incoming msat is the amount in millisatoshis that arrived
     * on our channel to be forwarded onwards by the pair channel.
     */
    amountIncomingMsat: string;
    /**
     * Fees incoming is the amount of fees in millisatoshis that we
     * attribute to the channel for its role as the incoming channel in
     * forwards.
     */
    feesIncomingMsat: string;
}
export interface ChannelInsightsRequest {
}
export interface ChannelInsightsResponse {
    /** Insights for the set of currently open channels. */
    channelInsights: ChannelInsight[];
}
export interface ChannelInsight {
    /** The outpoint of the channel's funding transaction. */
    chanPoint: string;
    /**
     * The amount of time in seconds that we have monitored the channel peer's
     * uptime for.
     */
    monitoredSeconds: string;
    /**
     * The amount of time in seconds that the channel peer has been online over
     * the period it has been monitored for.
     */
    uptimeSeconds: string;
    /**
     * The volume, in millisatoshis, that has been forwarded with this channel as
     * the incoming channel.
     */
    volumeIncomingMsat: string;
    /**
     * The volume, in millisatoshis, that has been forwarded with this channel as
     * the outgoing channel.
     */
    volumeOutgoingMsat: string;
    /**
     * The total fees earned by this channel for its participation in forwards,
     * expressed in millisatoshis. Note that we attribute fees evenly across
     * incoming and outgoing channels.
     */
    feesEarnedMsat: string;
    /** The number of confirmations the funding transaction has. */
    confirmations: number;
    /** True if the channel is private. */
    private: boolean;
}
export interface ExchangeRateRequest {
    /** A set of timestamps for which we want the bitcoin price. */
    timestamps: string[];
    /** The level of granularity at which we want the bitcoin price to be quoted. */
    granularity: Granularity;
    /** The api to be used for fiat related queries. */
    fiatBackend: FiatBackend;
    /** Custom price points to use if the CUSTOM FiatBackend option is set. */
    customPrices: BitcoinPrice[];
}
export interface ExchangeRateResponse {
    /** Rates contains a set of exchange rates for the set of timestamps */
    rates: ExchangeRate[];
}
export interface BitcoinPrice {
    /** The price of 1 BTC, expressed in USD. */
    price: string;
    /** The timestamp for this price price provided. */
    priceTimestamp: string;
    /** The currency that the price is denoted in. */
    currency: string;
}
export interface ExchangeRate {
    /** timestamp is the timestamp of the original request made. */
    timestamp: string;
    /**
     * Price is the bitcoin price approximation for the timestamp queried. Note
     * that this value has its own timestamp because we are not guaranteed to get
     * price points for the exact timestamp that was queried.
     */
    btcPrice: BitcoinPrice | undefined;
}
export interface NodeAuditRequest {
    /** The unix time from which to produce the report, inclusive. */
    startTime: string;
    /** The unix time until which to produce the report, exclusive. */
    endTime: string;
    /**
     * Set to generate a report without conversion to fiat. If set, fiat values
     * will display as 0.
     */
    disableFiat: boolean;
    /** The level of granularity at which we wish to produce fiat prices. */
    granularity: Granularity;
    /**
     * An optional set of custom categories which can be used to identify bespoke
     * categories in the report. Each category must have a unique name, and may not
     * have common identifier regexes. Transactions that are matched to these
     * categories report the category name in the CustomCategory field.
     */
    customCategories: CustomCategory[];
    /** The api to be used for fiat related queries. */
    fiatBackend: FiatBackend;
    /** Custom price points to use if the CUSTOM FiatBackend option is set. */
    customPrices: BitcoinPrice[];
}
export interface CustomCategory {
    /**
     * The name for the custom category which will contain all transactions that
     * are labelled with a string matching one of the regexes provided in
     * label identifiers.
     */
    name: string;
    /**
     * Set to true to apply this category to on chain transactions. Can be set in
     * conjunction with off_chain to apply the category to all transactions.
     */
    onChain: boolean;
    /**
     * Set to true to apply this category to off chain transactions. Can be set in
     * conjunction with on_chain to apply the category to all transactions.
     */
    offChain: boolean;
    /**
     * A set of regular expressions which identify transactions by their label as
     * belonging in this custom category. If a label matches any single regex in
     * the set, it is considered to be in the category. These expressions will be
     * matched against various labels that are present in lnd: on chain
     * transactions will be matched against their label field, off chain receipts
     * will be matched against their memo. At present, there is no way to match
     * forwards or off chain payments. These expressions must be unique across
     * custom categories, otherwise faraday will not be able to identify which
     * custom category a transaction belongs in.
     */
    labelPatterns: string[];
}
export interface ReportEntry {
    /** The unix timestamp of the event. */
    timestamp: string;
    /** Whether the entry occurred on chain or off chain. */
    onChain: boolean;
    /** The amount of the entry, expressed in millisatoshis. */
    amount: string;
    /** Whether the entry is a credit or a debit. */
    credit: boolean;
    /** The asset affected by the entry. */
    asset: string;
    /** The kind of activity that this entry represents. */
    type: EntryType;
    /**
     * This field will be populated for entry type custom, and represents the name
     * of a custom category that the report was produced with.
     */
    customCategory: string;
    /** The transaction id of the entry. */
    txid: string;
    /**
     * The fiat amount of the entry's amount in the currency specified in the
     * btc_price field.
     */
    fiat: string;
    /** A unique identifier for the entry, if available. */
    reference: string;
    /** An additional note for the entry, providing additional context. */
    note: string;
    /** The bitcoin price and timestamp used to calculate our fiat value. */
    btcPrice: BitcoinPrice | undefined;
}
export interface NodeAuditResponse {
    /** On chain reports for the period queried. */
    reports: ReportEntry[];
}
export interface CloseReportRequest {
    /**
     * The funding outpoint of the channel the report should be created for,
     * formatted txid:outpoint.
     */
    channelPoint: string;
}
export interface CloseReportResponse {
    /** The funding outpoint of the channel. */
    channelPoint: string;
    /** True if we opened the channel, false if the remote peer did. */
    channelInitiator: boolean;
    /** The type of close that resolved this channel. */
    closeType: string;
    /** The transaction id of the close transaction that confirmed on chain. */
    closeTxid: string;
    /**
     * The fee we paid on chain to open this channel in satoshis, note that this
     * field will be zero if the remote party paid.
     */
    openFee: string;
    /**
     * The fee we paid on chain for the close transaction in staoshis, note that
     * this field will be zero if the remote party paid.
     */
    closeFee: string;
}
export interface FaradayServer {
    /**
     * frcli: `outliers`
     * Get close recommendations for currently open channels based on whether it is
     * an outlier.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/outliers/REVENUE?rec_request.minimum_monitored=123
     */
    outlierRecommendations(request?: DeepPartial<OutlierRecommendationsRequest>): Promise<CloseRecommendationsResponse>;
    /**
     * frcli: `threshold`
     * Get close recommendations for currently open channels based whether they are
     * below a set threshold.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/threshold/UPTIME?rec_request.minimum_monitored=123
     */
    thresholdRecommendations(request?: DeepPartial<ThresholdRecommendationsRequest>): Promise<CloseRecommendationsResponse>;
    /**
     * frcli: `revenue`
     * Get a pairwise revenue report for a channel.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/revenue
     */
    revenueReport(request?: DeepPartial<RevenueReportRequest>): Promise<RevenueReportResponse>;
    /**
     * frcli: `insights`
     * List currently open channel with routing and uptime information.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/insights
     */
    channelInsights(request?: DeepPartial<ChannelInsightsRequest>): Promise<ChannelInsightsResponse>;
    /**
     * frcli:
     * Get fiat prices for btc.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/exchangerate
     */
    exchangeRate(request?: DeepPartial<ExchangeRateRequest>): Promise<ExchangeRateResponse>;
    /**
     * Get a report of your node's activity over a period.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/nodeaudit
     */
    nodeAudit(request?: DeepPartial<NodeAuditRequest>): Promise<NodeAuditResponse>;
    /**
     * Get a channel close report for a specific channel.
     *
     * Example request:
     * http://localhost:8466/v1/faraday/closereport
     */
    closeReport(request?: DeepPartial<CloseReportRequest>): Promise<CloseReportResponse>;
}
declare type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
declare type DeepPartial<T> = T extends Builtin ? T : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>> : T extends {} ? {
    [K in keyof T]?: DeepPartial<T[K]>;
} : Partial<T>;
export {};
//# sourceMappingURL=faraday.d.ts.map