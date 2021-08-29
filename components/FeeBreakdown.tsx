import * as React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import KeyValue from './KeyValue';
import { Amount } from './Amount';
import ChannelsStore from '../stores/ChannelsStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import { inject, observer } from 'mobx-react';

interface FeeBreakdownProps {
    ChannelsStore?: ChannelsStore;
    NodeInfoStore?: NodeInfoStore;
    channelId: string;
    peerDisplay?: string;
}

@inject('ChannelsStore', 'NodeInfoStore')
@observer
export default class FeeBreakdown extends React.Component<
    FeeBreakdownProps,
    {}
> {
    render() {
        const { channelId, peerDisplay } = this.props;
        const ChannelsStore = this.props.ChannelsStore!;
        const NodeInfoStore = this.props.NodeInfoStore!;
        const { loading, chanInfo } = ChannelsStore;
        const { nodeInfo } = NodeInfoStore;
        const { nodeId } = nodeInfo;

        return (
            <React.Fragment>
                {loading && (
                    <ActivityIndicator
                        size="large"
                        color={themeColor('highlight')}
                    />
                )}
                {chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node1_policy && (
                        <React.Fragment>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    alignSelf: 'center'
                                }}
                            >
                                {localeString('views.Channel.initiatingParty')}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    alignSelf: 'center'
                                }}
                            >
                                {chanInfo[channelId].node1_pub === nodeId
                                    ? localeString('views.Channel.yourNode')
                                    : peerDisplay ||
                                      chanInfo[channelId].node1_pub}
                            </Text>
                            <KeyValue
                                keyValue={localeString('views.Channel.baseFee')}
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node1_policy
                                                    .fee_base_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.feeRate')}
                                value={`${Number(
                                    chanInfo[channelId].node1_policy
                                        .fee_rate_milli_msat
                                ) / 1000}%`}
                                sensitive
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.minHTLC')}
                                value={
                                    <Amount
                                        sats={
                                            chanInfo[channelId].node1_policy
                                                .min_htlc
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.maxHTLC')}
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node1_policy
                                                    .max_htlc_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.timeLockDelta'
                                )}
                                value={`${
                                    chanInfo[channelId].node1_policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.lastUpdate'
                                )}
                                value={DateTimeUtils.listFormattedDate(
                                    chanInfo[channelId].node1_policy.last_update
                                )}
                            />
                        </React.Fragment>
                    )}
                {chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node2_policy && (
                        <React.Fragment>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    alignSelf: 'center'
                                }}
                            >
                                {localeString('views.Channel.counterparty')}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    alignSelf: 'center'
                                }}
                            >
                                {chanInfo[channelId].node2_pub === nodeId
                                    ? localeString('views.Channel.yourNode')
                                    : peerDisplay ||
                                      chanInfo[channelId].node2_pub}
                            </Text>
                            <KeyValue
                                keyValue={localeString('views.Channel.baseFee')}
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node2_policy
                                                    .fee_base_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.feeRate')}
                                value={`${Number(
                                    chanInfo[channelId].node2_policy
                                        .fee_rate_milli_msat
                                ) / 1000}%`}
                                sensitive
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.minHTLC')}
                                value={
                                    <Amount
                                        sats={
                                            chanInfo[channelId].node2_policy
                                                .min_htlc
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString('views.Channel.maxHTLC')}
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node2_policy
                                                    .max_htlc_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.timeLockDelta'
                                )}
                                value={`${
                                    chanInfo[channelId].node2_policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.lastUpdate'
                                )}
                                value={DateTimeUtils.listFormattedDate(
                                    chanInfo[channelId].node2_policy.last_update
                                )}
                            />
                        </React.Fragment>
                    )}
            </React.Fragment>
        );
    }
}
