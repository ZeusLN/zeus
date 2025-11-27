import React from 'react';
import {
    View,
    StyleSheet,
    Text,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import { inject, observer } from 'mobx-react';

import Button from '../Button';
import ModalBox from '../ModalBox';
import Amount from '../Amount';

import ModalStore from '../../stores/ModalStore';
import NostrWalletConnectStore from '../../stores/NostrWalletConnectStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { font } from '../../utils/FontUtils';

interface NWCPendingPaymentsModalProps {
    ModalStore: ModalStore;
    NostrWalletConnectStore: NostrWalletConnectStore;
}

@inject('ModalStore', 'NostrWalletConnectStore')
@observer
export default class NWCPendingPaymentsModal extends React.Component<
    NWCPendingPaymentsModalProps,
    {}
> {
    render() {
        const { ModalStore, NostrWalletConnectStore } = this.props;
        const {
            showNWCPendingPaymentsModal,
            nwcPendingPaymentsData,
            toggleNWCPendingPaymentsModal
        } = ModalStore;

        const {
            isProcessingPendingPayInvoices,
            processedPendingPayInvoiceEventIds,
            failedPendingPayInvoiceEventIds
        } = NostrWalletConnectStore;

        if (!nwcPendingPaymentsData || !showNWCPendingPaymentsModal) {
            return null;
        }

        const { pendingEvents, totalAmount } = nwcPendingPaymentsData as {
            pendingEvents: any[];
            totalAmount: number;
        };

        const connectionStats = new Map<
            string,
            { amount: number; count: number }
        >();
        pendingEvents.forEach((event: any) => {
            const current = connectionStats.get(event.connectionName) || {
                amount: 0,
                count: 0
            };
            connectionStats.set(event.connectionName, {
                amount: current.amount + event.amount,
                count: current.count + 1
            });
        });

        const connectionList = Array.from(connectionStats.entries()).map(
            ([name, stats]) => {
                const eventsForConnection = pendingEvents.filter(
                    (e: any) => e.connectionName === name
                );
                const hasEvents = eventsForConnection.length > 0;
                const successCount = eventsForConnection.filter((e: any) =>
                    processedPendingPayInvoiceEventIds.includes(e.eventId)
                ).length;
                const failureCount = eventsForConnection.filter((e: any) =>
                    failedPendingPayInvoiceEventIds.includes(e.eventId)
                ).length;

                const completed =
                    hasEvents &&
                    failureCount === 0 &&
                    successCount === eventsForConnection.length;
                const failed = failureCount > 0;

                return {
                    name,
                    amount: stats.amount,
                    count: stats.count,
                    completed,
                    failed
                };
            }
        );

        const hasFailures = failedPendingPayInvoiceEventIds.length > 0;

        return (
            <ModalBox
                isOpen={showNWCPendingPaymentsModal}
                backdropPressToClose={false}
                swipeToClose={false}
                style={{
                    backgroundColor: 'transparent',
                    minHeight: 200
                }}
                onClosed={() => toggleNWCPendingPaymentsModal({})}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}
                >
                    <View
                        style={{
                            backgroundColor: themeColor('modalBackground'),
                            borderRadius: 30,
                            padding: 20,
                            width: '100%',
                            maxHeight: '85%',
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2
                            }
                        }}
                    >
                        <View style={styles.header}>
                            <Text
                                style={{
                                    fontFamily: font('marlideBold'),
                                    color: themeColor('text'),
                                    fontSize: 28,
                                    textAlign: 'center',
                                    marginBottom: 8
                                }}
                            >
                                {localeString(
                                    'components.NWCPendingPayInvoiceModal.title'
                                )}
                            </Text>

                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    color: themeColor('secondaryText'),
                                    fontSize: 16,
                                    textAlign: 'center',
                                    lineHeight: 22
                                }}
                            >
                                {connectionList.length > 1
                                    ? localeString(
                                          'components.NWCPendingPayInvoiceModal.descriptionMultiple'
                                      )
                                    : localeString(
                                          'components.NWCPendingPayInvoiceModal.description'
                                      )}
                            </Text>
                        </View>

                        {connectionList.length > 0 && (
                            <View style={styles.connectionsSection}>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText'),
                                        fontSize: 14,
                                        marginBottom: 8,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}
                                >
                                    {localeString(
                                        'views.Settings.NostrWalletConnect.connections'
                                    )}{' '}
                                    {':'}
                                </Text>
                                <View style={styles.scrollContainer}>
                                    <ScrollView
                                        showsVerticalScrollIndicator={true}
                                        nestedScrollEnabled={true}
                                        scrollEventThrottle={16}
                                    >
                                        {connectionList.map(
                                            (item: {
                                                name: string;
                                                amount: number;
                                                count: number;
                                                completed: boolean;
                                                failed: boolean;
                                            }) => (
                                                <View
                                                    key={item.name}
                                                    style={styles.connectionRow}
                                                >
                                                    <View
                                                        style={
                                                            styles.connectionInfo
                                                        }
                                                    >
                                                        <Text
                                                            style={{
                                                                fontFamily:
                                                                    'PPNeueMontreal-Book',
                                                                color: themeColor(
                                                                    'text'
                                                                ),
                                                                fontSize: 17
                                                            }}
                                                        >
                                                            {item.name}
                                                            {item.count > 1
                                                                ? ` (${item.count})`
                                                                : ''}
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.connectionStatus
                                                        }
                                                    >
                                                        {isProcessingPendingPayInvoices &&
                                                            !item.completed &&
                                                            !item.failed && (
                                                                <ActivityIndicator
                                                                    size="small"
                                                                    color={themeColor(
                                                                        'secondaryText'
                                                                    )}
                                                                />
                                                            )}
                                                        {item.failed && (
                                                            <Text
                                                                style={{
                                                                    fontSize: 18,
                                                                    color: themeColor(
                                                                        'error'
                                                                    )
                                                                }}
                                                            >
                                                                !
                                                            </Text>
                                                        )}
                                                        {!item.failed &&
                                                            item.completed && (
                                                                <Text
                                                                    style={
                                                                        (styles.connectionCompleted,
                                                                        {
                                                                            color: themeColor(
                                                                                'success'
                                                                            )
                                                                        })
                                                                    }
                                                                >
                                                                    ✓
                                                                </Text>
                                                            )}
                                                        <Amount
                                                            sats={item.amount}
                                                        />
                                                    </View>
                                                </View>
                                            )
                                        )}
                                    </ScrollView>
                                </View>
                            </View>
                        )}

                        <View style={styles.totalSection}>
                            <View style={styles.totalContainer}>
                                <Text
                                    style={{
                                        fontFamily: 'PPNeueMontreal-Book',
                                        color: themeColor('secondaryText'),
                                        fontSize: 14,
                                        marginBottom: 8,
                                        textTransform: 'uppercase',
                                        letterSpacing: 0.5
                                    }}
                                >
                                    {localeString(
                                        'components.NWCPendingPayInvoiceModal.totalAmount'
                                    )}
                                </Text>
                                <Amount sats={totalAmount} jumboText debit />
                            </View>
                        </View>

                        <View style={styles.buttons}>
                            <View style={styles.button}>
                                <Button
                                    title={
                                        isProcessingPendingPayInvoices
                                            ? localeString(
                                                  'views.SendingLightning.sending'
                                              )
                                            : hasFailures
                                            ? localeString(
                                                  'components.NWCPendingPayInvoiceModal.retryFailed'
                                              )
                                            : localeString('general.pay')
                                    }
                                    onPress={() => {
                                        if (isProcessingPendingPayInvoices) {
                                            return;
                                        }
                                        const eventsToProcess = hasFailures
                                            ? pendingEvents.filter((e: any) =>
                                                  failedPendingPayInvoiceEventIds.includes(
                                                      e.eventId
                                                  )
                                              )
                                            : pendingEvents;
                                        if (eventsToProcess.length === 0) {
                                            return;
                                        }
                                        NostrWalletConnectStore.processPendingPaymentsEvents(
                                            eventsToProcess
                                        );
                                    }}
                                />
                            </View>
                            <View style={styles.button}>
                                <Button
                                    title={localeString('general.cancel')}
                                    onPress={() => {
                                        toggleNWCPendingPaymentsModal({});
                                        NostrWalletConnectStore.resetPendingPayInvoiceState();
                                    }}
                                    secondary
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    header: {
        marginBottom: 16
    },
    connectionsSection: {
        marginBottom: 16,
        width: '90%',
        alignSelf: 'center'
    },
    scrollContainer: {
        maxHeight: 200,
        paddingVertical: 4,
        borderRadius: 12,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3
    },
    connectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 0
    },
    connectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    connectionCompleted: {
        marginRight: 4,
        fontSize: 16
    },

    totalSection: {
        marginBottom: 20
    },
    totalContainer: {
        alignItems: 'center'
    },
    buttons: {
        width: '100%',
        alignItems: 'center'
    },
    button: {
        width: '100%',
        marginBottom: 12
    }
});
