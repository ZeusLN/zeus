import * as React from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import Channel from './../../models/Channel';
import BalanceSlider from './../../components/BalanceSlider';
import SetFeesForm from './../../components/SetFeesForm';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import PrivacyUtils from './../../utils/PrivacyUtils';
import { localeString } from './../../utils/LocaleUtils';
import { themeColor } from './../../utils/ThemeUtils';

import ChannelsStore from './../../stores/ChannelsStore';
import FeeStore from './../../stores/FeeStore';
import UnitsStore from './../../stores/UnitsStore';
import SettingsStore from './../../stores/SettingsStore';

interface ChannelProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    FeeStore: FeeStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

interface ChannelState {
    confirmCloseChannel: boolean;
    satPerByte: string;
    forceClose: boolean;
    channel: Channel;
}

@inject('ChannelsStore', 'UnitsStore', 'FeeStore', 'SettingsStore')
@observer
export default class ChannelView extends React.Component<
    ChannelProps,
    ChannelState
> {
    constructor(props: any) {
        super(props);
        const { navigation, ChannelsStore, SettingsStore } = props;
        const channel: Channel = navigation.getParam('channel', null);
        const { implementation } = SettingsStore;

        this.state = {
            confirmCloseChannel: false,
            satPerByte: '',
            forceClose: false,
            channel: channel
        };

        if (implementation === 'lnd') {
            ChannelsStore.getChannelInfo(channel.channelId);
        }
    }

    closeChannel = (
        channelPoint: string,
        channelId: string,
        satPerByte?: string | null,
        forceClose?: boolean | null
    ) => {
        const { ChannelsStore, navigation } = this.props;

        // lnd
        if (channelPoint) {
            const [funding_txid_str, output_index] = channelPoint.split(':');

            if (satPerByte) {
                ChannelsStore.closeChannel(
                    { funding_txid_str, output_index },
                    null,
                    satPerByte,
                    forceClose
                );
            } else {
                ChannelsStore.closeChannel(
                    { funding_txid_str, output_index },
                    null,
                    null,
                    forceClose
                );
            }
        } else if (channelId) {
            // c-lightning, eclair
            ChannelsStore.closeChannel(null, channelId, satPerByte, forceClose);
        }

        navigation.navigate('Wallet');
    };

    render() {
        const {
            navigation,
            ChannelsStore,
            UnitsStore,
            FeeStore,
            SettingsStore
        } = this.props;
        const {
            channel,
            confirmCloseChannel,
            satPerByte,
            forceClose
        } = this.state;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { channelFees } = FeeStore;
        const { loading, nodes, chanInfo } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { lurkerMode } = settings;

        const {
            channel_point,
            commit_weight,
            localBalance,
            commit_fee,
            csv_delay,
            fee_per_kw,
            total_satoshis_received,
            isActive,
            remoteBalance,
            unsettled_balance,
            total_satoshis_sent,
            remote_pubkey,
            capacity,
            alias,
            channelId
        } = channel;
        const privateChannel = channel.private;

        const channelName =
            (nodes[remote_pubkey] && nodes[remote_pubkey].alias) ||
            alias ||
            channelId;

        const channelDisplay = PrivacyUtils.sensitiveValue(channelName, 8);

        const data = new Identicon(
            hash.sha1(alias || remote_pubkey || channelId),
            255
        ).toString();

        const channelFee = channelFees[channel_point];

        const channelBalanceLocal = PrivacyUtils.sensitiveValue(
            getAmount(localBalance || 0),
            8,
            true
        );
        const channelBalanceRemote = PrivacyUtils.sensitiveValue(
            getAmount(remoteBalance || 0),
            8,
            true
        );

        const unsettledBalance = PrivacyUtils.sensitiveValue(
            getAmount(unsettled_balance),
            8,
            true
        );

        const totalSatoshisReceived = PrivacyUtils.sensitiveValue(
            getAmount(total_satoshis_received || 0),
            8,
            true
        );
        const totalSatoshisSent = PrivacyUtils.sensitiveValue(
            getAmount(total_satoshis_sent || 0),
            8,
            true
        );

        const capacityDisplay = PrivacyUtils.sensitiveValue(
            getAmount(capacity),
            5,
            true
        );

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <ScrollView style={styles.scrollView}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Channel.title'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="#1f2328"
                />
                <View style={styles.content}>
                    <View style={styles.center}>
                        <Text style={styles.alias}>{channelDisplay}</Text>
                        {remote_pubkey && (
                            <Text style={styles.pubkey}>
                                {PrivacyUtils.sensitiveValue(remote_pubkey)}
                            </Text>
                        )}

                        <Image
                            source={{ uri: `data:image/png;base64,${data}` }}
                            style={{ width: 200, height: 200 }}
                        />
                    </View>

                    <BalanceSlider
                        localBalance={lurkerMode ? 50 : localBalance}
                        remoteBalance={lurkerMode ? 50 : remoteBalance}
                    />

                    <View style={styles.balances}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text style={styles.balance}>{`${localeString(
                                'views.Channel.localBalance'
                            )}: ${units && channelBalanceLocal}`}</Text>
                            <Text style={styles.balance}>{`${localeString(
                                'views.Channel.remoteBalance'
                            )}: ${units && channelBalanceRemote}`}</Text>
                            {unsettled_balance && (
                                <Text style={styles.balance}>{`${localeString(
                                    'views.Channel.unsettledBalance'
                                )}: ${units && unsettledBalance}`}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>
                        {localeString('views.Channel.status')}:
                    </Text>
                    <Text
                        style={{
                            ...styles.value,
                            color: isActive ? 'green' : 'red'
                        }}
                    >
                        {isActive
                            ? localeString('views.Channel.active')
                            : localeString('views.Channel.inactive')}
                    </Text>

                    <Text style={styles.label}>
                        {localeString('views.Channel.private')}:
                    </Text>
                    <Text
                        style={{
                            ...styles.value,
                            color: privateChannel ? 'green' : '#808000'
                        }}
                    >
                        {privateChannel ? 'True' : 'False'}
                    </Text>

                    {total_satoshis_received && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.totalReceived')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text style={styles.value}>
                                    {units && totalSatoshisReceived}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {total_satoshis_sent && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.totalSent')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text style={styles.value}>
                                    {units && totalSatoshisSent}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {capacity && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.capacity')}:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text style={styles.value}>
                                    {units && capacityDisplay}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {channelFee && channelFee.base_fee_msat && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.baseFee')}:
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    channelFee.base_fee_msat,
                                    5,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {channelFee && channelFee.fee_rate && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.feeRate')}:
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    channelFee.fee_rate * 1000000,
                                    2,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {commit_weight && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.commitWeight')}:
                            </Text>
                            <Text style={styles.value}>{commit_weight}</Text>
                        </View>
                    )}

                    {commit_fee && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.commitFee')}:
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    commit_fee,
                                    4,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {csv_delay && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.csvDelay')}:
                            </Text>
                            <Text style={styles.value}>{csv_delay}</Text>
                        </View>
                    )}

                    {fee_per_kw && (
                        <View>
                            <Text style={styles.label}>
                                {localeString('views.Channel.feePerKw')}:
                            </Text>
                            <Text style={styles.value}>
                                {PrivacyUtils.sensitiveValue(
                                    fee_per_kw,
                                    6,
                                    true
                                )}
                            </Text>
                        </View>
                    )}

                    {implementation === 'lnd' && (
                        <React.Fragment>
                            {loading && (
                                <ActivityIndicator
                                    size="large"
                                    color="#0000ff"
                                />
                            )}
                            {chanInfo[channelId].node1_policy && (
                                <React.Fragment>
                                    <View>
                                        <Text style={styles.label}>
                                            {JSON.stringify(
                                                chanInfo[channelId].yourPolicy
                                            )}
                                            :
                                        </Text>
                                        <Text style={styles.value}>
                                            {PrivacyUtils.sensitiveValue(
                                                chanInfo[channelId].node1_policy
                                                    .fee_base_msat,
                                                6,
                                                true
                                            )}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.label}>
                                            {'Node 1: fee_rate_milli_msat'}:
                                        </Text>
                                        <Text style={styles.value}>
                                            {PrivacyUtils.sensitiveValue(
                                                chanInfo[channelId].node1_policy
                                                    .fee_rate_milli_msat,
                                                6,
                                                true
                                            )}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.label}>
                                            {'Node 1: max_htlc_msat'}:
                                        </Text>
                                        <Text style={styles.value}>
                                            {PrivacyUtils.sensitiveValue(
                                                chanInfo[channelId].node1_policy
                                                    .max_htlc_msat,
                                                6,
                                                true
                                            )}
                                        </Text>
                                    </View>
                                </React.Fragment>
                            )}
                        </React.Fragment>
                    )}

                    {implementation === 'lnd' && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Channel.keysend')}
                                icon={{
                                    name: 'send',
                                    size: 25,
                                    color: '#fff'
                                }}
                                onPress={() =>
                                    navigation.navigate('Send', {
                                        destination: remote_pubkey,
                                        transactionType: 'Keysend',
                                        isValid: true
                                    })
                                }
                                buttonStyle={{
                                    backgroundColor: 'grey',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    )}

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

                    <View style={styles.button}>
                        <Button
                            title={
                                confirmCloseChannel
                                    ? localeString('views.Channel.cancelClose')
                                    : localeString('views.Channel.close')
                            }
                            icon={{
                                name: confirmCloseChannel ? 'cancel' : 'delete',
                                size: 25,
                                color: '#fff'
                            }}
                            onPress={() =>
                                this.setState({
                                    confirmCloseChannel: !confirmCloseChannel
                                })
                            }
                            buttonStyle={{
                                backgroundColor: confirmCloseChannel
                                    ? 'black'
                                    : 'red',
                                borderRadius: 30
                            }}
                        />
                    </View>

                    {confirmCloseChannel && (
                        <React.Fragment>
                            {(implementation === 'lnd' || !implementation) && (
                                <React.Fragment>
                                    <Text
                                        style={{
                                            color: themeColor('text')
                                        }}
                                    >
                                        {localeString(
                                            'views.Channel.closingRate'
                                        )}
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder={'2'}
                                        placeholderTextColor="darkgray"
                                        value={satPerByte}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                satPerByte: text
                                            })
                                        }
                                        numberOfLines={1}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={styles.textInput}
                                    />
                                    {implementation === 'lnd' && (
                                        <CheckBox
                                            title={localeString(
                                                'views.Channel.forceClose'
                                            )}
                                            checked={forceClose}
                                            onPress={() =>
                                                this.setState({
                                                    forceClose: !forceClose
                                                })
                                            }
                                        />
                                    )}
                                </React.Fragment>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Channel.confirmClose'
                                    )}
                                    icon={{
                                        name: 'delete-forever',
                                        size: 25,
                                        color: '#fff'
                                    }}
                                    onPress={() =>
                                        this.closeChannel(
                                            channel_point,
                                            channelId,
                                            satPerByte,
                                            forceClose
                                        )
                                    }
                                    buttonStyle={{
                                        backgroundColor: 'red',
                                        borderRadius: 30
                                    }}
                                />
                            </View>
                        </React.Fragment>
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
    pubkey: {
        paddingTop: 10,
        paddingBottom: 30,
        color: themeColor('text')
    },
    balance: {
        fontSize: 15,
        fontWeight: 'bold',
        color: themeColor('text')
    },
    balances: {
        paddingBottom: 10,
        alignItems: 'center'
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
