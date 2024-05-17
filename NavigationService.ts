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

// add other navigation functions that you need and export them

export default {
    navigate,
    setTopLevelNavigator
};
