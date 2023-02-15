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

import { Divider } from 'react-native-elements';

import LoadingIndicator from '../components/LoadingIndicator';

import Amount from './Amount';
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
    initiator?: boolean;
    isActive?: boolean;
    total_satoshis_received?: string;
    total_satoshis_sent?: string;
    commit_weight?: number;
    commit_fee?: number;
    csv_delay?: number;
    privateChannel?: boolean;
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
            initiator,
            ChannelsStore,
            FeeStore,
            NodeInfoStore,
            SettingsStore,
            isActive,
            total_satoshis_received,
            total_satoshis_sent,
            commit_weight,
            commit_fee,
            csv_delay,
            privateChannel
        } = this.props;
        const { loading, chanInfo } = ChannelsStore;
        const { nodeInfo } = NodeInfoStore;
        const { nodeId } = nodeInfo;

        return (
            <React.Fragment>
                {loading && <LoadingIndicator />}
                {!loading &&
                chanInfo &&
                chanInfo[channelId] &&
                chanInfo[channelId].node1Policy ? (
                    <React.Fragment>
                        {/* <View style={styles.title}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {(chanInfo[channelId].node1Pub === nodeId &&
                                    initiator) ||
                                (chanInfo[channelId].node1Pub !== nodeId &&
                                    !initiator)
                                    ? localeString(
                                          'views.Channel.initiatingParty'
                                      )
                                    : localeString(
                                          'views.Channel.counterparty'
                                      )}
                            </Text>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {chanInfo[channelId].node1Pub === nodeId
                                    ? localeString('views.Channel.yourNode')
                                    : peerDisplay ||
                                      chanInfo[channelId].node1Pub}
                            </Text>
                        </View> */}
                        <KeyValue keyValue="Channel fees" />
                        <KeyValue
                            keyValue="Local base fee"
                            value={
                                <Amount
                                    sats={
                                        Number(
                                            chanInfo[channelId].node1Policy
                                                .fee_base_msat
                                        ) / 1000
                                    }
                                    toggleable
                                    sensitive
                                />
                            }
                        />
                        <KeyValue
                            keyValue="Local fee rate"
                            value={`${
                                Number(
                                    chanInfo[channelId].node1Policy
                                        .fee_rate_milli_msat
                                ) / 10000
                            }%`}
                            sensitive
                        />
                        {/* <KeyValue
                            keyValue={localeString('views.Channel.minHTLC')}
                            value={
                                <Amount
                                    sats={
                                        Number(
                                            chanInfo[channelId].node1Policy
                                                .min_htlc
                                        ) / 1000
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
                                            chanInfo[channelId].node1Policy
                                                .max_htlc_msat
                                        ) / 1000
                                    }
                                    toggleable
                                    sensitive
                                />
                            }
                        /> */}
                        {/* <KeyValue
                            keyValue={localeString(
                                'views.Channel.timeLockDelta'
                            )}
                            value={`${
                                chanInfo[channelId].node1Policy.time_lock_delta
                            } ${localeString('general.blocks')}`}
                        /> */}
                        {/* <KeyValue
                            keyValue={localeString('views.Channel.lastUpdate')}
                            value={DateTimeUtils.listFormattedDate(
                                chanInfo[channelId].node1Policy.last_update
                            )}
                        /> */}
                        <KeyValue
                            keyValue="Remote base fee"
                            value={
                                <Amount
                                    sats={
                                        Number(
                                            chanInfo[channelId].node2Policy
                                                .fee_base_msat
                                        ) / 1000
                                    }
                                    toggleable
                                    sensitive
                                />
                            }
                        />
                        <KeyValue
                            keyValue="Remote fee rate"
                            value={`${
                                Number(
                                    chanInfo[channelId].node2Policy
                                        .fee_rate_milli_msat
                                ) / 10000
                            }%`}
                            sensitive
                        />
                        {chanInfo[channelId].node1Pub === nodeId && (
                            <SetFeesForm
                                baseFee={`${
                                    Number(
                                        chanInfo[channelId].node1Policy
                                            .fee_base_msat
                                    ) / 1000
                                }`}
                                feeRate={`${
                                    Number(
                                        chanInfo[channelId].node1Policy
                                            .fee_rate_milli_msat
                                    ) / 10000
                                }`}
                                timeLockDelta={chanInfo[
                                    channelId
                                ].node1Policy.time_lock_delta.toString()}
                                minHtlc={`${
                                    Number(
                                        chanInfo[channelId].node1Policy.min_htlc
                                    ) / 1000
                                }`}
                                maxHtlc={`${
                                    Number(
                                        chanInfo[channelId].node1Policy
                                            .max_htlc_msat
                                    ) / 1000
                                }`}
                                channelPoint={channelPoint}
                                channelId={channelId}
                                FeeStore={FeeStore}
                                ChannelsStore={ChannelsStore}
                                SettingsStore={SettingsStore}
                            />
                        )}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <View style={styles.title}>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('text')
                                }}
                            >
                                {localeString(
                                    'components.FeeBreakdown.nowClosed'
                                )}
                            </Text>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {peerDisplay}
                            </Text>
                        </View>
                    </React.Fragment>
                )}
                {!loading &&
                    chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node2Policy && (
                        <React.Fragment>
                            {/* <View style={styles.title}>
                                <Text
                                    style={{
                                        ...styles.text,
                                        color: themeColor('text')
                                    }}
                                >
                                    {(chanInfo[channelId].node2Pub === nodeId &&
                                        initiator) ||
                                    (chanInfo[channelId].node2Pub !== nodeId &&
                                        !initiator)
                                        ? localeString(
                                              'views.Channel.initiatingParty'
                                          )
                                        : localeString(
                                              'views.Channel.counterparty'
                                          )}
                                </Text>
                                <Text
                                    style={{
                                        ...styles.secondaryText,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {chanInfo[channelId].node2Pub === nodeId
                                        ? localeString('views.Channel.yourNode')
                                        : peerDisplay ||
                                          chanInfo[channelId].node2Pub}
                                </Text>
                            </View> */}

                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />

                            <KeyValue keyValue="Channel payments" />
                            <KeyValue
                                keyValue="Local min"
                                value={
                                    <Amount
                                        sats={`${
                                            Number(
                                                chanInfo[channelId].node2Policy
                                                    .min_htlc
                                            ) / 1000
                                        }`}
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue="Remote min"
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node1Policy
                                                    .min_htlc
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue="Local max"
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node2Policy
                                                    .max_htlc_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />
                            <KeyValue
                                keyValue="Remote max"
                                value={
                                    <Amount
                                        sats={
                                            Number(
                                                chanInfo[channelId].node1Policy
                                                    .max_htlc_msat
                                            ) / 1000
                                        }
                                        toggleable
                                        sensitive
                                    />
                                }
                            />

                            <KeyValue
                                keyValue="Local timelock"
                                value={`${
                                    chanInfo[channelId].node2Policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <KeyValue
                                keyValue="Remote timelock"
                                value={`${
                                    chanInfo[channelId].node1Policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />
                            <KeyValue keyValue="Channel activity" />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.lastUpdate'
                                )}
                                value={DateTimeUtils.listFormattedDate(
                                    chanInfo[channelId].node2Policy.last_update
                                )}
                            />
                            <KeyValue
                                keyValue="Peer status"
                                value={
                                    isActive
                                        ? localeString('views.Channel.active')
                                        : localeString('views.Channel.inactive')
                                }
                            />
                            {total_satoshis_received && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.totalReceived'
                                    )}
                                    value={
                                        <Amount
                                            sats={total_satoshis_received}
                                            sensitive
                                            toggleable
                                        />
                                    }
                                />
                            )}

                            {total_satoshis_sent && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.totalSent'
                                    )}
                                    value={
                                        <Amount
                                            sats={total_satoshis_sent}
                                            sensitive
                                            toggleable
                                        />
                                    }
                                />
                            )}
                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />
                            <KeyValue keyValue="Channel funding" />

                            <KeyValue
                                keyValue="Funded by"
                                value={
                                    (chanInfo[channelId].node1Pub === nodeId &&
                                        initiator) ||
                                    (chanInfo[channelId].node1Pub !== nodeId &&
                                        !initiator)
                                        ? localeString('views.Channel.yourNode')
                                        : peerDisplay ||
                                          chanInfo[channelId].node1Pub
                                }
                            />
                            <KeyValue
                                keyValue="Unannounced"
                                value={privateChannel ? 'True' : 'False'}
                            />

                            {commit_fee && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.commitFee'
                                    )}
                                    value={commit_fee}
                                    sensitive
                                />
                            )}

                            {commit_weight && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.commitWeight'
                                    )}
                                    value={commit_weight}
                                />
                            )}

                            {csv_delay && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.csvDelay'
                                    )}
                                    value={csv_delay}
                                />
                            )}
                            {chanInfo[channelId].node2Pub === nodeId && (
                                <SetFeesForm
                                    baseFee={`${
                                        Number(
                                            chanInfo[channelId].node2Policy
                                                .fee_base_msat
                                        ) / 1000
                                    }`}
                                    feeRate={`${
                                        Number(
                                            chanInfo[channelId].node2Policy
                                                .fee_rate_milli_msat
                                        ) / 10000
                                    }`}
                                    timeLockDelta={chanInfo[
                                        channelId
                                    ].node2Policy.time_lock_delta.toString()}
                                    minHtlc={`${
                                        Number(
                                            chanInfo[channelId].node2Policy
                                                .min_htlc
                                        ) / 1000
                                    }`}
                                    maxHtlc={`${
                                        Number(
                                            chanInfo[channelId].node2Policy
                                                .max_htlc_msat
                                        ) / 1000
                                    }`}
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
    text: {
        fontFamily: 'Lato-Regular',
        alignSelf: 'center'
    },
    secondaryText: {
        fontFamily: 'Lato-Regular',
        alignSelf: 'center'
    },
    title: {
        paddingTop: 15,
        paddingBottom: 5
    }
});

{
    /* <Divider orientation="horizontal" style={{ margin: 20 }} /> */
}
