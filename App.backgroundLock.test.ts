// The background lock must hold while the Wallet screen, whose AppState
// listener normally applies it, is off the stack. Runs the production
// App.handleAppStateChange; stores and navigation are controlled.
import { sourceMethods } from './backends/lncTestUtils';

function setup({
    stack = ['Wallets'],
    loginMethodConfigured = true,
    loginBackground = true,
    systemDialogUp = false
} = {}) {
    const settingsStore: any = {
        settings: { loginBackground },
        loggedIn: true,
        loginMethodConfigured: () => loginMethodConfigured,
        loginRequired: () => loginMethodConfigured && !settingsStore.loggedIn,
        setLoginStatus: jest.fn(
            (status: boolean) => (settingsStore.loggedIn = status)
        ),
        getSettings: async () => settingsStore.settings
    };
    const shouldSkipBackgroundLock = jest.fn(() => systemDialogUp);
    const App = sourceMethods(
        'App.tsx',
        'App',
        ['walletScreenMounted', 'handleAppStateChange'],
        {
            settingsStore,
            shouldSkipBackgroundLock,
            LinkingUtils: { resetShareIntentFlag: jest.fn() },
            Platform: { OS: 'ios' },
            StealthModeUtils: { isStealthModeActive: async () => false }
        }
    );
    const app = new App();
    app.navigation = {
        navigate: jest.fn(),
        getRootState: () => ({
            routes: stack.map((name) => ({ name, key: name }))
        })
    };
    return { app, settingsStore, shouldSkipBackgroundLock };
}

describe('App background lock', () => {
    describe('without the Wallet screen on the stack', () => {
        it('locks on background and shows the Lockscreen on return', async () => {
            const { app, settingsStore } = setup();

            await app.handleAppStateChange('background');
            expect(settingsStore.loggedIn).toBe(false);

            await app.handleAppStateChange('active');
            expect(app.navigation.navigate).toHaveBeenCalledWith('Lockscreen');
        });

        it('locks before the stealth mode sync is awaited', () => {
            const { app, settingsStore } = setup();

            app.handleAppStateChange('background');
            expect(settingsStore.loggedIn).toBe(false);
        });

        it('locks when the navigator is not ready', async () => {
            const { app, settingsStore } = setup();
            app.navigation = null;

            await app.handleAppStateChange('background');
            expect(settingsStore.loggedIn).toBe(false);
        });

        it.each([
            ['loginBackground is off', { loginBackground: false }],
            ['no login method is configured', { loginMethodConfigured: false }],
            ['a system dialog is up', { systemDialogUp: true }]
        ])('stays unlocked when %s', async (_case, options) => {
            const { app, settingsStore } = setup(options);

            await app.handleAppStateChange('background');
            expect(settingsStore.loggedIn).toBe(true);

            await app.handleAppStateChange('active');
            expect(app.navigation.navigate).not.toHaveBeenCalled();
        });
    });

    describe('with the Wallet screen on the stack', () => {
        // Wallet's own listener locks and shows the Lockscreen
        it('leaves the lock to Wallet', async () => {
            const { app, settingsStore, shouldSkipBackgroundLock } = setup({
                stack: ['Wallet', 'Wallets']
            });

            await app.handleAppStateChange('background');
            expect(settingsStore.setLoginStatus).not.toHaveBeenCalled();
            expect(shouldSkipBackgroundLock).not.toHaveBeenCalled();

            settingsStore.loggedIn = false;
            await app.handleAppStateChange('active');
            expect(app.navigation.navigate).not.toHaveBeenCalled();
        });
    });
});
