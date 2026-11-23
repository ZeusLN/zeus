// Wallet.handleAppStateChange refreshes the Wallet when the app comes back
// from the background. On iOS a system sheet (Face ID, Control Center,
// Notification Center) reports 'inactive' and then 'active' without the app
// leaving the foreground, and a refresh there repeats one that just ran
// (#4791). Runs the production Wallet methods and the real
// WalletRefreshRunner; stores and navigation are controlled.
import type { AppStateStatus } from 'react-native';

import WalletRefreshRunner from '../../utils/WalletRefreshRunner';
import { sourceMethods } from '../../backends/lncTestUtils';

function setup({
    lock = false,
    skipBackgroundLock = false,
    mountedIn = 'active' as AppStateStatus
} = {}) {
    const settings: any = {
        settings: { loginBackground: true },
        connecting: false,
        triggerSettingsRefresh: false,
        loggedIn: true,
        loginMethodConfigured: () => lock,
        loginRequired: () => lock && !settings.loggedIn,
        setLoginStatus: (status: boolean) => {
            settings.loggedIn = status;
        },
        updateSettings: jest.fn(async () => {})
    };
    const AppState = {
        currentState: mountedIn,
        addEventListener: jest.fn(() => ({ remove: jest.fn() }))
    };
    const Wallet = sourceMethods(
        'views/Wallet/Wallet.tsx',
        'Wallet',
        ['componentDidMount', 'handleAppStateChange'],
        {
            AppState,
            BackendUtils: { supportsNostrWalletConnectService: () => true },
            shouldSkipBackgroundLock: () => skipBackgroundLock,
            getSupportedBiometryType: async () => undefined
        }
    );
    const view = new Wallet();
    const state = { focused: true };
    const navigation = {
        navigate: jest.fn(),
        addListener: jest.fn(),
        isFocused: () => state.focused
    };
    const NostrWalletConnectStore = {
        reset: jest.fn(),
        initializeService: jest.fn()
    };
    view.props = {
        SettingsStore: settings,
        NostrWalletConnectStore,
        navigation
    };
    view.getSettingsAndNavigate = jest.fn(async () => {});
    view.handleFocus = jest.fn();
    view.refreshRunner = new WalletRefreshRunner(
        settings,
        navigation.isFocused,
        () => view.getSettingsAndNavigate()
    );
    const appState = (...changes: AppStateStatus[]) =>
        changes.forEach((change) => view.handleAppStateChange(change));
    return {
        view,
        settings,
        state,
        navigation,
        NostrWalletConnectStore,
        AppState,
        appState
    };
}

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('Wallet.handleAppStateChange', () => {
    it('refreshes when the app returns from the background', () => {
        const { view, appState } = setup();

        appState('inactive', 'background', 'active');

        expect(view.getSettingsAndNavigate).toHaveBeenCalledTimes(1);
    });

    it('does not refresh after an iOS system sheet', () => {
        const { view, NostrWalletConnectStore, appState } = setup();

        appState('inactive', 'active');

        expect(view.getSettingsAndNavigate).not.toHaveBeenCalled();
        // 'inactive' reset NWC, so it is still initialized again
        expect(NostrWalletConnectStore.reset).toHaveBeenCalledTimes(1);
        expect(NostrWalletConnectStore.initializeService).toHaveBeenCalledTimes(
            1
        );
    });

    it('refreshes once when a Face ID unlock follows a resume', async () => {
        const { view, settings, navigation, appState } = setup({
            lock: true
        });

        appState('inactive', 'background', 'active');
        expect(settings.loggedIn).toBe(false);
        expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen');
        expect(view.getSettingsAndNavigate).not.toHaveBeenCalled();

        // The Face ID sheet opens over the Lockscreen
        appState('inactive');
        // Face ID matches: the Lockscreen logs in and pops, and the Wallet's
        // focus refresh runs to completion
        settings.setLoginStatus(true);
        await view.refreshRunner.run(() => view.getSettingsAndNavigate());
        // The sheet finishes closing about a second after the match
        appState('active');

        expect(view.getSettingsAndNavigate).toHaveBeenCalledTimes(1);
        expect(navigation.navigate).toHaveBeenCalledTimes(1);
    });

    it('refreshes after a background whose lock was skipped', () => {
        // Android share sheet or file picker with a lock configured
        const { view, settings, appState } = setup({
            lock: true,
            skipBackgroundLock: true
        });

        appState('background', 'active');

        expect(settings.loggedIn).toBe(true);
        expect(view.getSettingsAndNavigate).toHaveBeenCalledTimes(1);
    });

    it('does not refresh while the Wallet is not focused', () => {
        const { view, state, NostrWalletConnectStore, appState } = setup();
        state.focused = false;

        appState('background', 'active');

        expect(view.getSettingsAndNavigate).not.toHaveBeenCalled();
        expect(
            NostrWalletConnectStore.initializeService
        ).not.toHaveBeenCalled();
    });

    it('does not start a second refresh while one is in flight', async () => {
        const { view, appState } = setup();
        let finish: () => void = () => {};
        view.getSettingsAndNavigate.mockImplementationOnce(
            () => new Promise<void>((resolve) => (finish = resolve))
        );
        const running = view.refreshRunner.run(() =>
            view.getSettingsAndNavigate()
        );

        appState('background', 'active');

        expect(view.getSettingsAndNavigate).toHaveBeenCalledTimes(1);
        finish();
        await running;
    });
});

describe('a Wallet mounted while the app is not active', () => {
    it('refreshes on the first active when it mounted in the background', async () => {
        const { view, AppState, appState } = setup({
            mountedIn: 'background'
        });

        await view.componentDidMount();
        expect(AppState.addEventListener).toHaveBeenCalledWith(
            'change',
            view.handleAppStateChange
        );
        appState('active');

        expect(view.getSettingsAndNavigate).toHaveBeenCalledTimes(1);
    });

    it('leaves the first load to the focus handler when it mounted inactive', async () => {
        // A cold start: iOS is 'inactive' until the launch finishes
        const { view, appState } = setup({ mountedIn: 'inactive' });

        await view.componentDidMount();
        expect(view.handleFocus).toHaveBeenCalledTimes(1);
        appState('active');

        expect(view.getSettingsAndNavigate).not.toHaveBeenCalled();
    });
});
