import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TextInput } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, FormLabel, Header, Icon } from 'react-native-elements';
import ChannelsStore from './../stores/ChannelsStore';

interface OpenChannelProps {
    exitSetup: any;
    navigation: any;
    ChannelsStore: ChannelsStore;
}

interface OpenChannelState {
    node_pubkey_string: string;
    local_funding_amount: string;
    min_confs: number;
    sat_per_byte: string;
    private: boolean;
    host: string;
}

@inject('ChannelsStore')
@observer
export default class OpenChannel extends React.Component<OpenChannelProps, OpenChannelState> {
    state = {
        node_pubkey_string: '',
        local_funding_amount: '',
        min_confs: 1,
        sat_per_byte: '2',
        private: false,
        host: ''
    }

    componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const node_pubkey_string = navigation.getParam('node_pubkey_string', null);
        const host = navigation.getParam('host', null);

        this.setState({
            node_pubkey_string,
            host
        });
    }

    render() {
        const { ChannelsStore, navigation } = this.props;
        const { node_pubkey_string, local_funding_amount, min_confs, host, sat_per_byte } = this.state;
        const privateChannel = this.state.private;

        const { connectingToPeer, openingChannel, connectPeer, errorMsgChannel, errorMsgPeer, peerSuccess, channelSuccess } = ChannelsStore;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={styles.container}>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{ text: 'Open Channel', style: { color: '#fff' } }}
                    backgroundColor='grey'
                />

                <View style={styles.content}>
                    {(connectingToPeer || openingChannel) && <ActivityIndicator size="large" color="#0000ff" />}
                    {peerSuccess && <Text style={{ color: 'green' }}>Succesfully connected to peer</Text>}
                    {channelSuccess && <Text style={{ color: 'green' }}>Succesfully opened channel</Text>}
                    {(errorMsgPeer || errorMsgChannel) && <Text style={{ color: 'red' }}>{errorMsgChannel || errorMsgPeer}</Text>}

                    <FormLabel>Node pubkey</FormLabel>
                    <TextInput
                        placeholder={'0A...'}
                        value={node_pubkey_string}
                        onChangeText={(text: string) => this.setState({ node_pubkey_string: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20 }}
                        editable={!openingChannel}
                    />

                    <FormLabel>Host</FormLabel>
                    <TextInput
                        placeholder={'Hostname:Port'}
                        value={host}
                        onChangeText={(text: string) => this.setState({ host: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20 }}
                        editable={!openingChannel}
                    />

                    <FormLabel>Local amount (in satoshis)</FormLabel>
                    <TextInput
                        placeholder={'20000 (min)'}
                        value={local_funding_amount}
                        onChangeText={(text: string) => this.setState({ local_funding_amount: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20 }}
                        editable={!openingChannel}
                    />

                    <FormLabel>Number of Confirmations</FormLabel>
                    <TextInput
                        placeholder={'1'}
                        value={min_confs.toString()}
                        onChangeText={(text: string) => this.setState({ min_confs: Number(text) || min_confs })}
                        numberOfLines={1}
                        style={{ fontSize: 20, marginBottom: 10 }}
                        editable={!openingChannel}
                    />

                    <FormLabel>Satoshis per byte</FormLabel>
                    <TextInput
                        placeholder={'2'}
                        value={sat_per_byte}
                        onChangeText={(text: string) => this.setState({ sat_per_byte: text })}
                        numberOfLines={1}
                        style={{ fontSize: 20, marginBottom: 10 }}
                        editable={!openingChannel}
                    />

                    <CheckBox
                        title="Private"
                        checked={privateChannel}
                        onPress={() => this.setState({ private: !privateChannel })}
                    />

                    <View style={styles.button}>
                        <Button
                            title="Open Channel"
                            icon={{
                                name: "swap-horiz",
                                size: 25,
                                color: "white"
                            }}
                            backgroundColor="rgba(92, 99,216, 1)"
                            onPress={() => connectPeer(this.state)}
                            style={{ padding: 10 }}
                            borderRadius={30}
                        />
                    </View>
                    <View style={styles.button}>
                        <Button
                            title="Scan"
                            icon={{
                                name: "crop-free",
                                size: 25,
                                color: "white"
                            }}
                            onPress={() => navigation.navigate('NodeQRCodeScanner')}
                            backgroundColor="rgba(92, 99,216, 1)"
                            borderRadius={30}
                        />
                    </View>
                </View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    content: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 20
    },
    button: {
        paddingTop: 15,
        paddingBottom: 15
    }
});