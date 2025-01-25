import React from 'react';
import { View, ScrollView } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import { WarningMessage } from '../../../components/SuccessErrorMessage';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { themeColor } from '../../../utils/ThemeUtils';
import BackendUtils from '../../../utils/BackendUtils';
import { localeString } from '../../../utils/LocaleUtils';

import Storage from '../../../storage';

import LSPStore, { LSPS1_ORDERS_KEY } from '../../../stores/LSPStore';
import SettingsStore from '../../../stores/SettingsStore';
import InvoicesStore from '../../../stores/InvoicesStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';
import LSPS1OrderResponse from '../../../components/LSPS1OrderResponse';

import { Order } from './OrdersPane';

interface OrderProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<'LSPS1Order', { orderId: string; orderShouldUpdate: boolean }>;
    LSPStore: LSPStore;
    SettingsStore: SettingsStore;
    InvoicesStore: InvoicesStore;
    NodeInfoStore: NodeInfoStore;
}

interface OrdersState {
    order: any;
    fetchOldOrder: boolean;
}

@inject('LSPStore', 'SettingsStore', 'InvoicesStore', 'NodeInfoStore')
@observer
export default class Orders extends React.Component<OrderProps, OrdersState> {
    constructor(props: OrderProps) {
        super(props);
        this.state = {
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
        Storage.getItem(LSPS1_ORDERS_KEY)
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

                        BackendUtils.supportsLSPS1rest()
                            ? LSPStore.getOrderREST(
                                  id,
                                  temporaryOrder?.endpoint
                              )
                            : LSPStore.getOrderCustomMessage(
                                  id,
                                  temporaryOrder?.peer
                              );

                        setTimeout(() => {
                            if (LSPStore.error && LSPStore.error_msg !== '') {
                                this.setState({
                                    order: temporaryOrder?.order,
                                    fetchOldOrder: true
                                });
                                LSPStore.loading = false;
                                console.log('Old Order state fetched!');
                            } else if (
                                Object.keys(LSPStore.getOrderResponse)
                                    .length !== 0
                            ) {
                                const getOrderData = LSPStore.getOrderResponse;
                                this.setState({
                                    order: getOrderData,
                                    fetchOldOrder: false
                                });
                                console.log(
                                    'Latest Order state fetched!',
                                    this.state.order
                                );
                                LSPStore.loading = false;
                                const result =
                                    getOrderData?.result || getOrderData;
                                if (
                                    (result?.order_state === 'COMPLETED' ||
                                        result?.order_state === 'FAILED') &&
                                    !orderShouldUpdate
                                ) {
                                    this.updateOrderInStorage(getOrderData);
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
        Storage.getItem(LSPS1_ORDERS_KEY)
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
                        Storage.setItem(LSPS1_ORDERS_KEY, responseArray).then(
                            () => {
                                console.log(
                                    'Order updated in encrypted storage!'
                                );
                            }
                        );
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
        const { order, fetchOldOrder } = this.state;
        const result = order?.result || order;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: 'Order',
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    onBack={() => {
                        LSPStore.getOrderResponse = {};
                        LSPStore.error = false;
                        LSPStore.error_msg = '';
                        this.setState({ fetchOldOrder: false });
                    }}
                    navigation={navigation}
                />
                {LSPStore.loading ? (
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
                            <LSPS1OrderResponse
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
