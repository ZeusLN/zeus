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

const INVOICE = 'lnbcrt1pexample';

const renderHeader = async ({
    clipboard,
    connecting,
    settingsLoaded = true,
    nodeInfo = {}
}: {
    clipboard: boolean;
    connecting?: boolean;
    settingsLoaded?: boolean;
    nodeInfo?: any;
}) => {
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
                    settings: { privacy: { clipboard } },
                    settingsLoaded
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
    return { navigation, listeners, ...result };
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
