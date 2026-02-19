import { Linking, Platform, NativeModules } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';
import {
    processSharedQRImageFast,
    getPendingShareIntent,
    hasPendingShareIntent
} from './ShareIntentProcessor';
import { settingsStore } from '../stores/Stores';

class LinkingUtils {
    private shareIntentProcessed = false;

    handleInitialUrl = (navigation: StackNavigationProp<any, any>) =>
        Linking.getInitialURL().then(async (url) => {
            this.shareIntentProcessed = false;

            if (
                Platform.OS === 'ios' &&
                url &&
                url.startsWith('zeusln://share')
            ) {
                const shareIntentResult = await processSharedQRImageFast();

                if (shareIntentResult && shareIntentResult.success) {
                    this.shareIntentProcessed = true;

                    const requiresAuth = settingsStore.loginRequired();
                    const requiresWalletSelection =
                        settingsStore.settings?.selectNodeOnStartup;
                    try {
                        await NativeModules.MobileTools.clearSharedIntent();
                    } catch (e) {
                        console.warn('Failed to clear intent', e);
                    }

                    navigation.navigate('ShareIntentProcessing', {
                        ...shareIntentResult.params,
                        requiresAuth,
                        requiresWalletSelection
                    });
                    return;
                }
            }

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

                        const requiresAuth = settingsStore.loginRequired();
                        const requiresWalletSelection =
                            settingsStore.settings?.selectNodeOnStartup;

                        // Clear the Android share intent immediately to prevent reprocessing
                        try {
                            await NativeModules.MobileTools.clearSharedIntent();
                        } catch (clearError) {
                            console.warn(
                                '[LinkingUtils] Failed to clear share intent:',
                                clearError
                            );
                        }

                        // Always show processing screen immediately for share intents
                        // Background sync and authentication will be handled by the processing screen
                        navigation.navigate('ShareIntentProcessing', {
                            ...shareIntentResult.params,
                            requiresAuth,
                            requiresWalletSelection
                        });
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
