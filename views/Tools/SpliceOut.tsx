import * as React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Amount from '../../components/Amount';
import Button from '../../components/Button';
import Header from '../../components/Header';
import HopPicker from '../../components/HopPicker';
import Screen from '../../components/Screen';
import Switch from '../../components/Switch';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import KeyValue from '../../components/KeyValue';
import LoadingIndicator from '../../components/LoadingIndicator';
import {
    SuccessMessage,
    ErrorMessage,
    WarningMessage
} from '../../components/SuccessErrorMessage';

import SpliceStore from '../../stores/SpliceStore';
import ChannelsStore from '../../stores/ChannelsStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import ActivityStore from '../../stores/ActivityStore';
import UnitsStore from '../../stores/UnitsStore';
import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';

import { themeColor } from '../../utils/ThemeUtils';
import Channel from '../../models/Channel';
import { ChannelItem } from '../../components/Channels/ChannelItem';

import CloseIcon from '../../assets/images/SVG/Close.svg';

interface SpliceOutProps {
    navigation: StackNavigationProp<any, any>;
    SpliceStore: SpliceStore;
    ChannelsStore: ChannelsStore;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
    ActivityStore: ActivityStore;
    UnitsStore: UnitsStore;
}

interface SpliceOutState {
    selectedChannel: Channel | null;
    amount: string;
    destination: string;
    feeRate: string;
    forceFeerate: boolean;
    step: 'input' | 'confirm' | 'executing' | 'complete';
    error: string;
}

@inject(
    'SpliceStore',
    'ChannelsStore',
    'SettingsStore',
    'TransactionsStore',
    'ActivityStore',
    'UnitsStore'
)
@observer
export default class SpliceOut extends React.Component<
    SpliceOutProps,
    SpliceOutState
> {
    componentDidUpdate(_prevProps: SpliceOutProps, prevState: SpliceOutState) {
        if (this.state.step === 'complete' && prevState.step !== 'complete') {
            try {
                const { TransactionsStore, ActivityStore, SettingsStore } =
                    this.props;
                TransactionsStore.getTransactions();
                ActivityStore.getActivityAndFilter(
                    SettingsStore.settings.locale
                );
            } catch (e) {
                console.log(
                    '[SpliceOut] Error refreshing activity after splice:',
                    e
                );
            }
        }
    }
    state = {
        selectedChannel: null as Channel | null,
        amount: '',
        destination: 'wallet',
        feeRate: '2',
        forceFeerate: false,
        step: 'input' as 'input' | 'confirm' | 'executing' | 'complete',
        error: ''
    };

    componentDidMount() {
        if (!BackendUtils.supportsSplicing()) {
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.splicingNotSupported'
                )
            });
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

    onChannelSelect = (channels: Channel[]) => {
        if (channels.length > 0) {
            this.setState({
                selectedChannel: channels[0],
                error: ''
            });
        }
    };

    handleChannelUnselect = () => {
        this.setState({
            selectedChannel: null,
            error: ''
        });
    };

    renderChannelItem = (channel: Channel): React.ReactElement => {
        return (
            <View
                style={[
                    styles.channelInfo,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <ChannelItem
                    title={channel.displayName}
                    localBalance={channel.localBalance}
                    remoteBalance={channel.remoteBalance}
                    sendingCapacity={channel.sendingCapacity}
                    receivingCapacity={channel.receivingCapacity}
                    outboundReserve={channel.localReserveBalance}
                    inboundReserve={channel.remoteReserveBalance}
                    isBelowReserve={channel.isBelowReserve}
                    selected={false}
                />
            </View>
        );
    };

    renderChannelSelectionSection = (): React.ReactElement => {
        const { selectedChannel } = this.state;

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{`${localeString(
                    'components.ChannelPicker.modal.title'
                )}:`}</Text>
                {!selectedChannel && (
                    <HopPicker
                        onValueChange={this.onChannelSelect}
                        ChannelsStore={this.props.ChannelsStore}
                        UnitsStore={this.props.UnitsStore}
                        selectionMode="single"
                        hideTitle
                    />
                )}
                {selectedChannel && (
                    <View style={styles.selectedChannelContainer}>
                        {this.renderChannelItem(selectedChannel)}
                        <TouchableOpacity
                            style={styles.unselectButton}
                            onPress={this.handleChannelUnselect}
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

    handleInitiate = async () => {
        const { SpliceStore } = this.props;
        const { selectedChannel, amount, destination, feeRate, forceFeerate } =
            this.state;

        if (!selectedChannel || !amount || !destination) {
            this.setState({
                error: localeString('views.Tools.SpliceOut.error.fillAllFields')
            });
            return;
        }

        try {
            this.setState({ error: '', step: 'confirm' });

            // Step 1: Dryrun to get fee estimate
            const result = await SpliceStore.initiateSpliceOut({
                channelId: selectedChannel.chan_id,
                amount,
                destination,
                feeRate: parseFloat(feeRate),
                forceFeerate
            });

            if (!result) {
                this.setState({
                    error:
                        SpliceStore.error ||
                        localeString(
                            'views.Tools.SpliceOut.error.failedToInitiate'
                        ),
                    step: 'input'
                });
                return;
            }

            this.setState({ step: 'confirm' });
        } catch (err: any) {
            this.setState({
                error:
                    SpliceStore.error ||
                    err.message ||
                    localeString(
                        'views.Tools.SpliceOut.error.failedToInitiate'
                    ),
                step: 'input'
            });
        }
    };

    handleExecute = async () => {
        try {
            await this.performExecute();
        } catch (error) {
            console.error(
                '[SpliceOut] Unhandled error in handleExecute:',
                error
            );
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.unexpectedError'
                ),
                step: 'confirm'
            });
        }
    };

    performExecute = async () => {
        const { SpliceStore } = this.props;
        const { selectedChannel, amount, destination, forceFeerate } =
            this.state;

        const dryrunResult = SpliceStore.currentDryrunResult;
        if (!dryrunResult) {
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.noDryrunResult'
                ),
                step: 'confirm'
            });
            return;
        }

        if (!selectedChannel) {
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.channelNotFound'
                ),
                step: 'confirm'
            });
            return;
        }

        this.setState({ error: '', step: 'executing' });

        // Step 2: Execute the splice with simple timeout check
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let isTimedOut = false;

        timeoutId = setTimeout(() => {
            isTimedOut = true;
            this.setState({
                error: localeString('views.Tools.SpliceOut.error.timeout'),
                step: 'confirm'
            });
        }, 30000);

        const result = await SpliceStore.executeSplice(
            selectedChannel.chan_id,
            dryrunResult.script,
            selectedChannel.localBalance,
            amount,
            destination,
            dryrunResult.fee,
            forceFeerate
        );

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (isTimedOut) {
            return;
        }

        if (!result) {
            console.log(
                '[SpliceOut] Splice operation failed, setting error:',
                SpliceStore.error
            );
            this.setState({
                error:
                    SpliceStore.error ||
                    localeString('views.Tools.SpliceOut.error.failedToExecute'),
                step: 'confirm'
            });
            return;
        }

        if (!result.txid) {
            console.error('[SpliceOut] Invalid splice result:', result);
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.invalidResult'
                ),
                step: 'confirm'
            });
            return;
        }

        this.setState({ step: 'complete' });
    };

    handleCancel = () => {
        const { SpliceStore } = this.props;
        SpliceStore.currentDryrunResult = null;
        SpliceStore.error = null; // Clear any existing errors when canceling
        this.setState({ step: 'input', error: '' });
    };

    renderInput = () => {
        const {
            selectedChannel,
            amount,
            destination,
            feeRate,
            forceFeerate,
            error
        } = this.state;

        return (
            <View>
                {error && <ErrorMessage message={error} />}

                {/* Channel Selection  */}
                {this.renderChannelSelectionSection()}

                {/* Amount */}
                <Text style={styles.label}>{`${localeString(
                    'views.Receive.amount'
                )}:`}</Text>
                <TextInput
                    placeholder="5000"
                    value={amount}
                    onChangeText={(text: string) =>
                        this.setState({ amount: text })
                    }
                    keyboardType="numeric"
                />

                {/* Destination */}
                <Text style={styles.label}>{`${localeString(
                    'general.destination'
                )}:`}</Text>
                <TextInput
                    placeholder={
                        localeString('general.wallet') +
                        ' ' +
                        localeString('general.default')
                    }
                    value={destination}
                    onChangeText={(text: string) =>
                        this.setState({ destination: text })
                    }
                />
                <Text style={styles.helperText}>
                    {localeString('views.Tools.SpliceOut.destinationNote')}
                </Text>

                {/* Fee Rate */}
                <Text style={styles.label}>{`${localeString(
                    'views.Channel.feeRate'
                )} (sats/vbyte):`}</Text>
                <TextInput
                    placeholder="2"
                    value={feeRate}
                    onChangeText={(text: string) =>
                        this.setState({ feeRate: text })
                    }
                    keyboardType="numeric"
                />

                {/* Force Feerate */}
                <View
                    style={{
                        flexDirection: 'row',
                        marginTop: 16
                    }}
                >
                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText'),
                            flex: 1,
                            fontSize: 18
                        }}
                    >
                        {localeString('views.Tools.SpliceOut.forceFeerate')}
                    </Text>
                    <View style={{ alignSelf: 'center', marginLeft: 5 }}>
                        <Switch
                            value={forceFeerate}
                            onValueChange={(value: boolean) =>
                                this.setState({ forceFeerate: value })
                            }
                        />
                    </View>
                </View>

                <Text style={styles.helperText}>
                    {localeString(
                        'views.Tools.SpliceOut.forceFeerateDescription'
                    )}
                </Text>
                <Button
                    title={localeString('views.Tools.SpliceOut.previewSplice')}
                    onPress={this.handleInitiate}
                    containerStyle={styles.button}
                    disabled={!selectedChannel}
                />
            </View>
        );
    };

    renderConfirm = () => {
        const { SpliceStore } = this.props;
        const { amount, destination, error } = this.state;
        const dryrunResult = SpliceStore.currentDryrunResult;

        if (!dryrunResult) return <LoadingIndicator />;

        return (
            <View>
                <Text style={styles.title}>
                    {localeString('views.Tools.SpliceOut.confirmTitle')}
                </Text>

                {error && <ErrorMessage message={error} />}

                <KeyValue
                    keyValue={localeString('views.Tools.SpliceOut.amount')}
                    value={<Amount sats={amount} toggleable />}
                />
                <KeyValue
                    keyValue={localeString('general.destination')}
                    value={destination}
                />
                <KeyValue
                    keyValue={localeString('views.Tools.SpliceOut.onchainFee')}
                    value={<Amount sats={dryrunResult.fee} toggleable />}
                    color={themeColor('warning')}
                />
                <KeyValue
                    keyValue={localeString(
                        'views.Tools.SpliceOut.totalDeducted'
                    )}
                    value={
                        <Amount
                            sats={parseInt(amount) + dryrunResult.fee}
                            toggleable
                        />
                    }
                />

                {dryrunResult.transcript && dryrunResult.transcript.length > 0 && (
                    <View
                        style={[
                            styles.transcript,
                            { backgroundColor: themeColor('secondary') }
                        ]}
                    >
                        <Text style={styles.transcriptTitle}>{`${localeString(
                            'general.details'
                        )}:`}</Text>
                        {dryrunResult.transcript.map((line, i) => (
                            <Text key={i} style={styles.transcriptLine}>
                                {line}
                            </Text>
                        ))}
                    </View>
                )}

                <WarningMessage
                    message={localeString(
                        'views.Tools.SpliceOut.warningMessage'
                    )}
                />

                <View style={styles.buttonRow}>
                    <Button
                        title={localeString('general.cancel')}
                        onPress={this.handleCancel}
                        secondary
                        containerStyle={styles.halfButton}
                    />
                    <Button
                        title={localeString(
                            'views.Tools.SpliceOut.executeSplice'
                        )}
                        onPress={this.handleExecute}
                        containerStyle={styles.halfButton}
                    />
                </View>
            </View>
        );
    };

    renderExecuting = () => {
        const { SpliceStore } = this.props;

        return (
            <View style={styles.centered}>
                <LoadingIndicator />
                <Text style={styles.statusText}>
                    {localeString('views.Tools.SpliceOut.executing') + '...'}
                </Text>
                <Text style={styles.subtitle}>
                    {localeString('views.SendingOnChain.broadcasting')}
                </Text>

                {SpliceStore.loading && (
                    <Text
                        style={StyleSheet.flatten([
                            styles.subtitle,
                            { marginTop: 16 }
                        ])}
                    >
                        {`${localeString(
                            'views.Tools.SpliceOut.storeLoading'
                        )}: ${SpliceStore.loading.toString()}`}
                    </Text>
                )}
                {SpliceStore.error && (
                    <Text
                        style={StyleSheet.flatten([
                            styles.subtitle,
                            { color: 'red', marginTop: 8 }
                        ])}
                    >
                        {`${localeString(
                            'views.Tools.SpliceOut.storeError'
                        )}: ${SpliceStore.error}`}
                    </Text>
                )}
            </View>
        );
    };

    renderComplete = () => {
        const { SpliceStore } = this.props;
        const { selectedChannel } = this.state;
        const spliceOp = selectedChannel
            ? SpliceStore.getSpliceOperation(selectedChannel.chan_id)
            : null;

        return (
            <View>
                <SuccessMessage
                    message={localeString(
                        'views.Tools.SpliceOut.successMessage'
                    )}
                />

                {spliceOp && (
                    <>
                        <KeyValue
                            keyValue={localeString(
                                'views.Tools.SpliceOut.transactionId'
                            )}
                            value={
                                spliceOp.txid ||
                                localeString('general.notAvailable')
                            }
                        />
                        <KeyValue
                            keyValue={localeString('views.OpenChannel.numConf')}
                            value={`${spliceOp.confirmations} / 1+`}
                        />
                        <KeyValue
                            keyValue={localeString('views.Transaction.status')}
                            value={spliceOp.status}
                        />
                    </>
                )}

                <Text style={styles.subtitle}>
                    {localeString('views.Tools.SpliceOut.channelUpdateMessage')}
                </Text>

                <Button
                    title={localeString('views.Tools.SpliceOut.done')}
                    onPress={() => this.props.navigation.goBack()}
                    containerStyle={styles.button}
                />
            </View>
        );
    };

    render() {
        const { navigation } = this.props;
        const { step } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent={step === 'input' ? 'Back' : undefined}
                    centerComponent={{
                        text: localeString('views.Tools.SpliceOut.title'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    style={styles.container}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    {step === 'input' && this.renderInput()}
                    {step === 'confirm' && this.renderConfirm()}
                    {step === 'executing' && this.renderExecuting()}
                    {step === 'complete' && this.renderComplete()}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        padding: 16
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 50
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        fontFamily: 'PPNeueMontreal-Book'
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.7,
        marginBottom: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    section: {
        marginBottom: 8
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'PPNeueMontreal-Book'
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    helperText: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: 4,
        marginBottom: 8,
        fontStyle: 'italic',
        fontFamily: 'PPNeueMontreal-Book'
    },
    channelInfo: {
        padding: 6,
        borderRadius: 10,
        marginTop: 5
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
    channelPickerField: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 8,
        marginBottom: 8
    },
    channelPickerPlaceholder: {
        fontSize: 16,
        padding: 8,
        fontFamily: 'PPNeueMontreal-Book'
    },
    selectedChannelItem: {
        padding: 4
    },
    button: {
        marginTop: 24
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24
    },
    halfButton: {
        flex: 1,
        marginHorizontal: 4
    },
    transcript: {
        padding: 12,
        borderRadius: 8,
        marginVertical: 16
    },
    transcriptTitle: {
        fontWeight: 'bold',
        marginBottom: 8,
        fontFamily: 'PPNeueMontreal-Book'
    },
    transcriptLine: {
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 4
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32
    },
    statusText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 16,
        fontFamily: 'PPNeueMontreal-Book'
    }
});
