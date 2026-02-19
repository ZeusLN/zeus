"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseRecommendationRequest_Metric = exports.EntryType = exports.FiatBackend = exports.Granularity = void 0;
/* eslint-disable */
/**
 * Granularity describes the aggregation level at which the Bitcoin price should
 * be queried. Note that setting lower levels of granularity may require more
 * queries to the fiat backend.
 */
var Granularity;
(function (Granularity) {
    Granularity["UNKNOWN_GRANULARITY"] = "UNKNOWN_GRANULARITY";
    Granularity["MINUTE"] = "MINUTE";
    Granularity["FIVE_MINUTES"] = "FIVE_MINUTES";
    Granularity["FIFTEEN_MINUTES"] = "FIFTEEN_MINUTES";
    Granularity["THIRTY_MINUTES"] = "THIRTY_MINUTES";
    Granularity["HOUR"] = "HOUR";
    Granularity["SIX_HOURS"] = "SIX_HOURS";
    Granularity["TWELVE_HOURS"] = "TWELVE_HOURS";
    Granularity["DAY"] = "DAY";
    Granularity["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Granularity = exports.Granularity || (exports.Granularity = {}));
/** FiatBackend is the API endpoint to be used for any fiat related queries. */
var FiatBackend;
(function (FiatBackend) {
    FiatBackend["UNKNOWN_FIATBACKEND"] = "UNKNOWN_FIATBACKEND";
    /**
     * COINCAP - Use the CoinCap API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coincap.io/v2/assets/bitcoin/history
     */
    FiatBackend["COINCAP"] = "COINCAP";
    /**
     * COINDESK - Use the CoinDesk API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coindesk.com/v1/bpi/historical/close.json
     */
    FiatBackend["COINDESK"] = "COINDESK";
    /** CUSTOM - Use custom price data provided in a CSV file for fiat price information. */
    FiatBackend["CUSTOM"] = "CUSTOM";
    /**
     * COINGECKO - Use the CoinGecko API for fiat price information.
     * This API is reached through the following URL:
     * https://api.coingecko.com/api/v3/coins/bitcoin/market_chart
     */
    FiatBackend["COINGECKO"] = "COINGECKO";
    FiatBackend["UNRECOGNIZED"] = "UNRECOGNIZED";
})(FiatBackend = exports.FiatBackend || (exports.FiatBackend = {}));
var EntryType;
(function (EntryType) {
    EntryType["UNKNOWN"] = "UNKNOWN";
    /** LOCAL_CHANNEL_OPEN - A channel opening transaction for a channel opened by our node. */
    EntryType["LOCAL_CHANNEL_OPEN"] = "LOCAL_CHANNEL_OPEN";
    /** REMOTE_CHANNEL_OPEN - A channel opening transaction for a channel opened by a remote node. */
    EntryType["REMOTE_CHANNEL_OPEN"] = "REMOTE_CHANNEL_OPEN";
    /** CHANNEL_OPEN_FEE - The on chain fee paid to open a channel. */
    EntryType["CHANNEL_OPEN_FEE"] = "CHANNEL_OPEN_FEE";
    /** CHANNEL_CLOSE - A channel closing transaction. */
    EntryType["CHANNEL_CLOSE"] = "CHANNEL_CLOSE";
    /**
     * RECEIPT - Receipt of funds. On chain this reflects receives, off chain settlement
     * of invoices.
     */
    EntryType["RECEIPT"] = "RECEIPT";
    /**
     * PAYMENT - Payment of funds. On chain this reflects sends, off chain settlement
     * of our payments.
     */
    EntryType["PAYMENT"] = "PAYMENT";
    /** FEE - Payment of fees. */
    EntryType["FEE"] = "FEE";
    /** CIRCULAR_RECEIPT - Receipt of a payment to ourselves. */
    EntryType["CIRCULAR_RECEIPT"] = "CIRCULAR_RECEIPT";
    /** FORWARD - A forward through our node. */
    EntryType["FORWARD"] = "FORWARD";
    /** FORWARD_FEE - Fees earned from forwarding. */
    EntryType["FORWARD_FEE"] = "FORWARD_FEE";
    /** CIRCULAR_PAYMENT - Sending of a payment to ourselves. */
    EntryType["CIRCULAR_PAYMENT"] = "CIRCULAR_PAYMENT";
    /** CIRCULAR_FEE - The fees paid to send an off chain payment to ourselves. */
    EntryType["CIRCULAR_FEE"] = "CIRCULAR_FEE";
    /** SWEEP - A transaction that sweeps funds back into our wallet's control. */
    EntryType["SWEEP"] = "SWEEP";
    /** SWEEP_FEE - The amount of fees paid for a sweep transaction. */
    EntryType["SWEEP_FEE"] = "SWEEP_FEE";
    /** CHANNEL_CLOSE_FEE - The fees paid to close a channel. */
    EntryType["CHANNEL_CLOSE_FEE"] = "CHANNEL_CLOSE_FEE";
    EntryType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(EntryType = exports.EntryType || (exports.EntryType = {}));
var CloseRecommendationRequest_Metric;
(function (CloseRecommendationRequest_Metric) {
    CloseRecommendationRequest_Metric["UNKNOWN"] = "UNKNOWN";
    CloseRecommendationRequest_Metric["UPTIME"] = "UPTIME";
    CloseRecommendationRequest_Metric["REVENUE"] = "REVENUE";
    CloseRecommendationRequest_Metric["INCOMING_VOLUME"] = "INCOMING_VOLUME";
    CloseRecommendationRequest_Metric["OUTGOING_VOLUME"] = "OUTGOING_VOLUME";
    CloseRecommendationRequest_Metric["TOTAL_VOLUME"] = "TOTAL_VOLUME";
    CloseRecommendationRequest_Metric["UNRECOGNIZED"] = "UNRECOGNIZED";
})(CloseRecommendationRequest_Metric = exports.CloseRecommendationRequest_Metric || (exports.CloseRecommendationRequest_Metric = {}));
