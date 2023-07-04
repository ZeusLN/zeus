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

import SparkQRScanner from './views/SparkQRScanner';
import NodeInfo from './views/NodeInfo';
import Lockscreen from './views/Lockscreen';

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
import About from './views/Settings/About';
import Help from './views/Settings/Help';
import Sponsors from './views/Settings/Sponsors';
import Olympians from './views/Settings/Olympians';
import Gods from './views/Settings/Gods';
import Mortals from './views/Settings/Mortals';
import PointOfSale from './views/Settings/PointOfSale';
import PointOfSaleRecon from './views/Settings/PointOfSaleRecon';
import PointOfSaleReconExport from './views/Settings/PointOfSaleReconExport';
import PaymentsSettings from './views/Settings/PaymentsSettings';
import InvoicesSettings from './views/Settings/InvoicesSettings';

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
import ContactsSettings from './views/Settings/ContactsSettings';
import AddContacts from './views/Settings/AddContacts';
import ContactDetails from './views/ContactDetails';
// POS
import Order from './views/Order';

import Intro from './views/Intro';
import IntroSplash from './views/IntroSplash';

import EditFee from './views/EditFee';

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
    About: {
        screen: About
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
    PaymentsSettings: {
        screen: PaymentsSettings
    },
    InvoicesSettings: {
        screen: InvoicesSettings
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
    ContactsSettings: {
        screen: ContactsSettings
    },
    AddContacts: {
        screen: AddContacts
    },
    ContactDetails: {
        screen: ContactDetails
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
