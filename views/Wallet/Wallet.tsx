import * as React from 'react';
import {
    Animated,
    AppState,
    BackHandler,
    Linking,
    NativeEventSubscription,
    PanResponder,
    PanResponderInstance,
    Platform,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    DefaultTheme,
    NavigationContainer,
    NavigationContainerRef,
    NavigationIndependentTree
} from '@react-navigation/native';
import { inject, observer } from 'mobx-react';
import RNRestart from 'react-native-restart';
import { StackNavigationProp } from '@react-navigation/stack';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import EncryptedStorage from 'react-native-encrypted-storage';

import ChannelsPane from '../Channels/ChannelsPane';
import BalancePane from './BalancePane';
import KeypadPane from './KeypadPane';
import SquarePosPane from './SquarePosPane';
import StandalonePosPane from './StandalonePosPane';
import StandalonePosKeypadPane from './StandalonePosKeypadPane';

import Button from '../../components/Button';
import LayerBalances from '../../components/LayerBalances';
import LoadingColumns from '../../components/LoadingColumns';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import WalletHeader from '../../components/WalletHeader';

import BackendUtils from '../../utils/BackendUtils';
import { getSupportedBiometryType } from '../../utils/BiometricUtils';
import LinkingUtils from '../../utils/LinkingUtils';
import {
    initializeLnd,
    startLnd,
    expressGraphSync
} from '../../utils/LndMobileUtils';
import { localeString } from '../../utils/LocaleUtils';
import { protectedNavigation } from '../../utils/NavigationUtils';
import { isLightTheme, themeColor } from '../../utils/ThemeUtils';

import AlertStore from '../../stores/AlertStore';
import BalanceStore from '../../stores/BalanceStore';
import ChannelBackupStore from '../../stores/ChannelBackupStore';
import ChannelsStore from '../../stores/ChannelsStore';
import FiatStore from '../../stores/FiatStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import LnurlPayStore from '../../stores/LnurlPayStore';
import LSPStore from '../../stores/LSPStore';
import ModalStore from '../../stores/ModalStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import SettingsStore, {
    PosEnabled,
    Settings,
    INTERFACE_KEYS
} from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';
import UnitsStore from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import ContactStore from '../../stores/ContactStore';
import NotesStore from '../../stores/NotesStore';

import Bitcoin from '../../assets/images/SVG/Bitcoin.svg';
import CaretUp from '../../assets/images/SVG/Caret Up.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import POS from '../../assets/images/SVG/POS.svg';
import Temple from '../../assets/images/SVG/Temple.svg';
import Scan from '../../assets/images/SVG/Scan.svg';

import { version } from '../../package.json';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: StackNavigationProp<any, any>;
    AlertStore: AlertStore;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    UTXOsStore: UTXOsStore;
    ContactStore: ContactStore;
    ModalStore: ModalStore;
    SyncStore: SyncStore;
    LSPStore: LSPStore;
    NotesStore: NotesStore;
    ChannelBackupStore: ChannelBackupStore;
    LightningAddressStore: LightningAddressStore;
    LnurlPayStore: LnurlPayStore;
}

interface WalletState {
    unlocked: boolean;
    initialLoad: boolean;
}

@inject(
    'AlertStore',
    'BalanceStore',
    'ChannelsStore',
    'NodeInfoStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore',
    'PosStore',
    'UTXOsStore',
    'ContactStore',
    'ModalStore',
    'SyncStore',
    'LSPStore',
    'LnurlPayStore',
    'ChannelBackupStore',
    'LightningAddressStore',
    'NotesStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
    private tabNavigationRef = React.createRef<NavigationContainerRef<any>>();
    private pan: Animated.ValueXY;
    private panResponder: PanResponderInstance;
    private handleAppStateChangeSubscription: NativeEventSubscription;
    private backPressSubscription: NativeEventSubscription;

    constructor(props: WalletProps) {
        super(props);
        this.state = {
            unlocked: false,
            initialLoad: true
        };
        this.pan = new Animated.ValueXY();
        this.panResponder = PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: this.pan.x, dy: this.pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: () => {
                Animated.spring(this.pan, {
                    toValue: { x: 0, y: 0 },
                    useNativeDriver: false
                }).start();
                props.navigation.navigate('Activity', {
                    animation: 'slide_from_bottom'
                });
            }
        });
    }

    private handleBackButton() {
        const tabNavigator = this.tabNavigationRef.current;
        if (!tabNavigator) {
            return false;
        }
        const tabNavigatorState = tabNavigator.getState();
        if (!tabNavigatorState) {
            return false;
        }
        const currentTabName =
            tabNavigatorState.routeNames[tabNavigatorState.index];
        const defaultView =
            this.props.SettingsStore.settings.display.defaultView;

        if (defaultView === currentTabName || currentTabName === 'POS') {
            return false;
        } else if (defaultView) {
            tabNavigator.navigate(defaultView);
            return true;
        }
        return false;
    }

    private handleFocus = () => {
        this.backPressSubscription?.remove();
        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackButton.bind(this)
        );
        this.getSettingsAndNavigate();
    };

    private handleBlur = () => this.backPressSubscription?.remove();

    async componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('focus', this.handleFocus);
        this.props.navigation.addListener('blur', this.handleBlur);

        this.handleAppStateChangeSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
        );

        const {
            SettingsStore: { updateSettings }
        } = this.props;

        const supportedBiometryType = await getSupportedBiometryType();

        await updateSettings({ supportedBiometryType });
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('focus', this.handleFocus);
        this.handleAppStateChangeSubscription?.remove();
        this.backPressSubscription?.remove();
    }

    handleAppStateChange = (nextAppState: any) => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;
        const { loginBackground } = settings;

        if (
            nextAppState === 'background' &&
            SettingsStore.loginMethodConfigured() &&
            loginBackground
        ) {
            SettingsStore.setLoginStatus(false);
        } else if (nextAppState === 'active' && SettingsStore.loginRequired()) {
            this.props.navigation.navigate('Lockscreen');
        }
    };

    async startListeners() {
        Linking.addEventListener('url', this.handleOpenURL);
    }

    async getSettingsAndNavigate() {
        const { SettingsStore, navigation } = this.props;
        const { posStatus, setPosStatus, initialStart } = SettingsStore;

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then(async (settings: Settings) => {
            SystemNavigationBar.setNavigationColor(
                themeColor('background'),
                isLightTheme() ? 'dark' : 'light'
            );
            SystemNavigationBar.setNavigationBarDividerColor(
                themeColor('secondary')
            );
            const loginRequired = SettingsStore.loginRequired();
            const posEnabled =
                settings?.pos?.posEnabled &&
                settings.pos.posEnabled !== PosEnabled.Disabled;

            if (!loginRequired) SettingsStore.setLoginStatus(true);

            if (posEnabled && posStatus === 'inactive' && loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (posEnabled && posStatus === 'unselected') {
                setPosStatus('active');
                if (!this.state.unlocked) {
                    this.startListeners();
                    this.setState({ unlocked: true });
                }
                this.fetchData();
            } else if (loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
                if (settings.selectNodeOnStartup && initialStart) {
                    navigation.navigate('Wallets');
                }
                if (!this.state.unlocked) {
                    this.startListeners();
                    this.setState({ unlocked: true });
                }
                this.fetchData();
            } else {
                navigation.navigate('IntroSplash');
            }
        });
    }

    async fetchData() {
        const {
            AlertStore,
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            UTXOsStore,
            ContactStore,
            SettingsStore,
            PosStore,
            FiatStore,
            LSPStore,
            ChannelBackupStore,
            SyncStore,
            LightningAddressStore,
            LnurlPayStore,
            NotesStore
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login,
            connecting,
            setConnectingStatus,
            connect,
            posStatus,
            walletPassword,
            embeddedLndNetwork,
            updateSettings
        } = SettingsStore;
        const { isSyncing } = SyncStore;
        const {
            fiatEnabled,
            pos,
            rescan,
            compactDb,
            recovery,
            lightningAddress,
            embeddedTor,
            initialLoad
        } = settings;
        const expressGraphSyncEnabled =
            settings.expressGraphSync && embeddedLndNetwork === 'Mainnet';

        let start;
        if (connecting) {
            start = new Date().getTime();
            AlertStore.reset();
            NodeInfoStore.reset();
            BalanceStore.reset();
            ChannelsStore.reset();
            SyncStore.reset();
            LightningAddressStore.reset();
            LSPStore.reset();
            ChannelBackupStore.reset();
            UTXOsStore.reset();
            ContactStore.loadContacts();
            NotesStore.loadNoteKeys();
        }

        LnurlPayStore.reset();

        if (
            pos?.posEnabled &&
            pos.posEnabled !== PosEnabled.Disabled &&
            posStatus === 'active'
        ) {
            PosStore.getOrders();
        }

        if (fiatEnabled) {
            FiatStore.getFiatRates();
        }

        if (implementation === 'embedded-lnd') {
            if (connecting) {
                AlertStore.checkNeutrinoPeers();
                await initializeLnd(
                    embeddedLndNetwork === 'Testnet',
                    rescan,
                    compactDb
                );

                // on initial load, do not run EGS
                if (initialLoad) {
                    await updateSettings({
                        initialLoad: false
                    });
                } else {
                    if (expressGraphSyncEnabled) {
                        await expressGraphSync();
                        if (settings.resetExpressGraphSyncOnStartup) {
                            await updateSettings({
                                resetExpressGraphSyncOnStartup: false
                            });
                        }
                    }
                }

                await startLnd(
                    walletPassword,
                    embeddedTor,
                    embeddedLndNetwork === 'Testnet'
                );
            }
            if (implementation === 'embedded-lnd')
                SyncStore.checkRecoveryStatus();
            await NodeInfoStore.getNodeInfo();
            NodeInfoStore.getNetworkInfo();
            if (BackendUtils.supportsAccounts()) UTXOsStore.listAccounts();
            await BalanceStore.getCombinedBalance(false);
            if (BackendUtils.supportsChannelManagement())
                ChannelsStore.getChannels();
            if (rescan) {
                await updateSettings({
                    rescan: false
                });
            }
            if (recovery) {
                const isBackedUp = await EncryptedStorage.getItem(
                    'backup-complete'
                );
                if (!isBackedUp) {
                    await EncryptedStorage.setItem(
                        'backup-complete',
                        JSON.stringify(true)
                    );
                }
                if (isSyncing) return;
                try {
                    await ChannelBackupStore.recoverStaticChannelBackup();

                    await updateSettings({
                        recovery: false
                    });

                    if (SettingsStore.settings.automaticDisasterRecoveryBackup)
                        ChannelBackupStore.initSubscribeChannelEvents();
                } catch (e) {
                    console.error('recover error', e);
                }
            } else {
                if (SettingsStore.settings.automaticDisasterRecoveryBackup)
                    ChannelBackupStore.initSubscribeChannelEvents();
            }
        } else if (implementation === 'lndhub') {
            if (connecting) {
                try {
                    await login({ login: username, password });
                    await BalanceStore.getLightningBalance(true);
                } catch (connectionError) {
                    console.log('LNDHub connection failed:', connectionError);
                    return;
                }
            } else {
                BalanceStore.getLightningBalance(true);
            }
        } else if (implementation === 'lightning-node-connect') {
            let error;
            if (connecting) {
                error = await connect();
            }
            if (!error) {
                try {
                    await BackendUtils.checkPerms();
                    await NodeInfoStore.getNodeInfo();
                    if (BackendUtils.supportsAccounts())
                        await UTXOsStore.listAccounts();
                    await BalanceStore.getCombinedBalance();
                    if (BackendUtils.supportsChannelManagement())
                        ChannelsStore.getChannels();
                } catch (connectionError) {
                    console.log('LNC connection failed:', connectionError);
                    return;
                }
            }
        } else {
            try {
                await NodeInfoStore.getNodeInfo();
                if (BackendUtils.supportsAccounts()) {
                    UTXOsStore.listAccounts();
                }
                await BalanceStore.getCombinedBalance();
                ChannelsStore.getChannels();
            } catch (connectionError) {
                console.log('Node connection failed:', connectionError);
                NodeInfoStore.getNodeInfoError();
                setConnectingStatus(false);
                return;
            }
        }

        if (
            lightningAddress.enabled &&
            BackendUtils.supportsCustomPreimages() &&
            !NodeInfoStore.testnet
        ) {
            if (connecting) {
                try {
                    await LightningAddressStore.status();

                    if (lightningAddress.automaticallyAccept) {
                        LightningAddressStore.prepareToAutomaticallyAccept();
                    }

                    if (
                        // TODO add enum
                        SettingsStore.settings.lightningAddress
                            ?.notifications === 1
                    ) {
                        LightningAddressStore.updatePushCredentials();
                    }
                } catch (e) {
                    console.error('Lightning address error', e);
                }
            }
        }

        if (connecting && start != null) {
            console.log(
                'connect time: ' + (new Date().getTime() - start) / 1000 + 's'
            );
            setConnectingStatus(false);
            SettingsStore.setInitialStart(false);
        }

        if (BackendUtils.supportsLSPs()) {
            if (
                SettingsStore.settings.enableLSP &&
                (implementation !== 'lnd' ||
                    !this.props.NodeInfoStore.lspNotConfigured)
            ) {
                await LSPStore.getLSPInfo();
            }
            LSPStore.initChannelAcceptor();
        }

        // only navigate to initial url after connection and main calls are made
        if (
            this.state.initialLoad &&
            !(
                SettingsStore.settings.selectNodeOnStartup &&
                SettingsStore.initialStart
            )
        ) {
            this.setState({
                initialLoad: false
            });
            LinkingUtils.handleInitialUrl(this.props.navigation);
        }
    }

    handleOpenURL = (event: any) => {
        const { navigation } = this.props;
        if (event.url) {
            LinkingUtils.handleDeepLink(event.url, navigation);
        }
    };

    render() {
        const Tab = createBottomTabNavigator();
        const {
            NodeInfoStore,
            BalanceStore,
            SettingsStore,
            SyncStore,
            navigation
        } = this.props;
        const { isSyncing, isInExpressGraphSync } = SyncStore;
        const { nodeInfo } = NodeInfoStore;
        const error = NodeInfoStore.error || SettingsStore.error;
        const {
            implementation,
            settings,
            loggedIn,
            connecting,
            posStatus,
            setConnectingStatus
        } = SettingsStore;
        const loginRequired = !settings || SettingsStore.loginRequired();

        const posEnabled: PosEnabled =
            settings?.pos?.posEnabled || PosEnabled.Disabled;

        const showKeypad: boolean = settings?.pos?.showKeypad || false;

        const dataAvailable = implementation === 'lndhub' || nodeInfo.version;

        // Define the type for implementationDisplayValue
        interface ImplementationDisplayValue {
            [key: string]: string;
        }

        const implementationDisplayValue: ImplementationDisplayValue = {};
        INTERFACE_KEYS.forEach((item) => {
            implementationDisplayValue[item.value] = item.key;
        });

        const BalanceScreen = () => {
            return (
                <Screen>
                    <BalancePane
                        navigation={navigation}
                        NodeInfoStore={NodeInfoStore}
                        BalanceStore={BalanceStore}
                        SettingsStore={SettingsStore}
                        SyncStore={SyncStore}
                    />

                    {error && (
                        <View style={{ backgroundColor: themeColor('error') }}>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: '#fff',
                                    fontSize: 12,
                                    marginBottom: 15,
                                    textAlign: 'center'
                                }}
                            >
                                {`v${version} | ${implementationDisplayValue[implementation]}`}
                            </Text>
                            <Button
                                icon={{
                                    name: 'settings',
                                    size: 25,
                                    color: '#fff'
                                }}
                                title={localeString(
                                    'views.Wallet.MainPane.goToSettings'
                                )}
                                buttonStyle={{
                                    backgroundColor: 'gray',
                                    marginBottom: 20
                                }}
                                onPress={() =>
                                    protectedNavigation(navigation, 'Menu')
                                }
                            />
                            <Button
                                title={localeString('views.Wallet.restart')}
                                icon={{
                                    name: 'sync',
                                    size: 25
                                }}
                                onPress={() => {
                                    if (Platform.OS === 'android') {
                                        RNRestart.Restart();
                                    } else {
                                        setConnectingStatus(true);
                                        this.getSettingsAndNavigate();
                                    }
                                }}
                            />
                        </View>
                    )}

                    {dataAvailable && !error && (
                        <>
                            <LayerBalances
                                navigation={navigation}
                                onRefresh={() => this.getSettingsAndNavigate()}
                                locked={isSyncing}
                                consolidated
                            />

                            <Animated.View
                                style={{
                                    flex: 1,
                                    maxHeight: 80,
                                    justifyContent: 'flex-end',
                                    alignSelf: 'center',
                                    bottom: 10,
                                    paddingTop: 40,
                                    paddingBottom: 35,
                                    width: '100%',
                                    transform: [{ translateY: this.pan.y }],
                                    alignItems: 'center'
                                }}
                                {...this.panResponder.panHandlers}
                            >
                                <TouchableOpacity
                                    onPress={() =>
                                        this.props.navigation.navigate(
                                            'Activity',
                                            { animation: 'slide_from_bottom' }
                                        )
                                    }
                                    accessibilityLabel={localeString(
                                        'general.activity'
                                    )}
                                >
                                    <CaretUp fill={themeColor('text')} />
                                </TouchableOpacity>
                            </Animated.View>
                        </>
                    )}
                </Screen>
            );
        };

        const PosScreen = () => {
            return (
                <Screen>
                    {posEnabled === PosEnabled.Square && (
                        <SquarePosPane navigation={navigation} />
                    )}
                    {posEnabled === PosEnabled.Standalone && (
                        <StandalonePosPane navigation={navigation} />
                    )}
                </Screen>
            );
        };

        const PosKeypadScreen = () => {
            return (
                <Screen>
                    <StandalonePosKeypadPane navigation={navigation} />
                </Screen>
            );
        };

        const KeypadScreen = () => {
            return (
                <Screen>
                    <KeypadPane navigation={navigation} />
                </Screen>
            );
        };

        const CameraScreen: any = () => {};

        const ChannelsScreen = () => {
            return (
                <Screen>
                    <ChannelsPane navigation={navigation} />
                </Screen>
            );
        };

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                background: themeColor('background'),
                card: error ? themeColor('error') : themeColor('background'),
                border: error ? themeColor('error') : themeColor('background')
            }
        };

        return (
            <View style={{ flex: 1 }}>
                {!connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <NavigationIndependentTree>
                            <NavigationContainer
                                theme={Theme}
                                ref={this.tabNavigationRef}
                            >
                                <Tab.Navigator
                                    initialRouteName={
                                        posEnabled !== PosEnabled.Disabled &&
                                        posStatus === 'active'
                                            ? (settings.pos &&
                                                  settings.pos.defaultView) ||
                                              'Products'
                                            : isSyncing
                                            ? 'Balance'
                                            : (settings.display &&
                                                  settings.display
                                                      .defaultView) ||
                                              'Keypad'
                                    }
                                    backBehavior="none"
                                    screenOptions={({ route }) => ({
                                        tabBarIcon: ({ color }) => {
                                            if (
                                                isSyncing &&
                                                route.name === 'Keypad'
                                            ) {
                                                return;
                                            }
                                            if (route.name === 'Keypad') {
                                                return <Bitcoin fill={color} />;
                                            }
                                            if (route.name === 'Balance') {
                                                return <Temple fill={color} />;
                                            }
                                            if (route.name === 'Products') {
                                                return <POS stroke={color} />;
                                            }
                                            if (route.name === 'POS Keypad') {
                                                return <Bitcoin fill={color} />;
                                            }
                                            if (route.name === 'Camera') {
                                                return (
                                                    <Scan
                                                        fill={color}
                                                        width={20}
                                                    />
                                                );
                                            }
                                            if (
                                                BackendUtils.supportsChannelManagement()
                                            ) {
                                                return (
                                                    <ChannelsIcon
                                                        height={26}
                                                        width={26}
                                                        fill={color}
                                                    />
                                                );
                                            }
                                        },
                                        headerShown: false,
                                        tabBarActiveTintColor: error
                                            ? themeColor('error')
                                            : themeColor('text'),
                                        tabBarInactiveTintColor: error
                                            ? themeColor('error')
                                            : 'gray',
                                        tabBarShowLabel: false,
                                        tabBarStyle: {
                                            paddingBottom: 12
                                        },
                                        animation: 'shift'
                                    })}
                                >
                                    {posEnabled !== PosEnabled.Disabled &&
                                    posStatus === 'active' ? (
                                        <Tab.Screen
                                            name="POS"
                                            component={PosScreen}
                                        />
                                    ) : (
                                        <Tab.Screen
                                            name="Balance"
                                            component={BalanceScreen}
                                        />
                                    )}
                                    {posEnabled === PosEnabled.Standalone &&
                                        posStatus === 'active' &&
                                        showKeypad && (
                                            <Tab.Screen
                                                name="POS Keypad"
                                                component={PosKeypadScreen}
                                            />
                                        )}
                                    {posStatus !== 'active' && (
                                        <>
                                            {!error && !isSyncing && (
                                                <Tab.Screen
                                                    name="Keypad"
                                                    component={KeypadScreen}
                                                />
                                            )}
                                            {BackendUtils.supportsChannelManagement() &&
                                                !error &&
                                                !isSyncing && (
                                                    <Tab.Screen
                                                        name={localeString(
                                                            'views.Wallet.Wallet.channels'
                                                        )}
                                                        component={
                                                            ChannelsScreen
                                                        }
                                                    />
                                                )}
                                        </>
                                    )}
                                    {posStatus !== 'active' && !error && (
                                        <Tab.Screen
                                            name="Camera"
                                            component={CameraScreen}
                                            listeners={{
                                                tabPress: (e) => {
                                                    // Prevent default action
                                                    e.preventDefault();
                                                    navigation.navigate(
                                                        'HandleAnythingQRScanner'
                                                    );
                                                }
                                            }}
                                        />
                                    )}
                                </Tab.Navigator>
                            </NavigationContainer>
                        </NavigationIndependentTree>
                    )}
                {connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <Screen>
                            <View
                                style={{
                                    position: 'absolute',
                                    zIndex: 1
                                }}
                            >
                                <WalletHeader navigation={navigation} loading />
                            </View>
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <LoadingColumns />
                                <View
                                    style={{
                                        position: 'absolute',
                                        bottom: 130
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            alignSelf: 'center',
                                            fontSize: 15,
                                            padding: 8
                                        }}
                                    >
                                        {settings.nodes &&
                                        loggedIn &&
                                        implementation
                                            ? implementation === 'embedded-lnd'
                                                ? isInExpressGraphSync
                                                    ? localeString(
                                                          'views.Wallet.Wallet.expressGraphSync'
                                                      ).replace('Zeus', 'ZEUS')
                                                    : localeString(
                                                          'views.Wallet.Wallet.startingNode'
                                                      ).replace('Zeus', 'ZEUS')
                                                : implementation === 'lndhub'
                                                ? localeString(
                                                      'views.Wallet.Wallet.loadingAccount'
                                                  ).replace('Zeus', 'ZEUS')
                                                : localeString(
                                                      'views.Wallet.Wallet.connecting'
                                                  ).replace('Zeus', 'ZEUS')
                                            : localeString(
                                                  'views.Wallet.Wallet.startingUp'
                                              ).replace('Zeus', 'ZEUS')}
                                    </Text>
                                    <View style={{ marginTop: 40 }}>
                                        <LoadingIndicator />
                                    </View>
                                </View>
                            </View>
                            {isInExpressGraphSync && (
                                <View
                                    style={{
                                        bottom: 70,
                                        position: 'absolute',
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Button
                                        title={localeString('general.skip')}
                                        containerStyle={{
                                            width: 320
                                        }}
                                        titleStyle={{
                                            color: themeColor('text')
                                        }}
                                        onPress={() => {
                                            SyncStore.setExpressGraphSyncStatus(
                                                false
                                            );
                                        }}
                                        adaptiveWidth
                                        iconOnly
                                    />
                                </View>
                            )}
                            <View
                                style={{
                                    bottom: 15,
                                    position: 'absolute',
                                    alignSelf: 'center'
                                }}
                            >
                                <Button
                                    title={
                                        settings.nodes
                                            ? localeString(
                                                  'views.Settings.title'
                                              )
                                            : null
                                    }
                                    containerStyle={{
                                        width: 320
                                    }}
                                    titleStyle={{
                                        color: themeColor('text')
                                    }}
                                    onPress={() => {
                                        if (settings.nodes)
                                            protectedNavigation(
                                                navigation,
                                                'Menu'
                                            );
                                    }}
                                    adaptiveWidth
                                    iconOnly
                                />
                            </View>
                        </Screen>
                    )}
            </View>
        );
    }
}
