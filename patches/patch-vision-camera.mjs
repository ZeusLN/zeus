// Prevent crash when VisionCamera native library cannot be loaded on the device/ABI.
// This repo targets 16KB page-size compliance; some prebuilt native libs may not load on
// certain emulator/device setups.

import fs from 'fs';

export function patchVisionCamera() {
    const cameraPackagePath =
        './node_modules/react-native-vision-camera/android/src/main/java/com/mrousavy/camera/react/CameraPackage.kt';

    if (!fs.existsSync(cameraPackagePath)) {
        console.log('Patching react-native-vision-camera');
        console.log('  - Skipping: CameraPackage.kt not found');
        return;
    }

    console.log('Patching react-native-vision-camera');

    let content = fs.readFileSync(cameraPackagePath, 'utf8');

    // Guard native module creation so an UnsatisfiedLinkError in VisionCamera's static init
    // doesn't crash the whole app at startup.
    if (!content.includes('catch (e: UnsatisfiedLinkError)')) {
        content = content.replace(
            /override fun createNativeModules\(reactContext: ReactApplicationContext\): List<NativeModule> =\n\s*listOf\(\n\s*CameraViewModule\(reactContext\),\n\s*CameraDevicesManager\(reactContext\)\n\s*\)/m,
            `override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    try {
      listOf(
        CameraViewModule(reactContext),
        CameraDevicesManager(reactContext)
      )
    } catch (e: UnsatisfiedLinkError) {
      // VisionCamera native lib failed to load. Disable camera modules instead of crashing.
      emptyList()
    }`
        );
    }

    fs.writeFileSync(cameraPackagePath, content);
    console.log('  - Guarded CameraPackage.kt createNativeModules()');
}

