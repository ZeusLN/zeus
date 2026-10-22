jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('react-native-draglist', () => ({
    __esModule: true,
    default: 'DragList'
}));
jest.mock('@rneui/themed', () => ({ Icon: 'Icon', ListItem: 'ListItem' }));
jest.mock('../../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: { node: { setPersistentMode: jest.fn() } }
}));
jest.mock('../../stores/SettingsStore', () => ({ INTERFACE_KEYS: [] }));
jest.mock('../../utils/BackendUtils', () => ({ disconnect: jest.fn() }));
jest.mock('../../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../../utils/SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../utils/ShareIntentProcessor', () => ({
    walletSelectedShareIntent: jest.fn()
}));
jest.mock('../../components/Button', () => 'Button');
jest.mock('../../components/Header', () => 'Header');
jest.mock('../../components/NodeIdenticon', () => ({
    __esModule: true,
    default: 'NodeIdenticon',
    NodeTitle: (node: any) => node.nickname
}));
jest.mock('../../components/Screen', () => 'Screen');
jest.mock('../../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../../assets/images/SVG/Add.svg', () => 'Add');
jest.mock('../../assets/images/SVG/DragDots.svg', () => 'DragDots');

import * as React from 'react';
import Wallets from './Wallets';

const OLD = { nickname: 'Old wallet', ldkMnemonic: 'twelve secret words' };
const HOME = { nickname: 'Home node', macaroonHex: 'aa' };
const WORK = { nickname: 'Work node', macaroonHex: 'bb' };

// The list copied `listed` when it gained focus; `stored` is what the settings
// hold by the time a row is touched
const makeView = (listed: any[], stored: any) => {
    const SettingsStore: any = {
        settings: stored,
        implementation: 'lnd',
        setConnectingStatus: jest.fn(),
        setInitialStart: jest.fn(),
        getSettings: async () => SettingsStore.settings,
        updateSettings: jest.fn(async (update: any) => {
            SettingsStore.settings = {
                ...SettingsStore.settings,
                ...(typeof update === 'function'
                    ? update(SettingsStore.settings)
                    : update)
            };
            return SettingsStore.settings;
        })
    };
    const navigation = { popTo: jest.fn() };
    const view = new Wallets({
        navigation,
        route: { params: {} },
        SettingsStore
    } as unknown as React.ComponentProps<typeof Wallets>);
    view.state = { ...view.state, nodes: listed as never[] };
    // Not mounted, so apply updates synchronously
    view.setState = (update: any) => {
        view.state = { ...view.state, ...update };
    };
    const list = () =>
        React.Children.toArray((view.render() as any).props.children)
            .flatMap((child: any) =>
                React.Children.toArray(child.props?.children)
            )
            .find((child: any) => child.type === 'DragList') as any;
    return {
        view,
        navigation,
        SettingsStore,
        tap: (index: number) =>
            list()
                .props.renderItem({ item: view.state.nodes[index], index })
                .props.onPress(),
        reorder: async (from: number, to: number) => {
            await list().props.onReordered(from, to);
            await new Promise((resolve) => setImmediate(resolve));
        }
    };
};

describe('Wallets', () => {
    describe('list copied before a wallet deletion landed', () => {
        it('does not write the deleted wallet back on selection', async () => {
            const { tap, navigation, SettingsStore } = makeView(
                [OLD, HOME, WORK],
                { nodes: [HOME, WORK], selectedNode: 0 }
            );

            await tap(2);

            expect(SettingsStore.settings).toEqual({
                nodes: [HOME, WORK],
                selectedNode: 1
            });
            expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        });

        it('selects the tapped wallet after the active one was deleted', async () => {
            const { tap, navigation, SettingsStore } = makeView(
                [OLD, HOME, WORK],
                {
                    nodes: [HOME, WORK],
                    selectedNode: 0,
                    justDeletedWallet: true
                }
            );

            await tap(1);

            expect(SettingsStore.settings).toEqual({
                nodes: [HOME, WORK],
                selectedNode: 0,
                justDeletedWallet: false
            });
            expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        });

        it('shows the stored list when the deleted wallet is tapped', async () => {
            const { tap, view, navigation, SettingsStore } = makeView(
                [HOME, OLD, WORK],
                { nodes: [HOME, WORK], selectedNode: 0 }
            );

            await tap(1);

            expect(SettingsStore.settings).toEqual({
                nodes: [HOME, WORK],
                selectedNode: 0
            });
            expect(view.state.nodes).toEqual([HOME, WORK]);
            expect(view.state.isSelecting).toBe(false);
            expect(navigation.popTo).not.toHaveBeenCalled();
        });

        it('does not write the deleted wallet back on reorder', async () => {
            const { reorder, view, SettingsStore } = makeView(
                [OLD, HOME, WORK],
                { nodes: [HOME, WORK], selectedNode: 0 }
            );

            await reorder(2, 0);

            expect(SettingsStore.settings).toEqual({
                nodes: [HOME, WORK],
                selectedNode: 0
            });
            expect(view.state.nodes).toEqual([HOME, WORK]);
        });
    });

    describe('list that is up to date', () => {
        it('selects the tapped wallet', async () => {
            const { tap, navigation, SettingsStore } = makeView([HOME, WORK], {
                nodes: [HOME, WORK],
                selectedNode: 0
            });

            await tap(1);

            expect(SettingsStore.settings).toEqual({
                nodes: [HOME, WORK],
                selectedNode: 1
            });
            expect(navigation.popTo).toHaveBeenCalledWith('Wallet');
        });

        it('selects the tapped one of two identical configs', async () => {
            const { tap, SettingsStore } = makeView([HOME, WORK, WORK], {
                nodes: [HOME, WORK, WORK],
                selectedNode: 0
            });

            await tap(2);

            expect(SettingsStore.settings.selectedNode).toBe(2);
        });

        it('writes the reordered list', async () => {
            const { reorder, SettingsStore } = makeView([HOME, WORK], {
                nodes: [HOME, WORK],
                selectedNode: 0
            });

            await reorder(1, 0);

            expect(SettingsStore.settings).toEqual({
                nodes: [WORK, HOME],
                selectedNode: 1
            });
        });
    });
});
