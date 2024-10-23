import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import SetFeesForm from '../../components/SetFeesForm';

import Channel from '../../models/Channel';

import ChannelsStore from '../../stores/ChannelsStore';
import FeeStore from '../../stores/FeeStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

interface SetFeesProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    NodeInfoStore: NodeInfoStore;
    route: Route<'SetFees', { channel: Channel }>;
}

@inject('ChannelsStore', 'FeeStore', 'NodeInfoStore')
@observer
export default class SetFees extends React.PureComponent<SetFeesProps, {}> {
    private scrollViewRef = React.createRef<ScrollView>();

    render() {
        const { ChannelsStore, FeeStore, NodeInfoStore, navigation, route } =
            this.props;

        const { chanInfo, nodes } = ChannelsStore;
        const { channelFees } = FeeStore;
        const { nodeInfo } = NodeInfoStore;
        const { nodeId } = nodeInfo;

        const channel = route.params?.channel;

        let peerName;
        if (channel) {
            peerName =
                (nodes[channel.remotePubkey] &&
                    nodes[channel.remotePubkey].alias) ||
                channel.alias ||
                channel.channelId;
        }

        const channelId = channel && channel.channelId!;
        const channelPoint = channel && channel.channel_point;

        // LND
        let policy;
        if (
            chanInfo &&
            chanInfo[channelId] &&
            chanInfo[channelId].node1Pub === nodeId
        ) {
            policy = chanInfo[channelId].node1Policy;
        }
        if (
            chanInfo &&
            chanInfo[channelId] &&
            chanInfo[channelId].node2Pub === nodeId
        ) {
            policy = chanInfo[channelId].node2Policy;
        }

        // CLN
        const channelFee = channelFees[channelPoint];

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: channel
                            ? `${localeString(
                                  'views.Routing.channelFees'
                              )}: ${peerName}`
                            : localeString('views.Routing.SetFees'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView ref={this.scrollViewRef}>
                    <View style={{ padding: 15 }}>
                        {channel && policy && BackendUtils.isLNDBased() && (
                            <SetFeesForm
                                baseFee={`${
                                    Number(policy.fee_base_msat) / 1000
                                }`}
                                feeRate={`${
                                    Number(policy.fee_rate_milli_msat) / 10000
                                }`}
                                baseFeeInbound={
                                    policy.inbound_fee_base_msat
                                        ? `${
                                              Number(
                                                  policy.inbound_fee_base_msat
                                              ) / 1000
                                          }`
                                        : undefined
                                }
                                feeRateInbound={
                                    policy.inbound_fee_rate_milli_msat
                                        ? `${
                                              Number(
                                                  policy.inbound_fee_rate_milli_msat
                                              ) / 10000
                                          }`
                                        : undefined
                                }
                                timeLockDelta={policy.time_lock_delta.toString()}
                                minHtlc={`${Number(policy.min_htlc) / 1000}`}
                                maxHtlc={`${
                                    Number(policy.max_htlc_msat) / 1000
                                }`}
                                channelPoint={channelPoint}
                                channelId={channelId}
                                setFeesCompleted={() =>
                                    this.scrollViewRef.current?.scrollToEnd()
                                }
                            />
                        )}
                        {channel && !BackendUtils.isLNDBased() && (
                            <SetFeesForm
                                baseFee={
                                    channelFee &&
                                    channelFee.base_fee_msat &&
                                    `${Number(channelFee.base_fee_msat) / 1000}`
                                }
                                feeRate={
                                    channelFee &&
                                    channelFee.fee_rate &&
                                    `${Number(channelFee.fee_rate) / 10000}`
                                }
                                channelPoint={channelPoint}
                                channelId={channelId}
                                setFeesCompleted={() =>
                                    this.scrollViewRef.current?.scrollToEnd()
                                }
                            />
                        )}
                        {!channel && (
                            <SetFeesForm
                                setFeesCompleted={() =>
                                    this.scrollViewRef.current?.scrollToEnd()
                                }
                            />
                        )}
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}
