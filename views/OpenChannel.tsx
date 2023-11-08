import * as React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    TouchableOpacity
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { inject, observer } from 'mobx-react';
import NfcManager, { NfcEvents, TagEvent } from 'react-native-nfc-manager';

import Amount from '../components/Amount';
import AmountInput from '../components/AmountInput';
import Button from '../components/Button';
import Header from '../components/Header';
import OnchainFeeInput from '../components/OnchainFeeInput';
import KeyValue from '../components/KeyValue';
import LightningIndicator from '../components/LightningIndicator';
import { Row } from '../components/layout/Row';
import Screen from '../components/Screen';
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

import BalanceStore from '../stores/BalanceStore';
import ChannelsStore from '../stores/ChannelsStore';
import ModalStore from '../stores/ModalStore';
import NodeInfoStore from '../stores/NodeInfoStore';
import SettingsStore from '../stores/SettingsStore';
import UTXOsStore from '../stores/UTXOsStore';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';
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
    fundMax: boolean;
    satAmount: string | number;
    min_confs: number;
    spend_unconfirmed: boolean;
    sat_per_vbyte: string;
    privateChannel: boolean;
    scidAlias: boolean;
    simpleTaprootChannel: boolean;
    host: string;
    suggestImport: string;
    utxos: Array<string>;
    utxoBalance: number;
    connectPeerOnly: boolean;
    advancedSettingsToggle: boolean;
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
            fundMax: false,
            satAmount: '',
            min_confs: 1,
            spend_unconfirmed: false,
            sat_per_vbyte: '2',
            privateChannel: true,
            scidAlias: true,
            simpleTaprootChannel: false,
            host: '',
            suggestImport: '',
            utxos: [],
            utxoBalance: 0,
            connectPeerOnly: false,
            advancedSettingsToggle: false
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
        const newState: any = {};
        newState.utxos = utxos;
        newState.utxoBalance = utxoBalance;
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
            fundMax,
            satAmount,
            min_confs,
            host,
            sat_per_vbyte,
            suggestImport,
            utxoBalance,
            privateChannel,
            scidAlias,
            simpleTaprootChannel,
            connectPeerOnly,
            advancedSettingsToggle
        } = this.state;
        const { implementation } = SettingsStore;

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
                <Scan fill={themeColor('text')} width={35} height={35} />
            </TouchableOpacity>
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={
                        <View style={{ top: 5 }}>
                            <View style={{ top: -9, width: '100%' }}>
                                <Button
                                    onPress={() =>
                                        this.setState({
                                            connectPeerOnly: !connectPeerOnly
                                        })
                                    }
                                    title={
                                        connectPeerOnly
                                            ? localeString(
                                                  'views.OpenChannel.connectPeer'
                                              )
                                            : localeString(
                                                  'views.OpenChannel.openChannel'
                                              )
                                    }
                                    noUppercase
                                    buttonStyle={{ alignSelf: 'center' }}
                                />
                            </View>
                        </View>
                    }
                    rightComponent={ScanButton}
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1
                    }}
                    keyboardShouldPersistTaps="handled"
                    ref="_scrollView"
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
                                ...styles.text,
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
                                ...styles.text,
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
                                        title={
                                            connectPeerOnly
                                                ? localeString(
                                                      'views.OpenChannel.peerToOlympus'
                                                  )
                                                : localeString(
                                                      'views.OpenChannel.openChannelToOlympus'
                                                  )
                                        }
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

                        {!connectPeerOnly && (
                            <>
                                {BackendUtils.supportsChannelCoinControl() && (
                                    <UTXOPicker
                                        onValueChange={this.selectUTXOs}
                                        UTXOsStore={UTXOsStore}
                                    />
                                )}

                                {BackendUtils.isLNDBased() && (
                                    <>
                                        <Text
                                            style={{
                                                top: 20,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.OpenChannel.fundMax'
                                            )}
                                        </Text>
                                        <Switch
                                            value={fundMax}
                                            onValueChange={() => {
                                                const newValue: boolean =
                                                    !fundMax;
                                                this.setState({
                                                    fundMax: newValue,
                                                    local_funding_amount:
                                                        newValue &&
                                                        implementation ===
                                                            'c-lightning-REST'
                                                            ? 'all'
                                                            : ''
                                                });
                                            }}
                                        />
                                    </>
                                )}

                                {!fundMax && (
                                    <AmountInput
                                        amount={local_funding_amount}
                                        title={localeString(
                                            'views.OpenChannel.localAmt'
                                        )}
                                        onAmountChange={(
                                            amount: string,
                                            satAmount: string | number
                                        ) => {
                                            this.setState({
                                                local_funding_amount: amount,
                                                satAmount
                                            });
                                        }}
                                        hideConversion={
                                            local_funding_amount === 'all'
                                        }
                                    />
                                )}

                                {(local_funding_amount === 'all' ||
                                    fundMax) && (
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

                                <>
                                    <Text
                                        style={{
                                            ...styles.text,
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {localeString(
                                            'views.OpenChannel.satsPerVbyte'
                                        )}
                                    </Text>
                                    <OnchainFeeInput
                                        fee={sat_per_vbyte}
                                        onChangeFee={(text: string) => {
                                            console.log('text', text);
                                            this.setState({
                                                sat_per_vbyte: text
                                            });
                                        }}
                                    />
                                </>

                                <TouchableOpacity
                                    onPress={() => {
                                        this.setState({
                                            advancedSettingsToggle:
                                                !advancedSettingsToggle
                                        });
                                    }}
                                >
                                    <View
                                        style={{
                                            marginTop: 10,
                                            marginBottom: 10
                                        }}
                                    >
                                        <Row justify="space-between">
                                            <View style={{ width: '95%' }}>
                                                <KeyValue
                                                    keyValue={localeString(
                                                        'general.advancedSettings'
                                                    )}
                                                />
                                            </View>
                                            {advancedSettingsToggle ? (
                                                <CaretDown
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            ) : (
                                                <CaretRight
                                                    fill={themeColor('text')}
                                                    width="20"
                                                    height="20"
                                                />
                                            )}
                                        </Row>
                                    </View>
                                </TouchableOpacity>

                                {advancedSettingsToggle && (
                                    <>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.OpenChannel.numConf'
                                            )}
                                        </Text>
                                        <TextInput
                                            keyboardType="numeric"
                                            placeholder={'1'}
                                            value={min_confs.toString()}
                                            onChangeText={(text: string) => {
                                                const newMinConfs =
                                                    Number(text);
                                                this.setState({
                                                    min_confs: newMinConfs,
                                                    spend_unconfirmed:
                                                        newMinConfs === 0
                                                });
                                            }}
                                            locked={openingChannel}
                                        />

                                        <>
                                            <Text
                                                style={{
                                                    top: 20,
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
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
                                                        privateChannel:
                                                            !privateChannel
                                                    })
                                                }
                                            />
                                        </>

                                        {BackendUtils.isLNDBased() && (
                                            <>
                                                <Text
                                                    style={{
                                                        top: 20,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        )
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
                                                            scidAlias:
                                                                !scidAlias
                                                        })
                                                    }
                                                />
                                            </>
                                        )}

                                        {BackendUtils.supportsSimpleTaprootChannels() && (
                                            <>
                                                <Text
                                                    style={{
                                                        top: 20,
                                                        color: themeColor(
                                                            'secondaryText'
                                                        )
                                                    }}
                                                >
                                                    {localeString(
                                                        'views.OpenChannel.simpleTaprootChannel'
                                                    )}
                                                </Text>
                                                <Switch
                                                    value={simpleTaprootChannel}
                                                    onValueChange={() =>
                                                        this.setState({
                                                            simpleTaprootChannel:
                                                                !simpleTaprootChannel
                                                        })
                                                    }
                                                />
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        <View style={{ ...styles.button, paddingTop: 20 }}>
                            <Button
                                title={
                                    connectPeerOnly
                                        ? localeString(
                                              'views.OpenChannel.connectPeer'
                                          )
                                        : localeString(
                                              'views.OpenChannel.openChannel'
                                          )
                                }
                                icon={{
                                    name: 'swap-horiz',
                                    size: 25,
                                    color: 'white'
                                }}
                                onPress={() => {
                                    this.refs._scrollView.scrollTo({
                                        y: 0,
                                        animated: true
                                    });
                                    connectPeer(
                                        {
                                            ...this.state,
                                            local_funding_amount:
                                                satAmount.toString()
                                        },
                                        false,
                                        connectPeerOnly
                                    );
                                }}
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
        fontFamily: 'PPNeueMontreal-Book'
    },
    textWhite: {
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book'
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
    }
});
