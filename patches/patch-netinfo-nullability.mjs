// Fix nullability conflict in @react-native-community/netinfo
// In RN 0.83+, RCT_EXPORT_METHOD uses NS_ASSUME_NONNULL which conflicts with
// the explicit 'nullable' annotation on the requestedInterface parameter

import fs from 'fs';

export function patchNetinfoNullability() {
    console.log('Patching @react-native-community/netinfo nullability');

    const netinfoPath =
        './node_modules/@react-native-community/netinfo/ios/RNCNetInfo.mm';

    if (!fs.existsSync(netinfoPath)) {
        console.log('  - Skipping: RNCNetInfo.mm not found');
        return;
    }

    let content = fs.readFileSync(netinfoPath, 'utf8');

    // Remove the conflicting 'nullable' specifier
    content = content.replace(
        'RCT_EXPORT_METHOD(getCurrentState:(nullable NSString *)requestedInterface resolve:(RCTPromiseResolveBlock)resolve',
        'RCT_EXPORT_METHOD(getCurrentState:(NSString *)requestedInterface resolve:(RCTPromiseResolveBlock)resolve'
    );

    fs.writeFileSync(netinfoPath, content);
    console.log('  - Patched RNCNetInfo.mm');
}
