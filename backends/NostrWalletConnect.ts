import {
    Nip47PublishTimeoutError,
    Nip47ReplyTimeoutError,
    Nip47ResponseDecodingError,
    NostrWebLNProvider
} from '@getalby/sdk';
import BigNumber from 'bignumber.js';

import { settingsStore } from '../stores/Stores';

import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { sha256Hex } from '../utils/HashingUtils';
import { localeString } from '../utils/LocaleUtils';
import {
    markNodeResponded,
    markSendRefused,
    markWalletReplied
} from '../utils/PaymentLookupUtils';

// Codes are matched as strings because instanceof on the SDK's Error
// subclasses is unreliable under Babel's class transform.

// NIP-47 error codes a wallet sends when it refuses a pay request before
// sending anything, so there is no payment to track. Alby Hub also sends
// BAD_REQUEST (an invoice it cannot decode) and EXPIRED (an expired app
// connection); ZEUS's wallet service sends INVALID_INVOICE and
// INVOICE_EXPIRED from its checks before paying (Nip47ErrorCode).
const WALLET_REFUSAL_CODES = [
    'INSUFFICIENT_BALANCE',
    'QUOTA_EXCEEDED',
    'RESTRICTED',
    'UNAUTHORIZED',
    'RATE_LIMITED',
    'NOT_IMPLEMENTED',
    'BAD_REQUEST',
    'EXPIRED',
    'INVALID_INVOICE',
    'INVOICE_EXPIRED'
];

// Codes that settle a pay request the wallet tried, like a node's
// rejection, so one lookup without a record ends tracking. NOT_FOUND is
// here rather than a refusal because a wallet may send it after a send
// attempt.
const WALLET_ANSWER_CODES = ['PAYMENT_FAILED', 'NOT_FOUND'];

// How the SDK's own errors start (@getalby/sdk 9.0.0, NWCClient); they use
// only the codes INTERNAL, OTHER and UNSUPPORTED_ENCRYPTION. A coded error
// with any other message is the wallet's reply, whatever the code: Alby
// Hub sends every payment failure it has no code for as INTERNAL, and
// ZEUS's wallet service sends FAILED_TO_PAY_INVOICE.
// NostrWalletConnect.test.ts checks this list against the installed SDK.
export const SDK_ERROR_MESSAGE_PREFIXES = [
    'failed to deserialize response',
    'response from NWC failed validation: ',
    'reply timeout: event ',
    'publish timeout: ',
    'failed to publish: ',
    'Failed to publish notification event',
    'Failed to connect to ',
    'no compatible encryption or version found between wallet and client'
];

// The SDK's text for a wallet error reply that carries no message (it
// builds Nip47WalletError(message || 'unknown Error', code || 'INTERNAL')).
// It says nothing about the failure, so it is never shown as the wallet's
// reason. NostrWalletConnect.test.ts checks it against the installed SDK.
export const SDK_EMPTY_REPLY_MESSAGE = 'unknown Error';

const isSdkError = (error: any): boolean => {
    const message = error?.message;
    return (
        typeof message !== 'string' ||
        SDK_ERROR_MESSAGE_PREFIXES.some((prefix) => message.startsWith(prefix))
    );
};

export default class NostrWalletConnect {
    nwc: any;

    initNWC = async () => {
        const { nostrWalletConnectUrl } = settingsStore;

        this.nwc = new NostrWebLNProvider({
            nostrWalletConnectUrl
        });

        return this.nwc;
    };
    connect = async () => await this.nwc.enable();
    getLightningBalance = async () => await this.nwc.getBalance();
    getInvoices = async (data: any) => {
        // unpaid is off by default in NIP-47: ask for the open and expired
        // invoices the wallet created too
        const { transactions } = await this.nwc.listTransactions({
            type: 'incoming',
            unpaid: true,
            ...(data?.limit && {
                limit: data.limit
            })
        });
        const invoices = transactions
            .filter((payment: any) => payment.type === 'incoming')
            .map((invoice: any) =>
                // Older ZEUS wallet services send expires_at in
                // milliseconds; NIP-47 uses seconds. 1e11 s is in the year
                // 5138, while 1e11 ms is in 1973.
                typeof invoice.expires_at === 'number' &&
                invoice.expires_at > 1e11
                    ? {
                          ...invoice,
                          expires_at: Math.floor(invoice.expires_at / 1000)
                      }
                    : invoice
            );
        return { invoices };
    };
    createInvoice = async (data: any) => {
        // the SDK rejects msat amounts that are not whole numbers, and the
        // keypad allows fractional sats
        const amount = Math.round(
            new BigNumber(data.value).times(1000).toNumber()
        );
        if (!(amount >= 1)) {
            throw new Error('No amount specified');
        }
        const { invoice } = await this.nwc.client.makeInvoice({
            description: data.memo,
            amount
        });
        const result: any = { paymentRequest: invoice };

        // NWC only returns { paymentRequest }. createUnifiedInvoice
        // requires a valid rHash, so extract payment_hash from the
        // bolt11 to satisfy that check.
        if (result?.paymentRequest && !result.payment_hash) {
            try {
                const decoded = Bolt11Utils.decode(result.paymentRequest);
                if (decoded.payment_hash) {
                    result.payment_hash = decoded.payment_hash;
                }
            } catch (e) {
                // decoding is best-effort
            }
        }

        return result;
    };
    getPayments = async (
        params: {
            maxPayments?: number;
        } = {
            maxPayments: 500
        }
    ) => {
        const { transactions } = await this.nwc.listTransactions({
            type: 'outgoing',
            ...(params?.maxPayments && {
                limit: params.maxPayments
            })
        });
        const payments = transactions.filter(
            (payment: any) => payment.type === 'outgoing'
        );
        return { payments };
    };
    payLightningInvoice = async (data: any) => {
        let payment_hash: string | undefined;
        try {
            payment_hash = Bolt11Utils.decode(
                data.payment_request
            ).payment_hash;
        } catch (e) {
            // decoding is best-effort; the wallet service validates the
            // invoice itself
        }

        let preimage: string | undefined;
        try {
            ({ preimage } = await this.nwc.sendPayment(data.payment_request));
        } catch (error: any) {
            // These errors leave the outcome unknown, so the payment may
            // still complete:
            // - reply timeout: the wallet did not answer in time.
            // - publish timeout: no relay acknowledged the request within
            //   5 s. The SDK does not cancel the publish, and a relay that
            //   acknowledges late may already have passed it on.
            // - response decoding error: the wallet answered with something
            //   that could not be parsed.
            // Nip47PublishError still rejects. Since SDK 9.0.0 it only
            // covers relays that refused the request or could not be
            // reached; a missing acknowledgement is a publish timeout. A
            // relay that drops the connection after taking the request
            // also ends here. A retry reuses the payment hash.
            // Wallet errors are classified below.
            if (
                error instanceof Nip47ReplyTimeoutError ||
                error instanceof Nip47PublishTimeoutError ||
                error instanceof Nip47ResponseDecodingError
            ) {
                return { status: 'IN_FLIGHT', payment_hash };
            }
            const code = error?.code;
            // a reply without a message: show the generic failure, not the
            // SDK's placeholder, and don't keep it as the wallet's reason
            const emptyReply = error?.message === SDK_EMPTY_REPLY_MESSAGE;
            if (emptyReply) {
                error.message = localeString('error.sendingPayment');
            }
            if (WALLET_REFUSAL_CODES.includes(code)) {
                throw markSendRefused(markNodeResponded(error));
            }
            if (WALLET_ANSWER_CODES.includes(code)) {
                throw markNodeResponded(error);
            }
            // any other code may also follow the wallet's own timeout
            // (ZEUS's service sends FAILED_TO_PAY_INVOICE for a pay still
            // in progress), so the request may still be in flight: keep
            // the message, but track as for any other unknown outcome
            if (!emptyReply && typeof code === 'string' && !isSdkError(error)) {
                throw markWalletReplied(error);
            }
            throw error;
        }

        // A reply with no preimage is not proof of payment. Zeus's own NWC
        // service answers with an empty preimage while the HTLC is still out
        if (!preimage) {
            return { status: 'IN_FLIGHT', payment_hash };
        }

        const normalizedPreimage = preimage.toLowerCase();
        if (
            payment_hash &&
            (!/^[0-9a-f]{64}$/.test(normalizedPreimage) ||
                sha256Hex(Base64Utils.hexToBytes(normalizedPreimage)) !==
                    payment_hash.toLowerCase())
        ) {
            throw new Error(
                localeString('backends.NWC.payLightningInvoice.wrongPreimage')
            );
        }

        return {
            status: 'SUCCEEDED',
            payment_hash,
            preimage: normalizedPreimage
        };
    };
    decodePaymentRequest = (urlParams?: Array<string>) =>
        Promise.resolve().then(() =>
            Bolt11Utils.decode((urlParams && urlParams[0]) || '')
        );
    // callers pass r_hash as hex, which is what NIP-47 lookup_invoice takes;
    // the provider reads it from paymentHash
    lookupInvoice = async (data: any) =>
        await this.nwc.lookupInvoice({
            paymentHash: data.r_hash
        });
    // NIP-47 lookup_invoice resolves either direction by payment_hash;
    // the raw client is used because the webln wrapper discards state and
    // amounts. Mapped to an LND-shaped payment, with msat amounts
    // converted to sats for parity with the webln-mapped getPayments list.
    lookupPayment = async (data: { payment_hash: string }) => {
        let tx: any;
        try {
            tx = await this.nwc.client.lookupInvoice({
                payment_hash: data.payment_hash
            });
        } catch (error: any) {
            // the wallet answered: it has no record of this payment
            if (error?.code === 'NOT_FOUND') return null;
            throw error;
        }
        if (!tx) return null;
        // state predates some wallets; settled_at is the spec's original
        // settlement signal
        const state = tx.state || (tx.settled_at ? 'settled' : 'pending');
        return {
            payment_hash: tx.payment_hash,
            payment_preimage: tx.preimage,
            invoice: tx.invoice,
            creation_date: tx.created_at?.toString(),
            amount: Math.floor((tx.amount || 0) / 1000),
            fees_paid: tx.fees_paid ? Math.floor(tx.fees_paid / 1000) : 0,
            status:
                state === 'settled'
                    ? 'SUCCEEDED'
                    : state === 'failed'
                    ? 'FAILED'
                    : 'IN_FLIGHT'
        };
    };

    supportsPeers = () => false;
    supportsMessageSigning = () => false;
    supportsMessageVerification = () => false;
    supportsLnurlAuth = () => false;
    supportsOnchainBalance = () => false;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () => false;
    supportsLightningSends = () => true;
    supportsKeysend = () => false;
    supportsPaymentLookup = () => true;
    supportsChannelManagement = () => false;
    supportsCircularRebalancing = () => false;
    supportsForceClose = () => false;
    supportsPendingChannels = () => false;
    supportsClosedChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => false;
    supportsWithdrawalRequests = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsOnchainSendFeeRate = () => false;
    supportsChannelOpenFeeRate = () => false;
    supportsChannelOpenMinConfs = () => false;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => false;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => false;
    supportsOnchainSendMax = () => false;
    supportsChannelMemo = () => false;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => false;
    supportsLSPS1customMessage = () => false;
    supportsLSPS1rest = () => false;
    supportsOffers = () => false;
    supportsListingOffers = () => false;
    supportsBolt12Address = () => false;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsCustomFeeLimit = () => false;
    isLNDBased = () => false;
    supportsForwardingHistory = () => false;
    supportInboundFees = () => false;
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => false;
    supportsNostrWalletConnectService = () => false;
}
