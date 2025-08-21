import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import ForwardEvent from '../../models/ForwardEvent';

import Amount from '../../components/Amount';
import FeeBreakdown from '../../components/FeeBreakdown';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import ChannelsStore from '../../stores/ChannelsStore';

interface RoutingEventProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    route: Route<'RoutingEvent', { routingEvent: ForwardEvent }>;
}

interface RoutingEventState {
    routingEvent: any;
}

@inject('ChannelsStore')
@observer
export default class RoutingEvent extends React.Component<
    RoutingEventProps,
    RoutingEventState
> {
    constructor(props: RoutingEventProps) {
        super(props);
        const { route } = props;

        const routingEvent = route.params?.routingEvent;
        const { inChannelId, outChannelId } = routingEvent;

        this.props.ChannelsStore.loadChannelInfo(inChannelId, true);
        this.props.ChannelsStore.loadChannelInfo(outChannelId, true);

        this.state = {
            routingEvent
        };
    }

    private renderChannelLink = (
        channel: any,
        channelLabel: string,
        navigation: any
    ) => {
        if (!channel) return channelLabel;

        return (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('Channel', {
                        channel
                    })
                }
            >
                <Text
                    style={{
                        ...styles.highlight,
                        color: themeColor('highlight')
                    }}
                >
                    {channelLabel}
                </Text>
            </TouchableOpacity>
        );
    };

    private renderChannelBalances = (channelData: any) => {
        return (
            <>
                <KeyValue
                    keyValue={localeString('views.Channel.localBalance')}
                    value={
                        <Amount
                            sats={
                                channelData.local_balance ||
                                channelData.localBalance ||
                                0
                            }
                            toggleable
                        />
                    }
                />
                <KeyValue
                    keyValue={localeString('views.Channel.remoteBalance')}
                    value={
                        <Amount
                            sats={
                                channelData.remote_balance ||
                                channelData.remoteBalance ||
                                0
                            }
                            toggleable
                        />
                    }
                />
            </>
        );
    };

    private renderChannelSection = (
        channelData: any,
        channelId: string,
        channel: any,
        channelLabel: string,
        titleKey: string,
        channelIdKey: string
    ) => {
        const { navigation } = this.props;

        return (
            <View style={{ marginVertical: 20 }}>
                <View
                    style={{
                        height: 1,
                        backgroundColor: themeColor('separator'),
                        marginVertical: 8
                    }}
                />
                <Text
                    style={{
                        ...styles.text,
                        ...styles.breakdownHeader,
                        color: themeColor('text')
                    }}
                >
                    {localeString(titleKey)}
                </Text>

                {channelId && (
                    <KeyValue
                        keyValue={localeString(channelIdKey)}
                        value={this.renderChannelLink(
                            channel,
                            channelLabel,
                            navigation
                        )}
                        sensitive
                    />
                )}

                <KeyValue
                    keyValue={localeString('views.Channel.channelId')}
                    value={
                        channelData.chan_id ||
                        channelData.channelId ||
                        localeString('general.unknown')
                    }
                />

                {this.renderChannelBalances(channelData)}
            </View>
        );
    };

    private renderRebalanceChannelSections = () => {
        const { routingEvent } = this.state;
        const { ChannelsStore } = this.props;
        const { aliasesById, channels } = ChannelsStore;
        const { inChannelId, outChannelId } = routingEvent;

        const chanInFilter = channels.filter(
            (channel: any) => channel.channelId === inChannelId
        );
        const chanIn = chanInFilter[0];
        const chanOutFilter = channels.filter(
            (channel: any) => channel.channelId === outChannelId
        );
        const chanOut = chanOutFilter[0];
        const chanInLabel = aliasesById[inChannelId] || inChannelId;
        const chanOutLabel = aliasesById[outChannelId] || outChannelId;

        return (
            <>
                {routingEvent.sourceChannel &&
                    this.renderChannelSection(
                        routingEvent.sourceChannel,
                        inChannelId,
                        chanIn,
                        chanInLabel,
                        'views.Routing.RoutingEvent.sourceChannel',
                        'views.NodeInfo.ForwardingHistory.srcChannelId'
                    )}

                {routingEvent.destinationChannel &&
                    this.renderChannelSection(
                        routingEvent.destinationChannel,
                        outChannelId,
                        chanOut,
                        chanOutLabel,
                        'views.Routing.RoutingEvent.destinationChannel',
                        'views.NodeInfo.ForwardingHistory.dstChannelId'
                    )}
            </>
        );
    };

    render() {
        const { navigation, ChannelsStore } = this.props;
        const { routingEvent } = this.state;
        const { aliasesById, channels } = ChannelsStore;

        const { fee, getTime, inChannelId, outChannelId, inAmt, outAmt } =
            routingEvent;

        const chanInFilter = channels.filter(
            (channel) => channel.channelId === inChannelId
        );
        const chanIn = chanInFilter[0];
        const chanOutFilter = channels.filter(
            (channel) => channel.channelId === outChannelId
        );
        const chanOut = chanOutFilter[0];
        const chanInLabel = aliasesById[inChannelId] || inChannelId;
        const chanOutLabel = aliasesById[outChannelId] || outChannelId;
        const channelInPoint = chanIn && chanIn.channel_point;
        const channelOutPoint = chanOut && chanOut.channel_point;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: routingEvent.isRebalance
                            ? localeString(
                                  'views.SendingLightning.rebalanceSummary'
                              )
                            : localeString('views.Routing.RoutingEvent.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.amount}>
                        <Amount
                            sats={
                                fee ||
                                (parseInt(inAmt) - parseInt(outAmt)) / 1000
                            }
                            jumboText
                            toggleable
                            credit
                            sensitive
                        />
                    </View>

                    {!routingEvent.isRebalance && inChannelId && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.srcChannelId'
                            )}
                            value={
                                chanIn ? (
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate('Channel', {
                                                channel: chanIn
                                            })
                                        }
                                    >
                                        <Text
                                            style={{
                                                ...styles.highlight,
                                                color: themeColor('highlight')
                                            }}
                                        >
                                            {chanInLabel}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    chanInLabel
                                )
                            }
                            sensitive
                        />
                    )}

                    {!routingEvent.isRebalance && outChannelId && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.dstChannelId'
                            )}
                            value={
                                chanOut ? (
                                    <TouchableOpacity
                                        onPress={() =>
                                            navigation.navigate('Channel', {
                                                channel: chanOut
                                            })
                                        }
                                    >
                                        <Text
                                            style={{
                                                ...styles.highlight,
                                                color: themeColor('highlight')
                                            }}
                                        >
                                            {chanOutLabel}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    chanOutLabel
                                )
                            }
                            sensitive
                        />
                    )}

                    {inAmt && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtIn'
                            )}
                            value={<Amount sats={inAmt} sensitive />}
                        />
                    )}

                    {outAmt && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtOut'
                            )}
                            value={<Amount sats={outAmt} sensitive />}
                        />
                    )}

                    {routingEvent.isRebalance &&
                        routingEvent.rebalanceFees !== undefined && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Transaction.totalFees'
                                )}
                                value={
                                    <Amount
                                        sats={routingEvent.rebalanceFees}
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                        )}

                    {getTime && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.timestamp'
                            )}
                            value={getTime}
                        />
                    )}

                    {/* Rebalance Channel Information Sections */}
                    {routingEvent.isRebalance &&
                        this.renderRebalanceChannelSections()}
                    {!routingEvent.isRebalance && (
                        <>
                            <FeeBreakdown
                                channelId={inChannelId}
                                peerDisplay={chanInLabel}
                                channelPoint={channelInPoint}
                                label={localeString(
                                    'views.Routing.RoutingEvent.sourceChannel'
                                )}
                            />

                            <FeeBreakdown
                                channelId={outChannelId}
                                peerDisplay={chanOutLabel}
                                channelPoint={channelOutPoint}
                                label={localeString(
                                    'views.Routing.RoutingEvent.destinationChannel'
                                )}
                            />
                        </>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    highlight: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    amount: {
        alignItems: 'center',
        padding: 10
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        alignSelf: 'center'
    },
    breakdownHeader: {
        alignSelf: 'center',
        padding: 12,
        fontSize: 20
    },
    sectionTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        marginBottom: 12,
        textAlign: 'center',
        textTransform: 'uppercase'
    }
});
