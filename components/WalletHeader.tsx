import React from 'react';
import { Avatar, Button, Header } from 'react-native-elements';
import { Image, TouchableOpacity, View } from 'react-native';
import Identicon from 'identicon.js';
import RESTUtils from '../utils/RESTUtils';
import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';
import Keysign from '../images/SVG/Keysign.svg';
import QRIcon from '../images/SVG/QR.svg';
import { Body } from './text/Body';

const hash = require('object-hash');
const Head = require('../images/head.png');

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

const QRBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity
        onPress={() => navigation.navigate('AddressQRCodeScanner')}
    >
        <QRIcon fill={themeColor('text')} />
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
    const selectedNode: any =
        (settings &&
            settings.nodes &&
            settings.nodes[settings.selectedNode || 0]) ||
        null;

    const displayName =
        selectedNode && selectedNode.nickname
            ? selectedNode.nickname
            : selectedNode && selectedNode.implementation === 'lndhub'
            ? selectedNode.lndhubUrl
                  .replace('https://', '')
                  .replace('http://', '')
            : selectedNode && selectedNode.url
            ? selectedNode.url.replace('https://', '').replace('http://', '')
            : selectedNode && selectedNode.port
            ? `${selectedNode.host}:${selectedNode.port}`
            : (selectedNode && selectedNode.host) || 'Unknown';

    const nodeTitle = PrivacyUtils.sensitiveValue(displayName, 8);
    const implementation = PrivacyUtils.sensitiveValue(
        (selectedNode && selectedNode.implementation) || 'lnd',
        8
    );

    const data = new Identicon(
        hash.sha1(
            selectedNode && selectedNode.implementation === 'lndhub'
                ? `${nodeTitle}-${selectedNode.username}`
                : nodeTitle
        ),
        255
    ).toString();

    const SettingsButton = () => (
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
            {selectedNode ? (
                <Avatar
                    source={{
                        uri: `data:image/png;base64,${data}`
                    }}
                    rounded
                    size="medium"
                    width={30}
                    height={30}
                />
            ) : (
                <Image source={Head} style={{ width: 30, height: 30 }} />
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
                    <QRBadge navigation={navigation} />
                )
            }
            backgroundColor="transparent"
            containerStyle={{
                borderBottomWidth: 0
            }}
        />
    );
}
