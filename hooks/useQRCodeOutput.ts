import type { CameraOutput } from 'react-native-vision-camera';
import { useBarcodeScannerOutput } from 'react-native-vision-camera-barcode-scanner';
import type { TargetBarcodeFormat } from 'react-native-vision-camera-barcode-scanner';

// Android implementation. On iOS, Metro resolves useQRCodeOutput.ios.ts
// instead, because react-native.config.js excludes the barcode scanner (and
// the MLKit pods it pulls in) from iOS autolinking.

// Hoisted: useBarcodeScannerOutput memoizes on the identity of this array, so
// an inline literal would tear down and recreate the native output every render.
const BARCODE_FORMATS: TargetBarcodeFormat[] = ['qr-code'];

export default function useQRCodeOutput(
    onScanned: (value: string) => void
): CameraOutput {
    return useBarcodeScannerOutput({
        barcodeFormats: BARCODE_FORMATS,
        // 'preview' (the default) decodes preview-sized buffers, which loses the
        // detail needed for dense invoices and codes held away from the lens.
        // 'full' analyses the highest-resolution buffers the session can supply.
        outputResolution: 'full',
        onBarcodeScanned: (barcodes) => {
            const code = barcodes.find((b) => b.rawValue != null)?.rawValue;
            if (code != null) {
                onScanned(code);
            }
        },
        onError: (error) => console.error('Barcode scanner error:', error)
    });
}
