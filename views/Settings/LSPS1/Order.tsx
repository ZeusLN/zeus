import React from 'react';
import { View, ScrollView } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { v4 as uuidv4 } from 'uuid';
import { inject, observer } from 'mobx-react';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import { WarningMessage } from '../../../components/SuccessErrorMessage';
import LoadingIndicator from '../../../components/LoadingIndicator';

import { themeColor } from '../../../utils/ThemeUtils';
import BackendUtils from '../../../utils/BackendUtils';
import { localeString } from '../../../utils/LocaleUtils';

import LSPStore from '../../../stores/LSPStore';
import SettingsStore from '../../../stores/SettingsStore';
import InvoicesStore from '../../../stores/InvoicesStore';
import NodeInfoStore from '../../../stores/NodeInfoStore';
import LSPS1OrderResponse from '../../../components/LSPS1OrderResponse';

interface OrderProps {
    navigation: any;
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

    encodeMesage = (n: any) => Buffer.from(JSON.stringify(n)).toString('hex');

    async componentDidMount() {
        const { LSPStore } = this.props;
        const orderId = this.props.navigation.getParam('orderId', null);

        BackendUtils.supportsLSPS1rest()
            ? LSPStore.getOrderREST(orderId)
            : this.lsps1_getorder(orderId);

        setTimeout(() => {
            if (LSPStore.error && LSPStore.error_msg !== '') {
                this.retrieveOrderFromStorage(orderId);
            } else {
                const getOrderData = LSPStore.getOrderResponse;
                this.setState({ order: getOrderData, fetchOldOrder: false });
                const result = getOrderData?.result || getOrderData;
                if (
                    result?.order_state === 'COMPLETED' ||
                    result?.order_state === 'FAILED'
                ) {
                    this.updateOrderInStorage(getOrderData);
                }
                LSPStore.loading = false;
                console.log('Latest Order state fetched!');
            }
        }, 3000);
    }

    updateOrderInStorage(order) {
        console.log('Updating order in encrypted storage...');
        EncryptedStorage.getItem('orderResponses')
            .then((responseArrayString) => {
                if (responseArrayString) {
                    let responseArray = JSON.parse(responseArrayString);
                    // Find the index of the order to be updated
                    const index = responseArray.findIndex((response) => {
                        const decodedResponse = JSON.parse(response);
                        const result =
                            decodedResponse?.result || decodedResponse;
                        const currentOrderResult = order?.result || order;
                        return result.order_id === currentOrderResult.order_id;
                    });
                    if (index !== -1) {
                        // Update the order
                        responseArray[index] = JSON.stringify(order);
                        // Save the updated order array back to encrypted storage
                        EncryptedStorage.setItem(
                            'orderResponses',
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

    retrieveOrderFromStorage(id: string) {
        console.log('Latest order state not found, retrieving from storage...');
        EncryptedStorage.getItem('orderResponses')
            .then((responseArrayString) => {
                if (responseArrayString) {
                    const responseArray = JSON.parse(responseArrayString);
                    const order = responseArray.find((response) => {
                        const decodedResponse = JSON.parse(response);
                        const result =
                            decodedResponse?.result || decodedResponse;
                        return result.order_id === id;
                    });
                    if (order) {
                        const parsedOrder = JSON.parse(order);
                        this.setState({
                            order: parsedOrder,
                            fetchOldOrder: true
                        });
                        this.props.LSPStore.loading = false;
                        console.log('Old Order state fetched!');
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

    lsps1_getorder(orderId: string) {
        const { LSPStore } = this.props;
        LSPStore.loading = true;
        const peer =
            '03e84a109cd70e57864274932fc87c5e6434c59ebb8e6e7d28532219ba38f7f6df@139.144.22.237:9735';
        const [node_pubkey_string] = peer.split('@');
        const type = 37913;
        const id = uuidv4();
        LSPStore.getOrderId = id;
        const data = this.encodeMesage({
            jsonrpc: '2.0',
            method: 'lsps1.get_order',
            params: {
                order_id: orderId
            },
            id: LSPStore.getOrderId
        });

        this.props.LSPStore.sendCustomMessage({
            peer: node_pubkey_string,
            type,
            data
        })
            .then((response) => {
                console.log('Custom message sent:', response);
            })
            .catch((error) => {
                console.error('Error sending custom message:', error);
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
                        {order && Object.keys(order).length > 0 && (
                            <LSPS1OrderResponse
                                orderResponse={result}
                                orderView={true}
                            />
                        )}
                    </ScrollView>
                )}
            </Screen>
        );
    }
}
