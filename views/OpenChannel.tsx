import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
    TouchableWithoutFeedback
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import { inject, observer } from 'mobx-react';
import { Header, Icon } from 'react-native-elements';
import NfcManager, { NfcEvents } from 'react-native-nfc-manager';

import Button from './../components/Button';
import FeeTable from './../components/FeeTable';
import LoadingIndicator from './../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage
} from './../components/SuccessErrorMessage';
import TextInput from './../components/TextInput';
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
        this.state = {
            node_pubkey_string: '',
            local_funding_amount: '',
            min_confs: 1,
            sat_per_byte: '2',
            private: false,
            host: '',
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

    async componentDidMount() {
        this.initFromProps(this.props);
        await this.initNfc();
    }

    initNfc = async () => {
        await NfcManager.start();

        return new Promise((resolve: any) => {
            let tagFound = null;

            NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: any) => {
                tagFound = tag;
                const bytes = new Uint8Array(tagFound.ndefMessage[0].payload);
                const str = NFCUtils.nfcUtf8ArrayToStr(bytes);
                resolve(this.validateNodeUri(str));
                NfcManager.unregisterTagEvent().catch(() => 0);
            });

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                if (!tagFound) {
                    resolve();
                }
            });

            NfcManager.registerTagEvent();
        });
    };

    UNSAFE_componentWillReceiveProps(nextProps: any) {
        this.initFromProps(nextProps);
    }

    initFromProps(props: any) {
        const { navigation } = props;

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

    validateNodeUri = (text: string) => {
        const { navigation } = this.props;
        handleAnything(text).then(([route, props]) => {
            navigation.navigate(route, props);
        });
    };

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
                                tertiary
                            />
                        </View>
                        <View style={styles.button}>
                            <Button
                                title="Cancel"
                                onPress={() => this.clearImportSuggestion()}
                                tertiary
                            />
                        </View>
                    </View>
                )}

                <View style={styles.content}>
                    {(connectingToPeer || openingChannel) && (
                        <LoadingIndicator />
                    )}
                    {peerSuccess && (
                        <SuccessMessage
                            message={localeString(
                                'views.OpenChannel.peerSuccess'
                            )}
                        />
                    )}
                    {channelSuccess && (
                        <SuccessMessage
                            message={localeString(
                                'views.OpenChannel.channelSuccess'
                            )}
                        />
                    )}
                    {(errorMsgPeer || errorMsgChannel) && (
                        <ErrorMessage
                            message={
                                errorMsgChannel ||
                                errorMsgPeer ||
                                localeString('general.error')
                            }
                        />
                    )}

                    <Text
                        style={{
                            color: themeColor('secondaryText')
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
                        editable={!openingChannel}
                    />

                    <Text
                        style={{
                            color: themeColor('secondaryText')
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
                        editable={!openingChannel}
                    />

                    <Text
                        style={{
                            color: themeColor('secondaryText')
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
                            color: themeColor('secondaryText')
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
                        editable={!openingChannel}
                    />

                    <>
                        <Text
                            style={{
                                color: themeColor('secondaryText')
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
                    </>

                    {RESTUtils.supportsCoinControl() &&
                        implementation !== 'lnd' && (
                            <UTXOPicker
                                onValueChange={this.selectUTXOs}
                                UTXOsStore={UTXOsStore}
                            />
                        )}

                    <>
                        <Text
                            style={{
                                top: 20,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.OpenChannel.private')}
                        </Text>
                        <Switch
                            value={privateChannel}
                            onValueChange={() =>
                                this.setState({
                                    private: !privateChannel
                                })
                            }
                            trackColor={{
                                false: '#767577',
                                true: themeColor('highlight')
                            }}
                            style={{
                                alignSelf: 'flex-end'
                            }}
                        />
                    </>

                    <View style={{ ...styles.button, paddingTop: 20 }}>
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
                            secondary
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
        paddingBottom: 10
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
        borderWidth: 2,
        marginBottom: 20
    }
});
