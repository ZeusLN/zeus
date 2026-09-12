import { NostrWebLNProvider } from '@getalby/sdk';

import { settingsStore } from '../stores/Stores';

import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';

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
        const result = await this.nwc.makeInvoice({
            defaultMemo: data.memo,
            amount: Number(data.value)
        });

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
    payLightningInvoice = async (data: any) =>
        await this.nwc.sendPayment(data.payment_request);
    decodePaymentRequest = (urlParams?: Array<string>) =>
        Promise.resolve().then(() =>
            Bolt11Utils.decode((urlParams && urlParams[0]) || '')
        );
    lookupInvoice = async (data: any) =>
        await this.nwc.lookupInvoice({
            payment_hash: Base64Utils.hexToBase64(data.r_hash)
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
