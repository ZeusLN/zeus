import { NativeModules } from 'react-native';
import QRKit from 'react-native-qr-kit';
import handleAnything from './handleAnything';
import { localeString } from './LocaleUtils';
import { settingsStore } from '../stores/Stores';

const { MobileTools } = NativeModules;

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

/**
 * Processes a shared QR code image from Android share intent
 * @returns Navigation result with success status, route/params or error message
 */
export const processSharedQRImage =
    async (): Promise<ShareIntentResult | null> => {
        try {
            const base64Image = await MobileTools.getSharedImageBase64();
            if (!base64Image) return null;

            // Extract QR code data using QRKit
            const result = await QRKit.decodeBase64(base64Image);

            if (result?.success && result.data) {
                const qrData = result.data;

                // Use existing handleAnything function to process the QR data
                const response = await handleAnything(qrData);

                if (response) {
                    const [route, params] = response;
                    return { success: true, route, params };
                }
            }

            return {
                success: false,
                error: localeString('utils.shareIntent.noQRFound')
            };
        } catch (error) {
            console.error('Error processing shared QR image:', error);
            return {
                success: false,
                error: localeString('utils.shareIntent.processingError')
            };
        }
    };

/**
 * Fast check for shared QR image without processing - for early app startup
 * @returns Promise<ShareIntentResult | null> - result with base64 image if found
 */
export const processSharedQRImageFast =
    async (): Promise<ShareIntentResult | null> => {
        try {
            // Get the shared image as base64 from Android intent
            const base64Image = await MobileTools.getSharedImageBase64();

            if (!base64Image) return null;

            // Consume the intent now that the image is in memory. Left in
            // place, every later read (each resume runs
            // Wallet.getSettingsAndNavigate) hands the same image over again,
            // which in POS mode puts the terminal back on the PIN screen.
            try {
                await MobileTools.clearSharedIntent();
            } catch (clearError) {
                console.warn('Failed to clear share intent', clearError);
            }

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

/**
 * Checks if there's a pending shared image to process
 * @returns Promise<boolean> - true if there's a shared image waiting
 */
export const hasSharedImage = async (): Promise<boolean> => {
    try {
        const base64Image = await MobileTools.getSharedImageBase64();
        return !!base64Image;
    } catch (error) {
        console.error('Error checking for shared image:', error);
        return false;
    }
};
