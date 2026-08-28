import { Linking, Platform, NativeModules } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';
import { processSharedQRImageFast } from './ShareIntentProcessor';
import { settingsStore } from '../stores/Stores';

// Payment status screens that must never be popped out from under an
// in-flight payment by a deep link. Mirrors App.tsx
// SCREENS_WITH_CUSTOM_BACK_HANDLER's payment entries.
const SENDING_SCREENS = [
    'SendingLightning',
    'SendingOnChain',
    'CashuSendingLightning'
];

class LinkingUtils {
    private shareIntentProcessed = false;
    private pendingDeepLink: string | null = null;
    // Linking.getInitialURL() returns the same URL for the lifetime of the
    // activity (and on Android, onNewIntent + setIntent refreshes it with
    // each warm deep link), while the Wallet view — which consumes it — can
    // mount more than once, e.g. when 'Select wallet on start-up' is
    // enabled. Track the last URL actually processed so it is only ever
    // handled once.
    private lastHandledUrl: string | null = null;

    processPendingDeepLink = (
        navigation: NativeStackNavigationProp<any, any>
    ) => {
        if (this.pendingDeepLink) {
            const url = this.pendingDeepLink;
            this.pendingDeepLink = null;
            this.handleDeepLink(url, navigation);
        }
    };

    handleInitialUrl = (navigation: NativeStackNavigationProp<any, any>) =>
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
                }
                return;
            }

            if (url) {
                if (url !== this.lastHandledUrl) {
                    this.handleDeepLink(url, navigation);
                }
                return;
            }
            if (Platform.OS === 'android') {
                await this.handleAndroidIntents(navigation);
            }
        });

    handleAndroidIntents = async (
        navigation: NativeStackNavigationProp<any, any>
    ) => {
        const nfcData = await NativeModules.MobileTools.getIntentNfcData();
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
    };

    handleDeepLink = (
        url: string,
        navigation: NativeStackNavigationProp<any, any>
    ) => {
        if (settingsStore.loginRequired()) {
            this.pendingDeepLink = url;
            return;
        }

        this.lastHandledUrl = url;

        if (url.startsWith('nostr:')) {
            Linking.openURL(url);
        } else {
            handleAnything(url)
                .then(([route, props]) => {
                    // navigate() only reuses an existing route when it is the
                    // currently focused one, so a payment request arriving
                    // while another screen sits on top of PaymentRequest
                    // (e.g. the QR view opened from its header) would push a
                    // SECOND PaymentRequest, freshly pinned to the injected
                    // invoice. That bypasses the payment-request-changed
                    // warning on the buried instance and leaves stale review
                    // screens in the stack. If a PaymentRequest already
                    // exists, pop back to it instead: it is already showing
                    // the new invoice alongside the warning. Never pop while
                    // a payment status screen is focused, so an in-flight
                    // payment's UI is not torn down.
                    const state = navigation.getState();
                    const routes = state?.routes ?? [];
                    const focusedRoute = routes[state?.index ?? 0]?.name;
                    if (
                        route === 'PaymentRequest' &&
                        !SENDING_SCREENS.includes(focusedRoute) &&
                        routes.some((r) => r.name === 'PaymentRequest')
                    ) {
                        navigation.popTo(route, props);
                    } else {
                        navigation.navigate(route, props);
                    }
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
}

const linkingUtils = new LinkingUtils();
export default linkingUtils;
