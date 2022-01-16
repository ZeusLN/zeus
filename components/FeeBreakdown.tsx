import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { inject, observer } from 'mobx-react';
import ChannelsStore from '../stores/ChannelsStore';

import NodeInfoStore from '../stores/NodeInfoStore';
import FeeStore from '../stores/FeeStore';
import SettingsStore from '../stores/SettingsStore';

import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import LoadingIndicator from '../components/LoadingIndicator';

import { Amount } from './Amount';
import KeyValue from './KeyValue';
import SetFeesForm from './SetFeesForm';

interface FeeBreakdownProps {
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
    FeeStore: FeeStore;
    SettingsStore: SettingsStore;
    channelId: string;
    channelPoint: string;
    peerDisplay?: string;
}

@inject('FeeStore', 'ChannelsStore', 'NodeInfoStore', 'SettingsStore')
@observer
export default class FeeBreakdown extends React.Component<
    FeeBreakdownProps,
    {}
> {
    render() {
        const {
            channelId,
            channelPoint,
            peerDisplay,
            ChannelsStore,
            FeeStore,
            NodeInfoStore,
            SettingsStore
        } = this.props;
        const { loading, chanInfo } = ChannelsStore;
        const { nodeInfo } = NodeInfoStore;
        const { nodeId } = nodeInfo;

        return (
            <React.Fragment>
                {loading && <LoadingIndicator />}
                {chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node1_policy && (
                        <React.Fragment>
                            <View style={styles.title}>
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        alignSelf: 'center'
                                    }}
                                >
                                    {localeString(
                                        'views.Channel.initiatingParty'
                                    )}
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
                            </View>
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
                                value={`${
                                    Number(
                                        chanInfo[channelId].node1_policy
                                            .fee_rate_milli_msat
                                    ) / 10000
                                }%`}
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
                            {chanInfo[channelId].node1_pub === nodeId && (
                                <SetFeesForm
                                    baseFee={`${
                                        Number(
                                            chanInfo[channelId].node1_policy
                                                .fee_base_msat
                                        ) / 1000
                                    }`}
                                    feeRate={`${
                                        Number(
                                            chanInfo[channelId].node1_policy
                                                .fee_rate_milli_msat
                                        ) / 10000
                                    }`}
                                    timeLockDelta={chanInfo[
                                        channelId
                                    ].node1_policy.time_lock_delta.toString()}
                                    channelPoint={channelPoint}
                                    channelId={channelId}
                                    FeeStore={FeeStore}
                                    ChannelsStore={ChannelsStore}
                                    SettingsStore={SettingsStore}
                                />
                            )}
                        </React.Fragment>
                    )}
                {chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node2_policy && (
                        <React.Fragment>
                            <View style={styles.title}>
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
                            </View>
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
                                value={`${
                                    Number(
                                        chanInfo[channelId].node2_policy
                                            .fee_rate_milli_msat
                                    ) / 10000
                                }%`}
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
                            {chanInfo[channelId].node2_pub === nodeId && (
                                <SetFeesForm
                                    baseFee={`${
                                        Number(
                                            chanInfo[channelId].node2_policy
                                                .fee_base_msat
                                        ) / 1000
                                    }`}
                                    feeRate={`${
                                        Number(
                                            chanInfo[channelId].node2_policy
                                                .fee_rate_milli_msat
                                        ) / 10000
                                    }`}
                                    timeLockDelta={chanInfo[
                                        channelId
                                    ].node2_policy.time_lock_delta.toString()}
                                    channelPoint={channelPoint}
                                    channelId={channelId}
                                    FeeStore={FeeStore}
                                    ChannelsStore={ChannelsStore}
                                    SettingsStore={SettingsStore}
                                />
                            )}
                        </React.Fragment>
                    )}
            </React.Fragment>
        );
    }
}

const styles = StyleSheet.create({
    title: {
        paddingTop: 15,
        paddingBottom: 5
    }
});
