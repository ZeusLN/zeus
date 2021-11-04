import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, CheckBox, Divider, Header, Icon } from 'react-native-elements';
import Channel from './../../models/Channel';
import BalanceSlider from './../../components/BalanceSlider';
import KeyValue from './../../components/KeyValue';
import { Amount } from './../../components/Amount';
import FeeBreakdown from './../../components/FeeBreakdown';
import { inject, observer } from 'mobx-react';

import DateTimeUtils from './../../utils/DateTimeUtils';
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

@inject(
    'ChannelsStore',
    'FeeStore',
    'NodeInfoStore',
    'UnitsStore',
    'SettingsStore'
)
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
            FeeStore,
            UnitsStore,
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
        const { loading, nodes } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { privacy } = settings;
        const { lurkerMode } = privacy;

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

        const peerName =
            (nodes[remote_pubkey] && nodes[remote_pubkey].alias) ||
            alias ||
            channelId;

        const peerDisplay = PrivacyUtils.sensitiveValue(peerName, 8);

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
            <ScrollView
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background'),
                    color: themeColor('text')
                }}
            >
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
                        <Text
                            style={{
                                ...styles.alias,
                                color: themeColor('text')
                            }}
                        >
                            {peerDisplay}
                        </Text>
                        {remote_pubkey && (
                            <Text
                                style={{
                                    ...styles.pubkey,
                                    color: themeColor('text')
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(remote_pubkey)}
                            </Text>
                        )}
                    </View>

                    <BalanceSlider
                        localBalance={lurkerMode ? 50 : localBalance}
                        remoteBalance={lurkerMode ? 50 : remoteBalance}
                    />

                    <View style={styles.balances}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text
                                style={{
                                    ...styles.balance,
                                    color: themeColor('text')
                                }}
                            >{`${localeString(
                                'views.Channel.localBalance'
                            )}: ${units && channelBalanceLocal}`}</Text>
                            <Text
                                style={{
                                    ...styles.balance,
                                    color: themeColor('text')
                                }}
                            >{`${localeString(
                                'views.Channel.remoteBalance'
                            )}: ${units && channelBalanceRemote}`}</Text>
                            {unsettled_balance && (
                                <Text
                                    style={{
                                        ...styles.balance,
                                        color: themeColor('text')
                                    }}
                                >{`${localeString(
                                    'views.Channel.unsettledBalance'
                                )}: ${units && unsettledBalance}`}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <KeyValue
                        keyValue={localeString('views.Channel.status')}
                        value={
                            isActive
                                ? localeString('views.Channel.active')
                                : localeString('views.Channel.inactive')
                        }
                        color={isActive ? 'green' : 'red'}
                    />

                    <KeyValue
                        keyValue={localeString('views.Channel.private')}
                        value={privateChannel ? 'True' : 'False'}
                        color={privateChannel ? 'green' : '#808000'}
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
                            keyValue={localeString('views.Channel.totalSent')}
                            value={
                                <Amount
                                    sats={total_satoshis_sent}
                                    sensitive
                                    toggleable
                                />
                            }
                        />
                    )}

                    {capacity && (
                        <KeyValue
                            keyValue={localeString('views.Channel.capacity')}
                            value={
                                <Amount sats={capacity} sensitive toggleable />
                            }
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

                    {commit_fee && (
                        <KeyValue
                            keyValue={localeString('views.Channel.commitFee')}
                            value={commit_fee}
                            sensitive
                        />
                    )}

                    {csv_delay && (
                        <KeyValue
                            keyValue={localeString('views.Channel.csvDelay')}
                            value={csv_delay}
                        />
                    )}

                    {fee_per_kw && (
                        <KeyValue
                            keyValue={localeString('views.Channel.feePerKw')}
                            value={fee_per_kw}
                            sensitive
                        />
                    )}

                    <Divider orientation="horizontal" style={{ margin: 20 }} />

                    {implementation === 'lnd' && (
                        <FeeBreakdown
                            channelId={channelId}
                            peerDisplay={peerDisplay}
                            channelPoint={channel_point}
                        />
                    )}

                    {implementation !== 'lnd' && (
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
                            channelPoint={channel_point}
                            channelId={channelId}
                            peerDisplay={peerDisplay}
                            FeeStore={FeeStore}
                        />
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
                                        style={{
                                            ...styles.textInput,
                                            color: themeColor('text')
                                        }}
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
        paddingBottom: 10
    },
    pubkey: {
        paddingTop: 10,
        paddingBottom: 30
    },
    balance: {
        fontSize: 15,
        fontWeight: 'bold'
    },
    balances: {
        paddingBottom: 10,
        alignItems: 'center'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    textInput: {
        fontSize: 20
    }
});
