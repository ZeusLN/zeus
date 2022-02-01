import stores from '../stores/Stores';
import LND from '../backends/LND';
import CLightningREST from '../backends/CLightningREST';
import LndHub from '../backends/LndHub';
import Spark from '../backends/Spark';
import Eclair from '../backends/Eclair';

class RESTUtils {
    spark: Spark;
    clightningREST: CLightningREST;
    lndHub: LndHub;
    lnd: LND;
    eclair: Eclair;
    constructor() {
        this.spark = new Spark();
        this.clightningREST = new CLightningREST();
        this.lndHub = new LndHub();
        this.lnd = new LND();
        this.eclair = new Eclair();
    }

    getClass = () => {
        const { implementation } = stores.settingsStore;
        switch (implementation) {
            case 'lnd':
                return this.lnd;
            case 'spark':
                return this.spark;
            case 'lndhub':
                return this.lndHub;
            case 'eclair':
                return this.eclair;
            case 'c-lightning-REST':
                return this.clightningREST;
            default:
                return this.lnd;
        }
    };

    call = (funcName: string, args?: any) => {
        const cls: any = this.getClass();
        return cls[funcName].apply(cls, args);
    };

    getTransactions = (...args: any[]) => this.call('getTransactions', args);
    getChannels = (...args: any[]) => this.call('getChannels', args);
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
    listNode = (...args: any[]) => this.call('listNode', args);
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

    // lndhub
    createAccount = (...args: any[]) => this.call('createAccount', args);
    login = (...args: any[]) => this.call('login', args);

    supportsMessageSigning = () => this.call('supportsMessageSigning');
    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    supportsMPP = () => this.call('supportsMPP');
    supportsAMP = () => this.call('supportsAMP');
    supportsCoinControl = () => this.call('supportsCoinControl');
    supportsHopPicking = () => this.call('supportsHopPicking');
    supportsAccounts = () => this.call('supportsAccounts');
    supportsRouting = () => this.call('supportsRouting');
    supportsNodeInfo = () => this.call('supportsNodeInfo');
    singleFeesEarnedTotal = () => this.call('singleFeesEarnedTotal');
}

const restUtils = new RESTUtils();
export default restUtils;
