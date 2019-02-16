import * as React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import Channel from './../models/Channel';
import Identicon from 'identicon.js';
import { inject, observer } from 'mobx-react';
const hash = require('object-hash');

import UnitsStore from './../stores/UnitsStore';

interface ChannelProps {
    navigation: any;
    UnitsStore: UnitsStore;
}

@inject('UnitsStore')
@observer
export default class ChannelView extends React.Component<ChannelProps> {
    render() {
        const { navigation, UnitsStore } = this.props;
        const { changeUnits, getAmount, units } = UnitsStore;
        const channel: Channel = navigation.getParam('channel', null);
        const {
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
            <ScrollView style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Channel', style: { color: '#fff' } }}
                    backgroundColor='#000'
                />
                <View style={styles.content}>
                    <View style={styles.center}>
                        <Text style={{ paddingTop: 10, paddingBottom: 30 }}>{remote_pubkey}</Text>
                        <Image source={{ uri: `data:image/png;base64,${data}` }} style={{ width: 200, height: 200 }} />

                        <View style={styles.balances}>
                            <TouchableOpacity onPress={() => changeUnits()}>
                                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{`Local balance: ${units && getAmount(local_balance || 0)}`}</Text>
                                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{`Remote balance: ${units && getAmount(remote_balance || 0)}`}</Text>
                                {unsettled_balance && <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{`Unsettled balance: ${units && getAmount(unsettled_balance)}`}</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <Text style={styles.label}>Status:</Text>
                    <Text style={{ ...styles.value, color: active ? 'green' : 'red' }}>{active ? 'Active' : 'Inactive'}</Text>

                    <Text style={styles.label}>Private:</Text>
                    <Text style={{ ...styles.value, color: privateChannel ? 'green' : '#808000' }}>{privateChannel ? 'True' : 'False'}</Text>

                    <Text style={styles.label}>Total Received:</Text>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={styles.value}>{units && getAmount(total_satoshis_received || 0)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Total Sent:</Text>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={styles.value}>{units && getAmount(total_satoshis_sent || 0)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Capacity:</Text>
                    <TouchableOpacity onPress={() => changeUnits()}>
                        <Text style={styles.value}>{units && getAmount(capacity)}</Text>
                    </TouchableOpacity>

                    <Text style={styles.label}>Commit Weight:</Text>
                    <Text style={styles.value}>{commit_weight}</Text>

                    <Text style={styles.label}>Commit Fee:</Text>
                    <Text style={styles.value}>{commit_fee}</Text>

                    <Text style={styles.label}>CSV Delay:</Text>
                    <Text style={styles.value}>{csv_delay}</Text>

                    <Text style={styles.label}>Fee per kilo-weight:</Text>
                    <Text style={styles.value}>{fee_per_kw}</Text>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center'
    },
    balances: {
        paddingTop: 20,
        paddingBottom: 20
    },
    label: {
        paddingTop: 5
    },
    value: {
        paddingBottom: 5
    },
    valueWithLink: {
        paddingBottom: 5,
        color: 'rgba(92, 99,216, 1)'
    }
});