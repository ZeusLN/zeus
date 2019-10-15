import * as React from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Button, Header, Icon } from 'react-native-elements';
import Channel from './../models/Channel';
import BalanceSlider from './../components/BalanceSlider';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');

import ChannelsStore from './../stores/ChannelsStore';
import UnitsStore from './../stores/UnitsStore';
import SettingsStore from './../stores/SettingsStore';

interface ChannelProps {
    navigation: any;
    ChannelsStore: ChannelsStore;
    UnitsStore: UnitsStore;
    SettingsStore: SettingsStore;
}

@inject('ChannelsStore', 'UnitsStore', 'SettingsStore')
@observer
export default class ChannelView extends React.Component<ChannelProps> {
    closeChannel = (channelPoint: string) => {
        const { ChannelsStore, navigation } = this.props;
        const funding_txid_str = channelPoint.split(':')[0];
        const output_index = channelPoint.split(':')[1];

        ChannelsStore.closeChannel({ funding_txid_str, output_index });
        navigation.navigate('Wallet');
    };

    render() {
        const {
            navigation,
            ChannelsStore,
            UnitsStore,
            SettingsStore
        } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const { nodes } = ChannelsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const channel: Channel = navigation.getParam('channel', null);
        const {
            channel_point,
            commit_weight,
            local_balance,
            commit_fee,
            csv_delay,
            fee_per_kw,
            total_satoshis_received,
            active,
            remote_balance,
            unsettled_balance,
            total_satoshis_sent,
            remote_pubkey,
            capacity
        } = channel;
        const privateChannel = channel.private;
        const data = new Identicon(hash.sha1(remote_pubkey), 420).toString();

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
                            {nodes[remote_pubkey] && nodes[remote_pubkey].alias}
                        </Text>
                        <Text
                            style={
                                theme === 'dark'
                                    ? styles.pubkeyDark
                                    : styles.pubkey
                            }
                        >
                            {remote_pubkey}
                        </Text>

                        <Image
                            source={{ uri: `data:image/png;base64,${data}` }}
                            style={{ width: 200, height: 200 }}
                        />
                    </View>

                    <BalanceSlider
                        localBalance={local_balance}
                        remoteBalance={remote_balance}
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
                                getAmount(local_balance || 0)}`}</Text>
                            <Text
                                style={
                                    theme === 'dark'
                                        ? styles.balanceDark
                                        : styles.balance
                                }
                            >{`Remote balance: ${units &&
                                getAmount(remote_balance || 0)}`}</Text>
                            {unsettled_balance && (
                                <Text
                                    style={
                                        theme === 'dark'
                                            ? styles.balanceDark
                                            : styles.balance
                                    }
                                >{`Unsettled balance: ${units &&
                                    getAmount(unsettled_balance)}`}</Text>
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
                            color: active ? 'green' : 'red'
                        }}
                    >
                        {active ? 'Active' : 'Inactive'}
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

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
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
                            {units && getAmount(total_satoshis_received || 0)}
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
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
                            {units && getAmount(total_satoshis_sent || 0)}
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
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
                            {units && getAmount(capacity)}
                        </Text>
                    </TouchableOpacity>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Commit Weight:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {commit_weight}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Commit Fee:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {commit_fee}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        CSV Delay:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {csv_delay}
                    </Text>

                    <Text
                        style={
                            theme === 'dark' ? styles.labelDark : styles.label
                        }
                    >
                        Fee per kilo-weight:
                    </Text>
                    <Text
                        style={
                            theme === 'dark' ? styles.valueDark : styles.value
                        }
                    >
                        {fee_per_kw}
                    </Text>

                    <View style={styles.button}>
                        <Button
                            title="Close Channel"
                            icon={{
                                name: 'delete',
                                size: 25,
                                color: '#fff'
                            }}
                            onPress={() => this.closeChannel(channel_point)}
                            buttonStyle={{
                                backgroundColor: 'red',
                                borderRadius: 30
                            }}
                        />
                    </View>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    lightThemeStyle: {
        flex: 1
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
    }
});
