jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ Badge: 'Badge' }));
jest.mock('react-native-safe-area-context', () => ({
    initialWindowMetrics: null
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
    getString: jest.fn()
}));
jest.mock('../utils/handleAnything', () => ({
    __esModule: true,
    default: jest.fn(),
    isClipboardValue: jest.fn()
}));
jest.mock('../utils/BackendUtils', () => ({
    supportsLightningAddress: () => false,
    supportsLightningSends: () => true
}));
jest.mock('../utils/PhotoUtils', () => ({ getPhoto: jest.fn() }));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/NavigationUtils', () => ({
    protectedNavigation: jest.fn()
}));
jest.mock('../utils/PrivacyUtils', () => ({
    sensitiveValue: ({ input }: any) => input
}));
jest.mock('../utils/ThemeUtils', () => ({
    themeColor: () => '#000000'
}));
jest.mock('../stores/ChannelsStore', () => ({ ChannelsView: {} }));
jest.mock('../stores/SettingsStore', () => ({ PosEnabled: {} }));
// Renders the side slots, where the clipboard badge lives
jest.mock('./Header', () => {
    const { View } = require('react-native');
    return ({ leftComponent, centerComponent, rightComponent }: any) => (
        <View>
            {leftComponent}
            {centerComponent}
            {rightComponent}
        </View>
    );
});
// SVGs are not transformed under jest, so each renders as a named host
jest.mock('../assets/images/SVG/Clipboard.svg', () => 'ClipboardIcon');
jest.mock('../assets/images/SVG/Add.svg', () => 'AddIcon');
jest.mock('../assets/images/SVG/Alert.svg', () => 'AlertIcon');
jest.mock('../assets/images/SVG/Caret Up.svg', () => 'CaretUpIcon');
jest.mock('../assets/images/SVG/nwc-logo.svg', () => 'NWCLogoIcon');
jest.mock('../assets/images/SVG/Ecash.svg', () => 'EcashIcon');
jest.mock('../assets/images/SVG/Menu.svg', () => 'MenuIcon');
jest.mock('../assets/images/SVG/Hourglass.svg', () => 'HourglassIcon');
jest.mock('../assets/images/SVG/POS.svg', () => 'POSIcon');
jest.mock('../assets/images/SVG/Search.svg', () => 'SearchIcon');
jest.mock('../assets/images/SVG/Temple.svg', () => 'TempleIcon');
jest.mock('../assets/images/SVG/Sync.svg', () => 'SyncIcon');
jest.mock('../assets/images/SVG/zeus-pay.svg', () => 'ZeusPaySVGIcon');
jest.mock('../components/LoadingIndicator', () => 'LoadingIndicator');
jest.mock('../components/NodeIdenticon', () => 'NodeIdenticon');
jest.mock('./ToggleButton', () => 'ToggleButton');

import * as React from 'react';
import { AppState } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import WalletHeader, { networkBadgeLabel } from './WalletHeader';
import handleAnything, { isClipboardValue } from '../utils/handleAnything';
import { protectedNavigation } from '../utils/NavigationUtils';

const INVOICE = 'lnbcrt1pexample';

const renderHeader = async ({
    clipboard,
    connecting,
    settingsLoaded = true,
    sessionStarted = true,
    nodeInfo = {},
    settings = {}
}: {
    clipboard: boolean;
    connecting?: boolean;
    settingsLoaded?: boolean;
    sessionStarted?: boolean;
    nodeInfo?: any;
    settings?: any;
}) => {
    const setPosStatus = jest.fn();
    const listeners: { [event: string]: () => void } = {};
    const navigation = {
        addListener: jest.fn((event: string, listener: () => void) => {
            listeners[event] = listener;
            return jest.fn();
        }),
        navigate: jest.fn()
    };
    const result = await render(
        <WalletHeader
            {...({
                navigation,
                connecting,
                SettingsStore: {
                    settings: { privacy: { clipboard }, ...settings },
                    settingsLoaded,
                    sessionStarted: () => sessionStarted,
                    setPosStatus
                },
                CashuStore: { sentTokens: [] },
                ChannelsStore: { pendingHTLCs: [] },
                NostrWalletConnectStore: { loading: false },
                LightningAddressStore: { paid: [] },
                SyncStore: { isSyncing: false },
                PosStore: { getOrders: jest.fn() },
                NodeInfoStore: { nodeInfo },
                ModalStore: {},
                AlertStore: {},
                ConnectivityStore: { isOffline: false }
            } as any)}
        />
    );
    return { navigation, listeners, setPosStatus, ...result };
};

const clipboardBadge = () =>
    screen.container.queryAll((n) => n.type === 'ClipboardIcon')[0];

describe('WalletHeader clipboard badge', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Clipboard.getString as jest.Mock).mockResolvedValue(INVOICE);
        (isClipboardValue as jest.Mock).mockResolvedValue(true);
    });

    it('does not read the clipboard while connecting', async () => {
        // on cold start the connecting header mounts while settings still
        // hold the in-memory defaults (clipboard: true)
        await renderHeader({ clipboard: true, connecting: true });

        expect(Clipboard.getString).not.toHaveBeenCalled();
        expect(clipboardBadge()).toBeUndefined();
    });

    it('does not read the clipboard before settings load', async () => {
        // getSettings failed: the wallet opens (connecting false) with the
        // in-memory defaults, which say clipboard: true
        await renderHeader({ clipboard: true, settingsLoaded: false });

        expect(Clipboard.getString).not.toHaveBeenCalled();
        expect(clipboardBadge()).toBeUndefined();
    });

    it('reads the clipboard on mount once connected with clipboard reading on', async () => {
        await renderHeader({ clipboard: true });

        expect(Clipboard.getString).toHaveBeenCalledTimes(1);
        expect(clipboardBadge()).toBeDefined();
    });

    it('does not read the clipboard with clipboard reading off', async () => {
        await renderHeader({ clipboard: false });

        expect(Clipboard.getString).not.toHaveBeenCalled();
        expect(clipboardBadge()).toBeUndefined();
    });

    it('ignores clipboard text that is not a payable value', async () => {
        (isClipboardValue as jest.Mock).mockResolvedValue(false);
        await renderHeader({ clipboard: true });

        expect(Clipboard.getString).toHaveBeenCalledTimes(1);
        expect(clipboardBadge()).toBeUndefined();
    });

    it('opens the copied value when the badge is pressed', async () => {
        (handleAnything as unknown as jest.Mock).mockResolvedValue([
            'PaymentRequest',
            { invoice: INVOICE }
        ]);
        const { navigation } = await renderHeader({ clipboard: true });

        await fireEvent.press(clipboardBadge());

        expect(handleAnything).toHaveBeenCalledWith(INVOICE);
        expect(navigation.navigate).toHaveBeenCalledWith('PaymentRequest', {
            invoice: INVOICE
        });
    });

    it('reads the clipboard again when the screen regains focus', async () => {
        (Clipboard.getString as jest.Mock).mockResolvedValueOnce('');
        const { listeners } = await renderHeader({ clipboard: true });
        expect(clipboardBadge()).toBeUndefined();

        await act(async () => listeners.focus());

        expect(Clipboard.getString).toHaveBeenCalledTimes(2);
        expect(clipboardBadge()).toBeDefined();
    });

    it('reads the clipboard again when the app comes back to the foreground', async () => {
        let onChange!: (state: string) => void;
        jest.spyOn(AppState, 'addEventListener').mockImplementation(
            (_event: any, listener: any) => {
                onChange = listener;
                return { remove: jest.fn() } as any;
            }
        );
        await renderHeader({ clipboard: true });

        await act(async () => onChange('background'));
        expect(Clipboard.getString).toHaveBeenCalledTimes(1);
        await act(async () => onChange('active'));
        expect(Clipboard.getString).toHaveBeenCalledTimes(2);
    });
});

describe('WalletHeader before the session starts', () => {
    const menuIcon = () =>
        screen.container.queryAll((n) => n.type === 'MenuIcon')[0];
    const nodeIdenticon = () =>
        screen.container.queryAll((n) => n.type === 'NodeIdenticon')[0];

    beforeEach(() => {
        jest.clearAllMocks();
        (Clipboard.getString as jest.Mock).mockResolvedValue('');
    });

    const header = () =>
        screen.getByTestId('wallet-header', { includeHiddenElements: true });

    it('takes no touches on the cold start header', async () => {
        // the stored PIN and POS mode have not been acted on yet
        await renderHeader({
            clipboard: false,
            connecting: true,
            settingsLoaded: false,
            sessionStarted: false
        });

        expect(header().props.pointerEvents).toBe('none');

        await fireEvent.press(menuIcon());

        expect(protectedNavigation).not.toHaveBeenCalled();
    });

    it('takes no touches once settings load but before POS mode or login', async () => {
        await renderHeader({
            clipboard: false,
            connecting: true,
            sessionStarted: false
        });

        expect(header().props.pointerEvents).toBe('none');
    });

    it('hides its controls from screen readers before the session starts', async () => {
        // a screen reader's activation calls onPress without a hit test, so
        // pointerEvents alone would leave the controls usable
        await renderHeader({
            clipboard: false,
            connecting: true,
            sessionStarted: false
        });

        expect(header().props.accessibilityElementsHidden).toBe(true);
        expect(header().props.importantForAccessibility).toBe(
            'no-hide-descendants'
        );
    });

    // A bare header before the session started made the cold start render
    // light enough that Fabric dropped a screen from the root stack on
    // Android release builds, and the Lockscreen's pop after login crashed
    it('still draws the menu button and wallet picture before the session starts', async () => {
        await renderHeader({
            clipboard: false,
            connecting: true,
            settingsLoaded: false,
            sessionStarted: false
        });

        expect(menuIcon()).toBeDefined();
        expect(nodeIdenticon()).toBeDefined();
    });

    // A screen reader or a hardware keyboard activates a control with a
    // click that Pressability turns into onPress without a hit test, so
    // pointerEvents on the wrapper does not stop it
    const click = (node: any) => {
        let n = node;
        while (n && !n.props.onClick) n = n.parent;
        return act(async () => n.props.onClick({ nativeEvent: {} }));
    };
    const posIcon = () =>
        screen.container.queryAll((n) => n.type === 'POSIcon')[0];
    const nickname = () =>
        screen.getByText('My Node', { includeHiddenElements: true });
    const posSettings = { pos: { posEnabled: 'standalone' } };
    const nicknameSettings = {
        display: { displayNickname: true },
        nodes: [{ nickname: 'My Node' }],
        selectedNode: 0
    };

    it('does not switch to POS mode before the session starts', async () => {
        const { setPosStatus } = await renderHeader({
            clipboard: false,
            sessionStarted: false,
            settings: posSettings
        });

        await fireEvent.press(posIcon());
        await click(posIcon());

        expect(setPosStatus).not.toHaveBeenCalled();
    });

    it('switches to POS mode from the badge once the session has started', async () => {
        const { setPosStatus } = await renderHeader({
            clipboard: false,
            settings: posSettings
        });

        await click(posIcon());

        expect(setPosStatus).toHaveBeenCalledWith('active');
    });

    it('does not open the wallet list from the nickname before the session starts', async () => {
        const { navigation } = await renderHeader({
            clipboard: false,
            sessionStarted: false,
            settings: nicknameSettings
        });

        await fireEvent.press(nickname());

        expect(navigation.navigate).not.toHaveBeenCalled();
        // Text hands disabled to Pressability, which then ignores clicks
        expect(nickname().props.disabled).toBe(true);
    });

    it('opens the wallet list from the nickname once the session has started', async () => {
        const { navigation } = await renderHeader({
            clipboard: false,
            settings: nicknameSettings
        });

        expect(nickname().props.disabled).toBe(false);

        await fireEvent.press(nickname());

        expect(navigation.navigate).toHaveBeenCalledWith('Wallets');
    });

    it('draws the menu button and wallet picture once the session has started', async () => {
        await renderHeader({ clipboard: false, connecting: true });

        expect(header().props.pointerEvents).toBe('auto');
        expect(header().props.accessibilityElementsHidden).toBe(false);
        expect(header().props.importantForAccessibility).toBe('auto');
        expect(menuIcon()).toBeDefined();
        expect(nodeIdenticon()).toBeDefined();

        await fireEvent.press(menuIcon());

        expect(protectedNavigation).toHaveBeenCalledWith(
            expect.anything(),
            'Menu',
            undefined,
            { animation: 'fade' }
        );
    });
});

describe('networkBadgeLabel', () => {
    it('labels each test network', () => {
        expect(networkBadgeLabel({ isTestNet: true })).toEqual(
            'views.Wallet.MainPane.testnet'
        );
        expect(
            networkBadgeLabel({ isTestNet: true, isTestNet4: true })
        ).toEqual('network.testnet4');
        expect(networkBadgeLabel({ isRegTest: true })).toEqual(
            'views.Wallet.MainPane.regnet'
        );
        expect(networkBadgeLabel({ isSigNet: true })).toEqual(
            'views.Wallet.MainPane.signet'
        );
        expect(
            networkBadgeLabel({ isSigNet: true, isMutinynet: true })
        ).toEqual('network.mutinynet');
    });

    it('shows no badge on mainnet or before node info loads', () => {
        expect(
            networkBadgeLabel({
                isTestNet: false,
                isTestNet4: false,
                isRegTest: false,
                isSigNet: false,
                isMutinynet: false
            })
        ).toBeUndefined();
        expect(networkBadgeLabel({})).toBeUndefined();
    });
});

describe('WalletHeader network badge', () => {
    const badges = () =>
        screen.container
            .queryAll((n) => n.type === 'Badge')
            .map((n) => n.props.value);

    it('shows Testnet4 for a testnet4 node', async () => {
        await renderHeader({
            clipboard: false,
            nodeInfo: { isTestNet: true, isTestNet4: true }
        });

        expect(badges()).toContain('network.testnet4');
    });

    it('shows no network badge on mainnet', async () => {
        await renderHeader({ clipboard: false, nodeInfo: {} });

        expect(badges()).toEqual([]);
    });
});
