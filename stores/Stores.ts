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
import FiatStore from './FiatStore';
import UTXOsStore from './UTXOsStore';
import MessageSignStore from './MessageSignStore';
import ActivityStore from './ActivityStore';
import PosStore from './PosStore';
import ModalStore from './ModalStore';

class Stores {
    public channelsStore: ChannelsStore;
    public invoicesStore: InvoicesStore;
    public nodeInfoStore: NodeInfoStore;
    public settingsStore: SettingsStore;
    public fiatStore: FiatStore;
    public transactionsStore: TransactionsStore;
    public balanceStore: BalanceStore;
    public unitsStore: UnitsStore;
    public paymentsStore: PaymentsStore;
    public feeStore: FeeStore;
    public lnurlPayStore: LnurlPayStore;
    public utxosStore: UTXOsStore;
    public messageSignStore: MessageSignStore;
    public activityStore: ActivityStore;
    public posStore: PosStore;
    public modalStore: ModalStore;

    constructor() {
        this.settingsStore = new SettingsStore();
        this.modalStore = new ModalStore();
        this.fiatStore = new FiatStore(this.settingsStore);
        this.channelsStore = new ChannelsStore(this.settingsStore);
        this.invoicesStore = new InvoicesStore(this.settingsStore);
        this.nodeInfoStore = new NodeInfoStore(this.settingsStore);
        this.transactionsStore = new TransactionsStore(this.settingsStore);
        this.balanceStore = new BalanceStore(this.settingsStore);
        this.nodeInfoStore = new NodeInfoStore(this.settingsStore);
        this.unitsStore = new UnitsStore(this.settingsStore, this.fiatStore);
        this.paymentsStore = new PaymentsStore(
            this.settingsStore,
            this.channelsStore
        );
        this.lnurlPayStore = new LnurlPayStore(
            this.settingsStore,
            this.nodeInfoStore
        );
        this.feeStore = new FeeStore(this.settingsStore, this.nodeInfoStore);
        this.utxosStore = new UTXOsStore(this.settingsStore);
        this.messageSignStore = new MessageSignStore();
        this.activityStore = new ActivityStore(
            this.settingsStore,
            this.paymentsStore,
            this.invoicesStore,
            this.transactionsStore
        );
        this.posStore = new PosStore(this.settingsStore);
    }
}

const stores = new Stores();
export default stores;
