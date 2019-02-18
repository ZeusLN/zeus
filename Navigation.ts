import { createStackNavigator, createAppContainer } from 'react-navigation';

// Views
import Transaction from './views/Transaction';
import Settings from './views/Settings';
import Wallet from './views/Wallet/Wallet';
import Send from './views/Send';
import Receive from './views/Receive';
import InvoiceLookup from './views/InvoiceLookup';
import AddressQRScanner from './views/AddressQRScanner';
import NodeQRScanner from './views/NodeQRScanner';
import OpenChannel from './views/OpenChannel';
import SendingOnChain from './views/SendingOnChain';
import SendingLightning from './views/SendingLightning';
import Channel from './views/Channel';
import Payment from './views/Payment';
import Invoice from './views/Invoice';
import BTCPayConfigQRScanner from './views/BTCPayConfigQRScanner';

const AppScenes = {
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
    InvoiceLookup: {
        screen: InvoiceLookup
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
