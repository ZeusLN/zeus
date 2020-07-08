import * as React from 'react';
import {
    ActivityIndicator,
    Clipboard,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TextInput
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import FeeTable from './../components/FeeTable';
import NodeUriUtils from './../utils/NodeUriUtils';

import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';
import FeeStore from './../stores/FeeStore';

interface OpenChannelProps {
    exitSetup: any;
    navigation: any;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
}

interface OpenChannelState {
    node_pubkey_string: string;
    local_funding_amount: string;
    min_confs: number;
    sat_per_byte: string;
    private: boolean;
    host: string;
    suggestImport: string;
}

@inject('ChannelsStore', 'SettingsStore', 'FeeStore')
@observer
export default class OpenChannel extends React.Component<
    OpenChannelProps,
    OpenChannelState
> {
    constructor(props: any) {
        super(props);
        const { navigation } = props;
        const node_pubkey_string = navigation.getParam(
            'node_pubkey_string',
            null
        );
        const host = navigation.getParam('host', null);

        this.state = {
            node_pubkey_string: node_pubkey_string || '',
            local_funding_amount: '',
            min_confs: 1,
            sat_per_byte: '2',
            private: false,
            host: host || '',
            suggestImport: ''
        };
    }

    async UNSAFE_componentWillMount() {
        const clipboard = await Clipboard.getString();

        if (NodeUriUtils.isValidNodeUri(clipboard)) {
            this.setState({
                suggestImport: clipboard
            });
        }
    }

    importClipboard = () => {
        const { pubkey, host } = NodeUriUtils.processNodeUri(
            this.state.suggestImport
        );

        this.setState({
            node_pubkey_string: pubkey,
            host,
            suggestImport: ''
        });

        Clipboard.setString('');
    };

    clearImportSuggestion = () => {
        this.setState({
            suggestImport: ''
        });
    };

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        const { navigation } = nextProps;
        const node_pubkey_string = navigation.getParam(
            'node_pubkey_string',
            null
        );
        const host = navigation.getParam('host', null);

        this.setState({
            node_pubkey_string,
            host
        });
    }

    setFee = (text: string) => {
        this.setState({ sat_per_byte: text });
    };

    render() {
        const {
            ChannelsStore,
            SettingsStore,
            FeeStore,
            navigation
        } = this.props;
        const {
            node_pubkey_string,
            local_funding_amount,
            min_confs,
            host,
            sat_per_byte,
            suggestImport
        } = this.state;
        const privateChannel = this.state.private;

        const {
            connectingToPeer,
            openingChannel,
            connectPeer,
            errorMsgChannel,
            errorMsgPeer,
            peerSuccess,
            channelSuccess
        } = ChannelsStore;
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
                        text: 'Open Channel',
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
                />

                {!!suggestImport && (
                    <View style={styles.clipboardImport}>
                        <Text style={{ color: 'white' }}>
                            Detected the following Node URI in your clipboard:
                        </Text>
                        <Text style={{ color: 'white', padding: 15 }}>
                            {suggestImport}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            Would you like to import it?
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title="Import"
                                onPress={() => this.importClipboard()}
                                titleStyle={{
                                    color: 'rgba(92, 99,216, 1)'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title="Cancel"
                                onPress={() => this.clearImportSuggestion()}
                                titleStyle={{
                                    color: 'rgba(92, 99,216, 1)'
                                }}
                                buttonStyle={{
                                    backgroundColor: 'white',
                                    borderRadius: 30
                                }}
                            />
                        </View>
                    </View>
                )}

                <View style={styles.content}>
                    {(connectingToPeer || openingChannel) && (
                        <ActivityIndicator size="large" color="#0000ff" />
                    )}
                    {peerSuccess && (
                        <Text style={{ color: 'green' }}>
                            Succesfully connected to peer
                        </Text>
                    )}
                    {channelSuccess && (
                        <Text style={{ color: 'green' }}>
                            Succesfully opened channel
                        </Text>
                    )}
                    {(errorMsgPeer || errorMsgChannel) && (
                        <Text style={{ color: 'red' }}>
                            {errorMsgChannel || errorMsgPeer || 'Error'}
                        </Text>
                    )}

                    <Text
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Node pubkey
                    </Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={node_pubkey_string}
                        onChangeText={(text: string) =>
                            this.setState({ node_pubkey_string: text })
                        }
                        numberOfLines={1}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Host
                    </Text>
                    <TextInput
                        placeholder={'Hostname:Port'}
                        value={host}
                        onChangeText={(text: string) =>
                            this.setState({ host: text })
                        }
                        numberOfLines={1}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Local amount (in satoshis)
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'20000 (min)'}
                        value={local_funding_amount}
                        onChangeText={(text: string) =>
                            this.setState({ local_funding_amount: text })
                        }
                        numberOfLines={1}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Number of Confirmations
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={'1'}
                        value={min_confs.toString()}
                        onChangeText={(text: string) =>
                            this.setState({
                                min_confs: Number(text) || min_confs
                            })
                        }
                        numberOfLines={1}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{ color: theme === 'dark' ? 'white' : 'black' }}
                    >
                        Satoshis per byte
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder="2"
                        value={sat_per_byte}
                        onChangeText={(text: string) => this.setFee(text)}
                        numberOfLines={1}
                        style={
                            theme === 'dark'
                                ? styles.textInputDark
                                : styles.textInput
                        }
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <View style={{ padding: 10 }}>
                        <CheckBox
                            title="Private"
                            checked={privateChannel}
                            onPress={() =>
                                this.setState({ private: !privateChannel })
                            }
                        />
                    </View>

                    <View style={styles.button}>
                        <Button
                            title="Open Channel"
                            icon={{
                                name: 'swap-horiz',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => connectPeer(this.state)}
                            buttonStyle={{
                                backgroundColor:
                                    theme === 'dark'
                                        ? '#261339'
                                        : 'rgba(92, 99,216, 1)',
                                borderRadius: 30
                            }}
                        />
                    </View>
                    <View style={styles.button}>
                        <Button
                            title="Scan"
                            icon={{
                                name: 'crop-free',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('NodeQRCodeScanner')
                            }
                            buttonStyle={{
                                backgroundColor:
                                    theme === 'dark'
                                        ? '#261339'
                                        : 'rgba(92, 99,216, 1)',
                                borderRadius: 30
                            }}
                        />
                    </View>
                    <View style={styles.button}>
                        <FeeTable setFee={this.setFee} />
                    </View>
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
    textInput: {
        fontSize: 20,
        color: 'black'
    },
    textInputDark: {
        fontSize: 20,
        color: 'white'
    },
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 5,
        paddingRight: 5
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10,
        width: 250,
        alignSelf: 'center'
    },
    clipboardImport: {
        padding: 10,
        backgroundColor: 'rgba(92, 99,216, 1)',
        color: 'white'
    }
});
