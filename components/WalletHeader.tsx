import React from 'react';
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
const NodeInfoBadge = ({ navigation }: { navigation: any }) => (
    <TouchableOpacity onPress={() => navigation.navigate('NodeInfo')}>
        <NodeOn stroke={themeColor('text')} />
    </TouchableOpacity>
);

export function WalletHeader({
    navigation,
    loading = false,
    title
}: {
    navigation: any;
    loading?: boolean;
    title?: string;
}) {
    return (
        <Header
            leftComponent={
                loading ? undefined : <NodeInfoBadge navigation={navigation} />
            }
            centerComponent={title ? <Body bold>{title}</Body> : undefined}
            rightComponent={<SettingsButton navigation={navigation} />}
            backgroundColor="transparent"
            containerStyle={{
                borderBottomWidth: 0
            }}
        />
    );
}
