import React from 'react';
import { Button, Header } from 'react-native-elements';
import { Image, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import Clipboard from '@react-native-clipboard/clipboard';

import SettingsStore from '../stores/SettingsStore';

import LoadingIndicator from '../components/LoadingIndicator';
import NodeIdenticon from '../components/NodeIdenticon';

import { isClipboardValue } from '../utils/handleAnything';
import { themeColor } from '../utils/ThemeUtils';

import ClipboardSVG from '../assets/images/SVG/Clipboard.svg';
import Scan from '../assets/images/SVG/Scan.svg';

import stores from '../stores/Stores';

import { Body } from './text/Body';

const Contact = require('../assets/images/Mascot.png');

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
            marginRight: -10
        }}
        onPress={() => navigation.navigate('OpenChannel')}
    />
);

const ScanBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => navigation.navigate('AddressQRCodeScanner')}
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

interface WalletHeaderProps {
    SettingsStore: SettingsStore;
    navigation: any;
    loading: boolean;
    title: string;
    channels: boolean;
}

interface WalletHeaderState {
    clipboard: string;
    showDisplayName: boolean;
}

@inject('SettingsStore')
@observer
export default class WalletHeader extends React.Component<
    WalletHeaderProps,
    WalletHeaderState
> {
    state = {
        clipboard: '',
        showDisplayName: false
    };

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            if (!!clipboard && isClipboardValue(clipboard)) {
                this.setState({
                    clipboard
                });
            }
        }
    }

    render() {
        const { clipboard, showDisplayName } = this.state;
        const { navigation, loading, title, channels, SettingsStore } =
            this.props;
        const { settings } = SettingsStore;
        const multipleNodes: boolean =
            (settings && settings.nodes && settings.nodes.length > 1) || false;
        const selectedNode: any =
            (settings &&
                settings.nodes &&
                settings.nodes[settings.selectedNode || 0]) ||
            null;

        const SettingsButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('Settings')}
                onLongPress={() =>
                    this.setState({
                        showDisplayName: !this.state.showDisplayName
                    })
                }
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

        const displayName =
            selectedNode && selectedNode.nickname
                ? selectedNode.nickname
                : selectedNode && selectedNode.implementation === 'lndhub'
                ? selectedNode.lndhubUrl
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode && selectedNode.url
                ? selectedNode.url
                      .replace('https://', '')
                      .replace('http://', '')
                : selectedNode && selectedNode.port
                ? `${selectedNode.host}:${selectedNode.port}`
                : (selectedNode && selectedNode.host) || 'Unknown';

        return (
            <Header
                leftComponent={loading ? undefined : <SettingsButton />}
                centerComponent={
                    title || showDisplayName ? (
                        <View style={{ top: 5 }}>
                            <Body bold>{title || displayName}</Body>
                        </View>
                    ) : null
                }
                rightComponent={
                    channels ? (
                        <OpenChannelButton navigation={navigation} />
                    ) : (
                        <View style={{ flex: 1, flexDirection: 'row' }}>
                            {(stores.balanceStore.loadingBlockchainBalance ||
                                stores.balanceStore
                                    .loadingLightningBalance) && (
                                <LoadingIndicator size={80} />
                            )}
                            {!!clipboard && (
                                <View
                                    style={{ marginTop: 14, marginRight: 20 }}
                                >
                                    <ClipboardBadge
                                        navigation={navigation}
                                        clipboard={clipboard}
                                    />
                                </View>
                            )}
                            <ScanBadge navigation={navigation} />
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
