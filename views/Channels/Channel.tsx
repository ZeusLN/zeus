import * as React from 'react';
import {
    NativeModules,
    NativeEventEmitter,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Image
} from 'react-native';

import { Divider, Icon, ListItem } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Channel from '../../models/Channel';
import ClosedChannel from '../../models/ClosedChannel';

import Amount from '../../components/Amount';
import BalanceSlider from '../../components/BalanceSlider';
import Button from '../../components/Button';
import FeeBreakdown from '../../components/FeeBreakdown';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import OnchainFeeInput from '../../components/OnchainFeeInput';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import PrivacyUtils from '../../utils/PrivacyUtils';
import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';
import { getPhoto } from '../../utils/PhotoUtils';

import ChannelsStore from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import ContactStore from '../../stores/ContactStore';

// @ts-ignore:next-line
import Edit from '../../assets/images/SVG/Edit.svg';
// @ts-ignore:next-line
import HourglassIcon from '../../assets/images/SVG/Hourglass.svg';

interface ChannelProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    ContactStore: ContactStore;
    route: Route<'Channel', { channel: Channel | ClosedChannel }>;
}

interface ChannelState {
    confirmCloseChannel: boolean;
    satPerByte: string;
    forceCloseChannel: boolean;
    deliveryAddress: string;
    channel: Channel;
}

@inject('ChannelsStore', 'NodeInfoStore', 'SettingsStore', 'ContactStore')
@observer
export default class ChannelView extends React.Component<
    ChannelProps,
    ChannelState
> {
    listener: any;
    constructor(props: ChannelProps) {
        super(props);
        const { route, ChannelsStore } = props;
        const channel = route.params?.channel;

        this.state = {
            confirmCloseChannel: false,
            satPerByte: '',
            forceCloseChannel: false,
            deliveryAddress: '',
            channel
        };

        if (BackendUtils.isLNDBased() && channel.channelId != null) {
            ChannelsStore.loadChannelInfo(channel.channelId);
        }
    }

    findContactByPubkey = (pubkey: string) => {
        const { ContactStore } = this.props;
        const { contacts } = ContactStore;
        return contacts.find((contact: any) => contact.pubkey.includes(pubkey));
    };

    renderContactLink = (remotePubkey: string) => {
        const contact = this.findContactByPubkey(remotePubkey);
        if (contact) {
            return (
                <TouchableOpacity
                    style={{
                        ...styles.container,
                        backgroundColor: themeColor('secondary')
                    }}
                    onPress={() => {
                        this.props.navigation.navigate('ContactDetails', {
                            contactId: contact.contactId || contact.id,
                            isNostrContact: false
                        });
                    }}
                >
                    {contact.photo && (
                        <Image
                            source={{ uri: getPhoto(contact.photo) }}
                            style={styles.image}
                        />
                    )}
                    <View>
                        <Text
                            style={{
                                fontSize: 18,
                                color: themeColor('highlight'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {contact.name}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
        return null;
    };

    closeChannel = async (
        channelPoint?: string,
        channelId?: string,
        satPerVbyte?: string | null,
        forceClose?: boolean | null,
        deliveryAddress?: string | null
    ) => {
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { implementation } = SettingsStore;

        let funding_txid_str, output_index;
        if (channelPoint) {
            const [fundingTxidStr, outputIndex] = channelPoint.split(':');
            funding_txid_str = fundingTxidStr;
            output_index = outputIndex;
        }

        const streamingCall = await ChannelsStore.closeChannel(
            funding_txid_str && output_index
                ? { funding_txid_str, output_index }
                : undefined,
            channelId ? channelId : undefined,
            satPerVbyte ? satPerVbyte : undefined,
            forceClose || false,
            deliveryAddress ? deliveryAddress : undefined
        );

        if (implementation === 'lightning-node-connect') {
            this.subscribeChannelClose(streamingCall);
        } else {
            if (!ChannelsStore.closeChannelErr) navigation.popTo('Wallet');
        }
    };

    handleOnNavigateBack = (satPerByte: string) => {
        this.setState({
            satPerByte
        });
    };

    subscribeChannelClose = (streamingCall: string) => {
        const { handleChannelClose, handleChannelCloseError } =
            this.props.ChannelsStore;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);
        this.listener = eventEmitter.addListener(
            streamingCall,
            (event: any) => {
                if (event.result && event.result !== 'EOF') {
                    let result;
                    try {
                        result = JSON.parse(event.result);
                    } catch (e) {
                        try {
                            result = JSON.parse(event);
                        } catch (e2) {
                            result = event.result || event;
                        }
                    }
                    if (
                        result &&
                        (result?.chan_close?.success || result?.close_pending)
                    ) {
                        handleChannelClose();
                        this.listener = null;
                        this.props.navigation.popTo('Wallet');
                    } else {
                        handleChannelCloseError(new Error(result));
                        this.listener = null;
                    }
                }
            }
        );
    };

    render() {
        const { navigation, SettingsStore, NodeInfoStore, ChannelsStore } =
            this.props;
        const {
            channel,
            confirmCloseChannel,
            satPerByte,
            forceCloseChannel,
            deliveryAddress
        } = this.state;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const lurkerMode = privacy && privacy.lurkerMode;
        const { testnet } = NodeInfoStore;
        const { closeChannelErr, closingChannel } = ChannelsStore;

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
            getOpenInitiator,
            getCloseInitiator,
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
            getCommitmentType,
            pending_htlcs
        } = channel as ClosedChannel;

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
            >
                <Edit
                    fill={themeColor('text')}
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    onBack={() => {
                        ChannelsStore.clearCloseChannelErr();
                    }}
                    rightComponent={
                        editableFees &&
                        this.props.SettingsStore.implementation !==
                            'embedded-lnd' ? (
                            <EditFees />
                        ) : (
                            <></>
                        )
                    }
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
                            {`${peerDisplay}`}
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
                                    {remotePubkey
                                        ? (() => {
                                              const maskedPubkey: string | any =
                                                  PrivacyUtils.sensitiveValue(
                                                      remotePubkey
                                                  );
                                              return (
                                                  maskedPubkey.slice(0, 6) +
                                                  '...' +
                                                  maskedPubkey.slice(-6)
                                              );
                                          })()
                                        : ''}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {remotePubkey && this.renderContactLink(remotePubkey)}
                    </View>
                    <BalanceSlider
                        localBalance={lurkerMode ? 50 : localBalance}
                        remoteBalance={lurkerMode ? 50 : remoteBalance}
                    />
                    <Text
                        style={{ ...styles.status, color: themeColor('text') }}
                    >
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
                    {!(closeHeight || closeType) && (
                        <KeyValue
                            keyValue={localeString('views.Channel.unannounced')}
                            value={
                                privateChannel
                                    ? localeString('general.true')
                                    : localeString('general.false')
                            }
                            color={privateChannel ? 'green' : '#808000'}
                        />
                    )}
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
                            color={themeColor('highlight')}
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
                    {getOpenInitiator && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.openInitiator'
                            )}
                            value={getOpenInitiator}
                            sensitive
                        />
                    )}
                    {getCloseInitiator && (
                        <KeyValue
                            keyValue={localeString(
                                'views.Channel.closeInitiator'
                            )}
                            value={getCloseInitiator}
                            sensitive
                        />
                    )}
                    {closing_txid && (
                        <KeyValue
                            keyValue={localeString('views.Channel.closingTxId')}
                            value={closing_txid}
                            sensitive
                            color={themeColor('highlight')}
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
                            color={themeColor('highlight')}
                            mempoolLink={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    closing_tx_hash,
                                    testnet
                                )
                            }
                        />
                    )}
                    {(pendingOpen ||
                        pendingClose ||
                        closing ||
                        !BackendUtils.isLNDBased()) &&
                        channel_point && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Channel.channelPoint'
                                )}
                                value={channel_point}
                                sensitive
                                color={themeColor('highlight')}
                                mempoolLink={() =>
                                    UrlUtils.goToBlockExplorerTXID(
                                        channel_point,
                                        testnet
                                    )
                                }
                            />
                        )}
                    {!!pending_htlcs && pending_htlcs.length > 0 && (
                        <ListItem
                            containerStyle={{
                                backgroundColor: 'transparent',
                                marginLeft: -13,
                                marginRight: -20
                            }}
                            onPress={() =>
                                navigation.navigate('PendingHTLCs', {
                                    pending_htlcs
                                })
                            }
                        >
                            <ListItem.Content>
                                <ListItem.Title
                                    style={{
                                        color: themeColor('highlight'),
                                        fontFamily: 'PPNeueMontreal-Book'
                                    }}
                                >
                                    <View style={{ flexDirection: 'row' }}>
                                        <HourglassIcon
                                            fill={themeColor('highlight')}
                                            width={17}
                                            height={17}
                                            style={{ marginRight: 5 }}
                                        />
                                    </View>
                                    {`${localeString(
                                        'views.PendingHTLCs.title'
                                    )} (${pending_htlcs.length})`}
                                </ListItem.Title>
                            </ListItem.Content>
                            <Icon
                                name="keyboard-arrow-right"
                                color={themeColor('secondaryText')}
                            />
                        </ListItem>
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
                        keyValue={localeString('views.Channel.Total.outbound')}
                        value={
                            <Amount sats={localBalance} sensitive toggleable />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.Total.inbound')}
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
                            infoText={localeString(
                                'views.Channel.localReserve.info'
                            )}
                            infoLink="https://bitcoin.design/guide/how-it-works/liquidity/#what-is-a-channel-reserve"
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
                            infoText={localeString(
                                'views.Channel.remoteReserve.info'
                            )}
                            infoLink="https://bitcoin.design/guide/how-it-works/liquidity/#what-is-a-channel-reserve"
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
                            isClosed={!!closeHeight || !!closeType}
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
                                    marginTop: 20,
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
                                    warning={!confirmCloseChannel}
                                />
                            </View>
                        )}
                    {confirmCloseChannel && (
                        <View>
                            {closingChannel && (
                                <View style={{ margin: 20, marginBottom: 40 }}>
                                    <LoadingIndicator />
                                </View>
                            )}
                            {!closingChannel && closeChannelErr && (
                                <ErrorMessage message={closeChannelErr} />
                            )}
                            {BackendUtils.isLNDBased() && (
                                <>
                                    <View style={{ marginBottom: 10 }}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
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
                                    </View>
                                    {!forceCloseChannel && (
                                        <>
                                            <Text
                                                style={{
                                                    ...styles.text,
                                                    color: themeColor('text')
                                                }}
                                            >
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
                                                navigation={navigation}
                                            />
                                        </>
                                    )}
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                            infoText={localeString(
                                                'views.Channel.externalAddress.info'
                                            )}
                                        >
                                            {localeString(
                                                'views.Channel.externalAddress'
                                            )}
                                        </Text>
                                        <TextInput
                                            placeholder={'bc1...'}
                                            value={deliveryAddress}
                                            onChangeText={(text: string) =>
                                                this.setState({
                                                    deliveryAddress: text
                                                })
                                            }
                                            locked={closingChannel}
                                        />
                                    </>
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
                                            forceCloseChannel,
                                            deliveryAddress
                                        )
                                    }
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
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        marginLeft: 20,
        marginRight: 20
    },
    center: {
        alignItems: 'center'
    },
    status: {
        fontFamily: 'PPNeueMontreal-Book',
        alignSelf: 'center',
        marginBottom: 10
    },
    alias: {
        fontSize: 28,
        paddingTop: 14,
        paddingBottom: 10
    },
    pubkey: {
        paddingBottom: 24,
        textAlign: 'center'
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    },
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    image: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 14
    }
});
