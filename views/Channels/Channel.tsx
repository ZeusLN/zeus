import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import { Divider, Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Channel from './../../models/Channel';

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

import Share from './../../assets/images/SVG/Share.svg';

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

    handleOnNavigateBack = (satPerByte: string) => {
        this.setState({
            satPerByte
        });
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
        const { getAmount, units } = UnitsStore;
        const { channelFees } = FeeStore;
        const { nodes } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { privacy } = settings;
        const enableMempoolRates = privacy && privacy.enableMempoolRates;

        const {
            channel_point,
            commit_weight,
            localBalance,
            commit_fee,
            csv_delay,
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
            alias_scids,
            local_chan_reserve_sat,
            remote_chan_reserve_sat
        } = channel;
        const privateChannel = channel.private;
        const [fundingTransaction] = channel_point.split(':');

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

        const KeySend = () => (
            <Share
                onPress={() =>
                    navigation.navigate('Send', {
                        destination: remote_pubkey,
                        transactionType: 'Keysend',
                        isValid: true
                    })
                }
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
                    rightComponent={<KeySend />}
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
                                    color: '#FFD93F',
                                    fontFamily: 'Lato-Regular',
                                    ...styles.pubkey
                                }}
                            >
                                {PrivacyUtils.sensitiveValue(
                                    remote_pubkey
                                ).slice(0, 6) +
                                    '...' +
                                    PrivacyUtils.sensitiveValue(
                                        remote_pubkey
                                    ).slice(-6)}
                            </Text>
                        )}
                    </View>

                    <KeyValue
                        keyValue={localeString('views.Channel.channelBalance')}
                    />

                    <KeyValue
                        keyValue={localeString('views.Channel.outbound')}
                        value={units && channelBalanceLocal}
                    />

                    <KeyValue
                        keyValue={localeString('views.Channel.inbound')}
                        value={units && channelBalanceRemote}
                    />

                    {unsettled_balance && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.channelBalance'
                            )}
                            value={units && unsettledBalance}
                        />
                    )}

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

                    <KeyValue
                        keyValue={localeString('views.Channel.localReserve')}
                        value={local_chan_reserve_sat}
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.remoteReserve')}
                        value={remote_chan_reserve_sat}
                    />

                    {capacity && (
                        <KeyValue
                            keyValue={localeString('views.Channel.capacity')}
                            value={
                                <Amount sats={capacity} sensitive toggleable />
                            }
                        />
                    )}

                    <Divider orientation="horizontal" style={{ margin: 20 }} />

                    {BackendUtils.isLNDBased() && (
                        <FeeBreakdown
                            isActive={isActive}
                            channelId={channelId}
                            peerDisplay={peerDisplay}
                            channelPoint={channel_point}
                            initiator={initiator}
                            total_satoshis_received={total_satoshis_received}
                            total_satoshis_sent={total_satoshis_sent}
                            commit_fee={commit_fee}
                            commit_weight={commit_weight}
                            csv_delay={csv_delay}
                            privateChannel={privateChannel}
                            fundingTransaction={fundingTransaction}
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

                    <View style={styles.button}>
                        <Button
                            title={
                                confirmCloseChannel
                                    ? localeString('views.Channel.cancelClose')
                                    : localeString('views.Channel.close')
                            }
                            onPress={() =>
                                this.setState({
                                    confirmCloseChannel: !confirmCloseChannel
                                })
                            }
                            quaternary
                            warning
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
                                    {enableMempoolRates ? (
                                        <TouchableWithoutFeedback
                                            onPress={() =>
                                                navigation.navigate('EditFee', {
                                                    onNavigateBack:
                                                        this
                                                            .handleOnNavigateBack
                                                })
                                            }
                                        >
                                            <View
                                                style={{
                                                    ...styles.editFeeBox,
                                                    borderColor:
                                                        'rgba(255, 217, 63, .6)',
                                                    borderWidth: 3
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 18
                                                    }}
                                                >
                                                    {satPerByte}
                                                </Text>
                                            </View>
                                        </TouchableWithoutFeedback>
                                    ) : (
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
                                    )}
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
                                    // icon={{
                                    //     name: 'delete-forever'
                                    // }}
                                    onPress={() =>
                                        this.closeChannel(
                                            channel_point,
                                            channelId,
                                            satPerByte,
                                            forceClose
                                        )
                                    }
                                    quaternary
                                    warning
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
        fontSize: 28,
        paddingTop: 14,
        paddingBottom: 10
    },
    pubkey: {
        paddingBottom: 30,
        textAlign: 'center'
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
    editFeeBox: {
        height: 65,
        padding: 15,
        marginTop: 15,
        borderRadius: 4,
        borderColor: '#FFD93F',
        borderWidth: 2,
        marginBottom: 20
    }
});
