import React from 'react';
import { View, ScrollView } from 'react-native';
import { reaction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import { WarningMessage } from '../../components/SuccessErrorMessage';
import LoadingIndicator from '../../components/LoadingIndicator';

import { themeColor } from '../../utils/ThemeUtils';
import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';

import Storage from '../../storage';

import LSPStore, { LSPS_ORDERS_KEY } from '../../stores/LSPStore';
import SettingsStore from '../../stores/SettingsStore';
import InvoicesStore from '../../stores/InvoicesStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import LSPS1OrderResponse from './OrderResponse';

import { LSPOrderState } from '../../models/LSP';

interface OrderProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<'LSPS1Order', { orderId: string; orderShouldUpdate: boolean }>;
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
export default class LSPS1Order extends React.Component<
    OrderProps,
    OrdersState
> {
    private isUnmounted = false;
    private replyReceived = false;
    private replyDisposer: (() => void) | null = null;

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
                if (this.isUnmounted) return;
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

                        this.watchForReply(id, orderShouldUpdate);

                        let request: Promise<void> | undefined;
                        if (temporaryOrder?.native) {
                            // Native LSPS1 order
                            request = LSPStore.lsps1GetOrderNative(id);
                        } else if (BackendUtils.supportsLSPS1rest()) {
                            request = LSPStore.lsps1GetOrderREST(
                                id,
                                temporaryOrder?.endpoint
                            );
                        } else if (BackendUtils.supportsLSPScustomMessage()) {
                            request = LSPStore.lsps1GetOrderCustomMessage(
                                id,
                                temporaryOrder?.peer
                            );
                        }

                        request?.then(() => this.handleRequestSettled());
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

    componentWillUnmount() {
        this.isUnmounted = true;
        this.replyDisposer?.();
    }

    // Applies this order's reply whenever the store receives it, including
    // one that lands after the request timed out.
    private watchForReply = (id: string, orderShouldUpdate: boolean) => {
        const { LSPStore } = this.props;
        this.replyDisposer = reaction(
            () => LSPStore.getOrderResponse,
            (orderData) => {
                const result = orderData?.result || orderData;
                // the slot is shared with the other order requests
                if (result?.order_id !== id) return;
                this.replyReceived = true;
                this.setState({ order: orderData, fetchOldOrder: false });
                console.log('Latest Order state fetched!', orderData);
                if (
                    (result.order_state === LSPOrderState.COMPLETED ||
                        result.order_state === LSPOrderState.FAILED) &&
                    !orderShouldUpdate
                ) {
                    LSPStore.updateOrderInStorage(orderData);
                }
            }
        );
    };

    // The stored order stays on screen when the request failed
    private handleRequestSettled = () => {
        const { LSPStore } = this.props;
        if (this.isUnmounted || this.replyReceived) return;
        if (LSPStore.error && LSPStore.error_msg !== '') {
            this.setState({ fetchOldOrder: true });
            console.log('Old Order state fetched!');
        }
    };

    render() {
        const { navigation, LSPStore } = this.props;
        const { loading, order, fetchOldOrder } = this.state;
        const result = order?.result || order;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.LSPS1.type'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Roboto-Regular'
                        }
                    }}
                    rightComponent={
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {LSPStore.loadingLSPS1 && (
                                <LoadingIndicator size={30} />
                            )}
                        </View>
                    }
                    onBack={() => {
                        LSPStore.getOrderResponse = {};
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
