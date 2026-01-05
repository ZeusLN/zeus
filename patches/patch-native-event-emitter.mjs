// Fix NativeEventEmitter throwing on iOS when native module is null
// In RN 0.83+, NativeEventEmitter uses invariant() which throws when passed null on iOS
// This breaks deprecated modules like PushNotificationIOS that are loaded during React Refresh
// Change from invariant (throws) to console.warn (logs warning but continues)

import fs from 'fs';

export function patchNativeEventEmitter() {
    console.log('Patching NativeEventEmitter');

    const nativeEventEmitterPath =
        './node_modules/react-native/Libraries/EventEmitter/NativeEventEmitter.js';

    if (!fs.existsSync(nativeEventEmitterPath)) {
        console.log('  - Skipping: NativeEventEmitter.js not found');
        return;
    }

    let content = fs.readFileSync(nativeEventEmitterPath, 'utf8');

    // Replace the invariant that throws with a console.warn that just logs
    content = content.replace(
        `if (Platform.OS === 'ios') {
      invariant(
        nativeModule != null,
        '\`new NativeEventEmitter()\` requires a non-null argument.',
      );
    }`,
        `if (Platform.OS === 'ios' && nativeModule == null) {
      console.warn(
        '\`new NativeEventEmitter()\` was called with a null argument. This is deprecated and may indicate a missing native module.',
      );
    }`
    );

    fs.writeFileSync(nativeEventEmitterPath, content);
    console.log('  - Patched NativeEventEmitter.js');
}
