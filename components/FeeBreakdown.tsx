import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { inject, observer } from 'mobx-react';
import ChannelsStore from '../stores/ChannelsStore';

import DateTimeUtils from '../utils/DateTimeUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import { Divider } from 'react-native-elements';

import LoadingIndicator from '../components/LoadingIndicator';

import Amount from './Amount';
import KeyValue from './KeyValue';

interface FeeBreakdownProps {
    ChannelsStore: ChannelsStore;
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

@inject('ChannelsStore')
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
            isActive,
            total_satoshis_received,
            total_satoshis_sent,
            commit_weight,
            commit_fee,
            csv_delay,
            privateChannel
        } = this.props;
        const { loading, chanInfo } = ChannelsStore;

        return (
            <React.Fragment>
                {loading && <LoadingIndicator />}
                {!loading &&
                chanInfo &&
                chanInfo[channelId] &&
                chanInfo[channelId].node1Policy ? (
                    <React.Fragment>
                        <KeyValue
                            keyValue={localeString('views.Channel.channelFees')}
                        />
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.localBaseFee'
                            )}
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
                            keyValue={localeString(
                                'views.Channel.localFeeRate'
                            )}
                            value={`${
                                Number(
                                    chanInfo[channelId].node1Policy
                                        .fee_rate_milli_msat
                                ) / 10000
                            }%`}
                            sensitive
                        />
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.remoteBaseFee'
                            )}
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
                            keyValue={localeString(
                                'views.Channel.remoteFeeRate'
                            )}
                            value={`${
                                Number(
                                    chanInfo[channelId].node2Policy
                                        .fee_rate_milli_msat
                                ) / 10000
                            }%`}
                            sensitive
                        />
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {!loading && (
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
                        )}
                    </React.Fragment>
                )}
                {!loading &&
                    chanInfo &&
                    chanInfo[channelId] &&
                    chanInfo[channelId].node2Policy && (
                        <React.Fragment>
                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.channelPayments'
                                )}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.localMin'
                                )}
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
                                keyValue={localeString(
                                    'views.Channel.remoteMin'
                                )}
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
                                keyValue={localeString(
                                    'views.Channel.localMax'
                                )}
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
                                keyValue={localeString(
                                    'views.Channel.remoteMax'
                                )}
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
                                keyValue={localeString(
                                    'views.Channel.localTimeLock'
                                )}
                                value={`${
                                    chanInfo[channelId].node2Policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.remoteTimeLock'
                                )}
                                value={`${
                                    chanInfo[channelId].node1Policy
                                        .time_lock_delta
                                } ${localeString('general.blocks')}`}
                            />
                            <Divider
                                orientation="horizontal"
                                style={{ margin: 20 }}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.channelActivity'
                                )}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.lastUpdate'
                                )}
                                value={DateTimeUtils.listFormattedDate(
                                    chanInfo[channelId].node2Policy.last_update
                                )}
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.peerStatus'
                                )}
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
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.channelFunding'
                                )}
                            />

                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.fundedBy'
                                )}
                                value={
                                    initiator
                                        ? localeString('views.Channel.yourNode')
                                        : peerDisplay
                                }
                            />
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.unannounced'
                                )}
                                value={privateChannel ? 'True' : 'False'}
                                color={privateChannel ? 'green' : '#808000'}
                            />

                            {commit_fee && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.commitFee'
                                    )}
                                    value={
                                        <Amount
                                            sats={commit_fee}
                                            toggleable
                                            sensitive
                                        />
                                    }
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
                                    value={`${csv_delay} ${localeString(
                                        'general.blocks'
                                    )}`}
                                />
                            )}

                            {channelPoint && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.channelPoint'
                                    )}
                                    value={channelPoint}
                                    color={themeColor('chain')}
                                    sensitive
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
