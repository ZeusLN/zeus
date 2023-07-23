import bolt11 from 'bolt11';

import stores from '../stores/Stores';

import LND from './LND';
import LoginRequest from './../models/LoginRequest';
import Base64Utils from './../utils/Base64Utils';
import { Hash as sha256Hash } from 'fast-sha256';
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

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
    payLightningInvoice = (data: any) =>
        this.postRequest('/payinvoice', {
            invoice: data.payment_request,
            amount: data.amt
        });
    lnurlAuth = (message: string) => {
        const messageHash = new sha256Hash()
            .update(Base64Utils.stringToUint8Array(message))
            .digest();

        let signed, signature, key, linkingKeyPair;
        switch (stores.settingsStore.settings.lndHubLnAuthMode || 'Alby') {
            case 'Alby':
                key = new sha256Hash()
                    .update(
                        Base64Utils.stringToUint8Array(
                            `lndhub://${stores.settingsStore.username}:${stores.settingsStore.password}`
                        )
                    )
                    .digest();
                linkingKeyPair = ec.keyFromPrivate(key, true);
                signed = linkingKeyPair
                    .sign(messageHash, { canonical: true })
                    .toDER('hex');
                signature = new sha256Hash()
                    .update(Base64Utils.stringToUint8Array(signed))
                    .digest();
                break;
            case 'BlueWallet':
                signature = Base64Utils.stringToUint8Array(
                    `lndhub://${stores.settingsStore.username}:${stores.settingsStore.password}`
                );
                break;
        }
        if (!signature) return Promise.reject('Signing failed');

        return Promise.resolve({
            signature
        });
    };

    supportsMessageSigning = () => false;
    supportsLnurlAuth = () => true;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () =>
        !(
            stores.settingsStore.lndhubUrl.includes('lnbank/api/lndhub') ||
            stores.settingsStore.lndhubUrl.includes('lntxbot') ||
            // LNBits
            stores.settingsStore.lndhubUrl.includes('/lndhub/ext/')
        );
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
    supportsPendingChannels = () => false;
    supportsMPP = () => false;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => false;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsTaproot = () => false;
    supportsBumpFee = () => false;
    supportsLSPs = () => false;
    supportsNetworkInfo = () => false;
    isLNDBased = () => false;
}
