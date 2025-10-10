import RNFS from 'react-native-fs';
import RNQRGenerator from 'rn-qr-generator';

/**
 * Decodes QR code from base64 image data using rn-qr-generator
 * @param base64Image - Base64 encoded image data
 * @returns Promise<string | null> - Decoded QR code string or null if failed
 */
export const decodeQRFromBase64 = async (
    base64Image: string
): Promise<string | null> => {
    try {
        // Clean the base64 string (remove any data URI prefix)
        const cleanBase64 = base64Image.replace(
            /^data:image\/[a-z]+;base64,/,
            ''
        );

        // Create a temporary file path
        const tempFilePath = `${
            RNFS.CachesDirectoryPath
        }/qr_temp_${Date.now()}.png`;

        // Write the base64 data to a temporary file
        await RNFS.writeFile(tempFilePath, cleanBase64, 'base64');

        // Use rn-qr-generator to detect QR codes from the file
        const result = await RNQRGenerator.detect({ uri: tempFilePath });

        // Clean up the temporary file
        try {
            await RNFS.unlink(tempFilePath);
        } catch (cleanupError) {
            console.warn('Failed to clean up temporary QR file:', cleanupError);
        }

        // Return the first detected QR code value
        if (result && result.values && result.values.length > 0) {
            return result.values[0];
        }

        return null;
    } catch (error) {
        console.error('QR decode failed:', error);
        return null;
    }
};

/**
 * Decodes QR code from base64 image data and returns multiple values if found
 * This maintains compatibility with the old RNQRGenerator.detect API
 * @param options - Object containing base64 image data
 * @returns Promise<{values: string[]} | null> - Object with values array or null if failed
 */
export const detectQRFromBase64 = async (options: {
    base64: string;
}): Promise<{ values: string[] } | null> => {
    try {
        const decoded = await decodeQRFromBase64(options.base64);
        if (decoded) {
            return { values: [decoded] };
        }
        return null;
    } catch (error) {
        console.error('QR detection failed:', error);
        return null;
    }
};
