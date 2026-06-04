import React from 'react';
import {
    BackHandler,
    NativeEventSubscription,
    ScrollView,
    Text,
    View
} from 'react-native';
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

import { LSPOrderState, LSPService, PaymentAwaitState } from '../../models/LSP';

import ChannelsStore, { ChannelsType } from '../../stores/ChannelsStore';
import LSPStore, { LSPS_ORDERS_KEY } from '../../stores/LSPStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import handleAnything from '../../utils/handleAnything';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import Storage from '../../storage';

const POLL_INTERVAL_MS = 5000;

interface LSPPaymentAwaitProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'LSPS1PaymentAwait' | 'LSPS7PaymentAwait',
        {
            orderId: string;
            invoice: string;
            satAmount?: string | number;
            service: LSPService;
        }
    >;
    LSPStore: LSPStore;
    ChannelsStore: ChannelsStore;
    NodeInfoStore: NodeInfoStore;
}

interface LSPPaymentAwaitInternalState {
    paymentState: PaymentAwaitState;
    endpoint?: string;
    peer?: string;
    native?: boolean;
}

@inject('LSPStore', 'ChannelsStore', 'NodeInfoStore')
@observer
export default class LSPPaymentAwait extends React.Component<
    LSPPaymentAwaitProps,
    LSPPaymentAwaitInternalState
> {
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private isPolling: boolean = false;
    private isUnmounted: boolean = false;
    private backPressSubscription: NativeEventSubscription | null = null;

    constructor(props: LSPPaymentAwaitProps) {
        super(props);
        this.state = {
            paymentState: PaymentAwaitState.POLLING
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
                'LSPPaymentAwait: error loading order metadata',
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
        LSPStore.getExtensionOrderResponse = {};
        LSPStore.error = false;
        LSPStore.error_msg = '';
        LSPStore.loadingLSPS1 = false;
        LSPStore.loadingLSPS7 = false;
    }

    private handleBackPress = (): boolean => {
        if (this.state.paymentState === PaymentAwaitState.COMPLETED) {
            this.props.navigation.popTo('Wallet');
            return true;
        }
        return false;
    };

    private scheduleNextPoll() {
        if (this.isUnmounted) return;
        if (this.state.paymentState !== PaymentAwaitState.POLLING) return;
        this.pollTimer = setTimeout(() => {
            this.pollOrderStatus();
        }, POLL_INTERVAL_MS);
    }

    private pollOrderStatus = async () => {
        if (this.isUnmounted || this.isPolling) return;
        if (this.state.paymentState !== PaymentAwaitState.POLLING) return;

        const { LSPStore } = this.props;
        const { orderId, service } = this.props.route.params;
        const { endpoint, peer, native } = this.state;

        this.isPolling = true;

        try {
            LSPStore.getOrderResponse = {};
            LSPStore.getExtensionOrderResponse = {};
            LSPStore.error = false;
            LSPStore.error_msg = '';

            let response: any;

            if (service === LSPService.LSPS7) {
                if (!peer) {
                    this.isPolling = false;
                    this.scheduleNextPoll();
                    return;
                }
                await LSPStore.lsps7GetOrderCustomMessage(orderId, peer);
                response = LSPStore.getExtensionOrderResponse;
            } else {
                if (native) {
                    await LSPStore.lsps1GetOrderNative(orderId);
                } else if (endpoint && BackendUtils.supportsLSPS1rest()) {
                    await LSPStore.lsps1GetOrderREST(orderId, endpoint);
                } else if (peer && BackendUtils.supportsLSPScustomMessage()) {
                    await LSPStore.lsps1GetOrderCustomMessage(orderId, peer);
                } else {
                    this.isPolling = false;
                    this.scheduleNextPoll();
                    return;
                }
                response = LSPStore.getOrderResponse;
            }

            if (this.isUnmounted) return;

            if (response && Object.keys(response).length > 0) {
                const result = response?.result || response;
                if (result?.order_state === LSPOrderState.COMPLETED) {
                    LSPStore.updateOrderInStorage(response);
                    this.setState({
                        paymentState: PaymentAwaitState.COMPLETED
                    });
                    this.isPolling = false;
                    return;
                }
                if (result?.order_state === LSPOrderState.FAILED) {
                    LSPStore.updateOrderInStorage(response);
                    this.setState({ paymentState: PaymentAwaitState.FAILED });
                    this.isPolling = false;
                    return;
                }
            }
        } catch (error) {
            console.error('LSPPaymentAwait: poll error', error);
        }

        this.isPolling = false;
        this.scheduleNextPoll();
    };

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
        const { orderId, service } = this.props.route.params;
        const target =
            service === LSPService.LSPS7 ? 'LSPS7Order' : 'LSPS1Order';
        this.props.navigation.replace(target, {
            orderId,
            orderShouldUpdate: true
        });
    };

    render() {
        const { navigation, LSPStore } = this.props;
        const { invoice, satAmount, service } = this.props.route.params;
        const { paymentState } = this.state;

        const successSubtitle =
            service === LSPService.LSPS7
                ? localeString('views.LSPS7.leaseExtended')
                : localeString('views.LSPS1.channelOnlineSoon');

        const failureFallback =
            service === LSPService.LSPS7
                ? localeString('views.LSPS7.extensionFailed')
                : localeString('views.LSPS1.channelOpenFailed');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text:
                            paymentState === PaymentAwaitState.COMPLETED
                                ? localeString('views.LSPS1.orderCompleted')
                                : paymentState === PaymentAwaitState.FAILED
                                ? localeString('views.LSPS1.orderFailed')
                                : localeString('views.LSPS1.awaitingPayment'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                    onBack={
                        paymentState === PaymentAwaitState.COMPLETED
                            ? this.goToWallet
                            : undefined
                    }
                />
                {paymentState === PaymentAwaitState.POLLING && (
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
                {paymentState === PaymentAwaitState.COMPLETED && (
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
                                {successSubtitle}
                            </Text>
                        </View>
                        <View>
                            {service === LSPService.LSPS1 &&
                                BackendUtils.supportsPendingChannels() && (
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
                {paymentState === PaymentAwaitState.FAILED && (
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
                                message={LSPStore.error_msg || failureFallback}
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
