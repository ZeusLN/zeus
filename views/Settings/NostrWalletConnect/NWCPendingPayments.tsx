import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import Button from '../../../components/Button';
import Amount from '../../../components/Amount';
import NostrWalletConnectStore, {
    PendingPayment
} from '../../../stores/NostrWalletConnectStore';
import ModalStore from '../../../stores/ModalStore';
import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';
import bolt11Utils from '../../../utils/Bolt11Utils';
import { Tag } from '../../../components/Channels/Tag';
import { ExpirationStatus } from '../../../models/Status';
import DateTimeUtils from '../../../utils/DateTimeUtils';
import PaidIndicator from '../../../components/PaidIndicator';
import SuccessAnimation from '../../../components/SuccessAnimation';

interface NWCPendingPaymentsProps {
    navigation: StackNavigationProp<any, any>;
    NostrWalletConnectStore: NostrWalletConnectStore;
    ModalStore: ModalStore;
}

interface NWCPendingPaymentState {
    loading: boolean;
    error: string | null;
    pendingPayments: PendingPayment[];
    processing: boolean;
    showSuccess: boolean;
}

@inject('NostrWalletConnectStore', 'ModalStore')
@observer
export default class NWCPendingPayments extends React.Component<
    NWCPendingPaymentsProps,
    NWCPendingPaymentState
> {
    private focusUnsubscribe?: () => void;

    constructor(props: NWCPendingPaymentsProps) {
        super(props);
        this.state = {
            loading: false,
            error: null,
            pendingPayments: [],
            processing: false,
            showSuccess: false
        };
    }

    componentDidMount(): void {
        const { navigation } = this.props;
        this.focusUnsubscribe = navigation.addListener('focus', () => {
            this.handleFocus(true);
        });

        this.getPendingPayments();
    }

    componentWillUnmount() {
        const { NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.setisInNWCPendingPaymentsView(false);
        if (this.focusUnsubscribe) {
            this.focusUnsubscribe();
            this.focusUnsubscribe = undefined;
        }
    }

    handleFocus = async (state: boolean) => {
        const { NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.setisInNWCPendingPaymentsView(state);
        this.getPendingPayments();
    };

    async getPendingPayments() {
        try {
            this.setState({ loading: true, error: null });
            const { NostrWalletConnectStore } = this.props;
            const pendingPayments =
                await NostrWalletConnectStore.getPendingPayments();
            this.setState({ pendingPayments, loading: false });
        } catch (e) {
            this.setState({
                error: (e as Error).message,
                loading: false
            });
        }
    }

    deletePendingPayments = () => {
        const { ModalStore, NostrWalletConnectStore, navigation } = this.props;
        ModalStore.toggleInfoModal({
            title: localeString('general.confirm'),
            text: localeString(
                'views.Settings.NostrWalletConnect.confirmDeletePendingPayments'
            ),
            buttons: [
                {
                    title: localeString('general.delete'),
                    callback: async () => {
                        const result =
                            await NostrWalletConnectStore.deleteAllPendingPayments();
                        if (!result) {
                            this.setState({
                                error: localeString(
                                    'views.Settings.NostrWalletConnect.error.failedTodelete'
                                )
                            });
                            return;
                        }
                        setTimeout(() => {
                            navigation.goBack();
                        }, 1000);
                    }
                }
            ]
        });
    };

    processPendingPayments = async () => {
        const { NostrWalletConnectStore, navigation } = this.props;
        const { pendingPayments } = this.state;

        try {
            this.setState({ processing: true, error: null });
            await NostrWalletConnectStore.processPendingPaymentsEvents(
                pendingPayments
            );
            await this.getPendingPayments();
            const {
                failedPendingPayInvoiceEventIds,
                isAllPendingPaymentsSuccessful
            } = NostrWalletConnectStore;
            const hasFailures = failedPendingPayInvoiceEventIds.length > 0;

            if (isAllPendingPaymentsSuccessful && !hasFailures) {
                this.setState({ showSuccess: true });
                setTimeout(() => {
                    this.setState({ showSuccess: false });
                    navigation.goBack();
                }, 4000);
            }
        } catch (error) {
            this.setState({
                error:
                    (error as Error).message ||
                    localeString(
                        'views.Settings.NostrWalletConnect.error.failedToProcessPayments'
                    )
            });
        } finally {
            this.setState({ processing: false });
        }
    };

    showErrorModal = (errorMessage: string) => {
        const { ModalStore } = this.props;
        let displayMessage = errorMessage;

        try {
            const parsed = JSON.parse(errorMessage);
            if (parsed.message) {
                displayMessage = parsed.message;
            } else if (typeof parsed === 'string') {
                displayMessage = parsed;
            }
        } catch {
            displayMessage = errorMessage;
        }

        ModalStore.toggleInfoModal({
            title: localeString(
                'components.NWCPendingPayInvoiceModal.errorTitle'
            ),
            text: displayMessage
        });
    };

    renderPaymentItem = (item: PendingPayment, index: number) => {
        const { NostrWalletConnectStore } = this.props;

        const isProcessed =
            NostrWalletConnectStore.processedPendingPayInvoiceEventIds.includes(
                item.eventId
            );
        const isFailed =
            NostrWalletConnectStore.failedPendingPayInvoiceEventIds.includes(
                item.eventId
            );
        const errorMessage =
            NostrWalletConnectStore.pendingPayInvoiceErrors.get(item.eventId);
        const isProcessing =
            NostrWalletConnectStore.isProcessingPendingPayInvoices &&
            !isProcessed &&
            !isFailed;

        let decodedInvoice: any = null;
        let isExpired = false;

        try {
            if (item.request?.params?.invoice) {
                decodedInvoice = bolt11Utils.decode(
                    item.request.params.invoice
                );
                const expiryTime =
                    decodedInvoice.timestamp + decodedInvoice.expiry;
                const currentTime = Math.floor(Date.now() / 1000);
                isExpired = currentTime > expiryTime;
            }
        } catch (e) {
            console.log('Error decoding invoice:', e);
        }

        return (
            <TouchableOpacity
                key={`${item.eventId}-${index}`}
                style={styles.eventRow}
            >
                <View style={styles.eventInfo}>
                    <View>
                        <View style={styles.nameRow}>
                            <Text
                                style={{
                                    ...styles.displayName,
                                    color: themeColor('text')
                                }}
                            >
                                {item.connectionName}
                            </Text>
                            {isExpired && (
                                <Tag status={ExpirationStatus.Expired} />
                            )}
                        </View>
                        {decodedInvoice && (
                            <Text
                                style={{
                                    ...styles.expiryLabel,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('views.Invoice.expiration')}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.eventStatus}>
                    {isProcessing && (
                        <ActivityIndicator
                            size="small"
                            color={themeColor('secondaryText')}
                        />
                    )}
                    {isFailed && (
                        <TouchableOpacity
                            onPress={() =>
                                errorMessage &&
                                this.showErrorModal(errorMessage)
                            }
                            hitSlop={{
                                top: 10,
                                bottom: 10,
                                left: 10,
                                right: 10
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 18,
                                    color: themeColor('error')
                                }}
                            >
                                {'ⓘ'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {!isFailed && isProcessed && (
                        <Text
                            style={{
                                color: themeColor('success'),
                                marginRight: 4,
                                fontSize: 16
                            }}
                        >
                            ✓
                        </Text>
                    )}
                    <View style={{ alignItems: 'flex-end' }}>
                        <Amount toggleable sats={item.amount} />
                        {decodedInvoice && (
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText'),
                                    fontSize: 12,
                                    marginTop: 4
                                }}
                            >
                                {DateTimeUtils.listFormattedDateShort(
                                    decodedInvoice.timestamp +
                                        decodedInvoice.expiry
                                )}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    renderSuccessView = () => (
        <View style={styles.successContainer}>
            <PaidIndicator />
            <SuccessAnimation />
        </View>
    );

    renderEmptyView = () => (
        <View style={styles.emptyContainer}>
            <Text
                style={{
                    ...styles.emptyText,
                    color: themeColor('secondaryText')
                }}
            >
                {localeString(
                    'components.NWCPendingPayInvoiceModal.noPending'
                ) || 'No pending payments'}
            </Text>
        </View>
    );

    renderPaymentsList = (
        payInvoicePayments: PendingPayment[],
        totalAmount: number
    ) => {
        const { processing } = this.state;
        const { NostrWalletConnectStore } = this.props;
        const hasFailures =
            NostrWalletConnectStore.failedPendingPayInvoiceEventIds.length > 0;

        return (
            <>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.totalSection}>
                        <Text
                            style={{
                                ...styles.totalLabel,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString(
                                'components.NWCPendingPayInvoiceModal.totalAmount'
                            )}
                        </Text>
                        <Amount sats={totalAmount} jumboText debit toggleable />
                    </View>

                    <View
                        style={{
                            ...styles.listContainer,
                            backgroundColor: themeColor('card')
                        }}
                    >
                        {payInvoicePayments.map((item, index) =>
                            this.renderPaymentItem(item, index)
                        )}
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        title={
                            processing
                                ? localeString('general.processing')
                                : hasFailures
                                ? localeString('general.retry')
                                : localeString('general.pay')
                        }
                        disabled={processing}
                        onPress={this.processPendingPayments}
                    />
                    <Button
                        warning
                        title={'Clear All'}
                        disabled={processing}
                        onPress={this.deletePendingPayments}
                    />
                </View>
            </>
        );
    };

    render() {
        const { navigation } = this.props;
        const { loading, error, pendingPayments, processing, showSuccess } =
            this.state;

        const safePendingPayments = Array.isArray(pendingPayments)
            ? pendingPayments
            : [];
        const payInvoicePayments = safePendingPayments.filter(
            (payment) => payment.request?.method === 'pay_invoice'
        );
        const totalAmount = payInvoicePayments.reduce(
            (sum, payment) => sum + payment.amount,
            0
        );

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString(
                            'components.NWCPendingPayInvoiceModal.pendingInvoices'
                        ),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <View style={styles.headerRight}>
                            {(loading || processing) && (
                                <View style={{ marginRight: 10 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                        </View>
                    }
                    navigation={navigation}
                />

                {error && <ErrorMessage message={error} />}
                {showSuccess ? (
                    this.renderSuccessView()
                ) : (
                    <View style={styles.container}>
                        {payInvoicePayments.length === 0 && !loading
                            ? this.renderEmptyView()
                            : this.renderPaymentsList(
                                  payInvoicePayments,
                                  totalAmount
                              )}
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 15
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    scrollView: {
        flex: 1,
        marginTop: 10
    },
    scrollContent: {
        paddingBottom: 100
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 16
    },
    listContainer: {
        borderRadius: 12,
        paddingVertical: 4,
        marginBottom: 20
    },
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12
    },
    eventInfo: {
        flex: 1,
        marginRight: 12
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    displayName: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 4
    },
    expiryLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 13,
        marginTop: 4
    },
    eventStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    totalSection: {
        marginTop: 10,
        alignItems: 'center',
        marginBottom: 20
    },
    totalLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        gap: 10
    }
});
