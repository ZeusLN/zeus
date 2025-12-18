import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Alert,
    NativeModules,
    NativeEventEmitter,
    EmitterSubscription
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import BigNumber from 'bignumber.js';

import Button from '../../components/Button';
import Header from '../../components/Header';
import HopPicker from '../../components/HopPicker';
import KeyValue from '../../components/KeyValue';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import { Row } from '../../components/layout/Row';

import ChannelsStore from '../../stores/ChannelsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import SettingsStore from '../../stores/SettingsStore';
import UnitsStore from '../../stores/UnitsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';

import { themeColor } from '../../utils/ThemeUtils';
import Channel from '../../models/Channel';
import { ChannelItem } from '../../components/Channels/ChannelItem';

import SyncIcon from '../../assets/images/SVG/Sync.svg';
import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import CloseIcon from '../../assets/images/SVG/Close.svg';

const REBALANCE_CONSTANTS = {
    DEFAULT_FEE_LIMIT: '100',
    DEFAULT_TIMEOUT: '120',
    DEFAULT_SLIDER_VALUE: 0,
    MAX_PAYMENT_PARTS: 5,
    PAYMENT_CHECK_DELAY: 3000,
    MIN_REBALANCE_AMOUNT: 1,
    CIRCULAR_LAYER_NAME: 'circular-rebalance',
    BALANCE_PRECISION: 3,
    MSAT_MULTIPLIER: 1000,
    DEFAULT_CLN_CLTV_EXPIRY: 144,
    TIMEOUT_BUFFER_MS: 5000
} as const;

const calculateProjectedBalance = (
    currentBalance: number,
    amount: number,
    isSource: boolean
): number => {
    const balance = new BigNumber(currentBalance);
    return isSource
        ? Math.max(0, balance.minus(amount).toNumber())
        : balance.plus(amount).toNumber();
};

const formatBalanceDisplay = (value: number): number => {
    return Number(
        new BigNumber(value).toFixed(REBALANCE_CONSTANTS.BALANCE_PRECISION)
    );
};

const calculateCapacity = (balance: number, reserve: number): number => {
    return Math.max(0, new BigNumber(balance).minus(reserve).toNumber());
};

export enum PaymentStatus {
    SUCCEEDED = 'SUCCEEDED',
    COMPLETE = 'complete',
    FAILED = 'FAILED',
    IN_FLIGHT = 'IN_FLIGHT',
    UNKNOWN = 'UNKNOWN'
}

type ChannelType = 'source' | 'destination';

interface InvoiceData {
    payment_request?: string;
    bolt11?: string;
    payment_hash: string;
    payment_secret?: string;
    min_final_cltv_expiry?: number;
}

interface PaymentResult {
    status?: string;
    state?: string;
    failure_reason?: string;
    failure_string?: string;
    payment_hash?: string;
    payment_preimage?: string;
    payment_route?: any;
    route?: any;
    route_details?: any;
    attempts?: any;
    fee_sat?: number;
    fee?: number;
    fee_msat?: number;
    value_sat?: number;
    creation_date?: number;
    htlcs?: any;
    preimage?: string;
    result?: any;
    payment_error?: string;
}

interface RebalanceResultData {
    success: boolean;
    error?: string;
    sourceChannel: Channel;
    destinationChannel: Channel;
    rebalanceAmount: number;
    fee?: number;
    paymentPreimage?: string;
    paymentHash?: string;
    paymentRoute?: any;
    route?: any;
    isProcessing?: boolean;
}

interface RebalanceProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'Rebalance',
        { restoreRebalanceState?: Partial<RebalanceState> }
    >;
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
    originalSourceBalance: number;
    originalDestinationBalance: number;
    totalBalance: number;
    balanceSliderValue: number;
    preciseAmount: string;
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
    private listener: EmitterSubscription | null = null;
    private paymentTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private navigationUnsubscribe: (() => void) | null = null;

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
            originalSourceBalance: 0,
            originalDestinationBalance: 0,
            totalBalance: 0,
            balanceSliderValue: REBALANCE_CONSTANTS.DEFAULT_SLIDER_VALUE,
            preciseAmount: '0'
        };
    }

    componentDidMount() {
        const { ChannelsStore, navigation } = this.props;

        this.cleanupPaymentListener();

        if (!ChannelsStore.channels || ChannelsStore.channels.length === 0) {
            ChannelsStore.getChannels();
        }

        const unsubscribe = navigation.addListener('focus', () => {
            ChannelsStore.getChannels();

            // Check if we need to restore state from route params
            const restoreStateParam =
                this.props.route?.params?.restoreRebalanceState;
            if (restoreStateParam) {
                this.restoreRebalanceState(restoreStateParam);
            }
        });

        this.navigationUnsubscribe = unsubscribe;

        // Check for state restoration parameters on initial mount
        const restoreStateParam =
            this.props.route?.params?.restoreRebalanceState;
        if (restoreStateParam) {
            this.restoreRebalanceState(restoreStateParam);
        }
    }

    private restoreRebalanceState = (
        restoredState: Partial<RebalanceState>
    ) => {
        this.setState(restoredState as RebalanceState, () => {
            this.updateDerivedState();

            const { rebalanceAmount } = this.state;
            if (rebalanceAmount > 0) {
                this.updateStateWithCallback({
                    balanceSliderValue: rebalanceAmount
                });
            }

            this.props.navigation.setParams({
                restoreRebalanceState: undefined
            });
        });
    };

    componentWillUnmount() {
        this.cleanupPaymentListener();

        if (this.navigationUnsubscribe) {
            this.navigationUnsubscribe();
        }
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

        const projectedSourceBalance = calculateProjectedBalance(
            Number(selectedSourceChannel.localBalance),
            rebalanceAmount,
            true
        );
        const projectedDestinationBalance = calculateProjectedBalance(
            Number(selectedDestinationChannel.localBalance),
            rebalanceAmount,
            false
        );

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
            stateUpdates.projectedSourceBalance = localBalance;
        } else {
            stateUpdates.selectedDestinationChannel = channel;
            stateUpdates.originalDestinationBalance = localBalance;
            stateUpdates.projectedDestinationBalance = localBalance;
        }

        this.updateStateWithCallback(stateUpdates, () => {
            this.updateDerivedState();
        });
    };

    private handleChannelUnselect = (type: ChannelType) => {
        const stateUpdates: Partial<RebalanceState> = {
            rebalanceAmount: 0,
            maxAmount: 0,
            balanceSliderValue: 0,
            projectedSourceBalance: 0,
            projectedDestinationBalance: 0,
            preciseAmount: '0'
        };

        if (type === 'source') {
            stateUpdates.selectedSourceChannel = null;
            stateUpdates.originalSourceBalance = 0;
        } else {
            stateUpdates.selectedDestinationChannel = null;
            stateUpdates.originalDestinationBalance = 0;
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

    private validateChannelCapacity = (
        channel: Channel,
        type: ChannelType
    ): boolean => {
        const isSource = type === 'source';
        const capacity = isSource
            ? Number(channel.sendingCapacity) || 0
            : Number(channel.receivingCapacity) || 0;

        if (capacity <= 0) {
            const channelTypeLabel = isSource
                ? localeString('views.Settings.Currency.source')
                : localeString('general.destination');
            const liquidityType = isSource
                ? localeString('views.Rebalance.liquidityType.outbound')
                : localeString('views.Rebalance.liquidityType.inbound');
            const actionRequired = isSource
                ? localeString('views.Rebalance.actionRequired.outbound')
                : localeString('views.Rebalance.actionRequired.inbound');

            const message = localeString(
                'views.Rebalance.error.insufficientCapacity'
            )
                .replace('{channelType}', channelTypeLabel)
                .replace('{channelName}', channel.displayName || '')
                .replace('{liquidityType}', liquidityType)
                .replace('{actionRequired}', actionRequired);

            this.createAlert(localeString('general.error'), message, [
                { text: localeString('general.ok') }
            ]);
            return false;
        }
        return true;
    };

    onSourceChannelSelect = (channels: Channel[]) => {
        this.handleChannelSelect(channels[0], 'source');
    };

    onDestinationChannelSelect = (channels: Channel[]) => {
        this.handleChannelSelect(channels[0], 'destination');
    };

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
                projectedSourceBalance: sourceBalance,
                projectedDestinationBalance: destBalance,
                totalBalance: total,
                balanceSliderValue: 0
            });
        }
    };

    onBalanceSliderChange = (value: number) => {
        const { originalSourceBalance, originalDestinationBalance } =
            this.state;

        const rebalanceAmount = Math.round(value);

        const projectedSourceBalance = calculateProjectedBalance(
            originalSourceBalance,
            rebalanceAmount,
            true
        );
        const projectedDestinationBalance = calculateProjectedBalance(
            originalDestinationBalance,
            rebalanceAmount,
            false
        );

        this.updateStateWithCallback({
            balanceSliderValue: value,
            rebalanceAmount,
            projectedSourceBalance,
            projectedDestinationBalance,
            preciseAmount: numberWithCommas(rebalanceAmount)
        });
    };

    resetSlider = () => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            originalSourceBalance,
            originalDestinationBalance
        } = this.state;

        if (selectedSourceChannel && selectedDestinationChannel) {
            this.updateStateWithCallback({
                balanceSliderValue: 0,
                rebalanceAmount: 0,
                projectedSourceBalance: originalSourceBalance,
                projectedDestinationBalance: originalDestinationBalance,
                preciseAmount: '0'
            });
        }
    };

    onPreciseAmountChange = (text: string) => {
        const sanitizedValue = text.replace(/[^\d.]/g, '');

        const cleanValue = sanitizedValue
            .replace(/,/g, '')
            .replace(/\.{2,}/g, '.')
            .replace(/^\./, '0.')
            .replace(/(\.\d*)\./g, '$1');

        if (cleanValue === '' || cleanValue === '0.') {
            this.updateStateWithCallback({
                preciseAmount: cleanValue,
                rebalanceAmount: 0,
                balanceSliderValue: 0,
                projectedSourceBalance: this.state.originalSourceBalance,
                projectedDestinationBalance:
                    this.state.originalDestinationBalance
            });
            return;
        }

        const amount = parseFloat(cleanValue) || 0;
        const { maxAmount } = this.state;
        const validatedAmount = Math.min(amount, maxAmount);

        let displayValue: string;
        if (amount <= maxAmount) {
            displayValue = cleanValue;
        } else {
            displayValue = maxAmount.toString();
        }

        const { originalSourceBalance, originalDestinationBalance } =
            this.state;
        const projectedSourceBalance = calculateProjectedBalance(
            originalSourceBalance,
            validatedAmount,
            true
        );
        const projectedDestinationBalance = calculateProjectedBalance(
            originalDestinationBalance,
            validatedAmount,
            false
        );

        this.updateStateWithCallback({
            preciseAmount: displayValue,
            rebalanceAmount: validatedAmount,
            balanceSliderValue: validatedAmount,
            projectedSourceBalance,
            projectedDestinationBalance
        });
    };

    executeRebalance = async () => {
        if (
            !this.validateChannelSelection() ||
            !this.validateRebalanceAmount()
        ) {
            return;
        }

        const processingRebalanceData = this.createRebalanceResult(
            false,
            undefined,
            undefined,
            true
        );
        this.navigateToSendingRebalance(processingRebalanceData);

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

    private createRebalanceInvoice = async (): Promise<InvoiceData> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error(
                localeString('views.Rebalance.error.channelNotSelected')
            );
        }

        const memo = this.generateInvoiceMemo(
            selectedSourceChannel,
            selectedDestinationChannel
        );

        try {
            const invoiceResult = await BackendUtils.createInvoice({
                memo,
                value: rebalanceAmount,
                private: true
            });
            return invoiceResult;
        } catch (error) {
            console.error('[Rebalance] Invoice creation FAILED:', error);
            throw new Error(
                localeString('views.Rebalance.error.createInvoice')
            );
        }
    };

    private generateInvoiceMemo = (
        sourceChannel: Channel,
        destChannel: Channel
    ): string => {
        return (
            localeString('views.Rebalance.memo') +
            ' ' +
            sourceChannel.remotePubkey +
            ' -> ' +
            destChannel.remotePubkey
        );
    };

    private executePayment = async (
        invoiceData: InvoiceData
    ): Promise<PaymentResult> => {
        const { selectedSourceChannel, selectedDestinationChannel } =
            this.state;
        const { SettingsStore } = this.props;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error(
                localeString('views.Rebalance.error.channelNotSelected')
            );
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
                        return (await this.subscribePayment(
                            result
                        )) as PaymentResult;
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

    private handleBackendError = (error: any, backendType: string): never => {
        console.error(`[${backendType} Rebalance] FAILED:`, {
            error: error.message,
            stack: error.stack,
            code: error.code,
            details: error
        });

        if (error.message && typeof error.message === 'string') {
            const errorMessage = error.message.toLowerCase();
            if (errorMessage.includes('timeout_seconds must be specified')) {
                throw new Error(
                    localeString('views.Rebalance.error.invalidTimeout')
                );
            } else if (
                errorMessage.includes('invalid') ||
                errorMessage.includes('must be') ||
                errorMessage.includes('required') ||
                errorMessage.includes('should be')
            ) {
                throw new Error(error.message);
            }
        }

        // For other errors, use our localized message
        throw new Error(localeString('views.Rebalance.error.paymentExecution'));
    };

    private executeClnRestRebalance = async (
        invoiceData: InvoiceData
    ): Promise<PaymentResult> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            feeLimit,
            rebalanceAmount
        } = this.state;
        const { NodeInfoStore } = this.props;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error(
                localeString('views.Rebalance.error.channelNotSelected')
            );
        }

        const ownNodePubkey =
            NodeInfoStore.nodeInfo?.identity_pubkey ||
            NodeInfoStore.nodeInfo?.id;

        try {
            try {
                await BackendUtils.askReneRemoveLayer({
                    layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME
                });
            } catch (removeError) {
                console.error('No existing layer to remove (expected)');
            }

            await BackendUtils.askReneCreateLayer({
                layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME
            });

            const allChannels = this.getAvailableChannels();

            for (const channel of allChannels) {
                if (
                    channel.short_channel_id !==
                    selectedDestinationChannel.short_channel_id
                ) {
                    const outgoingDirection =
                        ownNodePubkey < channel.remotePubkey ? '0' : '1';
                    const incomingDirection =
                        ownNodePubkey < channel.remotePubkey ? '1' : '0';

                    await BackendUtils.askReneUpdateChannel({
                        short_channel_id_dir: `${channel.short_channel_id}/${outgoingDirection}`,
                        layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME,
                        enabled: false
                    });

                    await BackendUtils.askReneUpdateChannel({
                        short_channel_id_dir: `${channel.short_channel_id}/${incomingDirection}`,
                        layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME,
                        enabled: false
                    });
                }
            }

            const routeParams = {
                source: selectedSourceChannel.remotePubkey,
                destination: ownNodePubkey,
                amount_msat: new BigNumber(rebalanceAmount)
                    .multipliedBy(REBALANCE_CONSTANTS.MSAT_MULTIPLIER)
                    .toNumber(),
                maxfee_msat: new BigNumber(feeLimit)
                    .multipliedBy(REBALANCE_CONSTANTS.MSAT_MULTIPLIER)
                    .toNumber(),
                layers: [REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME],
                final_cltv:
                    invoiceData.min_final_cltv_expiry ||
                    REBALANCE_CONSTANTS.DEFAULT_CLN_CLTV_EXPIRY
            };

            const routeResponse = await BackendUtils.getRoutes(routeParams);

            if (!routeResponse.routes || routeResponse.routes.length === 0) {
                throw new Error(localeString('views.Rebalance.error.noRoute'));
            }

            const partialRoute = routeResponse.routes[0].path;
            const completeRoute = [];

            completeRoute.push({
                amount_msat: partialRoute[0].amount_msat,
                delay: partialRoute[0].delay,
                id: selectedSourceChannel.remotePubkey,
                channel: selectedSourceChannel.short_channel_id
            });

            for (let i = 0; i < partialRoute.length; i++) {
                const hop = partialRoute[i];
                completeRoute.push({
                    amount_msat:
                        i === partialRoute.length - 1
                            ? routeResponse.routes[0].amount_msat
                            : partialRoute[i + 1].amount_msat,
                    delay:
                        i === partialRoute.length - 1
                            ? routeResponse.routes[0].final_cltv
                            : partialRoute[i + 1].delay,
                    id: hop.next_node_id,
                    channel: hop.short_channel_id_dir.split('/')[0]
                });
            }

            const sendPayParams = {
                route: completeRoute,
                payment_hash: invoiceData.payment_hash,
                payment_secret: invoiceData.payment_secret,
                bolt11: invoiceData.bolt11
            };

            await BackendUtils.sendPay(sendPayParams);

            const waitResponse = await BackendUtils.waitSendPay({
                payment_hash: invoiceData.payment_hash
            });

            return waitResponse;
        } catch (error: any) {
            this.handleBackendError(error, 'CLN');
            throw error;
        } finally {
            try {
                await BackendUtils.askReneRemoveLayer({
                    layer: REBALANCE_CONSTANTS.CIRCULAR_LAYER_NAME
                });
            } catch (cleanupError) {
                console.error(
                    '[CLN Rebalance] Cleanup: Error removing layer:',
                    cleanupError
                );
            }
        }
    };

    private executeLndRebalance = async (
        invoiceData: InvoiceData
    ): Promise<PaymentResult> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            feeLimit,
            timeoutSeconds
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error(
                localeString('views.Rebalance.error.channelNotSelected')
            );
        }

        const channelIdString = selectedSourceChannel.channelId;
        if (!channelIdString) {
            throw new Error(
                localeString('views.Rebalance.error.channelIdMissing')
            );
        }

        const paymentParams = {
            payment_request: invoiceData.payment_request,
            outgoing_chan_ids: [channelIdString],
            last_hop_pubkey: Buffer.from(
                selectedDestinationChannel.remotePubkey,
                'hex'
            ).toString('base64'),
            fee_limit_sat: Number(feeLimit),
            allow_self_payment: true,
            timeout_seconds: Number(timeoutSeconds),
            max_parts: REBALANCE_CONSTANTS.MAX_PAYMENT_PARTS
        };

        try {
            const result = await BackendUtils.payLightningInvoice(
                paymentParams
            );
            return result;
        } catch (error: any) {
            this.handleBackendError(error, 'LND');
            throw error;
        }
    };

    private handlePaymentResult = (result: PaymentResult) => {
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

    private handleClnRestPaymentResult = (result: PaymentResult) => {
        if (result && result.status === PaymentStatus.COMPLETE) {
            this.handleSuccessfulPayment(result);
        } else if (result && result.status === 'failed') {
            const errorMessage = `${localeString(
                'views.Rebalance.error.paymentFailed'
            )}: ${result.failure_reason || localeString('general.unknown')}`;
            const rebalanceData = this.createRebalanceResult(
                false,
                errorMessage,
                result
            );
            this.navigateToSendingRebalance(rebalanceData);
        } else {
            const rebalanceData = this.createRebalanceResult(
                false,
                localeString('views.Rebalance.error.paymentResultUnclear'),
                result
            );
            this.navigateToSendingRebalance(rebalanceData);
        }
    };

    private handleLncPaymentResult = (result: PaymentResult) => {
        if (!result) {
            this.handleUnclearPaymentStatus({ status: 'UNKNOWN' });
            return;
        }

        const status = result.status || result.state || PaymentStatus.UNKNOWN;

        switch (status) {
            case PaymentStatus.SUCCEEDED:
            case PaymentStatus.COMPLETE:
                this.handleSuccessfulPayment(result);
                break;

            case PaymentStatus.FAILED:
                this.handleFailedPayment({
                    failure_reason:
                        result.failure_reason ||
                        result.failure_string ||
                        localeString('views.Rebalance.error.paymentFailed')
                });
                break;

            case PaymentStatus.IN_FLIGHT:
                this.handleUnclearPaymentStatus(result);
                break;

            default:
                this.handleUnclearPaymentStatus(result);
                break;
        }
    };

    // LND payment result handler
    private handleLndPaymentResult = (result: PaymentResult) => {
        if (result && result.result) {
            this.handleDirectPaymentResult(result.result);
        } else if (result && result.payment_error) {
            const rebalanceData = this.createRebalanceResult(
                false,
                result.payment_error,
                result
            );
            this.navigateToSendingRebalance(rebalanceData);
        } else {
            this.handleFallbackPaymentCheck();
        }
    };

    // Direct payment result handler
    private handleDirectPaymentResult = (payment: PaymentResult) => {
        if (payment.status === PaymentStatus.SUCCEEDED) {
            this.handleSuccessfulPayment(payment);
        } else if (payment.status === PaymentStatus.FAILED) {
            this.handleFailedPayment(payment);
        } else {
            this.handleUnclearPaymentStatus(payment);
        }
    };

    // Successful payment handler
    private handleSuccessfulPayment = (paymentData?: PaymentResult) => {
        const { TransactionsStore } = this.props;

        if (paymentData?.payment_preimage || paymentData?.preimage) {
            TransactionsStore.payment_preimage =
                paymentData.payment_preimage || paymentData.preimage || null;
        }

        if (paymentData?.payment_hash) {
            TransactionsStore.payment_hash = paymentData.payment_hash;
        }

        if (paymentData?.payment_route || paymentData?.route) {
            TransactionsStore.payment_route =
                paymentData.payment_route || paymentData.route;
        }

        TransactionsStore.status = 'complete';
        TransactionsStore.loading = false;

        const rebalanceData = this.createRebalanceResult(
            true,
            undefined,
            paymentData
        );
        this.navigateToSendingRebalance(rebalanceData);
    };

    // Failed payment handler
    private handleFailedPayment = (payment: PaymentResult) => {
        this.props.TransactionsStore.loading = false;
        const errorMsg =
            payment.failure_reason ||
            localeString('views.Rebalance.error.paymentFailedUnknown');
        const rebalanceData = this.createRebalanceResult(
            false,
            errorMsg,
            payment
        );
        this.navigateToSendingRebalance(rebalanceData);
    };

    // Unclear payment status handler
    private handleUnclearPaymentStatus = (payment: PaymentResult) => {
        this.props.TransactionsStore.loading = false;
        const statusMessage = `${localeString(
            'views.Rebalance.status.message'
        )} : ${payment.status}\n${localeString(
            'views.Rebalance.checkYourTransactionHistory'
        )}`;
        const rebalanceData = this.createRebalanceResult(
            false,
            statusMessage,
            payment
        );
        this.navigateToSendingRebalance(rebalanceData);
    };

    private handleFallbackPaymentCheck = () => {
        const { TransactionsStore } = this.props;

        setTimeout(() => {
            TransactionsStore.loading = false;
            if (TransactionsStore.payment_error) {
                const rebalanceData = this.createRebalanceResult(
                    false,
                    TransactionsStore.payment_error
                );
                this.navigateToSendingRebalance(rebalanceData);
            } else if (TransactionsStore.payment_preimage) {
                const rebalanceData = this.createRebalanceResult(
                    true,
                    undefined,
                    {
                        payment_preimage: TransactionsStore.payment_preimage
                    }
                );
                this.navigateToSendingRebalance(rebalanceData);
            } else {
                const unclearMessage = `${localeString(
                    'views.Rebalance.status.unclearMessage'
                )}\n${localeString(
                    'views.Rebalance.checkYourTransactionHistory'
                )}`;
                const rebalanceData = this.createRebalanceResult(
                    false,
                    unclearMessage
                );
                this.navigateToSendingRebalance(rebalanceData);
            }
        }, REBALANCE_CONSTANTS.PAYMENT_CHECK_DELAY);
    };

    private handleRebalanceError = (error: any) => {
        this.props.TransactionsStore.loading = false;

        const errorMessage =
            error.message || localeString('views.Rebalance.error.generic');

        if (error.message && typeof error.message === 'string') {
            if (
                error.message.includes('no route') ||
                error.message.includes('NO_ROUTE') ||
                error.message.includes('unable to find a path')
            ) {
                this.props.TransactionsStore.loading = false;
                const localizedErrorMessage = localeString(
                    'views.Rebalance.error.noRoute'
                );
                const rebalanceData = this.createRebalanceResult(
                    false,
                    localizedErrorMessage
                );
                this.navigateToSendingRebalance(rebalanceData);
                return;
            }

            if (
                error.message.includes('insufficient') ||
                error.message.includes('INSUFFICIENT_BALANCE')
            ) {
                this.props.TransactionsStore.loading = false;
                const localizedErrorMessage = localeString(
                    'views.Rebalance.error.insufficientBalance'
                );
                const rebalanceData = this.createRebalanceResult(
                    false,
                    localizedErrorMessage
                );
                this.navigateToSendingRebalance(rebalanceData);
                return;
            }

            if (
                error.message.includes('fee') &&
                error.message.includes('limit')
            ) {
                const localizedErrorMessage = `${localeString(
                    'views.Rebalance.error.feeLimit'
                )}: ${error.message}`;
                const rebalanceData = this.createRebalanceResult(
                    false,
                    localizedErrorMessage
                );
                this.navigateToSendingRebalance(rebalanceData);
                return;
            }
        }

        const rebalanceData = this.createRebalanceResult(false, errorMessage);
        this.navigateToSendingRebalance(rebalanceData);
    };

    executeRebalanceWithParameters = async () => {
        this.props.TransactionsStore.loading = true;

        const initialRebalanceData = this.createRebalanceResult(
            false,
            localeString('general.processing') + '...',
            undefined
        );

        this.navigateToSendingRebalance(initialRebalanceData);

        try {
            // Step 1: Validate node info
            const ownPubkey = await this.validateNodeInfo();
            if (!ownPubkey) {
                this.props.TransactionsStore.loading = false;
                const errorData = this.createRebalanceResult(
                    false,
                    localeString('views.Rebalance.error.nodeInfo')
                );
                this.navigateToSendingRebalance(errorData);
                return;
            }

            // Step 2: Create invoice
            const invoiceData = await this.createRebalanceInvoice();
            if (!invoiceData) {
                this.props.TransactionsStore.loading = false;
                const errorData = this.createRebalanceResult(
                    false,
                    localeString('views.Rebalance.error.generic')
                );
                this.navigateToSendingRebalance(errorData);
                return;
            }

            // Step 3: Execute payment
            const result = await this.executePayment(invoiceData);

            // Step 4: Handle result - this will clear loading and navigate with final result
            this.handlePaymentResult(result);
        } catch (error: any) {
            console.error(
                '[Rebalance] EXCEPTION in executeRebalanceWithParameters:',
                error
            );
            this.props.TransactionsStore.loading = false;
            this.handleRebalanceError(error);
            this.cleanupPaymentListener();
        }
    };

    private calculateChannelCapacities = (
        localBalance: number,
        remoteBalance: number,
        localReserve: number,
        remoteReserve: number
    ) => ({
        sendingCapacity: calculateCapacity(localBalance, localReserve),
        receivingCapacity: calculateCapacity(remoteBalance, remoteReserve)
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
            displayLocalBalance: formatBalanceDisplay(displayLocalBalance),
            displayRemoteBalance: formatBalanceDisplay(displayRemoteBalance),
            displaySendingCapacity: formatBalanceDisplay(
                displaySendingCapacity
            ),
            displayReceivingCapacity: formatBalanceDisplay(
                displayReceivingCapacity
            )
        };
    };

    private renderChannelItem = (
        channel: Channel,
        type?: ChannelType
    ): React.ReactElement => {
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

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    {localeString(titleKey)}
                </Text>
                {!selectedChannel && (
                    <HopPicker
                        onValueChange={onChannelSelect}
                        ChannelsStore={this.props.ChannelsStore}
                        UnitsStore={this.props.UnitsStore}
                        selectionMode="single"
                        onChannelValidation={(channel: Channel) =>
                            this.validateChannelCapacity(channel, type)
                        }
                    />
                )}
                {selectedChannel && (
                    <View style={styles.selectedChannelContainer}>
                        {this.renderChannelItem(selectedChannel, type)}
                        <TouchableOpacity
                            style={styles.unselectButton}
                            onPress={() => this.handleChannelUnselect(type)}
                            accessibilityLabel={localeString(
                                'general.unselect'
                            )}
                            accessibilityHint={localeString(
                                'general.removeSelected'
                            )}
                        >
                            <CloseIcon
                                width={15}
                                height={15}
                                fill={themeColor('text')}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    private renderBalanceAdjustmentSection = (): React.ReactElement => {
        const { preciseAmount, maxAmount } = this.state;

        return (
            <View style={styles.section}>
                <Text style={{ ...styles.sectionTitle, marginBottom: 10 }}>
                    {localeString('views.Rebalance.balanceAdjustment')}
                </Text>

                {/* Precise Amount Input */}
                <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>
                        {localeString(
                            'views.Rebalance.preciseInputDescription'
                        )}
                    </Text>
                    <TextInput
                        keyboardType="numeric"
                        placeholder="0"
                        value={preciseAmount}
                        onChangeText={this.onPreciseAmountChange}
                        textInputStyle={{
                            borderColor: themeColor('secondary'),
                            fontSize: 16,
                            color: themeColor('text')
                        }}
                    />
                    <Row justify="space-between" style={{ marginVertical: 10 }}>
                        <Text
                            style={{
                                color: themeColor('text')
                            }}
                        >
                            0
                        </Text>
                        <Text
                            style={{
                                color: themeColor('text')
                            }}
                        >
                            {numberWithCommas(maxAmount)}
                        </Text>
                    </Row>
                </View>

                {/* Visual Slider */}
                <View>
                    <View style={styles.sliderWithResetContainer}>
                        <Slider
                            style={styles.balanceSlider}
                            minimumValue={0}
                            maximumValue={maxAmount}
                            value={this.state.balanceSliderValue}
                            onValueChange={this.onBalanceSliderChange}
                            minimumTrackTintColor={themeColor('highlight')}
                            maximumTrackTintColor={themeColor('secondary')}
                        />
                        <TouchableOpacity
                            onPress={this.resetSlider}
                            style={[
                                styles.resetButton,
                                { backgroundColor: themeColor('secondary') }
                            ]}
                        >
                            <SyncIcon
                                fill={themeColor('text')}
                                width={20}
                                height={20}
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
                                ' (' +
                                localeString('general.sats') +
                                ')',
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
                (event: { result?: string }) => {
                    if (event.result && event.result !== 'EOF') {
                        try {
                            const result =
                                typeof event.result === 'string'
                                    ? JSON.parse(event.result)
                                    : event.result;

                            // Process final payment status
                            if (result && result.status !== 'IN_FLIGHT') {
                                handlePayment(result);

                                this.cleanupPaymentListener();

                                if (result.status === PaymentStatus.SUCCEEDED) {
                                    const formattedResult = {
                                        payment_hash: result.payment_hash,
                                        payment_preimage:
                                            result.payment_preimage,
                                        value_sat: result.value_sat,
                                        fee_sat: result.fee_sat,
                                        status: PaymentStatus.COMPLETE,
                                        creation_date: result.creation_date,
                                        htlcs: result.htlcs
                                    };
                                    resolve(formattedResult);
                                } else {
                                    reject(
                                        new Error(
                                            result.failure_reason ||
                                                localeString(
                                                    'views.Rebalance.error.paymentFailed'
                                                )
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
            }, timeoutMs + REBALANCE_CONSTANTS.TIMEOUT_BUFFER_MS);
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

    // Navigation and result handling
    private createRebalanceResult = (
        success: boolean,
        error?: string,
        paymentData?: PaymentResult,
        isProcessing?: boolean
    ): RebalanceResultData => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount
        } = this.state;
        const { SettingsStore } = this.props;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error(
                localeString('views.Rebalance.error.channelNotSelected')
            );
        }

        let paymentRoute = null;

        if (paymentData && SettingsStore.implementation !== 'cln-rest') {
            paymentRoute = paymentData.route || paymentData.payment_route;

            if (!paymentRoute && paymentData.route_details) {
                paymentRoute = paymentData.route_details;
            }

            if (!paymentRoute && paymentData.attempts) {
                paymentRoute = paymentData.attempts;
            }
        }

        let fee = paymentData?.fee_sat || paymentData?.fee;

        if (
            !fee &&
            paymentData &&
            SettingsStore.implementation === 'cln-rest'
        ) {
            const paymentAny = paymentData as any;
            if (paymentAny.amount_sent_msat && paymentAny.amount_msat) {
                const amountSentMsat = Number(paymentAny.amount_sent_msat);
                const amountMsat = Number(paymentAny.amount_msat);
                fee = Math.floor((amountSentMsat - amountMsat) / 1000);
            }
        }

        const result = {
            success,
            error,
            sourceChannel: selectedSourceChannel,
            destinationChannel: selectedDestinationChannel,
            rebalanceAmount,
            fee,
            paymentPreimage:
                paymentData?.payment_preimage || paymentData?.preimage,
            paymentHash: paymentData?.payment_hash || undefined,
            paymentRoute,
            route: paymentRoute, // Also add as 'route' for additional compatibility
            isProcessing: isProcessing || false
        };

        return result;
    };

    private navigateToSendingRebalance = (
        rebalanceData: RebalanceResultData
    ) => {
        const currentRebalanceState = {
            selectedSourceChannel: this.state.selectedSourceChannel,
            selectedDestinationChannel: this.state.selectedDestinationChannel,
            rebalanceAmount: this.state.rebalanceAmount,
            maxAmount: this.state.maxAmount,
            feeLimit: this.state.feeLimit,
            timeoutSeconds: this.state.timeoutSeconds,
            showAdvanced: this.state.showAdvanced,
            executing: false, // Reset executing state
            projectedSourceBalance: this.state.projectedSourceBalance,
            projectedDestinationBalance: this.state.projectedDestinationBalance,
            originalSourceBalance: this.state.originalSourceBalance,
            originalDestinationBalance: this.state.originalDestinationBalance,
            totalBalance: this.state.totalBalance,
            balanceSliderValue: this.state.balanceSliderValue
        };

        this.props.navigation.navigate('RebalancingChannels', {
            rebalanceData,
            isRebalance: true,
            currentRebalanceState
        });

        this.setState({ executing: false });
    };

    render() {
        const { navigation } = this.props;
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            rebalanceAmount
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
                    navigation={navigation}
                />
                <View style={styles.contentContainer}>
                    <ScrollView
                        style={styles.container}
                        keyboardShouldPersistTaps="handled"
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
                                title={localeString(
                                    'views.Rebalance.executeRebalance'
                                )}
                                onPress={this.executeRebalance}
                                disabled={
                                    !selectedSourceChannel ||
                                    !selectedDestinationChannel ||
                                    rebalanceAmount <= 0
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
    channelInfo: {
        padding: 6,
        borderRadius: 10,
        marginTop: 5
    },
    inputContainer: {
        marginBottom: 2
    },
    inputLabel: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
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
    balanceSlider: {
        flex: 1,
        height: 40,
        marginRight: 10
    },
    contentContainer: {
        flex: 1
    },
    selectedChannelContainer: {
        position: 'relative'
    },
    unselectButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 8,
        zIndex: 1
    },
    resetButton: {
        padding: 8,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center'
    }
});
