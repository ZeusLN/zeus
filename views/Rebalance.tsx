import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Alert,
    NativeModules,
    NativeEventEmitter
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import Slider from '@react-native-community/slider';

import Amount from '../components/Amount';
import Button from '../components/Button';
import Header from '../components/Header';
import HopPicker from '../components/HopPicker';
import KeyValue from '../components/KeyValue';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { Row } from '../components/layout/Row';

import ChannelsStore from '../stores/ChannelsStore';
import TransactionsStore from '../stores/TransactionsStore';
import SettingsStore from '../stores/SettingsStore';
import UnitsStore from '../stores/UnitsStore';
import NodeInfoStore from '../stores/NodeInfoStore';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

import { themeColor } from '../utils/ThemeUtils';
import Channel from '../models/Channel';
import { ChannelItem } from '../components/Channels/ChannelItem';

import SyncIcon from '../assets/images/SVG/Sync.svg';
import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

const REBALANCE_CONSTANTS = {
    DEFAULT_FEE_LIMIT: '100',
    DEFAULT_TIMEOUT: '120',
    DEFAULT_SLIDER_VALUE: 0,
    MAX_PAYMENT_PARTS: 5,
    PAYMENT_CHECK_DELAY: 3000,
    MIN_REBALANCE_AMOUNT: 1,
    CIRCULAR_LAYER_NAME: 'circular-rebalance',
    DEFAULT_FINAL_CLTV: 9,
    MIN_FEE_PERCENT: 1.0
} as const;

type ChannelType = 'source' | 'destination';

interface RebalanceProps {
    navigation: StackNavigationProp<any, any>;
    ChannelsStore: ChannelsStore;
    TransactionsStore: TransactionsStore;
    SettingsStore: SettingsStore;
    UnitsStore: UnitsStore;
    NodeInfoStore: NodeInfoStore;
}

interface RebalanceState {
    selectedSourceChannel: Channel | null;
    selectedDestinationChannel: Channel | null;
    rebalanceAmount: number;
    maxAmount: number;
    feeLimit: string;
    timeoutSeconds: string;
    showAdvanced: boolean;
    executing: boolean;
    projectedSourceBalance: number;
    projectedDestinationBalance: number;
    adjustedSourceBalance: number;
    adjustedDestinationBalance: number;
    originalSourceBalance: number;
    originalDestinationBalance: number;
    totalBalance: number;
    balanceSliderValue: number;
}

@inject(
    'ChannelsStore',
    'TransactionsStore',
    'SettingsStore',
    'UnitsStore',
    'NodeInfoStore'
)
@observer
export default class Rebalance extends React.Component<
    RebalanceProps,
    RebalanceState
> {
    private listener: any = null;
    private paymentTimeoutId: any = null;

    constructor(props: RebalanceProps) {
        super(props);

        this.state = {
            selectedSourceChannel: null,
            selectedDestinationChannel: null,
            rebalanceAmount: 0,
            maxAmount: 0,
            feeLimit: REBALANCE_CONSTANTS.DEFAULT_FEE_LIMIT,
            timeoutSeconds: REBALANCE_CONSTANTS.DEFAULT_TIMEOUT,
            showAdvanced: false,
            executing: false,
            projectedSourceBalance: 0,
            projectedDestinationBalance: 0,
            adjustedSourceBalance: 0,
            adjustedDestinationBalance: 0,
            originalSourceBalance: 0,
            originalDestinationBalance: 0,
            totalBalance: 0,
            balanceSliderValue: REBALANCE_CONSTANTS.DEFAULT_SLIDER_VALUE // Start at 0 (no rebalance)
        };
    }

    componentDidMount() {
        const { ChannelsStore } = this.props;

        this.cleanupPaymentListener();

        if (!ChannelsStore.channels || ChannelsStore.channels.length === 0) {
            ChannelsStore.getChannels();
        }
    }

    componentWillUnmount() {
        this.cleanupPaymentListener();
    }

    getAvailableChannels = (): Channel[] => {
        const { ChannelsStore } = this.props;
        return ChannelsStore.channels.filter(
            (channel: Channel) =>
                channel.isActive &&
                !channel.pendingOpen &&
                !channel.pendingClose &&
                !channel.closing
        );
    };

    getMaxRebalanceAmount = (): number => {
        const { selectedSourceChannel, selectedDestinationChannel } =
            this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            return 0;
        }

        const sourceCapacity =
            Number(selectedSourceChannel.sendingCapacity) || 0;
        const destCapacity =
            Number(selectedDestinationChannel.receivingCapacity) || 0;

        return Math.min(sourceCapacity, destCapacity);
    };

    updateProjectedBalances = () => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            this.updateStateWithCallback({
                projectedSourceBalance: 0,
                projectedDestinationBalance: 0
            });
            return;
        }

        const projectedSourceBalance =
            Number(selectedSourceChannel.localBalance) - rebalanceAmount;
        const projectedDestinationBalance =
            Number(selectedDestinationChannel.localBalance) + rebalanceAmount;

        this.updateStateWithCallback({
            projectedSourceBalance,
            projectedDestinationBalance
        });
    };

    private handleChannelSelect = (channel: Channel, type: ChannelType) => {
        if (!channel) return;

        const localBalance = Number(channel.localBalance) || 0;
        const stateUpdates: Partial<RebalanceState> = {
            rebalanceAmount: 0
        };

        if (type === 'source') {
            stateUpdates.selectedSourceChannel = channel;
            stateUpdates.originalSourceBalance = localBalance;
            stateUpdates.adjustedSourceBalance = localBalance;
        } else {
            stateUpdates.selectedDestinationChannel = channel;
            stateUpdates.originalDestinationBalance = localBalance;
            stateUpdates.adjustedDestinationBalance = localBalance;
        }

        this.updateStateWithCallback(stateUpdates, () => {
            this.updateDerivedState();
        });
    };

    private updateDerivedState = () => {
        const maxAmount = this.getMaxRebalanceAmount();
        this.setState({ maxAmount });
        this.updateProjectedBalances();
        this.initializeBalanceSlider();
    };

    private showErrorAlert = (message: string) => {
        this.createAlert(localeString('general.error'), message);
    };

    private showSuccessAlert = (message: string, onOk?: () => void) => {
        const buttons = onOk
            ? [{ text: localeString('general.ok'), onPress: onOk }]
            : undefined;
        this.createAlert(localeString('general.success'), message, buttons);
    };

    onSourceChannelSelect = (channels: Channel[]) => {
        this.handleChannelSelect(channels[0], 'source');
    };

    onDestinationChannelSelect = (channels: Channel[]) => {
        this.handleChannelSelect(channels[0], 'destination');
    };

    // Initialize balance slider when both channels are selected
    initializeBalanceSlider = () => {
        const { selectedSourceChannel, selectedDestinationChannel } =
            this.state;

        if (selectedSourceChannel && selectedDestinationChannel) {
            const sourceBalance = Number(selectedSourceChannel.localBalance);
            const destBalance = Number(selectedDestinationChannel.localBalance);
            const total = sourceBalance + destBalance;

            this.updateStateWithCallback({
                originalSourceBalance: sourceBalance,
                originalDestinationBalance: destBalance,
                adjustedSourceBalance: sourceBalance,
                adjustedDestinationBalance: destBalance,
                totalBalance: total,
                balanceSliderValue: 0
            });
        }
    };

    onBalanceSliderChange = (value: number) => {
        const { originalSourceBalance, originalDestinationBalance } =
            this.state;

        // Value is the actual rebalance amount in sats (0 to maxAmount)
        const rebalanceAmount = Math.round(value);

        // Calculate projected balances after rebalancing
        const projectedSourceBalance = Math.max(
            0,
            originalSourceBalance - rebalanceAmount
        );
        const projectedDestinationBalance =
            originalDestinationBalance + rebalanceAmount;

        this.updateStateWithCallback({
            balanceSliderValue: value,
            rebalanceAmount,
            adjustedSourceBalance: projectedSourceBalance,
            adjustedDestinationBalance: projectedDestinationBalance,
            projectedSourceBalance,
            projectedDestinationBalance
        });
    };

    resetBalances = () => {
        const { originalSourceBalance, originalDestinationBalance } =
            this.state;

        this.updateStateWithCallback({
            adjustedSourceBalance: originalSourceBalance,
            adjustedDestinationBalance: originalDestinationBalance,
            balanceSliderValue: 0, // Reset to 0 (no rebalance)
            rebalanceAmount: 0,
            // Reset projected balances to original values
            projectedSourceBalance: originalSourceBalance,
            projectedDestinationBalance: originalDestinationBalance
        });
    };

    executeRebalance = async () => {
        if (
            !this.validateChannelSelection() ||
            !this.validateRebalanceAmount()
        ) {
            return;
        }

        this.executeRebalanceWithParameters();
    };

    private validateNodeInfo = async (): Promise<string | null> => {
        const { NodeInfoStore } = this.props;
        const ownPubkey =
            NodeInfoStore.nodeInfo?.identity_pubkey ||
            NodeInfoStore.nodeInfo?.id;

        if (!ownPubkey) {
            this.showErrorAlert(localeString('views.Rebalance.error.nodeInfo'));
            return null;
        }

        return ownPubkey;
    };

    private createRebalanceInvoice = async (): Promise<any> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error('Channels not selected');
        }

        return BackendUtils.createInvoice({
            memo: this.generateInvoiceMemo(
                selectedSourceChannel,
                selectedDestinationChannel
            ),
            value: rebalanceAmount
        });
    };

    // Memo generation
    private generateInvoiceMemo = (
        sourceChannel: Channel,
        destChannel: Channel
    ): string => {
        return (
            localeString('views.Rebalance.memo') +
            sourceChannel.remotePubkey +
            ' -> ' +
            destChannel.remotePubkey
        );
    };

    private executePayment = async (invoiceData: any): Promise<any> => {
        const { selectedSourceChannel, selectedDestinationChannel } =
            this.state;
        const { SettingsStore } = this.props;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error('Channels not selected');
        }

        const implementation = SettingsStore.implementation;

        try {
            switch (implementation) {
                case 'cln-rest':
                    return this.executeClnRestRebalance(invoiceData);

                case 'lightning-node-connect':
                    const result = await this.executeLndRebalance(invoiceData);

                    // If result is a string (subscription ID), subscribe to payment updates
                    if (typeof result === 'string') {
                        return await this.subscribePayment(result);
                    }
                    return result;

                default:
                    return this.executeLndRebalance(invoiceData);
            }
        } catch (error: any) {
            console.error(
                `Error executing payment with ${implementation}:`,
                error.message
            );
            throw error;
        }
    };

    // CLN Rest circular rebalancing implementation with fallback mechanism
    private executeClnRestRebalance = async (
        invoiceData: any
    ): Promise<any> => {
        const {
            selectedSourceChannel,
            feeLimit,
            timeoutSeconds,
            rebalanceAmount
        } = this.state;
        const { NodeInfoStore } = this.props;

        if (!selectedSourceChannel) {
            throw new Error('Source channel not selected');
        }

        const ownNodePubkey =
            NodeInfoStore.nodeInfo?.identity_pubkey ||
            NodeInfoStore.nodeInfo?.id;

        if (!ownNodePubkey) {
            throw new Error(
                'Could not get own node pubkey for circular rebalancing'
            );
        }

        // Try direction /1 first, then fallback to /0
        const directions = ['/1', '/0'];
        let lastError: Error | null = null;

        for (const direction of directions) {
            let layerCreated = false;

            try {
                // Create new layer
                await BackendUtils.askReneCreateLayer({
                    layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME
                });
                layerCreated = true;

                // Update channel to force alternative routing with current direction
                await BackendUtils.askReneUpdateChannel({
                    short_channel_id_dir:
                        selectedSourceChannel.short_channel_id + direction,
                    layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME,
                    enabled: false
                });

                // Get routes using the layer
                await BackendUtils.getRoutes({
                    source: selectedSourceChannel.remotePubkey,
                    destination: ownNodePubkey,
                    amount_msat: rebalanceAmount * 1000,
                    maxfee_msat: Number(feeLimit) * 1000,
                    layers: [REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME],
                    final_cltv: REBALANCE_CONSTANTS.DEFAULT_FINAL_CLTV
                });

                // Execute payment using the same invoice for both attempts
                const paymentData = await BackendUtils.payLightningInvoice({
                    payment_request: invoiceData.bolt11,
                    amount_msat: rebalanceAmount * 1000,
                    maxfeepercent: Math.max(
                        REBALANCE_CONSTANTS.MIN_FEE_PERCENT,
                        (Number(feeLimit) / rebalanceAmount) * 100
                    ),
                    retry_for: Number(timeoutSeconds),
                    exclude: [],
                    localinvreqid: null,
                    description: `Circular rebalance ${rebalanceAmount} sats (direction ${direction})`
                });

                return paymentData;
            } catch (error: any) {
                console.error(
                    `CLN Rest circular rebalancing failed with direction ${direction}:`,
                    error
                );
                lastError = error;

                // If this was the first direction (/1) and it failed, prepare for fallback
                if (direction === '/1' && directions.indexOf('/0') !== -1) {
                    console.log(
                        'Direction /1 failed, attempting fallback to /0 with same invoice'
                    );
                }
            } finally {
                if (layerCreated) {
                    try {
                        await BackendUtils.askReneRemoveLayer({
                            layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME
                        });
                    } catch (cleanupError) {
                        console.error(
                            `Error cleaning up askrene layer for direction ${direction}:`,
                            cleanupError
                        );
                    }
                }
            }
        }

        throw new Error(
            `Circular rebalancing failed with both directions (/1 and /0). Last error: ${
                lastError?.message || 'Unknown error'
            }`
        );
    };

    // LND rebalancing implementation
    private executeLndRebalance = async (invoiceData: any): Promise<any> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            feeLimit,
            timeoutSeconds
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error('Channels not selected for LND rebalancing');
        }

        return BackendUtils.payLightningInvoice({
            payment_request: invoiceData.payment_request,
            outgoing_chan_id: Number(selectedSourceChannel.channelId),
            last_hop_pubkey: Buffer.from(
                selectedDestinationChannel.remotePubkey,
                'hex'
            ).toString('base64'),
            fee_limit_sat: Number(feeLimit),
            allow_self_payment: true,
            timeout_seconds: Number(timeoutSeconds),
            max_parts: REBALANCE_CONSTANTS.MAX_PAYMENT_PARTS
        });
    };

    // Payment result handling
    private handlePaymentResult = (result: any) => {
        const { SettingsStore } = this.props;
        const isClnRest = SettingsStore.implementation === 'cln-rest';
        const isLNC = SettingsStore.implementation === 'lightning-node-connect';

        if (isClnRest) {
            this.handleClnRestPaymentResult(result);
        } else if (isLNC) {
            this.handleLncPaymentResult(result);
        } else {
            this.handleLndPaymentResult(result);
        }
    };

    private handleClnRestPaymentResult = (result: any) => {
        if (result && result.status === 'complete') {
            this.handleSuccessfulPayment();
        } else if (result && result.status === 'failed') {
            const errorMessage = `Payment failed: ${
                result.failure_reason || 'Unknown error'
            }`;
            this.showErrorAlert(errorMessage);
        } else {
            this.showErrorAlert(
                'Payment result unclear - check your transaction history'
            );
        }
    };

    private handleLncPaymentResult = (result: any) => {
        if (!result) {
            this.handleUnclearPaymentStatus({ status: 'UNKNOWN' });
            return;
        }

        const status = result.status || result.state || 'UNKNOWN';

        switch (status) {
            case 'SUCCEEDED':
            case 'complete':
                this.handleSuccessfulPayment();
                break;

            case 'FAILED':
                this.handleFailedPayment({
                    failure_reason:
                        result.failure_reason ||
                        result.failure_string ||
                        'Payment failed'
                });
                break;

            case 'IN_FLIGHT':
                this.handleUnclearPaymentStatus(result);
                break;

            default:
                this.handleUnclearPaymentStatus(result);
                break;
        }
    };

    // LND payment result handler
    private handleLndPaymentResult = (result: any) => {
        if (result && result.result) {
            this.handleDirectPaymentResult(result.result);
        } else if (result && result.payment_error) {
            this.showErrorAlert(result.payment_error);
        } else {
            this.handleFallbackPaymentCheck();
        }
    };

    // Direct payment result handler
    private handleDirectPaymentResult = (payment: any) => {
        console.log(
            `Amount: ${payment.value_sat} sats, Fee: ${payment.fee_sat} sats`
        );

        if (payment.status === 'SUCCEEDED') {
            this.handleSuccessfulPayment();
        } else if (payment.status === 'FAILED') {
            this.handleFailedPayment(payment);
        } else {
            this.handleUnclearPaymentStatus(payment);
        }
    };

    // Successful payment handler
    private handleSuccessfulPayment = () => {
        this.showSuccessAlert(
            localeString('views.Rebalance.success.message'),
            () => {
                this.props.ChannelsStore.getChannels();
                this.resetComponentState();
            }
        );
    };

    // Reset the entire component state to initial values
    private resetComponentState = () => {
        this.setState({
            selectedSourceChannel: null,
            selectedDestinationChannel: null,
            rebalanceAmount: 0,
            maxAmount: 0,
            feeLimit: REBALANCE_CONSTANTS.DEFAULT_FEE_LIMIT,
            timeoutSeconds: REBALANCE_CONSTANTS.DEFAULT_TIMEOUT,
            showAdvanced: false,
            executing: false,
            projectedSourceBalance: 0,
            projectedDestinationBalance: 0,
            adjustedSourceBalance: 0,
            adjustedDestinationBalance: 0,
            originalSourceBalance: 0,
            originalDestinationBalance: 0,
            totalBalance: 0,
            balanceSliderValue: REBALANCE_CONSTANTS.DEFAULT_SLIDER_VALUE
        });
    };

    // Failed payment handler
    private handleFailedPayment = (payment: any) => {
        const errorMsg =
            payment.failure_reason || 'Payment failed for unknown reason';
        this.showErrorAlert(errorMsg);
    };

    // Unclear payment status handler
    private handleUnclearPaymentStatus = (payment: any) => {
        const statusMessage = `${localeString(
            'views.Rebalance.status.message'
        )} : ${payment.status}\n${localeString(
            'views.Rebalance.checkYourTransactionHistory'
        )}`;
        this.showErrorAlert(statusMessage);

        this.resetComponentState();
    };

    // Fallback payment check for other implementations
    private handleFallbackPaymentCheck = () => {
        const { TransactionsStore } = this.props;

        setTimeout(() => {
            if (TransactionsStore.payment_error) {
                console.log(
                    'Rebalance failed:',
                    TransactionsStore.payment_error
                );
                this.showErrorAlert(TransactionsStore.payment_error);
            } else if (TransactionsStore.payment_preimage) {
                this.handleSuccessfulPayment();
            } else {
                const unclearMessage = `${localeString(
                    'views.Rebalance.status.unclearMessage'
                )}\n${localeString(
                    'views.Rebalance.checkYourTransactionHistory'
                )}`;
                this.showErrorAlert(unclearMessage);

                this.resetComponentState();
            }
        }, REBALANCE_CONSTANTS.PAYMENT_CHECK_DELAY);
    };

    // Error handling
    private handleRebalanceError = (error: any) => {
        console.log('Rebalance error:', error.message);

        if (error.message && typeof error.message === 'string') {
            if (error.message.includes('timeout')) {
                this.createAlert(
                    localeString('views.PaymentRequest.timeout.title'),
                    localeString('views.PaymentRequest.timeout.message'),
                    [
                        {
                            text: localeString(
                                'views.PaymentRequest.timeout.showAdvanced'
                            ),
                            onPress: () => this.setState({ showAdvanced: true })
                        },
                        {
                            text: localeString('general.ok')
                        }
                    ]
                );
                return;
            }

            if (
                error.message.includes('no route') ||
                error.message.includes('NO_ROUTE') ||
                error.message.includes('unable to find a path')
            ) {
                this.showErrorAlert(
                    localeString('views.Rebalance.error.noRoute')
                );
                return;
            }

            if (
                error.message.includes('insufficient') ||
                error.message.includes('INSUFFICIENT_BALANCE')
            ) {
                this.showErrorAlert(
                    localeString('views.Rebalance.error.insufficientBalance')
                );
                return;
            }

            if (
                error.message.includes('fee') &&
                error.message.includes('limit')
            ) {
                this.showErrorAlert(
                    `${localeString('views.Rebalance.error.feeLimit')}: ${
                        error.message
                    }`
                );
                return;
            }
        }

        this.showErrorAlert(
            error.message || localeString('views.Rebalance.error.generic')
        );

        this.resetComponentState();
    };

    executeRebalanceWithParameters = async () => {
        this.setState({ executing: true });

        try {
            // Step 1: Validate node info
            const ownPubkey = await this.validateNodeInfo();
            if (!ownPubkey) {
                this.setState({ executing: false });
                return;
            }

            // Step 2: Create invoice
            const invoiceData = await this.createRebalanceInvoice();
            if (!invoiceData) {
                this.showErrorAlert(
                    localeString('views.Rebalance.error.generic')
                );
                return;
            }

            // Step 3: Execute payment
            const result = await this.executePayment(invoiceData);

            // Step 4: Handle result
            this.handlePaymentResult(result);
        } catch (error: any) {
            this.handleRebalanceError(error);

            this.cleanupPaymentListener();
        } finally {
            this.setState({ executing: false });
        }
    };

    private calculateChannelCapacities = (
        localBalance: number,
        remoteBalance: number,
        localReserve: number,
        remoteReserve: number
    ) => ({
        sendingCapacity: Math.max(0, localBalance - localReserve),
        receivingCapacity: Math.max(0, remoteBalance - remoteReserve)
    });

    private calculateProjectedBalances = (
        channel: Channel,
        projectedBalance: number
    ) => {
        const originalTotal =
            (Number(channel.localBalance) || 0) +
            (Number(channel.remoteBalance) || 0);

        const displayLocalBalance = Math.max(0, projectedBalance);
        const displayRemoteBalance = Math.max(
            0,
            originalTotal - displayLocalBalance
        );

        return { displayLocalBalance, displayRemoteBalance };
    };

    private createAlert = (
        title: string,
        message: string,
        buttons?: Array<{ text: string; onPress?: () => void }>
    ) => {
        Alert.alert(title, message, buttons);
    };

    private validateChannelSelection = (): boolean => {
        const { selectedSourceChannel, selectedDestinationChannel } =
            this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            this.showErrorAlert(
                localeString('views.Rebalance.error.selectChannels')
            );
            return false;
        }

        if (
            selectedSourceChannel.channelId ===
            selectedDestinationChannel.channelId
        ) {
            this.showErrorAlert(
                localeString('views.Rebalance.error.sameChannel')
            );
            return false;
        }

        return true;
    };

    private validateRebalanceAmount = (): boolean => {
        const { rebalanceAmount } = this.state;

        if (rebalanceAmount <= REBALANCE_CONSTANTS.MIN_REBALANCE_AMOUNT) {
            this.showErrorAlert(
                localeString('views.Rebalance.error.validAmount')
            );
            return false;
        }

        return true;
    };

    private updateStateWithCallback = (
        updates: Partial<RebalanceState>,
        callback?: () => void
    ) => {
        this.setState(updates as RebalanceState, callback);
    };

    private createBalanceDisplayData = (
        channel: Channel,
        type?: ChannelType
    ) => {
        const {
            projectedSourceBalance,
            projectedDestinationBalance,
            rebalanceAmount
        } = this.state;

        let displayLocalBalance = Number(channel.localBalance) || 0;
        let displayRemoteBalance = Number(channel.remoteBalance) || 0;
        let displaySendingCapacity = Number(channel.sendingCapacity) || 0;
        let displayReceivingCapacity = Number(channel.receivingCapacity) || 0;

        if (type && rebalanceAmount > 0) {
            const projectedBalance =
                type === 'source'
                    ? projectedSourceBalance
                    : projectedDestinationBalance;

            const projectedBalances = this.calculateProjectedBalances(
                channel,
                projectedBalance
            );
            displayLocalBalance = projectedBalances.displayLocalBalance;
            displayRemoteBalance = projectedBalances.displayRemoteBalance;

            const capacities = this.calculateChannelCapacities(
                displayLocalBalance,
                displayRemoteBalance,
                Number(channel.localReserveBalance) || 0,
                Number(channel.remoteReserveBalance) || 0
            );

            displaySendingCapacity = capacities.sendingCapacity;
            displayReceivingCapacity = capacities.receivingCapacity;
        }

        return {
            displayLocalBalance,
            displayRemoteBalance,
            displaySendingCapacity,
            displayReceivingCapacity
        };
    };

    private renderChannelItem = (
        channel: Channel,
        type?: ChannelType
    ): React.ReactElement => {
        // Use helper method for balance calculations - DRY principle
        const balanceData = this.createBalanceDisplayData(channel, type);

        return (
            <View
                style={[
                    styles.channelInfo,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <ChannelItem
                    title={channel.displayName}
                    localBalance={balanceData.displayLocalBalance}
                    remoteBalance={balanceData.displayRemoteBalance}
                    sendingCapacity={balanceData.displaySendingCapacity}
                    receivingCapacity={balanceData.displayReceivingCapacity}
                    outboundReserve={channel.localReserveBalance}
                    inboundReserve={channel.remoteReserveBalance}
                    isBelowReserve={channel.isBelowReserve}
                    selected={false}
                />
            </View>
        );
    };

    private renderChannelSelectionSection = (
        type: ChannelType,
        selectedChannel: Channel | null,
        onChannelSelect: (channels: Channel[]) => void
    ): React.ReactElement => {
        const titleKey =
            type === 'source'
                ? 'views.Routing.RoutingEvent.sourceChannel'
                : 'views.Routing.RoutingEvent.destinationChannel';
        const selectKey =
            type === 'source'
                ? 'views.Rebalance.selectSource'
                : 'views.Rebalance.selectDestination';

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    {localeString(titleKey)}
                </Text>
                {!selectedChannel && (
                    <HopPicker
                        title={localeString(selectKey)}
                        onValueChange={onChannelSelect}
                        ChannelsStore={this.props.ChannelsStore}
                        UnitsStore={this.props.UnitsStore}
                        selectionMode="single"
                    />
                )}
                {selectedChannel &&
                    this.renderChannelItem(selectedChannel, type)}
            </View>
        );
    };

    private renderBalanceAdjustmentSection = (): React.ReactElement => {
        const { rebalanceAmount } = this.state;

        return (
            <View style={styles.section}>
                <Text style={{ ...styles.sectionTitle, marginBottom: 10 }}>
                    {localeString('views.Rebalance.balanceAdjustment')}
                </Text>

                {/* Current rebalance amount */}
                <View
                    style={[
                        styles.rebalanceAmountDisplay,
                        { backgroundColor: themeColor('highlight') }
                    ]}
                >
                    <Text style={styles.rebalanceAmountLabel}>
                        {localeString('views.Rebalance.rebalanceAmount') +
                            ' : '}
                    </Text>
                    <Amount
                        sats={rebalanceAmount}
                        sensitive
                        color={themeColor('background')}
                    />
                </View>

                {/* Balance adjustment slider */}
                <View>
                    <Text style={styles.sliderDescription}>
                        {localeString('views.Rebalance.sliderDescription')}
                    </Text>
                    <View style={styles.sliderWithResetContainer}>
                        <Slider
                            style={styles.balanceSlider}
                            minimumValue={0}
                            maximumValue={this.state.maxAmount}
                            value={this.state.balanceSliderValue}
                            onValueChange={this.onBalanceSliderChange}
                            minimumTrackTintColor={themeColor('highlight')}
                            maximumTrackTintColor={themeColor('secondary')}
                        />
                        <TouchableOpacity
                            style={[
                                styles.refreshButton,
                                { backgroundColor: themeColor('secondary') }
                            ]}
                            onPress={this.resetBalances}
                        >
                            <SyncIcon
                                width={20}
                                height={20}
                                fill={themeColor('text')}
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    // Advanced settings
    private renderAdvancedSettings = (): React.ReactElement => {
        const { showAdvanced, feeLimit, timeoutSeconds } = this.state;

        return (
            <>
                <TouchableOpacity
                    onPress={() =>
                        this.setState({ showAdvanced: !showAdvanced })
                    }
                >
                    <View style={{ marginBottom: 10 }}>
                        <Row justify="space-between">
                            <View style={{ width: '95%' }}>
                                <KeyValue
                                    keyValue={localeString(
                                        'general.advancedSettings'
                                    )}
                                />
                            </View>
                            {showAdvanced ? (
                                <CaretDown
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            ) : (
                                <CaretRight
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            )}
                        </Row>
                    </View>
                </TouchableOpacity>

                {showAdvanced && (
                    <>
                        {this.renderNumericInput(
                            localeString('views.PaymentRequest.feeLimit') +
                                ' (sats)',
                            feeLimit,
                            REBALANCE_CONSTANTS.DEFAULT_FEE_LIMIT,
                            (text: string) => this.setState({ feeLimit: text })
                        )}
                        {this.renderNumericInput(
                            localeString('views.PaymentRequest.timeout'),
                            timeoutSeconds.toString(),
                            REBALANCE_CONSTANTS.DEFAULT_TIMEOUT,
                            (text: string) =>
                                this.setState({ timeoutSeconds: text })
                        )}
                    </>
                )}
            </>
        );
    };

    private renderNumericInput = (
        label: string,
        value: string,
        placeholder: string,
        onChangeText: (text: string) => void
    ): React.ReactElement => (
        <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>{label}</Text>
            <TextInput
                keyboardType="numeric"
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                textInputStyle={{
                    borderColor: themeColor('secondary'),
                    fontSize: 16,
                    color: themeColor('text')
                }}
            />
        </View>
    );

    subscribePayment = (streamingCall: string) => {
        const { handlePayment, handlePaymentError } =
            this.props.TransactionsStore;
        const { LncModule } = NativeModules;
        const eventEmitter = new NativeEventEmitter(LncModule);

        this.cleanupPaymentListener();

        return new Promise((resolve, reject) => {
            this.listener = eventEmitter.addListener(
                streamingCall,
                (event: any) => {
                    if (event.result && event.result !== 'EOF') {
                        try {
                            const result =
                                typeof event.result === 'string'
                                    ? JSON.parse(event.result)
                                    : event.result;

                            console.log('Rebalance payment update:', result);

                            // Process final payment status
                            if (result && result.status !== 'IN_FLIGHT') {
                                handlePayment(result);

                                this.cleanupPaymentListener();

                                if (result.status === 'SUCCEEDED') {
                                    const formattedResult = {
                                        payment_hash: result.payment_hash,
                                        payment_preimage:
                                            result.payment_preimage,
                                        value_sat: result.value_sat,
                                        fee_sat: result.fee_sat,
                                        status: 'complete',
                                        creation_date: result.creation_date,
                                        htlcs: result.htlcs
                                    };
                                    resolve(formattedResult);
                                } else {
                                    reject(
                                        new Error(
                                            result.failure_reason ||
                                                'Payment failed'
                                        )
                                    );
                                }
                            }
                        } catch (error: any) {
                            console.error(
                                'Error parsing payment update:',
                                error
                            );
                            handlePaymentError(error);
                            this.cleanupPaymentListener();
                            reject(error);
                        }
                    }
                }
            );

            // Timeout to prevent hanging forever
            const timeoutMs = Number(this.state.timeoutSeconds) * 1000;
            this.paymentTimeoutId = setTimeout(() => {
                if (this.listener) {
                    const timeoutError = new Error(
                        'Payment timed out waiting for final status'
                    );
                    handlePaymentError(timeoutError);
                    this.cleanupPaymentListener();
                    reject(timeoutError);
                }
            }, timeoutMs + 5000); // 5 seconds buffer to the timeout
        });
    };

    private cleanupPaymentListener = () => {
        if (this.listener) {
            this.listener.remove();
            this.listener = null;
        }

        if (this.paymentTimeoutId) {
            clearTimeout(this.paymentTimeoutId);
            this.paymentTimeoutId = null;
        }
    };

    render() {
        const { navigation } = this.props;
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount,
            executing
        } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Rebalance.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        executing ? (
                            <View style={styles.headerLoading}>
                                <LoadingIndicator size={30} />
                            </View>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <View
                    style={[
                        styles.contentContainer,
                        executing && styles.disabledContent
                    ]}
                    pointerEvents={executing ? 'none' : 'auto'}
                >
                    <ScrollView
                        style={styles.container}
                        keyboardShouldPersistTaps="handled"
                        scrollEnabled={!executing}
                    >
                        {/* Source Channel Selection */}
                        {this.renderChannelSelectionSection(
                            'source',
                            selectedSourceChannel,
                            this.onSourceChannelSelect
                        )}

                        {/* Destination Channel Selection */}
                        {this.renderChannelSelectionSection(
                            'destination',
                            selectedDestinationChannel,
                            this.onDestinationChannelSelect
                        )}

                        {/* Balance Adjustment Section */}
                        {selectedSourceChannel &&
                            selectedDestinationChannel &&
                            this.renderBalanceAdjustmentSection()}

                        {/* Advanced Settings */}
                        {this.renderAdvancedSettings()}

                        {/* Execute Button */}
                        <View style={styles.buttonContainer}>
                            <Button
                                title={
                                    executing
                                        ? localeString(
                                              'views.Rebalance.executing'
                                          ) + '...'
                                        : localeString(
                                              'views.Rebalance.executeRebalance'
                                          )
                                }
                                onPress={this.executeRebalance}
                                disabled={
                                    !selectedSourceChannel ||
                                    !selectedDestinationChannel ||
                                    rebalanceAmount <= 0 ||
                                    executing
                                }
                            />
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    section: {
        marginBottom: 24
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        fontFamily: 'PPNeueMontreal-Book'
    },
    description: {
        fontSize: 14,
        marginBottom: 15,
        fontFamily: 'PPNeueMontreal-Book'
    },
    channelInfo: {
        padding: 6,
        borderRadius: 10,
        marginTop: 5
    },
    channelName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    amountContainer: {
        alignItems: 'center'
    },
    amountText: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        fontFamily: 'PPNeueMontreal-Book'
    },
    slider: {
        width: '100%',
        height: 40
    },
    sliderLabel: {
        fontSize: 12,
        fontFamily: 'PPNeueMontreal-Book'
    },
    projectionContainer: {
        gap: 20
    },
    projectionChannel: {
        padding: 15,
        borderRadius: 10
    },
    projectionLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    inputContainer: {
        marginBottom: 8
    },
    inputLabel: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    textInput: {
        fontSize: 16
    },
    buttonContainer: {
        marginTop: 30,
        marginBottom: 50
    },
    sliderWithResetContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5
    },
    sliderDescription: {
        fontSize: 14,
        marginBottom: 10,
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Book'
    },
    balanceSlider: {
        flex: 1,
        height: 40,
        marginRight: 10
    },
    refreshButton: {
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    },
    rebalanceAmountDisplay: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15
    },
    rebalanceAmountLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'PPNeueMontreal-Book'
    },
    headerLoading: {
        marginRight: 10
    },
    contentContainer: {
        flex: 1
    },
    disabledContent: {
        opacity: 0.5
    }
});
