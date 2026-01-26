// Fix for react-native-tor arm64 JNI and Kotlin 2.0 compatibility
// Issue: https://github.com/Sifir-io/react-native-tor/issues/57

import compressing from 'compressing';
import fs from 'fs';

export async function patchSifirAndroid() {
    console.log('Patching react-native-tor (sifir_android)');

    const aarPath = './node_modules/react-native-tor/android/libs/sifir_android.aar';
    const extractPath = './node_modules/react-native-tor/android/libs/sifir_android';

    if (!fs.existsSync(aarPath)) {
        console.log('  - Skipping: sifir_android.aar not found');
        return;
    }

    // Remove unsupported arm64 JNI
    await compressing.zip.uncompress(aarPath, extractPath);

    // react-native-tor's AAR typically uses standard ABI folder names (e.g. arm64-v8a).
    // Remove arm64 JNI payload to avoid shipping an ELF that isn't 16KB-aligned.
    fs.rmSync(extractPath + '/jni/arm64-v8a', { force: true, recursive: true });
    // Back-compat in case an older layout was used.
    fs.rmSync(extractPath + '/jni/arm64', { force: true, recursive: true });
    fs.rmSync(aarPath);

    await compressing.zip.compressDir(extractPath, aarPath, { ignoreBase: true });

    fs.rmSync(extractPath, { force: true, recursive: true });
    console.log('  - Removed unsupported arm64 JNI');

    // Fix Kotlin 2.0 type compatibility issues
    const torBridgeRequestPath =
        './node_modules/react-native-tor/android/src/main/java/com/reactnativetor/TorBridgeRequest.kt';

    if (fs.existsSync(torBridgeRequestPath)) {
        let content = fs.readFileSync(torBridgeRequestPath, 'utf8');

        // Fix HashMap<String, Any>? to HashMap<String, Any?>?
        content = content.replace(
            'val headers: HashMap<String, Any>?',
            'val headers: HashMap<String, Any?>?'
        );

        // Fix deprecated toUpperCase() -> uppercase()
        content = content.replace(
            'param.method.toUpperCase()',
            'param.method.uppercase()'
        );

        fs.writeFileSync(torBridgeRequestPath, content);
        console.log('  - Fixed TorBridgeRequest.kt for Kotlin 2.0');
    }

    // Prevent startup crash when sifir_android JNI isn't present for the current ABI.
    // (e.g. when stripping arm64-v8a JNI for 16KB ELF alignment compliance)
    const torPackagePath =
        './node_modules/react-native-tor/android/src/main/java/com/reactnativetor/TorPackage.kt';

    if (fs.existsSync(torPackagePath)) {
        let content = fs.readFileSync(torPackagePath, 'utf8');

        // Replace the eager loadLibrary() with a guarded version that skips module init.
        // Keeps the app running even when Tor native bits are absent.
        if (content.includes('System.loadLibrary("sifir_android")')) {
            content = content.replace(
                '    System.loadLibrary("sifir_android")',
                `    try {
      System.loadLibrary("sifir_android")
    } catch (e: UnsatisfiedLinkError) {
      // Native library not available for this ABI; disable Tor module.
      return emptyList()
    }`
            );
            fs.writeFileSync(torPackagePath, content);
            console.log('  - Guarded TorPackage.kt loadLibrary()');
        }
    }
}
