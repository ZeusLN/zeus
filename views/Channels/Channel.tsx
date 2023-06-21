import * as React from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableWithoutFeedback,
    TouchableOpacity,
    View
} from 'react-native';

import { Divider } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import Channel from '../../models/Channel';

import BalanceSlider from '../../components/BalanceSlider';
import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Amount from '../../components/Amount';
import FeeBreakdown from '../../components/FeeBreakdown';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import TextInput from '../../components/TextInput';

import PrivacyUtils from '../../utils/PrivacyUtils';
import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import ChannelsStore from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import Edit from '../../assets/images/SVG/Edit.svg';
import Share from '../../assets/images/SVG/Share.svg';

interface ChannelProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
}

interface ChannelState {
    confirmCloseChannel: boolean;
    satPerByte: string;
    forceCloseChannel: boolean;
    channel: Channel;
}

@inject('ChannelsStore', 'NodeInfoStore', 'SettingsStore')
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
            forceCloseChannel: false,
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
        const { navigation, SettingsStore, NodeInfoStore } = this.props;
        const { channel, confirmCloseChannel, satPerByte, forceCloseChannel } =
            this.state;
        const { settings, implementation } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = privacy && privacy.lurkerMode;
        const enableMempoolRates = privacy && privacy.enableMempoolRates;
        const { testnet } = NodeInfoStore;

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
            remotePubkey,
            capacity,
            channelId,
            initiator,
            alias_scids,
            local_chan_reserve_sat,
            remote_chan_reserve_sat,
            displayName,
            // closed
            closeHeight,
            closeType,
            open_initiator,
            close_initiator,
            closing_tx_hash,
            chain_hash,
            settled_balance,
            time_locked_balance,
            closing_txid,
            pendingClose,
            forceClose,
            pendingOpen,
            closing
        } = channel;
        const privateChannel = channel.private;

        const editableFees: boolean = !(
            pendingOpen ||
            pendingClose ||
            forceClose ||
            closeHeight ||
            closing
        );
        const bumpable: boolean = pendingOpen;

        const peerDisplay = PrivacyUtils.sensitiveValue(displayName, 8);

        const EditFees = () => (
            <View style={{ top: -3 }}>
                <Edit
                    onPress={() => navigation.navigate('SetFees', { channel })}
                    fill={themeColor('text')}
                />
            </View>
        );

        const KeySend = () => (
            <Share
                onPress={() =>
                    navigation.navigate('Send', {
                        destination: remotePubkey,
                        transactionType: 'Keysend',
                        isValid: true
                    })
                }
                fill={themeColor('text')}
            />
        );

        const centerComponent = () => {
            if (editableFees) {
                return <EditFees />;
            }
            return null;
        };

        const keyboardVerticalOffset = Platform.OS === 'ios' ? 40 : 0;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={centerComponent}
                    rightComponent={<KeySend />}
                    placement="right"
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <KeyboardAvoidingView
                        behavior="position"
                        keyboardVerticalOffset={keyboardVerticalOffset}
                    >
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
                            {remotePubkey && (
                                <TouchableOpacity
                                    onPress={() =>
                                        UrlUtils.goToBlockExplorerPubkey(
                                            remotePubkey,
                                            testnet
                                        )
                                    }
                                >
                                    <Text
                                        style={{
                                            color: '#FFD93F',
                                            fontFamily: 'Lato-Regular',
                                            ...styles.pubkey
                                        }}
                                    >
                                        {PrivacyUtils.sensitiveValue(
                                            remotePubkey
                                        ).slice(0, 6) +
                                            '...' +
                                            PrivacyUtils.sensitiveValue(
                                                remotePubkey
                                            ).slice(-6)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <BalanceSlider
                            localBalance={lurkerMode ? 50 : localBalance}
                            remoteBalance={lurkerMode ? 50 : remoteBalance}
                        />
                        <Text style={styles.status}>
                            {pendingOpen
                                ? localeString('views.Channel.pendingOpen')
                                : pendingClose || closing
                                ? localeString('views.Channel.pendingClose')
                                : forceClose
                                ? localeString('views.Channel.forceClose')
                                : closeHeight
                                ? localeString('views.Channel.closed')
                                : isActive
                                ? localeString('views.Channel.active')
                                : localeString('views.Channel.inactive')}
                        </Text>
                        {chain_hash && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.chainHash'
                                )}
                                value={chain_hash}
                                sensitive
                            />
                        )}
                        {closeHeight && (
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerBlockHeight(
                                        closeHeight,
                                        testnet
                                    )
                                }
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.closeHeight'
                                    )}
                                    value={closeHeight}
                                    color={themeColor('chain')}
                                    sensitive
                                />
                            </TouchableOpacity>
                        )}
                        {closeType && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.closeType'
                                )}
                                value={closeType}
                                sensitive
                            />
                        )}
                        {open_initiator && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.openInitiator'
                                )}
                                value={open_initiator}
                                sensitive
                            />
                        )}
                        {close_initiator && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.closeInitiator'
                                )}
                                value={close_initiator}
                                sensitive
                            />
                        )}
                        {closing_txid && (
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerTXID(
                                        closing_txid,
                                        testnet
                                    )
                                }
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.closingTxId'
                                    )}
                                    value={closing_txid}
                                    sensitive
                                    color={themeColor('chain')}
                                />
                            </TouchableOpacity>
                        )}
                        {closing_tx_hash && (
                            <TouchableOpacity
                                onPress={() =>
                                    UrlUtils.goToBlockExplorerTXID(
                                        closing_tx_hash,
                                        testnet
                                    )
                                }
                            >
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Channel.closingTxHash'
                                    )}
                                    value={closing_tx_hash}
                                    sensitive
                                    color={themeColor('chain')}
                                />
                            </TouchableOpacity>
                        )}
                        {(pendingOpen || pendingClose || closing) &&
                            channel_point && (
                                <TouchableOpacity
                                    onPress={() =>
                                        UrlUtils.goToBlockExplorerTXID(
                                            channel_point,
                                            testnet
                                        )
                                    }
                                >
                                    <KeyValue
                                        keyValue={localeString(
                                            'views.Channel.channelPoint'
                                        )}
                                        value={channel_point}
                                        sensitive
                                        color={themeColor('chain')}
                                    />
                                </TouchableOpacity>
                            )}
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.channelBalance'
                            )}
                        />
                        {settled_balance && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.settledBalance'
                                )}
                                value={
                                    <Amount
                                        sats={settled_balance}
                                        sensitive
                                        toggleable
                                    />
                                }
                                sensitive
                            />
                        )}
                        {time_locked_balance && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.timeLockedBalance'
                                )}
                                value={
                                    <Amount
                                        sats={time_locked_balance}
                                        sensitive
                                        toggleable
                                    />
                                }
                                sensitive
                            />
                        )}
                        <KeyValue
                            keyValue={localeString('views.Channel.outbound')}
                            value={
                                <Amount
                                    sats={localBalance}
                                    sensitive
                                    toggleable
                                />
                            }
                        />
                        <KeyValue
                            keyValue={localeString('views.Channel.inbound')}
                            value={
                                <Amount
                                    sats={remoteBalance}
                                    sensitive
                                    toggleable
                                />
                            }
                        />
                        {unsettled_balance && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.unsettledBalance'
                                )}
                                value={
                                    <Amount
                                        sats={unsettled_balance}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        )}
                        {!!alias_scids && alias_scids.length > 0 && (
                            <KeyValue
                                keyValue={
                                    alias_scids.length > 1
                                        ? localeString(
                                              'views.Channel.aliasScids'
                                          )
                                        : localeString(
                                              'views.Channel.aliasScid'
                                          )
                                }
                                value={PrivacyUtils.sensitiveValue(
                                    alias_scids.join(', ')
                                )}
                            />
                        )}
                        {!!local_chan_reserve_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.localReserve'
                                )}
                                value={
                                    <Amount
                                        sats={local_chan_reserve_sat}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        )}
                        {!!remote_chan_reserve_sat && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.remoteReserve'
                                )}
                                value={
                                    <Amount
                                        sats={remote_chan_reserve_sat}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        )}
                        {capacity && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.capacity'
                                )}
                                value={
                                    <Amount
                                        sats={capacity}
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
                        {BackendUtils.isLNDBased() && editableFees && (
                            <FeeBreakdown
                                isActive={isActive}
                                isClosed={closeHeight || closeType}
                                channelId={channelId}
                                peerDisplay={peerDisplay}
                                channelPoint={channel_point}
                                initiator={initiator}
                                total_satoshis_received={
                                    total_satoshis_received
                                }
                                total_satoshis_sent={total_satoshis_sent}
                                commit_fee={commit_fee}
                                commit_weight={commit_weight}
                                csv_delay={csv_delay}
                                privateChannel={privateChannel}
                            />
                        )}
                        {BackendUtils.supportsBumpFee() && bumpable && (
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.BumpFee.titleAlt'
                                    )}
                                    onPress={() =>
                                        navigation.navigate('BumpFee', {
                                            outpoint: channel.channel_point,
                                            channel: true
                                        })
                                    }
                                    noUppercase
                                />
                            </View>
                        )}
                        {!closeHeight &&
                            !closing_txid &&
                            !pendingClose &&
                            !closing && (
                                <View style={styles.button}>
                                    <Button
                                        title={
                                            confirmCloseChannel
                                                ? localeString(
                                                      'views.Channel.cancelClose'
                                                  )
                                                : localeString(
                                                      'views.Channel.close'
                                                  )
                                        }
                                        onPress={() =>
                                            this.setState({
                                                confirmCloseChannel:
                                                    !confirmCloseChannel
                                            })
                                        }
                                        quaternary
                                        warning
                                    />
                                </View>
                            )}
                        {confirmCloseChannel && (
                            <React.Fragment>
                                {(BackendUtils.isLNDBased() ||
                                    !implementation) && (
                                    <React.Fragment>
                                        <Text style={styles.text}>
                                            {localeString(
                                                'views.Channel.closingRate'
                                            )}
                                        </Text>
                                        {enableMempoolRates ? (
                                            <TouchableWithoutFeedback
                                                onPress={() =>
                                                    navigation.navigate(
                                                        'EditFee',
                                                        {
                                                            onNavigateBack:
                                                                this
                                                                    .handleOnNavigateBack
                                                        }
                                                    )
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
                                                    value={forceCloseChannel}
                                                    onValueChange={() =>
                                                        this.setState({
                                                            forceCloseChannel:
                                                                !forceCloseChannel
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
                                                forceCloseChannel
                                            )
                                        }
                                        quaternary
                                        warning
                                    />
                                </View>
                            </React.Fragment>
                        )}
                    </KeyboardAvoidingView>
                </ScrollView>
            </Screen>
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
    status: {
        fontFamily: 'Lato-Regular',
        color: themeColor('text'),
        alignSelf: 'center',
        marginBottom: 10
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
