import { NostrWebLNProvider } from '@getalby/sdk';
import BigNumber from 'bignumber.js';

import { settingsStore } from '../stores/Stores';

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
    payLightningInvoice = async (data: any) =>
        await this.nwc.sendPayment(data.payment_request);
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
