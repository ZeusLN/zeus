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
import AddressQRScanner from './views/AddressQRScanner';
import NodeQRScanner from './views/NodeQRScanner';
import OpenChannel from './views/OpenChannel';
import SendingOnChain from './views/SendingOnChain';
import SendingLightning from './views/SendingLightning';
import Channel from './views/Channels/Channel';
import Payment from './views/Payment';
import Invoice from './views/Invoice';
import BTCPayConfigQRScanner from './views/BTCPayConfigQRScanner';
import LNDConnectConfigQRScanner from './views/LNDConnectConfigQRScanner';
import LNDHubQRScanner from './views/LNDHubQRScanner';
import NodeInfo from './views/NodeInfo';
import Lockscreen from './views/Lockscreen';

// Settings views
import Settings from './views/Settings/Settings';
import AddEditNode from './views/Settings/AddEditNode';
import Nodes from './views/Settings/Nodes';
import Privacy from './views/Settings/Privacy';
import Security from './views/Settings/Security';
import SetPassword from './views/Settings/SetPassword';
import SetDuressPassword from './views/Settings/SetDuressPassword';
import SetPin from './views/Settings/SetPin';
import SetDuressPin from './views/Settings/SetDuressPin';
import Language from './views/Settings/Language';
import Currency from './views/Settings/Currency';
import Theme from './views/Settings/Theme';
import CertInstallInstructions from './views/Settings/CertInstallInstructions';
import SignVerifyMessage from './views/Settings/SignVerifyMessage';
import About from './views/Settings/About';
import Help from './views/Settings/Help';
import Olympians from './views/Settings/Olympians';

// Routing
import Routing from './views/Routing/Routing';
import RoutingEvent from './views/Routing/RoutingEvent';
import SetFees from './views/Routing/SetFees';

// new views
import Activity from './views/Activity/Activity';
import ActivityFilter from './views/Activity/ActivityFilter';
import CoinControl from './views/UTXOs/CoinControl';
import Utxo from './views/UTXOs/UTXO';
import ImportAccount from './views/Accounts/ImportAccount';
import ImportAccountQRScanner from './views/Accounts/ImportAccountQRScanner';

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
    Send: {
        screen: Send
    },
    EditFee: {
        screen: EditFee
    },
    Settings: {
        screen: Settings
    },
    AddEditNode: {
        screen: AddEditNode
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
    Theme: {
        screen: Theme
    },
    About: {
        screen: About
    },
    Help: {
        screen: Help
    },
    Olympians: {
        screen: Olympians
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
    AddressQRCodeScanner: {
        screen: AddressQRScanner
    },
    NodeQRCodeScanner: {
        screen: NodeQRScanner
    },
    BTCPayConfigQRScanner: {
        screen: BTCPayConfigQRScanner
    },
    LNDConnectConfigQRScanner: {
        screen: LNDConnectConfigQRScanner
    },
    LNDHubQRScanner: {
        screen: LNDHubQRScanner
    },
    ImportAccountQRScanner: {
        screen: ImportAccountQRScanner
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
