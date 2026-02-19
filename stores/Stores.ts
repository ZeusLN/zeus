import ActivityStore from './ActivityStore';
import AlertStore from './AlertStore';
import BalanceStore from './BalanceStore';
import CashuStore from './CashuStore';
import ChannelBackupStore from './ChannelBackupStore';
import ChannelsStore from './ChannelsStore';
import ContactStore from './ContactStore';
import FeeStore from './FeeStore';
import FiatStore from './FiatStore';
import InventoryStore from './InventoryStore';
import InvoicesStore from './InvoicesStore';
import LightningAddressStore from './LightningAddressStore';
import LnurlPayStore from './LnurlPayStore';
import LSPStore from './LSPStore';
import MessageSignStore from './MessageSignStore';
import ModalStore from './ModalStore';
import NodeInfoStore from './NodeInfoStore';
import NotesStore from './NotesStore';
import OffersStore from './OffersStore';
import PaymentsStore from './PaymentsStore';
import PosStore from './PosStore';
import SettingsStore from './SettingsStore';
import SwapStore from './SwapStore';
import SyncStore from './SyncStore';
import TransactionsStore from './TransactionsStore';
import UnitsStore from './UnitsStore';
import UTXOsStore from './UTXOsStore';
import SweepStore from './SweepStore';
import NostrWalletConnectStore from './NostrWalletConnectStore';

export const settingsStore = new SettingsStore();
export const modalStore = new ModalStore();
export const offersStore = new OffersStore();
export const fiatStore = new FiatStore(settingsStore);
export const channelsStore = new ChannelsStore(settingsStore);
export const nodeInfoStore = new NodeInfoStore(channelsStore, settingsStore);
export const alertStore = new AlertStore(settingsStore, nodeInfoStore);
export const lspStore = new LSPStore(
    settingsStore,
    channelsStore,
    nodeInfoStore
);
export const channelBackupStore = new ChannelBackupStore(
    nodeInfoStore,
    settingsStore
);
export const invoicesStore = new InvoicesStore(
    settingsStore,
    lspStore,
    channelsStore,
    nodeInfoStore
);
export const balanceStore = new BalanceStore(settingsStore);
export const transactionsStore = new TransactionsStore(
    settingsStore,
    nodeInfoStore,
    channelsStore,
    balanceStore
);
export const unitsStore = new UnitsStore(settingsStore, fiatStore);
export const paymentsStore = new PaymentsStore(settingsStore, channelsStore);
export const lnurlPayStore = new LnurlPayStore(settingsStore, nodeInfoStore);
export const feeStore = new FeeStore(settingsStore, nodeInfoStore);
export const syncStore = new SyncStore(settingsStore);
export const utxosStore = new UTXOsStore(settingsStore, syncStore);
export const messageSignStore = new MessageSignStore();
export const notesStore = new NotesStore();
export const contactStore = new ContactStore();
export const cashuStore = new CashuStore(
    settingsStore,
    invoicesStore,
    channelsStore,
    modalStore
);
export const swapStore = new SwapStore(nodeInfoStore, settingsStore);
export const activityStore = new ActivityStore(
    settingsStore,
    paymentsStore,
    invoicesStore,
    transactionsStore,
    cashuStore,
    swapStore,
    nodeInfoStore
);
export const lightningAddressStore = new LightningAddressStore(
    cashuStore,
    nodeInfoStore,
    settingsStore
);
export const posStore = new PosStore(settingsStore, fiatStore, unitsStore);
export const inventoryStore = new InventoryStore();
export const sweepStore = new SweepStore(nodeInfoStore);
export const nostrWalletConnectStore = new NostrWalletConnectStore(
    settingsStore,
    balanceStore,
    nodeInfoStore,
    transactionsStore,
    cashuStore,
    invoicesStore,
    messageSignStore,
    lightningAddressStore,
    modalStore,
    paymentsStore
);
