import React, { useEffect, useState } from 'react';
import { Badge } from 'react-native-elements';
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
import ChannelsStore from '../stores/ChannelsStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import CashuLightningAddressStore from '../stores/CashuLightningAddressStore';
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
import Menu from '../assets/images/SVG/Menu.svg';
import Hourglass from '../assets/images/SVG/Hourglass.svg';
import POS from '../assets/images/SVG/POS.svg';
import Search from '../assets/images/SVG/Search.svg';
import Temple from '../assets/images/SVG/Temple.svg';
import Sync from '../assets/images/SVG/Sync.svg';
import MailboxFlagUp from '../assets/images/SVG/MailboxFlagUp.svg';
import Cashu from '../assets/images/SVG/Ecash.svg';

import stores from '../stores/Stores';

import { Body } from './text/Body';
import { Row } from '../components/layout/Row';

const TorIcon = require('../assets/images/tor.png');

const Mailbox = () => (
    <MailboxFlagUp fill={themeColor('highlight')} width={34.29} height={30} />
);

const MailboxAnimated = () => {
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
            <Mailbox />
        </Animated.View>
    );
};

const CashuMailbox = () => (
    <Cashu fill={themeColor('highlight')} width={34.29} height={30} />
);

const CashuMailboxAnimated = () => {
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
            <Cashu />
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
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
    ModalStore?: ModalStore;
    NodeInfoStore?: NodeInfoStore;
    LightningAddressStore?: LightningAddressStore;
    CashuLightningAddressStore?: CashuLightningAddressStore;
    PosStore?: PosStore;
    SyncStore?: SyncStore;
    navigation: StackNavigationProp<any, any>;
    loading?: boolean;
    title?: string;
    channels?: boolean;
}

interface WalletHeaderState {
    clipboard: string;
}

@inject(
    'AlertStore',
    'ChannelsStore',
    'LightningAddressStore',
    'CashuLightningAddressStore',
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
    state = {
        clipboard: ''
    };

    async UNSAFE_componentWillMount() {
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
    }

    render() {
        const { clipboard } = this.state;
        const {
            navigation,
            loading,
            title,
            channels,
            AlertStore,
            SettingsStore,
            NodeInfoStore,
            ChannelsStore,
            LightningAddressStore,
            CashuLightningAddressStore,
            ModalStore,
            PosStore,
            SyncStore
        } = this.props;
        const { pendingHTLCs } = ChannelsStore!;
        const { settings, posStatus, setPosStatus, implementation } =
            SettingsStore!;
        const { paid, redeemingAll } = LightningAddressStore!;
        const laLoading = LightningAddressStore?.loading;
        const cashuPaid = CashuLightningAddressStore?.paid;
        const cashuRedeemingAll = CashuLightningAddressStore!.redeemingAll;
        const claLoading = CashuLightningAddressStore?.loading;
        const { isSyncing } = SyncStore!;
        const { getOrders } = PosStore!;
        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

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
                onPress={() => ChannelsStore!.toggleSearch()}
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
                onPress={() => navigation.navigate('OpenChannel')}
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
            <Header
                leftComponent={
                    loading ? undefined : (
                        <Row style={{ flex: 1 }}>
                            <MenuBadge navigation={navigation} />
                            {!loading && paid && paid.length > 0 && (
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
                                        <MailboxAnimated />
                                    ) : (
                                        <Mailbox />
                                    )}
                                </TouchableOpacity>
                            )}
                            {!loading && cashuPaid && cashuPaid.length > 0 && (
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'CashuLightningAddress',
                                            { skipStatus: true }
                                        )
                                    }
                                    style={{ marginLeft: 20 }}
                                >
                                    {cashuRedeemingAll ? (
                                        <CashuMailboxAnimated />
                                    ) : (
                                        <CashuMailbox />
                                    )}
                                </TouchableOpacity>
                            )}
                        </Row>
                    )
                }
                centerComponent={
                    title ? (
                        <View style={{ flex: 1 }}>
                            <Body bold>{title}</Body>
                        </View>
                    ) : settings.display && settings.display.displayNickname ? (
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
                            {!loading && <StatusBadges />}
                        </Row>
                    )
                }
                rightComponent={
                    posStatus === 'active' ? (
                        <Row>
                            {!loading && (
                                <>
                                    <ActivityButton navigation={navigation} />
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
                            {!loading &&
                                (stores.balanceStore.loadingBlockchainBalance ||
                                    stores.balanceStore
                                        .loadingLightningBalance ||
                                    laLoading ||
                                    claLoading) && (
                                    <View style={{ paddingRight: 15 }}>
                                        <LoadingIndicator size={35} />
                                    </View>
                                )}
                            {!loading && !!clipboard && (
                                <View style={{ marginRight: 15 }}>
                                    <ClipboardBadge
                                        navigation={navigation}
                                        clipboard={clipboard}
                                    />
                                </View>
                            )}
                            {!loading && pendingHTLCs?.length > 0 && (
                                <View style={{ marginRight: 15 }}>
                                    <PendingHtlcBadge
                                        navigation={navigation}
                                        clipboard={clipboard}
                                    />
                                </View>
                            )}
                            {!loading && isSyncing && (
                                <View
                                    style={{
                                        marginRight: 15
                                    }}
                                >
                                    <SyncBadge navigation={navigation} />
                                </View>
                            )}
                            {!loading && AlertStore?.hasError && (
                                <AlertButton />
                            )}
                            {posEnabled === PosEnabled.Disabled && (
                                <View>
                                    <NodeButton />
                                </View>
                            )}
                            {!loading && posEnabled !== PosEnabled.Disabled && (
                                <View
                                    style={{
                                        marginLeft: 15
                                    }}
                                >
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
