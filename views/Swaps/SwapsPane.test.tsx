jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../../stores/Stores', () => ({
    nodeInfoStore: { nodeInfo: {} },
    settingsStore: { settings: {} }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/Amount', () => 'Amount');
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage'
}));

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import SwapsPane from './SwapsPane';
import Swap, { SwapType } from '../../models/Swap';

const renderPane = async (swap: any) => {
    const SwapStore = {
        swaps: [new Swap({ id: 'swap', ...swap })],
        swapsLoading: false,
        fetchAndUpdateSwaps: jest.fn(),
        formatStatus: (status: string) => status,
        statusColor: () => '#000',
        getReverseSwapReceiveAmount: jest.fn(() => 99000)
    };
    await render(
        <SwapsPane
            {...({
                navigation: { addListener: jest.fn(), navigate: jest.fn() },
                SwapStore
            } as any)}
        />
    );
    return SwapStore;
};

const shows = (key: string) => screen.queryByText(key) !== null;

describe('SwapsPane amount row', () => {
    it('shows the on-chain amount of a reverse swap created here', async () => {
        const store = await renderPane({
            type: SwapType.Reverse,
            onchainAmount: 99100,
            claimMinerFee: 100
        });

        expect(shows('views.SwapDetails.onchainAmount')).toBe(true);
        expect(store.getReverseSwapReceiveAmount).toHaveBeenCalledWith(
            99100,
            100
        );
    });

    it('hides the on-chain amount of a rescued reverse swap', async () => {
        // a legacy rescue copied these, and expectedAmount, from the host
        const store = await renderPane({
            type: SwapType.Reverse,
            imported: true,
            onchainAmount: 99100,
            claimMinerFee: 300000,
            expectedAmount: 99100
        });

        expect(shows('views.Swaps.SwapsPane.imported')).toBe(true);
        expect(shows('views.SwapDetails.onchainAmount')).toBe(false);
        expect(store.getReverseSwapReceiveAmount).not.toHaveBeenCalled();
    });

    it.each([undefined, true])(
        'shows the expected amount of a submarine swap with imported %s',
        async (imported) => {
            await renderPane({
                type: SwapType.Submarine,
                imported,
                expectedAmount: 50000
            });

            expect(shows('views.SwapDetails.expectedAmount')).toBe(true);
        }
    );
});
