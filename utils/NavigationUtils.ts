import type {
    NavigationAction,
    ParamListBase,
    Router,
    StackNavigationState
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { settingsStore } from '../stores/Stores';

// Screens that an active POS session can open without the PIN. Their own
// links to other screens go through posRouteGuard like every other
// navigation. ShareIntentProcessing checks the login itself and hands its
// payload to the Lockscreen.
const POS_ROUTES = [
    'Wallet',
    'Lockscreen',
    'ShareIntentProcessing',
    'Order',
    'Receive',
    'ReceiveEcash',
    'Activity',
    'ActivityFilter',
    'AmountKeypad',
    'LspExplanationOverview',
    'LspExplanationFees',
    'LspExplanationRouting',
    'LspExplanationWrappedInvoices'
];

// Router override for the root stack (UNSTABLE_router in App.tsx). While a
// POS session is active on a wallet with a login method, any action that
// would put a screen outside POS_ROUTES in front opens the Lockscreen
// instead, with that screen as its pendingNavigation. This covers every
// caller (screens, header controls, alerts, NavigationService), so a link
// added later to a screen staff can reach does not need its own check.
const posRouteGuard = <Action extends NavigationAction>(
    original: Router<StackNavigationState<ParamListBase>, Action>
): Partial<Router<StackNavigationState<ParamListBase>, Action>> => ({
    getStateForAction(state, action, options) {
        const next = original.getStateForAction(state, action, options);

        if (
            !next ||
            next === state ||
            settingsStore.posStatus !== 'active' ||
            !settingsStore.loginMethodConfigured()
        ) {
            return next;
        }

        const top = next.routes[next.index ?? next.routes.length - 1];
        const current = state.routes[state.index];
        if (
            !top ||
            POS_ROUTES.includes(top.name) ||
            (top.key && top.key === current?.key)
        ) {
            return next;
        }

        return original.getStateForAction(
            state,
            {
                type: 'NAVIGATE',
                payload: {
                    name: 'Lockscreen',
                    params: {
                        pendingNavigation: {
                            screen: top.name,
                            params: top.params
                        }
                    }
                }
            } as Action,
            options
        );
    }
});

const protectedNavigation = async (
    navigation: NativeStackNavigationProp<any, any>,
    route: string,
    disactivatePOS?: boolean,
    routeParams?: any
) => {
    // Until the session has started, settings may not reflect the stored
    // PIN or POS mode yet, so this cannot decide whether to ask for the PIN
    if (!settingsStore.sessionStarted()) return;

    const { posStatus, settings, setPosStatus } = settingsStore;
    const loginRequired = settings && (settings.passphrase || settings.pin);
    const posEnabled = posStatus === 'active';

    if (posEnabled && loginRequired) {
        navigation.navigate('Lockscreen', {
            pendingNavigation: { screen: route, params: routeParams }
        });
    } else {
        if (disactivatePOS) setPosStatus('inactive');
        navigation.navigate(route, routeParams);
    }
};

// Requires re-authentication (PIN, passphrase, or biometrics) before
// navigating to a screen that reveals sensitive material (e.g. the seed),
// regardless of POS status or current session login state
const reAuthNavigation = (
    navigation: NativeStackNavigationProp<any, any>,
    route: string,
    routeParams?: any
) => {
    if (settingsStore.loginMethodConfigured()) {
        navigation.navigate('Lockscreen', {
            pendingNavigation: { screen: route, params: routeParams }
        });
    } else {
        navigation.navigate(route, routeParams);
    }
};

export { POS_ROUTES, posRouteGuard, protectedNavigation, reAuthNavigation };
