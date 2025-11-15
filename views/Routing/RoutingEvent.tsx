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

import { Divider } from 'react-native-elements';

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

    private renderChannelLink = (displayName: string, onPress: () => void) => (
        <TouchableOpacity onPress={onPress}>
            <Text
                style={[styles.highlight, { color: themeColor('highlight') }]}
            >
                {displayName}
            </Text>
        </TouchableOpacity>
    );

    private renderChannelSection = (
        channel: any,
        sectionTitle: string,
        channelId: string,
        onChannelPress: () => void
    ) => (
        <>
            <Text style={[styles.sectionHeader, { color: themeColor('text') }]}>
                {sectionTitle}
            </Text>

            {channel && (
                <>
                    <KeyValue
                        keyValue={localeString('general.node')}
                        value={this.renderChannelLink(
                            channel.displayName ||
                                channel.alias ||
                                localeString('general.unknown'),
                            onChannelPress
                        )}
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.localBalance')}
                        value={
                            <Amount
                                sats={
                                    channel.local_balance ||
                                    channel.localBalance ||
                                    0
                                }
                                toggleable
                                sensitive
                            />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.remoteBalance')}
                        value={
                            <Amount
                                sats={
                                    channel.remote_balance ||
                                    channel.remoteBalance ||
                                    0
                                }
                                toggleable
                                sensitive
                            />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.channelId')}
                        value={
                            channel.chan_id || channel.channelId || channelId
                        }
                        sensitive
                    />
                </>
            )}
        </>
    );

    render() {
        const { navigation, ChannelsStore } = this.props;
        const { routingEvent } = this.state;
        const { aliasesById, channels } = ChannelsStore;

        const {
            fee,
            getTime,
            inChannelId,
            outChannelId,
            inAmt,
            outAmt,
            isRebalance,
            rebalanceFees,
            rebalanceAmount,
            sourceChannel,
            destinationChannel
        } = routingEvent;

        const isRebalanceOperation =
            isRebalance || (sourceChannel && destinationChannel);

        let chanIn, chanOut;
        if (isRebalanceOperation && sourceChannel && destinationChannel) {
            chanIn = sourceChannel;
            chanOut = destinationChannel;
        } else {
            const chanInFilter = channels.filter(
                (channel) => channel.channelId === inChannelId
            );
            chanIn = chanInFilter[0];
            const chanOutFilter = channels.filter(
                (channel) => channel.channelId === outChannelId
            );
            chanOut = chanOutFilter[0];
        }
        const chanInLabel = aliasesById[inChannelId] || inChannelId;
        const chanOutLabel = aliasesById[outChannelId] || outChannelId;
        const channelInPoint = chanIn && chanIn.channel_point;
        const channelOutPoint = chanOut && chanOut.channel_point;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Routing.RoutingEvent.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {isRebalanceOperation ? (
                        <>
                            <View style={styles.amount}>
                                <Amount
                                    sats={rebalanceAmount || inAmt || 0}
                                    jumboText
                                    toggleable
                                    credit
                                    sensitive
                                />
                            </View>

                            {(fee || rebalanceFees) && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.EditFee.titleDisplayOnly'
                                    )}
                                    value={
                                        <Amount
                                            sats={fee || rebalanceFees || 0}
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

                            {this.renderChannelSection(
                                chanIn,
                                localeString(
                                    'views.Routing.RoutingEvent.sourceChannel'
                                ),
                                inChannelId,
                                () =>
                                    navigation.navigate('Channel', {
                                        channel: chanIn
                                    })
                            )}

                            <Divider
                                orientation="horizontal"
                                style={{ margin: 8 }}
                            />

                            {this.renderChannelSection(
                                chanOut,
                                localeString(
                                    'views.Routing.RoutingEvent.destinationChannel'
                                ),
                                outChannelId,
                                () =>
                                    navigation.navigate('Channel', {
                                        channel: chanOut
                                    })
                            )}
                        </>
                    ) : (
                        <>
                            <View style={styles.amount}>
                                <Amount
                                    sats={
                                        fee ||
                                        (parseInt(inAmt) - parseInt(outAmt)) /
                                            1000
                                    }
                                    jumboText
                                    toggleable
                                    credit
                                    sensitive
                                />
                            </View>

                            {inChannelId && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.NodeInfo.ForwardingHistory.srcChannelId'
                                    )}
                                    value={
                                        chanIn
                                            ? this.renderChannelLink(
                                                  chanInLabel,
                                                  () =>
                                                      navigation.navigate(
                                                          'Channel',
                                                          { channel: chanIn }
                                                      )
                                              )
                                            : chanInLabel
                                    }
                                    sensitive
                                />
                            )}

                            {outChannelId && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.NodeInfo.ForwardingHistory.dstChannelId'
                                    )}
                                    value={
                                        chanOut
                                            ? this.renderChannelLink(
                                                  chanOutLabel,
                                                  () =>
                                                      navigation.navigate(
                                                          'Channel',
                                                          { channel: chanOut }
                                                      )
                                              )
                                            : chanOutLabel
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

                            {getTime && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.NodeInfo.ForwardingHistory.timestamp'
                                    )}
                                    value={getTime}
                                />
                            )}

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
    sectionHeader: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 20,
        textAlign: 'center',
        padding: 20,
        marginTop: 10
    }
});
