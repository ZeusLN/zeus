import React from 'react';
import { Button, Header } from 'react-native-elements';
import { TouchableOpacity, View } from 'react-native';

import LoadingIndicator from '../components/LoadingIndicator';
import NodeIdenticon from '../components/NodeIdenticon';
import { themeColor } from '../utils/ThemeUtils';

import Contact from '../assets/images/SVG/Mascot contact.svg';
import Scan from '../assets/images/SVG/Scan.svg';

import stores from '../stores/Stores';

import { Body } from './text/Body';

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

export function WalletHeader({
    navigation,
    SettingsStore,
    loading = false,
    title,
    channels = false
}: {
    navigation: any;
    SettingsStore: any;
    loading?: boolean;
    title?: string;
    channels?: boolean;
}) {
    const { settings } = SettingsStore;
    const multipleNodes: boolean =
        settings && settings.nodes && settings.nodes.length > 1;
    const selectedNode: any =
        (settings &&
            settings.nodes &&
            settings.nodes[settings.selectedNode || 0]) ||
        null;

    const SettingsButton = () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            {multipleNodes ? (
                <NodeIdenticon selectedNode={selectedNode} width={30} rounded />
            ) : (
                <Contact width={30} />
            )}
        </TouchableOpacity>
    );

    return (
        <Header
            leftComponent={loading ? undefined : <SettingsButton />}
            centerComponent={title ? <Body bold>{title}</Body> : null}
            rightComponent={
                channels ? (
                    <OpenChannelButton navigation={navigation} />
                ) : (
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                        {(stores.balanceStore.loadingBlockchainBalance ||
                            stores.balanceStore.loadingLightningBalance) && (
                            <LoadingIndicator size={80} />
                        )}
                        <View style={{ marginTop: 15 }}>
                            <ScanBadge navigation={navigation} />
                        </View>
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
