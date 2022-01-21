import * as React from 'react';
import {
    Animated,
    Linking,
    PanResponder,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Button, ButtonGroup } from 'react-native-elements';

import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-community/clipboard';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChannelsPane from '../Channels/ChannelsPane';
import Channels from './Channels';
import MainPane from './MainPane';

import LoadingIndicator from './../../components/LoadingIndicator';

import PrivacyUtils from './../../utils/PrivacyUtils';
import RESTUtils from './../../utils/RESTUtils';
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

import Temple from './../../images/SVG/Temple.svg';
import ChannelsIcon from './../../images/SVG/Channels.svg';
import CaretUp from './../../images/SVG/Caret Up.svg';
import WordLogo from './../../images/SVG/Word Logo.svg';

import handleAnything from './../../utils/handleAnything';

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
        Linking.getInitialURL()
            .then((url) => {
                if (url) {
                    handleAnything(url).then(([route, props]) => {
                        this.props.navigation.navigate(route, props);
                    });
                }
            })
            .catch((err) =>
                console.error(localeString('views.Wallet.Wallet.error'), err)
            );
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            this.clipboard = await Clipboard.getString();
        }

        this.getSettingsAndRefresh();
    }

    UNSAFE_componentWillReceiveProps = (nextProps: any) => {
        const { navigation } = nextProps;
        const refresh = navigation.getParam('refresh', null);

        if (refresh) {
            this.getSettingsAndRefresh();
        }
    };

    async getSettingsAndRefresh() {
        const { SettingsStore, NodeInfoStore, BalanceStore, ChannelsStore } =
            this.props;

        NodeInfoStore.reset();
        BalanceStore.reset();
        ChannelsStore.reset();

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then(() => {
            this.refresh();
        });
    }

    restartTorAndReload = async () => {
        this.props.NodeInfoStore.setLoading();
        await restartTor();
        await this.getSettingsAndRefresh();
    };

    refresh = () => {
        const {
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            FeeStore,
            SettingsStore,
            FiatStore
        } = this.props;
        const { settings, implementation, username, password, login } =
            SettingsStore;
        const { fiat } = settings;

        if (implementation === 'lndhub') {
            login({ login: username, password }).then(() => {
                BalanceStore.resetBlockchainBalance();
                BalanceStore.getLightningBalance();
            });
        } else {
            NodeInfoStore.getNodeInfo();
            BalanceStore.getBlockchainBalance();
            BalanceStore.getLightningBalance();
            ChannelsStore.getChannels();
            FeeStore.getFees();
        }

        if (implementation === 'lnd') {
            FeeStore.getForwardingHistory();
        }

        if (!!fiat && fiat !== 'Disabled') {
            FiatStore.getFiatRates();
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
        const { error, loading, nodeInfo } = NodeInfoStore;
        const { implementation, enableTor } = SettingsStore;

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
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title={localeString('views.Wallet.restartTor')}
                                icon={{
                                    name: 'sync',
                                    size: 25,
                                    color: 'white'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'gray',
                                    borderRadius: 30
                                }}
                                onPress={() => this.restartTorAndReload()}
                            />
                        </View>
                    )}

                    {(implementation === 'lndhub' || nodeInfo.version) && (
                        <>
                            <LayerBalances
                                navigation={navigation}
                                BalanceStore={BalanceStore}
                                UnitsStore={UnitsStore}
                            />

                            <Animated.View
                                style={{
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

        const scanAndSend = `${localeString('general.scan')} / ${localeString(
            'general.send'
        )}`;

        return (
            <View style={{ flex: 1 }}>
                <LinearGradient
                    colors={themeColor('gradient')}
                    style={{ flex: 1 }}
                >
                    {!loading && (
                        <NavigationContainer theme={Theme}>
                            <Tab.Navigator
                                screenOptions={({ route }) => ({
                                    tabBarIcon: ({ focused, color, size }) => {
                                        let iconName;

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
                    {loading && (
                        <>
                            <WordLogo
                                height={150}
                                style={{ alignSelf: 'center', marginTop: 250 }}
                            />
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    alignSelf: 'center',
                                    fontSize: 15
                                }}
                            >
                                {localeString('views.Wallet.Wallet.connecting')}
                            </Text>
                            <LoadingIndicator size={120} />
                            <Button
                                icon={{
                                    name: 'settings',
                                    size: 25,
                                    color: '#fff'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'gray',
                                    borderRadius: 30,
                                    marginTop: 120
                                }}
                                containerStyle={{
                                    alignItems: 'center'
                                }}
                                onPress={() => navigation.navigate('Settings')}
                                adaptiveWidth
                            />
                        </>
                    )}
                </LinearGradient>
            </View>
        );
    }
}
