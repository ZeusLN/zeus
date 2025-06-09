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
        const { chan_id_in, chan_id_out, out_channel, in_channel } =
            routingEvent;

        this.props.ChannelsStore.loadChannelInfo(
            chan_id_in || in_channel,
            true
        );
        this.props.ChannelsStore.loadChannelInfo(
            chan_id_out || out_channel,
            true
        );

        this.state = {
            routingEvent
        };
    }
    render() {
        const { navigation, ChannelsStore } = this.props;
        const { routingEvent } = this.state;
        const { aliasesById, channels } = ChannelsStore;

        const {
            chan_id_in,
            chan_id_out,
            amt_in,
            amt_out,
            fee,
            getTime,
            in_msat,
            out_msat,
            in_channel,
            out_channel
        } = routingEvent;

        const chanInFilter = channels.filter(
            (channel) =>
                channel.channelId === chan_id_in ||
                channel.channelId === in_channel
        );
        const chanIn = chanInFilter[0];
        const chanOutFilter = channels.filter(
            (channel) =>
                channel.channelId === chan_id_out ||
                channel.channelId === out_channel
        );
        const chanOut = chanOutFilter[0];
        const chanInLabel = aliasesById[chan_id_in] || chan_id_in || in_channel;
        const chanOutLabel =
            aliasesById[chan_id_out] || chan_id_out || out_channel;
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
                    <View style={styles.amount}>
                        <Amount
                            sats={
                                fee ||
                                (parseInt(in_msat) - parseInt(out_msat)) / 1000
                            }
                            jumboText
                            toggleable
                            credit
                            sensitive
                        />
                    </View>

                    {(chan_id_in || in_channel) && (
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

                    {(chan_id_out || out_channel) && (
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

                    {(amt_in || in_msat) && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtIn'
                            )}
                            value={
                                <Amount
                                    sats={amt_in || in_msat / 1000}
                                    sensitive
                                />
                            }
                        />
                    )}

                    {(amt_out || out_msat) && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtOut'
                            )}
                            value={
                                <Amount
                                    sats={amt_out || out_msat / 1000}
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

                    <FeeBreakdown
                        channelId={chan_id_in || in_channel}
                        peerDisplay={chanInLabel}
                        channelPoint={channelInPoint}
                        label={localeString(
                            'views.Routing.RoutingEvent.sourceChannel'
                        )}
                    />

                    <FeeBreakdown
                        channelId={chan_id_out || out_channel}
                        peerDisplay={chanOutLabel}
                        channelPoint={channelOutPoint}
                        label={localeString(
                            'views.Routing.RoutingEvent.destinationChannel'
                        )}
                    />
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
    }
});
