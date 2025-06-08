import * as React from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    Alert
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

// Constants for rebalance configuration
const REBALANCE_CONSTANTS = {
    DEFAULT_FEE_LIMIT: '10',
    DEFAULT_TIMEOUT: '60',
    DEFAULT_SLIDER_VALUE: 0,
    MAX_PAYMENT_PARTS: 5,
    PAYMENT_CHECK_DELAY: 3000,
    MIN_REBALANCE_AMOUNT: 1
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
        // Ensure channels are loaded
        if (!ChannelsStore.channels || ChannelsStore.channels.length === 0) {
            ChannelsStore.getChannels();
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
                balanceSliderValue: 0, // Start at 0 (no rebalance)
                rebalanceAmount: 0,
                projectedSourceBalance: sourceBalance,
                projectedDestinationBalance: destBalance
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
        const ownPubkey = NodeInfoStore.nodeInfo?.identity_pubkey;

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

    // Payment execution
    private executePayment = async (invoiceData: any): Promise<any> => {
        const {
            selectedSourceChannel,
            selectedDestinationChannel,
            feeLimit,
            timeoutSeconds
        } = this.state;

        if (!selectedSourceChannel || !selectedDestinationChannel) {
            throw new Error('Channels not selected');
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
        this.createAlert(
            localeString('views.Rebalance.failed.title'),
            errorMsg
        );
    };

    // Unclear payment status handler
    private handleUnclearPaymentStatus = (payment: any) => {
        this.createAlert(
            localeString('views.Rebalance.status.title') +
                localeString('views.Rebalance.status.message') +
                ' : ',
            payment.status,
            localeString('views.Rebalance.checkYourTransactionHistory')
        );
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
            } else if (TransactionsStore.payment_preimage) {
                this.handleSuccessfulPayment();
            } else {
                this.createAlert(
                    localeString('views.Rebalance.status.unclear'),
                    localeString('views.Rebalance.status.unclearMessage'),
                    localeString('views.Rebalance.checkYourTransactionHistory')
                );
            }
        }, REBALANCE_CONSTANTS.PAYMENT_CHECK_DELAY);
    };

    // Error handling
    private handleRebalanceError = (error: any) => {
        console.log('Rebalance error:', error.message);

        if (error.message && error.message.includes('timeout')) {
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
        } else {
            this.showErrorAlert(
                error.message || localeString('views.Rebalance.error.generic')
            );
        }
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

            // Step 3: Execute payment
            const result = await this.executePayment(invoiceData);

            // Step 4: Handle result
            this.handlePaymentResult(result);
        } catch (error: any) {
            this.handleRebalanceError(error);
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
                <Text style={styles.sectionTitle}>
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
                    <Amount sats={rebalanceAmount} sensitive />
                </View>

                {/* Balance adjustment slider */}
                <View style={styles.balanceSliderContainer}>
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
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    {executing && (
                        <View style={styles.loadingContainer}>
                            <LoadingIndicator />
                            <Text style={styles.loadingText}>
                                {localeString('views.Rebalance.executing') +
                                    '...'}
                            </Text>
                        </View>
                    )}

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
                                rebalanceAmount <= 0 ||
                                executing
                            }
                        />
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 20
    },
    loadingText: {
        marginTop: 10,
        fontFamily: 'PPNeueMontreal-Book'
    },
    section: {
        marginBottom: 15
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
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
        marginBottom: 15
    },
    inputLabel: {
        fontSize: 14,
        marginBottom: 5,
        fontFamily: 'PPNeueMontreal-Book'
    },
    textInput: {
        fontSize: 16
    },
    buttonContainer: {
        marginTop: 30,
        marginBottom: 50
    },
    // Balance adjustment styles
    balanceAdjustmentContainer: {
        padding: 15,
        borderRadius: 10,
        marginBottom: 15
    },
    channelBalanceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    channelLabel: {
        fontSize: 14,
        fontFamily: 'PPNeueMontreal-Book'
    },
    balanceSliderContainer: {
        marginBottom: 15
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
    resetButtonContainer: {
        alignItems: 'center'
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
    }
});
