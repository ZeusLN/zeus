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
import ChannelsSettings from './views/Settings/ChannelsSettings';
import SetNodePicture from './views/Settings/SetNodePicture';
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
                                                        name="Wallet"
                                                        component={Wallet}
                                                    />
                                                    <Stack.Screen
                                                        name="IntroSplash"
                                                        component={IntroSplash}
                                                    />
                                                    <Stack.Screen
                                                        name="Intro"
                                                        component={Intro}
                                                    />
                                                    <Stack.Screen
                                                        name="Lockscreen"
                                                        component={Lockscreen}
                                                    />
                                                    <Stack.Screen
                                                        name="ChoosePaymentMethod"
                                                        component={
                                                            ChoosePaymentMethod
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Accounts"
                                                        component={Accounts}
                                                    />
                                                    <Stack.Screen
                                                        name="Send"
                                                        component={Send}
                                                    />
                                                    <Stack.Screen
                                                        name="Sweep"
                                                        component={Sweep}
                                                    />
                                                    <Stack.Screen
                                                        name="EditFee"
                                                        component={EditFee}
                                                    />
                                                    <Stack.Screen
                                                        name="Menu"
                                                        component={Menu}
                                                    />
                                                    <Stack.Screen
                                                        name="Settings"
                                                        component={Settings}
                                                    />
                                                    <Stack.Screen
                                                        name="Tools"
                                                        component={Tools}
                                                    />
                                                    <Stack.Screen
                                                        name="NodeConfiguration"
                                                        component={
                                                            NodeConfiguration
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Nodes"
                                                        component={Nodes}
                                                    />
                                                    <Stack.Screen
                                                        name="Privacy"
                                                        component={Privacy}
                                                    />
                                                    <Stack.Screen
                                                        name="Security"
                                                        component={Security}
                                                    />
                                                    <Stack.Screen
                                                        name="SetPassword"
                                                        component={SetPassword}
                                                    />
                                                    <Stack.Screen
                                                        name="SetDuressPassword"
                                                        component={
                                                            SetDuressPassword
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SetPin"
                                                        component={SetPin}
                                                    />
                                                    <Stack.Screen
                                                        name="SetDuressPin"
                                                        component={SetDuressPin}
                                                    />
                                                    <Stack.Screen
                                                        name="Language"
                                                        component={Language}
                                                    />
                                                    <Stack.Screen
                                                        name="Currency"
                                                        component={Currency}
                                                    />
                                                    <Stack.Screen
                                                        name="SelectCurrency"
                                                        component={
                                                            SelectCurrency
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Display"
                                                        component={Display}
                                                    />
                                                    <Stack.Screen
                                                        name="Support"
                                                        component={Support}
                                                    />
                                                    <Stack.Screen
                                                        name="Help"
                                                        component={Help}
                                                    />
                                                    <Stack.Screen
                                                        name="Sponsors"
                                                        component={Sponsors}
                                                    />
                                                    <Stack.Screen
                                                        name="Olympians"
                                                        component={Olympians}
                                                    />
                                                    <Stack.Screen
                                                        name="Gods"
                                                        component={Gods}
                                                    />
                                                    <Stack.Screen
                                                        name="Mortals"
                                                        component={Mortals}
                                                    />
                                                    <Stack.Screen
                                                        name="CertInstallInstructions"
                                                        component={
                                                            CertInstallInstructions
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SignVerifyMessage"
                                                        component={
                                                            SignVerifyMessage
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Transaction"
                                                        component={Transaction}
                                                    />
                                                    <Stack.Screen
                                                        name="Channel"
                                                        component={Channel}
                                                    />
                                                    <Stack.Screen
                                                        name="Payment"
                                                        component={Payment}
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentPaths"
                                                        component={PaymentPaths}
                                                    />
                                                    <Stack.Screen
                                                        name="Invoice"
                                                        component={Invoice}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlPay"
                                                        component={LnurlPay}
                                                    />
                                                    <Stack.Screen
                                                        name="Receive"
                                                        component={Receive}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlChannel"
                                                        component={LnurlChannel}
                                                    />
                                                    <Stack.Screen
                                                        name="LnurlAuth"
                                                        component={LnurlAuth}
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentRequest"
                                                        component={
                                                            PaymentRequest
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="OpenChannel"
                                                        component={OpenChannel}
                                                    />
                                                    <Stack.Screen
                                                        name="SendingOnChain"
                                                        component={
                                                            SendingOnChain
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SendingLightning"
                                                        component={
                                                            SendingLightning
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NetworkInfo"
                                                        component={NetworkInfo}
                                                    />
                                                    <Stack.Screen
                                                        name="NodeInfo"
                                                        component={NodeInfo}
                                                    />
                                                    <Stack.Screen
                                                        name="Routing"
                                                        component={Routing}
                                                    />
                                                    <Stack.Screen
                                                        name="RoutingEvent"
                                                        component={RoutingEvent}
                                                    />
                                                    <Stack.Screen
                                                        name="SetFees"
                                                        component={SetFees}
                                                    />
                                                    <Stack.Screen
                                                        name="Activity"
                                                        component={Activity}
                                                    />
                                                    <Stack.Screen
                                                        name="ActivityFilter"
                                                        component={
                                                            ActivityFilter
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="CoinControl"
                                                        component={CoinControl}
                                                    />
                                                    <Stack.Screen
                                                        name="Utxo"
                                                        component={Utxo}
                                                    />
                                                    <Stack.Screen
                                                        name="ImportAccount"
                                                        component={
                                                            ImportAccount
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ImportingAccount"
                                                        component={
                                                            ImportingAccount
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="HandleAnythingQRScanner"
                                                        component={
                                                            HandleAnythingQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NodeQRCodeScanner"
                                                        component={
                                                            NodeQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SparkQRScanner"
                                                        component={
                                                            SparkQRScanner
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Order"
                                                        component={Order}
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleSettings"
                                                        component={PointOfSale}
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleRecon"
                                                        component={
                                                            PointOfSaleRecon
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PointOfSaleReconExport"
                                                        component={
                                                            PointOfSaleReconExport
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Categories"
                                                        component={Categories}
                                                    />
                                                    <Stack.Screen
                                                        name="ProductCategoryDetails"
                                                        component={
                                                            ProductCategoryDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Products"
                                                        component={Products}
                                                    />
                                                    <Stack.Screen
                                                        name="ProductDetails"
                                                        component={
                                                            ProductDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PaymentsSettings"
                                                        component={
                                                            PaymentsSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="InvoicesSettings"
                                                        component={
                                                            InvoicesSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Seed"
                                                        component={Seed}
                                                    />
                                                    <Stack.Screen
                                                        name="SeedRecovery"
                                                        component={SeedRecovery}
                                                    />
                                                    <Stack.Screen
                                                        name="Sync"
                                                        component={Sync}
                                                    />
                                                    <Stack.Screen
                                                        name="SyncRecovery"
                                                        component={SyncRecovery}
                                                    />
                                                    <Stack.Screen
                                                        name="BumpFee"
                                                        component={BumpFee}
                                                    />
                                                    <Stack.Screen
                                                        name="QR"
                                                        component={QR}
                                                    />
                                                    <Stack.Screen
                                                        name="AddNotes"
                                                        component={AddNotes}
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationFees"
                                                        component={
                                                            LspExplanationFees
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationRouting"
                                                        component={
                                                            LspExplanationRouting
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationWrappedInvoices"
                                                        component={
                                                            LspExplanationWrappedInvoices
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LspExplanationOverview"
                                                        component={
                                                            LspExplanationOverview
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="EmbeddedNodeSettings"
                                                        component={EmbeddedNode}
                                                    />
                                                    <Stack.Screen
                                                        name="DisasterRecovery"
                                                        component={
                                                            DisasterRecovery
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="DisasterRecoveryAdvanced"
                                                        component={
                                                            DisasterRecoveryAdvanced
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Pathfinding"
                                                        component={Pathfinding}
                                                    />
                                                    <Stack.Screen
                                                        name="ExpressGraphSync"
                                                        component={
                                                            ExpressGraphSync
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LNDLogs"
                                                        component={LNDLogs}
                                                    />
                                                    <Stack.Screen
                                                        name="Peers"
                                                        component={Peers}
                                                    />
                                                    <Stack.Screen
                                                        name="NeutrinoPeers"
                                                        component={
                                                            NeutrinoPeers
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ZeroConfPeers"
                                                        component={
                                                            ZeroConfPeers
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="EmbeddedNodeSettingsAdvanced"
                                                        component={Advanced}
                                                    />
                                                    <Stack.Screen
                                                        name="AdvancedRescan"
                                                        component={
                                                            AdvancedRescan
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LSPSettings"
                                                        component={LSP}
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddress"
                                                        component={
                                                            LightningAddress
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddressInfo"
                                                        component={
                                                            LightningAddressInfo
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LightningAddressSettings"
                                                        component={
                                                            LightningAddressSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Attestations"
                                                        component={Attestations}
                                                    />
                                                    <Stack.Screen
                                                        name="Attestation"
                                                        component={Attestation}
                                                    />
                                                    <Stack.Screen
                                                        name="Contacts"
                                                        component={Contacts}
                                                    />
                                                    <Stack.Screen
                                                        name="AddContact"
                                                        component={AddContact}
                                                    />
                                                    <Stack.Screen
                                                        name="ContactDetails"
                                                        component={
                                                            ContactDetails
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="NostrKeys"
                                                        component={NostrKeys}
                                                    />
                                                    <Stack.Screen
                                                        name="NostrRelays"
                                                        component={NostrRelays}
                                                    />
                                                    <Stack.Screen
                                                        name="ChangeAddress"
                                                        component={
                                                            ChangeAddress
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PayCodes"
                                                        component={PayCodes}
                                                    />
                                                    <Stack.Screen
                                                        name="PayCode"
                                                        component={PayCode}
                                                    />
                                                    <Stack.Screen
                                                        name="CreatePayCode"
                                                        component={
                                                            CreatePayCode
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="Bolt12Address"
                                                        component={
                                                            Bolt12Address
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SocialMedia"
                                                        component={SocialMedia}
                                                    />
                                                    <Stack.Screen
                                                        name="NostrContacts"
                                                        component={
                                                            NostrContacts
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ContactQR"
                                                        component={ContactQR}
                                                    />
                                                    <Stack.Screen
                                                        name="CurrencyConverter"
                                                        component={
                                                            CurrencyConverter
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="ChannelsSettings"
                                                        component={
                                                            ChannelsSettings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="RawTxHex"
                                                        component={RawTxHex}
                                                    />
                                                    <Stack.Screen
                                                        name="RestoreChannelBackups"
                                                        component={
                                                            RestoreChannelBackups
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="SetNodePicture"
                                                        component={
                                                            SetNodePicture
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="CustodialWalletWarning"
                                                        component={
                                                            CustodialWalletWarning
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="PSBT"
                                                        component={PSBT}
                                                    />
                                                    <Stack.Screen
                                                        name="TxHex"
                                                        component={TxHex}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPServicesList"
                                                        component={
                                                            LSPServicesList
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1"
                                                        component={LSPS1}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1Settings"
                                                        component={
                                                            LSPS1Settings
                                                        }
                                                    />
                                                    <Stack.Screen
                                                        name="OrdersPane"
                                                        component={OrdersPane}
                                                    />
                                                    <Stack.Screen
                                                        name="LSPS1Order"
                                                        component={Orders}
                                                    />
                                                    <Stack.Screen
                                                        name="PendingHTLCs"
                                                        component={PendingHTLCs}
                                                    />
                                                    <Stack.Screen
                                                        name="OnChainAddresses"
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
                            <AlertModal />
                            <ExternalLinkModal />
                            <AndroidNfcModal />
                            <InfoModal />
                        </GestureHandlerRootView>
                    </PushNotificationManager>
                </AppContainer>
            </Provider>
        );
    }
}
