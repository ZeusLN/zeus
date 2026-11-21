import { NativeModules } from 'react-native';
import { localeString } from './LocaleUtils';
import { settingsStore } from '../stores/Stores';

const { MobileTools } = NativeModules;

// Wallet.getSettingsAndNavigate waits for the shared image before it opens
// the Lockscreen, and the image is served by the app that shared it. Give up
// after the native read's own deadline (MobileTools.SHARED_IMAGE_TIMEOUT_MS,
// 5 s) plus time spent queued behind other native calls.
export const SHARED_IMAGE_TIMEOUT_MS = 8000;

// The native take is told to settle this long before SHARED_IMAGE_TIMEOUT_MS
// runs out, so its result reaches JS while the race below still waits for
// it. A take that settled after JS gave up could consume the share with
// nobody to receive the image, and the next read would find nothing.
export const SHARED_IMAGE_RESULT_MARGIN_MS = 1000;

// A shared image on its way to the ShareIntentProcessing screen, with the
// gates it still has to clear
export interface ShareIntentPayload {
    qrData?: string;
    base64Image?: string;
    requiresAuth?: boolean;
    requiresWalletSelection?: boolean;
}

export interface ShareIntentResult {
    success: boolean;
    route?: string;
    params?: any;
    error?: string;
}

// On resume two handlers look for the same share at once: on iOS
// Wallet.handleOpenURL and Wallet.handleAppStateChange, on Android
// LinkingUtils.handleAndroidIntents and Wallet.handleAppStateChange. When the
// read and the clear were separate native calls, both reads finished before
// either cleared, so each would navigate to ShareIntentProcessing. The native
// take now reads and clears in one call, and a second take of the same share
// finds nothing while the first is still reading it (iOS: the file is moved
// aside first; Android: the read runs off the module queue and a share has
// one reader at a time). This lock stays as a second layer: only one take
// runs at a time, and a caller that arrives meanwhile gets null, as if
// nothing had been shared, while the caller holding the lock delivers the
// image.
let readInFlight = false;

/**
 * Fast check for shared QR image without processing - for early app startup
 * @returns Promise<ShareIntentResult | null> - result with base64 image if found
 */
export const processSharedQRImageFast =
    async (): Promise<ShareIntentResult | null> => {
        if (readInFlight) return null;
        readInFlight = true;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            // Read the shared image (Android: the activity intent; iOS: the
            // file the share extension wrote) and consume it in the same
            // native call. Left in place, every later read (each resume runs
            // Wallet.getSettingsAndNavigate) hands the same image over again,
            // which in POS mode puts the terminal back on the PIN screen.
            // Reading and clearing in two calls let a share that arrived in
            // between be cleared without ever being read. If the native side
            // cannot consume the share it still returns the image and leaves
            // the share in place, so the next read delivers it again. A read
            // that gives up is a processing error; the native side consumes
            // the share only with the image in hand, so the next read asks
            // for it again. The native side gives up by settleBy (a
            // Date.now() time, read there from the same wall clock), a
            // second before this call does.
            const settleBy =
                Date.now() +
                SHARED_IMAGE_TIMEOUT_MS -
                SHARED_IMAGE_RESULT_MARGIN_MS;
            const base64Image = await Promise.race([
                MobileTools.takeSharedImageBase64(settleBy),
                new Promise<never>((_, reject) => {
                    timeout = setTimeout(
                        () => reject(new Error('Shared image read timed out')),
                        SHARED_IMAGE_TIMEOUT_MS
                    );
                })
            ]);

            if (!base64Image) return null;

            // Return the base64 image for processing in the ShareIntentProcessing screen.
            //
            // The gates are attached here, where the payload enters the app,
            // rather than at each call site. An intent read from the OS has
            // passed no authentication, and a caller that forgets to say so
            // hands it straight to the QR processor, which navigates wherever
            // the QR points: the POS cold start did exactly that, so a shared
            // image could open Send or WalletConfiguration with the PIN never
            // asked for. Screens that continue this payload after a
            // successful unlock or wallet selection clear the corresponding
            // flag themselves. Wallet selection is only owed on a start-up
            // that has not picked a wallet yet: initialStart goes false once
            // one is selected or connected.
            const params: ShareIntentPayload = {
                base64Image,
                requiresAuth: settingsStore.externalInputAuthRequired(),
                requiresWalletSelection:
                    !!settingsStore.settings?.selectNodeOnStartup &&
                    settingsStore.initialStart
            };
            return {
                success: true,
                route: 'ShareIntentProcessing',
                params
            };
        } catch (error) {
            console.error('Error in fast share QR processing:', error);
            return {
                success: false,
                error: localeString('utils.shareIntent.processingError')
            };
        } finally {
            clearTimeout(timeout);
            readInFlight = false;
        }
    };

/**
 * Marks a share-intent payload as having cleared the app lock, so the
 * processing screen does not send the user straight back to the Lockscreen
 * they just came from. Only for callers where the user has actually
 * authenticated.
 */
export const authenticatedShareIntent = (
    shareIntentData?: ShareIntentPayload
): ShareIntentPayload | undefined =>
    shareIntentData ? { ...shareIntentData, requiresAuth: false } : undefined;

/**
 * Marks a share-intent payload as having been through wallet selection, the
 * counterpart of authenticatedShareIntent for the other gate.
 */
export const walletSelectedShareIntent = (
    shareIntentData?: ShareIntentPayload
): ShareIntentPayload | undefined =>
    shareIntentData
        ? { ...shareIntentData, requiresWalletSelection: false }
        : undefined;
