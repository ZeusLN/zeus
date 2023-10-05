import * as React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';

import Header from '../../components/Header';
import Screen from '../../components/Screen';
import SetFeesForm from '../../components/SetFeesForm';

import Channel from '../../models/Channel';

import ChannelsStore from '../../stores/ChannelsStore';
import FeeStore from '../../stores/FeeStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';

import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

interface SetFeesProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'FeeStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class SetFees extends React.PureComponent<SetFeesProps, {}> {
    render() {
        const { ChannelsStore, FeeStore, SettingsStore, navigation } =
            this.props;
        const { chanInfo, nodes } = ChannelsStore;
        const { channelFees } = FeeStore;
        const { nodeInfo } = this.props.NodeInfoStore;
        const { nodeId } = nodeInfo;

        const channel: Channel = navigation.getParam('channel', null);

        let peerName;
        if (channel) {
            peerName =
                (nodes[channel.remotePubkey] &&
                    nodes[channel.remotePubkey].alias) ||
                channel.alias ||
                channel.channelId;
        }

        const channelId = channel && channel.channelId;
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
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15
                    }}
                >
                    {channel && policy && BackendUtils.isLNDBased() && (
                        <SetFeesForm
                            baseFee={`${Number(policy.fee_base_msat) / 1000}`}
                            feeRate={`${
                                Number(policy.fee_rate_milli_msat) / 10000
                            }`}
                            timeLockDelta={policy.time_lock_delta.toString()}
                            minHtlc={`${Number(policy.min_htlc) / 1000}`}
                            maxHtlc={`${Number(policy.max_htlc_msat) / 1000}`}
                            channelPoint={channelPoint}
                            channelId={channelId}
                            FeeStore={FeeStore}
                            ChannelsStore={ChannelsStore}
                            SettingsStore={SettingsStore}
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
                            FeeStore={FeeStore}
                        />
                    )}
                    {!channel && <SetFeesForm FeeStore={FeeStore} />}
                </View>
            </Screen>
        );
    }
}
