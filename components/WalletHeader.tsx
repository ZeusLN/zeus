import React from 'react';
import { Button, Header, Image } from 'react-native-elements';
import { TouchableOpacity } from 'react-native';
import NodeIdenticon from '../components/NodeIdenticon';
import { themeColor } from '../utils/ThemeUtils';
import Scan from '../assets/images/SVG/Scan.svg';
import { Body } from './text/Body';

const Contact = require('./../assets/images/Contact.png');

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
                <NodeIdenticon selectedNode={selectedNode} width={30} />
            ) : (
                <Image
                    source={Contact}
                    style={{
                        width: 30,
                        height: 30
                    }}
                />
            )}
        </TouchableOpacity>
    );

    return (
        <Header
            leftComponent={loading ? undefined : <SettingsButton />}
            centerComponent={title ? <Body bold>{title}</Body> : undefined}
            rightComponent={
                channels ? (
                    <OpenChannelButton navigation={navigation} />
                ) : (
                    <ScanBadge navigation={navigation} />
                )
            }
            backgroundColor="transparent"
            containerStyle={{
                borderBottomWidth: 0
            }}
        />
    );
}
