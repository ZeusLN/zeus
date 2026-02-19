"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Intent = exports.TransactionType = void 0;
/* eslint-disable */
/** TransactionType is an enum representing the type of transaction. */
var TransactionType;
(function (TransactionType) {
    /** PURCHASE - PURCHASE indicates a purchase transaction. */
    TransactionType["PURCHASE"] = "PURCHASE";
    /** SALE - SALE indicates a sale transaction. */
    TransactionType["SALE"] = "SALE";
    TransactionType["UNRECOGNIZED"] = "UNRECOGNIZED";
})(TransactionType = exports.TransactionType || (exports.TransactionType = {}));
/**
 * Intent is an enum informing the price oracle about the intent of the price
 * rate query. This is used to provide context for the asset rates being
 * requested, allowing the price oracle to tailor the response based on the
 * specific use case, such as paying an invoice or receiving a payment and the
 * different stages involved in those.
 */
var Intent;
(function (Intent) {
    /**
     * INTENT_UNSPECIFIED - INTENT_UNSPECIFIED is used to indicate that the intent of the price rate
     * query is not specified. This is the fallback default value and should not
     * be used in production code. It is primarily used for backward
     * compatibility with older versions of the protocol that did not include
     * intent information.
     */
    Intent["INTENT_UNSPECIFIED"] = "INTENT_UNSPECIFIED";
    /**
     * INTENT_PAY_INVOICE_HINT - INTENT_PAY_INVOICE_HINT is used to indicate that the user is requesting
     * a price rate hint for paying an invoice. This is typically used by the
     * payer of an invoice to provide a suggestion of the expected asset rate to
     * the RFQ peer (edge node) that will determine the actual rate for the
     * payment.
     */
    Intent["INTENT_PAY_INVOICE_HINT"] = "INTENT_PAY_INVOICE_HINT";
    /**
     * INTENT_PAY_INVOICE - INTENT_PAY_INVOICE is used to indicate that a peer wants to pay an
     * invoice with assets. This is typically used by the edge node that
     * facilitates the swap from assets to BTC for the payer of an invoice. This
     * intent is used to provide the actual asset rate for the payment, which
     * may differ from the hint provided by the payer.
     */
    Intent["INTENT_PAY_INVOICE"] = "INTENT_PAY_INVOICE";
    /**
     * INTENT_PAY_INVOICE_QUALIFY - INTENT_PAY_INVOICE_QUALIFY is used to indicate that the payer of an
     * invoice has received an asset rate from their RFQ peer (edge node) and is
     * qualifying the rate for the payment. This is typically used by the payer
     * of an invoice to ensure that the asset rate provided by their peer (edge
     * node) is acceptable before proceeding with the payment.
     */
    Intent["INTENT_PAY_INVOICE_QUALIFY"] = "INTENT_PAY_INVOICE_QUALIFY";
    /**
     * INTENT_RECV_PAYMENT_HINT - INTENT_RECV_PAYMENT_HINT is used to indicate that the user is requesting
     * a price rate hint for receiving a payment through an invoice. This is
     * typically used by the creator of an invoice to provide a suggestion of
     * the expected asset rate to the RFQ peer (edge node) that will determine
     * the actual rate used for creating an invoice.
     */
    Intent["INTENT_RECV_PAYMENT_HINT"] = "INTENT_RECV_PAYMENT_HINT";
    /**
     * INTENT_RECV_PAYMENT - INTENT_RECV_PAYMENT is used to indicate that a peer wants to create an
     * invoice to receive a payment with assets. This is typically used by the
     * edge node that facilitates the swap from BTC to assets for the receiver
     * of a payment. This intent is used to provide the actual asset rate for
     * the invoice creation, which may differ from the hint provided by the
     * receiver.
     */
    Intent["INTENT_RECV_PAYMENT"] = "INTENT_RECV_PAYMENT";
    /**
     * INTENT_RECV_PAYMENT_QUALIFY - INTENT_RECV_PAYMENT_QUALIFY is used to indicate that the creator of an
     * invoice received an asset rate from their RFQ peer (edge node) and is
     * qualifying the rate for the creation of the invoice. This is typically
     * used by the creator of an invoice to ensure that the asset rate provided
     * by their peer (edge node) is acceptable before proceeding with creating
     * the invoice.
     */
    Intent["INTENT_RECV_PAYMENT_QUALIFY"] = "INTENT_RECV_PAYMENT_QUALIFY";
    Intent["UNRECOGNIZED"] = "UNRECOGNIZED";
})(Intent = exports.Intent || (exports.Intent = {}));
