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
jest.mock('../utils/PrivacyUtils', () => ({}));
jest.mock('../utils/PsbtUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../utils/UrlUtils', () => ({}));

import * as React from 'react';
import PSBT from './PSBT';

const FUNDING_PSBT = 'funding-psbt';
const OTHER_PSBT = 'other-psbt';

const childrenOf = (element: any): any[] =>
    React.Children.toArray(element?.props?.children);

const findAll = (node: any, predicate: (node: any) => boolean): any[] => {
    if (!React.isValidElement(node)) return [];
    const matches = predicate(node) ? [node] : [];
    return matches.concat(
        ...childrenOf(node).map((child) => findAll(child, predicate))
    );
};

const flushPromises = () => new Promise(setImmediate);

// The store has one pending channel, whose funding PSBT is FUNDING_PSBT
const makeView = (psbt: string, applied = true) => {
    const ChannelsStore = {
        pendingChanIdsFor: jest.fn((tx: { psbt: string }) =>
            tx.psbt === FUNDING_PSBT ? ['chan-1'] : []
        )
    };
    const TransactionsStore = {
        loading: false,
        finalizePsbtAndBroadcastChannel: jest.fn().mockResolvedValue(applied),
        finalizePsbtAndBroadcast: jest.fn().mockResolvedValue(true)
    };
    const navigation = { navigate: jest.fn(), popTo: jest.fn() };
    const view = new PSBT({
        navigation,
        ChannelsStore,
        NodeInfoStore: {},
        TransactionsStore,
        route: { params: { psbt } }
    } as unknown as React.ComponentProps<typeof PSBT>);
    const pressFinalize = async () => {
        const buttons = findAll(
            view.render(),
            (node) =>
                node.type === 'Button' &&
                node.props.title === 'views.PSBT.finalizePsbtAndBroadcast'
        );
        expect(buttons).toHaveLength(1);
        buttons[0].props.onPress();
        await flushPromises();
    };
    return { TransactionsStore, navigation, pressFinalize };
};

describe('PSBT finalize and broadcast', () => {
    it('hands the PSBT of a pending channel to the funding flow', async () => {
        const { TransactionsStore, navigation, pressFinalize } =
            makeView(FUNDING_PSBT);

        await pressFinalize();

        expect(
            TransactionsStore.finalizePsbtAndBroadcastChannel
        ).toHaveBeenCalledTimes(1);
        expect(
            TransactionsStore.finalizePsbtAndBroadcastChannel
        ).toHaveBeenCalledWith(FUNDING_PSBT, ['chan-1']);
        expect(
            TransactionsStore.finalizePsbtAndBroadcast
        ).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });

    it('stays on the screen when the funding result was dropped as superseded', async () => {
        const { TransactionsStore, navigation, pressFinalize } = makeView(
            FUNDING_PSBT,
            false
        );

        await pressFinalize();

        expect(
            TransactionsStore.finalizePsbtAndBroadcastChannel
        ).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('broadcasts a PSBT that funds no pending channel itself', async () => {
        const { TransactionsStore, navigation, pressFinalize } =
            makeView(OTHER_PSBT);

        await pressFinalize();

        expect(
            TransactionsStore.finalizePsbtAndBroadcast
        ).toHaveBeenCalledTimes(1);
        expect(TransactionsStore.finalizePsbtAndBroadcast).toHaveBeenCalledWith(
            OTHER_PSBT
        );
        expect(
            TransactionsStore.finalizePsbtAndBroadcastChannel
        ).not.toHaveBeenCalled();
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledWith('SendingOnChain');
    });
});
