import * as React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableWithoutFeedback
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import { inject, observer } from 'mobx-react';
import { Button, CheckBox, Header, Icon } from 'react-native-elements';
import FeeTable from './../components/FeeTable';
import UTXOPicker from './../components/UTXOPicker';

import NodeUriUtils from './../utils/NodeUriUtils';
import RESTUtils from './../utils/RESTUtils';
import { localeString } from './../utils/LocaleUtils';
import { themeColor } from './../utils/ThemeUtils';

import ChannelsStore from './../stores/ChannelsStore';
import SettingsStore from './../stores/SettingsStore';
import FeeStore from './../stores/FeeStore';
import BalanceStore from './../stores/BalanceStore';
import UTXOsStore from './../stores/UTXOsStore';

interface OpenChannelProps {
    exitSetup: any;
    navigation: any;
    ChannelsStore: ChannelsStore;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
    UTXOsStore: UTXOsStore;
}

interface OpenChannelState {
    node_pubkey_string: string;
    local_funding_amount: string;
    min_confs: number;
    sat_per_byte: string;
    private: boolean;
    host: string;
    suggestImport: string;
    utxos: Array<string>;
    utxoBalance: number;
}

@inject(
    'ChannelsStore',
    'SettingsStore',
    'FeeStore',
    'BalanceStore',
    'UTXOsStore'
)
@observer
export default class OpenChannel extends React.Component<
    OpenChannelProps,
    OpenChannelState
> {
    constructor(props: any) {
        super(props);
        const { navigation, SettingsStore } = props;
        const { implementation } = SettingsStore;
        const node_pubkey_string = navigation.getParam(
            'node_pubkey_string',
            null
        );
        const host = navigation.getParam('host', null);
        const sat_per_byte =
            implementation === 'c-lightning-REST' ? 'normal' : '2';

        this.state = {
            node_pubkey_string: node_pubkey_string || '',
            local_funding_amount: '',
            min_confs: 1,
            sat_per_byte,
            private: false,
            host: host || '',
            suggestImport: '',
            utxos: [],
            utxoBalance: 0
        };
    }

    async UNSAFE_componentWillMount() {
        const { SettingsStore } = this.props;
        const { settings } = SettingsStore;

        if (settings.privacy && settings.privacy.clipboard) {
            const clipboard = await Clipboard.getString();

            if (NodeUriUtils.isValidNodeUri(clipboard)) {
                this.setState({
                    suggestImport: clipboard
                });
            }
        }
    }

    selectUTXOs = (utxos: Array<string>, utxoBalance: number) => {
        const { SettingsStore } = this.props;
        const { implementation } = SettingsStore;
        const newState: any = {};
        newState.utxos = utxos;
        newState.utxoBalance = utxoBalance;
        if (implementation === 'c-lightning-REST') {
            newState.local_funding_amount = 'all';
        }
        this.setState(newState);
    };

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

    handleOnNavigateBack = (sat_per_byte: string) => {
        this.setState({
            sat_per_byte
        });
    };

    render() {
        const {
            ChannelsStore,
            BalanceStore,
            FeeStore,
            UTXOsStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            node_pubkey_string,
            local_funding_amount,
            min_confs,
            host,
            sat_per_byte,
            suggestImport,
            utxoBalance
        } = this.state;
        const { implementation } = SettingsStore;
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
        const { confirmedBlockchainBalance } = BalanceStore;

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
                style={{
                    flex: 1,
                    backgroundColor: themeColor('background')
                }}
            >
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.OpenChannel.openChannel'),
                        style: { color: '#fff' }
                    }}
                    backgroundColor="grey"
                />

                {!!suggestImport && (
                    <View style={styles.clipboardImport}>
                        <Text style={{ color: 'white' }}>
                            {localeString('views.OpenChannel.importText')}
                        </Text>
                        <Text style={{ color: 'white', padding: 15 }}>
                            {suggestImport}
                        </Text>
                        <Text style={{ color: 'white' }}>
                            {localeString('views.OpenChannel.importPrompt')}
                        </Text>
                        <View style={styles.button}>
                            <Button
                                title={localeString('views.OpenChannel.import')}
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
                            {localeString('views.OpenChannel.peerSuccess')}
                        </Text>
                    )}
                    {channelSuccess && (
                        <Text style={{ color: 'green' }}>
                            {localeString('views.OpenChannel.channelSuccess')}
                        </Text>
                    )}
                    {(errorMsgPeer || errorMsgChannel) && (
                        <Text style={{ color: 'red' }}>
                            {errorMsgChannel ||
                                errorMsgPeer ||
                                localeString('general.error')}
                        </Text>
                    )}

                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.OpenChannel.nodePubkey')}
                    </Text>
                    <TextInput
                        placeholder={'0A...'}
                        value={node_pubkey_string}
                        onChangeText={(text: string) =>
                            this.setState({ node_pubkey_string: text })
                        }
                        numberOfLines={1}
                        style={{ fontSize: 20, color: themeColor('text') }}
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.OpenChannel.host')}
                    </Text>
                    <TextInput
                        placeholder={localeString('views.OpenChannel.hostPort')}
                        value={host}
                        onChangeText={(text: string) =>
                            this.setState({ host: text })
                        }
                        numberOfLines={1}
                        style={{ fontSize: 20, color: themeColor('text') }}
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.OpenChannel.localAmt')}
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder={localeString(
                            'views.OpenChannel.amtExample'
                        )}
                        value={local_funding_amount}
                        onChangeText={(text: string) =>
                            this.setState({ local_funding_amount: text })
                        }
                        numberOfLines={1}
                        style={{ fontSize: 20, color: themeColor('text') }}
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />
                    {local_funding_amount === 'all' && (
                        <Text
                            style={{
                                color: themeColor('text')
                            }}
                        >
                            {`${
                                utxoBalance > 0
                                    ? utxoBalance
                                    : confirmedBlockchainBalance
                            } ${localeString('views.Receive.satoshis')}`}
                        </Text>
                    )}

                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.OpenChannel.numConf')}
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
                        style={{ fontSize: 20, color: themeColor('text') }}
                        placeholderTextColor="gray"
                        editable={!openingChannel}
                    />

                    <Text
                        style={{
                            textDecorationLine: 'underline',
                            color: themeColor('text')
                        }}
                    >
                        {localeString('views.OpenChannel.satsPerByte')}
                    </Text>
                    <TouchableWithoutFeedback
                        onPress={() =>
                            navigation.navigate('EditFee', {
                                onNavigateBack: this.handleOnNavigateBack
                            })
                        }
                    >
                        <View
                            style={{
                                ...styles.editFeeBox,

                                borderColor: 'rgba(255, 217, 63, .6)',
                                borderWidth: 3
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontSize: 18
                                }}
                            >
                                {sat_per_byte}
                            </Text>
                        </View>
                    </TouchableWithoutFeedback>

                    {RESTUtils.supportsCoinControl() &&
                        implementation !== 'lnd' && (
                            <UTXOPicker
                                onValueChange={this.selectUTXOs}
                                UTXOsStore={UTXOsStore}
                            />
                        )}

                    <View style={{ padding: 10 }}>
                        <CheckBox
                            title={localeString('views.OpenChannel.private')}
                            checked={privateChannel}
                            onPress={() =>
                                this.setState({ private: !privateChannel })
                            }
                        />
                    </View>

                    <View style={styles.button}>
                        <Button
                            title={localeString(
                                'views.OpenChannel.openChannel'
                            )}
                            icon={{
                                name: 'swap-horiz',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() => connectPeer(this.state)}
                            buttonStyle={{
                                backgroundColor: '#261339',
                                borderRadius: 30
                            }}
                        />
                    </View>
                    <View style={styles.button}>
                        <Button
                            title={localeString('general.scan')}
                            icon={{
                                name: 'crop-free',
                                size: 25,
                                color: 'white'
                            }}
                            onPress={() =>
                                navigation.navigate('NodeQRCodeScanner')
                            }
                            buttonStyle={{
                                backgroundColor: '#261339',
                                borderRadius: 30
                            }}
                        />
                    </View>
                    <View style={styles.button}>
                        <FeeTable setFee={this.setFee} FeeStore={FeeStore} />
                    </View>
                </View>
            </ScrollView>
        );
    }
}

const styles = StyleSheet.create({
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
    },
    editFeeBox: {
        height: 65,
        padding: 15,
        marginTop: 15,
        borderRadius: 4,
        borderColor: '#FFD93F',
        borderWidth: 2
    }
});
