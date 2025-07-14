import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View,
    ScrollView
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';
import { getRouteStack } from '../NavigationService';

import LnurlPaySuccess from './LnurlPay/Success';

import Button from '../components/Button';
import LightningLoadingPattern from '../components/LightningLoadingPattern';
import PaidIndicator from '../components/PaidIndicator';
import Screen from '../components/Screen';
import SuccessAnimation from '../components/SuccessAnimation';
import KeyValue from '../components/KeyValue';
import Amount from '../components/Amount';

import TransactionsStore from '../stores/TransactionsStore';
import LnurlPayStore from '../stores/LnurlPayStore';
import PaymentsStore from '../stores/PaymentsStore';
import SettingsStore from '../stores/SettingsStore';
import ChannelsStore from '../stores/ChannelsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import Channel from '../models/Channel';

import Storage from '../storage';

import Clock from '../assets/images/SVG/Clock.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';
import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import Sync from '../assets/images/SVG/Sync.svg';
import CopyBox from '../components/CopyBox';

const PROCESSING_TIMEOUT_MS = 3000;

interface RebalanceResult {
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

interface SendingLightningProps {
    navigation: StackNavigationProp<any, any>;
    TransactionsStore: TransactionsStore;
    LnurlPayStore: LnurlPayStore;
    PaymentsStore: PaymentsStore;
    SettingsStore: SettingsStore;
    ChannelsStore: ChannelsStore;
    route?: {
        params?: {
            rebalanceData?: RebalanceResult;
            isRebalance?: boolean;
        };
    };
}

interface SendingLightningState {
    storedNotes: string;
    wasSuccessful: boolean;
    currentPayment: any;
    isInitialProcessing: boolean;
}

@inject(
    'TransactionsStore',
    'LnurlPayStore',
    'PaymentsStore',
    'SettingsStore',
    'ChannelsStore'
)
@observer
export default class SendingLightning extends React.Component<
    SendingLightningProps,
    SendingLightningState
> {
    private backPressSubscription: NativeEventSubscription;
    private navigationUnsubscribe: () => void;

    constructor(props: SendingLightningProps) {
        super(props);

        // Get rebalance processing state if available
        const rebalanceData = this.getRebalanceData();
        const isProcessing = rebalanceData?.isProcessing || false;

        this.state = {
            storedNotes: '',
            currentPayment: null,
            wasSuccessful: false,
            isInitialProcessing: isProcessing
        };
    }

    componentDidMount() {
        const { TransactionsStore, navigation } = this.props;

        // Handle initial rebalance processing timeout
        if (this.state.isInitialProcessing) {
            setTimeout(() => {
                this.setState({ isInitialProcessing: false });
            }, PROCESSING_TIMEOUT_MS);
        }

        const unsubscribe = navigation.addListener('focus', () => {
            const noteKey: string = TransactionsStore.noteKey;
            if (!noteKey) return;
            Storage.getItem(noteKey)
                .then((storedNotes) => {
                    if (storedNotes) {
                        this.setState({ storedNotes });
                    }
                })
                .catch((error) => {
                    console.error('Error retrieving notes:', error);
                });
        });

        this.navigationUnsubscribe = unsubscribe;
        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress.bind(this)
        );

        if (this.successfullySent(TransactionsStore)) {
            this.fetchPayments();
            this.setState({ wasSuccessful: true });
        }
    }

    componentDidUpdate(_prevProps: SendingLightningProps) {
        const { TransactionsStore } = this.props;
        const wasSuccessful = this.successfullySent(TransactionsStore);

        if (wasSuccessful && !this.state.wasSuccessful) {
            this.fetchPayments();
            this.setState({ wasSuccessful: true }); // Update success state
        } else if (!wasSuccessful && this.state.wasSuccessful) {
            this.setState({ wasSuccessful: false }); // Reset success state if needed
        }
    }

    private isRebalanceMode(): boolean {
        return !!this.props.route?.params?.isRebalance;
    }

    private getRebalanceData(): RebalanceResult | null {
        return this.props.route?.params?.rebalanceData || null;
    }

    private renderRebalanceContent(): React.ReactNode {
        const rebalanceData = this.getRebalanceData();
        if (!rebalanceData) return null;

        const { sourceChannel, destinationChannel, rebalanceAmount, fee } =
            rebalanceData;

        const renderChannelCard = (channel: Channel, title: string) => (
            <View
                style={[
                    styles.channelCard,
                    {
                        backgroundColor: themeColor('secondary'),
                        borderColor: themeColor('text')
                    }
                ]}
            >
                <Text
                    style={[styles.channelTitle, { color: themeColor('text') }]}
                >
                    {title}
                </Text>
                <View>
                    <KeyValue
                        keyValue={localeString('general.node')}
                        value={
                            channel.displayName ||
                            channel.alias ||
                            channel.remote_pubkey?.substring(0, 20) + '...' ||
                            localeString('general.unknown')
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.channelId')}
                        value={
                            channel.chan_id ||
                            channel.channelId ||
                            localeString('general.unknown')
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.localBalance')}
                        value={
                            <Amount
                                sats={
                                    channel.local_balance ||
                                    channel.localBalance ||
                                    0
                                }
                            />
                        }
                    />
                    <KeyValue
                        keyValue={localeString('views.Channel.remoteBalance')}
                        value={
                            <Amount
                                sats={
                                    channel.remote_balance ||
                                    channel.remoteBalance ||
                                    0
                                }
                            />
                        }
                    />
                </View>
            </View>
        );

        return (
            <View style={styles.rebalanceContainer}>
                {/* Source Channel */}
                {renderChannelCard(
                    sourceChannel,
                    localeString('views.Routing.RoutingEvent.sourceChannel')
                )}

                {/* Sync Icon and Transaction Info */}
                <View
                    style={{
                        ...styles.syncContainer,
                        borderColor: themeColor('highlight')
                    }}
                >
                    <View>
                        <Sync
                            width={30}
                            height={30}
                            fill={themeColor('highlight')}
                        />
                    </View>
                    <View>
                        <Text
                            style={[
                                styles.transactionAmount,
                                { color: themeColor('text') }
                            ]}
                        >
                            <Amount sats={rebalanceAmount} />
                        </Text>
                        {fee !== undefined && (
                            <Text
                                style={[
                                    styles.transactionFee,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString('views.EditFee.titleDisplayOnly')}
                                : {fee} sats
                            </Text>
                        )}
                    </View>
                </View>

                {/* Destination Channel */}
                {renderChannelCard(
                    destinationChannel,
                    localeString(
                        'views.Routing.RoutingEvent.destinationChannel'
                    )
                )}
            </View>
        );
    }

    fetchPayments = async () => {
        const { PaymentsStore, TransactionsStore } = this.props;

        try {
            const payments = await PaymentsStore.getPayments({
                maxPayments: 5,
                reversed: true
            });

            let matchingPayment = payments.find(
                (payment: any) =>
                    payment.payment_preimage ===
                        TransactionsStore.payment_preimage ||
                    payment.getPreimage === TransactionsStore.payment_preimage
            );

            if (!matchingPayment && TransactionsStore.payment_hash) {
                matchingPayment = payments.find(
                    (payment: any) =>
                        payment.payment_hash ===
                            TransactionsStore.payment_hash ||
                        payment.paymentHash === TransactionsStore.payment_hash
                );
            }

            this.setState({ currentPayment: matchingPayment });
        } catch (error) {
            this.setState({ currentPayment: null });
            console.error('Failed to fetch payments', error);
        }
    };
    private handleBackPress(): boolean {
        const { TransactionsStore, navigation } = this.props;
        if (
            !TransactionsStore.error &&
            (this.successfullySent(TransactionsStore) ||
                this.inTransit(TransactionsStore))
        ) {
            navigation.popTo('Wallet');
            return true;
        }
        return false;
    }

    componentWillUnmount(): void {
        this.backPressSubscription?.remove();

        if (this.navigationUnsubscribe) {
            this.navigationUnsubscribe();
        }
    }

    private successfullySent(transactionStore: TransactionsStore): boolean {
        const { SettingsStore } = this.props;

        // For CLN Rest, payment_route is not available, so rely on status only
        if (SettingsStore.implementation === 'cln-rest') {
            return (
                transactionStore.status === 'complete' ||
                transactionStore.status === 'SUCCEEDED' ||
                transactionStore.status === 2
            );
        }

        return (
            transactionStore.payment_route ||
            transactionStore.status === 'complete' ||
            transactionStore.status === 'SUCCEEDED' ||
            transactionStore.status === 2
        );
    }

    private inTransit(transactionStore: TransactionsStore): boolean {
        return (
            transactionStore.status === 'IN_FLIGHT' ||
            transactionStore.status === 1
        );
    }

    render() {
        const { TransactionsStore, LnurlPayStore, navigation } = this.props;
        const {
            loading,
            error,
            error_msg,
            payment_hash,
            payment_preimage,
            payment_error,
            isIncomplete,
            noteKey
        } = TransactionsStore;
        const { storedNotes, currentPayment, isInitialProcessing } = this.state;

        const isRebalance = this.isRebalanceMode();
        const rebalanceData = this.getRebalanceData();

        const success = isRebalance
            ? rebalanceData?.success
            : this.successfullySent(TransactionsStore);

        const enhancedPath = currentPayment?.enhancedPath;
        const paymentPathExists =
            enhancedPath?.length > 0 && enhancedPath[0][0];
        const inTransit = this.inTransit(TransactionsStore);
        const windowSize = Dimensions.get('window');

        const stack = getRouteStack();
        const isSwap = stack.filter((route) => route.name === 'SwapDetails')[0];

        return (
            <Screen>
                {(isRebalance ? isInitialProcessing || loading : loading) && (
                    <View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
                        }}
                    >
                        <LightningLoadingPattern />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {isRebalance
                                ? localeString(
                                      'views.SendingLightning.sendingRebalance'
                                  )
                                : localeString(
                                      'views.SendingLightning.sending'
                                  )}
                        </Text>
                    </View>
                )}
                {!(isRebalance ? isInitialProcessing || loading : loading) && (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{
                            flexGrow: 1,
                            paddingBottom: 20
                        }}
                        showsVerticalScrollIndicator={false}
                    >
                        <View
                            style={{
                                ...styles.content,
                                paddingTop: windowSize.height * 0.05
                            }}
                        >
                            {(!!success || !!inTransit) && !error && (
                                <Wordmark
                                    height={windowSize.width * 0.25}
                                    width={windowSize.width}
                                    fill={themeColor('highlight')}
                                />
                            )}

                            {!!success && !error && (
                                <>
                                    <PaidIndicator />
                                    <View
                                        style={{
                                            alignItems: 'center',
                                            marginBottom: 20,
                                            marginTop: 20
                                        }}
                                    >
                                        <SuccessAnimation />
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                paddingTop: 20,
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 18,
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isRebalance
                                                ? localeString(
                                                      'views.SendingLightning.rebalanceSuccess'
                                                  )
                                                : localeString(
                                                      'views.SendingLightning.success'
                                                  )}
                                        </Text>
                                    </View>
                                </>
                            )}
                            {!!inTransit && !error && (
                                <View
                                    style={{
                                        padding: 20,
                                        marginTop: 10,
                                        marginBottom: 10,
                                        alignItems: 'center'
                                    }}
                                >
                                    <Clock
                                        color={themeColor('bitcoin')}
                                        width={windowSize.height * 0.2}
                                        height={windowSize.height * 0.2}
                                    />
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            fontFamily: 'PPNeueMontreal-Book',
                                            fontSize:
                                                windowSize.width *
                                                windowSize.scale *
                                                0.014,
                                            marginTop: windowSize.height * 0.03,
                                            textAlign: 'center'
                                        }}
                                    >
                                        {localeString(
                                            'views.SendingLightning.inTransit'
                                        )}
                                    </Text>
                                </View>
                            )}
                            {LnurlPayStore.isZaplocker &&
                                (!success || !!error) && (
                                    <View
                                        style={{
                                            padding: 20,
                                            marginBottom: 10,
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Clock
                                            color={themeColor('bitcoin')}
                                            width={windowSize.height * 0.2}
                                            height={windowSize.height * 0.2}
                                        />
                                        <Text
                                            style={{
                                                color: themeColor('text'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize:
                                                    windowSize.width *
                                                    windowSize.scale *
                                                    0.014,
                                                marginTop:
                                                    windowSize.height * 0.03,
                                                textAlign: 'center'
                                            }}
                                        >
                                            {localeString(
                                                'views.SendingLightning.isZaplocker'
                                            )}
                                        </Text>
                                    </View>
                                )}
                            {(!!error ||
                                !!payment_error ||
                                (isRebalance && !!rebalanceData?.error)) &&
                                !LnurlPayStore.isZaplocker && (
                                    <View style={{ alignItems: 'center' }}>
                                        <ErrorIcon
                                            width={windowSize.height * 0.13}
                                            height={windowSize.height * 0.13}
                                        />
                                        <Text
                                            style={{
                                                color: themeColor('warning'),
                                                fontFamily:
                                                    'PPNeueMontreal-Book',
                                                fontSize: 32,
                                                marginTop:
                                                    windowSize.height * 0.07
                                            }}
                                        >
                                            {localeString('general.error')}
                                        </Text>
                                        {(payment_error ||
                                            error_msg ||
                                            (isRebalance &&
                                                rebalanceData?.error)) && (
                                            <Text
                                                style={{
                                                    color: themeColor('text'),
                                                    fontFamily:
                                                        'PPNeueMontreal-Book',
                                                    fontSize:
                                                        windowSize.width *
                                                        windowSize.scale *
                                                        0.014,
                                                    textAlign: 'center',
                                                    marginTop:
                                                        windowSize.height *
                                                        0.025,
                                                    padding: 5
                                                }}
                                            >
                                                {payment_error ||
                                                    error_msg ||
                                                    (isRebalance &&
                                                        rebalanceData?.error)}
                                            </Text>
                                        )}
                                    </View>
                                )}
                            {!!success &&
                                !error &&
                                !!payment_preimage &&
                                payment_hash === LnurlPayStore.paymentHash &&
                                LnurlPayStore.successAction && (
                                    <View style={{ width: '90%' }}>
                                        <LnurlPaySuccess
                                            color="white"
                                            domain={LnurlPayStore.domain}
                                            successAction={
                                                LnurlPayStore.successAction
                                            }
                                            preimage={payment_preimage}
                                            scrollable={true}
                                            maxHeight={windowSize.height * 0.15}
                                        />
                                    </View>
                                )}
                            {!!payment_preimage &&
                                !isIncomplete &&
                                !error &&
                                !payment_error &&
                                !(isRebalance && !rebalanceData?.success) && (
                                    <View style={{ width: '90%' }}>
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
                                            URL={payment_preimage}
                                        />
                                    </View>
                                )}

                            {isRebalance &&
                                rebalanceData &&
                                rebalanceData.success && (
                                    <View
                                        style={{ width: '90%', marginTop: 5 }}
                                    >
                                        {this.renderRebalanceContent()}
                                    </View>
                                )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.buttonSection}>
                            {paymentPathExists && (
                                <Button
                                    title={`${localeString(
                                        'views.Payment.title'
                                    )} ${
                                        enhancedPath?.length > 1
                                            ? `${localeString(
                                                  'views.Payment.paths'
                                              )} (${enhancedPath.length})`
                                            : localeString('views.Payment.path')
                                    } `}
                                    onPress={() =>
                                        navigation.navigate('PaymentPaths', {
                                            enhancedPath
                                        })
                                    }
                                    secondary
                                    buttonStyle={{ height: 40 }}
                                    containerStyle={{
                                        flex:
                                            paymentPathExists &&
                                            noteKey &&
                                            !isRebalance
                                                ? 1
                                                : 0,
                                        marginRight:
                                            noteKey && !isRebalance ? 8 : 0,
                                        marginBottom: 12,
                                        width: isRebalance ? '100%' : undefined
                                    }}
                                />
                            )}
                            {noteKey &&
                                !error &&
                                !payment_error &&
                                !isRebalance && (
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
                                        onPress={() =>
                                            navigation.navigate('AddNotes', {
                                                noteKey
                                            })
                                        }
                                        secondary
                                        buttonStyle={{ height: 40 }}
                                        containerStyle={{
                                            flex:
                                                paymentPathExists &&
                                                noteKey &&
                                                !isRebalance
                                                    ? 1
                                                    : 0,
                                            marginLeft: paymentPathExists
                                                ? 8
                                                : 0,
                                            marginBottom: 12
                                        }}
                                    />
                                )}
                            {(payment_error == 'FAILURE_REASON_NO_ROUTE' ||
                                payment_error ==
                                    localeString(
                                        'error.failureReasonNoRoute'
                                    )) && (
                                <Text style={styles.errorHintText}>
                                    {localeString(
                                        'views.SendingLightning.lowFeeLimitMessage'
                                    )}
                                </Text>
                            )}
                            {(!!payment_error ||
                                !!error ||
                                (isRebalance && !!rebalanceData?.error)) && (
                                <Button
                                    title={localeString(
                                        'views.SendingLightning.tryAgain'
                                    )}
                                    icon={{
                                        name: 'return-up-back',
                                        type: 'ionicon',
                                        size: 25
                                    }}
                                    onPress={() => navigation.goBack()}
                                    buttonStyle={styles.tryAgainButton}
                                    containerStyle={styles.buttonFullWidth}
                                />
                            )}

                            {(!!error ||
                                !!payment_error ||
                                (isRebalance && !!rebalanceData?.error) ||
                                !!success ||
                                !!inTransit) && (
                                <View style={styles.bottomButtonsContainer}>
                                    <Button
                                        title={localeString(
                                            'views.SendingLightning.goToWallet'
                                        )}
                                        icon={
                                            isSwap
                                                ? undefined
                                                : {
                                                      name: 'list',
                                                      size: 25,
                                                      color: themeColor(
                                                          'background'
                                                      )
                                                  }
                                        }
                                        onPress={() => {
                                            navigation.popTo('Wallet');

                                            // If rebalance was successful, refresh channels
                                            if (isRebalance && success) {
                                                this.props.ChannelsStore?.getChannels();
                                            }
                                        }}
                                        buttonStyle={styles.walletButton}
                                        titleStyle={{
                                            color: themeColor('background')
                                        }}
                                        containerStyle={
                                            isSwap
                                                ? { flex: 1, marginRight: 5 }
                                                : styles.buttonFullWidth
                                        }
                                    />
                                    {isSwap && (
                                        <Button
                                            title={localeString(
                                                'views.Sending.goToSwap'
                                            )}
                                            titleStyle={{
                                                color: themeColor('background')
                                            }}
                                            containerStyle={{
                                                flex: 1,
                                                marginLeft: 5
                                            }}
                                            onPress={() =>
                                                navigation.popTo(
                                                    'SwapDetails',
                                                    { ...isSwap.params }
                                                )
                                            }
                                            buttonStyle={styles.walletButton}
                                            tertiary
                                        />
                                    )}
                                </View>
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
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: '100%'
    },
    buttons: {
        width: '100%',
        justifyContent: 'space-between',
        gap: 15,
        bottom: 15
    },
    // Rebalance styles
    rebalanceContainer: {
        width: '100%'
    },
    channelCard: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        shadowOffset: {
            width: 0,
            height: 0.5
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
        marginVertical: 8
    },
    channelTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        marginBottom: 12,
        textAlign: 'center',
        textTransform: 'uppercase'
    },
    syncContainer: {
        alignItems: 'center',
        marginVertical: 16,
        position: 'relative',
        padding: 16,
        borderWidth: 2,
        borderRadius: 12,
        backgroundColor: 'transparent'
    },
    transactionAmount: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        textAlign: 'center'
    },
    transactionFee: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 2
    },
    // Button styles
    buttonSection: {
        width: '100%',
        paddingHorizontal: 20,
        paddingBottom: 20,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonFullWidth: {
        width: '100%',
        marginVertical: 8
    },
    walletButton: {
        height: 50,
        width: '100%'
    },
    tryAgainButton: {
        backgroundColor: 'white',
        height: 50
    },
    bottomButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 12
    },
    errorHintText: {
        textAlign: 'center',
        color: 'white',
        fontFamily: 'PPNeueMontreal-Book',
        padding: 20,
        fontSize: 14
    }
});
