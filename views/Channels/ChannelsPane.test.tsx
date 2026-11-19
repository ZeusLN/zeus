import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { observable, runInAction } from 'mobx';

// mobx-react's main entry needs react-dom, so this stands in for its
// observer: it tracks the observables render() reads and re-renders when one
// changes. Reads made later by FlatList rows are not tracked, as in the app.
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (Component: any) => {
        const { Reaction } = require('mobx');
        return class extends Component {
            reaction = new Reaction('observer', () => this.forceUpdate());
            componentWillUnmount() {
                this.reaction.dispose();
                super.componentWillUnmount?.();
            }
            render() {
                let rendered;
                this.reaction.track(() => {
                    rendered = super.render();
                });
                return rendered;
            }
        };
    }
}));
jest.mock('../../stores/Stores', () => ({
    settingsStore: { settings: {} },
    fiatStore: {}
}));
jest.mock('../../stores/ChannelsStore', () => ({
    __esModule: true,
    default: class {},
    ChannelsType: { Open: 0, Pending: 1, Closed: 2 },
    ChannelsView: { Channels: 'channels', Peers: 'peers' }
}));
jest.mock('../../utils/LocaleUtils');
jest.mock('../../utils/ThemeUtils', () => ({
    themeColor: (key: string) => `theme:${key}`
}));
jest.mock('../../utils/BackendUtils', () => ({
    supportsPendingChannels: jest.fn(() => true),
    supportsClosedChannels: jest.fn(() => true)
}));
jest.mock('../../utils/handleAnything', () => jest.fn());
jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children
}));
jest.mock('../../components/WalletHeader', () => () => null);
jest.mock('../../components/Channels/ChannelsHeader', () => ({
    ChannelsHeader: () => null
}));
jest.mock('../../components/Channels/ChannelsFilter', () => () => null);
jest.mock('../../components/Channels/PeerItem', () => ({
    PeerItem: () => null
}));
jest.mock('../../components/LoadingIndicator', () => () => null);
jest.mock('../../components/ModalBox', () => () => null);
jest.mock('../../components/SuccessErrorMessage', () => ({
    ErrorMessage: () => null
}));
jest.mock('../../components/layout/Spacer', () => ({ Spacer: () => null }));

// Counts row mounts so a test can tell a redraw from a remount
const mockRowMounts = { count: 0 };
jest.mock('../../components/Channels/ChannelItem', () => {
    const { Text } = require('react-native');
    const { useEffect } = require('react');
    return {
        ChannelItem: ({ title, expirationStatus, statusSuffix }: any) => {
            useEffect(() => {
                mockRowMounts.count++;
            }, []);
            return (
                <>
                    <Text>{`${title}: ${expirationStatus ?? 'none'}`}</Text>
                    {statusSuffix && (
                        <Text>{`${title} status: ${statusSuffix}`}</Text>
                    )}
                </>
            );
        }
    };
});

// react-navigation renders a `component` prop as an element, so a new
// component type remounts the screen, and calls a render callback passed as
// children. The mock does the same and shows only the initial route.
jest.mock('@react-navigation/native', () => ({
    DefaultTheme: { colors: {} },
    NavigationContainer: ({ children }: any) => children,
    NavigationIndependentTree: ({ children }: any) => children
}));
jest.mock('@react-navigation/bottom-tabs', () => {
    const { createElement } = require('react');
    return {
        createBottomTabNavigator: () => ({
            Navigator: ({ children, initialRouteName }: any) => {
                const screens = [].concat(children).filter(Boolean);
                const screen: any =
                    screens.find(
                        (s: any) => s.props.name === initialRouteName
                    ) || screens[0];
                const { component, children: renderScreen } = screen.props;
                return component ? createElement(component) : renderScreen();
            },
            Screen: () => null
        })
    };
});

import BackendUtils from '../../utils/BackendUtils';
import Channel from '../../models/Channel';
import ChannelsPane from './ChannelsPane';

const LSP_SCID = '800000x1x0';

const channel = {
    remote_pubkey: 'lsp-pubkey',
    remotePubkey: 'lsp-pubkey',
    displayName: 'lsp',
    shortChannelId: LSP_SCID,
    isActive: true,
    pending_htlcs: [],
    localBalance: '0',
    remoteBalance: '1000000',
    receivingCapacity: '980000',
    sendingCapacity: '0',
    isBelowReserve: false
};

const lease = (expirationBlock: number) => ({
    short_channel_id: LSP_SCID,
    max_channel_extension_expiry_blocks: 26280,
    expiration_block: expirationBlock
});

const makeStores = (height: number, leases: any[]) => ({
    ChannelsStore: {
        loading: false,
        getChannels: jest.fn(),
        getPeers: jest.fn(),
        resetOpenChannel: jest.fn(),
        channelSuccess: true,
        setChannelsType: jest.fn(),
        channelsType: 0,
        channelsView: 'channels',
        filteredChannels: [channel],
        filteredPendingChannels: [],
        filteredClosedChannels: [],
        filteredPeers: [],
        peers: [],
        nodes: {},
        aliasesByPubkey: {},
        largestChannelSats: 1000000
    } as any,
    LSPStore: observable({ getExtendableChannelsData: leases }) as any,
    NodeInfoStore: observable({
        nodeInfo: { currentBlockHeight: height }
    }) as any
});

const update = (fn: () => void) => act(async () => runInAction(fn));

const renderPane = (stores: any) =>
    render(<ChannelsPane navigation={{} as any} {...stores} />);

const badge = () => screen.getByText(/^lsp: /).props.children;

describe.each([
    ['tab navigator', true],
    ['plain list', false]
])('ChannelsPane lease badge (%s)', (_, tabs) => {
    beforeEach(() => {
        mockRowMounts.count = 0;
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(tabs);
        jest.mocked(BackendUtils.supportsClosedChannels).mockReturnValue(tabs);
    });

    it('updates when new lease data arrives', async () => {
        const stores = makeStores(850000, [lease(849990)]);
        await renderPane(stores);
        expect(badge()).toBe('lsp: channel.expirationStatus.expired');

        // a new answer replaces the observable array
        await update(() => {
            stores.LSPStore.getExtendableChannelsData = [lease(851000)];
        });

        expect(badge()).toBe('lsp: channel.expirationStatus.expiring');
    });

    it('updates when the block height changes', async () => {
        const stores = makeStores(849000, [lease(851500)]);
        await renderPane(stores);
        expect(badge()).toBe('lsp: none');

        await update(() => {
            stores.NodeInfoStore.nodeInfo.currentBlockHeight = 850000;
        });

        expect(badge()).toBe('lsp: channel.expirationStatus.expiring');
    });

    it('redraws the rows without remounting the list', async () => {
        const stores = makeStores(850000, [lease(849990)]);
        await renderPane(stores);
        expect(mockRowMounts.count).toBe(1);

        await update(() => {
            stores.LSPStore.getExtendableChannelsData = [lease(851000)];
        });
        await update(() => {
            stores.NodeInfoStore.nodeInfo.currentBlockHeight = 850001;
        });

        expect(badge()).toBe('lsp: channel.expirationStatus.expiring');
        expect(mockRowMounts.count).toBe(1);
    });
});

describe('ChannelsPane pending channel status', () => {
    beforeEach(() => {
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(true);
        jest.mocked(BackendUtils.supportsClosedChannels).mockReturnValue(true);
    });

    // A pending LDK Node channel, as ChannelsStore builds it
    const ldkPendingOpen = (confirmations: number) =>
        new Channel({
            remote_pubkey: 'ldk-peer',
            displayName: 'ldk',
            pendingOpen: true,
            pending_htlcs: [],
            confirmations,
            confirmations_required: 6
        });

    const renderPending = (channel: Channel) => {
        const stores = makeStores(850000, []);
        stores.ChannelsStore.channelsType = 1;
        stores.ChannelsStore.filteredPendingChannels = [channel];
        return renderPane(stores);
    };

    it('shows the confirmation count below the required depth', async () => {
        await renderPending(ldkPendingOpen(3));

        expect(screen.getByText('ldk status: (3/6)')).toBeOnTheScreen();
    });

    it('says the channel waits for the peer at the required depth', async () => {
        await renderPending(ldkPendingOpen(6));

        expect(
            screen.getByText('ldk status: · views.Channel.waitingForPeer')
        ).toBeOnTheScreen();
    });
});
