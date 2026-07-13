// Restore react-native-reanimated's react-native.config.js, which is missing
// from the published npm tarball (the package.json `files` whitelist omits it;
// present in the repo since software-mansion/react-native-reanimated#9435).
//
// Tracking: https://github.com/ZeusLN/zeus/issues/4221
// Upstream: https://github.com/software-mansion/react-native-reanimated/issues/9943
// Remove once a reanimated release ships the file in its tarball.
//
// Without it, Android autolinking never registers
// REASharedTransitionBoundaryComponentDescriptor. The boundary then falls back
// to the legacy ViewManager interop path, whose default shadow node doesn't
// unset ForceFlattenView, so its `display: contents` style gets the view
// flattened out of the ShadowTree. Reanimated's shared element transition
// proxy never sees the boundary in mutations and transitions silently never
// run on Android.

import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(
    './node_modules/react-native-reanimated',
    'react-native.config.js'
);

const CONFIG_CONTENT = `module.exports = {
  dependency: {
    platforms: {
      android: {
        componentDescriptors: [
          'REASharedTransitionBoundaryComponentDescriptor',
        ],
        cmakeListsPath: '../Common/NativeView/CMakeLists.txt',
      },
    },
  },
};
`;

export function patchReanimatedBoundaryAndroid() {
    console.log(
        'Patching react-native-reanimated (restore react-native.config.js for Android SET boundary)'
    );

    if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
        console.warn('  - react-native-reanimated not found, skipping');
        return;
    }

    if (fs.existsSync(CONFIG_PATH)) {
        console.log('  - react-native.config.js already present, skipping');
        return;
    }

    fs.writeFileSync(CONFIG_PATH, CONFIG_CONTENT, 'utf8');
    console.log('  - Restored react-native.config.js');
}
