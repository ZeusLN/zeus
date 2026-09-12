import { settingsStore } from '../stores/Stores';

import LND from './LND';
import LoginRequest from './../models/LoginRequest';
import Base64Utils from './../utils/Base64Utils';
import Bolt11Utils from './../utils/Bolt11Utils';
import Invoice from './../models/Invoice';
import { localeString } from './../utils/LocaleUtils';
import { Hash as sha256Hash } from 'fast-sha256';
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
    // Overrides LND's /v1/invoice/{r_hash}, a route LndHub does not serve.
    // LndHub has no per-invoice endpoint returning details — /checkpayment only
    // answers paid/unpaid — so the user's invoice list is searched by hash.
    lookupInvoice = (data: any) =>
        this.getRequest('/getuserinvoices').then((invoices: any) => {
            const invoice = (invoices || []).find(
                (userInvoice: any) =>
                    new Invoice(userInvoice).getRHash === data.r_hash
            );
            if (!invoice) {
                throw new Error(
                    localeString(
                        'stores.NostrWalletConnectStore.error.invoiceNotFound'
                    )
                );
            }
            return invoice;
        });

    // Scans the user's invoice list since LndHub has no per-invoice
    // endpoint returning amount details. rHash arrives in whatever format
    // getFormattedRhash produced when the invoice was created
    watchInvoicePaid = (
        { rHash, value }: { rHash: string; value?: string | number },
        onPaid: (payload: {
            amountSat: number;
            tx?: string;
            preimage?: string;
        }) => void
    ): (() => void) => {
        const interval = setInterval(() => {
            this.getInvoices()
                .then((response: any) => {
                    const invoices = response.invoices;
                    for (let i = 0; i < invoices.length; i++) {
                        const result = new Invoice(invoices[i]);
                        if (
                            result.getFormattedRhash === rHash &&
                            result.ispaid &&
                            Number(result.amt) >= Number(value) &&
                            Number(result.amt) !== 0
                        ) {
                            clearInterval(interval);
                            onPaid({
                                amountSat: Number(result.amt),
                                tx: result.payment_request,
                                preimage: result.r_preimage
                            });
                            break;
                        }
                    }
                })
                .catch(() => {
                    // node unreachable; retry on the next tick
                });
        }, 5000);
        return () => clearInterval(interval);
    };
    // Block the inherited LND REST transaction poller; LndHub has no
    // onchain receive support
    watchOnchainReceived = () => () => {};

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
    // LndHub servers (LNbits included) block on /payinvoice until the
    // payment resolves, which on slow routes exceeds the inherited 30s
    // restReq default; that surfaced as premature "Request timeout"
    // failures for payments that later settled (#2761). Unlike LND
    // (timeout_seconds) and CLN (retry_for), the LndHub protocol has no
    // server-side payment deadline at all, so this window is purely
    // client-imposed: the server may well still be paying after we stop
    // listening, which is exactly why the raced payment-timed-out shape
    // (rather than a retryable-looking transport error) matters here.
    // Zeus's payment timeout setting is neither plumbed to this backend
    // nor exposed in the UI for it, so the window is a fixed 60s.
    payLightningInvoice = (data: any) => {
        const timeoutSeconds = 60;

        const forcedTimeout = async (time_ms: number, response: any) => {
            await new Promise((res) => setTimeout(res, time_ms));
            return response;
        };

        return Promise.race([
            forcedTimeout((timeoutSeconds + 1) * 1000, {
                payment_error: localeString(
                    'views.SendingLightning.paymentTimedOut'
                )
            }),
            this.postRequest(
                '/payinvoice',
                {
                    invoice: data.payment_request,
                    amount: data.amt
                },
                (timeoutSeconds + 5) * 1000
            )
        ]);
    };
    lnurlAuth = (message: string) => {
        const messageHash = new sha256Hash()
            .update(Base64Utils.stringToUint8Array(message))
            .digest();

        let signed, signature, key;
        switch (settingsStore.settings.lndHubLnAuthMode || 'Alby') {
            case 'Alby':
                key = new sha256Hash()
                    .update(
                        Base64Utils.stringToUint8Array(
                            `lndhub://${settingsStore.username}:${settingsStore.password}`
                        )
                    )
                    .digest();
                signed = ecdsaSignDERHex(messageHash, key);
                signature = new sha256Hash()
                    .update(Base64Utils.stringToUint8Array(signed))
                    .digest();
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
    // /gettxs takes no filters and only returns settled payments, so the
    // inherited LND flag must not leak through.
    supportsPaymentsCreationDateFilter = () => false;
}
