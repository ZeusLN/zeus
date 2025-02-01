import * as React from 'react';
import moment from 'moment';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { View, FlatList, TouchableOpacity, Text } from 'react-native';

import Header from '../../../components/Header';
import Screen from '../../../components/Screen';
import Amount from '../../../components/Amount';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { themeColor } from '../../../utils/ThemeUtils';
import { localeString } from '../../../utils/LocaleUtils';
import BackendUtils from '../../../utils/BackendUtils';

import Storage from '../../../storage';

import LSPStore, { LSPS1_ORDERS_KEY } from '../../../stores/LSPStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';

import { WarningMessage } from '../../../components/SuccessErrorMessage';

interface OrdersPaneProps {
    navigation: StackNavigationProp<any, any>;
    LSPStore: LSPStore;
    NodeInfoStore: NodeInfoStore;
}

interface OrdersPaneState {
    orders: any[];
    isLoading: boolean;
}

interface Bolt11 {
    order_total_sat: string;
    fee_total_sat: string;
    invoice: string;
    expires_at: string;
    state: string;
}

interface Payment {
    bolt11: Bolt11;
}

export interface Order {
    announce_channel: boolean;
    channel?: string;
    channel_expiry_blocks: number;
    required_channel_confirmations: number;
    funding_confirms_within_blocks: number;
    created_at: string;
    lsp_balance_sat: string;
    client_balance_sat: string;
    order_id: string;
    order_state: string;
    payment: Payment;
    token: string;
    result?: Order | any;
}

export interface LSPS1OrderResponse {
    order: Order;
    clientPubkey: string;
    endpoint: string;
    uri?: string;
    peer?: string;
}

@inject('LSPStore', 'NodeInfoStore')
@observer
export default class OrdersPane extends React.Component<
    OrdersPaneProps,
    OrdersPaneState
> {
    constructor(props: OrdersPaneProps) {
        super(props);
        this.state = {
            orders: [],
            isLoading: true
        };
    }

    async componentDidMount() {
        const { navigation, LSPStore } = this.props;
        navigation.addListener('focus', async () => {
            try {
                // Retrieve saved responses from encrypted storage
                const responseArrayString = await Storage.getItem(
                    LSPS1_ORDERS_KEY
                );
                if (responseArrayString) {
                    const responseArray = JSON.parse(responseArrayString);

                    if (responseArray.length === 0) {
                        console.log('No orders found!');
                        this.setState({ isLoading: false });
                        LSPStore.error = true;
                        LSPStore.error_msg = localeString(
                            'views.LSPS1.noOrdersError'
                        );
                        return;
                    }

                    const decodedResponses = responseArray.map(
                        (response: any) => JSON.parse(response)
                    );

                    let selectedOrders;
                    if (BackendUtils.supportsLSPS1customMessage()) {
                        selectedOrders = decodedResponses.filter(
                            (response: LSPS1OrderResponse) =>
                                response?.uri &&
                                response.clientPubkey ===
                                    this.props.NodeInfoStore.nodeInfo.nodeId
                        );
                    } else if (BackendUtils.supportsLSPS1rest()) {
                        selectedOrders = decodedResponses.filter(
                            (response: LSPS1OrderResponse) =>
                                response?.endpoint &&
                                response.clientPubkey ===
                                    this.props.NodeInfoStore.nodeInfo.nodeId
                        );
                    }

                    const orders = selectedOrders.map(
                        (response: LSPS1OrderResponse) => {
                            const order =
                                response?.order?.result || response?.order;
                            return {
                                orderId: order?.order_id,
                                state: order?.order_state,
                                createdAt: order?.created_at,
                                fundedAt: order?.channel?.funded_at,
                                lspBalanceSat: order?.lsp_balance_sat
                            };
                        }
                    );

                    const reversedOrders = orders.reverse();

                    this.setState({
                        orders: reversedOrders,
                        isLoading: false
                    });
                    LSPStore.error = false;
                    LSPStore.error_msg = '';
                } else {
                    this.setState({ isLoading: false });
                    LSPStore.error = true;
                    LSPStore.error_msg = localeString(
                        'views.LSPS1.noOrdersError'
                    );
                }
            } catch (error) {
                this.setState({ isLoading: false });
                LSPStore.error = true;
                LSPStore.error_msg = `An error occurred while retrieving orders: ${error}`;
            }
        });
    }

    renderSeparator = () => (
        <View
            style={{
                height: 0.4,
                backgroundColor: themeColor('separator')
            }}
        />
    );

    renderItem = ({ item }: { item: any }) => {
        let stateColor;
        switch (item.state) {
            case 'CREATED':
                stateColor = 'orange';
                break;
            case 'FAILED':
                stateColor = 'red';
                break;
            case 'COMPLETED':
                stateColor = 'green';
                break;
            default:
                stateColor = themeColor('text');
                break;
        }

        return (
            <TouchableOpacity
                onPress={() =>
                    this.props.navigation.navigate('LSPS1Order', {
                        orderId: item.orderId,
                        orderShouldUpdate:
                            item?.state === 'FAILED' ||
                            item?.state === 'COMPLETED'
                    })
                }
                style={{
                    padding: 15
                }}
            >
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {localeString('views.LSPS1.lspBalance')}
                    </Text>
                    <Amount sats={item.lspBalanceSat} sensitive toggleable />
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {localeString('general.state')}
                    </Text>
                    <Text style={{ color: stateColor, fontSize: 16 }}>
                        {item.state}
                    </Text>
                </View>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: 5
                    }}
                >
                    <Text style={{ color: themeColor('text'), fontSize: 16 }}>
                        {localeString('general.createdAt')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('secondaryText'),
                            fontSize: 16
                        }}
                    >
                        {moment(item.createdAt).format(
                            'MMM Do YYYY, h:mm:ss a'
                        )}
                    </Text>
                </View>
                {item.fundedAt && (
                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between'
                        }}
                    >
                        <Text
                            style={{ color: themeColor('text'), fontSize: 16 }}
                        >
                            {localeString('views.LSPS1.fundedAt')}
                        </Text>
                        <Text
                            style={{
                                color: themeColor('secondaryText'),
                                fontSize: 16
                            }}
                        >
                            {moment(item.fundedAt).format(
                                'MMM Do YYYY, h:mm:ss a'
                            )}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    render() {
        const { navigation, LSPStore } = this.props;
        const { orders, isLoading } = this.state;

        return (
            <Screen>
                {isLoading ? (
                    <View style={{ marginTop: 50 }}>
                        <LoadingIndicator />
                    </View>
                ) : LSPStore.error && LSPStore.error_msg ? (
                    <>
                        <Header
                            leftComponent="Back"
                            onBack={() => {
                                LSPStore.error = false;
                                LSPStore.error_msg = '';
                            }}
                            navigation={navigation}
                        />
                        <WarningMessage message={LSPStore.error_msg} />
                    </>
                ) : (
                    <>
                        <Header
                            leftComponent="Back"
                            centerComponent={{
                                text: `${localeString(
                                    'views.LSPS1.lsps1Orders'
                                )} (${orders.length})`,
                                style: {
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book'
                                }
                            }}
                            navigation={navigation}
                        />
                        <FlatList
                            data={orders}
                            renderItem={this.renderItem}
                            keyExtractor={(item) => item?.orderId?.toString()}
                            ItemSeparatorComponent={this.renderSeparator}
                        />
                    </>
                )}
            </Screen>
        );
    }
}
