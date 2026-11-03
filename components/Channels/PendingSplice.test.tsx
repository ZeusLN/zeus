import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/UrlUtils', () => ({
    goToBlockExplorerTXID: jest.fn()
}));
jest.mock('../Text', () => {
    const { Text } = require('react-native');
    return Text;
});
jest.mock('../Amount', () => {
    const { Text } = require('react-native');
    return ({ sats }: any) => <Text>{`${sats} sats`}</Text>;
});
jest.mock('../KeyValue', () => {
    const { Text, View } = require('react-native');
    return ({ keyValue, value, mempoolLink }: any) => (
        <View>
            <Text onPress={mempoolLink}>{keyValue}</Text>
            {typeof value === 'string' ? <Text>{value}</Text> : value}
        </View>
    );
});

import PendingSplice from './PendingSplice';
import UrlUtils from '../../utils/UrlUtils';

const splice = (overrides: any = {}) => ({
    userChannelId: 'user-chan',
    channelId: 'chan',
    txid: 'splice-txid',
    initiator: 'local' as const,
    direction: 'in' as const,
    amountSats: 100000,
    startedAt: 0,
    ...overrides
});

const renderSplice = (
    overrides: any = {},
    confirmations: any = { current: 2, total: 6 }
) =>
    render(
        <PendingSplice
            splice={splice(overrides)}
            capacity="300000"
            confirmations={confirmations}
        />
    );

describe('PendingSplice', () => {
    it('shows our splice-in with the capacity it will have', async () => {
        await renderSplice();

        expect(screen.getByText('views.Splice.splicingIn')).toBeOnTheScreen();
        expect(screen.getByText('100000 sats')).toBeOnTheScreen();
        expect(screen.getByText('400000 sats')).toBeOnTheScreen();
        expect(screen.getByText('2 / 6')).toBeOnTheScreen();
        expect(screen.queryByText('views.Splice.lessTheFee')).toBeNull();
    });

    it('notes that a splice-out also pays its fee from the channel', async () => {
        await renderSplice({ direction: 'out', amountSats: 30000 });

        expect(screen.getByText('views.Splice.splicingOut')).toBeOnTheScreen();
        expect(screen.getByText('270000 sats')).toBeOnTheScreen();
        expect(screen.getByText('views.Splice.lessTheFee')).toBeOnTheScreen();
    });

    it('shows where a splice-out pays to', async () => {
        await renderSplice({ direction: 'out', address: 'bc1qdest' });

        expect(screen.getByText('bc1qdest')).toBeOnTheScreen();
    });

    it("shows a peer's splice without an amount it doesn't know", async () => {
        await renderSplice({
            initiator: 'remote',
            direction: undefined,
            amountSats: undefined
        });

        expect(
            screen.getByText('views.Splice.startedByPeer')
        ).toBeOnTheScreen();
        expect(screen.queryByText('views.Splice.newCapacity')).toBeNull();
        expect(screen.queryByText('general.amount')).toBeNull();
    });

    it('stops counting at the required depth while the splice waits to lock', async () => {
        await renderSplice({}, { current: 8, total: 6 });

        expect(screen.getByText('6 / 6')).toBeOnTheScreen();
    });

    it('says it is waiting to confirm when the transaction is not in the wallet', async () => {
        await renderSplice({}, null);

        expect(
            screen.getByText('views.Splice.waitingToConfirm')
        ).toBeOnTheScreen();
    });

    it('opens the splice transaction in the block explorer', async () => {
        await renderSplice();

        screen.getByText('views.Transaction.transactionHash').props.onPress();

        expect(UrlUtils.goToBlockExplorerTXID).toHaveBeenCalledWith(
            'splice-txid',
            undefined
        );
    });
});
