import React from 'react';
import {
    View,
    StyleSheet,
    Text,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity
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
            failedPendingPayInvoiceEventIds,
            pendingPayInvoiceErrors
        } = NostrWalletConnectStore;

        if (!nwcPendingPaymentsData || !showNWCPendingPaymentsModal) {
            return null;
        }
        const { pendingEvents, totalAmount } = nwcPendingPaymentsData as {
            pendingEvents: any[];
            totalAmount: number;
        };
        const eventList = pendingEvents.map((event: any) => {
            const isProcessed = processedPendingPayInvoiceEventIds.includes(
                event.eventId
            );
            const isFailed = failedPendingPayInvoiceEventIds.includes(
                event.eventId
            );
            const errorMessage = pendingPayInvoiceErrors.get(event.eventId);
            const isProcessing =
                isProcessingPendingPayInvoices && !isProcessed && !isFailed;

            return {
                eventId: event.eventId,
                connectionName: event.connectionName,
                amount: event.amount,
                isProcessed,
                isFailed,
                isProcessing,
                errorMessage
            };
        });

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
                                {eventList.length > 1
                                    ? localeString(
                                          'components.NWCPendingPayInvoiceModal.descriptionMultiple'
                                      )
                                    : localeString(
                                          'components.NWCPendingPayInvoiceModal.description'
                                      )}
                            </Text>
                        </View>

                        {eventList.length > 0 && (
                            <View style={styles.eventsSection}>
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
                                        'components.NWCPendingPayInvoiceModal.pendingInvoices'
                                    )}{' '}
                                    {':'}
                                </Text>
                                <View style={styles.scrollContainer}>
                                    <ScrollView
                                        showsVerticalScrollIndicator={true}
                                        nestedScrollEnabled={true}
                                        scrollEventThrottle={16}
                                    >
                                        {eventList.map(
                                            (item: {
                                                eventId: string;
                                                connectionName: string;
                                                amount: number;
                                                isProcessed: boolean;
                                                isFailed: boolean;
                                                isProcessing: boolean;
                                                errorMessage?: string;
                                            }) => (
                                                <View
                                                    key={item.eventId}
                                                    style={styles.eventRow}
                                                >
                                                    <View
                                                        style={styles.eventInfo}
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
                                                            {
                                                                item.connectionName
                                                            }
                                                        </Text>
                                                    </View>
                                                    <View
                                                        style={
                                                            styles.eventStatus
                                                        }
                                                    >
                                                        {item.isProcessing && (
                                                            <ActivityIndicator
                                                                size="small"
                                                                color={themeColor(
                                                                    'secondaryText'
                                                                )}
                                                            />
                                                        )}
                                                        {item.isFailed && (
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    if (
                                                                        item.errorMessage
                                                                    ) {
                                                                        let displayMessage =
                                                                            item.errorMessage;
                                                                        try {
                                                                            const parsed =
                                                                                JSON.parse(
                                                                                    item.errorMessage
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
                                                                                item.errorMessage;
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
                                                        {!item.isFailed &&
                                                            item.isProcessed && (
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
                                <Amount
                                    sats={totalAmount}
                                    jumboText
                                    debit
                                    toggleable
                                />
                            </View>
                        </View>

                        <View style={styles.buttons}>
                            <View style={styles.button}>
                                <Button
                                    disabled={isProcessingPendingPayInvoices}
                                    title={
                                        isProcessingPendingPayInvoices
                                            ? localeString('general.processing')
                                            : hasFailures
                                            ? localeString('general.retry')
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
                                    title={localeString('general.payLater')}
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
    eventsSection: {
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
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 0
    },
    eventInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12
    },
    eventStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
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
