jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('../NavigationService', () => ({
    getRouteStack: jest.fn(() => [])
}));
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/CopyBox', () => 'CopyBox');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/SuccessAnimation', () => 'SuccessAnimation');
jest.mock('../components/layout/Row', () => ({ Row: 'Row' }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000' }));
jest.mock('../utils/UrlUtils', () => ({}));
// keep the real route-stack check; the rest of SwapUtils is not used here
jest.mock('@react-native-documents/picker', () => ({
    saveDocuments: jest.fn()
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn().mockResolvedValue('') }
}));
jest.mock('../assets/images/SVG/ErrorIcon.svg', () => 'ErrorIcon');
jest.mock('../assets/images/SVG/wordmark-black.svg', () => 'Wordmark');

import * as React from 'react';
import { render, screen } from '@testing-library/react-native';
import SendingOnChain from './SendingOnChain';
import { getRouteStack } from '../NavigationService';

const SUBMARINE = {
    id: 'swap',
    type: 'Submarine',
    address: 'bc1pswap',
    bip21: 'bitcoin:bc1pswap?amount=0.001004'
};

const stackFrom = (swapData: any, destination = 'bc1pswap') =>
    (getRouteStack as jest.Mock).mockReturnValue([
        { name: 'Wallet', key: 'Wallet-1' },
        { name: 'SwapDetails', key: 'SwapDetails-1', params: { swapData } },
        { name: 'Send', key: 'Send-1', params: { destination } },
        {
            name: 'VerifyOnChain',
            key: 'VerifyOnChain-1',
            params: { destination }
        },
        { name: 'SendingOnChain', key: 'SendingOnChain-1' }
    ]);

// Mounts the screen while the send is out, then re-renders it with the
// send's outcome, as the observer does when TransactionsStore changes
const send = async (outcome: { [key: string]: any }) => {
    const SwapStore = { markSwapFunded: jest.fn() };
    const TransactionsStore: any = { loading: true, crafting: false };
    const props: any = {
        navigation: { addListener: jest.fn(), popTo: jest.fn() },
        NodeInfoStore: {},
        SwapStore,
        TransactionsStore
    };
    await render(<SendingOnChain {...props} />);
    expect(SwapStore.markSwapFunded).not.toHaveBeenCalled();

    Object.assign(TransactionsStore, { loading: false, ...outcome });
    await screen.rerender(<SendingOnChain {...props} />);
    await screen.rerender(<SendingOnChain {...props} />);
    return SwapStore;
};

const SUCCESS = { publishSuccess: true, txid: 'txid' };

afterEach(() => (getRouteStack as jest.Mock).mockReturnValue([]));

describe('SendingOnChain after a swap pay button', () => {
    it('marks the submarine swap as funded once the transaction is out', async () => {
        stackFrom(SUBMARINE);
        const SwapStore = await send(SUCCESS);

        expect(SwapStore.markSwapFunded.mock.calls).toEqual([['swap']]);
    });

    it('leaves the swap to be paid after a failed send', async () => {
        stackFrom(SUBMARINE);
        const SwapStore = await send({
            error: true,
            error_msg: 'insufficient funds'
        });

        expect(SwapStore.markSwapFunded).not.toHaveBeenCalled();
    });

    it('marks nothing when the send went to another address', async () => {
        stackFrom(SUBMARINE, 'bc1qelsewhere');
        const SwapStore = await send(SUCCESS);

        expect(SwapStore.markSwapFunded).not.toHaveBeenCalled();
    });

    it('marks nothing for a send not started from a swap', async () => {
        const SwapStore = await send(SUCCESS);

        expect(SwapStore.markSwapFunded).not.toHaveBeenCalled();
    });
});
