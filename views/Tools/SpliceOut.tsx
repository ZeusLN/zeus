import * as React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { ButtonGroup } from '@rneui/themed';

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
    feeRate: string;
    forceFeerate: boolean;
    step: 'input' | 'confirm';
    error: string;
    selectedIndex: number;
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
    state = {
        selectedChannel: null as Channel | null,
        amount: '',
        feeRate: '2',
        forceFeerate: false,
        step: 'input' as 'input' | 'confirm',
        error: '',
        selectedIndex: 0
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

    updateIndex = (selectedIndex: number) => {
        const { SpliceStore } = this.props;
        SpliceStore.currentDryrunResult = null;
        SpliceStore.error = null;
        this.setState({
            selectedIndex,
            selectedChannel: null,
            amount: '',
            feeRate: '2',
            forceFeerate: false,
            step: 'input',
            error: ''
        });
    };

    getDestinationAddress = (): string => {
        return 'wallet';
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
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString('components.ChannelPicker.modal.title')}
                </Text>
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
        const {
            selectedChannel,
            amount,
            feeRate,
            forceFeerate,
            selectedIndex
        } = this.state;

        if (!selectedChannel || !amount) {
            this.setState({
                error: localeString('views.Tools.SpliceOut.error.fillAllFields')
            });
            return;
        }

        const amountNum = parseInt(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            this.setState({
                error: localeString('views.Tools.SpliceOut.error.invalidAmount')
            });
            return;
        }

        const feeRateNum = parseFloat(feeRate);
        if (feeRate && (isNaN(feeRateNum) || feeRateNum <= 0)) {
            this.setState({
                error: localeString(
                    'views.Tools.SpliceOut.error.invalidFeeRate'
                )
            });
            return;
        }

        if (selectedIndex === 0) {
            const availableBalance = parseInt(selectedChannel.sendingCapacity);
            if (amountNum > availableBalance) {
                this.setState({
                    error: localeString(
                        'views.Tools.SpliceOut.error.insufficientBalance'
                    )
                });
                return;
            }
        }

        this.setState({ error: '' });

        let result: any = null;

        // Dryrun to get fee estimate
        if (selectedIndex === 0) {
            // Splice Out
            const destination = this.getDestinationAddress();

            result = await SpliceStore.initiateSpliceOut({
                channelId: selectedChannel.chan_id,
                amount,
                destination,
                feeRate: feeRateNum,
                forceFeerate
            });
        } else {
            // Splice In
            result = await SpliceStore.initiateSpliceIn({
                channelId: selectedChannel.chan_id,
                amount,
                feeRate: feeRateNum,
                forceFeerate
            });
        }

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

        console.log('[Splice] Dryrun result:', result);
        this.setState({ step: 'confirm' });
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
        const { selectedChannel, amount, forceFeerate, selectedIndex } =
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

        const destination =
            selectedIndex === 0 ? this.getDestinationAddress() : '';

        SpliceStore.executeSplice(
            selectedChannel.chan_id,
            dryrunResult.script,
            selectedChannel.localBalance,
            amount,
            destination,
            dryrunResult.fee,
            forceFeerate
        );

        this.props.navigation.navigate('SendingOnChain');
    };

    handleCancel = () => {
        const { SpliceStore } = this.props;
        SpliceStore.currentDryrunResult = null;
        SpliceStore.error = null;
        this.setState({ step: 'input', error: '' });
    };

    renderInput = () => {
        const {
            selectedChannel,
            amount,
            feeRate,
            forceFeerate,
            error,
            selectedIndex
        } = this.state;

        const isSpliceOut = selectedIndex === 0;
        const amountLabel = isSpliceOut
            ? localeString('views.Tools.spliceOut')
            : localeString('views.Tools.spliceIn') +
              ' ' +
              localeString('general.amount');

        const spliceOutButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 0
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book',
                        fontSize: 16,
                        fontWeight: '600'
                    }}
                >
                    {localeString('views.Tools.SpliceOut.spliceOut')}
                </Text>
            </React.Fragment>
        );

        const spliceInButton = () => (
            <React.Fragment>
                <Text
                    style={{
                        color:
                            selectedIndex === 1
                                ? themeColor('background')
                                : themeColor('text'),
                        fontFamily: 'PPNeueMontreal-Book',
                        fontSize: 16,
                        fontWeight: '600'
                    }}
                >
                    {localeString('views.Tools.SpliceOut.spliceIn')}
                </Text>
            </React.Fragment>
        );

        const buttons = [
            { element: spliceOutButton },
            { element: spliceInButton }
        ];
        const buttonElements = buttons.map((btn) => btn.element());

        return (
            <View>
                <ButtonGroup
                    onPress={this.updateIndex}
                    selectedIndex={selectedIndex}
                    buttons={buttonElements}
                    selectedButtonStyle={{
                        backgroundColor: themeColor('highlight'),
                        borderRadius: 12
                    }}
                    containerStyle={{
                        backgroundColor: themeColor('secondary'),
                        borderRadius: 12,
                        borderColor: themeColor('secondary'),
                        width: '100%',
                        alignSelf: 'center',
                        marginBottom: 16
                    }}
                    innerBorderStyle={{
                        color: themeColor('secondary')
                    }}
                />

                {error && <ErrorMessage message={error} />}

                {/* Channel Selection  */}
                {this.renderChannelSelectionSection()}

                {/* Amount */}
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {amountLabel}
                </Text>
                <TextInput
                    placeholder="5000"
                    value={amount}
                    onChangeText={(text: string) =>
                        this.setState({ amount: text })
                    }
                    keyboardType="numeric"
                />

                {/* Fee Rate */}
                <Text
                    style={{
                        ...styles.text,
                        color: themeColor('secondaryText')
                    }}
                >
                    {`${localeString('views.Channel.feeRate')} (sats/vbyte)`}
                </Text>
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
                <View style={styles.button}>
                    <Button
                        title={localeString(
                            'views.Tools.SpliceOut.previewSplice'
                        )}
                        onPress={this.handleInitiate}
                        disabled={!selectedChannel}
                    />
                </View>
            </View>
        );
    };

    renderConfirm = () => {
        const { SpliceStore } = this.props;
        const { amount, error, selectedIndex } = this.state;
        const isSpliceOut = selectedIndex === 0;

        const confirmTitle = isSpliceOut
            ? localeString('views.Tools.SpliceOut.confirmTitle')
            : localeString('views.Tools.SpliceIn.confirmTitle');

        const amountLabel =
            localeString('general.confirm') + ' ' + isSpliceOut
                ? localeString('views.Tools.SpliceOut.spliceOut')
                : localeString('views.Tools.SpliceOut.spliceIn');

        const totalLabel = isSpliceOut
            ? localeString('views.Tools.SpliceOut.totalDeducted')
            : localeString('views.Tools.SpliceIn.totalAdded');

        const dryrunResult = SpliceStore.currentDryrunResult;

        if (!dryrunResult) return <LoadingIndicator />;

        return (
            <View>
                <Text
                    style={{
                        ...styles.title,
                        color: themeColor('text')
                    }}
                >
                    {confirmTitle}
                </Text>

                {error && <ErrorMessage message={error} />}

                <KeyValue
                    keyValue={amountLabel}
                    value={<Amount sats={amount} toggleable />}
                />
                {isSpliceOut && (
                    <KeyValue
                        keyValue={localeString('general.destination')}
                        value={localeString('views.Tools.SpliceOut.nodeWallet')}
                    />
                )}
                <KeyValue
                    keyValue={localeString('views.Tools.SpliceOut.onchainFee')}
                    value={<Amount sats={dryrunResult.fee} toggleable />}
                    color={themeColor('warning')}
                />
                <KeyValue
                    keyValue={totalLabel}
                    value={
                        <Amount
                            sats={
                                isSpliceOut
                                    ? parseInt(amount) + dryrunResult.fee
                                    : parseInt(amount) - dryrunResult.fee
                            }
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
                        <Text
                            style={{
                                ...styles.transcriptTitle,
                                color: themeColor('text')
                            }}
                        >
                            {`${localeString('general.details')}:`}
                        </Text>
                        {dryrunResult.transcript.map((line, i) => (
                            <Text
                                key={i}
                                style={{
                                    ...styles.transcriptLine,
                                    color: themeColor('secondaryText')
                                }}
                            >
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

    render() {
        const { navigation } = this.props;
        const { step } = this.state;

        const showBackButton = step === 'input';

        return (
            <Screen>
                <Header
                    leftComponent={showBackButton ? 'Back' : undefined}
                    centerComponent={{
                        text: localeString('views.Tools.splicing'),
                        style: { color: themeColor('text') }
                    }}
                    navigation={navigation}
                />
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {step === 'input' && this.renderInput()}
                    {step === 'confirm' && this.renderConfirm()}
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingTop: 10
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
        fontFamily: 'PPNeueMontreal-Book'
    },
    section: {
        marginBottom: 20
    },
    helperText: {
        fontSize: 12,
        opacity: 0.6,
        marginTop: 4,
        marginBottom: 16,
        fontFamily: 'PPNeueMontreal-Book'
    },
    button: {
        alignItems: 'center',
        paddingTop: 30
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
    }
});
