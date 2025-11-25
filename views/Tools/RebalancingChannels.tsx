import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    View,
    ScrollView,
    Animated,
    Easing
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import Button from '../../components/Button';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import CopyBox from '../../components/CopyBox';
import Header from '../../components/Header';
import Amount from '../../components/Amount';
import { ChannelItem } from '../../components/Channels/ChannelItem';
import { Row } from '../../components/layout/Row';

import BalanceStore from '../../stores/BalanceStore';
import SettingsStore from '../../stores/SettingsStore';
import TransactionsStore from '../../stores/TransactionsStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import ChannelsStore from '../../stores/ChannelsStore';
import UnitsStore from '../../stores/UnitsStore';
import PaymentsStore from '../../stores/PaymentsStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import BackendUtils from '../../utils/BackendUtils';
import Storage from '../../storage';
import Channel from '../../models/Channel';
import { PaymentStatus } from './Rebalance';

import ErrorIcon from '../../assets/images/SVG/ErrorIcon.svg';
import SyncIcon from '../../assets/images/SVG/Sync.svg';

const PROCESSING_TIMEOUT_MS = 3000;

const CircularRebalanceAnimation: React.FC = () => {
    const rotateValue = React.useRef(new Animated.Value(0)).current;
    const pulseValue = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const rotateAnimation = Animated.loop(
            Animated.timing(rotateValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true
            })
        );

        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true
                }),
                Animated.timing(pulseValue, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true
                })
            ])
        );

        rotateAnimation.start();
        pulseAnimation.start();

        return () => {
            rotateAnimation.stop();
            pulseAnimation.stop();
        };
    }, []);

    const rotate = rotateValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const pulseScale = pulseValue.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.2]
    });

    const pulseOpacity = pulseValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.1]
    });

    return (
        <View style={styles.circularAnimationContainer}>
            <Animated.View
                style={[
                    styles.outerPulse,
                    {
                        transform: [{ scale: pulseScale }],
                        opacity: pulseOpacity,
                        borderColor: themeColor('highlight')
                    }
                ]}
            />

            <Animated.View
                style={[
                    styles.syncIconContainer,
                    {
                        transform: [{ rotate }]
                    }
                ]}
            >
                <SyncIcon
                    width={80}
                    height={80}
                    fill={themeColor('highlight')}
                />
            </Animated.View>
        </View>
    );
};

interface ChannelShiftAnimationProps {
    sourceChannel: Channel;
    destinationChannel: Channel;
    rebalanceAmount: number;
}

const ChannelShiftAnimation: React.FC<ChannelShiftAnimationProps> = ({
    sourceChannel,
    destinationChannel,
    rebalanceAmount
}) => {
    const sourceLocalAnim = React.useRef(
        new Animated.Value(Number(sourceChannel.localBalance) || 0)
    ).current;
    const sourceRemoteAnim = React.useRef(
        new Animated.Value(Number(sourceChannel.remoteBalance) || 0)
    ).current;
    const destLocalAnim = React.useRef(
        new Animated.Value(Number(destinationChannel.localBalance) || 0)
    ).current;
    const destRemoteAnim = React.useRef(
        new Animated.Value(Number(destinationChannel.remoteBalance) || 0)
    ).current;

    const [currentSourceLocal, setCurrentSourceLocal] = React.useState(
        Number(sourceChannel.localBalance) || 0
    );
    const [currentSourceRemote, setCurrentSourceRemote] = React.useState(
        Number(sourceChannel.remoteBalance) || 0
    );
    const [currentDestLocal, setCurrentDestLocal] = React.useState(
        Number(destinationChannel.localBalance) || 0
    );
    const [currentDestRemote, setCurrentDestRemote] = React.useState(
        Number(destinationChannel.remoteBalance) || 0
    );

    React.useEffect(() => {
        const newSourceLocal = Math.max(
            0,
            Number(sourceChannel.localBalance) - rebalanceAmount
        );
        const newSourceRemote =
            Number(sourceChannel.remoteBalance) + rebalanceAmount;
        const newDestLocal =
            Number(destinationChannel.localBalance) + rebalanceAmount;
        const newDestRemote = Math.max(
            0,
            Number(destinationChannel.remoteBalance) - rebalanceAmount
        );

        const startTimer = setTimeout(() => {
            const animations = [
                Animated.timing(sourceLocalAnim, {
                    toValue: newSourceLocal,
                    duration: 2000,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false
                }),
                Animated.timing(sourceRemoteAnim, {
                    toValue: newSourceRemote,
                    duration: 2000,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false
                }),
                Animated.timing(destLocalAnim, {
                    toValue: newDestLocal,
                    duration: 2000,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false
                }),
                Animated.timing(destRemoteAnim, {
                    toValue: newDestRemote,
                    duration: 2000,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false
                })
            ];

            Animated.parallel(animations).start();

            sourceLocalAnim.addListener(({ value }) =>
                setCurrentSourceLocal(Math.round(value))
            );
            sourceRemoteAnim.addListener(({ value }) =>
                setCurrentSourceRemote(Math.round(value))
            );
            destLocalAnim.addListener(({ value }) =>
                setCurrentDestLocal(Math.round(value))
            );
            destRemoteAnim.addListener(({ value }) =>
                setCurrentDestRemote(Math.round(value))
            );
        }, 1000);

        return () => {
            clearTimeout(startTimer);
            sourceLocalAnim.removeAllListeners();
            sourceRemoteAnim.removeAllListeners();
            destLocalAnim.removeAllListeners();
            destRemoteAnim.removeAllListeners();
        };
    }, [sourceChannel, destinationChannel, rebalanceAmount]);

    return (
        <View style={styles.channelShiftContainer}>
            <View
                style={[
                    styles.channelItemWrapper,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <ChannelItem
                    title={`${localeString('general.from')}: ${
                        sourceChannel.alias ||
                        localeString('general.unknown') +
                            ' ' +
                            localeString('views.Channel.title')
                    }`}
                    secondTitle={
                        sourceChannel.remotePubkey?.substring(0, 8) + '...'
                    }
                    localBalance={currentSourceLocal}
                    remoteBalance={currentSourceRemote}
                    noBorder={false}
                    highlightLabels={true}
                />
            </View>

            <View
                style={[
                    styles.channelItemWrapper,
                    { backgroundColor: themeColor('secondary') }
                ]}
            >
                <ChannelItem
                    title={`${localeString('general.to')}: ${
                        destinationChannel.alias ||
                        localeString('general.unknown') +
                            ' ' +
                            localeString('views.Channel.title')
                    }`}
                    secondTitle={
                        destinationChannel.remotePubkey?.substring(0, 8) + '...'
                    }
                    localBalance={currentDestLocal}
                    remoteBalance={currentDestRemote}
                    noBorder={false}
                    highlightLabels={true}
                />
            </View>
        </View>
    );
};

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

interface RebalancingChannelsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'RebalancingChannels',
        {
            rebalanceData: RebalanceResultData;
            currentRebalanceState?: any;
        }
    >;
    BalanceStore: BalanceStore;
    SettingsStore: SettingsStore;
    TransactionsStore: TransactionsStore;
    NodeInfoStore: NodeInfoStore;
    ChannelsStore: ChannelsStore;
    UnitsStore: UnitsStore;
    PaymentsStore: PaymentsStore;
}

interface RebalancingChannelsState {
    currentPayment: any;
    isInitialProcessing: boolean;
    storedNotes: string;
}

@inject(
    'BalanceStore',
    'SettingsStore',
    'TransactionsStore',
    'NodeInfoStore',
    'ChannelsStore',
    'PaymentsStore'
)
@observer
export default class RebalancingChannels extends React.Component<
    RebalancingChannelsProps,
    RebalancingChannelsState
> {
    private backPressSubscription: NativeEventSubscription | null = null;

    constructor(props: RebalancingChannelsProps) {
        super(props);

        const rebalanceData = this.getRebalanceData();
        const isProcessing = rebalanceData?.isProcessing || false;

        this.state = {
            currentPayment: null,
            isInitialProcessing: isProcessing,
            storedNotes: ''
        };
    }

    componentDidMount() {
        if (this.state.isInitialProcessing) {
            setTimeout(() => {
                this.setState({ isInitialProcessing: false });
            }, PROCESSING_TIMEOUT_MS);
        }

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress
        );

        const rebalanceData = this.getRebalanceData();
        const noteKey = rebalanceData?.paymentHash
            ? `note-${rebalanceData.paymentHash}`
            : rebalanceData?.paymentPreimage
            ? `note-${rebalanceData.paymentPreimage}`
            : null;

        if (noteKey) {
            Storage.getItem(noteKey)
                .then((storedNotes: any) => {
                    if (storedNotes) {
                        this.setState({ storedNotes });
                    }
                })
                .catch((error: any) => {
                    console.error('Error retrieving notes:', error);
                });
        }

        this.fetchPayments();

        if (this.successfullySent()) {
            this.props.BalanceStore.getCombinedBalance();
        }
    }

    componentWillUnmount() {
        if (this.backPressSubscription) {
            this.backPressSubscription.remove();
        }
    }

    private fetchPayments = async () => {
        const { PaymentsStore, TransactionsStore } = this.props;
        const rebalanceData = this.getRebalanceData();

        try {
            const payments = await PaymentsStore.getPayments({
                maxPayments: 5,
                reversed: true
            });

            let matchingPayment = payments.find(
                (payment: any) =>
                    payment.payment_preimage ===
                        TransactionsStore.payment_preimage ||
                    payment.getPreimage ===
                        TransactionsStore.payment_preimage ||
                    payment.payment_preimage === rebalanceData?.paymentPreimage
            );

            if (
                !matchingPayment &&
                (TransactionsStore.payment_hash || rebalanceData?.paymentHash)
            ) {
                matchingPayment = payments.find(
                    (payment: any) =>
                        payment.payment_hash ===
                            TransactionsStore.payment_hash ||
                        payment.paymentHash ===
                            TransactionsStore.payment_hash ||
                        payment.payment_hash === rebalanceData?.paymentHash
                );
            }

            this.setState({ currentPayment: matchingPayment });
        } catch (error) {
            this.setState({ currentPayment: null });
            console.error('Failed to fetch payments', error);
        }
    };

    private successfullySent(): boolean {
        const { SettingsStore } = this.props;
        const rebalanceData = this.getRebalanceData();

        if (!rebalanceData) return false;

        if (rebalanceData.success) return true;

        const { TransactionsStore } = this.props;
        if (SettingsStore.implementation === 'cln-rest') {
            return (
                TransactionsStore.status === PaymentStatus.COMPLETE ||
                TransactionsStore.status === PaymentStatus.SUCCEEDED ||
                TransactionsStore.status === 2
            );
        }

        return (
            TransactionsStore.payment_route ||
            TransactionsStore.status === PaymentStatus.COMPLETE ||
            TransactionsStore.status === PaymentStatus.SUCCEEDED ||
            TransactionsStore.status === 2
        );
    }

    private handleBackPress = (): boolean => {
        const { navigation } = this.props;
        const rebalanceData = this.getRebalanceData();

        if (rebalanceData?.isProcessing || this.state.isInitialProcessing) {
            return true;
        }

        if (!rebalanceData?.error && this.successfullySent()) {
            navigation.popTo('Wallet');
            return true;
        }
        return false;
    };

    private getRebalanceData(): RebalanceResultData | null {
        return this.props.route?.params?.rebalanceData || null;
    }

    private handleTryAgain = () => {
        const { navigation } = this.props;
        navigation.goBack();
    };

    private handleAddNote = () => {
        const { navigation } = this.props;
        const rebalanceData = this.getRebalanceData();

        const noteKey = rebalanceData?.paymentHash
            ? `note-${rebalanceData.paymentHash}`
            : rebalanceData?.paymentPreimage
            ? `note-${rebalanceData.paymentPreimage}`
            : null;

        if (!noteKey) return;

        navigation.navigate('AddNotes', {
            noteKey
        });
    };

    private handleViewPath = () => {
        const { navigation } = this.props;
        const { currentPayment } = this.state;

        if (currentPayment?.enhancedPath) {
            navigation.navigate('PaymentPaths', {
                enhancedPath: currentPayment.enhancedPath
            });
        }
    };

    private navigateToRebalanceSummary() {
        const { navigation } = this.props;
        const rebalanceData = this.getRebalanceData();
        const { currentPayment } = this.state;

        if (!rebalanceData) return;

        const sourceChannel = { ...rebalanceData.sourceChannel };
        const destinationChannel = { ...rebalanceData.destinationChannel };

        const originalSourceLocal = Number(sourceChannel.local_balance) || 0;
        const originalSourceRemote = Number(sourceChannel.remote_balance) || 0;

        const newSourceLocal = Math.max(
            0,
            originalSourceLocal - rebalanceData.rebalanceAmount
        );
        const newSourceRemote =
            originalSourceRemote + rebalanceData.rebalanceAmount;

        sourceChannel.local_balance = newSourceLocal.toString();
        sourceChannel.remote_balance = newSourceRemote.toString();

        const originalDestLocal = Number(destinationChannel.local_balance) || 0;
        const originalDestRemote =
            Number(destinationChannel.remote_balance) || 0;

        const newDestLocal = originalDestLocal + rebalanceData.rebalanceAmount;
        const newDestRemote = Math.max(
            0,
            originalDestRemote - rebalanceData.rebalanceAmount
        );

        destinationChannel.local_balance = newDestLocal.toString();
        destinationChannel.remote_balance = newDestRemote.toString();

        let actualFee = rebalanceData.fee || 0;

        if (currentPayment?.getFee && Number(currentPayment.getFee) > 0) {
            actualFee = Number(currentPayment.getFee);
        } else if (
            currentPayment?.fee_msat &&
            Number(currentPayment.fee_msat) > 0
        ) {
            actualFee = Number(currentPayment.fee_msat) / 1000;
        }

        const routingEvent = {
            fee: actualFee,
            rebalanceFees: actualFee,
            rebalanceAmount: rebalanceData.rebalanceAmount,
            inAmt: rebalanceData.rebalanceAmount,
            outAmt: rebalanceData.rebalanceAmount,
            inChannelId: sourceChannel.chan_id || sourceChannel.channel_id,
            outChannelId:
                destinationChannel.chan_id || destinationChannel.channel_id,
            getTime: new Date().toLocaleString(),
            isRebalance: true,
            sourceChannel,
            destinationChannel
        };

        navigation.navigate('RoutingEvent', { routingEvent });
    }

    render() {
        const { TransactionsStore, navigation } = this.props;
        const { storedNotes, currentPayment, isInitialProcessing } = this.state;
        const windowSize = Dimensions.get('window');

        const rebalanceData = this.getRebalanceData();

        if (!rebalanceData) {
            return (
                <Screen>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString('general.error'),
                            style: { color: themeColor('text') }
                        }}
                        navigation={navigation}
                    />
                    <View style={styles.errorContainer}>
                        <ErrorIcon
                            width={50}
                            height={50}
                            fill={themeColor('error')}
                        />
                        <Text
                            style={{
                                ...styles.errorText,
                                color: themeColor('error')
                            }}
                        >
                            {localeString('general.error')}
                        </Text>
                        <Button
                            title={localeString('general.goBack')}
                            onPress={() => navigation.goBack()}
                        />
                    </View>
                </Screen>
            );
        }

        const success = rebalanceData.success;
        const error = rebalanceData.error;
        const loading =
            isInitialProcessing ||
            rebalanceData.isProcessing ||
            TransactionsStore.loading;

        const enhancedPath = currentPayment?.enhancedPath;
        const paymentPathExists =
            BackendUtils.isLNDBased() &&
            enhancedPath?.length > 0 &&
            enhancedPath[0][0] &&
            success &&
            !error;

        const noteKey =
            success &&
            !error &&
            (rebalanceData.paymentHash
                ? `note-${rebalanceData.paymentHash}`
                : rebalanceData.paymentPreimage
                ? `note-${rebalanceData.paymentPreimage}`
                : null);

        return (
            <Screen>
                {loading && (
                    <View style={styles.loadingContainer}>
                        <CircularRebalanceAnimation />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.016,
                                marginTop: 20,
                                textAlign: 'center'
                            }}
                        >
                            {localeString(
                                'views.RebalancingChannels.sendingRebalance'
                            )}
                        </Text>
                    </View>
                )}

                {!loading && (
                    <ScrollView
                        style={styles.container}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.contentSection}>
                            {success && !error && (
                                <>
                                    <View style={styles.rebalanceAmountSection}>
                                        <Text
                                            style={{
                                                ...styles.rebalanceAmountLabel,
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'views.Rebalance.rebalanceAmount'
                                            )}
                                        </Text>
                                        <Amount
                                            sats={rebalanceData.rebalanceAmount}
                                            jumboText
                                            toggleable
                                        />
                                    </View>

                                    <ChannelShiftAnimation
                                        sourceChannel={
                                            rebalanceData.sourceChannel
                                        }
                                        destinationChannel={
                                            rebalanceData.destinationChannel
                                        }
                                        rebalanceAmount={
                                            rebalanceData.rebalanceAmount
                                        }
                                    />

                                    {!!(
                                        rebalanceData.paymentPreimage ||
                                        TransactionsStore.payment_preimage ||
                                        currentPayment?.payment_preimage
                                    ) && (
                                        <View style={styles.preImageContainer}>
                                            <CopyBox
                                                heading={localeString(
                                                    'views.Payment.paymentPreimage'
                                                )}
                                                headingCopied={`${localeString(
                                                    'views.Payment.paymentPreimage'
                                                )} ${localeString(
                                                    'components.ExternalLinkModal.copied'
                                                )}`}
                                                theme="dark"
                                                URL={
                                                    rebalanceData.paymentPreimage ||
                                                    TransactionsStore.payment_preimage ||
                                                    currentPayment?.payment_preimage
                                                }
                                            />
                                        </View>
                                    )}
                                </>
                            )}

                            {error && (
                                <View style={styles.errorSection}>
                                    <ErrorIcon
                                        width={windowSize.height * 0.13}
                                        height={windowSize.height * 0.13}
                                        fill={themeColor('error')}
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('warning'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize: 32,
                                            marginTop: windowSize.height * 0.07,
                                            textAlign: 'center'
                                        }}
                                    >
                                        {localeString('general.error')}
                                    </Text>
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize:
                                                windowSize.width *
                                                windowSize.scale *
                                                0.014,
                                            textAlign: 'center',
                                            marginTop:
                                                windowSize.height * 0.025,
                                            paddingHorizontal: 20
                                        }}
                                    >
                                        {error}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {success && (
                            <View
                                style={{
                                    width: '100%',
                                    marginBottom: 5,
                                    bottom: 30
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.RebalancingChannels.rebalanceSummary'
                                    )}
                                    onPress={() =>
                                        this.navigateToRebalanceSummary()
                                    }
                                    secondary
                                    buttonStyle={{ height: 40 }}
                                    containerStyle={{ width: '100%' }}
                                />
                            </View>
                        )}

                        {(paymentPathExists || noteKey) && (
                            <Row
                                align="flex-end"
                                style={{
                                    marginBottom: 5,
                                    bottom: 25,
                                    alignSelf: 'center'
                                }}
                            >
                                {paymentPathExists && (
                                    <Button
                                        title={`${localeString(
                                            'views.Payment.title'
                                        )} ${
                                            enhancedPath?.length > 1
                                                ? `${localeString(
                                                      'views.Payment.paths'
                                                  )} (${enhancedPath.length})`
                                                : localeString(
                                                      'views.Payment.path'
                                                  )
                                        } `}
                                        onPress={this.handleViewPath}
                                        secondary
                                        buttonStyle={{
                                            height: 40,
                                            width: '100%'
                                        }}
                                        containerStyle={{
                                            maxWidth: noteKey ? '45%' : '100%',
                                            paddingRight: noteKey ? 5 : 0
                                        }}
                                    />
                                )}
                                {noteKey && (
                                    <Button
                                        title={
                                            storedNotes
                                                ? localeString(
                                                      'views.SendingLightning.UpdateNote'
                                                  )
                                                : localeString(
                                                      'views.SendingLightning.AddANote'
                                                  )
                                        }
                                        onPress={this.handleAddNote}
                                        secondary
                                        buttonStyle={{
                                            height: 40,
                                            width: '100%'
                                        }}
                                        containerStyle={{
                                            maxWidth: paymentPathExists
                                                ? '45%'
                                                : '100%',
                                            paddingLeft: paymentPathExists
                                                ? 5
                                                : 0
                                        }}
                                    />
                                )}
                            </Row>
                        )}

                        <View
                            style={[
                                styles.buttons,
                                !(
                                    (paymentPathExists || noteKey) &&
                                    success
                                ) && { marginTop: 14 }
                            ]}
                        >
                            {!!error && (
                                <>
                                    <Button
                                        title={localeString(
                                            'views.SendingLightning.tryAgain'
                                        )}
                                        icon={{
                                            name: 'return-up-back',
                                            type: 'ionicon',
                                            size: 25
                                        }}
                                        onPress={this.handleTryAgain}
                                        buttonStyle={{
                                            backgroundColor: 'white',
                                            height: 40
                                        }}
                                        containerStyle={{
                                            width: '100%',
                                            margin: 3
                                        }}
                                    />
                                </>
                            )}

                            {(!!error || !!success) && (
                                <Row
                                    align="flex-end"
                                    style={{
                                        alignSelf: 'center'
                                    }}
                                >
                                    <Button
                                        title={localeString(
                                            'views.SendingLightning.goToWallet'
                                        )}
                                        icon={{
                                            name: 'list',
                                            size: 25,
                                            color: themeColor('background')
                                        }}
                                        onPress={() => {
                                            navigation.popTo('Wallet');

                                            if (success) {
                                                this.props.ChannelsStore?.getChannels();
                                            }
                                        }}
                                        buttonStyle={{
                                            height: 40,
                                            width: '100%'
                                        }}
                                        titleStyle={{
                                            color: themeColor('background')
                                        }}
                                        containerStyle={{
                                            maxWidth: '100%',
                                            margin: 3
                                        }}
                                    />
                                </Row>
                            )}
                        </View>
                    </ScrollView>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
        justifyContent: 'space-between'
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    errorText: {
        textAlign: 'center',
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16,
        marginTop: 10,
        marginBottom: 20
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
    },
    contentSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 20
    },
    rebalanceAmountSection: {
        alignItems: 'center',
        marginBottom: 30
    },
    rebalanceAmountLabel: {
        fontSize: 16,
        fontFamily: 'PPNeueMontreal-Book',
        marginBottom: 10,
        textAlign: 'center'
    },
    errorSection: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingHorizontal: 20
    },
    preImageContainer: {
        width: '90%',
        alignSelf: 'center',
        marginTop: 20,
        marginBottom: 30
    },
    circularAnimationContainer: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20
    },
    outerPulse: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2
    },
    syncIconContainer: {
        alignItems: 'center',
        justifyContent: 'center'
    },
    channelShiftContainer: {
        width: '94%'
    },
    channelItemWrapper: {
        width: '100%',
        marginVertical: 5,
        padding: 6,
        borderRadius: 10,
        marginTop: 5
    },
    buttons: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
        bottom: 15
    }
});
