// Patch react-native-view-shot for RN 0.84 Fabric compatibility.
// RCTScrollView was removed in RN 0.84; use RCTScrollViewComponentView on
// Fabric builds instead.
// Based on https://github.com/gre/react-native-view-shot/pull/584
// Can be removed once react-native-view-shot ships a release with this fix.

import fs from 'fs';

export function patchViewShot() {
    console.log('Patching react-native-view-shot (RN 0.84 Fabric compat)');

    const filePath =
        './node_modules/react-native-view-shot/ios/RNViewShot.mm';

    if (!fs.existsSync(filePath)) {
        console.log('  - Skipping: RNViewShot.mm not found');
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add the Fabric/legacy scroll view typedef after the existing #ifdef block
    const importAnchor = `#ifdef RCT_NEW_ARCH_ENABLED
#import <rnviewshot/rnviewshot.h>
#endif`;

    const importReplacement = `#ifdef RCT_NEW_ARCH_ENABLED
#import <rnviewshot/rnviewshot.h>
#endif

#if __has_include(<React/RCTScrollViewComponentView.h>)

  // Fabric available
  #import <React/RCTScrollViewComponentView.h>
  typedef RCTScrollViewComponentView RNSnapshotScrollViewHost;

#else

  // Fallback to legacy
  #import <React/RCTScrollView.h>
  typedef RCTScrollView RNSnapshotScrollViewHost;

#endif`;

    if (!content.includes('RNSnapshotScrollViewHost')) {
        content = content.replace(importAnchor, importReplacement);
    }

    // 2. Remove the now-unnecessary standalone RCTScrollView import
    content = content.replace('#import <React/RCTScrollView.h>\n', '');

    // 3. Replace RCTScrollView usage in snapshotContentContainer logic
    content = content.replace(
        `if (![view isKindOfClass:[RCTScrollView class]]) {
        reject(RCTErrorUnspecified, [NSString stringWithFormat:@"snapshotContentContainer can only be used on a RCTScrollView. instead got: %@", view], nil);
        return;
      }
      RCTScrollView* rctScrollView = view;
      scrollView = rctScrollView.scrollView;`,
        `if (![view isKindOfClass:[RNSnapshotScrollViewHost class]]) {
        reject(RCTErrorUnspecified,
               [NSString stringWithFormat:@"snapshotContentContainer can only be used on a ScrollView host. instead got: %@", view],
               nil);
        return;
      }

      RNSnapshotScrollViewHost *host = (RNSnapshotScrollViewHost *)view;
      UIScrollView *scrollView = host.scrollView;`
    );

    fs.writeFileSync(filePath, content);
    console.log('  - Patched RNViewShot.mm');
}
