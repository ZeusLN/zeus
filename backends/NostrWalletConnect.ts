import { NostrWebLNProvider } from '@getalby/sdk';
import BigNumber from 'bignumber.js';

import { settingsStore } from '../stores/Stores';

import Bolt11Utils from '../utils/Bolt11Utils';
import {
    markNodeResponded,
    markWalletReplied
} from '../utils/PaymentLookupUtils';

// NIP-47 error codes only a wallet's reply carries. The SDK's own failures
// (reply and publish timeouts, relay and decoding errors) use INTERNAL or
// OTHER, which a wallet may also send, so those stay unmarked: the request
// may still have reached the wallet. Matched by code because instanceof
// on the SDK's Error subclasses is unreliable under Babel's class
// transform.
const WALLET_ANSWER_CODES = [
    'PAYMENT_FAILED',
    'INSUFFICIENT_BALANCE',
    'QUOTA_EXCEEDED',
    'RESTRICTED',
    'UNAUTHORIZED',
    'RATE_LIMITED',
    'NOT_IMPLEMENTED',
    'NOT_FOUND',
    // Alby Hub: an invoice it cannot decode, and an expired one
    'BAD_REQUEST',
    'EXPIRED'
];

// How the SDK's own errors start (@getalby/sdk 9.0.0, NWCClient). An
// INTERNAL or OTHER error with any other message is the wallet's reply:
// Alby Hub, for one, sends every payment failure it has no code for,
// routing failures included, as INTERNAL. NostrWalletConnect.test.ts
// checks this list against the installed SDK.
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
        try {
            return await this.nwc.sendPayment(data.payment_request);
        } catch (error: any) {
            // the wallet's error reply is its answer to the request, like
            // a node's rejection; see WALLET_ANSWER_CODES
            if (WALLET_ANSWER_CODES.includes(error?.code)) {
                throw markNodeResponded(error);
            }
            // a wallet may also send these after its own timeout, so the
            // request may still be in flight: keep its message, but leave
            // tracking as for any other unknown outcome
            if (
                (error?.code === 'INTERNAL' || error?.code === 'OTHER') &&
                !isSdkError(error)
            ) {
                throw markWalletReplied(error);
            }
            throw error;
        }
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
