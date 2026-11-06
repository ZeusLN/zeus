import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { Divider } from '@rneui/themed';
import BigNumber from 'bignumber.js';

import Amount from '../Amount';
import KeyValue from '../KeyValue';
import Text from '../Text';

import type { SpliceRecord } from '../../stores/SpliceStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';
import {
    SpliceConfirmations,
    formatSpliceConfirmations
} from '../../utils/SpliceUtils';

interface PendingSpliceProps {
    splice: SpliceRecord;
    // the channel's capacity before the splice: LDK keeps reporting it
    // until the splice locks
    capacity: string;
    confirmations: SpliceConfirmations | null;
    testnet?: boolean;
}

export default function PendingSplice({
    splice,
    capacity,
    confirmations,
    testnet
}: PendingSpliceProps) {
    const { initiator, direction, amountSats, address, txid, capacityAfter } =
        splice;
    const ours = initiator === 'local' && !!direction && !!amountSats;
    // Once the splice transaction is read from the chain its new funding
    // output gives the exact capacity; until then ours is what we asked for
    const exact = capacityAfter != null;
    const newCapacity = exact
        ? new BigNumber(capacityAfter!)
        : ours
        ? direction === 'in'
            ? new BigNumber(capacity).plus(amountSats!)
            : new BigNumber(capacity).minus(amountSats!)
        : null;
    const amount = ours
        ? new BigNumber(amountSats!)
        : exact
        ? new BigNumber(capacityAfter!).minus(capacity).abs()
        : null;

    // our confirmations can reach the lock depth before the peer locks it
    const waitingForPeer =
        !!confirmations?.total && confirmations.current >= confirmations.total;

    return (
        <View>
            <Divider orientation="horizontal" style={styles.divider} />
            <Text style={{ ...styles.title, color: themeColor('text') }}>
                {initiator === 'remote'
                    ? localeString('views.Splice.startedByPeer')
                    : direction === 'out'
                    ? localeString('views.Splice.splicingOut')
                    : localeString('views.Splice.splicingIn')}
            </Text>
            {amount && !amount.isZero() && (
                <KeyValue
                    keyValue={localeString('general.amount')}
                    value={
                        <Amount sats={amount.toString()} sensitive toggleable />
                    }
                />
            )}
            {newCapacity && (
                <KeyValue
                    keyValue={
                        direction === 'out' && !exact
                            ? localeString('views.Splice.newCapacityBeforeFee')
                            : localeString('views.Splice.newCapacity')
                    }
                    value={
                        <Amount
                            sats={newCapacity.toString()}
                            sensitive
                            toggleable
                        />
                    }
                />
            )}
            <KeyValue
                keyValue={localeString('views.OpenChannel.numConf')}
                value={
                    confirmations
                        ? formatSpliceConfirmations(confirmations)
                        : localeString('views.Splice.waitingToConfirm')
                }
            />
            {waitingForPeer && (
                <Text
                    style={{
                        ...styles.note,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString('views.Channel.waitingForPeer')}
                </Text>
            )}
            {address && (
                <KeyValue
                    keyValue={localeString('general.destination')}
                    value={address}
                    sensitive
                />
            )}
            <KeyValue
                keyValue={localeString('views.Transaction.transactionHash')}
                value={txid}
                sensitive
                mempoolLink={() =>
                    UrlUtils.goToBlockExplorerTXID(txid, testnet)
                }
            />
            <Divider orientation="horizontal" style={styles.divider} />
        </View>
    );
}

const styles = StyleSheet.create({
    divider: {
        marginHorizontal: 20,
        marginVertical: 10
    },
    title: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        alignSelf: 'center',
        marginBottom: 6
    },
    note: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 13,
        marginBottom: 6
    }
});
