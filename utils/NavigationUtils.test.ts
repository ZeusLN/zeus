jest.mock('../stores/Stores', () => ({
    settingsStore: {
        posStatus: 'inactive',
        settings: {},
        setPosStatus: jest.fn(),
        loginMethodConfigured: jest.fn(),
        sessionStarted: jest.fn()
    }
}));

import {
    CommonActions,
    StackActions,
    StackRouter
} from '@react-navigation/routers';

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
        // The real stack router, so a change in how it handles navigate,
        // replace, reset or popTo shows up here
        const routeNames = [
            ...POS_ROUTES,
            'Menu',
            'Invoice',
            'Transaction',
            'Wallets',
            'WalletConfiguration',
            'LightningAddress',
            'Mints',
            'Swaps',
            'LnurlPay'
        ];
        const options: any = {
            routeNames,
            routeParamList: {},
            routeGetIdList: {}
        };
        const stack = StackRouter({});
        const router: any = { ...stack, ...posRouteGuard(stack as any) };

        const stackOf = (...routes: Array<string | [string, any]>): any => {
            const initial = stack.getInitialState(options);
            return {
                ...initial,
                routes: routes.map((r, i) => {
                    const [name, params] = typeof r === 'string' ? [r] : r;
                    return { key: `${name}-${i}`, name, params };
                }),
                index: routes.length - 1
            };
        };
        const navigate = (name: string, params?: any) =>
            CommonActions.navigate(name, params);
        const names = (state: any) => state.routes.map((r: any) => r.name);
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

                const next = router.getStateForAction(
                    state,
                    navigate(name, params),
                    options
                );

                expect(names(next)).toEqual([
                    'Wallet',
                    'Activity',
                    'Lockscreen'
                ]);
                expect(top(next).params).toEqual({
                    pendingNavigation: { screen: name, params }
                });
            }
        );

        it.each([
            ['replace', StackActions.replace('Invoice', { a: 1 })],
            ['push', StackActions.push('Invoice', { a: 1 })],
            ['popTo', StackActions.popTo('Invoice', { a: 1 })],
            [
                'reset',
                CommonActions.reset({
                    index: 1,
                    routes: [
                        { name: 'Wallet' },
                        { name: 'Invoice', params: { a: 1 } }
                    ]
                })
            ]
        ])('opens the Lockscreen for %s to a wallet screen', (_, action) => {
            const state = stackOf('Wallet', 'Activity');

            const next = router.getStateForAction(state, action, options);

            expect(names(next)).toEqual(['Wallet', 'Activity', 'Lockscreen']);
            expect(top(next).params).toEqual({
                pendingNavigation: { screen: 'Invoice', params: { a: 1 } }
            });
        });

        it.each(POS_ROUTES.filter((name) => name !== 'Wallet'))(
            'lets a POS session open %s',
            (name) => {
                const state = stackOf('Wallet');

                const next = router.getStateForAction(
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

            const next = router.getStateForAction(
                state,
                StackActions.pop(),
                options
            );

            expect(names(next)).toEqual(['Wallet']);
        });

        it.each([
            ['pop', StackActions.pop()],
            ['goBack', CommonActions.goBack()]
        ])(
            'opens the Lockscreen when %s would show a wallet screen',
            (_, action) => {
                const state = stackOf('Menu', 'Wallet');

                const next = router.getStateForAction(state, action, options);

                expect(names(next)).toEqual(['Menu', 'Wallet', 'Lockscreen']);
                expect(top(next).params).toEqual({
                    pendingNavigation: { screen: 'Menu', params: undefined }
                });
            }
        );

        it('only updates the pending screen when the Lockscreen is already in front', () => {
            const state = stackOf('Wallet', [
                'Lockscreen',
                { pendingNavigation: { screen: 'Invoice' } }
            ]);

            const next = router.getStateForAction(
                state,
                navigate('Menu'),
                options
            );

            expect(names(next)).toEqual(['Wallet', 'Lockscreen']);
            expect(top(next).params).toEqual({
                pendingNavigation: { screen: 'Menu', params: undefined }
            });
        });

        it("keeps the Lockscreen's share intent when another screen is redirected to it", () => {
            const shareIntentData = { qrData: 'lnbc1' };
            const state = stackOf('Wallet', [
                'Lockscreen',
                { shareIntentData }
            ]);

            const next = router.getStateForAction(
                state,
                navigate('LnurlPay', { lnurlParams: { tag: 'payRequest' } }),
                options
            );

            expect(names(next)).toEqual(['Wallet', 'Lockscreen']);
            expect(top(next).params).toEqual({
                shareIntentData,
                pendingNavigation: {
                    screen: 'LnurlPay',
                    params: { lnurlParams: { tag: 'payRequest' } }
                }
            });
        });

        it('opens the pending screen once the Lockscreen has left POS mode', () => {
            mockSettingsStore.posStatus = 'inactive';
            const state = stackOf('Wallet', 'Lockscreen');

            const next = router.getStateForAction(
                state,
                StackActions.popTo('Invoice', { a: 1 }),
                options
            );

            expect(names(next)).toEqual(['Wallet', 'Invoice']);
        });

        it('leaves navigation alone when POS is not active', () => {
            mockSettingsStore.posStatus = 'inactive';
            const state = stackOf('Wallet', 'Activity');

            const next = router.getStateForAction(
                state,
                navigate('Invoice'),
                options
            );

            expect(top(next).name).toBe('Invoice');
        });

        it('leaves navigation alone in POS mode without a login method', () => {
            mockSettingsStore.loginMethodConfigured.mockReturnValue(false);
            const state = stackOf('Wallet', 'Activity');

            const next = router.getStateForAction(
                state,
                navigate('Invoice'),
                options
            );

            expect(top(next).name).toBe('Invoice');
        });

        it('passes on actions the stack does not handle', () => {
            const state = stackOf('Wallet');

            expect(
                router.getStateForAction(state, StackActions.pop(), options)
            ).toBeNull();
        });
    });
});
