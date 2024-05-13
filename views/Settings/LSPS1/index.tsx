import * as React from 'react';
import { inject, observer } from 'mobx-react';
import {
    NativeEventEmitter,
    NativeModules,
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity
} from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import Slider from '@react-native-community/slider';
import { v4 as uuidv4 } from 'uuid';

import CaretDown from '../../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../../assets/images/SVG/Caret Right.svg';
import OrderList from '../../../assets/images/SVG/order-list.svg';

import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import TextInput from '../../../components/TextInput';
import Button from '../../../components/Button';
import KeyValue from '../../../components/KeyValue';
import Switch from '../../../components/Switch';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import BackendUtils from '../../../utils/BackendUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';

import LSPStore from '../../../stores/LSPStore';
import InvoicesStore from '../../../stores/InvoicesStore';
import ChannelsStore from '../../../stores/ChannelsStore';
import SettingsStore from '../../../stores/SettingsStore';
import FiatStore from '../../../stores/FiatStore';
import { Icon } from 'react-native-elements';
import LoadingIndicator from '../../../components/LoadingIndicator';
import LSPS1OrderResponse from '../../../components/LSPS1OrderResponse';

interface LSPS1Props {
    LSPStore: LSPStore;
    InvoicesStore: InvoicesStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    FiatStore: FiatStore;
    navigation: any;
}

interface LSPS1State {
    lspBalanceSat: any;
    clientBalanceSat: any;
    requiredChannelConfirmations: any;
    confirmsWithinBlocks: any;
    channelExpiryBlocks: any;
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
    'FiatStore'
)
@observer
export default class LSPS1 extends React.Component<LSPS1Props, LSPS1State> {
    listener: any;
    constructor(props: LSPS1Props) {
        super(props);
        this.state = {
            lspBalanceSat: 0,
            clientBalanceSat: '0',
            requiredChannelConfirmations: '8',
            confirmsWithinBlocks: '6',
            channelExpiryBlocks: 0,
            token: '',
            refundOnchainAddress: '',
            showInfo: false,
            advancedSettings: false,
            announceChannel: false
        };
    }

    encodeMesage = (n: any) => Buffer.from(JSON.stringify(n)).toString('hex');

    async componentDidMount() {
        const { LSPStore } = this.props;
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
                lsp_balance_sat: this.state.lspBalanceSat,
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

    render() {
        const { navigation, LSPStore, InvoicesStore, FiatStore } = this.props;
        const {
            showInfo,
            advancedSettings,
            lspBalanceSat,
            clientBalanceSat,
            channelExpiryBlocks
        } = this.state;
        const { getInfoData, createOrderResponse } = LSPStore;
        const options = getInfoData?.result?.options || getInfoData?.options;
        const result = createOrderResponse?.result || createOrderResponse;
        const payment = result?.payment;

        const OrderlistBtn = () => (
            <TouchableOpacity
                style={{ marginTop: -10 }}
                onPress={() => {
                    navigation.navigate('OrdersPane');
                    // EncryptedStorage.setItem(
                    //     'orderResponses',
                    //     JSON.stringify([])
                    // );
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

        if (lspBalanceSat === 0 && options?.min_initial_lsp_balance_sat) {
            this.setState({
                lspBalanceSat: parseInt(options.min_initial_lsp_balance_sat)
            });
        }
        if (
            clientBalanceSat === 0 &&
            options?.min_initial_client_balance_sat > 0
        ) {
            this.setState({
                clientBalanceSat: parseInt(
                    options.min_initial_client_balance_sat
                )
            });
        }

        if (channelExpiryBlocks === 0 && options?.max_channel_expiry_blocks) {
            this.setState({
                channelExpiryBlocks: parseInt(options.max_channel_expiry_blocks)
            });
        }

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
                                        value={FiatStore.numberWithCommas(
                                            lspBalanceSat
                                        )}
                                        onChangeText={(text: any) => {
                                            const intValue = parseInt(
                                                text.replace(/,/g, ''),
                                                10
                                            );
                                            if (isNaN(intValue)) return;
                                            this.setState({
                                                lspBalanceSat: intValue
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
                                            {FiatStore.numberWithCommas(
                                                options?.min_initial_lsp_balance_sat
                                            )}
                                        </Text>
                                        <Text
                                            style={{
                                                color: themeColor('text')
                                            }}
                                        >
                                            {FiatStore.numberWithCommas(
                                                options?.max_initial_lsp_balance_sat
                                            )}
                                        </Text>
                                    </Row>
                                    <Slider
                                        style={{ width: '100%', height: 40 }}
                                        minimumValue={parseInt(
                                            options?.min_initial_lsp_balance_sat
                                        )}
                                        maximumValue={parseInt(
                                            options?.max_initial_lsp_balance_sat
                                        )}
                                        minimumTrackTintColor={themeColor(
                                            'highlight'
                                        )}
                                        maximumTrackTintColor="black"
                                        thumbTintColor={themeColor('highlight')}
                                        value={lspBalanceSat}
                                        onValueChange={(value: number) =>
                                            this.setState({
                                                lspBalanceSat: value
                                            })
                                        }
                                        step={10000}
                                    />

                                    {Object.keys(getInfoData).length > 0 && (
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
                                                        style={{ width: '95%' }}
                                                    >
                                                        <KeyValue keyValue="LSP info" />
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
                                        Object.keys(getInfoData).length > 0 &&
                                        options && (
                                            <>
                                                {options?.max_channel_balance_sat &&
                                                    options?.min_channel_balance_sat && (
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.Channel.channelBalance'
                                                            )} (${localeString(
                                                                'general.sats'
                                                            )})`}
                                                            value={`${FiatStore.numberWithCommas(
                                                                options?.min_channel_balance_sat
                                                            )} - ${FiatStore.numberWithCommas(
                                                                options?.max_channel_balance_sat
                                                            )}`}
                                                        />
                                                    )}
                                                {options?.max_initial_client_balance_sat !==
                                                    '0' &&
                                                    options?.min_initial_client_balance_sat !==
                                                        '0' && (
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.LSPS1.initialClientBalance'
                                                            )} (${localeString(
                                                                'general.sats'
                                                            )})`}
                                                            value={`${options?.min_initial_client_balance_sat} - ${options?.max_initial_client_balance_sat}`}
                                                        />
                                                    )}

                                                {options?.max_initial_lsp_balance_sat &&
                                                    options?.min_initial_lsp_balance_sat && (
                                                        <KeyValue
                                                            keyValue={`${localeString(
                                                                'views.LSPS1.initialLSPBalance'
                                                            )} (${localeString(
                                                                'general.sats'
                                                            )})`}
                                                            value={`${FiatStore.numberWithCommas(
                                                                options?.min_initial_lsp_balance_sat
                                                            )} - ${FiatStore.numberWithCommas(
                                                                options?.max_initial_lsp_balance_sat
                                                            )}`}
                                                        />
                                                    )}
                                                {options?.max_channel_expiry_blocks && (
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'views.LSPS1.maxChannelExpiryBlocks'
                                                        )}
                                                        value={FiatStore.numberWithCommas(
                                                            options?.max_channel_expiry_blocks
                                                        )}
                                                    />
                                                )}
                                                {options?.min_channel_confirmations && (
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'views.LSPS1.minChannelConfirmations'
                                                        )}
                                                        value={
                                                            options?.min_channel_confirmations
                                                        }
                                                    />
                                                )}
                                                {options?.min_onchain_payment_confirmations && (
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'views.LSPS1.minOnchainPaymentConfirmations'
                                                        )}
                                                        value={
                                                            options?.min_onchain_payment_confirmations
                                                        }
                                                    />
                                                )}
                                                {options?.min_onchain_payment_size_sat && (
                                                    <KeyValue
                                                        keyValue={`${localeString(
                                                            'views.LSPS1.minOnchainPaymentSize'
                                                        )} (${localeString(
                                                            'general.sats'
                                                        )})`}
                                                        value={
                                                            options?.min_onchain_payment_size_sat
                                                        }
                                                    />
                                                )}
                                                {options?.supports_zero_channel_reserve !==
                                                    null && (
                                                    <KeyValue
                                                        keyValue={localeString(
                                                            'views.LSPS1.supportZeroChannelReserve'
                                                        )}
                                                        value={
                                                            options?.supports_zero_channel_reserve
                                                                ? 'True'
                                                                : 'False'
                                                        }
                                                        color={
                                                            options?.supports_zero_channel_reserve
                                                                ? 'green'
                                                                : '#808000'
                                                        }
                                                    />
                                                )}
                                            </>
                                        )}

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
                                            {options?.max_initial_client_balance_sat !==
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
                                                        value={FiatStore.numberWithCommas(
                                                            clientBalanceSat
                                                        ).toString()}
                                                        onChangeText={(
                                                            text: any
                                                        ) => {
                                                            const intValue =
                                                                parseInt(text);
                                                            if (isNaN(intValue))
                                                                return;
                                                            this.setState({
                                                                clientBalanceSat:
                                                                    intValue
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
                                                            {FiatStore.numberWithCommas(
                                                                options?.min_initial_client_balance_sat
                                                            )}
                                                        </Text>
                                                        <Text
                                                            style={{
                                                                color: themeColor(
                                                                    'text'
                                                                )
                                                            }}
                                                        >
                                                            {FiatStore.numberWithCommas(
                                                                options?.max_initial_client_balance_sat
                                                            )}
                                                        </Text>
                                                    </Row>
                                                    <Slider
                                                        style={{
                                                            width: '100%',
                                                            height: 40
                                                        }}
                                                        minimumValue={parseInt(
                                                            options?.min_initial_client_balance_sat
                                                        )}
                                                        maximumValue={parseInt(
                                                            options?.max_initial_client_balance_sat
                                                        )}
                                                        minimumTrackTintColor={themeColor(
                                                            'highlight'
                                                        )}
                                                        maximumTrackTintColor="black"
                                                        thumbTintColor={themeColor(
                                                            'highlight'
                                                        )}
                                                        value={clientBalanceSat}
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
                                                onChangeText={(text) =>
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
                                                onChangeText={(text) =>
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
                                                    'views.LSPS1.channelExpiryBlocks'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder={localeString(
                                                    'views.LSPS1.channelExpiryBlocks'
                                                )}
                                                value={FiatStore.numberWithCommas(
                                                    channelExpiryBlocks
                                                )}
                                                onChangeText={(text: any) => {
                                                    const intValue = parseInt(
                                                        text.replace(/,/g, ''),
                                                        10
                                                    );
                                                    if (isNaN(intValue)) return;
                                                    this.setState({
                                                        channelExpiryBlocks:
                                                            intValue
                                                    });
                                                }}
                                                style={styles.textInput}
                                                keyboardType="numeric"
                                            />
                                            <Slider
                                                style={{
                                                    width: '100%',
                                                    height: 40
                                                }}
                                                minimumValue={0}
                                                maximumValue={parseInt(
                                                    options?.max_channel_expiry_blocks
                                                )}
                                                minimumTrackTintColor={themeColor(
                                                    'highlight'
                                                )}
                                                maximumTrackTintColor="black"
                                                thumbTintColor={themeColor(
                                                    'highlight'
                                                )}
                                                value={channelExpiryBlocks}
                                                onValueChange={(
                                                    value: number
                                                ) =>
                                                    this.setState({
                                                        channelExpiryBlocks:
                                                            value
                                                    })
                                                }
                                                step={10}
                                            />

                                            <Text
                                                style={{
                                                    color: themeColor(
                                                        'secondaryText'
                                                    )
                                                }}
                                            >
                                                {localeString(
                                                    'views.LSPS1.token'
                                                )}
                                            </Text>
                                            <TextInput
                                                placeholder="Token"
                                                value={this.state.token}
                                                onChangeText={(text) =>
                                                    this.setState({
                                                        token: text
                                                    })
                                                }
                                                style={styles.textInput}
                                            />

                                            {options?.min_onchain_payment_confirmations && (
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
                                                        onChangeText={(text) =>
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
                                              'views.LSPS1.getQuote'
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
                                                        (response) => {
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
                                                    const orderData = {
                                                        order: createOrderResponse
                                                    };

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
                                                    payment.lightning_invoice ||
                                                        payment.bolt11_invoice
                                                )
                                                    .then(() => {
                                                        navigation.navigate(
                                                            'PaymentRequest',
                                                            {}
                                                        );
                                                    })
                                                    .catch((error) =>
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
