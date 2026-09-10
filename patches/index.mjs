// Postinstall patches for Zeus
// Run with: node patches/index.mjs

import { patchJcenter } from './patch-jcenter.mjs';
import { patchNativeEventEmitter } from './patch-native-event-emitter.mjs';
import { patchReactNativeNotifications } from './patch-react-native-notifications.mjs';
import { patchNobleHashes } from './patch-noble-hashes.mjs';
import { patchReanimatedBoundaryAndroid } from './patch-reanimated-boundary-android.mjs';
import { patchReanimatedSetFixes } from './patch-reanimated-set-fixes.mjs';

console.log('Running postinstall patches...\n');

(async () => {
    try {
        patchJcenter();
        patchNativeEventEmitter();
        patchReactNativeNotifications();
        patchNobleHashes();
        patchReanimatedBoundaryAndroid();
        patchReanimatedSetFixes();
    } catch (error) {
        console.error(`\nPostinstall patch failed:\n\n${error.message}\n`);
        process.exit(1);
    }

    console.log('\nAll patches applied successfully.');
})();
