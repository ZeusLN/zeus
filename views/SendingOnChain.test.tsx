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
jest.mock('../stores/NodeInfoStore', () => ({}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('../utils/UrlUtils', () => ({ __esModule: true, default: {} }));
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

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findAll = (node: any, predicate: (node: any) => boolean): any[] => {
    if (!React.isValidElement(node)) return [];
    const matches = predicate(node) ? [node] : [];
    return matches.concat(
        ...childrenOf(node).map((child) => findAll(child, predicate))
    );
};

const buttonTitles = (tree: any): string[] =>
    findAll(tree, (node) => node.type === 'Button').map(
        (button) => button.props.title
    );

const makeView = (transactionsState: Record<string, any>) => {
    const TransactionsStore = {
        loading: false,
        crafting: false,
        publishSuccess: false,
        error: false,
        error_msg: null,
        sendOutcomeUnknown: false,
        txid: null,
        funded_psbt: '',
        ...transactionsState
    };
    const navigation = {
        goBack: jest.fn(),
        popTo: jest.fn(),
        navigate: jest.fn()
    };
    const view = new SendingOnChain({
        navigation,
        NodeInfoStore: { testnet: false },
        TransactionsStore
    } as unknown as React.ComponentProps<typeof SendingOnChain>);
    return { view, navigation };
};

describe('SendingOnChain retry', () => {
    it('offers Try Again after a failed send', () => {
        const { view, navigation } = makeView({
            error: true,
            error_msg: 'insufficient funds available to construct transaction'
        });

        const tryAgain = findAll(
            view.render(),
            (node) =>
                node.type === 'Button' &&
                node.props.title === 'views.SendingLightning.tryAgain'
        );

        expect(tryAgain).toHaveLength(1);
        tryAgain[0].props.onPress();
        expect(navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('does not offer Try Again when the send may have gone out', () => {
        const { view } = makeView({
            error: true,
            error_msg: 'stores.TransactionsStore.sendOutcomeUnknown',
            sendOutcomeUnknown: true
        });

        const tree = view.render();

        expect(buttonTitles(tree)).not.toContain(
            'views.SendingLightning.tryAgain'
        );
        expect(buttonTitles(tree)).toContain(
            'views.SendingLightning.goToWallet'
        );
        expect(
            findAll(
                tree,
                (node) =>
                    node.props?.children ===
                    'stores.TransactionsStore.sendOutcomeUnknown'
            )
        ).toHaveLength(1);
    });
});

describe('SendingOnChain back button', () => {
    const pressBack = (view: any) => (view as any).handleBackPress();

    it('returns to the wallet after a successful send', () => {
        const { view, navigation } = makeView({ publishSuccess: true });

        expect(pressBack(view)).toBe(true);
        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
    });

    it('returns to the wallet when the send may have gone out', () => {
        const { view, navigation } = makeView({
            error: true,
            sendOutcomeUnknown: true
        });

        expect(pressBack(view)).toBe(true);
        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
    });

    it('returns to the wallet while the send is still running', () => {
        const { view, navigation } = makeView({ loading: true });

        expect(pressBack(view)).toBe(true);
        expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('goes back to Send after a failed send', () => {
        const { view, navigation } = makeView({ error: true });

        expect(pressBack(view)).toBe(false);
        expect(navigation.popTo).not.toHaveBeenCalled();
    });
});
