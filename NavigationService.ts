import {
    CommonActions,
    NavigationContainerRef
} from '@react-navigation/native';

let _navigator: NavigationContainerRef<{}>;

function setTopLevelNavigator(navigatorRef: NavigationContainerRef<{}>) {
    _navigator = navigatorRef;
}

function navigate(routeName: string, params?: any) {
    _navigator.dispatch(
        CommonActions.navigate({
            name: routeName,
            params
        })
    );
}

const NAVIGATE_WHEN_READY_MAX_ATTEMPTS = 50;
const NAVIGATE_WHEN_READY_INTERVAL_MS = 100;

function navigateWhenReady(routeName: string, params?: any, attempt = 0): void {
    if (!_navigator || !_navigator.isReady()) {
        if (attempt < NAVIGATE_WHEN_READY_MAX_ATTEMPTS) {
            setTimeout(
                () => navigateWhenReady(routeName, params, attempt + 1),
                NAVIGATE_WHEN_READY_INTERVAL_MS
            );
        }
        return;
    }
    navigate(routeName, params);
}

export function getRouteStack() {
    if (_navigator.isReady()) {
        return _navigator.getRootState().routes;
    }
    return [];
}

// add other navigation functions that you need and export them

export default {
    navigate,
    navigateWhenReady,
    getRouteStack,
    setTopLevelNavigator
};
