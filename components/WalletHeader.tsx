import React from 'react';
import RESTUtils from '../utils/RESTUtils';
import { themeColor } from '../utils/ThemeUtils';
import { Button, Header } from 'react-native-elements';
import { TouchableOpacity } from 'react-native';
import NodeOn from '../images/SVG/Node On.svg';
import { Body } from './text/Body';

const SettingsButton = ({ navigation }: { navigation: any }) => (
    <Button
        title=""
        icon={{
            name: 'more-horiz',
            size: 25,
            color: themeColor('text')
        }}
        buttonStyle={{
            backgroundColor: 'transparent',
            marginRight: -10
        }}
        onPress={() => navigation.navigate('Settings')}
    />
);

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

const NodeInfoBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity onPress={() => navigation.navigate('NodeInfo')}>
        <NodeOn color={themeColor('text')} />
    </TouchableOpacity>
);

export function WalletHeader({
    navigation,
    loading = false,
    title,
    channels = false
}: {
    navigation: any;
    loading?: boolean;
    title?: string;
    channels?: boolean;
}) {
    return (
        <Header
            leftComponent={
                loading || !RESTUtils.supportsNodeInfo() ? (
                    undefined
                ) : (
                    <NodeInfoBadge navigation={navigation} />
                )
            }
            centerComponent={title ? <Body bold>{title}</Body> : undefined}
            rightComponent={
                channels ? (
                    <OpenChannelButton navigation={navigation} />
                ) : (
                    <SettingsButton navigation={navigation} />
                )
            }
            backgroundColor="transparent"
            containerStyle={{
                borderBottomWidth: 0
            }}
        />
    );
}
