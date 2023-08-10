import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TouchableWithoutFeedback
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';

import Amount from './../components/Amount';
import AmountInput from './../components/AmountInput';
import Button from './../components/Button';
import Header from '../components/Header';
import LightningIndicator from './../components/LightningIndicator';
import Screen from './../components/Screen';
import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Switch from '../components/Switch';
import TextInput from '../components/TextInput';
import UTXOPicker from '../components/UTXOPicker';

import handleAnything from '../utils/handleAnything';
import NFCUtils from '../utils/NFCUtils';
import NodeUriUtils from '../utils/NodeUriUtils';
import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import BalanceStore from './../stores/BalanceStore';
import ChannelsStore from './../stores/ChannelsStore';
import ModalStore from './../stores/ModalStore';
import NodeInfoStore from './../stores/NodeInfoStore';
import SettingsStore from './../stores/SettingsStore';
import UTXOsStore from './../stores/UTXOsStore';

import Scan from '../assets/images/SVG/Scan.svg';

interface OpenChannelProps {
    exitSetup: any;
    navigation: any;
    BalanceStore: BalanceStore;
    ChannelsStore: ChannelsStore;
    ModalStore: ModalStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    UTXOsStore: UTXOsStore;
}

interface OpenChannelState {
    node_pubkey_string: string;
    local_funding_amount: string;
    satAmount: string | number;
    min_confs: number;
    spend_unconfirmed: boolean;
    sat_per_vbyte: string;
    privateChannel: boolean;
    scidAlias: boolean;
    host: string;
    suggestImport: string;
    utxos: Array<string>;
    utxoBalance: number;
}

@inject(
    'BalanceStore',
    'ChannelsStore',
    'ModalStore',
    'NodeInfoStore',
    'SettingsStore',
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
            satAmount: '',
            min_confs: 1,
            spend_unconfirmed: false,
            sat_per_vbyte: '2',
            privateChannel: true,
            scidAlias: true,
            host: '',
            suggestImport: '',
            utxos: [],
            utxoBalance: 0
        };
    }

    async UNSAFE_componentWillMount() {
        const { ChannelsStore, SettingsStore } = this.props;
        const { settings } = SettingsStore;

        ChannelsStore.resetOpenChannel();

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
    }

    disableNfc = () => {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.setEventListener(NfcEvents.SessionClosed, null);
    };

    enableNfc = async () => {
        const { ModalStore } = this.props;
        this.disableNfc();
        await NfcManager.start();

        return new Promise((resolve: any) => {
            let tagFound: TagEvent | null = null;

            // enable NFC
            if (Platform.OS === 'android')
                ModalStore.toggleAndroidNfcModal(true);

            NfcManager.setEventListener(
                NfcEvents.DiscoverTag,
                (tag: TagEvent) => {
                    tagFound = tag;
                    const bytes = new Uint8Array(
                        tagFound.ndefMessage[0].payload
                    );
                    const str = NFCUtils.nfcUtf8ArrayToStr(bytes) || '';

                    // close NFC
                    if (Platform.OS === 'android')
                        ModalStore.toggleAndroidNfcModal(false);

                    resolve(this.validateNodeUri(str));
                    NfcManager.unregisterTagEvent().catch(() => 0);
                }
            );

            NfcManager.setEventListener(NfcEvents.SessionClosed, () => {
                // close NFC
                if (Platform.OS === 'android')
                    ModalStore.toggleAndroidNfcModal(false);

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
        this.setState({ sat_per_vbyte: text });
    };

    handleOnNavigateBack = (sat_per_vbyte: string) => {
        this.setState({
            sat_per_vbyte
        });
    };

    render() {
        const {
            ChannelsStore,
            BalanceStore,
            NodeInfoStore,
            UTXOsStore,
            SettingsStore,
            navigation
        } = this.props;
        const {
            node_pubkey_string,
            local_funding_amount,
            satAmount,
            min_confs,
            host,
            sat_per_vbyte,
            suggestImport,
            utxoBalance,
            privateChannel,
            scidAlias
        } = this.state;
        const { settings } = SettingsStore;
        const { privacy } = settings;
        const enableMempoolRates = privacy && privacy.enableMempoolRates;

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

        const ScanButton = () => (
            <TouchableOpacity
                onPress={() => navigation.navigate('NodeQRCodeScanner')}
            >
                <Scan fill={themeColor('text')} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.OpenChannel.openChannel'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    rightComponent={ScanButton}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {!!suggestImport && (
                        <View style={styles.clipboardImport}>
                            <Text style={styles.textWhite}>
                                {localeString('views.OpenChannel.importText')}
                            </Text>
                            <Text style={{ ...styles.textWhite, padding: 15 }}>
                                {suggestImport}
                            </Text>
                            <Text style={styles.textWhite}>
                                {localeString('views.OpenChannel.importPrompt')}
                            </Text>
                            <View style={styles.button}>
                                <Button
                                    title={localeString(
                                        'views.OpenChannel.import'
                                    )}
                                    onPress={() => this.importClipboard()}
                                    tertiary
                                />
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => this.clearImportSuggestion()}
                                    tertiary
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.content}>
                        {(connectingToPeer || openingChannel) && (
                            <LightningIndicator />
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
                                ...styles.secondaryText,
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
                            locked={openingChannel}
                        />

                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.OpenChannel.host')}
                        </Text>
                        <TextInput
                            placeholder={localeString(
                                'views.OpenChannel.hostPort'
                            )}
                            value={host}
                            onChangeText={(text: string) =>
                                this.setState({ host: text })
                            }
                            locked={openingChannel}
                        />

                        {!(connectingToPeer || openingChannel) &&
                            !node_pubkey_string &&
                            !host && (
                                <View style={{ margin: 10, marginBottom: 25 }}>
                                    <Button
                                        title={localeString(
                                            'views.OpenChannel.openChannelToOlympus'
                                        )}
                                        onPress={() => {
                                            if (
                                                NodeInfoStore.nodeInfo.isTestNet
                                            ) {
                                                this.setState({
                                                    node_pubkey_string:
                                                        '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df',
                                                    host: '139.144.22.237:9735'
                                                });
                                            } else {
                                                this.setState({
                                                    node_pubkey_string:
                                                        '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581',
                                                    host: '45.79.192.236:9735'
                                                });
                                            }
                                        }}
                                    />
                                </View>
                            )}

                        <AmountInput
                            amount={local_funding_amount}
                            title={localeString('views.OpenChannel.localAmt')}
                            onAmountChange={(
                                amount: string,
                                satAmount: string | number
                            ) => {
                                this.setState({
                                    local_funding_amount: amount,
                                    satAmount
                                });
                            }}
                            hideConversion={local_funding_amount === 'all'}
                        />

                        {local_funding_amount === 'all' && (
                            <View style={{ marginBottom: 20 }}>
                                <Amount
                                    sats={
                                        utxoBalance > 0
                                            ? utxoBalance
                                            : confirmedBlockchainBalance
                                    }
                                    toggleable
                                />
                            </View>
                        )}

                        <Text
                            style={{
                                ...styles.secondaryText,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.OpenChannel.numConf')}
                        </Text>
                        <TextInput
                            keyboardType="numeric"
                            placeholder={'1'}
                            value={min_confs.toString()}
                            onChangeText={(text: string) => {
                                const newMinConfs = Number(text);
                                this.setState({
                                    min_confs: newMinConfs,
                                    spend_unconfirmed: newMinConfs === 0
                                });
                            }}
                            locked={openingChannel}
                        />

                        <>
                            <Text
                                style={{
                                    ...styles.secondaryText,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.OpenChannel.satsPerVbyte')}
                            </Text>
                            {enableMempoolRates ? (
                                <TouchableWithoutFeedback
                                    onPress={() =>
                                        navigation.navigate('EditFee', {
                                            onNavigateBack:
                                                this.handleOnNavigateBack
                                        })
                                    }
                                >
                                    <View
                                        style={{
                                            ...styles.editFeeBox,

                                            borderColor:
                                                'rgba(255, 217, 63, .6)',
                                            borderWidth: 3
                                        }}
                                    >
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text'),
                                                fontSize: 18
                                            }}
                                        >
                                            {sat_per_vbyte}
                                        </Text>
                                    </View>
                                </TouchableWithoutFeedback>
                            ) : (
                                <TextInput
                                    keyboardType="numeric"
                                    placeholder={'2'}
                                    value={sat_per_vbyte}
                                    onChangeText={(text: string) =>
                                        this.setState({
                                            sat_per_vbyte: text
                                        })
                                    }
                                />
                            )}
                        </>

                        {BackendUtils.supportsCoinControl() &&
                            !BackendUtils.isLNDBased() && (
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
                                {localeString(
                                    'views.OpenChannel.announceChannel'
                                )}
                            </Text>
                            <Switch
                                value={!privateChannel}
                                onValueChange={() =>
                                    this.setState({
                                        privateChannel: !privateChannel
                                    })
                                }
                            />
                        </>

                        {BackendUtils.isLNDBased() && (
                            <>
                                <Text
                                    style={{
                                        top: 20,
                                        color: themeColor('secondaryText')
                                    }}
                                >
                                    {localeString(
                                        'views.OpenChannel.scidAlias'
                                    )}
                                </Text>
                                <Switch
                                    value={scidAlias}
                                    onValueChange={() =>
                                        this.setState({
                                            scidAlias: !scidAlias
                                        })
                                    }
                                />
                            </>
                        )}

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
                                onPress={() =>
                                    connectPeer({
                                        ...this.state,
                                        local_funding_amount:
                                            satAmount.toString()
                                    })
                                }
                            />
                        </View>

                        <View style={styles.button}>
                            <Button
                                title={localeString('general.enableNfc')}
                                icon={{
                                    name: 'nfc',
                                    size: 25
                                }}
                                onPress={() => this.enableNfc()}
                                secondary
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Lato-Regular'
    },
    secondaryText: {
        fontFamily: 'Lato-Regular'
    },
    textWhite: {
        color: 'white',
        fontFamily: 'Lato-Regular'
    },
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 10,
        paddingRight: 10
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
