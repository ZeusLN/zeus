import * as React from 'react';
import { Image, Linking, Text, View, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Button, ButtonGroup } from 'react-native-elements';

import Channels from './Channels';
import MainPane from './MainPane';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';
import Clipboard from '@react-native-community/clipboard';

import BalanceStore from './../../stores/BalanceStore';
import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';

import NodeInfoStore from './../../stores/NodeInfoStore';
import SettingsStore from './../../stores/SettingsStore';
import FiatStore from './../../stores/FiatStore';
import UnitsStore from './../../stores/UnitsStore';
import LayerBalances from './../../components/LayerBalances';

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import WalletIcon from './../../images/SVG/Wallet.svg';
import ChannelsIcon from './../../images/SVG/Channels.svg';
import QRIcon from './../../images/SVG/QR.svg';
import CaretUp from './../../images/SVG/Caret Up.svg';

import handleAnything from './../../utils/handleAnything';
import ChannelsPane from '../Channels/ChannelsPane';

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

    componentDidMount() {
        Linking.getInitialURL()
            .then(url => {
                if (url) {
                    handleAnything(url).then(([route, props]) => {
                        this.props.navigation.navigate(route, props);
                    });
                }
            })
            .catch(err =>
                console.error(localeString('views.Wallet.Wallet.error'), err)
            );
    }

    async UNSAFE_componentWillMount() {
        this.clipboard = await Clipboard.getString();
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
        const {
            SettingsStore,
            NodeInfoStore,
            BalanceStore,
            ChannelsStore
        } = this.props;

        NodeInfoStore.reset();
        BalanceStore.reset();
        ChannelsStore.reset();

        // This awaits on settings, so should await on Tor being bootstrapped before making requests
        await SettingsStore.getSettings().then(() => {
            this.refresh();
        });
    }

    refresh = () => {
        const {
            NodeInfoStore,
            BalanceStore,
            ChannelsStore,
            FeeStore,
            SettingsStore,
            FiatStore
        } = this.props;
        const {
            settings,
            implementation,
            username,
            password,
            login
        } = SettingsStore;
        const { fiat } = settings;

        if (implementation === 'lndhub') {
            login({ login: username, password }).then(() => {
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

        const { implementation } = SettingsStore;

        const WalletScreen = () => {
            return (
                <View
                    style={{
                        backgroundColor: themeColor('background'),
                        flex: 1
                    }}
                >
                    <LinearGradient
                        colors={themeColor('gradient')}
                        style={{ flex: 1 }}
                    >
                        <MainPane
                            navigation={navigation}
                            NodeInfoStore={NodeInfoStore}
                            UnitsStore={UnitsStore}
                            BalanceStore={BalanceStore}
                            SettingsStore={SettingsStore}
                        />

                        <LayerBalances
                            navigation={navigation}
                            BalanceStore={BalanceStore}
                            UnitsStore={UnitsStore}
                        />

                        <TouchableOpacity
                            onPress={() =>
                                this.props.navigation.navigate('Activity')
                            }
                        >
                            <CaretUp
                                style={{ alignSelf: 'center', bottom: 100 }}
                            />
                        </TouchableOpacity>
                    </LinearGradient>
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
                card: themeColor('secondary'),
                border: themeColor('secondary')
            }
        };

        const scanAndSend = `${localeString('general.scan')} / ${localeString(
            'general.send'
        )}`;

        // TODO: reorg? maybe just detect if on channels page and shrink middle button
        return (
            <View style={{ flex: 1 }}>
                <NavigationContainer theme={Theme}>
                    <Tab.Navigator
                        screenOptions={({ route }) => ({
                            tabBarIcon: ({ focused, color, size }) => {
                                let iconName;

                                if (route.name === 'Wallet') {
                                    return <WalletIcon fill={color} />;
                                }
                                if (route.name === scanAndSend) {
                                    return (
                                        <TouchableOpacity
                                            style={{
                                                position: 'absolute',
                                                height: 90,
                                                width: 90,
                                                borderRadius: 90,
                                                bottom: 5,
                                                backgroundColor: themeColor(
                                                    'secondary'
                                                ),
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                shadowColor: 'black',
                                                shadowRadius: 5,
                                                shadowOpacity: 0.8,
                                                elevation: 2
                                            }}
                                            onPress={() => {
                                                const {
                                                    navigation
                                                } = this.props;
                                                // if clipboard is loaded check for potential matches, otherwise do nothing
                                                handleAnything(this.clipboard)
                                                    .then(([route, props]) => {
                                                        navigation.navigate(
                                                            route,
                                                            props
                                                        );
                                                    })
                                                    .catch(() =>
                                                        navigation.navigate(
                                                            'AddressQRCodeScanner'
                                                        )
                                                    );
                                            }}
                                        >
                                            <QRIcon
                                                style={{
                                                    padding: 25
                                                }}
                                                fill={themeColor('highlight')}
                                            />
                                        </TouchableOpacity>
                                    );
                                }
                                return <ChannelsIcon fill={color} />;
                            }
                        })}
                        tabBarOptions={{
                            activeTintColor: themeColor('highlight'),
                            inactiveTintColor: 'gray'
                        }}
                    >
                        <Tab.Screen name="Wallet" component={WalletScreen} />
                        <Tab.Screen
                            name={scanAndSend}
                            component={WalletScreen}
                        />
                        {/* TODO: the icon isn't taking on the color like the wallet one does */}
                        <Tab.Screen
                            name={localeString('views.Wallet.Wallet.channels')}
                            component={ChannelsScreen}
                        />
                    </Tab.Navigator>
                </NavigationContainer>
            </View>
        );
    }
}
