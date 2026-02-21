// Postinstall patches for Zeus
// Run with: node patches/index.mjs

import { patchSifirAndroid } from './patch-sifir-android.mjs';
import { patchJcenter } from './patch-jcenter.mjs';
import { patchNativeEventEmitter } from './patch-native-event-emitter.mjs';
import { patchReactNativeNotifications } from './patch-react-native-notifications.mjs';
import { patchNobleHashes } from './patch-noble-hashes.mjs';

console.log('Running postinstall patches...\n');

(async () => {
    await patchSifirAndroid();
    patchJcenter();
    patchNativeEventEmitter();
    patchReactNativeNotifications();
    patchNobleHashes();

    console.log('\nAll patches applied successfully.');
})();
