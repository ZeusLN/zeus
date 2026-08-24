// Pure mapping functions from phoenixd's HTTP API JSON
// (https://phoenix.acinq.co/server/api) onto the LND-ish shapes Zeus's
// stores and models expect. Kept free of transport concerns so they can
// be unit tested directly against captured phoenixd responses.
//
// phoenixd timestamps are milliseconds; Zeus model getters expect
// seconds. phoenixd fee fields are millisatoshis; Zeus stores expect
// satoshis at the store boundary.

// GET /getinfo ->  models/NodeInfo shape.
// Throws when the node is not on mainnet: this backend only supports
// mainnet, and connecting Zeus to a testnet phoenixd would silently
// mix networks otherwise.
export const getNodeInfo = (data: any) => {
    if (data.chain !== 'mainnet') {
        throw new Error(
            `Zeus only supports phoenixd on mainnet (node reports chain: ${data.chain})`
        );
    }
    return {
        id: data.nodeId,
        network: data.chain,
        blockheight: data.blockHeight,
        version: `phoenixd v${data.version}`,
        // phoenixd has no chain-sync signal; it is usable as soon as it
        // answers, so report ready-to-send
        synced_to_chain: true
    };
};

// GET /getbalance -> lightning balance shape for BalanceStore
export const getLightningBalance = (data: any) => ({
    balance: data.balanceSat || 0
});

// GET /getbalance -> on-chain balance shape for BalanceStore.
// phoenixd's channel balance is simultaneously the lightning balance
// and the on-chain-spendable balance (splice-out spends channel funds),
// so the confirmed balance deliberately overlaps with the lightning
// balance. Swap-in funds not yet deeply confirmed count as unconfirmed.
export const getBlockchainBalance = (data: any) => {
    const swapIn = data.swapIn || {};
    const confirmed =
        (data.balanceSat || 0) + (swapIn.deeplyConfirmedBalanceSat || 0);
    const unconfirmed =
        (swapIn.unconfirmedBalanceSat || 0) +
        (swapIn.weaklyConfirmedBalanceSat || 0);
    return {
        total_balance: confirmed + unconfirmed,
        confirmed_balance: confirmed,
        unconfirmed_balance: unconfirmed
    };
};

// One incoming payment from GET /payments/incoming ->  models/Invoice
// fields. Only intended keys are emitted: passing phoenixd's raw fields
// through would collide with Invoice's getter names (e.g. isPaid).
export const mapIncomingPayment = (payment: any) => {
    const invoice: any = {
        payment_hash: payment.paymentHash,
        r_preimage: payment.preimage,
        memo: payment.description || undefined,
        settled: payment.isPaid,
        // sats received once paid; requested amount while unpaid
        amt_paid_sat: payment.receivedSat,
        value: payment.requestedSat,
        creation_date: payment.createdAt
            ? Math.floor(payment.createdAt / 1000)
            : undefined,
        // fee phoenixd/ACINQ took on receipt (msat -> sat)
        fees_sat: payment.fees ? payment.fees / 1000 : 0,
        payer_note: payment.payerNote || undefined
    };
    if (payment.invoice) {
        invoice.bolt11 = payment.invoice;
    }
    if (payment.expiresAt) {
        invoice.expires_at = Math.floor(payment.expiresAt / 1000);
    }
    if (payment.completedAt) {
        invoice.settle_date = Math.floor(payment.completedAt / 1000);
        // getTimestamp reads paid_at first, so paid invoices sort by
        // settlement time in the activity list
        invoice.paid_at = Math.floor(payment.completedAt / 1000);
    }
    return invoice;
};

// GET /payments/incoming -> { invoices } for InvoicesStore.
// The stores reverse whatever a backend hands them (matching LND REST,
// which lists ascending by add_index), so these lists must be
// oldest-first for the store to end up newest-first.
export const getIncomingPayments = (data: any[]) => ({
    invoices: (data || [])
        .map(mapIncomingPayment)
        .sort(
            (a: any, b: any) => (a.creation_date || 0) - (b.creation_date || 0)
        )
});

// One lightning outgoing payment -> models/Payment fields.
// phoenixd's `sent` is amount + fees (sats); `fees` is msat.
export const mapOutgoingLightningPayment = (payment: any) => {
    const feeSat = payment.fees ? payment.fees / 1000 : 0;
    const result: any = {
        payment_hash: payment.paymentHash,
        payment_preimage: payment.preimage || undefined,
        value_sat: (payment.sent || 0) - feeSat,
        fee_msat: payment.fees || 0,
        creation_date: payment.createdAt
            ? Math.floor(payment.createdAt / 1000)
            : undefined
    };
    if (payment.invoice) {
        result.payment_request = payment.invoice;
    }
    if (payment.isPaid) {
        result.status = 'complete';
    } else if (payment.completedAt) {
        result.status = 'failed';
        result.failure_reason = 'FAILURE_REASON_ERROR';
    } else {
        result.status = 'in_flight';
    }
    return result;
};

// One on-chain outgoing payment (splice_out / splice_cpfp /
// manual_liquidity / channel_close) -> models/Transaction fields.
//
// Transaction.getAmount backs the fee out of the amount to arrive at the
// recipient amount, so `amount` must be the TOTAL spend including the
// fee. phoenixd's `sent` is already that total.
export const mapOutgoingOnchainPayment = (payment: any) => {
    const feeSat = payment.fees ? payment.fees / 1000 : 0;
    const sentSat = payment.sent || 0;
    // A liquidity purchase spends nothing but the fee (sent === fees).
    // Reporting it as a transfer would net to zero and then show the fee
    // again beside it, so book the whole cost as the amount instead.
    const isPureFee = sentSat === feeSat;
    return {
        amount: isPureFee ? -feeSat : -sentSat,
        total_fees: isPureFee ? 0 : feeSat,
        txid: payment.txId,
        time_stamp: Math.floor(
            (payment.completedAt || payment.createdAt || 0) / 1000
        ),
        num_confirmations: payment.completedAt ? 1 : 0,
        phoenixd_sub_type: payment.subType
    };
};

// auto_liquidity is deliberately absent. It is the channel-open fee
// charged against an incoming payment, and phoenixd already reports that
// same amount as the `fees` on the incoming payment itself, so listing it
// here as well showed the funding receive twice in Activity.
const ONCHAIN_SUB_TYPES = [
    'splice_out',
    'splice_cpfp',
    'manual_liquidity',
    'channel_close'
];

// GET /payments/outgoing -> { payments } (lightning only).
// On-chain subTypes are excluded here and surfaced as transactions
// instead, so splice-outs don't appear twice in the activity list.
export const getOutgoingPayments = (data: any[]) => ({
    payments: (data || [])
        .filter((payment: any) => payment.subType === 'lightning')
        .map(mapOutgoingLightningPayment)
        // oldest-first; PaymentsStore reverses (see getIncomingPayments)
        .sort(
            (a: any, b: any) => (a.creation_date || 0) - (b.creation_date || 0)
        )
});

// GET /payments/outgoing -> { transactions } (on-chain subTypes only)
export const getOnchainTransactions = (data: any[]) => ({
    transactions: (data || [])
        .filter((payment: any) => ONCHAIN_SUB_TYPES.includes(payment.subType))
        .map(mapOutgoingOnchainPayment)
        // oldest-first; TransactionsStore reverses (see getIncomingPayments)
        .sort((a: any, b: any) => (a.time_stamp || 0) - (b.time_stamp || 0))
});

// POST /createinvoice -> shape InvoicesStore.createUnifiedInvoice needs
// (a payment request plus a usable rHash)
export const mapGeneratedInvoice = (data: any) => ({
    bolt11: data.serialized,
    payment_request: data.serialized,
    payment_hash: data.paymentHash,
    r_hash: data.paymentHash,
    value: data.amountSat
});

// POST /payinvoice | /payoffer response -> TransactionsStore
// handlePayment shape. phoenixd returns HTTP 200 for both outcomes:
// success carries a preimage, failure carries a reason.
export const mapPaymentResult = (data: any) => {
    if (data && data.paymentPreimage) {
        return {
            status: 'complete',
            payment_hash: data.paymentHash,
            payment_preimage: data.paymentPreimage,
            fee_sat: data.routingFeeSat || 0,
            value_sat: data.recipientAmountSat
        };
    }
    return {
        payment_error: (data && data.reason) || 'Payment failed'
    };
};

// GET /getoffer (a bare bolt12 string) -> { offers } for OffersStore.
// phoenixd exposes a single node offer derived from the seed; it cannot
// list or disable offers created via /createoffer. The label is passed
// in so this stays free of locale imports.
export const getOffers = (offer: string, label?: string) => ({
    offers: [
        {
            bolt12: offer,
            label,
            active: true,
            single_use: false,
            used: false
        }
    ]
});
