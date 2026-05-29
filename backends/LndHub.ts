import { settingsStore } from '../stores/Stores';

import LND from './LND';
import LoginRequest from './../models/LoginRequest';
import Base64Utils from './../utils/Base64Utils';
import Bolt11Utils from './../utils/Bolt11Utils';
import { sha256 } from '@noble/hashes/sha2';
import { ecdsaSignDERHex } from '../utils/SigningUtils';

export default class LndHub extends LND {
    getHeaders = (accessToken: string) => {
        if (accessToken) {
            return {
                Authorization: `Bearer ${accessToken}`,
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            };
        }
        return {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        };
    };

    login = (data: LoginRequest) =>
        this.postRequest('/auth?type=auth', {
            login: data.login,
            password: data.password
        });

    getPayments = () =>
        this.getRequest('/gettxs').then((data: any) => ({
            payments: data
        }));
    getLightningBalance = () =>
        this.getRequest('/balance').then(({ BTC }: any) => ({
            balance: BTC.AvailableBalance
        }));
    getInvoices = () =>
        this.getRequest('/getuserinvoices').then((data: any) => ({
            invoices: data
        }));

    createInvoice = (data: any) =>
        this.postRequest('/addinvoice', {
            amt: data.value,
            memo: data.memo
        });
    getNewAddress = () => this.getRequest('/getbtc');
    decodePaymentRequest = (urlParams?: Array<string>) =>
        Promise.resolve().then(() =>
            Bolt11Utils.decode((urlParams && urlParams[0]) || '')
        );
    payLightningInvoice = (data: any) =>
        this.postRequest('/payinvoice', {
            invoice: data.payment_request,
            amount: data.amt
        });
    lnurlAuth = (message: string) => {
        const messageHash = sha256(Base64Utils.stringToUint8Array(message));

        let signed, signature, key;
        switch (settingsStore.settings.lndHubLnAuthMode || 'Alby') {
            case 'Alby':
                key = sha256(
                    Base64Utils.stringToUint8Array(
                        `lndhub://${settingsStore.username}:${settingsStore.password}`
                    )
                );
                signed = ecdsaSignDERHex(messageHash, key);
                signature = sha256(Base64Utils.stringToUint8Array(signed));
                break;
            case 'BlueWallet':
                signature = Base64Utils.stringToUint8Array(
                    `lndhub://${settingsStore.username}:${settingsStore.password}`
                );
                break;
        }
        if (!signature) return Promise.reject('Signing failed');

        return Promise.resolve({
            signature
        });
    };

    supportsPeers = () => false;
    supportsMessageSigning = () => false;
    supportsMessageVerification = () => false;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => false;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () =>
        !(
            settingsStore?.lndhubUrl?.includes('lnbank/api/lndhub') ||
            settingsStore?.lndhubUrl?.includes('lntxbot') ||
            // Alby
            settingsStore?.lndhubUrl?.includes('ln.getalby.com') ||
            settingsStore?.lndhubUrl?.includes('getalby.com/lndhub') ||
            // LNBits
            settingsStore?.lndhubUrl?.includes('/lndhub/ext/')
        );
    supportsLightningSends = () => {
        return !(
            settingsStore?.lndhubUrl?.includes('/lndhub/ext/') &&
            settingsStore.username === 'invoice'
        );
    };
    supportsWatchtowerClient = () => false;
    supportsKeysend = () => false;
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
    supportsChannelBatching = () => true;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => false;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsOffers = () => false;
    supportsListingOffers = () => false;
    supportsBolt12Address = () => false;
    supportsCustomFeeLimit = () => false;
    isLNDBased = () => false;
    supportsForwardingHistory = () => false;
    supportInboundFees = () => false;
    supportsDevTools = () => true;
    supportsCashuWallet = () => false;
    supportsSettingInvoiceExpiration = () => false;
    supportsNostrWalletConnectService = () => true;
}
