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
import Channel from './views/Channel';
import Payment from './views/Payment';
import Invoice from './views/Invoice';
import BTCPayConfigQRScanner from './views/BTCPayConfigQRScanner';
import LNDConnectConfigQRScanner from './views/LNDConnectConfigQRScanner';
import LNDHubQRScanner from './views/LNDHubQRScanner';
import NodeInfo from './views/NodeInfo';
import Lockscreen from './views/Lockscreen';

// Settings views
import Settings from './views/Settings';
import AddEditNode from './views/Settings/AddEditNode';
import CertInstallInstructions from './views/Settings/CertInstallInstructions';
import About from './views/Settings/About';
import SignMessage from './views/Settings/SignMessage';

import Onboarding from './views/Onboarding';

const AppScenes = {
    Lockscreen: {
        screen: Lockscreen
    },
    Onboarding: {
        screen: Onboarding
    },
    Wallet: {
        screen: Wallet
    },
    AddressQRCodeScanner: {
        screen: AddressQRScanner
    },
    NodeQRCodeScanner: {
        screen: NodeQRScanner
    },
    Settings: {
        screen: Settings
    },
    AddEditNode: {
        screen: AddEditNode
    },
    CertInstallInstructions: {
        screen: CertInstallInstructions
    },
    About: {
        screen: About
    },
    SignMessage: {
        screen: SignMessage
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
    Send: {
        screen: Send
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
    BTCPayConfigQRScanner: {
        screen: BTCPayConfigQRScanner
    },
    LNDConnectConfigQRScanner: {
        screen: LNDConnectConfigQRScanner
    },
    LNDHubQRScanner: {
        screen: LNDHubQRScanner
    },
    NodeInfo: {
        screen: NodeInfo
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
