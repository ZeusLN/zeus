import {
    Nip47PublishTimeoutError,
    Nip47ReplyTimeoutError,
    Nip47ResponseDecodingError,
    NostrWebLNProvider
} from '@getalby/sdk';
import BigNumber from 'bignumber.js';
import { sha256 } from 'js-sha256';

import { settingsStore } from '../stores/Stores';

import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { localeString } from '../utils/LocaleUtils';

export default class NostrWalletConnect {
    nwc: NostrWebLNProvider;

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
        const { transactions } = await this.nwc.listTransactions({
            ...(data?.limit && {
                limit: data.limit
            })
        });
        const invoices = transactions.filter(
            (payment: any) => payment.type === 'incoming'
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
        let isZeroAmount = false;
        try {
            const decoded = Bolt11Utils.decode(data.payment_request);
            payment_hash = decoded.payment_hash;
            isZeroAmount = !Number(decoded.num_msat);
        } catch (e) {
            // decoding is best-effort; the wallet service validates the
            // invoice itself
        }

        // amt is the sat amount the user entered; NIP-47 pay_invoice takes
        // it in msat. Send it only for an invoice known to have no amount:
        // wallets reject an amount sent with an invoice that carries one.
        const amountMsat =
            data.amt && isZeroAmount
                ? Math.round(Number(data.amt) * 1000)
                : undefined;

        // Call the NIP-47 client directly: the provider's sendPayment takes
        // only the invoice and drops fees_paid from the reply
        let preimage: string | undefined;
        let fees_paid: number | undefined;
        try {
            const { client } = this.nwc;
            ({ preimage, fees_paid } = await client.payInvoice({
                invoice: data.payment_request,
                ...(amountMsat && { amount: amountMsat })
            }));
        } catch (error) {
            // These errors leave the outcome unknown, so the payment may
            // still complete:
            // - reply timeout: the wallet did not answer in time.
            // - publish timeout: the SDK stops waiting after 5 s but does
            //   not cancel the publish, so the request can still reach the
            //   wallet once the relay connects.
            // - response decoding error: the wallet answered with something
            //   that could not be parsed.
            // Nip47PublishError still rejects. It also covers a relay that
            // took the event but acknowledged it late, but the SDK drops
            // the per-relay reasons, so it can't be told apart from a relay
            // that refused the event. A retry reuses the payment hash.
            // Wallet errors reject unchanged.
            if (
                error instanceof Nip47ReplyTimeoutError ||
                error instanceof Nip47PublishTimeoutError ||
                error instanceof Nip47ResponseDecodingError
            ) {
                return { status: 'IN_FLIGHT', payment_hash };
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
                sha256(Base64Utils.hexToBytes(normalizedPreimage)) !==
                    payment_hash.toLowerCase())
        ) {
            throw new Error(
                localeString('backends.NWC.payLightningInvoice.wrongPreimage')
            );
        }

        return {
            status: 'SUCCEEDED',
            payment_hash,
            preimage: normalizedPreimage,
            // NIP-47 reports fees_paid in msat
            ...(typeof fees_paid === 'number' && {
                fee_msat: String(fees_paid)
            })
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

    supportsPeers = () => false;
    supportsMessageSigning = () => false;
    supportsMessageVerification = () => false;
    supportsLnurlAuth = () => false;
    supportsOnchainBalance = () => false;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () => false;
    supportsLightningSends = () => true;
    supportsKeysend = () => false;
    supportsPaymentLookup = () => false;
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
