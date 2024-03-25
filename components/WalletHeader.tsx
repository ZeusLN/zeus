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

import ChannelsStore from '../stores/ChannelsStore';
import LightningAddressStore from '../stores/LightningAddressStore';
import SettingsStore, { PosEnabled } from '../stores/SettingsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import PosStore from '../stores/PosStore';
import SyncStore from '../stores/SyncStore';

import Button from '../components/Button';
import Header from './Header';
import LoadingIndicator from '../components/LoadingIndicator';
import NodeIdenticon from '../components/NodeIdenticon';

import handleAnything, { isClipboardValue } from '../utils/handleAnything';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { protectedNavigation } from '../utils/NavigationUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';

import Add from '../assets/images/SVG/Add.svg';
import ClipboardSVG from '../assets/images/SVG/Clipboard.svg';
import Scan from '../assets/images/SVG/Scan.svg';
import POS from '../assets/images/SVG/POS.svg';
import Search from '../assets/images/SVG/Search.svg';
import Temple from '../assets/images/SVG/Temple.svg';
import Sync from '../assets/images/SVG/Sync.svg';
import MailboxFlagUp from '../assets/images/SVG/MailboxFlagUp.svg';

import stores from '../stores/Stores';

import { Body } from './text/Body';
import { Row } from '../components/layout/Row';

const Contact = require('../assets/images/Mascot.png');

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

const ActivityButton = ({ navigation }: { navigation: any }) => (
    <View style={{ width: 80 }}>
        <Button
            icon={{
                name: 'list',
                size: 40,
                color: themeColor('text')
            }}
            containerStyle={{ top: -7 }}
            iconOnly
            onPress={() => navigation.navigate('Activity')}
        />
    </View>
);

const TempleButton = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => protectedNavigation(navigation, 'Wallet', true)}
    >
        <Temple
            fill={themeColor('text')}
            width={20.17}
            height={22}
            style={{ top: -8, alignSelf: 'center' }}
        />
    </TouchableOpacity>
);

const ScanBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => navigation.navigate('HandleAnythingQRScanner')}
        accessibilityLabel={localeString('general.scan')}
    >
        <Scan fill={themeColor('text')} width={30} height={30} />
    </TouchableOpacity>
);

const ClipboardBadge = ({
    navigation,
    clipboard
}: {
    navigation: any;
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
        <POS stroke={themeColor('text')} width="23" height="30" />
    </TouchableOpacity>
);

interface WalletHeaderProps {
    ChannelsStore?: ChannelsStore;
    SettingsStore?: SettingsStore;
    NodeInfoStore?: NodeInfoStore;
    LightningAddressStore?: LightningAddressStore;
    PosStore?: PosStore;
    SyncStore?: SyncStore;
    navigation: any;
    loading: boolean;
    title: string;
    channels: boolean;
    toggle?: () => void;
}

interface WalletHeaderState {
    clipboard: string;
}

@inject(
    'ChannelsStore',
    'LightningAddressStore',
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
            toggle,
            SettingsStore,
            NodeInfoStore,
            ChannelsStore,
            LightningAddressStore,
            PosStore,
            SyncStore
        } = this.props;
        const { filteredPendingChannels } = ChannelsStore!;
        const { settings, posStatus, setPosStatus } = SettingsStore!;
        const { paid, redeemingAll } = LightningAddressStore!;
        const laLoading = LightningAddressStore?.loading;
        const { isSyncing } = SyncStore!;
        const { getOrders } = PosStore!;
        const multipleNodes: boolean =
            (settings && settings.nodes && settings.nodes.length > 1) || false;
        const selectedNode: any =
            (settings &&
                settings.nodes?.length &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const posEnabled: PosEnabled =
            (settings && settings.pos && settings.pos.posEnabled) ||
            PosEnabled.Disabled;

        const SettingsButton = () => (
            <TouchableOpacity
                onPress={() => protectedNavigation(navigation, 'Settings')}
                onLongPress={() => protectedNavigation(navigation, 'Nodes')}
                accessibilityLabel={localeString('views.Settings.title')}
            >
                {multipleNodes ? (
                    <NodeIdenticon
                        selectedNode={selectedNode}
                        width={35}
                        rounded
                    />
                ) : (
                    <Image source={Contact} style={{ width: 35, height: 35 }} />
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

        const SyncBadge = ({ navigation }: { navigation: any }) => {
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
                        <Row>
                            <SettingsButton />
                            {paid && paid.length > 0 && (
                                <TouchableOpacity
                                    onPress={() =>
                                        navigation.navigate(
                                            'LightningAddress',
                                            { skipStatus: true }
                                        )
                                    }
                                    style={{ left: 18 }}
                                >
                                    {redeemingAll ? (
                                        <MailboxAnimated />
                                    ) : (
                                        <Mailbox />
                                    )}
                                </TouchableOpacity>
                            )}
                        </Row>
                    )
                }
                centerComponent={
                    title ? (
                        <View style={{ top: 5 }}>
                            {toggle ? (
                                <View
                                    style={{ top: -9, width: '100%' }}
                                    accessibilityLiveRegion="polite"
                                >
                                    <Button
                                        onPress={() => toggle()}
                                        title={title}
                                        noUppercase
                                        buttonStyle={{ alignSelf: 'center' }}
                                        icon={
                                            filteredPendingChannels?.length > 0
                                                ? {
                                                      name: 'clockcircle',
                                                      type: 'antdesign',
                                                      size: 20,
                                                      color: themeColor(
                                                          'background'
                                                      )
                                                  }
                                                : null
                                        }
                                    />
                                </View>
                            ) : (
                                <Body bold>{title}</Body>
                            )}
                        </View>
                    ) : settings.display && settings.display.displayNickname ? (
                        <View style={{ top: 5 }}>
                            <Row>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'PPNeueMontreal-Book',
                                        fontSize: 16
                                    }}
                                    onPress={() => {
                                        navigation.navigate('Nodes');
                                    }}
                                >
                                    {PrivacyUtils.sensitiveValue(
                                        displayName
                                    )?.toString()}
                                </Text>
                                <NetworkBadge />
                                <ReadOnlyBadge />
                                <TorBadge />
                            </Row>
                        </View>
                    ) : (
                        <Row style={{ alignItems: 'center', flexGrow: 1 }}>
                            <NetworkBadge />
                            <ReadOnlyBadge />
                            <TorBadge />
                        </Row>
                    )
                }
                rightComponent={
                    posStatus === 'active' ? (
                        <Row>
                            <ActivityButton navigation={navigation} />
                            <TempleButton navigation={navigation} />
                        </Row>
                    ) : channels ? (
                        <Row style={{ marginTop: 1 }}>
                            <SearchButton />
                            <OpenChannelButton />
                        </Row>
                    ) : (
                        <View
                            style={{
                                flexGrow: 1,
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {(stores.balanceStore.loadingBlockchainBalance ||
                                stores.balanceStore.loadingLightningBalance ||
                                laLoading) && (
                                <View style={{ paddingRight: 15 }}>
                                    <LoadingIndicator size={32} />
                                </View>
                            )}
                            {!!clipboard && (
                                <View style={{ marginRight: 15 }}>
                                    <ClipboardBadge
                                        navigation={navigation}
                                        clipboard={clipboard}
                                    />
                                </View>
                            )}
                            {isSyncing && (
                                <View
                                    style={{
                                        marginRight: 15
                                    }}
                                >
                                    <SyncBadge navigation={navigation} />
                                </View>
                            )}
                            <View>
                                <ScanBadge navigation={navigation} />
                            </View>
                            {posEnabled !== PosEnabled.Disabled && (
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
    }
});
