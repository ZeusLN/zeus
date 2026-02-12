// Patch react-native-reanimated and react-native-worklets compatibility.json
// to include RN 0.84 support. The reanimated docs confirm 4.2.x supports
// RN 0.84 but the bundled compatibility.json may not yet include it.
// This can be removed once both packages ship releases with 0.84 in
// their compatibility lists.

import fs from 'fs';
import path from 'path';

function addRN84ToVersionList(versions) {
    if (Array.isArray(versions) && !versions.includes('0.84')) {
        versions.push('0.84');
        return true;
    }
    return false;
}

function patchCompatFile(packageName, compatPath, patchFn) {
    try {
        if (!fs.existsSync(compatPath)) {
            console.log(`  - ${packageName} compatibility.json not found, skipping`);
            return;
        }

        const compat = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
        const patched = patchFn(compat);

        if (patched) {
            fs.writeFileSync(compatPath, JSON.stringify(compat, null, 2) + '\n');
            console.log(`  - Added RN 0.84 to ${packageName} compatibility list`);
        } else {
            console.log(`  - RN 0.84 already in ${packageName} compatibility list`);
        }
    } catch (e) {
        console.log(`  - Warning: Could not patch ${packageName}: ${e.message}`);
    }
}

export function patchReanimatedCompat() {
    console.log('Patching reanimated/worklets (RN 0.84 compatibility)');

    // Patch react-native-reanimated
    patchCompatFile(
        'react-native-reanimated',
        path.resolve('node_modules/react-native-reanimated/compatibility.json'),
        (compat) => {
            let patched = false;
            if (compat.fabric?.['4.2.x']?.['react-native']) {
                patched = addRN84ToVersionList(compat.fabric['4.2.x']['react-native']) || patched;
            }
            if (compat.fabric?.nightly?.['react-native']) {
                patched = addRN84ToVersionList(compat.fabric.nightly['react-native']) || patched;
            }
            return patched;
        }
    );

    // Patch react-native-worklets
    patchCompatFile(
        'react-native-worklets',
        path.resolve('node_modules/react-native-worklets/compatibility.json'),
        (compat) => {
            let patched = false;
            if (compat['0.7.x']?.['react-native']) {
                patched = addRN84ToVersionList(compat['0.7.x']['react-native']) || patched;
            }
            if (compat.nightly?.['react-native']) {
                patched = addRN84ToVersionList(compat.nightly['react-native']) || patched;
            }
            return patched;
        }
    );
}
