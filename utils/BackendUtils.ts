import { settingsStore } from '../stores/storeInstances';
// LND
import LND from '../backends/LND';
import LightningNodeConnect from '../backends/LightningNodeConnect';
import EmbeddedLND from '../backends/EmbeddedLND';
// Core Lightning
import CLNRest from '../backends/CLNRest';
// Custodial
import LndHub from '../backends/LndHub';
import NostrWalletConnect from '../backends/NostrWalletConnect';

class BackendUtils {
    lnd: LND;
    lightningNodeConnect: LightningNodeConnect;
    embeddedLND: EmbeddedLND;
    clnRest: CLNRest;
    lndHub: LndHub;
    nostrWalletConnect: NostrWalletConnect;
    constructor() {
        this.lnd = new LND();
        this.lightningNodeConnect = new LightningNodeConnect();
        this.embeddedLND = new EmbeddedLND();
        this.clnRest = new CLNRest();
        this.lndHub = new LndHub();
        this.nostrWalletConnect = new NostrWalletConnect();
    }

    getClass = () => {
        const { implementation } = settingsStore;
        switch (implementation) {
            case 'lnd':
                return this.lnd;
            case 'lightning-node-connect':
                return this.lightningNodeConnect;
            case 'embedded-lnd':
                return this.embeddedLND;
            case 'cln-rest':
                return this.clnRest;
            case 'lndhub':
                return this.lndHub;
            case 'nostr-wallet-connect':
                return this.nostrWalletConnect;
            default:
                return this.lnd;
        }
    };

    call = (funcName: string, args?: any) => {
        const cls: any = this.getClass();
        // return false if function is not defined in backend, as a fallback
        return cls[funcName] ? cls[funcName].apply(cls, args) : false;
    };

    getTransactions = (...args: any[]) => this.call('getTransactions', args);
    getChannels = (...args: any[]) => this.call('getChannels', args);
    getPendingChannels = (...args: any[]) =>
        this.call('getPendingChannels', args);
    getClosedChannels = (...args: any[]) =>
        this.call('getClosedChannels', args);
    getChannelInfo = (...args: any[]) => this.call('getChannelInfo', args);
    getBlockchainBalance = (...args: any[]) =>
        this.call('getBlockchainBalance', args);
    getLightningBalance = (...args: any[]) =>
        this.call('getLightningBalance', args);
    sendCoins = (...args: any[]) => this.call('sendCoins', args);
    sendCustomMessage = (...args: any[]) =>
        this.call('sendCustomMessage', args);
    subscribeCustomMessages = (...args: any[]) =>
        this.call('subscribeCustomMessages', args);
    getMyNodeInfo = (...args: any[]) => this.call('getMyNodeInfo', args);
    getNetworkInfo = (...args: any[]) => this.call('getNetworkInfo', args);
    getRecoveryInfo = (...args: any[]) => this.call('getRecoveryInfo', args);
    getInvoices = (...args: any[]) => this.call('getInvoices', args);
    createInvoice = (...args: any[]) => this.call('createInvoice', args);
    getPayments = (...args: any[]) => this.call('getPayments', args);
    getNewAddress = (...args: any[]) => this.call('getNewAddress', args);
    getNewChangeAddress = (...args: any[]) =>
        this.call('getNewChangeAddress', args);
    openChannelSync = (...args: any[]) => this.call('openChannelSync', args);
    openChannelStream = (...args: any[]) =>
        this.call('openChannelStream', args);
    connectPeer = (...args: any[]) => this.call('connectPeer', args);
    decodePaymentRequest = (...args: any[]) =>
        this.call('decodePaymentRequest', args);
    payLightningInvoice = (...args: any[]) =>
        this.call('payLightningInvoice', args);
    payLightningInvoiceStreaming = (...args: any[]) =>
        this.call('payLightningInvoiceStreaming', args);
    sendKeysend = (...args: any[]) => this.call('sendKeysend', args);
    closeChannel = (...args: any[]) => this.call('closeChannel', args);
    getNodeInfo = (...args: any[]) => this.call('getNodeInfo', args);
    getFees = (...args: any[]) => this.call('getFees', args);
    setFees = (...args: any[]) => this.call('setFees', args);
    getRoutes = (...args: any[]) => this.call('getRoutes', args);
    getForwardingHistory = (...args: any[]) =>
        this.call('getForwardingHistory', args);
    getUTXOs = (...args: any[]) => this.call('getUTXOs', args);
    listAccounts = (...args: any[]) => this.call('listAccounts', args);
    importAccount = (...args: any[]) => this.call('importAccount', args);
    listAddresses = (...args: any[]) => this.call('listAddresses', args);
    signMessage = (...args: any[]) => this.call('signMessage', args);
    verifyMessage = (...args: any[]) => this.call('verifyMessage', args);
    signMessageWithAddr = (...args: any[]) =>
        this.call('signMessageWithAddr', args);
    verifyMessageWithAddr = (...args: any[]) =>
        this.call('verifyMessageWithAddr', args);
    lnurlAuth = (...args: any[]) => this.call('lnurlAuth', args);

    fundPsbt = (...args: any[]) => this.call('fundPsbt', args);
    signPsbt = (...args: any[]) => this.call('signPsbt', args);
    finalizePsbt = (...args: any[]) => this.call('finalizePsbt', args);
    publishTransaction = (...args: any[]) =>
        this.call('publishTransaction', args);
    fundingStateStep = (...args: any[]) => this.call('fundingStateStep', args);
    bumpFee = (...args: any[]) => this.call('bumpFee', args);
    bumpForceCloseFee = (...args: any[]) =>
        this.call('bumpForceCloseFee', args);
    lookupInvoice = (...args: any[]) => this.call('lookupInvoice', args);
    subscribeInvoice = (...args: any[]) => this.call('subscribeInvoice', args);
    subscribeInvoices = (...args: any[]) =>
        this.call('subscribeInvoices', args);
    subscribeTransactions = (...args: any[]) =>
        this.call('subscribeTransactions', args);
    initChanAcceptor = (...args: any[]) => this.call('initChanAcceptor', args);
    rescan = (...args: any[]) => this.call('rescan', args);

    // BOLT 12 / Offers
    listOffers = (...args: any[]) => this.call('listOffers', args);
    createOffer = (...args: any[]) => this.call('createOffer', args);
    disableOffer = (...args: any[]) => this.call('disableOffer', args);
    fetchInvoiceFromOffer = (...args: any[]) =>
        this.call('fetchInvoiceFromOffer', args);

    // lndhub
    login = (...args: any[]) => this.call('login', args);

    // services
    supportsFlowLSP = () => this.call('supportsFlowLSP');
    supportsLSPScustomMessage = () => this.call('supportsLSPScustomMessage');
    supportsLSPS1rest = () => this.call('supportsLSPS1rest');

    supportsMessageSigning = () => this.call('supportsMessageSigning');
    supportsLnurlAuth = () => this.call('supportsLnurlAuth');
    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsOnchainReceiving = () => this.call('supportsOnchainReceiving');
    supportsLightningSends = () => this.call('supportsLightningSends');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    supportsPendingChannels = () => this.call('supportsPendingChannels');
    supportsMPP = () => this.call('supportsMPP');
    supportsAMP = () => this.call('supportsAMP');
    supportsCoinControl = () => this.call('supportsCoinControl');
    supportsChannelCoinControl = () => this.call('supportsChannelCoinControl');
    supportsHopPicking = () => this.call('supportsHopPicking');
    supportsAccounts = () => this.call('supportsAccounts');
    supportsRouting = () => this.call('supportsRouting');
    supportsNodeInfo = () => this.call('supportsNodeInfo');
    singleFeesEarnedTotal = () => this.call('singleFeesEarnedTotal');
    supportsAddressTypeSelection = () =>
        this.call('supportsAddressTypeSelection');
    supportsTaproot = () => this.call('supportsTaproot');
    supportsBumpFee = () => this.call('supportsBumpFee');
    supportsNetworkInfo = () => this.call('supportsNetworkInfo');
    supportsSimpleTaprootChannels = () =>
        this.call('supportsSimpleTaprootChannels');
    supportsCustomPreimages = () => this.call('supportsCustomPreimages');
    supportsSweep = () => this.call('supportsSweep');
    supportsOnchainSendMax = () => this.call('supportsOnchainSendMax');
    supportsOnchainBatching = () => this.call('supportsOnchainBatching');
    supportsChannelBatching = () => this.call('supportsChannelBatching');
    supportsChannelFundMax = () => this.call('supportsChannelFundMax');
    supportsOffers = () => this.call('supportsOffers');
    supportsBolt11BlindedRoutes = () =>
        this.call('supportsBolt11BlindedRoutes');
    supportsAddressesWithDerivationPaths = () =>
        this.call('supportsAddressesWithDerivationPaths');
    isLNDBased = () => this.call('isLNDBased');
    supportInboundFees = () => this.call('supportInboundFees');
    supportsAddressMessageSigning = () =>
        this.call('supportsAddressMessageSigning');
    supportsDevTools = () => {
        return this.isLNDBased() || this.call('supportsDevTools');
    };
    supportsCashuWallet = () => this.call('supportsCashuWallet');

    // LNC
    initLNC = (...args: any[]) => this.call('initLNC', args);
    connect = (...args: any[]) => this.call('connect', args);
    checkPerms = () => this.call('checkPerms');
    isConnected = (...args: any[]) => this.call('isConnected', args);
    disconnect = (...args: any[]) => this.call('disconnect', args);

    // NWC
    initNWC = (...args: any[]) => this.call('initNWC', args);

    clearCachedCalls = (...args: any[]) => this.call('clearCachedCalls', args);
}

const backendUtils = new BackendUtils();
export default backendUtils;
