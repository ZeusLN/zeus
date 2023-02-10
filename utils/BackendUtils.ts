import stores from '../stores/Stores';
// LND
import LND from '../backends/LND';
import LightningNodeConnect from '../backends/LightningNodeConnect';
// Core Lightning
import CLightningREST from '../backends/CLightningREST';
import Spark from '../backends/Spark';
// Eclair
import Eclair from '../backends/Eclair';
// Custodial
import LndHub from '../backends/LndHub';

class BackendUtils {
    lnd: LND;
    lightningNodeConnect: LightningNodeConnect;
    clightningREST: CLightningREST;
    spark: Spark;
    eclair: Eclair;
    lndHub: LndHub;
    constructor() {
        this.lnd = new LND();
        this.lightningNodeConnect = new LightningNodeConnect();
        this.clightningREST = new CLightningREST();
        this.spark = new Spark();
        this.eclair = new Eclair();
        this.lndHub = new LndHub();
    }

    getClass = () => {
        const { implementation } = stores.settingsStore;
        switch (implementation) {
            case 'lnd':
                return this.lnd;
            case 'lightning-node-connect':
                return this.lightningNodeConnect;
            case 'c-lightning-REST':
                return this.clightningREST;
            case 'spark':
                return this.spark;
            case 'eclair':
                return this.eclair;
            case 'lndhub':
                return this.lndHub;
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
    getMyNodeInfo = (...args: any[]) => this.call('getMyNodeInfo', args);
    getInvoices = (...args: any[]) => this.call('getInvoices', args);
    createInvoice = (...args: any[]) => this.call('createInvoice', args);
    getPayments = (...args: any[]) => this.call('getPayments', args);
    getNewAddress = (...args: any[]) => this.call('getNewAddress', args);
    openChannel = (...args: any[]) => this.call('openChannel', args);
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
    signMessage = (...args: any[]) => this.call('signMessage', args);
    verifyMessage = (...args: any[]) => this.call('verifyMessage', args);

    fundPsbt = (...args: any[]) => this.call('fundPsbt', args);
    finalizePsbt = (...args: any[]) => this.call('finalizePsbt', args);
    publishTransaction = (...args: any[]) =>
        this.call('publishTransaction', args);
    bumpFee = (...args: any[]) => this.call('bumpFee', args);
    subscribeInvoice = (...args: any[]) => this.call('subscribeInvoice', args);
    subscribeInvoices = (...args: any[]) =>
        this.call('subscribeInvoices', args);
    subscribeTransactions = (...args: any[]) =>
        this.call('subscribeTransactions', args);

    // lndhub
    login = (...args: any[]) => this.call('login', args);

    supportsMessageSigning = () => this.call('supportsMessageSigning');
    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsOnchainReceiving = () => this.call('supportsOnchainReceiving');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    supportsPendingChannels = () => this.call('supportsPendingChannels');
    supportsMPP = () => this.call('supportsMPP');
    supportsAMP = () => this.call('supportsAMP');
    supportsCoinControl = () => this.call('supportsCoinControl');
    supportsHopPicking = () => this.call('supportsHopPicking');
    supportsAccounts = () => this.call('supportsAccounts');
    supportsRouting = () => this.call('supportsRouting');
    supportsNodeInfo = () => this.call('supportsNodeInfo');
    singleFeesEarnedTotal = () => this.call('singleFeesEarnedTotal');
    supportsAddressTypeSelection = () =>
        this.call('supportsAddressTypeSelection');
    supportsTaproot = () => this.call('supportsTaproot');
    isLNDBased = () => this.call('isLNDBased');

    // LNC
    initLNC = (...args: any[]) => this.call('initLNC', args);
    connect = (...args: any[]) => this.call('connect', args);
    isConnected = (...args: any[]) => this.call('isConnected', args);
    disconnect = (...args: any[]) => this.call('disconnect', args);
}

const backendUtils = new BackendUtils();
export default backendUtils;
