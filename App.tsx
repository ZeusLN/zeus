import * as React from 'react';
import { Observer, Provider } from 'mobx-react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHandler, NativeEventSubscription, StatusBar } from 'react-native';

import Stores from './stores/Stores';
import NavigationService from './NavigationService';
import PushNotificationManager from './PushNotificationManager';
import { AppContainer } from './components/layout/AppContainer';
import AlertModal from './components/Modals/AlertModal';
import ExternalLinkModal from './components/Modals/ExternalLinkModal';
import AndroidNfcModal from './components/Modals/AndroidNfcModal';
import InfoModal from './components/Modals/InfoModal';

// Views
import Transaction from './views/Transaction';
import Wallet from './views/Wallet/Wallet';
import Send from './views/Send';
import LnurlPay from './views/LnurlPay/LnurlPay';
import LnurlChannel from './views/LnurlChannel';
import LnurlAuth from './views/LnurlAuth';
import Receive from './views/Receive';
import PaymentRequest from './views/PaymentRequest';
import HandleAnythingQRScanner from './views/HandleAnythingQRScanner';
import NodeQRScanner from './views/NodeQRScanner';
import OpenChannel from './views/OpenChannel';
import SendingOnChain from './views/SendingOnChain';
import SendingLightning from './views/SendingLightning';
import Channel from './views/Channels/Channel';
import Payment from './views/Payment';
import PaymentPaths from './views/PaymentPaths';
import Invoice from './views/Invoice';
import Sweep from './views/Sweep';
import OnChainAddresses from './views/OnChainAddresses';

import SparkQRScanner from './views/SparkQRScanner';
import NodeInfo from './views/NodeInfo';
import NetworkInfo from './views/NetworkInfo';
import Lockscreen from './views/Lockscreen';
import NostrContacts from './views/NostrContacts';
import ContactQR from './views/ContactQR';

// Settings views
import Settings from './views/Settings/Settings';
import WalletConfiguration from './views/Settings/WalletConfiguration';
import Wallets from './views/Settings/Wallets';
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
import ChannelsSettings from './views/Settings/ChannelsSettings';
import SetWalletPicture from './views/Settings/SetWalletPicture';
import ChoosePaymentMethod from './views/ChoosePaymentMethod';

// Lightning address
import LightningAddress from './views/Settings/LightningAddress';
import LightningAddressInfo from './views/Settings/LightningAddress/LightningAddressInfo';
import LightningAddressSettings from './views/Settings/LightningAddress/LightningAddressSettings';
import Attestation from './views/Settings/LightningAddress/Attestation';
import Attestations from './views/Settings/LightningAddress/Attestations';
import NostrKeys from './views/Settings/LightningAddress/NostrKeys';
import NostrRelays from './views/Settings/LightningAddress/NostrRelays';
import ChangeAddress from './views/Settings/LightningAddress/ChangeAddress';

// BOLT 12
import PayCodes from './views/PayCodes';
import PayCode from './views/PayCode';
import CreatePayCode from './views/PayCodeCreate';
import Bolt12Address from './views/Settings/Bolt12Address';

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
import AdvancedRescan from './views/Settings/EmbeddedNode/AdvancedRescan';
import Troubleshooting from './views/Settings/EmbeddedNode/Troubleshooting';

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
import ImportingAccount from './views/Accounts/ImportingAccount';
import BumpFee from './views/BumpFee';
import QR from './views/QR';
import AddNotes from './views/AddNotes';
import Contacts from './views/Settings/Contacts';
import AddContact from './views/Settings/AddContact';
import ContactDetails from './views/ContactDetails';
import CurrencyConverter from './views/Settings/CurrencyConverter';
import PendingHTLCs from './views/PendingHTLCs';

// POS
import Order from './views/Order';

import Intro from './views/Intro';
import IntroSplash from './views/IntroSplash';

import EditFee from './views/EditFee';

// Embedded LND
import Seed from './views/Settings/Seed';
import SeedRecovery from './views/Settings/SeedRecovery';
import SeedQRExport from './views/Settings/SeedQRExport';
import Sync from './views/Sync';
import SyncRecovery from './views/SyncRecovery';
import LspExplanationFees from './views/Explanations/LspExplanationFees';
import LspExplanationRouting from './views/Explanations/LspExplanationRouting';
import LspExplanationWrappedInvoices from './views/Explanations/LspExplanationWrappedInvoices';
import LspExplanationOverview from './views/Explanations/LspExplanationOverview';
import RestoreChannelBackups from './views/Settings/EmbeddedNode/RestoreChannelBackups';

// LSP
import LSPServicesList from './views/Settings/LSPServicesList';

// LSPS1
import LSPS1 from './views/Settings/LSPS1/index';
import LSPS1Settings from './views/Settings/LSPS1/Settings';
import OrdersPane from './views/Settings/LSPS1/OrdersPane';
import Orders from './views/Settings/LSPS1/Order';

import RawTxHex from './views/RawTxHex';

import CustodialWalletWarning from './views/Settings/CustodialWalletWarning';

import PSBT from './views/PSBT';
import TxHex from './views/TxHex';

import Menu from './views/Menu';
import Tools from './views/Tools';

import { isLightTheme, themeColor } from './utils/ThemeUtils';

export default class App extends React.PureComponent {
    private backPressListenerSubscription: NativeEventSubscription;

    private handleBackPress = (navigation: any) => {
        const dialogHasBeenClosed = Stores.modalStore.closeVisibleModalDialog();
        if (dialogHasBeenClosed) {
            return true;
        }

        if (Stores.settingsStore.loginRequired()) {
            BackHandler.exitApp();
            return true;
        }

        const navigationState = navigation.getState();
        if (navigationState.routes.length > 1) {
            navigation.pop();
            return true;
        }

        return false;
    };

    render() {
        const Stack = createStackNavigator();
        return (
            <Provider
                AlertStore={Stores.alertStore}
                BalanceStore={Stores.balanceStore}
                TransactionsStore={Stores.transactionsStore}
                ChannelsStore={Stores.channelsStore}
                NodeInfoStore={Stores.nodeInfoStore}
                InvoicesStore={Stores.invoicesStore}
                SettingsStore={Stores.settingsStore}
                FiatStore={Stores.fiatStore}
                UnitsStore={Stores.unitsStore}
                PaymentsStore={Stores.paymentsStore}
                FeeStore={Stores.feeStore}
                LnurlPayStore={Stores.lnurlPayStore}
                UTXOsStore={Stores.utxosStore}
                MessageSignStore={Stores.messageSignStore}
                ActivityStore={Stores.activityStore}
                PosStore={Stores.posStore}
                InventoryStore={Stores.inventoryStore}
                ModalStore={Stores.modalStore}
                NotesStore={Stores.notesStore}
                ContactStore={Stores.contactStore}
                SyncStore={Stores.syncStore}
                LSPStore={Stores.lspStore}
                LightningAddressStore={Stores.lightningAddressStore}
                ChannelBackupStore={Stores.channelBackupStore}
                OffersStore={Stores.offersStore}
            >
                <AppContainer>
                    <PushNotificationManager>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                            <SafeAreaView style={{ height: '100%' }}>
                                <Observer>
                                    {() => (
                                        <>
                                            <StatusBar
                                                barStyle={
                                                    isLightTheme()
                                                        ? 'dark-content'
                                                        : 'light-content'
                                                }
                                            />
                                            <NavigationContainer
                                                ref={(nav) => {
                                                    if (nav != null) {
                                                        NavigationService.setTopLevelNavigator(
                                                            nav
                                                        );
                                                    }
                                                }}
                                                // @ts-ignore:next-line
                                                theme={{
                                                    dark: true,
                                                    colors: {
                                                        background:
                                                            themeColor(
                                                                'background'
                                                            ),
                                                        border: themeColor(
                                                            'background'
                                                        ),
                                                        card: themeColor(
                                                            'background'
                                                        ),
                                                        notification:
                                                            themeColor('text'),
                                                        primary:
                                                            themeColor(
                                                                'highlight'
                                                            ),
                                                        text: themeColor('text')
                                                    }
                                                }}
                                            >
                                                <Stack.Navigator
                                                    screenOptions={({
                                                        route
                                                    }) => ({
                                                        headerShown: false,
                                                        animation: (
                                                            route.params as any
                                                        )?.animation
                                                    })}
                                                    screenListeners={({
                                                        navigation
                                                    }) => ({
                                                        focus: () => {
                                                            this.backPressListenerSubscription?.remove();
                                                            this.backPressListenerSubscription =
                                                                BackHandler.addEventListener(
                                                                    'hardwareBackPress',
                                                                    () =>
                                                                        this.handleBackPress(
                                                                            navigation
                                                                        )
                                                                );
                                                        },
                                                        blur: () =>
                                                            this.backPressListenerSubscription?.remove()
                                                    })}
                                                >
                                                    <Stack.Screen
                                                        name="Wallet" // @ts-ignore:next-line
                                                        component={Wallet}
                                                    />
                                                    <Stack.Screen
                                                        name="IntroSplash" // @ts-ignore:next-line
                                                        component={IntroSplash}
                                                    />
                                                    <Stack.Screen
                                                        name="Intro" // @ts-ignore:next-line
                                                        component={Intro}
                                                    />
                                                    <Stack.Screen
                                                        name="Lockscreen" // @ts-ignore:next-line
                                                        component={Lockscreen}
                                                    />
                                                    <Stack.Screen
                                                        name="Accounts" // @ts-ignore:next-line
                                                        component={Accounts}
                                                    />
                                                    <Stack.Screen
                                                        name="ChoosePaymentMethod" // @ts-ignore:next-line
                                                        component={
                                                            ChoosePaymentMethod
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Send" // @ts-ignore:next-line
                                                        component={Send}
                                                    />
                                                    <Stack.Screen
                                                        name="Sweep" // @ts-ignore:next-line
                                                        component={Sweep}
                                                    />
                                                    <Stack.Screen
                                                        name="EditFee" // @ts-ignore:next-line
                                                        component={EditFee}
                                                    />
                                                    <Stack.Screen
                                                        name="Menu" // @ts-ignore:next-line
                                                        component={Menu}
                                                    />
                                                    <Stack.Screen
                                                        name="Settings" // @ts-ignore:next-line
                                                        component={Settings}
                                                    />
                                                    <Stack.Screen
                                                        name="Tools" // @ts-ignore:next-line
                                                        component={Tools}
                                                    />
                                                    <Stack.Screen
                                                        name="WalletConfiguration" // @ts-ignore:next-line
                                                        component={
                                                            WalletConfiguration
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Wallets" // @ts-ignore:next-line
                                                        component={Wallets}
                                                    />
                                                    <Stack.Screen
                                                        name="Privacy" // @ts-ignore:next-line
                                                        component={Privacy}
                                                    />
                                                    <Stack.Screen
                                                        name="Security" // @ts-ignore:next-line
                                                        component={Security}
                                                    />
                                                    <Stack.Screen
                                                        name="SetPassword" // @ts-ignore:next-line
                                                        component={SetPassword}
                                                    />
                                                    <Stack.Screen
                                                        name="SetDuressPassword" // @ts-ignore:next-line
                                                        component={
                                                            SetDuressPassword
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SetPin" // @ts-ignore:next-line
                                                        component={SetPin}
                                                    />
                                                    <Stack.Screen
                                                        name="SetDuressPin" // @ts-ignore:next-line
                                                        component={SetDuressPin}
                                                    />
                                                    <Stack.Screen
                                                        name="Language" // @ts-ignore:next-line
                                                        component={Language}
                                                    />
                                                    <Stack.Screen
                                                        name="Currency" // @ts-ignore:next-line
                                                        component={Currency}
                                                    />
                                                    <Stack.Screen
                                                        name="SelectCurrency" // @ts-ignore:next-line
                                                        component={
                                                            SelectCurrency
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Display" // @ts-ignore:next-line
                                                        component={Display}
                                                    />
                                                    <Stack.Screen
                                                        name="Support" // @ts-ignore:next-line
                                                        component={Support}
                                                    />
                                                    <Stack.Screen
                                                        name="Help" // @ts-ignore:next-line
                                                        component={Help}
                                                    />
                                                    <Stack.Screen
                                                        name="Sponsors" // @ts-ignore:next-line
                                                        component={Sponsors}
                                                    />
                                                    <Stack.Screen
                                                        name="Olympians" // @ts-ignore:next-line
                                                        component={Olympians}
                                                    />
                                                    <Stack.Screen
                                                        name="Gods" // @ts-ignore:next-line
                                                        component={Gods}
                                                    />
                                                    <Stack.Screen
                                                        name="Mortals" // @ts-ignore:next-line
                                                        component={Mortals}
                                                    />
                                                    <Stack.Screen
                                                        name="CertInstallInstructions" // @ts-ignore:next-line
                                                        component={
                                                            CertInstallInstructions
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SignVerifyMessage" // @ts-ignore:next-line
                                                        component={
                                                            SignVerifyMessage
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Transaction" // @ts-ignore:next-line
                                                        component={Transaction}
                                                    />
                                                    <Stack.Screen
                                                        name="Channel" // @ts-ignore:next-line
                                                        component={Channel}
                                                    />
                                                    <Stack.Screen
                                                        name="Payment" // @ts-ignore:next-line
                                                        component={Payment}
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentPaths" // @ts-ignore:next-line
                                                        component={PaymentPaths}
                                                    />
                                                    <Stack.Screen
                                                        name="Invoice" // @ts-ignore:next-line
                                                        component={Invoice}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlPay" // @ts-ignore:next-line
                                                        component={LnurlPay}
                                                    />
                                                    <Stack.Screen
                                                        name="Receive" // @ts-ignore:next-line
                                                        component={Receive}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlChannel" // @ts-ignore:next-line
                                                        component={LnurlChannel}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlAuth" // @ts-ignore:next-line
                                                        component={LnurlAuth}
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentRequest" // @ts-ignore:next-line
                                                        component={
                                                            PaymentRequest
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="OpenChannel" // @ts-ignore:next-line
                                                        component={OpenChannel}
                                                    />
                                                    <Stack.Screen
                                                        name="SendingOnChain" // @ts-ignore:next-line
                                                        component={
                                                            SendingOnChain
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SendingLightning" // @ts-ignore:next-line
                                                        component={
                                                            SendingLightning
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NetworkInfo" // @ts-ignore:next-line
                                                        component={NetworkInfo}
                                                    />
                                                    <Stack.Screen
                                                        name="NodeInfo" // @ts-ignore:next-line
                                                        component={NodeInfo}
                                                    />
                                                    <Stack.Screen
                                                        name="Routing" // @ts-ignore:next-line
                                                        component={Routing}
                                                    />
                                                    <Stack.Screen
                                                        name="RoutingEvent" // @ts-ignore:next-line
                                                        component={RoutingEvent}
                                                    />
                                                    <Stack.Screen
                                                        name="SetFees" // @ts-ignore:next-line
                                                        component={SetFees}
                                                    />
                                                    <Stack.Screen
                                                        name="Activity" // @ts-ignore:next-line
                                                        component={Activity}
                                                    />
                                                    <Stack.Screen
                                                        name="ActivityFilter" // @ts-ignore:next-line
                                                        component={
                                                            ActivityFilter
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="CoinControl" // @ts-ignore:next-line
                                                        component={CoinControl}
                                                    />
                                                    <Stack.Screen
                                                        name="Utxo" // @ts-ignore:next-line
                                                        component={Utxo}
                                                    />
                                                    <Stack.Screen
                                                        name="ImportAccount" // @ts-ignore:next-line
                                                        component={
                                                            ImportAccount
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ImportingAccount" // @ts-ignore:next-line
                                                        component={
                                                            ImportingAccount
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="HandleAnythingQRScanner" // @ts-ignore:next-line
                                                        component={
                                                            HandleAnythingQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NodeQRCodeScanner" // @ts-ignore:next-line
                                                        component={
                                                            NodeQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SparkQRScanner" // @ts-ignore:next-line
                                                        component={
                                                            SparkQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Order" // @ts-ignore:next-line
                                                        component={Order}
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleSettings" // @ts-ignore:next-line
                                                        component={PointOfSale}
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleRecon" // @ts-ignore:next-line
                                                        component={
                                                            PointOfSaleRecon
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleReconExport" // @ts-ignore:next-line
                                                        component={
                                                            PointOfSaleReconExport
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Categories" // @ts-ignore:next-line
                                                        component={Categories}
                                                    />
                                                    <Stack.Screen
                                                        name="ProductCategoryDetails" // @ts-ignore:next-line
                                                        component={
                                                            ProductCategoryDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Products" // @ts-ignore:next-line
                                                        component={Products}
                                                    />
                                                    <Stack.Screen
                                                        name="ProductDetails" // @ts-ignore:next-line
                                                        component={
                                                            ProductDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentsSettings" // @ts-ignore:next-line
                                                        component={
                                                            PaymentsSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="InvoicesSettings" // @ts-ignore:next-line
                                                        component={
                                                            InvoicesSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Seed" // @ts-ignore:next-line
                                                        component={Seed}
                                                    />
                                                    <Stack.Screen
                                                        name="SeedRecovery" // @ts-ignore:next-line
                                                        component={SeedRecovery}
                                                    />
                                                    <Stack.Screen
                                                        name="SeedQRExport" // @ts-ignore:next-line
                                                        component={SeedQRExport}
                                                    />
                                                    <Stack.Screen
                                                        name="Sync" // @ts-ignore:next-line
                                                        component={Sync}
                                                    />
                                                    <Stack.Screen
                                                        name="SyncRecovery" // @ts-ignore:next-line
                                                        component={SyncRecovery}
                                                    />
                                                    <Stack.Screen
                                                        name="BumpFee" // @ts-ignore:next-line
                                                        component={BumpFee}
                                                    />
                                                    <Stack.Screen
                                                        name="QR" // @ts-ignore:next-line
                                                        component={QR}
                                                    />
                                                    <Stack.Screen
                                                        name="AddNotes" // @ts-ignore:next-line
                                                        component={AddNotes}
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationFees" // @ts-ignore:next-line
                                                        component={
                                                            LspExplanationFees
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationRouting" // @ts-ignore:next-line
                                                        component={
                                                            LspExplanationRouting
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationWrappedInvoices" // @ts-ignore:next-line
                                                        component={
                                                            LspExplanationWrappedInvoices
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationOverview" // @ts-ignore:next-line
                                                        component={
                                                            LspExplanationOverview
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="EmbeddedNodeSettings" // @ts-ignore:next-line
                                                        component={EmbeddedNode}
                                                    />
                                                    <Stack.Screen
                                                        name="DisasterRecovery" // @ts-ignore:next-line
                                                        component={
                                                            DisasterRecovery
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="DisasterRecoveryAdvanced" // @ts-ignore:next-line
                                                        component={
                                                            DisasterRecoveryAdvanced
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Pathfinding" // @ts-ignore:next-line
                                                        component={Pathfinding}
                                                    />
                                                    <Stack.Screen
                                                        name="ExpressGraphSync" // @ts-ignore:next-line
                                                        component={
                                                            ExpressGraphSync
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LNDLogs" // @ts-ignore:next-line
                                                        component={LNDLogs}
                                                    />
                                                    <Stack.Screen
                                                        name="Peers" // @ts-ignore:next-line
                                                        component={Peers}
                                                    />
                                                    <Stack.Screen
                                                        name="NeutrinoPeers" // @ts-ignore:next-line
                                                        component={
                                                            NeutrinoPeers
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ZeroConfPeers" // @ts-ignore:next-line
                                                        component={
                                                            ZeroConfPeers
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="EmbeddedNodeSettingsAdvanced" // @ts-ignore:next-line
                                                        component={Advanced}
                                                    />
                                                    <Stack.Screen
                                                        name="EmbeddedNodeTroubleshooting" // @ts-ignore:next-line
                                                        component={
                                                            Troubleshooting
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="AdvancedRescan" // @ts-ignore:next-line
                                                        component={
                                                            AdvancedRescan
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LSPSettings" // @ts-ignore:next-line
                                                        component={LSP}
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddress" // @ts-ignore:next-line
                                                        component={
                                                            LightningAddress
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddressInfo" // @ts-ignore:next-line
                                                        component={
                                                            LightningAddressInfo
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddressSettings" // @ts-ignore:next-line
                                                        component={
                                                            LightningAddressSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Attestations" // @ts-ignore:next-line
                                                        component={Attestations}
                                                    />
                                                    <Stack.Screen
                                                        name="Attestation" // @ts-ignore:next-line
                                                        component={Attestation}
                                                    />
                                                    <Stack.Screen
                                                        name="Contacts" // @ts-ignore:next-line
                                                        component={Contacts}
                                                    />
                                                    <Stack.Screen
                                                        name="AddContact" // @ts-ignore:next-line
                                                        component={AddContact}
                                                    />
                                                    <Stack.Screen
                                                        name="ContactDetails" // @ts-ignore:next-line
                                                        component={
                                                            ContactDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NostrKeys" // @ts-ignore:next-line
                                                        component={NostrKeys}
                                                    />
                                                    <Stack.Screen
                                                        name="NostrRelays" // @ts-ignore:next-line
                                                        component={NostrRelays}
                                                    />
                                                    <Stack.Screen
                                                        name="ChangeAddress" // @ts-ignore:next-line
                                                        component={
                                                            ChangeAddress
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PayCodes" // @ts-ignore:next-line
                                                        component={PayCodes}
                                                    />
                                                    <Stack.Screen
                                                        name="PayCode" // @ts-ignore:next-line
                                                        component={PayCode}
                                                    />
                                                    <Stack.Screen
                                                        name="CreatePayCode" // @ts-ignore:next-line
                                                        component={
                                                            CreatePayCode
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Bolt12Address" // @ts-ignore:next-line
                                                        component={
                                                            Bolt12Address
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SocialMedia" // @ts-ignore:next-line
                                                        component={SocialMedia}
                                                    />
                                                    <Stack.Screen
                                                        name="NostrContacts" // @ts-ignore:next-line
                                                        component={
                                                            NostrContacts
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ContactQR" // @ts-ignore:next-line
                                                        component={ContactQR}
                                                    />
                                                    <Stack.Screen
                                                        name="CurrencyConverter" // @ts-ignore:next-line
                                                        component={
                                                            CurrencyConverter
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ChannelsSettings" // @ts-ignore:next-line
                                                        component={
                                                            ChannelsSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="RawTxHex" // @ts-ignore:next-line
                                                        component={RawTxHex}
                                                    />
                                                    <Stack.Screen
                                                        name="RestoreChannelBackups" // @ts-ignore:next-line
                                                        component={
                                                            RestoreChannelBackups
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SetWalletPicture" // @ts-ignore:next-line
                                                        component={
                                                            SetWalletPicture
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="CustodialWalletWarning" // @ts-ignore:next-line
                                                        component={
                                                            CustodialWalletWarning
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PSBT" // @ts-ignore:next-line
                                                        component={PSBT}
                                                    />
                                                    <Stack.Screen
                                                        name="TxHex" // @ts-ignore:next-line
                                                        component={TxHex}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPServicesList" // @ts-ignore:next-line
                                                        component={
                                                            LSPServicesList
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1" // @ts-ignore:next-line
                                                        component={LSPS1}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1Settings" // @ts-ignore:next-line
                                                        component={
                                                            LSPS1Settings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="OrdersPane" // @ts-ignore:next-line
                                                        component={OrdersPane}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1Order" // @ts-ignore:next-line
                                                        component={Orders}
                                                    />
                                                    <Stack.Screen
                                                        name="PendingHTLCs" // @ts-ignore:next-line
                                                        component={PendingHTLCs}
                                                    />
                                                    <Stack.Screen
                                                        name="OnChainAddresses" // @ts-ignore:next-line
                                                        component={
                                                            OnChainAddresses
                                                        }
                                                    />
                                                </Stack.Navigator>
                                            </NavigationContainer>
                                        </>
                                    )}
                                </Observer>
                            </SafeAreaView>
                            {/* @ts-ignore:next-line */}
                            <AlertModal />
                            {/* @ts-ignore:next-line */}
                            <ExternalLinkModal />
                            {/* @ts-ignore:next-line */}
                            <AndroidNfcModal />
                            {/* @ts-ignore:next-line */}
                            <InfoModal />
                        </GestureHandlerRootView>
                    </PushNotificationManager>
                </AppContainer>
            </Provider>
        );
    }
}
