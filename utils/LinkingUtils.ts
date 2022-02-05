import { Linking } from 'react-native';
import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';

class LinkingUtils {
    handleInitialUrl = (navigation: any) =>
        Linking.getInitialURL().then(
            (url) => url && this.handleDeepLink(url, navigation)
        );

    handleDeepLink = (url: string, navigation: any) =>
        handleAnything(url)
            .then(([route, props]) => {
                navigation.navigate(route, props);
            })
            .catch((err) =>
                console.error(localeString('views.Wallet.Wallet.error'), err)
            );

    handleOpenURL = (event: any) => {
        if (event.url) {
            this.handleDeepLink(event.url);
        }
    };

    addEventListener = () =>
        Linking.addEventListener('url', this.handleOpenURL);

    removeEventListener = () =>
        Linking.removeEventListener('url', this.handleOpenURL);
}

const linkingUtils = new LinkingUtils();
export default linkingUtils;
