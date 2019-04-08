import * as React from 'react';
import { ActivityIndicator, StyleSheet, Text, View, TextInput } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';

import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';

interface OpenChannelProps {
    exitSetup: any;
    navigation: any;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
}

interface OpenChannelState {
    node_pubkey_string: string;
    local_funding_amount: string;
    min_confs: number;
    sat_per_byte: string;
    private: boolean;
    host: string;
}

@inject('ChannelsStore', 'SettingsStore')
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
        const { ChannelsStore, SettingsStore, navigation } = this.props;
        const { node_pubkey_string, local_funding_amount, min_confs, host, sat_per_byte } = this.state;
        const privateChannel = this.state.private;

        const { connectingToPeer, openingChannel, connectPeer, errorMsgChannel, errorMsgPeer, peerSuccess, channelSuccess } = ChannelsStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.navigate('Wallet')}
                color="#fff"
                underlayColor="transparent"
            />
        );

        return (
            <View style={theme === 'dark' ? styles.darkThemeStyle : styles.lightThemeStyle}>
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

                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Node pubkey</Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={node_pubkey_string}
                        onChangeText={(text: string) => this.setState({ node_pubkey_string: text })}
                        numberOfLines={1}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
                        editable={!openingChannel}
                    />

                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Host</Text>
                    <TextInput
                        placeholder={'Hostname:Port'}
                        value={host}
                        onChangeText={(text: string) => this.setState({ host: text })}
                        numberOfLines={1}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
                        editable={!openingChannel}
                    />

                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Local amount (in satoshis)</Text>
                    <TextInput
                        placeholder={'20000 (min)'}
                        value={local_funding_amount}
                        onChangeText={(text: string) => this.setState({ local_funding_amount: text })}
                        numberOfLines={1}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
                        editable={!openingChannel}
                    />

                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Number of Confirmations</Text>
                    <TextInput
                        placeholder={'1'}
                        value={min_confs.toString()}
                        onChangeText={(text: string) => this.setState({ min_confs: Number(text) || min_confs })}
                        numberOfLines={1}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
                        editable={!openingChannel}
                    />

                    <Text style={{ color: theme === 'dark' ? 'white' : 'black' }}>Satoshis per byte</Text>
                    <TextInput
                        placeholder={'2'}
                        value={sat_per_byte}
                        onChangeText={(text: string) => this.setState({ sat_per_byte: text })}
                        numberOfLines={1}
                        style={theme === 'dark' ? styles.textInputDark : styles.textInput}
                        placeholderTextColor='gray'
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
                            backgroundColor={theme === "dark" ? "#261339" : "rgba(92, 99,216, 1)"}
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
                            backgroundColor={theme === "dark" ? "#261339" : "rgba(92, 99,216, 1)"}
                            borderRadius={30}
                        />
                    </View>
                </View>
            </View>
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
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
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