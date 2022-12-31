import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Divider, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Channel from './../../models/Channel';

import BalanceSlider from './../../components/BalanceSlider';
import Button from './../../components/Button';
import KeyValue from './../../components/KeyValue';
import Amount from './../../components/Amount';
import FeeBreakdown from './../../components/FeeBreakdown';
import SetFeesForm from './../../components/SetFeesForm';
import Switch from './../../components/Switch';
import TextInput from './../../components/TextInput';

import PrivacyUtils from './../../utils/PrivacyUtils';
import BackendUtils from './../../utils/BackendUtils';
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
        const { navigation, ChannelsStore } = props;
        const channel: Channel = navigation.getParam('channel', null);

        this.state = {
            confirmCloseChannel: false,
            satPerByte: '',
            forceClose: false,
            channel
        };

        if (BackendUtils.isLNDBased()) {
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
        const { channel, confirmCloseChannel, satPerByte, forceClose } =
            this.state;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { channelFees } = FeeStore;
        const { nodes } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = (privacy && privacy.lurkerMode) || false;

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
            channelId,
            initiator,
            alias_scids
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

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color={themeColor('text')}
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
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor={themeColor('background')}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View style={styles.content}>
                    <View style={styles.center}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'Lato-Regular',
                                ...styles.alias
                            }}
                        >
                            {peerDisplay}
                        </Text>
                        {remote_pubkey && (
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    ...styles.pubkey
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
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    ...styles.balance
                                }}
                            >{`${localeString('views.Channel.localBalance')}: ${
                                units && channelBalanceLocal
                            }`}</Text>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'Lato-Regular',
                                    ...styles.balance
                                }}
                            >{`${localeString(
                                'views.Channel.remoteBalance'
                            )}: ${units && channelBalanceRemote}`}</Text>
                            {unsettled_balance && (
                                <Text
                                    style={{
                                        color: themeColor('text'),
                                        fontFamily: 'Lato-Regular',
                                        ...styles.balance
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

                    {!!alias_scids && alias_scids.length > 0 && (
                        <KeyValue
                            keyValue={
                                alias_scids.length > 1
                                    ? localeString('views.Channel.aliasScids')
                                    : localeString('views.Channel.aliasScid')
                            }
                            value={PrivacyUtils.sensitiveValue(
                                alias_scids.join(', ')
                            )}
                        />
                    )}

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

                    {BackendUtils.isLNDBased() && (
                        <FeeBreakdown
                            channelId={channelId}
                            peerDisplay={peerDisplay}
                            channelPoint={channel_point}
                            initiator={initiator}
                        />
                    )}

                    {!BackendUtils.isLNDBased() && (
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

                    {BackendUtils.isLNDBased() && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.Channel.keysend')}
                                icon={{
                                    name: 'send'
                                }}
                                onPress={() =>
                                    navigation.navigate('Send', {
                                        destination: remote_pubkey,
                                        transactionType: 'Keysend',
                                        isValid: true
                                    })
                                }
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
                                name: confirmCloseChannel ? 'cancel' : 'delete'
                            }}
                            onPress={() =>
                                this.setState({
                                    confirmCloseChannel: !confirmCloseChannel
                                })
                            }
                            secondary
                        />
                    </View>

                    {confirmCloseChannel && (
                        <React.Fragment>
                            {(BackendUtils.isLNDBased() || !implementation) && (
                                <React.Fragment>
                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Channel.closingRate'
                                        )}
                                    </Text>
                                    <TextInput
                                        keyboardType="numeric"
                                        placeholder={'2'}
                                        value={satPerByte}
                                        onChangeText={(text: string) =>
                                            this.setState({
                                                satPerByte: text
                                            })
                                        }
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {BackendUtils.isLNDBased() && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.secondaryText,
                                                    top: 20
                                                }}
                                            >
                                                {localeString(
                                                    'views.Channel.forceClose'
                                                )}
                                            </Text>
                                            <Switch
                                                value={forceClose}
                                                onValueChange={() =>
                                                    this.setState({
                                                        forceClose: !forceClose
                                                    })
                                                }
                                            />
                                        </>
                                    )}
                                </React.Fragment>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Channel.confirmClose'
                                    )}
                                    icon={{
                                        name: 'delete-forever'
                                    }}
                                    onPress={() =>
                                        this.closeChannel(
                                            channel_point,
                                            channelId,
                                            satPerByte,
                                            forceClose
                                        )
                                    }
                                    tertiary
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
    text: {
        color: themeColor('text'),
        fontFamily: 'Lato-Regular'
    },
    secondaryText: {
        color: themeColor('secondaryText'),
        fontFamily: 'Lato-Regular'
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
    }
});
