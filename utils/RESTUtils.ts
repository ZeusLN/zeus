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
    connectPeer = (...args: any[]) => this.call('connectPeer', args);
    listNode = (...args: any[]) => this.call('listNode', args);
    decodePaymentRequest = (...args: any[]) =>
        this.call('decodePaymentRequest', args);
    payLightningInvoice = (...args: any[]) =>
        this.call('payLightningInvoice', args);
    payLightningInvoiceV2 = (...args: any[]) =>
        this.call('payLightningInvoiceV2', args);
    closeChannel = (...args: any[]) => this.call('closeChannel', args);
    getNodeInfo = (...args: any[]) => this.call('getNodeInfo', args);
    getFees = (...args: any[]) => this.call('getFees', args);
    setFees = (...args: any[]) => this.call('setFees', args);
    getRoutes = (...args: any[]) => this.call('getRoutes', args);
    getForwardingHistory = (...args: any[]) =>
        this.call('getForwardingHistory', args);
    getUTXOs = (...args: any[]) => this.call('getUTXOs', args);
    // lndhub
    createAccount = (...args: any[]) => this.call('createAccount', args);
    login = (...args: any[]) => this.call('login', args);

    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    // let users specify http/https
    supportsCustomHostProtocol = () => this.call('supportsCustomHostProtocol');
    supportsMPP = () => this.call('supportsMPP');
    supportsCoinControl = () => this.call('supportsCoinControl');
}

const restUtils = new RESTUtils();
export default restUtils;
