import bolt11 from 'bolt11';

import stores from '../stores/Stores';

import LND from './LND';
import LoginRequest from './../models/LoginRequest';

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
        this.getRequest('/getuserinvoices?limit=200').then((data: any) => ({
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

    supportsMessageSigning = () => false;
    supportsOnchainSends = () => false;
    supportsOnchainReceiving = () =>
        !(
            stores.settingsStore.lndhubUrl.includes('lnbank/api/lndhub') ||
            stores.settingsStore.lndhubUrl.includes('lntxbot')
        );
    supportsKeysend = () => false;
    supportsChannelManagement = () => false;
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
    isLNDBased = () => false;
}
