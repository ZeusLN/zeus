import * as React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import ForwardEvent from './../../models/ForwardEvent';

import SetFeesForm from './../../components/SetFeesForm';
import KeyValue from './../../components/KeyValue';
import { Amount } from './../../components/Amount';
import { inject, observer } from 'mobx-react';

import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

interface RoutingEventProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'UnitsStore', 'FeeStore', 'SettingsStore')
@observer
export default class RoutingEvent extends React.Component<
    RoutingEventProps,
    {}
> {
    render() {
        const {
            navigation,
            ChannelsStore,
            UnitsStore,
            FeeStore,
            SettingsStore
        } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { channelFees } = FeeStore;
        const { aliasesById, channels } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { lurkerMode } = settings;

        const routingEvent: ForwardEvent = navigation.getParam(
            'routingEvent',
            null
        );
        const {
            chan_id_in,
            chan_id_out,
            amt_in,
            amt_out,
            fee,
            getTime
        } = routingEvent;

        const chanInFilter = channels.filter(
            channel => channel.channelId === chan_id_in
        );
        const chanIn = chanInFilter[0];
        const chanOutFilter = channels.filter(
            channel => channel.channelId === chan_id_out
        );
        const chanOut = chanOutFilter[0];
        const chanInLabel = aliasesById[chan_id_in] || chan_id_in;
        const chanOutLabel = aliasesById[chan_id_out] || chan_id_out;

        // const channelFee = channelFees[channel_point];

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Routing')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Routing.RoutingEvent.title'),
                        style: { color: themeColor('text') }
                    }}
                    backgroundColor={themeColor('background')}
                />
                <View style={styles.content}>
                    <View style={styles.amount}>
                        <Amount
                            sats={fee}
                            jumboText
                            toggleable
                            credit
                            sensitive
                        />
                    </View>

                    {chan_id_in && (
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

                    {chan_id_out && (
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

                    {amt_in && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtIn'
                            )}
                            value={<Amount sats={amt_in} sensitive />}
                        />
                    )}

                    {amt_out && (
                        <KeyValue
                            keyValue={localeString(
                                'views.NodeInfo.ForwardingHistory.amtOut'
                            )}
                            value={<Amount sats={amt_out} sensitive />}
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

                    {false && (
                        <SetFeesForm
                            baseFeeMsat={
                                channelFee &&
                                channelFee.base_fee_msat &&
                                channelFee.base_fee_msat.toString()
                            }
                            feeRate={
                                channelFee &&
                                channelFee.fee_rate &&
                                channelFee.fee_rate.toString()
                            }
                            channelPoint={channel_point}
                            channelId={channelId}
                            FeeStore={FeeStore}
                        />
                    )}
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        backgroundColor: themeColor('background'),
        color: themeColor('text')
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
