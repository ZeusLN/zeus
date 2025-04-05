import AlertStore from './AlertStore';
import CashuStore from './CashuStore';
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
import NotesStore from './NotesStore';
import ContactStore from './ContactStore';
import SyncStore from './SyncStore';
import LSPStore from './LSPStore';
import LightningAddressStore from './LightningAddressStore';
import ChannelBackupStore from './ChannelBackupStore';
import InventoryStore from './InventoryStore';
import OffersStore from './OffersStore';

class Stores {
    public alertStore: AlertStore;
    public cashuStore: CashuStore;
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
    public notesStore: NotesStore;
    public contactStore: ContactStore;
    public syncStore: SyncStore;
    public lspStore: LSPStore;
    public lightningAddressStore: LightningAddressStore;
    public channelBackupStore: ChannelBackupStore;
    public inventoryStore: InventoryStore;
    public offersStore: OffersStore;

    constructor() {
        this.settingsStore = new SettingsStore();
        this.modalStore = new ModalStore();
        this.offersStore = new OffersStore();
        this.fiatStore = new FiatStore(this.settingsStore);
        this.channelsStore = new ChannelsStore(this.settingsStore);
        this.nodeInfoStore = new NodeInfoStore(
            this.channelsStore,
            this.settingsStore
        );
        this.alertStore = new AlertStore(
            this.settingsStore,
            this.nodeInfoStore
        );
        this.lspStore = new LSPStore(
            this.settingsStore,
            this.channelsStore,
            this.nodeInfoStore
        );
        this.channelBackupStore = new ChannelBackupStore(
            this.nodeInfoStore,
            this.settingsStore
        );
        this.invoicesStore = new InvoicesStore(
            this.settingsStore,
            this.lspStore,
            this.channelsStore,
            this.nodeInfoStore
        );
        this.transactionsStore = new TransactionsStore(
            this.settingsStore,
            this.nodeInfoStore,
            this.channelsStore
        );
        this.balanceStore = new BalanceStore(this.settingsStore);
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
        this.notesStore = new NotesStore();
        this.contactStore = new ContactStore();
        this.syncStore = new SyncStore(this.settingsStore);
        this.cashuStore = new CashuStore(
            this.settingsStore,
            this.invoicesStore
        );
        this.activityStore = new ActivityStore(
            this.settingsStore,
            this.paymentsStore,
            this.invoicesStore,
            this.transactionsStore,
            this.cashuStore
        );
        this.lightningAddressStore = new LightningAddressStore(
            this.cashuStore,
            this.nodeInfoStore,
            this.settingsStore
        );
        this.posStore = new PosStore(this.settingsStore, this.fiatStore);
        this.inventoryStore = new InventoryStore();
    }
}

const stores = new Stores();
export default stores;
