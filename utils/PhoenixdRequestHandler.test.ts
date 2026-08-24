jest.mock('../stores/Stores', () => ({}));

import {
    getNodeInfo,
    getLightningBalance,
    getBlockchainBalance,
    getIncomingPayments,
    getOutgoingPayments,
    getOnchainTransactions,
    mapIncomingPayment,
    mapGeneratedInvoice,
    mapPaymentResult,
    getOffers
} from './PhoenixdRequestHandler';
import Transaction from '../models/Transaction';
import Invoice from '../models/Invoice';

// Fixtures captured from a live phoenixd v0.9.0 node
const getInfoFixture = {
    nodeId: '03a4aff76bc19547acfe9703a5bb2eb862715d1074d40574675d86f688bd603488',
    channels: [],
    chain: 'mainnet',
    blockHeight: 963776,
    version: '0.9.0-b072567'
};

const getBalanceFixture = {
    balanceSat: 45000,
    feeCreditSat: 0,
    swapIn: {
        unconfirmedBalanceSat: 1000,
        weaklyConfirmedBalanceSat: 2000,
        deeplyConfirmedBalanceSat: 3000
    }
};

// captured verbatim from GET /payments/incoming?all=true&limit=100
const unpaidIncomingFixture = {
    type: 'incoming_payment',
    subType: 'lightning',
    paymentHash:
        'e8820ff36aea1b7fe918ceef269bbe7e0843b000be6a0f2c99fb9f868e3e7d48',
    preimage:
        '02fbcc2ad7ce0af5cd8e52cb6e369088511524feefb9c5f90c07b1b4177f6e43',
    description: 'Zeus phoenixd test funding',
    invoice:
        'lnbc500u1p4gkuw3pp5azpqlum2agdhl6gcemhjdxa70cyy8vqqhe4q7tyelw0cdr3704yqcqzys',
    isPaid: false,
    isExpired: false,
    requestedSat: 50000,
    receivedSat: 0,
    fees: 0,
    expiresAt: 1787609937400,
    createdAt: 1787523537400
};

// captured verbatim from the live node after the funding payment
// (channel open: 50,000 sats requested, 48,158 received, ACINQ took
// 1,842 sats in mining + liquidity fees)
const paidIncomingFixture = {
    type: 'incoming_payment',
    subType: 'lightning',
    paymentHash:
        'e8820ff36aea1b7fe918ceef269bbe7e0843b000be6a0f2c99fb9f868e3e7d48',
    preimage:
        '02fbcc2ad7ce0af5cd8e52cb6e369088511524feefb9c5f90c07b1b4177f6e43',
    description: 'Zeus phoenixd test funding',
    invoice:
        'lnbc500u1p4gkuw3pp5azpqlum2agdhl6gcemhjdxa70cyy8vqqhe4q7tyelw0cdr3704yqcqzys',
    isPaid: true,
    isExpired: false,
    requestedSat: 50000,
    receivedSat: 48158,
    fees: 1842000, // msat
    expiresAt: 1787609937400,
    completedAt: 1787524633203,
    createdAt: 1787523537400
};

const outgoingLightningFixture = {
    type: 'outgoing_payment',
    subType: 'lightning',
    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000001',
    paymentHash: 'c'.repeat(64),
    preimage: 'd'.repeat(64),
    txId: null,
    isPaid: true,
    sent: 1005, // includes fees
    fees: 5000, // msat
    invoice: 'lnbc10u1poutfixture',
    completedAt: 1787523700000,
    createdAt: 1787523690000
};

const outgoingFailedFixture = {
    type: 'outgoing_payment',
    subType: 'lightning',
    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000002',
    paymentHash: 'e'.repeat(64),
    preimage: null,
    txId: null,
    isPaid: false,
    sent: 500,
    fees: 0,
    invoice: 'lnbc5u1pfailfixture',
    completedAt: 1787523800000,
    createdAt: 1787523790000
};

const spliceOutFixture = {
    type: 'outgoing_payment',
    subType: 'splice_out',
    paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000003',
    paymentHash: null,
    preimage: null,
    txId: '1'.repeat(64),
    isPaid: true,
    sent: 10500, // includes mining fee
    fees: 500000, // msat
    invoice: null,
    completedAt: 1787524000000,
    createdAt: 1787523900000
};

// captured verbatim from GET /payments/outgoing?all=true&limit=100
// after the channel open. Note: paymentHash/preimage/invoice keys are
// entirely absent (not null) on on-chain entries, and the whole `sent`
// amount is the fee.
const autoLiquidityFixture = {
    type: 'outgoing_payment',
    subType: 'auto_liquidity',
    paymentId: '70a4edd7-c3c1-4b5d-ace7-9f2f5ae57778',
    txId: '06d5a59a657a0a23100f83e383277e148aff8be286cfdc7e6ad656753f4a4b3f',
    isPaid: true,
    sent: 1842,
    fees: 1842000, // msat
    completedAt: 1787524632739,
    createdAt: 1787524632545
};

describe('PhoenixdRequestHandler', () => {
    describe('getNodeInfo', () => {
        it('maps /getinfo onto the NodeInfo model shape', () => {
            const result = getNodeInfo(getInfoFixture);
            expect(result.id).toEqual(getInfoFixture.nodeId);
            expect(result.network).toEqual('mainnet');
            expect(result.blockheight).toEqual(963776);
            expect(result.version).toEqual('phoenixd v0.9.0-b072567');
            expect(result.synced_to_chain).toEqual(true);
        });

        it('rejects non-mainnet nodes', () => {
            expect(() =>
                getNodeInfo({ ...getInfoFixture, chain: 'testnet' })
            ).toThrow(/mainnet/);
        });
    });

    describe('balances', () => {
        it('maps the lightning balance', () => {
            expect(getLightningBalance(getBalanceFixture)).toEqual({
                balance: 45000
            });
        });

        it('maps the on-chain balance including swap-in funds', () => {
            expect(getBlockchainBalance(getBalanceFixture)).toEqual({
                // channel balance + deeply confirmed swap-in
                confirmed_balance: 48000,
                // unconfirmed + weakly confirmed swap-in
                unconfirmed_balance: 3000,
                total_balance: 51000
            });
        });

        it('handles a fresh node with no swap-in data', () => {
            expect(
                getBlockchainBalance({ balanceSat: 0, feeCreditSat: 0 })
            ).toEqual({
                confirmed_balance: 0,
                unconfirmed_balance: 0,
                total_balance: 0
            });
        });
    });

    describe('incoming payments -> invoices', () => {
        it('maps an unpaid invoice', () => {
            const invoice = mapIncomingPayment(unpaidIncomingFixture);
            expect(invoice.payment_hash).toEqual(
                unpaidIncomingFixture.paymentHash
            );
            expect(invoice.settled).toEqual(false);
            expect(invoice.value).toEqual(50000);
            expect(invoice.memo).toEqual('Zeus phoenixd test funding');
            expect(invoice.bolt11).toEqual(unpaidIncomingFixture.invoice);
            // ms -> seconds
            expect(invoice.creation_date).toEqual(1787523537);
            expect(invoice.expires_at).toEqual(1787609937);
            expect(invoice.settle_date).toBeUndefined();
            expect(invoice.paid_at).toBeUndefined();
        });

        it('maps a paid invoice with the fee ACINQ took', () => {
            const invoice = mapIncomingPayment(paidIncomingFixture);
            expect(invoice.settled).toEqual(true);
            expect(invoice.amt_paid_sat).toEqual(48158);
            // fee msat -> sat
            expect(invoice.fees_sat).toEqual(1842);
            expect(invoice.settle_date).toEqual(1787524633);
            expect(invoice.paid_at).toEqual(1787524633);
        });

        it('never emits keys that collide with Invoice model getters', () => {
            const invoice = mapIncomingPayment(paidIncomingFixture);
            expect(invoice.isPaid).toBeUndefined();
            expect(invoice.isExpired).toBeUndefined();
        });

        // InvoicesStore reverses the array it is handed, so the backend
        // must emit oldest-first for the store to end up newest-first
        it('wraps the list oldest-first for InvoicesStore', () => {
            const older = { ...paidIncomingFixture, createdAt: 1787000000000 };
            const { invoices } = getIncomingPayments([
                unpaidIncomingFixture, // created later
                older
            ]);
            expect(invoices.length).toEqual(2);
            expect(invoices[0].payment_hash).toEqual(older.paymentHash);
            expect(invoices[1].payment_hash).toEqual(
                unpaidIncomingFixture.paymentHash
            );
        });
    });

    describe('outgoing payments', () => {
        const all = [
            outgoingLightningFixture,
            outgoingFailedFixture,
            spliceOutFixture,
            autoLiquidityFixture
        ];

        it('keeps only lightning subTypes as payments', () => {
            const { payments } = getOutgoingPayments(all);
            expect(payments.length).toEqual(2);
        });

        it('maps a successful payment with fee split out of sent', () => {
            const { payments } = getOutgoingPayments([
                outgoingLightningFixture
            ]);
            const payment = payments[0];
            expect(payment.payment_hash).toEqual('c'.repeat(64));
            expect(payment.payment_preimage).toEqual('d'.repeat(64));
            // sent (1005) minus fee (5 sats)
            expect(payment.value_sat).toEqual(1000);
            expect(payment.fee_msat).toEqual(5000);
            expect(payment.status).toEqual('complete');
            expect(payment.creation_date).toEqual(1787523690);
            expect(payment.payment_request).toEqual('lnbc10u1poutfixture');
        });

        it('marks a completed-but-unpaid payment failed', () => {
            const { payments } = getOutgoingPayments([outgoingFailedFixture]);
            expect(payments[0].status).toEqual('failed');
            expect(payments[0].failure_reason).toEqual('FAILURE_REASON_ERROR');
        });

        it('surfaces splice-outs as transactions with fees', () => {
            const { transactions } = getOnchainTransactions(all);
            // auto_liquidity is excluded, leaving only the splice-out
            expect(transactions.length).toEqual(1);
            const splice = transactions[0];
            expect(splice.txid).toEqual('1'.repeat(64));
            expect(splice.phoenixd_sub_type).toEqual('splice_out');
            // amount is the TOTAL spend; getAmount backs the fee out
            expect(splice.amount).toEqual(-10500);
            expect(splice.total_fees).toEqual(500);
            expect(splice.time_stamp).toEqual(1787524000);
            expect(splice.num_confirmations).toEqual(1);
        });

        // The mapping is only correct if the Transaction model renders
        // the right numbers from it, which is where an earlier
        // double-subtraction of the fee hid
        it('renders a splice-out as recipient amount plus fee', () => {
            const { transactions } = getOnchainTransactions([spliceOutFixture]);
            const tx = new Transaction(transactions[0]);
            // sent 10,500 = 10,000 to the recipient + 500 mining fee
            expect(Number(tx.getAmount)).toEqual(-10000);
            expect(Number(tx.getFee)).toEqual(500);
        });

        it('books a liquidity purchase as a pure fee, not a transfer', () => {
            const manual = {
                ...autoLiquidityFixture,
                subType: 'manual_liquidity'
            };
            const { transactions } = getOnchainTransactions([manual]);
            const tx = new Transaction(transactions[0]);
            // the entire cost is the fee; showing it as a zero-amount
            // transfer would display the fee twice
            expect(Number(tx.getAmount)).toEqual(-1842);
            expect(Number(tx.getFee)).toEqual(0);
        });

        // Regression: funding the wallet over lightning produced both a
        // "received" row and a bogus "sent on-chain" row for the same fee
        it('does not duplicate a channel-open fee as its own transaction', () => {
            const { transactions } = getOnchainTransactions([
                autoLiquidityFixture
            ]);
            expect(transactions).toEqual([]);
            // the fee is reported on the incoming payment instead
            const invoice = new Invoice(
                mapIncomingPayment(paidIncomingFixture)
            );
            expect(Number(invoice.getAmount)).toEqual(48158);
            expect(Number(invoice.getFee)).toEqual(1842);
        });

        it('keeps lightning payments out of the transaction list', () => {
            const { payments } = getOutgoingPayments(all);
            const { transactions } = getOnchainTransactions(all);
            const paymentIds = payments.map((p: any) => p.payment_hash);
            expect(paymentIds).not.toContain(null);
            // 4 fixtures: 2 lightning payments, 1 splice-out,
            // 1 auto_liquidity that is intentionally dropped
            expect(payments.length).toEqual(2);
            expect(transactions.length).toEqual(1);
        });
    });

    describe('generated invoice', () => {
        it('maps /createinvoice to a shape with payment request and rHash', () => {
            const result = mapGeneratedInvoice({
                amountSat: 50000,
                paymentHash: 'f'.repeat(64),
                serialized: 'lnbc500u1pfixture'
            });
            expect(result.bolt11).toEqual('lnbc500u1pfixture');
            expect(result.payment_request).toEqual('lnbc500u1pfixture');
            expect(result.payment_hash).toEqual('f'.repeat(64));
            expect(result.r_hash).toEqual('f'.repeat(64));
            expect(result.value).toEqual(50000);
        });
    });

    describe('payment results', () => {
        it('maps a PaymentSent response to a completed payment', () => {
            const result = mapPaymentResult({
                recipientAmountSat: 1000,
                routingFeeSat: 2,
                paymentId: 'f1d2d2f9-24f8-4b3e-9a5c-000000000005',
                paymentHash: 'a'.repeat(64),
                paymentPreimage: 'b'.repeat(64)
            });
            expect(result.status).toEqual('complete');
            expect(result.payment_hash).toEqual('a'.repeat(64));
            expect(result.payment_preimage).toEqual('b'.repeat(64));
            expect(result.fee_sat).toEqual(2);
            expect(result.value_sat).toEqual(1000);
        });

        it('maps a PaymentFailed response to payment_error', () => {
            const result = mapPaymentResult({
                paymentHash: 'a'.repeat(64),
                offerId: null,
                reason: 'not enough funds'
            });
            expect(result.payment_error).toEqual('not enough funds');
            expect(result.status).toBeUndefined();
        });
    });

    describe('offers', () => {
        it('wraps the node offer for OffersStore', () => {
            const { offers } = getOffers('lno1fixture', 'Node offer');
            expect(offers.length).toEqual(1);
            expect(offers[0].bolt12).toEqual('lno1fixture');
            expect(offers[0].label).toEqual('Node offer');
            expect(offers[0].active).toEqual(true);
            expect(offers[0].single_use).toEqual(false);
        });
    });
});
