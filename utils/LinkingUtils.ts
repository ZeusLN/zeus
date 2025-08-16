import { Linking, Platform, NativeModules } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';
import {
    processSharedQRImageFast,
    setPendingShareIntent,
    getPendingShareIntent,
    hasPendingShareIntent
} from './ShareIntentProcessor';
import { settingsStore } from '../stores/Stores';

class LinkingUtils {
    private shareIntentProcessed = false;

    handleInitialUrl = (navigation: StackNavigationProp<any, any>) =>
        Linking.getInitialURL().then(async (url) => {
            if (url) {
                this.handleDeepLink(url, navigation);
                return;
            }
            if (Platform.OS === 'android') {
                const nfcData =
                    await NativeModules.MobileTools.getIntentNfcData();
                if (nfcData) {
                    this.handleDeepLink(nfcData, navigation);
                    return;
                }

                if (!this.shareIntentProcessed) {
                    const shareIntentResult = await processSharedQRImageFast();

                    if (shareIntentResult && shareIntentResult.success) {
                        this.shareIntentProcessed = true;

                        const requiresAuthentication =
                            settingsStore.loginRequired();
                        const requiresWalletSelection =
                            settingsStore.settings?.selectNodeOnStartup;

                        if (requiresAuthentication || requiresWalletSelection) {
                            setPendingShareIntent(shareIntentResult.params);
                            return;
                        } else {
                            navigation.navigate(
                                'ShareIntentProcessing',
                                shareIntentResult.params
                            );
                        }
                    }
                }
            }
        });
    handleDeepLink = (
        url: string,
        navigation: StackNavigationProp<any, any>
    ) => {
        if (url.startsWith('nostr:')) {
            Linking.openURL(url);
        } else {
            handleAnything(url)
                .then(([route, props]) => {
                    navigation.navigate(route, props);
                })
                .catch((err) =>
                    console.error(
                        localeString('views.Wallet.Wallet.error'),
                        err
                    )
                );
        }
    };

    resetShareIntentFlag = () => {
        this.shareIntentProcessed = false;
    };

    processPendingShareIntent = (
        navigation: StackNavigationProp<any, any>
    ): boolean => {
        try {
            if (hasPendingShareIntent()) {
                const pendingData = getPendingShareIntent();

                if (pendingData) {
                    navigation.navigate('ShareIntentProcessing', pendingData);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(
                'LinkingUtils: Error processing pending share intent:',
                error
            );
            return false;
        }
    };
}

const linkingUtils = new LinkingUtils();
export default linkingUtils;
