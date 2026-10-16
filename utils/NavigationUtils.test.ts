jest.mock('../stores/Stores', () => ({
    settingsStore: {
        posStatus: 'inactive',
        settings: {},
        setPosStatus: jest.fn(),
        loginMethodConfigured: jest.fn(),
        sessionStarted: jest.fn()
    }
}));

import { settingsStore } from '../stores/Stores';
import {
    POS_ROUTES,
    posRouteGuard,
    protectedNavigation,
    reAuthNavigation
} from './NavigationUtils';

const mockSettingsStore = settingsStore as any;

describe('NavigationUtils', () => {
    let navigation: any;

    beforeEach(() => {
        jest.clearAllMocks();
        navigation = { navigate: jest.fn() };
        mockSettingsStore.posStatus = 'inactive';
        mockSettingsStore.settings = {};
        mockSettingsStore.sessionStarted.mockReturnValue(true);
    });

    describe('reAuthNavigation', () => {
        it('routes via Lockscreen when a login method is configured', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);

            reAuthNavigation(navigation, 'Seed');

            expect(navigation.navigate).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Seed', params: undefined }
            });
        });

        it('passes route params through the Lockscreen pendingNavigation', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);
            const params = {
                walletSeedPhrase: ['abandon', 'ability', 'able'],
                implementation: 'ldk-node',
                isTestNet: true
            };

            reAuthNavigation(navigation, 'Seed', params);

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Seed', params }
            });
        });

        it('navigates directly when no login method is configured', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(false);
            const params = { skipWarning: true };

            reAuthNavigation(navigation, 'Seed', params);

            expect(navigation.navigate).toHaveBeenCalledTimes(1);
            expect(navigation.navigate).toHaveBeenCalledWith('Seed', params);
        });

        it('does not consult POS status', () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);

            reAuthNavigation(navigation, 'Seed');

            expect(navigation.navigate).toHaveBeenCalledWith(
                'Lockscreen',
                expect.anything()
            );
        });
    });

    describe('protectedNavigation', () => {
        it('routes via Lockscreen when POS is active and a pin is set', async () => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.settings = { pin: '1234' };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Lockscreen', {
                pendingNavigation: { screen: 'Menu', params: undefined }
            });
        });

        it('navigates directly when POS is inactive', async () => {
            mockSettingsStore.posStatus = 'inactive';
            mockSettingsStore.settings = { pin: '1234' };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).toHaveBeenCalledWith('Menu', undefined);
        });

        it('does nothing before the session has started', async () => {
            // cold start: settings still hold the in-memory defaults (no PIN,
            // POS disabled) and posStatus is 'unselected'
            mockSettingsStore.sessionStarted.mockReturnValue(false);
            mockSettingsStore.posStatus = 'unselected';

            await protectedNavigation(navigation, 'Menu');
            await protectedNavigation(navigation, 'Wallets');

            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('does nothing on a till whose settings loaded before POS mode started', async () => {
            mockSettingsStore.sessionStarted.mockReturnValue(false);
            mockSettingsStore.posStatus = 'unselected';
            mockSettingsStore.settings = { pin: '1234' };

            await protectedNavigation(navigation, 'Menu');

            expect(navigation.navigate).not.toHaveBeenCalled();
        });

        it('deactivates POS when requested on ungated navigation', async () => {
            mockSettingsStore.posStatus = 'inactive';
            mockSettingsStore.settings = {};

            await protectedNavigation(navigation, 'Wallet', true);

            expect(mockSettingsStore.setPosStatus).toHaveBeenCalledWith(
                'inactive'
            );
            expect(navigation.navigate).toHaveBeenCalledWith(
                'Wallet',
                undefined
            );
        });
    });

    describe('posRouteGuard', () => {
        // Stand-in for the stack router: navigate pushes (or updates the
        // params of the focused route of the same name), pop removes the
        // focused route
        let keyCount = 0;
        const original: any = {
            getStateForAction: jest.fn((state: any, action: any) => {
                if (action.type === 'NAVIGATE') {
                    const { name, params } = action.payload;
                    const top = state.routes[state.index];
                    if (top.name === name) {
                        const routes = [...state.routes];
                        routes[state.index] = { ...top, params };
                        return { ...state, routes };
                    }
                    const routes = [
                        ...state.routes,
                        { key: `${name}-${++keyCount}`, name, params }
                    ];
                    return { ...state, routes, index: routes.length - 1 };
                }
                if (action.type === 'POP') {
                    if (state.routes.length < 2) return null;
                    const routes = state.routes.slice(0, -1);
                    return { ...state, routes, index: routes.length - 1 };
                }
                return null;
            })
        };
        const router = posRouteGuard(original);
        const options: any = {};

        const stackOf = (...names: string[]): any => ({
            key: 'stack',
            index: names.length - 1,
            routeNames: [],
            routes: names.map((name) => ({ key: `${name}-0`, name })),
            stale: false,
            type: 'stack',
            preloadedRoutes: []
        });
        const navigate = (name: string, params?: any): any => ({
            type: 'NAVIGATE',
            payload: { name, params }
        });
        const top = (state: any) => state.routes[state.index];

        beforeEach(() => {
            mockSettingsStore.posStatus = 'active';
            mockSettingsStore.loginMethodConfigured.mockReturnValue(true);
        });

        it.each([
            ['Invoice', { invoice: { r_hash: 'aa' } }],
            ['Transaction', { transaction: { tx: 'bb' } }],
            ['Wallets', undefined],
            ['WalletConfiguration', { index: 0 }],
            ['LightningAddress', { skipStatus: true }],
            ['Mints', undefined],
            ['Swaps', { initialReverse: true }],
            ['LnurlPay', { lnurlParams: { tag: 'payRequest' } }]
        ])(
            'opens the Lockscreen instead of %s during a POS session with a PIN',
            (name, params) => {
                const state = stackOf('Wallet', 'Activity');

                const next: any = router.getStateForAction!(
                    state,
                    navigate(name, params),
                    options
                );

                expect(next.routes.map((r: any) => r.name)).toEqual([
                    'Wallet',
                    'Activity',
                    'Lockscreen'
                ]);
                expect(top(next).params).toEqual({
                    pendingNavigation: { screen: name, params }
                });
            }
        );

        it.each(POS_ROUTES.filter((name) => name !== 'Wallet'))(
            'lets a POS session open %s',
            (name) => {
                const state = stackOf('Wallet');

                const next: any = router.getStateForAction!(
                    state,
                    navigate(name, { amount: '10' }),
                    options
                );

                expect(top(next).name).toBe(name);
                expect(top(next).params).toEqual({ amount: '10' });
            }
        );

        it('lets a POS session go back to the POS view', () => {
            const state = stackOf('Wallet', 'Receive');

            const next: any = router.getStateForAction!(
                state,
                { type: 'POP' } as any,
                options
            );

            expect(next.routes.map((r: any) => r.name)).toEqual(['Wallet']);
        });

        it('only updates the pending screen when the Lockscreen is already in front', () => {
            const state = stackOf('Wallet', 'Lockscreen');

            const next: any = router.getStateForAction!(
                state,
                navigate('Menu'),
                options
            );

            expect(next.routes.map((r: any) => r.name)).toEqual([
                'Wallet',
                'Lockscreen'
            ]);
            expect(top(next).params).toEqual({
                pendingNavigation: { screen: 'Menu', params: undefined }
            });
        });

        it('leaves navigation alone when POS is not active', () => {
            mockSettingsStore.posStatus = 'inactive';
            const state = stackOf('Wallet', 'Activity');

            const next: any = router.getStateForAction!(
                state,
                navigate('Invoice'),
                options
            );

            expect(top(next).name).toBe('Invoice');
        });

        it('leaves navigation alone in POS mode without a login method', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(false);
            const state = stackOf('Wallet', 'Activity');

            const next: any = router.getStateForAction!(
                state,
                navigate('Invoice'),
                options
            );

            expect(top(next).name).toBe('Invoice');
        });

        it('passes on actions the stack does not handle', () => {
            const state = stackOf('Wallet');

            expect(
                router.getStateForAction!(
                    state,
                    { type: 'POP' } as any,
                    options
                )
            ).toBeNull();
        });
    });
});
