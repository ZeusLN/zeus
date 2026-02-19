"use strict";
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteRespStatus = void 0;
/** QuoteRespStatus is an enum that represents the status of a quote response. */
var QuoteRespStatus;
(function (QuoteRespStatus) {
    /**
     * INVALID_ASSET_RATES - INVALID_ASSET_RATES indicates that at least one asset rate in the
     * quote response is invalid.
     */
    QuoteRespStatus["INVALID_ASSET_RATES"] = "INVALID_ASSET_RATES";
    /**
     * INVALID_EXPIRY - INVALID_EXPIRY indicates that the expiry in the quote response is
     * invalid.
     */
    QuoteRespStatus["INVALID_EXPIRY"] = "INVALID_EXPIRY";
    /**
     * PRICE_ORACLE_QUERY_ERR - PRICE_ORACLE_QUERY_ERR indicates that an error occurred when querying the
     * price oracle whilst evaluating the quote response.
     */
    QuoteRespStatus["PRICE_ORACLE_QUERY_ERR"] = "PRICE_ORACLE_QUERY_ERR";
    QuoteRespStatus["UNRECOGNIZED"] = "UNRECOGNIZED";
})(QuoteRespStatus = exports.QuoteRespStatus || (exports.QuoteRespStatus = {}));
