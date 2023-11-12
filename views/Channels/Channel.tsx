import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
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
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Amount from '../../components/Amount';
import FeeBreakdown from '../../components/FeeBreakdown';
import Screen from '../../components/Screen';

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
    constructor(props: ChannelProps) {
        super(props);
        const { navigation, ChannelsStore } = props;
        const channel: Channel = navigation.getParam('channel', null);

        this.state = {
            confirmCloseChannel: false,
            satPerByte: '',
            forceCloseChannel: false,
            channel
        };

        if (BackendUtils.isLNDBased() && channel.channelId != null) {
            ChannelsStore.loadChannelInfo(channel.channelId);
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
            closing,
            zero_conf,
            getCommitmentType
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
            <TouchableOpacity
                onPress={() => navigation.navigate('SetFees', { channel })}
                style={{ top: -5 }}
            >
                <Edit fill={themeColor('text')} height={38} width={38} />
            </TouchableOpacity>
        );

        const KeySend = () => (
            <TouchableOpacity
                onPress={() =>
                    navigation.navigate('Send', {
                        destination: remotePubkey,
                        transactionType: 'Keysend',
                        isValid: true
                    })
                }
            >
                <Share fill={themeColor('text')} height={30} width={30} />
            </TouchableOpacity>
        );

        const centerComponent = () => {
            if (
                editableFees &&
                this.props.SettingsStore.implementation !== 'embedded-lnd'
            ) {
                return <EditFees />;
            }
            return null;
        };

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
                    <View style={styles.center}>
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
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
                                        color: themeColor('highlight'),
                                        fontFamily: 'PPNeueMontreal-Book',
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
                    {zero_conf && (
                        <KeyValue
                            keyValue={localeString('views.Channel.zeroConf')}
                            value={localeString('general.true')}
                        />
                    )}
                    <KeyValue
                        keyValue={localeString('views.Channel.unannounced')}
                        value={
                            privateChannel
                                ? localeString('general.true')
                                : localeString('general.false')
                        }
                        color={privateChannel ? 'green' : '#808000'}
                    />
                    {getCommitmentType && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.commitmentType'
                            )}
                            value={getCommitmentType}
                        />
                    )}
                    {chain_hash && (
                        <KeyValue
                            keyValue={localeString('views.Channel.chainHash')}
                            value={chain_hash}
                            sensitive
                        />
                    )}
                    {!!closeHeight && (
                        <KeyValue
                            keyValue={localeString('views.Channel.closeHeight')}
                            value={closeHeight}
                            color={themeColor('chain')}
                            sensitive
                            mempoolLink={() =>
                                UrlUtils.goToBlockExplorerBlockHeight(
                                    closeHeight,
                                    testnet
                                )
                            }
                        />
                    )}
                    {closeType && (
                        <KeyValue
                            keyValue={localeString('views.Channel.closeType')}
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
                        <KeyValue
                            keyValue={localeString('views.Channel.closingTxId')}
                            value={closing_txid}
                            sensitive
                            color={themeColor('chain')}
                            mempoolLink={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    closing_txid,
                                    testnet
                                )
                            }
                        />
                    )}
                    {closing_tx_hash && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.closingTxHash'
                            )}
                            value={closing_tx_hash}
                            sensitive
                            color={themeColor('chain')}
                            mempoolLink={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    closing_tx_hash,
                                    testnet
                                )
                            }
                        />
                    )}
                    {(pendingOpen || pendingClose || closing) &&
                        channel_point && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.channelPoint'
                                )}
                                value={channel_point}
                                sensitive
                                color={themeColor('chain')}
                                mempoolLink={() =>
                                    UrlUtils.goToBlockExplorerTXID(
                                        channel_point,
                                        testnet
                                    )
                                }
                            />
                        )}
                    <KeyValue
                        keyValue={localeString('views.Channel.channelBalance')}
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
                            <Amount sats={localBalance} sensitive toggleable />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.inbound')}
                        value={
                            <Amount sats={remoteBalance} sensitive toggleable />
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
                                    ? localeString('views.Channel.aliasScids')
                                    : localeString('views.Channel.aliasScid')
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
                            keyValue={localeString('views.Channel.capacity')}
                            value={
                                <Amount sats={capacity} sensitive toggleable />
                            }
                        />
                    )}
                    <Divider orientation="horizontal" style={{ margin: 20 }} />
                    {BackendUtils.isLNDBased() && editableFees && (
                        <FeeBreakdown
                            isActive={isActive}
                            isClosed={closeHeight || closeType}
                            channelId={channelId}
                            peerDisplay={peerDisplay}
                            channelPoint={channel_point}
                            initiator={initiator}
                            total_satoshis_received={total_satoshis_received}
                            total_satoshis_sent={total_satoshis_sent}
                            commit_fee={commit_fee}
                            commit_weight={commit_weight}
                            csv_delay={csv_delay}
                        />
                    )}
                    {BackendUtils.supportsBumpFee() && bumpable && (
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.BumpFee.titleAlt')}
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
                            <View
                                style={{
                                    ...styles.button,
                                    marginBottom: confirmCloseChannel ? 0 : 50
                                }}
                            >
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
                                    quinary
                                    warning={!confirmCloseChannel}
                                />
                            </View>
                        )}
                    {confirmCloseChannel && (
                        <View>
                            {(BackendUtils.isLNDBased() || !implementation) && (
                                <>
                                    <Text style={styles.text}>
                                        {localeString(
                                            'views.Channel.closingRate'
                                        )}
                                    </Text>
                                    <OnchainFeeInput
                                        fee={satPerByte}
                                        onChangeFee={(text: string) => {
                                            this.setState({
                                                satPerByte: text
                                            });
                                        }}
                                    />
                                </>
                            )}
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.Channel.confirmClose'
                                    )}
                                    onPress={() =>
                                        this.closeChannel(
                                            channel_point,
                                            channelId,
                                            satPerByte,
                                            forceCloseChannel
                                        )
                                    }
                                    quinary
                                    warning
                                />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        color: themeColor('text'),
        fontFamily: 'PPNeueMontreal-Book'
    },
    secondaryText: {
        color: themeColor('secondaryText'),
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center'
    },
    status: {
        fontFamily: 'PPNeueMontreal-Book',
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
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 15,
        marginTop: 15,
        flexDirection: 'row',
        borderRadius: 4,
        borderColor: themeColor('secondaryText'),
        borderWidth: 3
    }
});
