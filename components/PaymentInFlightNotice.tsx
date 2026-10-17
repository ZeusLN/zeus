import * as React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { observer } from 'mobx-react';

import Button from './Button';

import TransactionsStore from '../stores/TransactionsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface PaymentInFlightNoticeProps {
    TransactionsStore: TransactionsStore;
}

// Explains why the send buttons are disabled while an earlier payment is
// being tracked. Once the node has reported that payment as in flight
// (e.g. an unsettled hold invoice), the user can release the guard to
// send something else, after confirming they understand the earlier
// payment may still complete.
function PaymentInFlightNotice({
    TransactionsStore: transactionsStore
}: PaymentInFlightNoticeProps) {
    if (!transactionsStore.paymentInFlight) return null;

    const confirmed = transactionsStore.paymentInFlightConfirmed;

    const confirmPayAnyway = () =>
        Alert.alert(
            localeString('components.PaymentInFlightNotice.confirmTitle'),
            localeString('components.PaymentInFlightNotice.confirmText'),
            [
                {
                    text: localeString('general.cancel'),
                    style: 'cancel'
                },
                {
                    text: localeString(
                        'components.PaymentInFlightNotice.payAnyway'
                    ),
                    style: 'destructive',
                    onPress: () => transactionsStore.releasePaymentInFlight()
                }
            ]
        );

    return (
        <View style={styles.container}>
            <Text style={{ ...styles.text, color: themeColor('text') }}>
                {localeString(
                    confirmed
                        ? 'components.PaymentInFlightNotice.pending'
                        : 'components.PaymentInFlightNotice.checking'
                )}
            </Text>
            {confirmed && (
                <Button
                    title={localeString(
                        'components.PaymentInFlightNotice.payAnyway'
                    )}
                    onPress={confirmPayAnyway}
                    secondary
                />
            )}
        </View>
    );
}

export default observer(PaymentInFlightNotice);

const styles = StyleSheet.create({
    container: {
        marginBottom: 10
    },
    text: {
        fontFamily: 'PPNeueMontreal-Book',
        textAlign: 'center',
        marginBottom: 10
    }
});
