import ChannelsStore from './ChannelsStore';
import InvoicesStore from './InvoicesStore';
import NodeInfoStore from './NodeInfoStore';
import SettingsStore from './SettingsStore';
import TransactionsStore from './TransactionsStore';
import BalanceStore from './BalanceStore';
import UnitsStore from './UnitsStore';
import PaymentsStore from './PaymentsStore';
import FeeStore from './FeeStore';
import LnurlPayStore from './LnurlPayStore';

class Stores {
    public channelsStore: ChannelsStore;
    public invoicesStore: InvoicesStore;
    public nodeInfoStore: NodeInfoStore;
    public settingsStore: SettingsStore;
    public transactionsStore: TransactionsStore;
    public walletStore: BalanceStore;
    public unitsStore: UnitsStore;
    public paymentsStore: PaymentsStore;
    public feeStore: FeeStore;
    public lnurlPayStore: LnurlPayStore;

    constructor() {
        this.settingsStore = new SettingsStore();
        this.channelsStore = new ChannelsStore(this.settingsStore);
        this.invoicesStore = new InvoicesStore(this.settingsStore);
        this.nodeInfoStore = new NodeInfoStore(this.settingsStore);
        this.transactionsStore = new TransactionsStore(this.settingsStore);
        this.walletStore = new BalanceStore(this.settingsStore);
        this.unitsStore = new UnitsStore(this.settingsStore);
        this.paymentsStore = new PaymentsStore(this.settingsStore);
        this.feeStore = new FeeStore();
        this.lnurlPayStore = new LnurlPayStore(this.nodeInfoStore);
    }
}

const stores = new Stores();
export default stores;
