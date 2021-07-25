import * as React from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Badge, Button, Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import NodeInfoStore from './../../stores/NodeInfoStore';
import UnitsStore from './../../stores/UnitsStore';
import BalanceStore from './../../stores/BalanceStore';
import SettingsStore from './../../stores/SettingsStore';

import NodeOn from './../../images/SVG/Node On.svg';
import { Body } from '../../components/text/Body';
import { ChannelsHeader } from './ChannelsHeader';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import { ScrollView } from 'react-native-gesture-handler';

interface ChannelsPaneProps {
    navigation: any;
}

function Sats({ children }) {
    return (
        <Row align="flex-end">
            <Body>{children}</Body>
            <Spacer width={2} />
            <View style={{ paddingBottom: 1.5 }}>
                <Body secondary small>
                    sats
                </Body>
            </View>
        </Row>
    );
}

function BalanceBar({
    left,
    right,
    offline
}: {
    left: number;
    right: number;
    offline: boolean;
}) {
    const total = left + right;
    return (
        <Row>
            <View
                style={{
                    height: 8,
                    flex: left / total,
                    backgroundColor: offline
                        ? '#E5E5E5'
                        : themeColor('outbound'),
                    borderRadius: 8,
                    marginRight: 1
                }}
            />
            <View
                style={{
                    height: 8,
                    flex: right / total,
                    backgroundColor: offline
                        ? '#A7A9AC'
                        : themeColor('inbound'),
                    borderRadius: 8
                }}
            />
        </Row>
    );
}

enum Status {
    Good = 'Good',
    Stable = 'Stable',
    Unstable = 'Unstable',
    Offline = 'Offline'
}

function Tag({ status }: { status: Status }) {
    // Garish colors to let you know you fucked up
    let colors = { background: 'pink', dot: 'blue' };

    switch (status) {
        case Status.Good:
            colors.background = '#2C553D';
            colors.dot = '#46E80E';
            break;

        case Status.Stable:
            colors.background = '#FFB040';
            colors.dot = '#FFC778';
            break;
        case Status.Unstable:
            colors.background = '#E14C4C';
            colors.dot = '#FF0000';
            break;
        case Status.Offline:
            colors.background = '#A7A9AC';
            colors.dot = '#E5E5E5';
            break;
    }

    return (
        <View
            style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                backgroundColor: colors.background,
                borderRadius: 4
            }}
        >
            <Row>
                <View
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 6,
                        backgroundColor: colors.dot
                    }}
                />
                <Spacer width={6} />
                <Body small>{status}</Body>
            </Row>
        </View>
    );
}

const numberWithCommas = (x: string | number) =>
    x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function ChannelItem({
    title,
    inbound,
    outbound,
    status
}: {
    title: string;
    inbound: number;
    outbound: number;
    status: Status;
}) {
    return (
        <View
            style={{
                padding: 16,
                height: 110,
                justifyContent: 'space-around',
                borderBottomColor: themeColor('secondary'),
                borderBottomWidth: 1
            }}
        >
            <Row justify="space-between">
                <Body>{title}</Body>
                <Tag status={status} />
            </Row>
            <Row>
                <BalanceBar
                    left={outbound}
                    right={inbound}
                    offline={status === Status.Offline}
                />
            </Row>
            <Row justify="space-between">
                <Sats>{numberWithCommas(outbound)}</Sats>
                <Sats>{numberWithCommas(inbound)}</Sats>
            </Row>
        </View>
    );
}

export default class ChannelsPane extends React.PureComponent<
    ChannelsPaneProps,
    {}
> {
    render() {
        const NodeInfoBadge = () => (
            <TouchableOpacity
                onPress={() => this.props.navigation.navigate('NodeInfo')}
            >
                <NodeOn stroke={themeColor('text')} />
            </TouchableOpacity>
        );

        const SettingsButton = () => (
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
                onPress={() => this.props.navigation.navigate('Settings')}
            />
        );

        return (
            <View style={{ flex: 1 }}>
                <Header
                    leftComponent={<NodeInfoBadge />}
                    centerComponent={<Body bold>Channels (8)</Body>}
                    rightComponent={<SettingsButton />}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <ChannelsHeader />
                <ScrollView>
                    <ChannelItem
                        title="looptest"
                        status={Status.Good}
                        inbound={20000}
                        outbound={20000}
                    />
                    <ChannelItem
                        title="evan.k"
                        status={Status.Stable}
                        inbound={12000}
                        outbound={14000}
                    />
                    <ChannelItem
                        title="bosch"
                        status={Status.Unstable}
                        inbound={18000}
                        outbound={6000}
                    />
                    <ChannelItem
                        title="bosch but offline"
                        status={Status.Offline}
                        inbound={18000}
                        outbound={6000}
                    />
                    <ChannelItem
                        title="futurepaul"
                        status={Status.Good}
                        inbound={400000}
                        outbound={19000}
                    />
                    <Spacer height={100} />
                </ScrollView>
            </View>
        );
    }
}
