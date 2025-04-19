import bolt11 from 'bolt11';
import { webln } from '@getalby/sdk';

import { settingsStore } from '../stores/storeInstances';

import Base64Utils from '../utils/Base64Utils';

export default class NostrWalletConnect {
    nwc: any;

    initNWC = async () => {
        const { nostrWalletConnectUrl } = settingsStore;

        this.nwc = new webln.NostrWebLNProvider({
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
    createInvoice = async (data: any) =>
        await this.nwc.makeInvoice({
            defaultMemo: data.memo,
            amount: Number(data.value)
        });
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
        Promise.resolve().then(() => {
            const decoded: any = bolt11.decode(
                (urlParams && urlParams[0]) || ''
            );
            for (let i = 0; i < decoded.tags.length; i++) {
                const tag = decoded.tags[i];
                switch (tag.tagName) {
                    case 'purpose_commit_hash':
                        decoded.description_hash = tag.data;
                        break;
                    case 'payment_hash':
                        decoded.payment_hash = tag.data;
                        break;
                    case 'expire_time':
                        decoded.expiry = tag.data;
                        break;
                    case 'description':
                        decoded.description = tag.data;
                        break;
                }
            }
            return decoded;
        });
    lookupInvoice = async (data: any) =>
        await this.nwc.lookupInvoice({
            payment_hash: Base64Utils.hexToBase64(data.r_hash)
        });

    supportsMessageSigning = () => false;
    supportsLnurlAuth = () => false;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () => false;
    supportsLightningSends = () => true;
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
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
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    isLNDBased = () => false;
    supportInboundFees = () => false;
    supportsCashuWallet = () => false;
}
