import { Linking, Platform, NativeModules } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';
import {
    processSharedQRImageFast,
    getPendingShareIntent,
    hasPendingShareIntent
} from './ShareIntentProcessor';
import { settingsStore, nodeInfoStore, balanceStore } from '../stores/Stores';

import BackendUtils from './BackendUtils';
import { sleep } from './SleepUtils';

class LinkingUtils {
    private shareIntentProcessed = false;

    /**
     * Waits for node to be connected and balance to be loaded before processing invoices
     * This prevents showing zero balance when invoices are loaded from external apps
     */
    private waitForNodeAndBalance = async (
        maxWaitTime: number = 30000
    ): Promise<boolean> => {
        const startTime = Date.now();
        const supportsNodeInfo = BackendUtils.supportsNodeInfo();
        let balanceHasBeenFetched = false;

        while (Date.now() - startTime < maxWaitTime) {
            // Check if node is connected and not loading (only if backend supports node info)
            let nodeReady = true;
            if (supportsNodeInfo) {
                nodeReady =
                    !nodeInfoStore.loading &&
                    !nodeInfoStore.error &&
                    nodeInfoStore.nodeInfo &&
                    Object.keys(nodeInfoStore.nodeInfo).length > 0;
            }

            const balanceIsLoading =
                balanceStore.loadingLightningBalance ||
                balanceStore.loadingBlockchainBalance;

            // Check if balance has been fetched and is not currently loading
            const balanceReady = balanceHasBeenFetched && !balanceIsLoading;

            if (nodeReady && balanceReady) {
                return true;
            }

            // If node is not ready and backend supports node info, try to fetch it
            if (
                supportsNodeInfo &&
                !nodeReady &&
                !nodeInfoStore.loading &&
                !nodeInfoStore.error
            ) {
                try {
                    await nodeInfoStore.getNodeInfo();
                } catch (e) {
                    console.warn(
                        '[LinkingUtils] Error fetching node info, retrying:',
                        e
                    );
                }
            }

            // If balance has not been fetched and is not loading, try to fetch balance
            if (!balanceHasBeenFetched && !balanceIsLoading) {
                try {
                    if (BackendUtils.supportsOnchainBalance()) {
                        await balanceStore.getCombinedBalance();
                    } else {
                        await balanceStore.getLightningBalance(false);
                    }
                    balanceHasBeenFetched = true;
                } catch (e) {
                    console.warn(
                        '[LinkingUtils] Error fetching balance, retrying:',
                        e
                    );
                }
            }

            await sleep(500);
        }

        // Timeout reached, proceed anyway but log warning
        console.warn(
            '[LinkingUtils] Timeout waiting for node/balance, proceeding anyway'
        );
        return false;
    };

    handleInitialUrl = (navigation: StackNavigationProp<any, any>) =>
        Linking.getInitialURL().then(async (url) => {
            this.shareIntentProcessed = false;

            if (url) {
                await this.handleDeepLink(url, navigation);
                return;
            }
            if (Platform.OS === 'android') {
                const nfcData =
                    await NativeModules.MobileTools.getIntentNfcData();
                if (nfcData) {
                    await this.handleDeepLink(nfcData, navigation);
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
    handleDeepLink = async (
        url: string,
        navigation: StackNavigationProp<any, any>
    ) => {
        if (url.startsWith('nostr:')) {
            Linking.openURL(url);
        } else {
            try {
                const [route, props] = await handleAnything(url);

                // Wait for node to connect and balance to load before navigating to invoice views
                // This prevents showing zero balance when invoices are loaded from external apps
                const invoiceRoutes = ['PaymentRequest', 'ChoosePaymentMethod'];
                if (invoiceRoutes.includes(route)) {
                    // Check if we have credentials (node is configured)
                    if (settingsStore.hasCredentials()) {
                        await this.waitForNodeAndBalance();
                    }
                }

                navigation.navigate(route, props);
            } catch (err) {
                console.error(localeString('views.Wallet.Wallet.error'), err);
            }
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
