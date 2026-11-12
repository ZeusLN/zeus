import { isScannedCode, useObjectOutput } from 'react-native-vision-camera';
import type {
    CameraOutput,
    ScannedObjectType
} from 'react-native-vision-camera';

// iOS implementation, using VisionCamera's object output (AVFoundation's
// AVCaptureMetadataOutput). The MLKit barcode scanner used on Android ships no
// arm64 simulator slice, so it is excluded from iOS autolinking in
// react-native.config.js and must not be imported here.

// Hoisted: useObjectOutput memoizes on the identity of this array, so an
// inline literal would tear down and recreate the native output every render.
const OBJECT_TYPES: ScannedObjectType[] = ['qr'];

export default function useQRCodeOutput(
    onScanned: (value: string) => void
): CameraOutput {
    return useObjectOutput({
        types: OBJECT_TYPES,
        onObjectsScanned: (objects) => {
            const code = objects
                .filter(isScannedCode)
                .find((c) => c.value != null)?.value;
            if (code != null) {
                onScanned(code);
            }
        }
    });
}
