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
}

@inject('NostrWalletConnectStore', 'ModalStore')
@observer
export default class NWCPendingPayments extends React.Component<
    NWCPendingPaymentsProps,
    NWCPendingPaymentState
> {
    constructor(props: NWCPendingPaymentsProps) {
        super(props);
        this.state = {
            loading: false,
            error: null,
            pendingPayments: [],
            processing: false
        };
    }

    componentDidMount(): void {
        const { navigation } = this.props;
        navigation.addListener('focus', () => this.handleFocus(true));
        this.getPendingPayments();
    }
    componentWillUnmount() {
        const { navigation, NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.setisInNWCPendingPaymentsView(false);
        navigation.removeListener('focus', () => this.handleFocus(false));
    }
    handleFocus = async (state: boolean) => {
        const { NostrWalletConnectStore } = this.props;
        NostrWalletConnectStore.setisInNWCPendingPaymentsView(state);
        this.getPendingPayments();
    };
    async getPendingPayments() {
        try {
            this.setState({
                loading: true,
                error: null
            });
            const { NostrWalletConnectStore } = this.props;
            const pendingPayments =
                await NostrWalletConnectStore.getPendingPayments();
            this.setState({
                pendingPayments,
                loading: false
            });
        } catch (e) {
            this.setState({
                error: (e as Error).message,
                loading: false
            });
        }
    }
    deletePendingPayments = () => {
        const { ModalStore, NostrWalletConnectStore } = this.props;
        ModalStore.toggleInfoModal({
            title: localeString('general.confirm'),
            text: 'Are you sure you want to delete all pending payments?',
            buttons: [
                {
                    title: localeString('general.delete') || 'Delete',
                    callback: async () => {
                        const result =
                            await NostrWalletConnectStore.deletePendingPayments();
                        if (!result) {
                            this.setState({ error: 'failed to delete' });
                        }
                    }
                }
            ]
        });
    };

    processPendingPayments = async () => {
        const { NostrWalletConnectStore } = this.props;
        const { pendingPayments } = this.state;

        try {
            this.setState({ processing: true, error: null });

            await NostrWalletConnectStore.processPendingPaymentsEvents(
                pendingPayments
            );
            await this.getPendingPayments();
        } catch (error) {
            this.setState({
                error: (error as Error).message || 'Failed to process payments'
            });
        } finally {
            this.setState({ processing: false });
        }
    };

    render() {
        const { navigation, NostrWalletConnectStore } = this.props;
        const { loading, error, pendingPayments, processing } = this.state;
        const { failedPendingPayInvoiceEventIds } = NostrWalletConnectStore;

        const hasFailures = failedPendingPayInvoiceEventIds.length > 0;

        const safePendingPayments = Array.isArray(pendingPayments)
            ? pendingPayments
            : [];

        // Filter to show only pay_invoice method payments
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
                        <View
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}
                        >
                            {(loading || processing) && (
                                <View style={{ marginRight: 10 }}>
                                    <LoadingIndicator size={30} />
                                </View>
                            )}
                        </View>
                    }
                    navigation={navigation}
                />

                {error ? (
                    <ErrorMessage message={error} />
                ) : (
                    <View style={styles.container}>
                        {payInvoicePayments.length === 0 && !loading ? (
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
                        ) : (
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
                                                color: themeColor(
                                                    'secondaryText'
                                                )
                                            }}
                                        >
                                            {localeString(
                                                'components.NWCPendingPayInvoiceModal.totalAmount'
                                            )}
                                        </Text>
                                        <Amount
                                            sats={totalAmount}
                                            jumboText
                                            debit
                                            toggleable
                                        />
                                    </View>

                                    <View
                                        style={{
                                            ...styles.listContainer,
                                            backgroundColor: themeColor('card')
                                        }}
                                    >
                                        {payInvoicePayments.map(
                                            (item, index) => {
                                                const {
                                                    NostrWalletConnectStore,
                                                    ModalStore
                                                } = this.props;

                                                const isProcessed =
                                                    NostrWalletConnectStore.processedPendingPayInvoiceEventIds.includes(
                                                        item.eventId
                                                    );
                                                const isFailed =
                                                    NostrWalletConnectStore.failedPendingPayInvoiceEventIds.includes(
                                                        item.eventId
                                                    );
                                                const errorMessage =
                                                    NostrWalletConnectStore.pendingPayInvoiceErrors.get(
                                                        item.eventId
                                                    );
                                                const isProcessing =
                                                    NostrWalletConnectStore.isProcessingPendingPayInvoices &&
                                                    !isProcessed &&
                                                    !isFailed;

                                                // Decode invoice for more details
                                                let decodedInvoice: any = null;
                                                let isExpired = false;
                                                try {
                                                    if (
                                                        item.request?.params
                                                            ?.invoice
                                                    ) {
                                                        decodedInvoice =
                                                            bolt11Utils.decode(
                                                                item.request
                                                                    .params
                                                                    .invoice
                                                            );
                                                        // Check if invoice is expired
                                                        const expiryTime =
                                                            decodedInvoice.timestamp +
                                                            decodedInvoice.expiry;
                                                        const currentTime =
                                                            Math.floor(
                                                                Date.now() /
                                                                    1000
                                                            );
                                                        isExpired =
                                                            currentTime >
                                                            expiryTime;
                                                    }
                                                } catch (e) {
                                                    console.log(
                                                        'Error decoding invoice:',
                                                        e
                                                    );
                                                }

                                                return (
                                                    <TouchableOpacity
                                                        key={`${item.eventId}-${index}`}
                                                        style={styles.eventRow}
                                                    >
                                                        <View
                                                            style={
                                                                styles.eventInfo
                                                            }
                                                        >
                                                            <View>
                                                                <View
                                                                    style={{
                                                                        flexDirection:
                                                                            'row',
                                                                        alignItems:
                                                                            'center'
                                                                    }}
                                                                >
                                                                    <Text
                                                                        style={{
                                                                            ...styles.displayName,
                                                                            color: themeColor(
                                                                                'text'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {
                                                                            item.connectionName
                                                                        }
                                                                    </Text>
                                                                    {isExpired && (
                                                                        <Tag
                                                                            status={
                                                                                ExpirationStatus.Expired
                                                                            }
                                                                        />
                                                                    )}
                                                                </View>
                                                                {decodedInvoice && (
                                                                    <Text
                                                                        style={{
                                                                            ...styles.expiryLabel,
                                                                            color: themeColor(
                                                                                'secondaryText'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {localeString(
                                                                            'views.Invoice.expiration'
                                                                        )}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>

                                                        <View
                                                            style={
                                                                styles.eventStatus
                                                            }
                                                        >
                                                            {isProcessing && (
                                                                <ActivityIndicator
                                                                    size="small"
                                                                    color={themeColor(
                                                                        'secondaryText'
                                                                    )}
                                                                />
                                                            )}
                                                            {isFailed && (
                                                                <TouchableOpacity
                                                                    onPress={() => {
                                                                        if (
                                                                            errorMessage
                                                                        ) {
                                                                            let displayMessage =
                                                                                errorMessage;
                                                                            try {
                                                                                const parsed =
                                                                                    JSON.parse(
                                                                                        errorMessage
                                                                                    );
                                                                                if (
                                                                                    parsed.message
                                                                                ) {
                                                                                    displayMessage =
                                                                                        parsed.message;
                                                                                } else if (
                                                                                    typeof parsed ===
                                                                                    'string'
                                                                                ) {
                                                                                    displayMessage =
                                                                                        parsed;
                                                                                }
                                                                            } catch {
                                                                                displayMessage =
                                                                                    errorMessage;
                                                                            }
                                                                            ModalStore.toggleInfoModal(
                                                                                {
                                                                                    title: localeString(
                                                                                        'components.NWCPendingPayInvoiceModal.errorTitle'
                                                                                    ),
                                                                                    text: displayMessage
                                                                                }
                                                                            );
                                                                        }
                                                                    }}
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
                                                                            color: themeColor(
                                                                                'error'
                                                                            )
                                                                        }}
                                                                    >
                                                                        {'ⓘ'}
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            )}
                                                            {!isFailed &&
                                                                isProcessed && (
                                                                    <Text
                                                                        style={{
                                                                            color: themeColor(
                                                                                'success'
                                                                            ),
                                                                            marginRight: 4,
                                                                            fontSize: 16
                                                                        }}
                                                                    >
                                                                        ✓
                                                                    </Text>
                                                                )}
                                                            <View
                                                                style={{
                                                                    alignItems:
                                                                        'flex-end'
                                                                }}
                                                            >
                                                                <Amount
                                                                    toggleable
                                                                    sats={
                                                                        item.amount
                                                                    }
                                                                />
                                                                {decodedInvoice && (
                                                                    <Text
                                                                        style={{
                                                                            fontFamily:
                                                                                'PPNeueMontreal-Book',
                                                                            color: themeColor(
                                                                                'secondaryText'
                                                                            ),
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
                                            }
                                        )}
                                    </View>
                                </ScrollView>

                                <View style={styles.footer}>
                                    <Button
                                        title={
                                            processing
                                                ? localeString(
                                                      'general.processing'
                                                  )
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
    scrollView: {
        flex: 1,
        marginTop: 10
    },
    scrollContent: {
        paddingBottom: 100
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
