import { createStackNavigator, createAppContainer } from 'react-navigation';

// Views
import Transaction from './views/Transaction';
import Wallet from './views/Wallet/Wallet';
import Send from './views/Send';
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
import NodeInfo from './views/NodeInfo';
import Lockscreen from './views/Lockscreen';

// Settings views
import Settings from './views/Settings';
import AddEditNode from './views/Settings/AddEditNode';

const AppScenes = {
    Lockscreen: {
        screen: Lockscreen
    },
    Wallet: {
        screen: Wallet
    },
    AddressQRCodeScanner : {
        screen: AddressQRScanner
    },
    NodeQRCodeScanner : {
        screen: NodeQRScanner
    },
    Settings: {
        screen: Settings
    },
    AddEditNode: {
        screen: AddEditNode
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
    Receive: {
        screen: Receive
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
    NodeInfo: {
        screen: NodeInfo
    }
}

const PopUpTransition = (index: number, position: any) => {
    const opacity = position.interpolate({
        inputRange: [index - 1, index, index + 0.999, index + 1],
        outputRange: [ 0, 1, 1, 0]
    });

    const translateY = position.interpolate({
        inputRange: [index - 1, index, index + 1],
        outputRange: [150, 0, 0]
    });

    return {
    opacity,
        transform: [
            {translateY}
        ]
    }
};

const SlideFromRightTransition = (index: number, position: any, layout: any) => {
    const opacity = position.interpolate({
        inputRange: [index - 1, index, index + 0.999, index + 1],
        outputRange: [ 0, 1, 1, 0]
    });

    const width = layout.initWidth

    const translateX = position.interpolate({
        inputRange: [index - 1, index, index + 1],
        outputRange: [width, 0, 0]
    })


    return {
    opacity,
        transform: [
            {translateX}
        ]
    }
};

const TransitionConfiguration = () => {
    return {
        // Define scene interpolation, eq. custom transition
        screenInterpolator: (sceneProps: any) => {
            const { position, scene, layout } = sceneProps;
            const { index } = scene;

            const routeName = scene.route.routeName;
            if (routeName === 'Transaction' || routeName === 'Channel' || routeName === 'Invoice' || routeName === 'Payment') {
                return SlideFromRightTransition(index, position, layout);
            }

            return PopUpTransition(index, position);
        }
    }
};

const AppNavigator = createStackNavigator(AppScenes, {
    headerMode: 'none',
    mode: 'modal',
    defaultNavigationOptions: {
        gesturesEnabled: false
    },
    transitionConfig: TransitionConfiguration
});

const Navigation = createAppContainer(AppNavigator);

export default Navigation;
