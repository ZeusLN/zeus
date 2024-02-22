// This might be removed when this issue is fixed: https://github.com/Sifir-io/react-native-tor/issues/57

import compressing from 'compressing';
import fs from 'fs';

console.log('Removing unsupported arm64 JNI from sifir_android');

(async () => {
    await compressing.zip.uncompress(
        './node_modules/react-native-tor/android/libs/sifir_android.aar',
        './node_modules/react-native-tor/android/libs/sifir_android'
    );

    fs.rmSync(
        './node_modules/react-native-tor/android/libs/sifir_android/jni/arm64',
        { force: true, recursive: true }
    );

    fs.rmSync('./node_modules/react-native-tor/android/libs/sifir_android.aar');

    await compressing.zip.compressDir(
        './node_modules/react-native-tor/android/libs/sifir_android',
        './node_modules/react-native-tor/android/libs/sifir_android.aar',
        { ignoreBase: true }
    );

    fs.rmSync('./node_modules/react-native-tor/android/libs/sifir_android', {
        force: true,
        recursive: true
    });
})();
