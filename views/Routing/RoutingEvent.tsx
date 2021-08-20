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
        const { aliasesById } = ChannelsStore;
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
                    <View style={styles.center}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text style={styles.fee}>
                                {PrivacyUtils.sensitiveValue(
                                    getAmount(fee),
                                    3,
                                    true
                                )}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {chan_id_in && (
                        <View>
                            <Text style={styles.label}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.srcChannelId'
                                )}
                                :
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    aliasesById[chan_id_in] || chan_id_in,
                                    10
                                )}
                            </Text>
                        </View>
                    )}

                    {chan_id_out && (
                        <View>
                            <Text style={styles.label}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.dstChannelId'
                                )}
                                :
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    aliasesById[chan_id_out] || chan_id_out,
                                    10
                                )}
                            </Text>
                        </View>
                    )}

                    {amt_in && (
                        <View>
                            <Text style={styles.label}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.amtIn'
                                )}
                                :
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    getAmount(amt_in),
                                    5,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {amt_out && (
                        <View>
                            <Text style={styles.label}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.amtOut'
                                )}
                                :
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    getAmount(amt_out),
                                    5,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {getTime && (
                        <View>
                            <Text style={styles.label}>
                                {localeString(
                                    'views.NodeInfo.ForwardingHistory.timestamp'
                                )}
                                :
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(getTime, 6, true)}
                            </Text>
                        </View>
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
    center: {
        alignItems: 'center'
    },
    alias: {
        fontSize: 20,
        paddingTop: 10,
        paddingBottom: 10,
        color: themeColor('text')
    },
    fee: {
        paddingTop: 10,
        paddingBottom: 30,
        color: themeColor('highlight'),
        fontSize: 35,
        fontWeight: 'bold'
    },
    balance: {
        fontSize: 15,
        fontWeight: 'bold',
        color: themeColor('text')
    },
    value: {
        paddingBottom: 5,
        color: themeColor('text')
    },
    label: {
        paddingTop: 5,
        color: themeColor('text')
    },
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        fontSize: 20,
        color: themeColor('text')
    }
});
