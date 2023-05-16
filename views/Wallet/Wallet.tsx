import * as React from 'react';
import {
    Animated,
    AppState,
    Linking,
    PanResponder,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { inject, observer } from 'mobx-react';
import RNRestart from 'react-native-restart';

import ChannelsPane from '../Channels/ChannelsPane';
import BalancePane from './BalancePane';
import KeypadPane from './KeypadPane';
import PosPane from './PosPane';

import Button from './../../components/Button';
import LayerBalances from './../../components/LayerBalances';
import LoadingIndicator from './../../components/LoadingIndicator';
import Screen from './../../components/Screen';

import BackendUtils from './../../utils/BackendUtils';
import LinkingUtils from './../../utils/LinkingUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';

import FiatStore from './../../stores/FiatStore';
import NodeInfoStore from './../../stores/NodeInfoStore';
import PosStore from './../../stores/PosStore';
import SettingsStore, { Settings } from './../../stores/SettingsStore';
import UnitsStore from './../../stores/UnitsStore';
import UTXOsStore from './../../stores/UTXOsStore';

import {
    getIsBiometryRequired,
    getSupportedBiometryType
} from '../../utils/BiometricUtils';
import Bitcoin from './../../assets/images/SVG/Bitcoin.svg';
import CaretUp from './../../assets/images/SVG/Caret Up.svg';
import ChannelsIcon from './../../assets/images/SVG/Channels.svg';
import POS from './../../assets/images/SVG/POS.svg';
import Temple from './../../assets/images/SVG/Temple.svg';
import WordLogo from './../../assets/images/SVG/Word Logo.svg';
import { Implementation } from '../../enums';

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
    'UTXOsStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, WalletState> {
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

    async componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.getSettingsAndNavigate();
        });

        AppState.addEventListener('change', this.handleAppStateChange);
    }

    componentWillUnmount() {
        this.props.navigation.removeListener &&
            this.props.navigation.removeListener('didFocus');
        AppState.removeEventListener &&
            AppState.removeEventListener('change', this.handleAppStateChange);
    }

    handleAppStateChange = (nextAppState: any) => {
        const { SettingsStore } = this.props;
        const { settings, implementation } = SettingsStore;
        const { loginBackground } = settings;
        const loginRequired =
            settings &&
            (!!settings.passphrase ||
                !!settings.pin ||
                settings.isBiometryEnabled);

        if (nextAppState === 'background' && loginRequired && loginBackground) {
            if (implementation === Implementation.LightningNodeConnect) {
                BackendUtils.disconnect();
            }

            RNRestart.Restart();
        }
    };

    startListeners() {
        Linking.addEventListener('url', this.handleOpenURL);
    }

    async getSettingsAndNavigate() {
        const { SettingsStore, navigation } = this.props;
        const { posStatus, setPosStatus } = SettingsStore;

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then(async (settings: Settings) => {
            const isBiometryRequired = getIsBiometryRequired(settings);

            const loginRequired =
                settings &&
                (settings.passphrase || settings.pin || isBiometryRequired) &&
                !SettingsStore.loggedIn;
            const posEnabled =
                settings && settings.pos && settings.pos.squareEnabled;

            if (!loginRequired) SettingsStore.setLoginStatus(true);

            if (posEnabled && posStatus === 'inactive' && loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (posEnabled && posStatus === 'unselected') {
                await setPosStatus('active');
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

    async refresh() {
        const { NodeInfoStore, BalanceStore, ChannelsStore, SettingsStore } =
            this.props;

        if (SettingsStore.connecting) {
            NodeInfoStore.reset();
            BalanceStore.reset();
            ChannelsStore.reset();
        }

        this.getSettingsAndNavigate();
    }

    async fetchData() {
        const {
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            UTXOsStore,
            SettingsStore,
            PosStore,
            FiatStore
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
            posStatus
        } = SettingsStore;
        const { fiat, pos } = settings;

        if (pos && pos.squareEnabled && posStatus === 'active')
            PosStore.getOrders();

        if (!!fiat && fiat !== 'Disabled') {
            FiatStore.getFiatRates();
        }

        if (implementation === Implementation.lndhub) {
            if (connecting) {
                await login({ login: username, password }).then(async () => {
                    BalanceStore.getLightningBalance(true);
                });
            } else {
                BalanceStore.getLightningBalance(true);
            }
        } else if (implementation === Implementation.LightningNodeConnect) {
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
            navigation
        } = this.props;
        const { nodeInfo } = NodeInfoStore;
        const error = NodeInfoStore.error || SettingsStore.error;
        const { implementation, settings, loggedIn, connecting, posStatus } =
            SettingsStore;
        const loginRequired =
            !settings ||
            (settings &&
                (settings.passphrase || settings.pin) &&
                !loggedIn &&
                settings.pos);

        const squareEnabled: boolean =
            (settings && settings.pos && settings.pos.squareEnabled) || false;

        const dataAvailable =
            implementation === Implementation.lndhub || nodeInfo.version;

        const BalanceScreen = () => {
            return (
                <Screen>
                    <BalancePane
                        navigation={navigation}
                        NodeInfoStore={NodeInfoStore}
                        UnitsStore={UnitsStore}
                        BalanceStore={BalanceStore}
                        SettingsStore={SettingsStore}
                    />

                    {error && (
                        <View style={{ backgroundColor: themeColor('error') }}>
                            <Button
                                title={localeString('views.Wallet.restart')}
                                icon={{
                                    name: 'sync',
                                    size: 25
                                }}
                                onPress={() => RNRestart.Restart()}
                            />
                        </View>
                    )}

                    {dataAvailable && !error && (
                        <>
                            <LayerBalances
                                navigation={navigation}
                                BalanceStore={BalanceStore}
                                UnitsStore={UnitsStore}
                                SettingsStore={SettingsStore}
                                onRefresh={() => this.refresh()}
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
                                >
                                    <CaretUp
                                        stroke={themeColor('text')}
                                        fill={themeColor('text')}
                                    />
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
                    <PosPane navigation={navigation} />
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
                {!connecting && (!loginRequired || squareEnabled) && (
                    <NavigationContainer theme={Theme}>
                        <Tab.Navigator
                            initialRouteName={
                                squareEnabled && posStatus === 'active'
                                    ? 'POS'
                                    : (settings.display &&
                                          settings.display.defaultView) ||
                                      'Keypad'
                            }
                            screenOptions={({ route }) => ({
                                tabBarIcon: ({ color }) => {
                                    if (route.name === 'Keypad') {
                                        return (
                                            <Bitcoin height={20} fill={color} />
                                        );
                                    }
                                    if (route.name === 'Balance') {
                                        return <Temple fill={color} />;
                                    }
                                    if (route.name === 'POS') {
                                        return (
                                            <POS stroke={themeColor('text')} />
                                        );
                                    }
                                    if (
                                        BackendUtils.supportsChannelManagement()
                                    ) {
                                        return <ChannelsIcon fill={color} />;
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
                            {squareEnabled && posStatus === 'active' ? (
                                <Tab.Screen name="POS" component={PosScreen} />
                            ) : (
                                <Tab.Screen
                                    name="Balance"
                                    component={BalanceScreen}
                                />
                            )}
                            {posStatus !== 'active' && (
                                <>
                                    {!error ? (
                                        <Tab.Screen
                                            name="Keypad"
                                            component={KeypadScreen}
                                        />
                                    ) : (
                                        <Tab.Screen
                                            name={'  '}
                                            component={BalanceScreen}
                                        />
                                    )}
                                    {BackendUtils.supportsChannelManagement() &&
                                        !error && (
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
                {connecting && (!loginRequired || squareEnabled) && (
                    <Screen>
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                top: 10
                            }}
                        >
                            <WordLogo
                                height={100}
                                style={{
                                    alignSelf: 'center'
                                }}
                            />
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    fontFamily: 'Lato-Regular',
                                    alignSelf: 'center',
                                    fontSize: 15,
                                    padding: 8
                                }}
                            >
                                {settings.nodes && loggedIn
                                    ? localeString(
                                          'views.Wallet.Wallet.connecting'
                                      )
                                    : localeString(
                                          'views.Wallet.Wallet.startingUp'
                                      )}
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
