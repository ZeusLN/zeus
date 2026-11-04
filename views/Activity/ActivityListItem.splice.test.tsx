jest.mock('mobx-react', () => ({
    observer: (component: any) => component
}));
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../stores/Stores', () => ({ notesStore: { notes: {} } }));
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('@rneui/themed', () => {
    const { Text, View } = require('react-native');
    const Part = ({ children }: any) => <View>{children}</View>;
    const TextPart = ({ children }: any) => <Text>{children}</Text>;
    const ListItem: any = Part;
    ListItem.Content = Part;
    ListItem.Title = TextPart;
    ListItem.Subtitle = TextPart;
    return { ListItem };
});

import ActivityListItem from './ActivityListItem';
import Splice from '../../models/Splice';

const record = {
    userChannelId: 'user-chan',
    channelId: 'chan',
    txid: 'splice-txid',
    initiator: 'local' as const,
    direction: 'out' as const,
    amountSats: 30000,
    startedAt: 0
};

const renderRow = (status: 'pending' | 'locked', spliceStore: any) =>
    render(
        <ActivityListItem
            item={new Splice({ ...record, status })}
            onItemPress={jest.fn()}
            swapStore={{} as any}
            spliceStore={spliceStore}
        />
    );

const statusText = () =>
    screen.getByText(/general\.status/).props.children.join('');

describe('ActivityListItem splice row', () => {
    it("shows a pending splice's confirmations", async () => {
        await renderRow('pending', {
            getSpliceConfirmations: () => ({ current: 3, total: 6 })
        });

        expect(statusText()).toContain('3 / 6');
    });

    it('waits to confirm before the transaction is in the wallet', async () => {
        await renderRow('pending', { getSpliceConfirmations: () => null });

        expect(statusText()).toContain('views.Splice.waitingToConfirm');
    });

    it('shows a locked splice as completed', async () => {
        const getSpliceConfirmations = jest.fn();
        await renderRow('locked', { getSpliceConfirmations });

        expect(statusText()).toContain('views.Splice.completed');
        expect(getSpliceConfirmations).not.toHaveBeenCalled();
    });
});
