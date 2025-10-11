import React from 'react';
import { View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { WarningMessage } from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import { themeColor } from '../../utils/ThemeUtils';
import { localeString } from '../../utils/LocaleUtils';

import LSPStore, { LSPS_ORDERS_KEY } from '../../stores/LSPStore';
import SettingsStore from '../../stores/SettingsStore';
import InvoicesStore from '../../stores/InvoicesStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import LSPS7OrderResponse from './OrderResponse';

import { Payment } from '../../views/LSPS1/OrdersPane';

import Storage from '../../storage';
import { LSPOrderState } from '../../models/LSP';

interface Order {
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

interface OrderProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'LSPS7Order', { orderId: string; orderShouldUpdate: boolean }>;
    LSPStore: LSPStore;
    SettingsStore: SettingsStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
}

interface OrdersState {
    loading: boolean;
    order: any;
    fetchOldOrder: boolean;
}

@inject('LSPStore', 'SettingsStore', 'InvoicesStore', 'NodeInfoStore')
@observer
export default class LSPS7Order extends React.Component<
    OrderProps,
    OrdersState
> {
    constructor(props: OrderProps) {
        super(props);
        this.state = {
            loading: true,
            order: null,
            fetchOldOrder: false
        };
    }

    async componentDidMount() {
        const { LSPStore, route } = this.props;
        let temporaryOrder: any;
        const id = route.params?.orderId;
        const orderShouldUpdate = route.params?.orderShouldUpdate;

        console.log('Looking for order in storage...');
        Storage.getItem(LSPS_ORDERS_KEY)
            .then((responseArrayString) => {
                if (responseArrayString) {
                    const responseArray = JSON.parse(responseArrayString);
                    const order = responseArray.find((response: any) => {
                        const decodedResponse = JSON.parse(response);
                        const result =
                            decodedResponse?.order?.result ||
                            decodedResponse?.order;
                        return result?.order_id === id;
                    });
                    if (order) {
                        const parsedOrder = JSON.parse(order);
                        temporaryOrder = parsedOrder;
                        console.log('Order found in storage->', temporaryOrder);

                        this.setState({
                            loading: false,
                            order: temporaryOrder?.order
                        });

                        LSPStore.lsps7GetOrderCustomMessage(
                            id,
                            temporaryOrder?.peer
                        );

                        setTimeout(() => {
                            if (LSPStore.error && LSPStore.error_msg !== '') {
                                this.setState({
                                    fetchOldOrder: true
                                });
                                LSPStore.loadingLSPS7 = false;
                                console.log('Old Order state fetched!');
                            } else if (
                                Object.keys(LSPStore.getExtensionOrderResponse)
                                    .length !== 0
                            ) {
                                const getExtensionOrderData =
                                    LSPStore.getExtensionOrderResponse;
                                this.setState({
                                    order: getExtensionOrderData,
                                    fetchOldOrder: false
                                });
                                console.log(
                                    'Latest Order state fetched!',
                                    this.state.order
                                );
                                LSPStore.loadingLSPS7 = false;
                                const result =
                                    getExtensionOrderData?.result ||
                                    getExtensionOrderData;
                                if (
                                    (result?.order_state ===
                                        LSPOrderState.COMPLETED ||
                                        result?.order_state ===
                                            LSPOrderState.FAILED) &&
                                    !orderShouldUpdate
                                ) {
                                    this.updateOrderInStorage(
                                        getExtensionOrderData
                                    );
                                }
                            }
                        }, 3000);
                    } else {
                        console.log('Order not found in encrypted storage.');
                    }
                } else {
                    console.log(
                        'No saved responses found in encrypted storage.'
                    );
                }
            })
            .catch((error) => {
                console.error(
                    'Error retrieving saved responses from encrypted storage:',
                    error
                );
            });
    }

    updateOrderInStorage(order: Order) {
        console.log('Updating order in encrypted storage...');
        Storage.getItem(LSPS_ORDERS_KEY)
            .then((responseArrayString) => {
                if (responseArrayString) {
                    let responseArray = JSON.parse(responseArrayString);
                    // Find the index of the order to be updated
                    const index = responseArray.findIndex((response: any) => {
                        const decodedResponse = JSON.parse(response);
                        const result =
                            decodedResponse?.order?.result ||
                            decodedResponse?.order;
                        const currentOrderResult = order?.result || order;
                        return result.order_id === currentOrderResult.order_id;
                    });
                    if (index !== -1) {
                        // Get the old order data
                        const oldOrder = JSON.parse(responseArray[index]);

                        // Replace the order property with the new order
                        oldOrder.order = order;

                        // Update the order in the array
                        responseArray[index] = JSON.stringify(oldOrder);

                        // Save the updated order array back to encrypted storage
                        Storage.setItem(
                            LSPS_ORDERS_KEY,
                            JSON.stringify(responseArray)
                        ).then(() => {
                            console.log('Order updated in encrypted storage!');
                        });
                    } else {
                        console.log('Order not found in encrypted storage.');
                    }
                } else {
                    console.log(
                        'No saved responses found in encrypted storage.'
                    );
                }
            })
            .catch((error) => {
                console.error(
                    'Error retrieving saved responses from encrypted storage:',
                    error
                );
            });
    }

    render() {
        const { navigation, LSPStore } = this.props;
        const { loading, order, fetchOldOrder } = this.state;
        const result = order?.result || order;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.LSPS7.type'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {LSPStore.loadingLSPS7 && (
                                <LoadingIndicator size={30} />
                            )}
                        </View>
                    }
                    onBack={() => {
                        LSPStore.getExtensionOrderResponse = {};
                        LSPStore.error = false;
                        LSPStore.error_msg = '';
                        this.setState({ fetchOldOrder: false });
                    }}
                    navigation={navigation}
                />
                {loading ? (
                    <LoadingIndicator />
                ) : (
                    <ScrollView>
                        {fetchOldOrder && (
                            <View style={{ paddingHorizontal: 20 }}>
                                <WarningMessage
                                    message={`${
                                        LSPStore.error_msg
                                    }: ${localeString(
                                        'views.LSPS1.showingPreviousState'
                                    )}`}
                                />
                            </View>
                        )}
                        {order && Object.keys(order).length > 0 ? (
                            <LSPS7OrderResponse
                                orderResponse={result}
                                orderView={true}
                                navigation={navigation}
                            />
                        ) : (
                            <></>
                        )}
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
