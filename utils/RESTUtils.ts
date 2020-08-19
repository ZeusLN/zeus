import stores from '../stores/Stores';
import CLightningREST from '../backends/CLightningREST';
import Spark from '../backends/Spark';
import LND from '../backends/LND';
import LndHub from '../backends/LndHub';
import Eclair from '../backends/Eclair';

import LND from '../backends/LND';
import CLightningREST from '../backends/CLightningREST';
import LndHub from '../backends/LndHub';
import Spark from '../backends/Spark';
import Eclair from '../backends/Eclair';

class RESTUtils {
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

    call = (funcName, args) => {
        const cls = this.getClass();
        return cls[funcName].apply(cls, args);
    };

    getTransactions = (...args) => this.call('getTransactions', args);
    getChannels = (...args) => this.call('getChannels', args);
    getBlockchainBalance = (...args) => this.call('getBlockchainBalance', args);
    getLightningBalance = (...args) => this.call('getLightningBalance', args);
    sendCoins = (...args) => this.call('sendCoins', args);
    getMyNodeInfo = (...args) => this.call('getMyNodeInfo', args);
    getInvoices = (...args) => this.call('getInvoices', args);
    createInvoice = (...args) => this.call('createInvoice', args);
    getPayments = (...args) => this.call('getPayments', args);
    getNewAddress = (...args) => this.call('getNewAddress', args);
    openChannel = (...args) => this.call('openChannel', args);
    connectPeer = (...args) => this.call('connectPeer', args);
    listNode = (...args) => this.call('listNode', args);
    decodePaymentRequest = (...args) => this.call('decodePaymentRequest', args);
    payLightningInvoice = (...args) => this.call('payLightningInvoice', args);
    payLightningInvoiceV2 = (...args) =>
        this.call('payLightningInvoiceV2', args);
    closeChannel = (...args) => this.call('closeChannel', args);
    getNodeInfo = (...args) => this.call('getNodeInfo', args);
    getFees = (...args) => this.call('getFees', args);
    setFees = (...args) => this.call('setFees', args);
    getRoutes = (...args) => this.call('getRoutes', args);
    getForwardingHistory = (...args) => this.call('getForwardingHistory', args);
    // lndhub
    createAccount = (...args) => this.call('createAccount', args);
    login = (...args) => this.call('login', args);

    supportsOnchainSends = () => this.call('supportsOnchainSends');
    supportsKeysend = () => this.call('supportsKeysend');
    supportsChannelManagement = () => this.call('supportsChannelManagement');
    // let users specify http/https
    supportsCustomHostProtocol = () => this.call('supportsCustomHostProtocol');
    supportsMPP = () => this.call('supportsMPP');
}

const restUtils = new RESTUtils();
export default restUtils;
