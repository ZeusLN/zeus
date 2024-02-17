import { createAppContainer } from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';

// Views
import Transaction from './views/Transaction';
import Wallet from './views/Wallet/Wallet';
import Send from './views/Send';
import LnurlPay from './views/LnurlPay/LnurlPay';
import LnurlChannel from './views/LnurlChannel';
import LnurlAuth from './views/LnurlAuth';
import Receive from './views/Receive';
import PaymentRequest from './views/PaymentRequest';
import HandleAnythingQRScanner from './views/handleAnythingQRScanner';
import NodeQRScanner from './views/NodeQRScanner';
import OpenChannel from './views/OpenChannel';
import SendingOnChain from './views/SendingOnChain';
import SendingLightning from './views/SendingLightning';
import Channel from './views/Channels/Channel';
import Payment from './views/Payment';
import PaymentPaths from './views/PaymentPaths';
import Invoice from './views/Invoice';
import Sweep from './views/Sweep';

import SparkQRScanner from './views/SparkQRScanner';
import NodeInfo from './views/NodeInfo';
import NetworkInfo from './views/NetworkInfo';
import Lockscreen from './views/Lockscreen';
import NostrContacts from './views/NostrContacts';
import ContactQR from './views/ContactQR';

// Settings views
import Settings from './views/Settings/Settings';
import NodeConfiguration from './views/Settings/NodeConfiguration';
import Nodes from './views/Settings/Nodes';
import Privacy from './views/Settings/Privacy';
import Security from './views/Settings/Security';
import SetPassword from './views/Settings/SetPassword';
import SetDuressPassword from './views/Settings/SetDuressPassword';
import SetPin from './views/Settings/SetPin';
import SetDuressPin from './views/Settings/SetDuressPin';
import Language from './views/Settings/Language';
import Currency from './views/Settings/Currency';
import SelectCurrency from './views/Settings/SelectCurrency';
import Display from './views/Settings/Display';
import CertInstallInstructions from './views/Settings/CertInstallInstructions';
import SignVerifyMessage from './views/Settings/SignVerifyMessage';
import Support from './views/Settings/Support';
import Help from './views/Settings/Help';
import SocialMedia from './views/Settings/SocialMedia';
import Sponsors from './views/Settings/Sponsors';
import Olympians from './views/Settings/Olympians';
import Gods from './views/Settings/Gods';
import Mortals from './views/Settings/Mortals';
import PointOfSale from './views/Settings/PointOfSale';
import PointOfSaleRecon from './views/Settings/PointOfSaleRecon';
import PointOfSaleReconExport from './views/Settings/PointOfSaleReconExport';
import Categories from './views/POS/Categories';
import ProductCategoryDetails from './views/POS/ProductCategoryDetails';
import Products from './views/POS/Products';
import ProductDetails from './views/POS/ProductDetails';
import PaymentsSettings from './views/Settings/PaymentsSettings';
import InvoicesSettings from './views/Settings/InvoicesSettings';
import LSP from './views/Settings/LSP';
import Bolt12Address from './views/Settings/Bolt12Address';

// Lightning address
import LightningAddress from './views/Settings/LightningAddress';
import LightningAddressInfo from './views/Settings/LightningAddress/LightningAddressInfo';
import LightningAddressSettings from './views/Settings/LightningAddress/LightningAddressSettings';
import Attestation from './views/Settings/LightningAddress/Attestation';
import Attestations from './views/Settings/LightningAddress/Attestations';
import NostrKeys from './views/Settings/LightningAddress/NostrKeys';
import NostrRelays from './views/Settings/LightningAddress/NostrRelays';
import ChangeAddress from './views/Settings/LightningAddress/ChangeAddress';

//Embedded Node
import EmbeddedNode from './views/Settings/EmbeddedNode';
import DisasterRecovery from './views/Settings/EmbeddedNode/DisasterRecovery';
import DisasterRecoveryAdvanced from './views/Settings/EmbeddedNode/DisasterRecoveryAdvanced';
import Pathfinding from './views/Settings/EmbeddedNode/Pathfinding';
import ExpressGraphSync from './views/Settings/EmbeddedNode/ExpressGraphSync';
import LNDLogs from './views/Settings/EmbeddedNode/LNDLogs';
import Peers from './views/Settings/EmbeddedNode/Peers';
import NeutrinoPeers from './views/Settings/EmbeddedNode/Peers/NeutrinoPeers';
import ZeroConfPeers from './views/Settings/EmbeddedNode/Peers/ZeroConfPeers';
import Advanced from './views/Settings/EmbeddedNode/Advanced';

// Routing
import Routing from './views/Routing/Routing';
import RoutingEvent from './views/Routing/RoutingEvent';
import SetFees from './views/Routing/SetFees';

// new views
import Activity from './views/Activity/Activity';
import ActivityFilter from './views/Activity/ActivityFilter';
import CoinControl from './views/UTXOs/CoinControl';
import Utxo from './views/UTXOs/UTXO';
import Accounts from './views/Accounts/Accounts';
import ImportAccount from './views/Accounts/ImportAccount';
import ImportAccountQRScanner from './views/Accounts/ImportAccountQRScanner';
import BumpFee from './views/BumpFee';
import QR from './views/QR';
import AddNotes from './views/AddNotes';
import Contacts from './views/Settings/Contacts';
import AddContact from './views/Settings/AddContact';
import ContactDetails from './views/ContactDetails';
// POS
import Order from './views/Order';

import Intro from './views/Intro';
import IntroSplash from './views/IntroSplash';

import EditFee from './views/EditFee';

// Embedded LND
import Seed from './views/Settings/Seed';
import Sync from './views/Sync';
import LspExplanationFees from './views/Explanations/LspExplanationFees';
import LspExplanationRouting from './views/Explanations/LspExplanationRouting';
import LspExplanationWrappedInvoices from './views/Explanations/LspExplanationWrappedInvoices';
import LspExplanationOverview from './views/Explanations/LspExplanationOverview';

import RawTxHex from './views/RawTxHex';

const AppScenes = {
    Wallet: {
        screen: Wallet
    },
    IntroSplash: {
        screen: IntroSplash
    },
    Intro: {
        screen: Intro
    },
    Lockscreen: {
        screen: Lockscreen
    },
    Accounts: {
        screen: Accounts
    },
    Send: {
        screen: Send
    },
    Sweep: {
        screen: Sweep
    },
    EditFee: {
        screen: EditFee
    },
    Settings: {
        screen: Settings
    },
    NodeConfiguration: {
        screen: NodeConfiguration
    },
    Nodes: {
        screen: Nodes
    },
    Privacy: {
        screen: Privacy
    },
    Security: {
        screen: Security
    },
    SetPassword: {
        screen: SetPassword
    },
    SetDuressPassword: {
        screen: SetDuressPassword
    },
    SetPin: {
        screen: SetPin
    },
    SetDuressPin: {
        screen: SetDuressPin
    },
    Language: {
        screen: Language
    },
    Currency: {
        screen: Currency
    },
    SelectCurrency: {
        screen: SelectCurrency
    },
    Display: {
        screen: Display
    },
    Support: {
        screen: Support
    },
    Help: {
        screen: Help
    },
    Sponsors: {
        screen: Sponsors
    },
    Olympians: {
        screen: Olympians
    },
    Gods: {
        screen: Gods
    },
    Mortals: {
        screen: Mortals
    },
    CertInstallInstructions: {
        screen: CertInstallInstructions
    },
    SignVerifyMessage: {
        screen: SignVerifyMessage
    },
    Transaction: {
        screen: Transaction
    },
    Channel: {
        screen: Channel
    },
    Payment: {
        screen: Payment
    },
    PaymentPaths: {
        screen: PaymentPaths
    },
    Invoice: {
        screen: Invoice
    },
    LnurlPay: {
        screen: LnurlPay
    },
    Receive: {
        screen: Receive
    },
    LnurlChannel: {
        screen: LnurlChannel
    },
    LnurlAuth: {
        screen: LnurlAuth
    },
    PaymentRequest: {
        screen: PaymentRequest
    },
    OpenChannel: {
        screen: OpenChannel
    },
    SendingOnChain: {
        screen: SendingOnChain
    },
    SendingLightning: {
        screen: SendingLightning
    },
    NetworkInfo: {
        screen: NetworkInfo
    },
    NodeInfo: {
        screen: NodeInfo
    },
    Routing: {
        screen: Routing
    },
    RoutingEvent: {
        screen: RoutingEvent
    },
    SetFees: {
        screen: SetFees
    },
    Activity: {
        screen: Activity
    },
    ActivityFilter: {
        screen: ActivityFilter
    },
    CoinControl: {
        screen: CoinControl
    },
    Utxo: {
        screen: Utxo
    },
    ImportAccount: {
        screen: ImportAccount
    },
    HandleAnythingQRScanner: {
        screen: HandleAnythingQRScanner
    },
    NodeQRCodeScanner: {
        screen: NodeQRScanner
    },
    ImportAccountQRScanner: {
        screen: ImportAccountQRScanner
    },
    SparkQRScanner: {
        screen: SparkQRScanner
    },
    Order: {
        screen: Order
    },
    PointOfSaleSettings: {
        screen: PointOfSale
    },
    PointOfSaleRecon: {
        screen: PointOfSaleRecon
    },
    PointOfSaleReconExport: {
        screen: PointOfSaleReconExport
    },
    Categories: {
        screen: Categories
    },
    ProductCategoryDetails: {
        screen: ProductCategoryDetails
    },
    Products: {
        screen: Products
    },
    ProductDetails: {
        screen: ProductDetails
    },
    PaymentsSettings: {
        screen: PaymentsSettings
    },
    InvoicesSettings: {
        screen: InvoicesSettings
    },
    Seed: {
        screen: Seed
    },
    Sync: {
        screen: Sync
    },
    BumpFee: {
        screen: BumpFee
    },
    QR: {
        screen: QR
    },
    AddNotes: {
        screen: AddNotes
    },
    LspExplanationFees: {
        screen: LspExplanationFees
    },
    LspExplanationRouting: {
        screen: LspExplanationRouting
    },
    LspExplanationWrappedInvoices: {
        screen: LspExplanationWrappedInvoices
    },
    LspExplanationOverview: {
        screen: LspExplanationOverview
    },
    EmbeddedNodeSettings: {
        screen: EmbeddedNode
    },
    DisasterRecovery: {
        screen: DisasterRecovery
    },
    DisasterRecoveryAdvanced: {
        screen: DisasterRecoveryAdvanced
    },
    Pathfinding: {
        screen: Pathfinding
    },
    ExpressGraphSync: {
        screen: ExpressGraphSync
    },
    LNDLogs: {
        screen: LNDLogs
    },
    Peers: {
        screen: Peers
    },
    NeutrinoPeers: {
        screen: NeutrinoPeers
    },
    ZeroConfPeers: {
        screen: ZeroConfPeers
    },
    EmbeddedNodeSettingsAdvanced: {
        screen: Advanced
    },
    LSPSettings: {
        screen: LSP
    },
    LightningAddress: {
        screen: LightningAddress
    },
    LightningAddressInfo: {
        screen: LightningAddressInfo
    },
    LightningAddressSettings: {
        screen: LightningAddressSettings
    },
    Attestations: {
        screen: Attestations
    },
    Attestation: {
        screen: Attestation
    },
    Contacts: {
        screen: Contacts
    },
    AddContact: {
        screen: AddContact
    },
    ContactDetails: {
        screen: ContactDetails
    },
    Bolt12Address: {
        screen: Bolt12Address
    },
    NostrKeys: {
        screen: NostrKeys
    },
    NostrRelays: {
        screen: NostrRelays
    },
    ChangeAddress: {
        screen: ChangeAddress
    },
    SocialMedia: {
        screen: SocialMedia
    },
    NostrContacts: {
        screen: NostrContacts
    },
    ContactQR: {
        screen: ContactQR
    },
    RawTxHex: {
        screen: RawTxHex
    }
};

const AppNavigator = createStackNavigator(AppScenes, {
    headerMode: 'none',
    mode: 'modal',
    defaultNavigationOptions: {
        gestureEnabled: false
    }
});

const Navigation = createAppContainer(AppNavigator);

export default Navigation;
