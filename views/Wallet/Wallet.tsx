import * as React from 'react';
import {
    Animated,
    PanResponder,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChannelsPane from '../Channels/ChannelsPane';
import MainPane from './MainPane';

import Button from './../../components/Button';
import LoadingIndicator from './../../components/LoadingIndicator';

import RESTUtils from './../../utils/RESTUtils';
import LinkingUtils from './../../utils/LinkingUtils';
import { restartTor } from './../../utils/TorUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';

import NodeInfoStore from './../../stores/NodeInfoStore';
import SettingsStore from './../../stores/SettingsStore';
import FiatStore from './../../stores/FiatStore';
import UnitsStore from './../../stores/UnitsStore';
import LayerBalances from './../../components/LayerBalances';

import Temple from './../../assets/images/SVG/Temple.svg';
import ChannelsIcon from './../../assets/images/SVG/Channels.svg';
import CaretUp from './../../assets/images/SVG/Caret Up.svg';
import WordLogo from './../../assets/images/SVG/Word Logo - no outline.svg';

interface WalletProps {
    enterSetup: any;
    exitTransaction: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    FiatStore: FiatStore;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'NodeInfoStore',
    'FeeStore',
    'SettingsStore',
    'UnitsStore',
    'FiatStore'
)
@observer
export default class Wallet extends React.Component<WalletProps, {}> {
    clipboard: string;

    constructor(props) {
        super(props);
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

    componentDidMount() {
        // triggers when loaded from navigation or back action
        this.props.navigation.addListener('didFocus', () => {
            this.getSettingsAndNavigate();
        });
    }

    componentWillUnmount() {
        LinkingUtils.removeEventListener();
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            this.clipboard = await Clipboard.getString();
        }

        this.refresh();
    }

    UNSAFE_componentWillReceiveProps = (nextProps: any) => {
        const { navigation } = nextProps;
        const refresh = navigation.getParam('refresh', null);

        if (refresh) {
            this.refresh();
        }
    };

    async getSettingsAndNavigate() {
        const { SettingsStore, navigation } = this.props;

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then((settings: any) => {
            const loginRequired =
                settings && settings.passphrase && !SettingsStore.loggedIn;
            if (loginRequired) {
                navigation.navigate('Lockscreen');
            } else if (
                settings &&
                settings.nodes &&
                settings.nodes.length > 0
            ) {
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

    restartTorAndReload = async () => {
        this.props.NodeInfoStore.setLoading();
        await restartTor();
        await this.refresh();
    };

    async fetchData() {
        const {
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            FeeStore,
            SettingsStore,
            FiatStore,
            navigation
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login,
            connecting,
            setConnectingStatus
        } = SettingsStore;
        const { fiat } = settings;

        if (!!fiat && fiat !== 'Disabled') {
            FiatStore.getFiatRates();
        }

        if (implementation === 'lndhub') {
            login({ login: username, password }).then(async () => {
                BalanceStore.getLightningBalance();
            });
        } else {
            await Promise.all([
                BalanceStore.getBlockchainBalance(),
                BalanceStore.getLightningBalance()
            ]);
            NodeInfoStore.getNodeInfo();
            ChannelsStore.getChannels();
            FeeStore.getFees();
        }

        if (implementation === 'lnd') {
            FeeStore.getForwardingHistory();
        }

        if (connecting) {
            setConnectingStatus(false);
            LinkingUtils.addEventListener();
            LinkingUtils.handleInitialUrl(navigation);
        }
    }

    render() {
        const Tab = createBottomTabNavigator();
        const {
            NodeInfoStore,
            UnitsStore,
            BalanceStore,
            SettingsStore,
            navigation
        } = this.props;
        const { error, nodeInfo } = NodeInfoStore;
        const { implementation, enableTor, settings, loggedIn, connecting } =
            SettingsStore;
        const loginRequired =
            !settings || (settings && settings.passphrase && !loggedIn);
        const dataAvailable = implementation === 'lndhub' || nodeInfo.version;

        const WalletScreen = () => {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        flex: 1
                    }}
                >
                    <MainPane
                        navigation={navigation}
                        NodeInfoStore={NodeInfoStore}
                        UnitsStore={UnitsStore}
                        BalanceStore={BalanceStore}
                        SettingsStore={SettingsStore}
                    />

                    {error && enableTor && (
                        <View style={{ backgroundColor: themeColor('error') }}>
                            <Button
                                title={localeString('views.Wallet.restartTor')}
                                icon={{
                                    name: 'sync',
                                    size: 25,
                                    color: 'white'
                                }}
                                onPress={() => this.restartTorAndReload()}
                            />
                        </View>
                    )}

                    {dataAvailable && (
                        <>
                            {BalanceStore.loadingLightningBalance ||
                            BalanceStore.loadingBlockchainBalance ? (
                                <LoadingIndicator size={120} />
                            ) : (
                                <LayerBalances
                                    navigation={navigation}
                                    BalanceStore={BalanceStore}
                                    UnitsStore={UnitsStore}
                                    onRefresh={() => this.refresh()}
                                    refreshing={
                                        BalanceStore.loadingLightningBalance ||
                                        BalanceStore.loadingBlockchainBalance
                                    }
                                />
                            )}

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
                </View>
            );
        };

        const ChannelsScreen = () => {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        flex: 1
                    }}
                >
                    <ChannelsPane navigation={navigation} />
                </View>
            );
        };

        const Theme = {
            ...DefaultTheme,
            colors: {
                ...DefaultTheme.colors,
                card: error ? themeColor('error') : themeColor('secondary'),
                border: error ? themeColor('error') : themeColor('secondary')
            }
        };

        return (
            <View style={{ flex: 1 }}>
                <View
                    style={{ flex: 1 }}
                >
                    {!connecting && !loginRequired && (
                        <NavigationContainer theme={Theme}>
                            <Tab.Navigator
                                screenOptions={({ route }) => ({
                                    tabBarIcon: ({ color }) => {
                                        if (route.name === 'Wallet') {
                                            return <Temple fill={color} />;
                                        }
                                        if (
                                            RESTUtils.supportsChannelManagement()
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
                                        : RESTUtils.supportsChannelManagement()
                                        ? 'gray'
                                        : themeColor('highlight'),
                                    showLabel: false
                                }}
                            >
                                <Tab.Screen
                                    name="Wallet"
                                    component={WalletScreen}
                                />
                                {RESTUtils.supportsChannelManagement() &&
                                !error ? (
                                    <Tab.Screen
                                        name={localeString(
                                            'views.Wallet.Wallet.channels'
                                        )}
                                        component={ChannelsScreen}
                                    />
                                ) : (
                                    <Tab.Screen
                                        name={' '}
                                        component={WalletScreen}
                                    />
                                )}
                            </Tab.Navigator>
                        </NavigationContainer>
                    )}
                    {connecting && !loginRequired && (
                        <View
                            style={{
                                backgroundColor: '#1F242D',
                                height: '100%'
                            }}
                        >
                            <View
                                style={{
                                    flex: 1,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    top: 50
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
                                    {localeString(
                                        'views.Wallet.Wallet.connecting'
                                    )}
                                </Text>
                                <LoadingIndicator size={120} />
                            </View>
                            <View
                                style={{
                                    bottom: 56
                                }}
                            >
                                <Button
                                    title={localeString('views.Settings.title')}
                                    buttonStyle={{
                                        backgroundColor: 'gray',
                                        borderRadius: 30
                                    }}
                                    containerStyle={{
                                        width: 320
                                    }}
                                    onPress={() =>
                                        navigation.navigate('Settings')
                                    }
                                    adaptiveWidth
                                    iconOnly
                                />
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    }
}
