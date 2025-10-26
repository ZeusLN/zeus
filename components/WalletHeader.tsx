import React, { useEffect, useState } from 'react';
import { Badge } from '@rneui/themed';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';
import { StackNavigationProp } from '@react-navigation/stack';

import AlertStore from '../stores/AlertStore';
import CashuStore from '../stores/CashuStore';
import ChannelsStore, { ChannelsView } from '../stores/ChannelsStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import ModalStore from '../stores/ModalStore';
import SettingsStore, { PosEnabled } from '../stores/SettingsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import PosStore from '../stores/PosStore';
import SyncStore from '../stores/SyncStore';

import Header from './Header';
import LoadingIndicator from '../components/LoadingIndicator';
import NodeIdenticon from '../components/NodeIdenticon';

import handleAnything, { isClipboardValue } from '../utils/handleAnything';
import BackendUtils from '../utils/BackendUtils';
import { getPhoto } from '../utils/PhotoUtils';
import { localeString } from '../utils/LocaleUtils';
import { protectedNavigation } from '../utils/NavigationUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';

import Add from '../assets/images/SVG/Add.svg';
import Alert from '../assets/images/SVG/Alert.svg';
import CaretUp from '../assets/images/SVG/Caret Up.svg';
import ClipboardSVG from '../assets/images/SVG/Clipboard.svg';
import Ecash from '../assets/images/SVG/Ecash.svg';
import Menu from '../assets/images/SVG/Menu.svg';
import Hourglass from '../assets/images/SVG/Hourglass.svg';
import POS from '../assets/images/SVG/POS.svg';
import Search from '../assets/images/SVG/Search.svg';
import Temple from '../assets/images/SVG/Temple.svg';
import Sync from '../assets/images/SVG/Sync.svg';
import ZeusPaySVG from '../assets/images/SVG/zeus-pay.svg';

import { Body } from './text/Body';
import { Row } from '../components/layout/Row';
import ToggleButton from './ToggleButton';

const TorIcon = require('../assets/images/tor.png');

const ZeusPay = () => (
    <ZeusPaySVG fill={themeColor('highlight')} width={34.29} height={30} />
);

const ZeusPayAnimated = () => {
    let state = new Animated.Value(1);
    Animated.loop(
        Animated.sequence([
            Animated.timing(state, {
                toValue: 0,
                duration: 500,
                delay: 1000,
                useNativeDriver: true
            }),
            Animated.timing(state, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true
            })
        ])
    ).start();

    return (
        <Animated.View
            style={{
                alignSelf: 'center',
                opacity: state
            }}
        >
            <ZeusPay />
        </Animated.View>
    );
};

const ActivityButton = ({
    navigation
}: {
    navigation: StackNavigationProp<any, any>;
}) => (
    <TouchableOpacity
        onPress={() =>
            navigation.navigate('Activity', { animation: 'slide_from_bottom' })
        }
    >
        <CaretUp
            fill={themeColor('text')}
            width={45}
            style={{ marginRight: 15, alignSelf: 'center' }}
        />
    </TouchableOpacity>
);

const TempleButton = ({
    navigation
}: {
    navigation: StackNavigationProp<any, any>;
}) => (
    <TouchableOpacity
        onPress={() => protectedNavigation(navigation, 'Wallet', true)}
    >
        <Temple
            fill={themeColor('text')}
            width={30}
            height={35}
            style={{ alignSelf: 'center' }}
        />
    </TouchableOpacity>
);

const MenuBadge = ({
    navigation
}: {
    navigation: StackNavigationProp<any, any>;
}) => (
    <TouchableOpacity
        onPress={() =>
            protectedNavigation(navigation, 'Menu', undefined, {
                animation: 'fade'
            })
        }
        accessibilityLabel={localeString('views.Settings.title')}
        style={{ left: 4 }}
    >
        <Menu fill={themeColor('text')} width={38} height={38} />
    </TouchableOpacity>
);

const ClipboardBadge = ({
    navigation,
    clipboard
}: {
    navigation: StackNavigationProp<any, any>;
    clipboard: string;
}) => (
    <TouchableOpacity
        onPress={async () => {
            const response = await handleAnything(clipboard);
            const [route, props] = response;
            navigation.navigate(route, props);
        }}
    >
        <ClipboardSVG fill={themeColor('text')} width="24" height="30" />
    </TouchableOpacity>
);

const PendingHtlcBadge = ({
    navigation
}: {
    navigation: StackNavigationProp<any, any>;
    clipboard: string;
}) => (
    <TouchableOpacity
        onPress={() =>
            navigation.navigate('PendingHTLCs', {
                animation: 'slide_from_bottom'
            })
        }
    >
        <Hourglass fill={themeColor('highlight')} width="30" height="30" />
    </TouchableOpacity>
);

const UnredeemedTokensBadge = ({
    navigation
}: {
    navigation: StackNavigationProp<any, any>;
    clipboard: string;
}) => (
    <TouchableOpacity
        onPress={() =>
            navigation.navigate('UnspentTokens', {
                animation: 'slide_from_bottom'
            })
        }
    >
        <Ecash fill={themeColor('text')} width="30" height="30" />
    </TouchableOpacity>
);

const POSBadge = ({
    setPosStatus,
    getOrders
}: {
    setPosStatus: (status: string) => void;
    getOrders: () => void;
}) => (
    <TouchableOpacity
        onPress={async () => {
            getOrders();
            setPosStatus('active');
        }}
    >
        <POS stroke={themeColor('text')} width="30" height="35" />
    </TouchableOpacity>
);

interface WalletHeaderProps {
    AlertStore?: AlertStore;
    CashuStore?: CashuStore;
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
    ModalStore?: ModalStore;
    NodeInfoStore?: NodeInfoStore;
    LightningAddressStore?: LightningAddressStore;
    PosStore?: PosStore;
    SyncStore?: SyncStore;
    navigation: StackNavigationProp<any, any>;
    connecting?: boolean;
    loading?: boolean;
    title?: string;
    channels?: boolean;
    peers?: boolean;
}

interface WalletHeaderState {
    clipboard: string;
}

@inject(
    'AlertStore',
    'CashuStore',
    'ChannelsStore',
    'LightningAddressStore',
    'ModalStore',
    'SettingsStore',
    'NodeInfoStore',
    'PosStore',
    'SyncStore'
)
@observer
export default class WalletHeader extends React.Component<
    WalletHeaderProps,
    WalletHeaderState
> {
    state: WalletHeaderState = {
        clipboard: ''
    };

    async UNSAFE_componentWillMount() {
        this.readClipboard();
        this.props.navigation.addListener('focus', this.readClipboard);
    }

    componentWillUnmount(): void {
        this.props.navigation.removeListener('focus', this.readClipboard);
    }

    readClipboard = async () => {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore!;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            if (!!clipboard && (await isClipboardValue(clipboard))) {
                this.setState({
                    clipboard
                });
            }
        }
    };

    render() {
        const { clipboard } = this.state;
        const {
            navigation,
            connecting,
            loading,
            title,
            channels,
            AlertStore,
            CashuStore,
            SettingsStore,
            NodeInfoStore,
            ChannelsStore,
            LightningAddressStore,
            ModalStore,
            PosStore,
            SyncStore
        } = this.props;
        const { sentTokens } = CashuStore!!;
        const { pendingHTLCs } = ChannelsStore!;
        const { settings, posStatus, setPosStatus, implementation } =
            SettingsStore!;
        const { paid, redeemingAll } = LightningAddressStore!;
        const { isSyncing } = SyncStore!;
        const { getOrders } = PosStore!;
        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const unredeemedTokens = sentTokens
            ? sentTokens.filter((token: any) => !token.spent)
            : [];

        const posEnabled: PosEnabled =
            (settings && settings.pos && settings.pos.posEnabled) ||
            PosEnabled.Disabled;

        const NodeButton = () => (
            <TouchableOpacity
                onPress={() =>
                    protectedNavigation(navigation, 'Wallets', undefined, {
                        animation: 'slide_from_right'
                    })
                }
                accessibilityLabel={localeString('views.Settings.title')}
            >
                {selectedNode && selectedNode.photo ? (
                    <Image
                        source={{
                            uri: getPhoto(selectedNode.photo)
                        }}
                        style={styles.photo}
                    />
                ) : (
                    <NodeIdenticon
                        selectedNode={selectedNode}
                        width={36}
                        rounded
                    />
                )}
            </TouchableOpacity>
        );

        const displayName = selectedNode && selectedNode.nickname;
        const nodeAddress = SettingsStore!.host || SettingsStore!.url;

        let infoValue: string;
        if (NodeInfoStore!.nodeInfo.isTestNet) {
            infoValue = localeString('views.Wallet.MainPane.testnet');
        } else if (NodeInfoStore!.nodeInfo.isRegTest) {
            infoValue = localeString('views.Wallet.MainPane.regnet');
        } else if (NodeInfoStore!.nodeInfo.isSigNet) {
            infoValue = localeString('views.Wallet.MainPane.signet');
        }

        const { fontScale } = Dimensions.get('window');

        const NetworkBadge = () => {
            return infoValue ? (
                <Badge
                    onPress={() => navigation.navigate('NodeInfo')}
                    value={infoValue}
                    badgeStyle={{
                        ...styles.badgeStyle,
                        backgroundColor: 'gray',
                        minHeight: 18 * fontScale,
                        borderRadius: 9 * fontScale
                    }}
                    textStyle={styles.badgeTextStyle}
                />
            ) : null;
        };

        const CustodialBadge = () => {
            return implementation === 'lndhub' &&
                !selectedNode.dismissCustodialWarning ? (
                <Badge
                    onPress={() =>
                        navigation.navigate('CustodialWalletWarning')
                    }
                    value={`⚠ ${localeString('general.custodialWallet')}`}
                    badgeStyle={{
                        ...styles.badgeStyle,
                        backgroundColor: themeColor('error'),
                        minHeight: 18 * fontScale,
                        borderRadius: 9 * fontScale
                    }}
                    textStyle={styles.badgeTextStyle}
                />
            ) : null;
        };

        const TorBadge = () => (
            <>
                {nodeAddress && nodeAddress.includes('.onion') ? (
                    <TouchableOpacity
                        onPress={() => navigation.navigate('NodeInfo')}
                    >
                        <Image
                            style={{
                                marginLeft: 5,
                                marginRight: 5,
                                width: 25,
                                height: 25
                            }}
                            source={TorIcon}
                            accessibilityLabel={localeString(
                                'general.torEnabled'
                            )}
                        />
                    </TouchableOpacity>
                ) : null}
            </>
        );

        const ReadOnlyBadge = () => {
            return !BackendUtils.supportsLightningSends() ? (
                <Badge
                    value={localeString('general.readOnlyWallet')}
                    badgeStyle={{
                        ...styles.badgeStyle,
                        backgroundColor: themeColor('error'),
                        minHeight: 18 * fontScale,
                        borderRadius: 9 * fontScale
                    }}
                    textStyle={styles.badgeTextStyle}
                />
            ) : null;
        };

        const StatusBadges = () => (
            <>
                <CustodialBadge />
                <NetworkBadge />
                <ReadOnlyBadge />
                <TorBadge />
            </>
        );

        const AlertButton = () => (
            <TouchableOpacity
                onPress={() => ModalStore?.toggleAlertModal(true)}
                accessibilityLabel={localeString('general.search')}
            >
                <Alert
                    fill={themeColor('error')}
                    width="35"
                    height="35"
                    style={{ alignSelf: 'center', marginRight: 15 }}
                />
            </TouchableOpacity>
        );

        const SearchButton = () => (
            <TouchableOpacity
                onPress={() =>
                    ChannelsStore!.toggleSearch(
                        ChannelsStore?.channelsView || ChannelsView.Channels
                    )
                }
                accessibilityLabel={localeString('general.search')}
            >
                <Search
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center', marginRight: 15 }}
                />
            </TouchableOpacity>
        );

        const OpenChannelButton = () => (
            <TouchableOpacity
                onPress={() =>
                    ChannelsStore?.channelsView === ChannelsView.Channels
                        ? ModalStore?.toggleNewChannelModal()
                        : navigation.navigate('OpenChannel')
                }
                accessibilityLabel={localeString('views.Wallet.Channels.open')}
            >
                <Add
                    fill={themeColor('text')}
                    width="30"
                    height="30"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const SyncBadge = ({
            navigation
        }: {
            navigation: StackNavigationProp<any, any>;
        }) => {
            const [spinAnim] = useState(new Animated.Value(0));

            const interpolateRotation = spinAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
            });

            const animatedStyle = {
                transform: [{ rotate: interpolateRotation }]
            };

            useEffect(() => {
                Animated.loop(
                    Animated.timing(spinAnim, {
                        toValue: 1,
                        duration: 3000,
                        easing: Easing.linear,
                        useNativeDriver: true
                    })
                ).start();
            });

            return (
                <Animated.View style={animatedStyle}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Sync')}
                    >
                        <Sync
                            fill={themeColor('text')}
                            width="35"
                            height="25.66"
                        />
                    </TouchableOpacity>
                </Animated.View>
            );
        };

        return (
            <>
                <Header
                    leftComponent={
                        <Row style={{ flex: 1 }}>
                            <MenuBadge navigation={navigation} />
                            {!connecting && paid && paid.length > 0 && (
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'LightningAddress',
                                            { skipStatus: true }
                                        )
                                    }
                                    style={{ marginLeft: 20 }}
                                >
                                    {redeemingAll ? (
                                        <ZeusPayAnimated />
                                    ) : (
                                        <ZeusPay />
                                    )}
                                </TouchableOpacity>
                            )}
                        </Row>
                    }
                    centerComponent={
                        title ? (
                            <View
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <Body>{title}</Body>
                            </View>
                        ) : settings.display &&
                          settings.display.displayNickname ? (
                            <View style={{ top: 0 }}>
                                <Row>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 16
                                        }}
                                        onPress={() => {
                                            navigation.navigate('Wallets');
                                        }}
                                    >
                                        {PrivacyUtils.sensitiveValue(
                                            displayName
                                        )?.toString()}
                                    </Text>
                                    <StatusBadges />
                                </Row>
                            </View>
                        ) : (
                            <Row style={{ alignItems: 'center', flexGrow: 1 }}>
                                {!connecting && <StatusBadges />}
                            </Row>
                        )
                    }
                    rightComponent={
                        posStatus === 'active' ? (
                            <Row>
                                {!connecting && (
                                    <>
                                        <ActivityButton
                                            navigation={navigation}
                                        />
                                        <TempleButton navigation={navigation} />
                                    </>
                                )}
                            </Row>
                        ) : channels ? (
                            <Row style={{ marginTop: 1 }}>
                                <SearchButton />
                                <OpenChannelButton />
                            </Row>
                        ) : (
                            <View
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center'
                                }}
                            >
                                {!connecting && loading && (
                                    <View style={{ paddingRight: 15 }}>
                                        <LoadingIndicator size={35} />
                                    </View>
                                )}
                                {!connecting && !!clipboard && (
                                    <View style={{ marginRight: 15 }}>
                                        <ClipboardBadge
                                            navigation={navigation}
                                            clipboard={clipboard}
                                        />
                                    </View>
                                )}
                                {!connecting && unredeemedTokens?.length > 0 && (
                                    <View style={{ marginRight: 15 }}>
                                        <UnredeemedTokensBadge
                                            navigation={navigation}
                                            clipboard={clipboard}
                                        />
                                    </View>
                                )}
                                {!connecting && pendingHTLCs?.length > 0 && (
                                    <View style={{ marginRight: 15 }}>
                                        <PendingHtlcBadge
                                            navigation={navigation}
                                            clipboard={clipboard}
                                        />
                                    </View>
                                )}
                                {!connecting && isSyncing && (
                                    <View style={{ marginRight: 15 }}>
                                        <SyncBadge navigation={navigation} />
                                    </View>
                                )}
                                {!connecting && AlertStore?.hasError && (
                                    <AlertButton />
                                )}
                                {posEnabled === PosEnabled.Disabled ? (
                                    <View>
                                        <NodeButton />
                                    </View>
                                ) : (
                                    <View style={{ marginLeft: 15 }}>
                                        <POSBadge
                                            setPosStatus={setPosStatus}
                                            getOrders={getOrders}
                                        />
                                    </View>
                                )}
                            </View>
                        )
                    }
                />

                {this.props.peers && (
                    <View style={{ paddingTop: 10 }}>
                        <ToggleButton
                            options={[
                                {
                                    key: 'channels',
                                    label: `${localeString(
                                        'views.Wallet.Wallet.channels'
                                    )} (${
                                        ChannelsStore?.filteredChannels
                                            ?.length || 0
                                    })`
                                },
                                {
                                    key: 'peers',
                                    label: `${localeString('general.peers')} (${
                                        ChannelsStore?.filteredPeers?.length ||
                                        0
                                    })`
                                }
                            ]}
                            value={
                                this.props.ChannelsStore?.channelsView ||
                                'channels'
                            }
                            onToggle={(view: string) => {
                                this.props.ChannelsStore?.setChannelsView(
                                    view as ChannelsView
                                );
                            }}
                        />
                    </View>
                )}
            </>
        );
    }
}

const styles = StyleSheet.create({
    badgeStyle: {
        borderWidth: 0,
        marginHorizontal: 8,
        height: undefined
    },
    badgeTextStyle: {
        fontWeight: 'normal',
        textAlign: 'center'
    },
    photo: {
        alignSelf: 'center',
        width: 42,
        height: 42,
        borderRadius: 68
    }
});
