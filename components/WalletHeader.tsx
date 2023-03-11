import React from 'react';
import { Badge, Button, Header } from 'react-native-elements';
import { Image, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';

import SettingsStore from '../stores/SettingsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import PosStore from '../stores/PosStore';

import LoadingIndicator from '../components/LoadingIndicator';
import NodeIdenticon from '../components/NodeIdenticon';

import { isClipboardValue } from '../utils/handleAnything';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import ClipboardSVG from '../assets/images/SVG/Clipboard.svg';
import Scan from '../assets/images/SVG/Scan.svg';
import POS from '../assets/images/SVG/POS.svg';
import Temple from '../assets/images/SVG/Temple.svg';

import stores from '../stores/Stores';

import { Body } from './text/Body';
import { Row } from '../components/layout/Row';

const Contact = require('../assets/images/Mascot.png');

const TorIcon = require('../assets/images/tor.png');

const protectedNavigation = async (
    navigation: any,
    route: string,
    disactivatePOS?: boolean
) => {
    const { posStatus, settings, setPosStatus } = stores.settingsStore;
    const loginRequired = settings && (settings.passphrase || settings.pin);
    const posEnabled = posStatus === 'active';

    if (posEnabled && loginRequired) {
        navigation.navigate('Lockscreen', {
            attemptAdminLogin: true
        });
    } else {
        if (disactivatePOS) await setPosStatus('inactive');
        navigation.navigate(route);
    }
};

const OpenChannelButton = ({ navigation }: { navigation: any }) => (
    <Button
        title=""
        icon={{
            name: 'add',
            size: 25,
            color: themeColor('text')
        }}
        buttonStyle={{
            backgroundColor: 'transparent',
            marginRight: -10,
            marginTop: -10
        }}
        onPress={() => navigation.navigate('OpenChannel')}
    />
);

const TempleButton = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => protectedNavigation(navigation, 'Wallet', true)}
    >
        <Temple
            fill={themeColor('text')}
            width="40"
            height="40"
            style={{ right: -6, top: -8, alignSelf: 'center' }}
        />
    </TouchableOpacity>
);

const ScanBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => navigation.navigate('HandleAnythingQRScanner')}
    >
        <Scan fill={themeColor('text')} />
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
        onPress={() => navigation.navigate('Send', { destination: clipboard })}
    >
        <ClipboardSVG fill={themeColor('text')} width="27" height="27" />
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
            await setPosStatus('active');
        }}
    >
        <POS stroke={themeColor('text')} width="34" height="34" />
    </TouchableOpacity>
);

interface WalletHeaderProps {
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    PosStore: PosStore;
    navigation: any;
    loading: boolean;
    title: string;
    channels: boolean;
}

interface WalletHeaderState {
    clipboard: string;
}

@inject('SettingsStore', 'NodeInfoStore', 'PosStore')
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
        const { settings } = SettingsStore;

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
            SettingsStore,
            NodeInfoStore,
            PosStore
        } = this.props;
        const { settings, posStatus, setPosStatus } = SettingsStore;
        const { getOrders } = PosStore;
        const multipleNodes: boolean =
            (settings && settings.nodes && settings.nodes.length > 1) || false;
        const selectedNode: any =
            (settings &&
                settings.nodes &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const squareEnabled: boolean =
            (settings && settings.pos && settings.pos.squareEnabled) || false;

        const SettingsButton = () => (
            <TouchableOpacity
                onPress={() => protectedNavigation(navigation, 'Settings')}
                onLongPress={() => protectedNavigation(navigation, 'Nodes')}
            >
                {multipleNodes ? (
                    <NodeIdenticon
                        selectedNode={selectedNode}
                        width={30}
                        rounded
                    />
                ) : (
                    <Image source={Contact} style={{ width: 30, height: 30 }} />
                )}
            </TouchableOpacity>
        );

        const displayName = selectedNode && selectedNode.nickname;
        const nodeAddress = SettingsStore.host || SettingsStore.url;

        let infoValue: string;
        if (NodeInfoStore.nodeInfo.isTestNet) {
            infoValue = localeString('views.Wallet.MainPane.testnet');
        } else if (NodeInfoStore.nodeInfo.isRegTest) {
            infoValue = localeString('views.Wallet.MainPane.regnet');
        }

        const NetworkBadge = () => {
            return infoValue ? (
                <Badge
                    onPress={() => navigation.navigate('NodeInfo')}
                    value={infoValue}
                    badgeStyle={{
                        backgroundColor: 'gray',
                        borderWidth: 0,
                        marginLeft: 8,
                        marginRight: 8
                    }}
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
                        />
                    </TouchableOpacity>
                ) : null}
            </>
        );

        return (
            <Header
                leftComponent={loading ? undefined : <SettingsButton />}
                centerComponent={
                    title ? (
                        <View style={{ top: 5 }}>
                            <Body bold>{title}</Body>
                        </View>
                    ) : settings.display && settings.display.displayNickname ? (
                        <View style={{ top: 5 }}>
                            <Row>
                                <Body>{displayName}</Body>
                                <NetworkBadge />
                                <TorBadge />
                            </Row>
                        </View>
                    ) : (
                        <Row>
                            <NetworkBadge />
                            <TorBadge />
                        </Row>
                    )
                }
                rightComponent={
                    posStatus === 'active' ? (
                        <TempleButton navigation={navigation} />
                    ) : channels ? (
                        <OpenChannelButton navigation={navigation} />
                    ) : (
                        <View style={{ flex: 1, flexDirection: 'row' }}>
                            {(stores.balanceStore.loadingBlockchainBalance ||
                                stores.balanceStore
                                    .loadingLightningBalance) && (
                                <View style={{ paddingRight: 15 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                            {!!clipboard && (
                                <View style={{ marginRight: 20 }}>
                                    <ClipboardBadge
                                        navigation={navigation}
                                        clipboard={clipboard}
                                    />
                                </View>
                            )}
                            <View style={{ marginTop: 1 }}>
                                <ScanBadge navigation={navigation} />
                            </View>
                            {squareEnabled && (
                                <View
                                    style={{
                                        marginLeft: 10,
                                        top: -4,
                                        right: -4
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
                backgroundColor="transparent"
                containerStyle={{
                    borderBottomWidth: 0
                }}
            />
        );
    }
}
