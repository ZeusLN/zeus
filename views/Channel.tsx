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
import Channel from './../models/Channel';
import BalanceSlider from './../components/BalanceSlider';
import SetFeesForm from './../components/SetFeesForm';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');
import PrivacyUtils from './../utils/PrivacyUtils';

import ChannelsStore from './../stores/ChannelsStore';
import FeeStore from './../stores/FeeStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

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
}

@inject('ChannelsStore', 'UnitsStore', 'FeeStore', 'SettingsStore')
@observer
export default class ChannelView extends React.Component<
    ChannelProps,
    ChannelState
> {
    state = {
        confirmCloseChannel: false,
        satPerByte: '',
        forceClose: false
    };

    closeChannel = (
        channelPoint: string,
        channelId: string,
        satPerByte?: string,
        forceClose: boolean
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
            // c-lightning
            ChannelsStore.closeChannel(null, channelId);
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
        const { confirmCloseChannel, satPerByte, forceClose } = this.state;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { channelFees } = FeeStore;
        const { nodes } = ChannelsStore;
        const { settings, implementation } = SettingsStore;
        const { theme, lurkerMode } = settings;

        const channel: Channel = navigation.getParam('channel', null);
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

        const channelDisplay = lurkerMode
            ? PrivacyUtils.hideValue(channelName, 8)
            : channelName;

        const data = new Identicon(
            hash.sha1(alias || remote_pubkey || channelId),
            255
        ).toString();

        const channelFee = channelFees[channel_point];

        const channelBalanceLocal = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(localBalance || 0), 8, true)
            : getAmount(localBalance || 0);
        const channelBalanceRemote = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(remoteBalance || 0), 8, true)
            : getAmount(remoteBalance || 0);

        const unsettledBalance = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(unsettled_balance), 8, true)
            : getAmount(unsettled_balance);

        const totalSatoshisReceived = lurkerMode
            ? PrivacyUtils.hideValue(
                  getAmount(total_satoshis_received || 0),
                  8,
                  true
              )
            : getAmount(total_satoshis_received || 0);
        const totalSatoshisSent = lurkerMode
            ? PrivacyUtils.hideValue(
                  getAmount(total_satoshis_sent || 0),
                  8,
                  true
              )
            : getAmount(total_satoshis_sent || 0);

        const capacityDisplay = lurkerMode
            ? PrivacyUtils.hideValue(getAmount(capacity), 5, true)
            : getAmount(capacity);

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
                style={
                    theme === 'dark'
                        ? styles.darkThemeStyle
                        : styles.lightThemeStyle
                }
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: 'Channel',
                        style: { color: '#fff' }
                    }}
                    backgroundColor={theme === 'dark' ? '#261339' : 'black'}
                />
                <View style={styles.content}>
                    <View style={styles.center}>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.aliasDark
                                    : styles.alias
                            }
                        >
                            {channelDisplay}
                        </Text>
                        {remote_pubkey && (
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.pubkeyDark
                                        : styles.pubkey
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(remote_pubkey)
                                    : remote_pubkey}
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
                        theme={theme}
                    />

                    <View style={styles.balances}>
                        <TouchableOpacity onPress={() => changeUnits()}>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.balanceDark
                                        : styles.balance
                                }
                            >{`Local balance: ${units &&
                                channelBalanceLocal}`}</Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.balanceDark
                                        : styles.balance
                                }
                            >{`Remote balance: ${units &&
                                channelBalanceRemote}`}</Text>
                            {unsettled_balance && (
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.balanceDark
                                            : styles.balance
                                    }
                                >{`Unsettled balance: ${units &&
                                    unsettledBalance}`}</Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Status:
                    </Text>
                    <Text
                        style={{
                            ...styles.value,
                            color: isActive ? 'green' : 'red'
                        }}
                    >
                        {isActive ? 'Active' : 'Inactive'}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Private:
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
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Total Received:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.valueDark
                                            : styles.value
                                    }
                                >
                                    {units && totalSatoshisReceived}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {total_satoshis_sent && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Total Sent:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.valueDark
                                            : styles.value
                                    }
                                >
                                    {units && totalSatoshisSent}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {capacity && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Capacity:
                            </Text>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.valueDark
                                            : styles.value
                                    }
                                >
                                    {units && capacityDisplay}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {channelFee && channelFee.base_fee_msat && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Base Fee:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          channelFee.base_fee_msat,
                                          5,
                                          true
                                      )
                                    : channelFee.base_fee_msat}
                            </Text>
                        </View>
                    )}

                    {channelFee && channelFee.fee_rate && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Fee Rate:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          channelFee.fee_rate * 1000000,
                                          2,
                                          true
                                      )
                                    : channelFee.fee_rate * 1000000}
                            </Text>
                        </View>
                    )}

                    {commit_weight && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Commit Weight:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {commit_weight}
                            </Text>
                        </View>
                    )}

                    {commit_fee && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Commit Fee:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          commit_fee,
                                          4,
                                          true
                                      )
                                    : commit_fee}
                            </Text>
                        </View>
                    )}

                    {csv_delay && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                CSV Delay:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {csv_delay}
                            </Text>
                        </View>
                    )}

                    {fee_per_kw && (
                        <View>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.labelDark
                                        : styles.label
                                }
                            >
                                Fee per kilo-weight:
                            </Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.valueDark
                                        : styles.value
                                }
                            >
                                {lurkerMode
                                    ? PrivacyUtils.hideValue(
                                          fee_per_kw,
                                          6,
                                          true
                                      )
                                    : fee_per_kw}
                            </Text>
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
                        SettingsStore={SettingsStore}
                    />

                    <View style={styles.button}>
                        <Button
                            title={
                                confirmCloseChannel
                                    ? 'Cancel Channel Close'
                                    : 'Close Channel'
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
                                            color:
                                                theme === 'dark'
                                                    ? 'white'
                                                    : 'black'
                                        }}
                                    >
                                        (Optional) Sat per byte closing fee
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
                                        style={
                                            theme === 'dark'
                                                ? styles.textInputDark
                                                : styles.textInput
                                        }
                                    />
                                    {implementation === 'lnd' && (
                                        <CheckBox
                                            title="Force close"
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
                                    title="Confirm Channel Close"
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
    lightThemeStyle: {
        flex: 1,
        backgroundColor: 'white'
    },
    darkThemeStyle: {
        flex: 1,
        backgroundColor: 'black',
        color: 'white'
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
    aliasDark: {
        fontSize: 20,
        paddingTop: 10,
        paddingBottom: 10,
        color: 'white'
    },
    pubkey: {
        paddingTop: 10,
        paddingBottom: 30
    },
    pubkeyDark: {
        paddingTop: 10,
        paddingBottom: 30,
        color: 'white'
    },
    balance: {
        fontSize: 15,
        alignItems: 'center',
        fontWeight: 'bold'
    },
    balanceDark: {
        fontSize: 15,
        fontWeight: 'bold',
        color: 'white'
    },
    balances: {
        paddingBottom: 10,
        alignItems: 'center'
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    },
    labelDark: {
        paddingTop: 5,
        color: 'white'
    },
    valueDark: {
        paddingBottom: 5,
        color: 'white'
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
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    }
});
