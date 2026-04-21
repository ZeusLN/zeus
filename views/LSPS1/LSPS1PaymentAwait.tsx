import React from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/Button';
import CollapsedQR from '../../components/CollapsedQR';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import SuccessAnimation from '../../components/SuccessAnimation';
import {
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import { LSPOrderState } from '../../models/LSP';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import LSPStore, { LSPS_ORDERS_KEY } from '../../stores/LSPStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import handleAnything from '../../utils/handleAnything';
import { localeString } from '../../utils/LocaleUtils';
import { sleep } from '../../utils/SleepUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

const POLL_INTERVAL_MS = 5000;
const CUSTOM_MESSAGE_WAIT_MS = 3000;

type PaymentAwaitState = 'polling' | 'completed' | 'failed';

interface LSPS1PaymentAwaitProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LSPS1PaymentAwait',
        {
            orderId: string;
            invoice: string;
            satAmount?: string | number;
        }
    >;
    LSPStore: LSPStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
}

interface LSPS1PaymentAwaitInternalState {
    paymentState: PaymentAwaitState;
    endpoint?: string;
    peer?: string;
    native?: boolean;
    failureMessage?: string;
}

@inject('LSPStore', 'ChannelsStore', 'NodeInfoStore')
@observer
export default class LSPS1PaymentAwait extends React.Component<
    LSPS1PaymentAwaitProps,
    LSPS1PaymentAwaitInternalState
> {
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private isPolling: boolean = false;
    private isUnmounted: boolean = false;
    private backPressSubscription: { remove: () => void } | null = null;

    constructor(props: LSPS1PaymentAwaitProps) {
        super(props);
        this.state = {
            paymentState: 'polling'
        };
    }

    async componentDidMount() {
        const { orderId } = this.props.route.params;

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress
        );

        try {
            const responseArrayString = await Storage.getItem(LSPS_ORDERS_KEY);
            if (responseArrayString) {
                const responseArray = JSON.parse(responseArrayString);
                const order = responseArray.find((response: any) => {
                    const decodedResponse = JSON.parse(response);
                    const result =
                        decodedResponse?.order?.result ||
                        decodedResponse?.order;
                    return result?.order_id === orderId;
                });
                if (order) {
                    const parsed = JSON.parse(order);
                    this.setState({
                        endpoint: parsed?.endpoint,
                        peer: parsed?.peer,
                        native: parsed?.native
                    });
                }
            }
        } catch (error) {
            console.error(
                'LSPS1PaymentAwait: error loading order metadata',
                error
            );
        }

        this.pollOrderStatus();
    }

    componentWillUnmount() {
        this.isUnmounted = true;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        if (this.backPressSubscription) {
            this.backPressSubscription.remove();
            this.backPressSubscription = null;
        }
        const { LSPStore } = this.props;
        LSPStore.getOrderResponse = {};
        LSPStore.error = false;
        LSPStore.error_msg = '';
        LSPStore.loadingLSPS1 = false;
    }

    private handleBackPress = (): boolean => {
        return false;
    };

    private scheduleNextPoll() {
        if (this.isUnmounted) return;
        if (this.state.paymentState !== 'polling') return;
        this.pollTimer = setTimeout(() => {
            this.pollOrderStatus();
        }, POLL_INTERVAL_MS);
    }

    private pollOrderStatus = async () => {
        if (this.isUnmounted || this.isPolling) return;
        if (this.state.paymentState !== 'polling') return;

        const { LSPStore } = this.props;
        const { orderId } = this.props.route.params;
        const { endpoint, peer, native } = this.state;

        this.isPolling = true;

        try {
            LSPStore.getOrderResponse = {};
            LSPStore.error = false;
            LSPStore.error_msg = '';

            if (native) {
                await LSPStore.lsps1GetOrderNative(orderId);
            } else if (endpoint && BackendUtils.supportsLSPS1rest()) {
                await LSPStore.lsps1GetOrderREST(orderId, endpoint);
            } else if (peer && BackendUtils.supportsLSPScustomMessage()) {
                LSPStore.lsps1GetOrderCustomMessage(orderId, peer);
                await sleep(CUSTOM_MESSAGE_WAIT_MS);
            } else {
                this.isPolling = false;
                this.scheduleNextPoll();
                return;
            }

            if (this.isUnmounted) return;

            const response = LSPStore.getOrderResponse;
            if (response && Object.keys(response).length > 0) {
                const result = (response as any)?.result || response;
                if (result?.order_state === LSPOrderState.COMPLETED) {
                    this.updateOrderInStorage(response);
                    this.setState({ paymentState: 'completed' });
                    this.isPolling = false;
                    return;
                }
                if (result?.order_state === LSPOrderState.FAILED) {
                    this.updateOrderInStorage(response);
                    this.setState({
                        paymentState: 'failed',
                        failureMessage: LSPStore.error_msg || undefined
                    });
                    this.isPolling = false;
                    return;
                }
            }
        } catch (error) {
            console.error('LSPS1PaymentAwait: poll error', error);
        }

        this.isPolling = false;
        this.scheduleNextPoll();
    };

    private updateOrderInStorage(order: any) {
        Storage.getItem(LSPS_ORDERS_KEY)
            .then((responseArrayString) => {
                if (!responseArrayString) return;
                const responseArray = JSON.parse(responseArrayString);
                const index = responseArray.findIndex((response: any) => {
                    const decodedResponse = JSON.parse(response);
                    const result =
                        decodedResponse?.order?.result ||
                        decodedResponse?.order;
                    const currentOrderResult = (order as any)?.result || order;
                    return result?.order_id === currentOrderResult?.order_id;
                });
                if (index !== -1) {
                    const oldOrder = JSON.parse(responseArray[index]);
                    oldOrder.order = order;
                    responseArray[index] = JSON.stringify(oldOrder);
                    Storage.setItem(LSPS_ORDERS_KEY, responseArray);
                }
            })
            .catch((error) => {
                console.error(
                    'LSPS1PaymentAwait: error updating order in storage',
                    error
                );
            });
    }

    private payFromZeusWallet = () => {
        const { invoice } = this.props.route.params;
        const { navigation } = this.props;
        handleAnything(invoice).then(([route, props]) => {
            navigation.navigate(route, props);
        });
    };

    private goToWallet = () => {
        this.props.navigation.popTo('Wallet');
    };

    private viewChannelStatus = () => {
        const { ChannelsStore, NodeInfoStore, navigation } = this.props;
        ChannelsStore.setChannelsType(ChannelsType.Pending);
        NodeInfoStore.getNodeInfo();
        ChannelsStore.getChannels();
        navigation.navigate('Wallet', {
            switchToChannels: true
        });
    };

    private viewOrderDetails = () => {
        const { orderId } = this.props.route.params;
        this.props.navigation.replace('LSPS1Order', {
            orderId,
            orderShouldUpdate: true
        });
    };

    render() {
        const { navigation, LSPStore } = this.props;
        const { invoice, satAmount } = this.props.route.params;
        const { paymentState, failureMessage } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            paymentState === 'completed'
                                ? localeString('views.LSPS1.orderCompleted')
                                : paymentState === 'failed'
                                ? localeString('views.LSPS1.orderFailed')
                                : localeString('views.LSPS1.awaitingPayment'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                {paymentState === 'polling' && (
                    <ScrollView
                        contentContainerStyle={{
                            paddingHorizontal: 15,
                            paddingBottom: 20
                        }}
                    >
                        <WarningMessage
                            message={localeString(
                                'views.LSPS1.payExternalWallet'
                            )}
                            fontSize={16}
                        />
                        <CollapsedQR
                            value={`lightning:${invoice}`}
                            copyValue={invoice}
                            expanded
                            textBottom
                            truncateLongValue
                            satAmount={satAmount}
                            displayAmount
                            showShare
                            iconOnly
                        />
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginTop: 10,
                                marginBottom: 10
                            }}
                        >
                            <LoadingIndicator size={20} />
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    marginLeft: 10,
                                    fontFamily: 'PPNeueMontreal-Book'
                                }}
                            >
                                {localeString(
                                    'views.LSPS1.checkingOrderStatus'
                                )}
                            </Text>
                        </View>
                        <Button
                            title={localeString('views.LSPS1.payFromZeus')}
                            onPress={this.payFromZeusWallet}
                            containerStyle={{ paddingTop: 10 }}
                        />
                        <Button
                            title={localeString(
                                'views.SendingLightning.goToWallet'
                            )}
                            onPress={this.goToWallet}
                            containerStyle={{ paddingTop: 10 }}
                            secondary
                        />
                    </ScrollView>
                )}
                {paymentState === 'completed' && (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'space-between',
                            paddingHorizontal: 20,
                            paddingBottom: 20
                        }}
                    >
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >
                            <SuccessAnimation />
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    marginTop: 20,
                                    textAlign: 'center',
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 20
                                }}
                            >
                                {localeString('views.LSPS1.paymentReceived')}
                            </Text>
                            <Text
                                style={{
                                    color: themeColor('secondaryText'),
                                    marginTop: 12,
                                    textAlign: 'center',
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 16
                                }}
                            >
                                {localeString('views.LSPS1.channelOnlineSoon')}
                            </Text>
                        </View>
                        <View>
                            {BackendUtils.supportsPendingChannels() && (
                                <Button
                                    title={localeString(
                                        'views.OpenChannel.viewStatus'
                                    )}
                                    onPress={this.viewChannelStatus}
                                />
                            )}
                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                onPress={this.goToWallet}
                                containerStyle={{ paddingTop: 10 }}
                                secondary
                            />
                        </View>
                    </View>
                )}
                {paymentState === 'failed' && (
                    <View
                        style={{
                            flex: 1,
                            justifyContent: 'space-between',
                            paddingHorizontal: 20,
                            paddingBottom: 20
                        }}
                    >
                        <View style={{ paddingTop: 20 }}>
                            <ErrorMessage
                                message={
                                    failureMessage ||
                                    LSPStore.error_msg ||
                                    localeString('views.LSPS1.orderFailed')
                                }
                            />
                        </View>
                        <View>
                            <Button
                                title={localeString(
                                    'views.LSPS1.viewOrderDetails'
                                )}
                                onPress={this.viewOrderDetails}
                            />
                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                onPress={this.goToWallet}
                                containerStyle={{ paddingTop: 10 }}
                                secondary
                            />
                        </View>
                    </View>
                )}
            </Screen>
        );
    }
}
