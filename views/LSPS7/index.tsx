import * as React from 'react';
import { inject, observer } from 'mobx-react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ButtonGroup, Icon } from 'react-native-elements';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import OrderList from '../../assets/images/SVG/order-list.svg';
import OlympusSVG from '../../assets/images/SVG/Olympus.svg';

import Button from '../../components/Button';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import LSPS7OrderResponse from './OrderResponse';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';

import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import BackendUtils from '../../utils/BackendUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';

import LSPStore, { LSPS_ORDERS_KEY } from '../../stores/LSPStore';
import InvoicesStore from '../../stores/InvoicesStore';
import ChannelsStore from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import { LSPOrderResponse as Order } from '../LSPS1/OrdersPane';

import Storage from '../../storage';

interface LSPS7Props {
    LSPStore: LSPStore;
    InvoicesStore: InvoicesStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    NodeInfoStore: NodeInfoStore;
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'LSPS7',
        {
            chanId: string;
            maxExtensionInBlocks: number;
            expirationBlock: number;
        }
    >;
}

interface LSPS7State {
    channelExtensionBlocks: string | number;
    expirationIndex: number;
    token: any;
    refundOnchainAddress: any;
    showInfo: boolean;
    advancedSettings: boolean;
    chanId: string;
    maxExtensionInBlocks: number;
    expirationBlock: number;
}

@inject(
    'LSPStore',
    'ChannelsStore',
    'InvoicesStore',
    'SettingsStore',
    'NodeInfoStore'
)
@observer
export default class LSPS7 extends React.Component<LSPS7Props, LSPS7State> {
    listener: any;
    constructor(props: LSPS7Props) {
        super(props);

        const chanId = props?.route.params?.chanId;
        const maxExtensionInBlocks = props?.route.params?.maxExtensionInBlocks;
        const expirationBlock = props?.route.params?.expirationBlock;

        let expirationIndex = 4;
        if (maxExtensionInBlocks === 4380) {
            expirationIndex = 0;
        } else if (maxExtensionInBlocks === 13140) {
            expirationIndex = 1;
        } else if (maxExtensionInBlocks === 26280) {
            expirationIndex = 2;
        } else if (maxExtensionInBlocks === 52560) {
            expirationIndex = 3;
        }

        this.state = {
            channelExtensionBlocks: maxExtensionInBlocks,
            expirationIndex,
            token: props.SettingsStore.settings?.lsps1Token || '',
            refundOnchainAddress: '',
            showInfo: false,
            advancedSettings: false,
            chanId,
            maxExtensionInBlocks,
            expirationBlock
        };
    }

    async componentDidMount() {
        const { LSPStore, SettingsStore, navigation } = this.props;
        LSPStore.clearLSPS7Order();
        navigation.addListener('focus', () => {
            this.setState({
                token: SettingsStore.settings?.lsps1Token || ''
            });
        });
    }

    updateExpirationIndex = (expirationIndex: number) => {
        if (expirationIndex === 0) {
            this.setState({
                channelExtensionBlocks: 4380,
                expirationIndex: 0
            });
        } else if (expirationIndex === 1) {
            this.setState({
                channelExtensionBlocks: 13140,
                expirationIndex: 1
            });
        } else if (expirationIndex === 2) {
            this.setState({
                channelExtensionBlocks: 26280,
                expirationIndex: 2
            });
        } else if (expirationIndex === 3) {
            this.setState({
                channelExtensionBlocks: 52560,
                expirationIndex: 3
            });
        } else if (expirationIndex === 4) {
            this.setState({
                channelExtensionBlocks: this.state.maxExtensionInBlocks,
                expirationIndex: 4
            });
        }
    };

    render() {
        const { navigation, LSPStore, NodeInfoStore, InvoicesStore } =
            this.props;
        const {
            showInfo,
            advancedSettings,
            channelExtensionBlocks,
            expirationIndex,
            chanId,
            maxExtensionInBlocks,
            expirationBlock
        } = this.state;
        const { createExtensionOrderResponse } = LSPStore;
        const { nodeInfo } = NodeInfoStore;
        const result =
            createExtensionOrderResponse?.result ||
            createExtensionOrderResponse;
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
        const maxButton = () => (
            <Text
                style={{
                    fontFamily: 'PPNeueMontreal-Book',
                    color:
                        expirationIndex === 4
                            ? themeColor('background')
                            : themeColor('text')
                }}
            >
                {localeString('time.max')}
            </Text>
        );

        const expirationButtons: any = [
            { element: oneMoButton },
            { element: threeMoButton },
            { element: sixMoButton },
            { element: twelveMoButton },
            { element: maxButton }
        ];

        const isOlympus = LSPStore.isOlympus();

        const lspDisplay = isOlympus
            ? 'Olympus by ZEUS'
            : LSPStore.getLSPSPubkey();

        const proposedNewExpirationBlock = numberWithCommas(
            new BigNumber(
                new BigNumber(nodeInfo.currentBlockHeight).gt(expirationBlock)
                    ? nodeInfo.currentBlockHeight
                    : expirationBlock
            )
                .plus(channelExtensionBlocks)
                .toNumber()
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    navigation={navigation}
                    rightComponent={
                        <Row>
                            <SettingsBtn />
                            {!LSPStore.loadingLSPS7 && !LSPStore.error && (
                                <OrderlistBtn />
                            )}
                        </Row>
                    }
                    onBack={() => LSPStore.resetLSPS7Data()}
                />
                <View style={{ paddingHorizontal: 18 }}>
                    {BackendUtils.supportsLSPScustomMessage() &&
                        !LSPStore.getLSPSPubkey() &&
                        !LSPStore.getLSPSHost() && (
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
                {LSPStore.loadingLSPS7 ? (
                    <LoadingIndicator />
                ) : (LSPStore?.error && LSPStore?.error_msg) ===
                  localeString('views.LSPS1.timeoutError') ? (
                    <ErrorMessage message={LSPStore.error_msg} />
                ) : (
                    <>
                        <ScrollView style={{ flex: 1 }}>
                            {createExtensionOrderResponse &&
                                Object.keys(createExtensionOrderResponse)
                                    .length > 0 &&
                                result &&
                                payment && (
                                    <LSPS7OrderResponse
                                        orderResponse={result}
                                        orderView={false}
                                        navigation={navigation}
                                    />
                                )}

                            {Object.keys(createExtensionOrderResponse).length ==
                                0 && (
                                <ScrollView
                                    style={{
                                        flex: 1,
                                        marginTop: 10,
                                        paddingHorizontal: 22
                                    }}
                                >
                                    <>
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

                                        {showInfo && (
                                            <View style={{ marginBottom: 20 }}>
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
                                                        'views.LSPS7.serviceInfoText1'
                                                    )}
                                                </Text>

                                                <KeyValue
                                                    keyValue="LSP"
                                                    value={lspDisplay}
                                                />

                                                <KeyValue
                                                    keyValue={localeString(
                                                        'views.LSPS1.spec'
                                                    )}
                                                    value="LSPS7"
                                                />
                                            </View>
                                        )}
                                    </>

                                    <View
                                        style={{
                                            marginBottom: 10
                                        }}
                                    >
                                        <KeyValue
                                            keyValue={localeString(
                                                'views.Channel.scid'
                                            )}
                                            value={chanId}
                                        />

                                        <KeyValue
                                            keyValue={localeString(
                                                'views.Sync.currentBlockHeight'
                                            )}
                                            value={numberWithCommas(
                                                nodeInfo.currentBlockHeight
                                            )}
                                        />

                                        <KeyValue
                                            keyValue={localeString(
                                                'views.LSPS7.expirationBlock'
                                            )}
                                            value={numberWithCommas(
                                                expirationBlock
                                            )}
                                        />

                                        <KeyValue
                                            keyValue={localeString(
                                                'views.LSPS7.proposedExpirationBlock'
                                            )}
                                            value={
                                                proposedNewExpirationBlock ===
                                                'NaN'
                                                    ? localeString(
                                                          'general.invalid'
                                                      )
                                                    : proposedNewExpirationBlock
                                            }
                                        />
                                    </View>

                                    <>
                                        <Text
                                            style={{
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.LSPS7.channelExtensionBlocks'
                                            )}
                                        </Text>
                                        <TextInput
                                            value={numberWithCommas(
                                                channelExtensionBlocks
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
                                                } else if (
                                                    newValue ===
                                                    maxExtensionInBlocks
                                                ) {
                                                    expirationIndex = 4;
                                                }

                                                this.setState({
                                                    channelExtensionBlocks:
                                                        newValue,
                                                    expirationIndex
                                                });
                                            }}
                                            error={new BigNumber(
                                                channelExtensionBlocks
                                            ).gt(maxExtensionInBlocks)}
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
                                                <View style={{ width: '95%' }}>
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

                                    {advancedSettings && (
                                        <>
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

                                            {/*
                                                TODO add conditions for refund onchain address
                                                */}
                                            {false && (
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
                                        </>
                                    )}
                                </ScrollView>
                            )}
                        </ScrollView>
                        <View style={{ marginTop: 10 }}>
                            <Button
                                title={
                                    Object.keys(createExtensionOrderResponse)
                                        .length == 0
                                        ? `${localeString(
                                              'views.LSPS1.createOrder'
                                          )}`
                                        : `${localeString(
                                              'views.LSPS1.makePayment'
                                          )}`
                                }
                                onPress={() => {
                                    if (
                                        Object.keys(
                                            createExtensionOrderResponse
                                        ).length === 0
                                    ) {
                                        LSPStore.lsps7CreateOrderCustomMessage(
                                            this.state
                                        );
                                    } else {
                                        const orderId = result.order_id;

                                        // Retrieve existing responses from encrypted storage or initialize an empty array
                                        Storage.getItem(LSPS_ORDERS_KEY)
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
                                                        order: createExtensionOrderResponse
                                                    };

                                                    orderData.clientPubkey =
                                                        nodeInfo?.nodeId;
                                                    orderData.peer =
                                                        LSPStore.getLSPSPubkey();
                                                    orderData.uri = `${LSPStore.getLSPSPubkey()}@${LSPStore.getLSPSHost()}`;
                                                    orderData.service = 'LSPS7';

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
                                                    Storage.setItem(
                                                        LSPS_ORDERS_KEY,
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
                                disabled={new BigNumber(
                                    channelExtensionBlocks
                                ).gt(maxExtensionInBlocks)}
                                containerStyle={{ paddingBottom: 10 }}
                                secondary
                            />
                        </View>
                    </>
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
