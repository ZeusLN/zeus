jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/AnimatedQRDisplay', () => 'AnimatedQRDisplay');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/Screen', () => 'Screen');
jest.mock('../components/SuccessErrorMessage', () => ({
    WarningMessage: 'WarningMessage'
}));
jest.mock('../stores/ChannelsStore', () => ({}));
jest.mock('../stores/NodeInfoStore', () => ({}));
jest.mock('../stores/SettingsStore', () => ({}));
jest.mock('../stores/TransactionsStore', () => ({}));
jest.mock('../utils/Base64Utils', () => ({
    __esModule: true,
    default: { base64ToHex: (value: string) => value }
}));
jest.mock('../utils/buttonGroupStyles', () => ({
    getButtonGroupStyles: () => ({})
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/PrivacyUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/UrlUtils', () => ({ __esModule: true, default: {} }));

import * as React from 'react';
import TxHex from './TxHex';

const FUNDING_TX = 'funding-tx';
const OTHER_TX = 'other-tx';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findAll = (node: any, predicate: (node: any) => boolean): any[] => {
    if (!React.isValidElement(node)) return [];
    const matches = predicate(node) ? [node] : [];
    return matches.concat(
        ...childrenOf(node).map((child) => findAll(child, predicate))
    );
};

// The store has one pending channel, whose funding transaction is FUNDING_TX
const makeView = (txHex: string, applied = true) => {
    const ChannelsStore = {
        pendingChanIdsFor: jest.fn((tx: { txHex: string }) =>
            tx.txHex === FUNDING_TX ? ['chan-1'] : []
        )
    };
    const TransactionsStore = {
        loading: false,
        error: false,
        finalizeTxHexAndBroadcastChannel: jest.fn().mockResolvedValue(applied),
        broadcast: jest.fn().mockResolvedValue(undefined)
    };
    const navigation = { navigate: jest.fn(), popTo: jest.fn() };
    const view = new TxHex({
        navigation,
        ChannelsStore,
        NodeInfoStore: { testnet: false },
        SettingsStore: { implementation: 'lnd' },
        TransactionsStore,
        route: { params: { txHex } }
    } as unknown as React.ComponentProps<typeof TxHex>);
    // the one button that broadcasts, found by its title
    const pressBroadcast = async (title: string) => {
        const buttons = findAll(
            view.render(),
            (node) => node.type === 'Button' && node.props.title === title
        );
        expect(buttons).toHaveLength(1);
        await buttons[0].props.onPress();
    };
    return { TransactionsStore, navigation, pressBroadcast };
};

describe('TxHex broadcast', () => {
    it('hands the transaction of a pending channel to the funding flow', async () => {
        const { TransactionsStore, navigation, pressBroadcast } =
            makeView(FUNDING_TX);

        await pressBroadcast('views.TxHex.finalizeFlowAndBroadcast');

        expect(
            TransactionsStore.finalizeTxHexAndBroadcastChannel
        ).toHaveBeenCalledTimes(1);
        expect(
            TransactionsStore.finalizeTxHexAndBroadcastChannel
        ).toHaveBeenCalledWith(FUNDING_TX, ['chan-1']);
        expect(TransactionsStore.broadcast).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });

    it('stays on the screen when the funding result was dropped as superseded', async () => {
        const { TransactionsStore, navigation, pressBroadcast } = makeView(
            FUNDING_TX,
            false
        );

        await pressBroadcast('views.TxHex.finalizeFlowAndBroadcast');

        expect(
            TransactionsStore.finalizeTxHexAndBroadcastChannel
        ).toHaveBeenCalledTimes(1);
        // nor does it go on to broadcast the transaction itself
        expect(TransactionsStore.broadcast).not.toHaveBeenCalled();
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('broadcasts a transaction that funds no pending channel itself', async () => {
        const { TransactionsStore, navigation, pressBroadcast } =
            makeView(OTHER_TX);

        await pressBroadcast('views.TxHex.broadcast');

        expect(TransactionsStore.broadcast).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.broadcast).toHaveBeenCalledWith(OTHER_TX);
        expect(
            TransactionsStore.finalizeTxHexAndBroadcastChannel
        ).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });
});
