import { NativeModules } from 'react-native';
import { detectQRFromBase64 } from './QRDecoder';
import handleAnything from './handleAnything';
import { localeString } from './LocaleUtils';

const { MobileTools } = NativeModules;

export interface ShareIntentResult {
    success: boolean;
    route?: string;
    params?: any;
    error?: string;
}

let pendingShareIntentData: {
    base64Image?: string;
    qrData?: string;
} | null = null;

/**
 * Processes a shared QR code image from Android share intent
 * @returns Navigation result with success status, route/params or error message
 */
export const processSharedQRImage =
    async (): Promise<ShareIntentResult | null> => {
        try {
            const base64Image = await MobileTools.getSharedImageBase64();
            if (!base64Image) return null;

            // Extract QR code data using new QR decoder
            const result = await detectQRFromBase64({
                base64: base64Image
            });

            if (result?.values && result.values.length > 0) {
                const qrData = result.values[0];

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

            // Return the base64 image for processing in the ShareIntentProcessing screen
            return {
                success: true,
                route: 'ShareIntentProcessing',
                params: { base64Image }
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

export const setPendingShareIntent = (data: {
    base64Image?: string;
    qrData?: string;
}) => {
    pendingShareIntentData = data;
};

export const getPendingShareIntent = (): {
    base64Image?: string;
    qrData?: string;
} | null => {
    const data = pendingShareIntentData;
    pendingShareIntentData = null;
    return data;
};

export const hasPendingShareIntent = (): boolean => {
    return pendingShareIntentData !== null;
};
