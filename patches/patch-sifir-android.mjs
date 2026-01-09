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
}
