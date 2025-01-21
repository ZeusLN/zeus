import * as React from 'react';
import { inject, observer } from 'mobx-react';
import {
    NativeEventEmitter,
    NativeModules,
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import { ButtonGroup, Icon } from 'react-native-elements';
import EncryptedStorage from 'react-native-encrypted-storage';
import Slider from '@react-native-community/slider';
import { StackNavigationProp } from '@react-navigation/stack';
import { v4 as uuidv4 } from 'uuid';

import CaretDown from '../../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../../assets/images/SVG/Caret Right.svg';
import OrderList from '../../../assets/images/SVG/order-list.svg';
import OlympusSVG from '../../../assets/images/SVG/Olympus.svg';

import Button from '../../../components/Button';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';
import LoadingIndicator from '../../../components/LoadingIndicator';
import LSPS1OrderResponse from '../../../components/LSPS1OrderResponse';
import Screen from '../../../components/Screen';
import Switch from '../../../components/Switch';
import Text from '../../../components/Text';
import TextInput from '../../../components/TextInput';

import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import BackendUtils from '../../../utils/BackendUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import { numberWithCommas } from '../../../utils/UnitsUtils';

import LSPStore from '../../../stores/LSPStore';
import InvoicesStore from '../../../stores/InvoicesStore';
import ChannelsStore from '../../../stores/ChannelsStore';
import SettingsStore from '../../../stores/SettingsStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';

import { LSPS1OrderResponse as Order } from './OrdersPane';

interface LSPS1Props {
    LSPStore: LSPStore;
    InvoicesStore: InvoicesStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    navigation: StackNavigationProp<any, any>;
}

interface LSPS1State {
    lspBalanceSat: number | string;
    clientBalanceSat: number | string;
    requiredChannelConfirmations: any;
    confirmsWithinBlocks: any;
    channelExpiryBlocks: string | number;
    expirationIndex: number;
    token: any;
    refundOnchainAddress: any;
    announceChannel: boolean;
    showInfo: boolean;
    advancedSettings: boolean;
}

@inject(
    'LSPStore',
    'ChannelsStore',
    'InvoicesStore',
    'SettingsStore',
    'NodeInfoStore'
)
@observer
export default class LSPS1 extends React.Component<LSPS1Props, LSPS1State> {
    listener: any;
    constructor(props: LSPS1Props) {
        super(props);
        this.state = {
            lspBalanceSat: 0,
            clientBalanceSat: 0,
            requiredChannelConfirmations: '',
            confirmsWithinBlocks: '',
            channelExpiryBlocks: 'N/A',
            expirationIndex: 0,
            token: props.SettingsStore.settings?.lsps1Token || '',
            refundOnchainAddress: '',
            showInfo: false,
            advancedSettings: false,
            announceChannel: false
        };
    }

    encodeMesage = (n: any) => Buffer.from(JSON.stringify(n)).toString('hex');

    async componentDidMount() {
        const { LSPStore, SettingsStore, navigation } = this.props;
        LSPStore.resetLSPS1Data();
        if (BackendUtils.supportsLSPS1rest()) {
            LSPStore.getInfoREST();
        } else {
            console.log('connecting');
            await this.connectPeer();
            console.log('connected');
            await this.subscribeToCustomMessages();
            this.sendCustomMessage_lsps1();
        }

        navigation.addListener('focus', () => {
            this.setState({
                token: SettingsStore.settings?.lsps1Token || ''
            });
        });
    }

    componentDidUpdate(_prevProps: LSPS1Props) {
        const {
            lspBalanceSat,
            clientBalanceSat,
            channelExpiryBlocks,
            requiredChannelConfirmations,
            confirmsWithinBlocks
        } = this.state;
        const { getInfoData } = this.props.LSPStore;
        const info =
            getInfoData?.result?.options ||
            getInfoData?.options ||
            getInfoData?.result ||
            getInfoData;

        if (lspBalanceSat === 0 && info?.min_initial_lsp_balance_sat) {
            this.setState({
                lspBalanceSat: parseInt(info.min_initial_lsp_balance_sat)
            });
        }
        if (
            clientBalanceSat === 0 &&
            info?.min_initial_client_balance_sat > 0
        ) {
            this.setState({
                clientBalanceSat: parseInt(info.min_initial_client_balance_sat)
            });
        }

        if (channelExpiryBlocks === 'N/A' && info?.max_channel_expiry_blocks) {
            const channelExpiryBlocks = parseInt(
                info.max_channel_expiry_blocks
            );
            let expirationIndex = 5;
            if (channelExpiryBlocks === 4380) {
                expirationIndex = 0;
            } else if (channelExpiryBlocks === 13140) {
                expirationIndex = 1;
            } else if (channelExpiryBlocks === 26280) {
                expirationIndex = 2;
            } else if (channelExpiryBlocks === 52560) {
                expirationIndex = 3;
            }

            this.setState({
                channelExpiryBlocks,
                expirationIndex
            });
        }

        if (
            requiredChannelConfirmations === '' &&
            info?.min_required_channel_confirmations
        ) {
            this.setState({
                requiredChannelConfirmations:
                    info?.min_required_channel_confirmations.toString()
            });
        }

        if (
            confirmsWithinBlocks === '' &&
            info?.min_funding_confirms_within_blocks
        ) {
            this.setState({
                confirmsWithinBlocks:
                    (info?.min_funding_confirms_within_blocks).toString()
            });
        }
    }

    subscribeToCustomMessages() {
        if (
            this.props.SettingsStore.implementation === 'lightning-node-connect'
        ) {
            const { LncModule } = NativeModules;
            const eventName = BackendUtils.subscribeCustomMessages();
            const eventEmitter = new NativeEventEmitter(LncModule);
            this.listener = eventEmitter.addListener(
                eventName,
                (event: any) => {
                    if (event.result) {
                        try {
                            const result = JSON.parse(event.result);
                            this.props.LSPStore.handleCustomMessages(result);
                        } catch (error) {
                            console.error(error);
                        }
                    }
                }
            );
            return;
        } else {
            return new Promise((resolve, reject) => {
                this.props.LSPStore.subscribeCustomMessages()
                    .then((response) => {
                        console.log('Subscribed to custom messages:', response);
                        resolve({});
                    })
                    .catch((error) => {
                        console.error(
                            'Error subscribing to custom messages:',
                            error
                        );
                        reject();
                    });
            });
        }
    }

    sendCustomMessage_lsps1() {
        const { LSPStore } = this.props;
        LSPStore.loading = true;
        LSPStore.error = false;
        LSPStore.error_msg = '';
        const node_pubkey_string: string = LSPStore.getLSPS1Pubkey();
        const type = 37913;
        const id = uuidv4();
        LSPStore.getInfoId = id;
        const data = this.encodeMesage({
            jsonrpc: '2.0',
            method: 'lsps1.get_info',
            params: {},
            id: LSPStore.getInfoId
        });

        LSPStore.sendCustomMessage({
            peer: node_pubkey_string,
            type,
            data
        })
            .then((response) => {
                console.log('Custom message sent:', response);
            })
            .catch((error) => {
                console.error(
                    'Error sending (get_info) custom message:',
                    error
                );
            });
    }

    lsps1_createorder = () => {
        const { LSPStore } = this.props;
        const node_pubkey_string: string = LSPStore.getLSPS1Pubkey();
        const type = 37913;
        const id = uuidv4();
        LSPStore.createOrderId = id;
        LSPStore.loading = true;
        LSPStore.error = false;
        LSPStore.error_msg = '';
        const data = this.encodeMesage({
            jsonrpc: '2.0',
            method: 'lsps1.create_order',
            params: {
                lsp_balance_sat: this.state.lspBalanceSat.toString(),
                client_balance_sat: this.state.clientBalanceSat.toString(),
                required_channel_confirmations: parseInt(
                    this.state.requiredChannelConfirmations
                ),
                funding_confirms_within_blocks: parseInt(
                    this.state.confirmsWithinBlocks
                ),
                channel_expiry_blocks: this.state.channelExpiryBlocks,
                token: this.state.token,
                refund_onchain_address: this.state.refundOnchainAddress,
                announce_channel: this.state.announceChannel
            },
            id: LSPStore.createOrderId
        });

        LSPStore.sendCustomMessage({
            peer: node_pubkey_string,
            type,
            data
        })
            .then(() => {})
            .catch((error) => {
                console.error(
                    'Error sending (create_order) custom message:',
                    error
                );
            });
    };

    connectPeer = async () => {
        const { ChannelsStore, LSPStore } = this.props;
        const node_pubkey_string: string = LSPStore.getLSPS1Pubkey();
        const host: string = LSPStore.getLSPS1Host();
        try {
            return await ChannelsStore.connectPeer(
                {
                    node_pubkey_string,
                    host,
                    local_funding_amount: ''
                },
                true,
                true
            );
        } catch (err) {
            console.log(err);
        }
    };

    updateExpirationIndex = (expirationIndex: number) => {
        if (expirationIndex === 0) {
            this.setState({
                channelExpiryBlocks: 4380,
                expirationIndex: 0
            });
        } else if (expirationIndex === 1) {
            this.setState({
                channelExpiryBlocks: 13140,
                expirationIndex: 1
            });
        } else if (expirationIndex === 2) {
            this.setState({
                channelExpiryBlocks: 26280,
                expirationIndex: 2
            });
        } else if (expirationIndex === 3) {
            this.setState({
                channelExpiryBlocks: 52560,
                expirationIndex: 3
            });
        }
    };

    render() {
        const {
            navigation,
            LSPStore,
            InvoicesStore,
            NodeInfoStore,
            SettingsStore
        } = this.props;
        const {
            showInfo,
            advancedSettings,
            lspBalanceSat,
            clientBalanceSat,
            channelExpiryBlocks,
            expirationIndex
        } = this.state;
        const { getInfoData, createOrderResponse } = LSPStore;
        const info =
            getInfoData?.result?.options ||
            getInfoData?.options ||
            getInfoData?.result ||
            getInfoData;
        const result = createOrderResponse?.result || createOrderResponse;
        const payment = result?.payment;

        const OrderlistBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10 }}
                onPress={() => {
                    navigation.navigate('OrdersPane');
                }}
                accessibilityLabel={localeString('general.add')}
            >
                <OrderList
                    fill={themeColor('text')}
                    width="40"
                    height="40"
                    style={{ alignSelf: 'center' }}
                />
            </TouchableOpacity>
        );

        const SettingsBtn = () => (
            <TouchableOpacity style={{ marginTop: -10, marginRight: 6 }}>
                <Icon
                    name="settings"
                    onPress={() => {
                        this.props.navigation.navigate('LSPS1Settings');
                    }}
                    color={themeColor('text')}
                    underlayColor="transparent"
                    size={33}
                />
            </TouchableOpacity>
        );

        const oneMoButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 0
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.1mo')}
            </Text>
        );
        const threeMoButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 1
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.3mo')}
            </Text>
        );
        const sixMoButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 2
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.6mo')}
            </Text>
        );
        const twelveMoButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 3
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.12mo')}
            </Text>
        );

        const expirationButtons: any = [
            { element: oneMoButton },
            { element: threeMoButton },
            { element: sixMoButton },
            { element: twelveMoButton }
        ];

        const { flowLspNotConfigured } = NodeInfoStore.flowLspNotConfigured();

        const flowServiceAvailable =
            SettingsStore.settings?.enableLSP &&
            BackendUtils.supportsFlowLSP() &&
            !flowLspNotConfigured;

        const isOlympus = LSPStore.isOlympus();

        const lspDisplay = isOlympus
            ? 'Olympus by ZEUS'
            : BackendUtils.supportsLSPS1customMessage()
            ? LSPStore.getLSPS1Pubkey()
            : LSPStore.getLSPS1Rest();

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    navigation={navigation}
                    rightComponent={
                        <Row>
                            <SettingsBtn />
                            {!LSPStore.loading && !LSPStore.error && (
                                <OrderlistBtn />
                            )}
                        </Row>
                    }
                    onBack={() => LSPStore.resetLSPS1Data()}
                />
                <View style={{ paddingHorizontal: 18 }}>
                    {BackendUtils.supportsLSPS1customMessage() &&
                        !LSPStore.getLSPS1Pubkey() &&
                        !LSPStore.getLSPS1Host() && (
                            <ErrorMessage
                                message={localeString(
                                    'views.LSPS1.pubkeyAndHostNotFound'
                                )}
                            />
                        )}

                    {LSPStore?.error &&
                        LSPStore?.error_msg &&
                        LSPStore?.error_msg !==
                            localeString('views.LSPS1.timeoutError') && (
                            <ErrorMessage message={LSPStore.error_msg} />
                        )}
                </View>
                {LSPStore.loading ? (
                    <LoadingIndicator />
                ) : (LSPStore?.error && LSPStore?.error_msg) ===
                  localeString('views.LSPS1.timeoutError') ? (
                    <ErrorMessage message={LSPStore.error_msg} />
                ) : (
                    <>
                        <ScrollView style={{ flex: 1 }}>
                            {createOrderResponse &&
                                Object.keys(createOrderResponse).length > 0 &&
                                result &&
                                payment && (
                                    <LSPS1OrderResponse
                                        orderResponse={result}
                                        orderView={false}
                                        navigation={navigation}
                                    />
                                )}

                            {Object.keys(createOrderResponse).length == 0 && (
                                <ScrollView
                                    style={{
                                        flex: 1,
                                        marginTop: 10,
                                        paddingHorizontal: 22
                                    }}
                                >
                                    <>
                                        {Object.keys(getInfoData).length >
                                            0 && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    this.setState({
                                                        showInfo: !showInfo
                                                    });
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        marginBottom: 10
                                                    }}
                                                >
                                                    <Row justify="space-between">
                                                        <View
                                                            style={{
                                                                width: '95%'
                                                            }}
                                                        >
                                                            <Row justify="space-between">
                                                                {isOlympus && (
                                                                    <View
                                                                        style={{
                                                                            width: '15%'
                                                                        }}
                                                                    >
                                                                        <OlympusSVG
                                                                            fill={themeColor(
                                                                                'highlight'
                                                                            )}
                                                                        />
                                                                    </View>
                                                                )}
                                                                <View
                                                                    style={{
                                                                        width: '85%'
                                                                    }}
                                                                >
                                                                    <KeyValue
                                                                        keyValue={localeString(
                                                                            'views.LSPS1.serviceInfo'
                                                                        )}
                                                                    />
                                                                </View>
                                                            </Row>
                                                        </View>
                                                        {showInfo ? (
                                                            <CaretDown
                                                                fill={themeColor(
                                                                    'text'
                                                                )}
                                                                width="20"
                                                                height="20"
                                                            />
                                                        ) : (
                                                            <CaretRight
                                                                fill={themeColor(
                                                                    'text'
                                                                )}
                                                                width="20"
                                                                height="20"
                                                            />
                                                        )}
                                                    </Row>
                                                </View>
                                            </TouchableOpacity>
                                        )}

                                        {showInfo &&
                                            getInfoData &&
                                            Object.keys(createOrderResponse)
                                                .length == 0 &&
                                            Object.keys(getInfoData).length >
                                                0 &&
                                            info && (
                                                <View
                                                    style={{ marginBottom: 20 }}
                                                >
                                                    <Text
                                                        style={{
                                                            fontSize: 16,
                                                            color: themeColor(
                                                                'text'
                                                            ),
                                                            fontFamily:
                                                                'PPNeueMontreal-Book',
                                                            marginBottom: 10
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.LSPS1.serviceInfoText1'
                                                        )}
                                                    </Text>
                                                    {flowServiceAvailable && (
                                                        <>
                                                            <Text
                                                                style={{
                                                                    fontSize: 16,
                                                                    color: themeColor(
                                                                        'text'
                                                                    ),
                                                                    fontFamily:
                                                                        'PPNeueMontreal-Book',
                                                                    marginBottom: 10
                                                                }}
                                                            >
                                                                {localeString(
                                                                    'views.LSPS1.serviceInfoText2'
                                                                )}
                                                            </Text>

                                                            <View
                                                                style={{
                                                                    marginTop: 10,
                                                                    marginBottom: 20
                                                                }}
                                                            >
                                                                <Button
                                                                    title={localeString(
                                                                        'views.LSPS1.useJit'
                                                                    )}
                                                                    onPress={() => {
                                                                        navigation.navigate(
                                                                            'Receive'
                                                                        );
                                                                    }}
                                                                />
                                                            </View>
                                                        </>
                                                    )}

                                                    <KeyValue
                                                        keyValue="LSP"
                                                        value={lspDisplay}
                                                    />

                                                    {info?.max_channel_balance_sat &&
                                                        info?.min_channel_balance_sat && (
                                                            <KeyValue
                                                                keyValue={`${localeString(
                                                                    'views.Channel.channelBalance'
                                                                )}`}
                                                                value={`${numberWithCommas(
                                                                    info?.min_channel_balance_sat
                                                                )} - ${numberWithCommas(
                                                                    info?.max_channel_balance_sat
                                                                )} ${localeString(
                                                                    'general.sats'
                                                                )}`}
                                                            />
                                                        )}
                                                    {info?.max_initial_lsp_balance_sat &&
                                                        info?.min_initial_lsp_balance_sat && (
                                                            <KeyValue
                                                                keyValue={`${localeString(
                                                                    'views.LSPS1.initialLSPBalance'
                                                                )}`}
                                                                value={`${numberWithCommas(
                                                                    info?.min_initial_lsp_balance_sat
                                                                )} - ${numberWithCommas(
                                                                    info?.max_initial_lsp_balance_sat
                                                                )} ${localeString(
                                                                    'general.sats'
                                                                )}`}
                                                            />
                                                        )}
                                                    {info?.max_initial_client_balance_sat &&
                                                        info?.min_initial_client_balance_sat && (
                                                            <KeyValue
                                                                keyValue={`${localeString(
                                                                    'views.LSPS1.initialClientBalance'
                                                                )}`}
                                                                value={
                                                                    info?.max_initial_client_balance_sat ===
                                                                    info?.min_initial_client_balance_sat
                                                                        ? `${
                                                                              info?.min_initial_client_balance_sat
                                                                          } ${localeString(
                                                                              'general.sats'
                                                                          )}`
                                                                        : `${
                                                                              info?.min_initial_client_balance_sat
                                                                          } - ${
                                                                              info?.max_initial_client_balance_sat
                                                                          } ${localeString(
                                                                              'general.sats'
                                                                          )}`
                                                                }
                                                            />
                                                        )}
                                                    {info?.max_channel_expiry_blocks && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.maxChannelExpiryBlocks'
                                                            )}
                                                            value={numberWithCommas(
                                                                info?.max_channel_expiry_blocks
                                                            )}
                                                        />
                                                    )}
                                                    {info?.min_channel_confirmations && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.minChannelConfirmations'
                                                            )}
                                                            value={
                                                                info?.min_channel_confirmations
                                                            }
                                                        />
                                                    )}
                                                    {info?.min_onchain_payment_confirmations && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.minOnchainPaymentConfirmations'
                                                            )}
                                                            value={
                                                                info?.min_onchain_payment_confirmations
                                                            }
                                                        />
                                                    )}
                                                    {info?.min_onchain_payment_size_sat && (
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.LSPS1.minOnchainPaymentSize'
                                                            )} (${localeString(
                                                                'general.sats'
                                                            )})`}
                                                            value={
                                                                info?.min_onchain_payment_size_sat
                                                            }
                                                        />
                                                    )}
                                                    {info?.min_funding_confirms_within_blocks && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.minFundingConfirmWithingBlocks'
                                                            )}
                                                            value={
                                                                info?.min_funding_confirms_within_blocks
                                                            }
                                                        />
                                                    )}
                                                    {info?.min_required_channel_confirmations && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.minRequiredChannelConfirmations'
                                                            )}
                                                            value={
                                                                info?.min_required_channel_confirmations
                                                            }
                                                        />
                                                    )}
                                                    {info?.supports_zero_channel_reserve !==
                                                        null && (
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'views.LSPS1.supportZeroChannelReserve'
                                                            )}
                                                            value={
                                                                info?.supports_zero_channel_reserve
                                                                    ? 'True'
                                                                    : 'False'
                                                            }
                                                            color={
                                                                info?.supports_zero_channel_reserve
                                                                    ? 'green'
                                                                    : '#808000'
                                                            }
                                                        />
                                                    )}
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'views.LSPS1.spec'
                                                        )}
                                                        value="LSPS1"
                                                    />
                                                </View>
                                            )}
                                    </>
                                    <Text
                                        style={{
                                            color: themeColor('secondaryText')
                                        }}
                                    >
                                        {`${localeString(
                                            'views.LSPS1.initialLSPBalance'
                                        )} (${localeString('general.sats')})`}
                                    </Text>
                                    <TextInput
                                        placeholder={`${localeString(
                                            'views.LSPS1.initialLSPBalance'
                                        )} (${localeString('general.sats')})`}
                                        value={numberWithCommas(lspBalanceSat)}
                                        onChangeText={(text: any) => {
                                            const value = text.replace(
                                                /,/g,
                                                ''
                                            );
                                            this.setState({
                                                lspBalanceSat: value
                                            });
                                        }}
                                        keyboardType="numeric"
                                    />
                                    <Row
                                        justify="space-between"
                                        style={{ marginVertical: 10 }}
                                    >
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {numberWithCommas(
                                                info?.min_initial_lsp_balance_sat
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {numberWithCommas(
                                                info?.max_initial_lsp_balance_sat
                                            )}
                                        </Text>
                                    </Row>
                                    <Slider
                                        style={{
                                            width: '100%',
                                            height: 40,
                                            marginBottom: 10
                                        }}
                                        minimumValue={parseInt(
                                            info?.min_initial_lsp_balance_sat
                                        )}
                                        maximumValue={parseInt(
                                            info?.max_initial_lsp_balance_sat
                                        )}
                                        minimumTrackTintColor={themeColor(
                                            'highlight'
                                        )}
                                        maximumTrackTintColor="black"
                                        thumbTintColor={themeColor('highlight')}
                                        value={parseInt(
                                            lspBalanceSat.toString()
                                        )}
                                        onValueChange={(value: number) =>
                                            this.setState({
                                                lspBalanceSat: value
                                            })
                                        }
                                        step={10000}
                                    />

                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.LSPS1.channelExpiryBlocks'
                                            )}
                                        </Text>
                                        <TextInput
                                            placeholder={localeString(
                                                'views.LSPS1.channelExpiryBlocks'
                                            )}
                                            value={numberWithCommas(
                                                channelExpiryBlocks
                                            )}
                                            onChangeText={(text: any) => {
                                                let newValue: string | number =
                                                    parseInt(
                                                        text.replace(/,/g, ''),
                                                        10
                                                    );
                                                if (isNaN(newValue)) {
                                                    newValue = '';
                                                }

                                                let expirationIndex = 5;
                                                if (newValue === 4380) {
                                                    expirationIndex = 0;
                                                } else if (newValue === 13140) {
                                                    expirationIndex = 1;
                                                } else if (newValue === 26280) {
                                                    expirationIndex = 2;
                                                } else if (newValue === 52560) {
                                                    expirationIndex = 3;
                                                }

                                                this.setState({
                                                    channelExpiryBlocks:
                                                        newValue,
                                                    expirationIndex
                                                });
                                            }}
                                            style={styles.textInput}
                                            keyboardType="numeric"
                                        />
                                        <View style={{ marginBottom: 10 }}>
                                            <ButtonGroup
                                                onPress={
                                                    this.updateExpirationIndex
                                                }
                                                selectedIndex={expirationIndex}
                                                buttons={expirationButtons}
                                                selectedButtonStyle={{
                                                    backgroundColor:
                                                        themeColor('highlight'),
                                                    borderRadius: 12
                                                }}
                                                containerStyle={{
                                                    backgroundColor:
                                                        themeColor('secondary'),
                                                    borderRadius: 12,
                                                    borderWidth: 0,
                                                    height: 30
                                                }}
                                                innerBorderStyle={{
                                                    color: themeColor(
                                                        'secondary'
                                                    )
                                                }}
                                            />
                                        </View>
                                    </>
                                    {Object.keys(getInfoData).length > 0 && (
                                        <TouchableOpacity
                                            onPress={() => {
                                                this.setState({
                                                    advancedSettings:
                                                        !advancedSettings
                                                });
                                            }}
                                        >
                                            <View
                                                style={{
                                                    marginBottom: 10
                                                }}
                                            >
                                                <Row justify="space-between">
                                                    <View
                                                        style={{ width: '95%' }}
                                                    >
                                                        <KeyValue
                                                            keyValue={localeString(
                                                                'general.advancedSettings'
                                                            )}
                                                        />
                                                    </View>
                                                    {advancedSettings ? (
                                                        <CaretDown
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    ) : (
                                                        <CaretRight
                                                            fill={themeColor(
                                                                'text'
                                                            )}
                                                            width="20"
                                                            height="20"
                                                        />
                                                    )}
                                                </Row>
                                            </View>
                                        </TouchableOpacity>
                                    )}

                                    {advancedSettings && (
                                        <>
                                            {info?.max_initial_client_balance_sat !==
                                                '0' && (
                                                <>
                                                    <Text
                                                        style={{
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {`${localeString(
                                                            'views.LSPS1.initialClientBalance'
                                                        )} (${localeString(
                                                            'general.sats'
                                                        )})`}
                                                    </Text>
                                                    <TextInput
                                                        placeholder={`${localeString(
                                                            'views.LSPS1.clientBalance'
                                                        )} (${localeString(
                                                            'general.sats'
                                                        )})`}
                                                        value={numberWithCommas(
                                                            clientBalanceSat
                                                        ).toString()}
                                                        onChangeText={(
                                                            text: any
                                                        ) => {
                                                            const value =
                                                                text.replace(
                                                                    /,/g,
                                                                    ''
                                                                );
                                                            this.setState({
                                                                clientBalanceSat:
                                                                    value
                                                            });
                                                        }}
                                                        keyboardType="numeric"
                                                    />
                                                    <Row
                                                        justify="space-between"
                                                        style={{
                                                            marginVertical: 10
                                                        }}
                                                    >
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {numberWithCommas(
                                                                info?.min_initial_client_balance_sat
                                                            )}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {numberWithCommas(
                                                                info?.max_initial_client_balance_sat
                                                            )}
                                                        </Text>
                                                    </Row>
                                                    <Slider
                                                        style={{
                                                            width: '100%',
                                                            height: 40
                                                        }}
                                                        minimumValue={parseInt(
                                                            info?.min_initial_client_balance_sat
                                                        )}
                                                        maximumValue={parseInt(
                                                            info?.max_initial_client_balance_sat
                                                        )}
                                                        minimumTrackTintColor={themeColor(
                                                            'highlight'
                                                        )}
                                                        maximumTrackTintColor="black"
                                                        thumbTintColor={themeColor(
                                                            'highlight'
                                                        )}
                                                        value={parseInt(
                                                            clientBalanceSat.toString()
                                                        )}
                                                        onValueChange={(
                                                            value: number
                                                        ) =>
                                                            this.setState({
                                                                clientBalanceSat:
                                                                    value
                                                            })
                                                        }
                                                        step={10000}
                                                    />
                                                </>
                                            )}
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    ),
                                                    marginTop: 10
                                                }}
                                            >
                                                {localeString(
                                                    'views.LSPS1.requiredChannelConfirmations'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={localeString(
                                                    'views.LSPS1.requiredChannelConfirmations'
                                                )}
                                                value={
                                                    this.state
                                                        .requiredChannelConfirmations
                                                }
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        requiredChannelConfirmations:
                                                            text
                                                    })
                                                }
                                                style={styles.textInput}
                                                keyboardType="numeric"
                                            />

                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.LSPS1.confirmWithinBlocks'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={localeString(
                                                    'views.LSPS1.confirmWithinBlocks'
                                                )}
                                                value={
                                                    this.state
                                                        .confirmsWithinBlocks
                                                }
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        confirmsWithinBlocks:
                                                            text
                                                    })
                                                }
                                                style={styles.textInput}
                                                keyboardType="numeric"
                                            />
                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'general.discountCode'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={localeString(
                                                    'general.discountCode'
                                                )}
                                                value={this.state.token}
                                                onChangeText={(text: string) =>
                                                    this.setState({
                                                        token: text
                                                    })
                                                }
                                                style={styles.textInput}
                                                autoCapitalize="none"
                                            />

                                            {info?.min_onchain_payment_confirmations && (
                                                <>
                                                    <Text
                                                        style={{
                                                            color: themeColor(
                                                                'secondaryText'
                                                            )
                                                        }}
                                                    >
                                                        {localeString(
                                                            'views.LSPS1.refundOnchainAddress'
                                                        )}
                                                    </Text>
                                                    <TextInput
                                                        placeholder={localeString(
                                                            'views.LSPS1.refundOnchainAddress'
                                                        )}
                                                        value={
                                                            this.state
                                                                .refundOnchainAddress
                                                        }
                                                        onChangeText={(
                                                            text: string
                                                        ) =>
                                                            this.setState({
                                                                refundOnchainAddress:
                                                                    text
                                                            })
                                                        }
                                                        style={styles.textInput}
                                                    />
                                                </>
                                            )}
                                            <View
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent:
                                                        'space-between',
                                                    alignItems: 'center',
                                                    marginVertical: 10
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        fontSize: 16,
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
                                                    value={
                                                        this.state
                                                            .announceChannel
                                                    }
                                                    onValueChange={async () => {
                                                        this.setState({
                                                            announceChannel:
                                                                !this.state
                                                                    .announceChannel
                                                        });
                                                    }}
                                                />
                                            </View>
                                        </>
                                    )}
                                </ScrollView>
                            )}
                        </ScrollView>
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title={
                                    Object.keys(createOrderResponse).length == 0
                                        ? `${localeString(
                                              'views.LSPS1.createOrder'
                                          )}`
                                        : `${localeString(
                                              'views.LSPS1.makePayment'
                                          )}`
                                }
                                onPress={() => {
                                    if (
                                        Object.keys(createOrderResponse)
                                            .length === 0
                                    ) {
                                        if (BackendUtils.supportsLSPS1rest()) {
                                            LSPStore.createOrderREST(
                                                this.state
                                            );
                                        } else {
                                            this.lsps1_createorder();
                                        }
                                    } else {
                                        const orderId = result.order_id;

                                        // Retrieve existing responses from encrypted storage or initialize an empty array
                                        EncryptedStorage.getItem(
                                            'orderResponses'
                                        )
                                            .then((responseArrayString) => {
                                                let responseArray = [];
                                                if (responseArrayString) {
                                                    responseArray =
                                                        JSON.parse(
                                                            responseArrayString
                                                        );
                                                }

                                                // Check if the order_id already exists in the stored responses
                                                const existingResponseIndex =
                                                    responseArray.findIndex(
                                                        (response: any) => {
                                                            const currentOrderId =
                                                                JSON.parse(
                                                                    response
                                                                ).order
                                                                    ?.order_id ||
                                                                JSON.parse(
                                                                    response
                                                                ).order?.result
                                                                    ?.order_id;
                                                            return (
                                                                currentOrderId ===
                                                                orderId
                                                            );
                                                        }
                                                    );

                                                if (
                                                    existingResponseIndex === -1
                                                ) {
                                                    const orderData:
                                                        | Order
                                                        | any = {
                                                        order: createOrderResponse
                                                    };

                                                    orderData.clientPubkey =
                                                        this.props.NodeInfoStore.nodeInfo.nodeId;

                                                    if (
                                                        BackendUtils.supportsLSPS1customMessage()
                                                    ) {
                                                        orderData.peer =
                                                            LSPStore.getLSPS1Pubkey();
                                                        orderData.uri = `${LSPStore.getLSPS1Pubkey()}@${LSPStore.getLSPS1Host()}`;
                                                    }
                                                    if (
                                                        BackendUtils.supportsLSPS1rest()
                                                    ) {
                                                        orderData.endpoint =
                                                            LSPStore.getLSPS1Rest();
                                                    }

                                                    console.log(orderData);

                                                    // Serialize the orderData object into a JSON string
                                                    const serializedResponse =
                                                        JSON.stringify(
                                                            orderData
                                                        );

                                                    // Append the serialized response to the array
                                                    responseArray.push(
                                                        serializedResponse
                                                    );

                                                    // Save the updated array back to encrypted storage
                                                    EncryptedStorage.setItem(
                                                        'orderResponses',
                                                        JSON.stringify(
                                                            responseArray
                                                        )
                                                    )
                                                        .then(() => {
                                                            console.log(
                                                                'Response saved successfully.'
                                                            );
                                                        })
                                                        .catch((error) =>
                                                            console.error(
                                                                'Error saving order response:',
                                                                error
                                                            )
                                                        );
                                                } else {
                                                    console.log(
                                                        'Response with same order_id already exists. Skipping save.'
                                                    );
                                                }

                                                // Navigate to the PaymentRequest screen
                                                InvoicesStore.getPayReq(
                                                    payment.bolt11?.invoice ||
                                                        payment.lightning_invoice ||
                                                        payment.bolt11_invoice
                                                )
                                                    .then(() => {
                                                        navigation.navigate(
                                                            'PaymentRequest',
                                                            {}
                                                        );
                                                    })
                                                    .catch((error: any) =>
                                                        console.error(
                                                            'Error fetching payment request:',
                                                            error
                                                        )
                                                    );
                                            })
                                            .catch((error) =>
                                                console.error(
                                                    'Error retrieving order responses:',
                                                    error
                                                )
                                            );
                                    }
                                }}
                                containerStyle={{ paddingBottom: 10 }}
                                secondary
                            />
                        </View>
                    </>
                )}

                {!LSPStore.loading &&
                    LSPStore.error &&
                    LSPStore.error_msg ===
                        localeString('views.LSPS1.timeoutError') && (
                        <View
                            style={{
                                position: 'absolute',
                                width: '100%',
                                bottom: 0
                            }}
                        >
                            <Button
                                title="Retry"
                                onPress={async () => {
                                    if (BackendUtils.supportsLSPS1rest()) {
                                        LSPStore.getInfoREST();
                                    } else {
                                        await this.connectPeer();
                                        await this.subscribeToCustomMessages();
                                        this.sendCustomMessage_lsps1();
                                    }
                                }}
                            />

                            <Button
                                onPress={() => {
                                    this.props.navigation.navigate(
                                        'LSPS1Settings'
                                    );
                                }}
                                title={localeString('views.LSPS1.goToSettings')}
                                containerStyle={{ paddingVertical: 20 }}
                                secondary
                            />
                        </View>
                    )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    textInput: {
        marginBottom: 25
    }
});
