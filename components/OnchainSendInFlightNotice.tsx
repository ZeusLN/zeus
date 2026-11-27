import * as React from 'react';
import { StyleSheet, Text } from 'react-native';
import { observer } from 'mobx-react';
import { useIsFocused } from '@react-navigation/native';

import TransactionsStore from '../stores/TransactionsStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface OnchainSendInFlightNoticeProps {
    TransactionsStore: TransactionsStore;
}

// Explains why the on-chain send buttons are disabled while an earlier
// send is still waiting on the node.
function OnchainSendInFlightNotice({
    TransactionsStore: transactionsStore
}: OnchainSendInFlightNoticeProps) {
    // The screen that dispatched the send takes the guard and navigates to
    // SendingOnChain in the same tick, so it renders once more while
    // animating out. Showing the notice there would describe the send just
    // started as "a previous send".
    const isFocused = useIsFocused();
    if (!transactionsStore.onchainSendInFlight || !isFocused) return null;

    return (
        <Text style={{ ...styles.text, color: themeColor('text') }}>
            {localeString('components.OnchainSendInFlightNotice.text')}
        </Text>
    );
}

export default observer(OnchainSendInFlightNotice);

const styles = StyleSheet.create({
    text: {
        fontFamily: 'Roboto-Regular',
        textAlign: 'center',
        marginBottom: 10
    }
});
