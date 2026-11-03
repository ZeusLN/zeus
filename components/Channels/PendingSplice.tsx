import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import BigNumber from 'bignumber.js';

import Amount from '../Amount';
import KeyValue from '../KeyValue';
import Text from '../Text';

import type { SpliceRecord } from '../../stores/SpliceStore';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

interface PendingSpliceProps {
    splice: SpliceRecord;
    // the channel's capacity before the splice: LDK keeps reporting it
    // until the splice locks
    capacity: string;
    confirmations: { current: number; total?: number } | null;
    testnet?: boolean;
}

export default function PendingSplice({
    splice,
    capacity,
    confirmations,
    testnet
}: PendingSpliceProps) {
    const { initiator, direction, amountSats, address, txid } = splice;
    const known = initiator === 'local' && !!direction && !!amountSats;
    const newCapacity = known
        ? direction === 'in'
            ? new BigNumber(capacity).plus(amountSats!)
            : new BigNumber(capacity).minus(amountSats!)
        : null;

    return (
        <View style={styles.container}>
            <Text style={{ ...styles.title, color: themeColor('text') }}>
                {initiator === 'remote'
                    ? localeString('views.Splice.startedByPeer')
                    : direction === 'out'
                    ? localeString('views.Splice.splicingOut')
                    : localeString('views.Splice.splicingIn')}
            </Text>
            {known && (
                <KeyValue
                    keyValue={localeString('general.amount')}
                    value={<Amount sats={amountSats} sensitive toggleable />}
                />
            )}
            {newCapacity && (
                <KeyValue
                    keyValue={localeString('views.Splice.newCapacity')}
                    value={
                        <Amount
                            sats={newCapacity.toString()}
                            sensitive
                            toggleable
                        />
                    }
                />
            )}
            {newCapacity && direction === 'out' && (
                <Text
                    style={{
                        ...styles.note,
                        color: themeColor('secondaryText')
                    }}
                >
                    {localeString('views.Splice.lessTheFee')}
                </Text>
            )}
            <KeyValue
                keyValue={localeString('views.OpenChannel.numConf')}
                value={
                    confirmations
                        ? confirmations.total
                            ? `${Math.min(
                                  confirmations.current,
                                  confirmations.total
                              )} / ${confirmations.total}`
                            : `${confirmations.current}`
                        : localeString('views.Splice.waitingToConfirm')
                }
            />
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 18
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
