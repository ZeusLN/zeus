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
    NavigationContainerRef
} from '@react-navigation/native';
import { inject, observer } from 'mobx-react';
import RNRestart from 'react-native-restart';

import ChannelsPane from '../Channels/ChannelsPane';
import BalancePane from './BalancePane';
import KeypadPane from './KeypadPane';
import SquarePosPane from './SquarePosPane';
import StandalonePosPane from './StandalonePosPane';

import Button from '../../components/Button';
import LayerBalances from '../../components/LayerBalances';
import LoadingColumns from '../../components/LoadingColumns';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';

import BackendUtils from '../../utils/BackendUtils';
import { getSupportedBiometryType } from '../../utils/BiometricUtils';
import LinkingUtils from '../../utils/LinkingUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import BalanceStore from '../../stores/BalanceStore';
import ChannelsStore from '../../stores/ChannelsStore';
import FiatStore from '../../stores/FiatStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import PosStore from '../../stores/PosStore';
import SettingsStore, {
    PosEnabled,
    Settings
} from '../../stores/SettingsStore';
import UnitsStore, { SATS_PER_BTC } from '../../stores/UnitsStore';
import UTXOsStore from '../../stores/UTXOsStore';
import ModalStore from '../../stores/ModalStore';
import SyncStore from '../../stores/SyncStore';
import LSPStore from '../../stores/LSPStore';
import ChannelBackupStore from '../../stores/ChannelBackupStore';
import LightningAddressStore from '../../stores/LightningAddressStore';
import LnurlPayStore from '../../stores/LnurlPayStore';

import Bitcoin from '../../assets/images/SVG/Bitcoin.svg';
import CaretUp from '../../assets/images/SVG/Caret Up.svg';
import ChannelsIcon from '../../assets/images/SVG/Channels.svg';
import POS from '../../assets/images/SVG/POS.svg';
import Temple from '../../assets/images/SVG/Temple.svg';

import {
    initializeLnd,
    startLnd,
    expressGraphSync
} from '../../utils/LndMobileUtils';
import Order from '../../models/Order';
import BigNumber from 'bignumber.js';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
    PosStore: PosStore;
    UTXOsStore: UTXOsStore;
    ModalStore: ModalStore;
    SyncStore: SyncStore;
    LSPStore: LSPStore;
    ChannelBackupStore: ChannelBackupStore;
    LightningAddressStore: LightningAddressStore;
    LnurlPayStore: LnurlPayStore;
}

interface WalletState {
    unlocked: boolean;
    initialLoad: boolean;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'NodeInfoStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore',
    'PosStore',
    'UTXOsStore',
    'ModalStore',
    'SyncStore',
    'LSPStore',
    'LnurlPayStore',
    'ChannelBackupStore',
    'LightningAddressStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
    private tabNavigationRef = React.createRef<NavigationContainerRef<any>>();
    private pan: Animated.ValueXY;
    private panResponder: PanResponderInstance;
    private handleAppStateChangeSubscription: NativeEventSubscription;
    private backPressSubscription: NativeEventSubscription;

    constructor(props) {
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
                props.navigation.navigate('Activity');
            }
        });
    }

    async UNSAFE_componentWillMount(): Promise<void> {
        const {
            SettingsStore: { updateSettings }
        } = this.props;

        const supportedBiometryType = await getSupportedBiometryType();

        await updateSettings({ supportedBiometryType });
    }

    private handleBackButton() {
        const dialogHasBeenClosed =
            this.props.ModalStore.closeVisibleModalDialog();
        if (dialogHasBeenClosed) {
            return true;
        }

        if (this.props.SettingsStore.loginRequired()) {
            // pop to close lock screen and return false to close the app
            this.props.navigation.pop();
            return false;
        }

        if (this.props.navigation.pop()) {
            return true;
        }

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

    async componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.getSettingsAndNavigate();
        });

        this.handleAppStateChangeSubscription = AppState.addEventListener(
            'change',
            this.handleAppStateChange
        );
        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackButton.bind(this)
        );
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('didFocus');
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
            // In case the lock screen is visible and a valid PIN is entered and home button is pressed,
            // unauthorized access would be possible because the PIN is not cleared on next launch.
            // By calling pop, the lock screen is closed to clear the PIN.
            this.props.navigation.pop();
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
        const { posStatus, setPosStatus } = SettingsStore;

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then(async (settings: Settings) => {
            const loginRequired = SettingsStore.loginRequired();
            const posEnabled =
                settings &&
                settings.pos &&
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
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            UTXOsStore,
            SettingsStore,
            PosStore,
            FiatStore,
            LSPStore,
            ChannelBackupStore,
            SyncStore,
            LightningAddressStore,
            LnurlPayStore
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
            recovery,
            lightningAddress,
            initialLoad
        } = settings;
        const expressGraphSyncEnabled = settings.expressGraphSync;

        if (connecting) {
            NodeInfoStore.reset();
            BalanceStore.reset();
            ChannelsStore.reset();
            SyncStore.reset();
            LightningAddressStore.reset();
            LSPStore.reset();
            ChannelBackupStore.reset();
        }

        LnurlPayStore.reset();

        if (
            pos &&
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
                await initializeLnd(embeddedLndNetwork === 'Testnet', rescan);

                // on initial load, do not run EGS
                if (initialLoad) {
                    await updateSettings({
                        initialLoad: false
                    });
                } else {
                    if (expressGraphSyncEnabled) await expressGraphSync();
                }

                await startLnd(walletPassword);
            }
            if (BackendUtils.supportsLSPs()) {
                if (SettingsStore.settings.enableLSP) {
                    LSPStore.getLSPInfo();
                }
                LSPStore.initChannelAcceptor();
            }
            NodeInfoStore.getNodeInfo();
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
                if (isSyncing) return;
                try {
                    await ChannelBackupStore.recoverStaticChannelBackup();

                    await updateSettings({
                        recovery: false
                    });

                    if (SettingsStore.settings.automaticDisasterRecoveryBackup)
                        ChannelBackupStore.initSubscribeChannelEvents();
                } catch (e) {
                    console.log('recover error', e);
                }
            } else {
                if (SettingsStore.settings.automaticDisasterRecoveryBackup)
                    ChannelBackupStore.initSubscribeChannelEvents();
            }
        } else if (implementation === 'lndhub') {
            if (connecting) {
                await login({ login: username, password }).then(async () => {
                    BalanceStore.getLightningBalance(true);
                });
            } else {
                BalanceStore.getLightningBalance(true);
            }
        } else if (implementation === 'lightning-node-connect') {
            let error;
            if (connecting) {
                error = await connect();
            }
            if (!error) {
                await BackendUtils.checkPerms();
                NodeInfoStore.getNodeInfo();
                if (BackendUtils.supportsAccounts()) UTXOsStore.listAccounts();
                await BalanceStore.getCombinedBalance();
                if (BackendUtils.supportsChannelManagement())
                    ChannelsStore.getChannels();
            }
        } else {
            NodeInfoStore.getNodeInfo();
            if (BackendUtils.supportsAccounts()) {
                UTXOsStore.listAccounts();
            }

            await BalanceStore.getCombinedBalance();
            ChannelsStore.getChannels();
        }

        if (
            lightningAddress.enabled &&
            BackendUtils.supportsCustomPreimages() &&
            !NodeInfoStore.testnet
        ) {
            if (connecting) {
                LightningAddressStore.status();

                if (lightningAddress.automaticallyAccept) {
                    LightningAddressStore.prepareToAutomaticallyAccept();
                }

                if (
                    // TODO add enum
                    SettingsStore.settings.lightningAddress?.notifications === 1
                ) {
                    LightningAddressStore.updatePushCredentials();
                }
            }
        }

        if (connecting) {
            setConnectingStatus(false);
        }

        // only navigate to initial url after connection and main calls are made
        if (this.state.initialLoad) {
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
            UnitsStore,
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
            (settings && settings.pos && settings.pos.posEnabled) ||
            PosEnabled.Disabled;

        const dataAvailable = implementation === 'lndhub' || nodeInfo.version;

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
                                BalanceStore={BalanceStore}
                                UnitsStore={UnitsStore}
                                onRefresh={() => this.getSettingsAndNavigate()}
                                locked={isSyncing}
                            />

                            <Animated.View
                                style={{
                                    flex: 1,
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
                                            'Activity'
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

        const KeypadScreen = () => {
            return (
                <Screen>
                    <KeypadPane navigation={navigation} />
                </Screen>
            );
        };

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
                card: error ? themeColor('error') : themeColor('background'),
                border: error ? themeColor('error') : themeColor('background')
            }
        };

        return (
            <View style={{ flex: 1 }}>
                {!connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <NavigationContainer
                            theme={Theme}
                            ref={this.tabNavigationRef}
                        >
                            <Tab.Navigator
                                initialRouteName={
                                    posEnabled !== PosEnabled.Disabled &&
                                    posStatus === 'active'
                                        ? 'POS'
                                        : isSyncing
                                        ? 'Balance'
                                        : (settings.display &&
                                              settings.display.defaultView) ||
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
                                            return (
                                                <Bitcoin
                                                    height={20}
                                                    fill={color}
                                                />
                                            );
                                        }
                                        if (route.name === 'Balance') {
                                            return <Temple fill={color} />;
                                        }
                                        if (route.name === 'POS') {
                                            return (
                                                <POS
                                                    stroke={themeColor('text')}
                                                />
                                            );
                                        }
                                        if (
                                            BackendUtils.supportsChannelManagement()
                                        ) {
                                            return (
                                                <ChannelsIcon fill={color} />
                                            );
                                        }
                                    }
                                })}
                                tabBarOptions={{
                                    activeTintColor: error
                                        ? themeColor('error')
                                        : themeColor('text'),
                                    inactiveTintColor: error
                                        ? themeColor('error')
                                        : 'gray',
                                    showLabel: false
                                }}
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
                                                    component={ChannelsScreen}
                                                />
                                            )}
                                    </>
                                )}
                            </Tab.Navigator>
                        </NavigationContainer>
                    )}
                {connecting &&
                    (!loginRequired || posEnabled !== PosEnabled.Disabled) && (
                        <Screen>
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <LoadingColumns />
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
                            {posStatus !== 'active' && (
                                <View
                                    style={{
                                        bottom: 56,
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
                                                navigation.navigate('Settings');
                                        }}
                                        adaptiveWidth
                                        iconOnly
                                    />
                                </View>
                            )}
                        </Screen>
                    )}
            </View>
        );
    }
}
