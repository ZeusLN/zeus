// Two behavioral fixes to react-native-reanimated's experimental shared
// element transition proxy (LayoutAnimationsProxy_Experimental.cpp), applied
// as source patches. Both were root-caused on-device in ZEUS; neither is
// fixed upstream as of 4.5.1 (checked 2026-07-13).
//
// Tracking: https://github.com/ZeusLN/zeus/issues/4222
// Remove each edit once the corresponding upstream fix ships in a release.
//
// Fix 1 — deterministic SET on pop (primarily Android):
// Upstream: https://github.com/software-mansion/react-native-reanimated/issues/9944
// The proxy finds the destination screen with findActiveBoundary(), which
// requires the SharedTransitionBoundary's `isActive` prop to be true. On pop,
// react-navigation's focus update for the revealed screen can land a React
// commit AFTER the commit that removes the screen above, so the mutation
// batch reanimated inspects sometimes sees the revealed boundary as still
// inactive and silently skips the return transition (push is unaffected: new
// screens mount already focused). When the previous top boundary was just
// removed from the tree (a pop) and no active boundary is found, fall back to
// the topmost mounted boundary.
//
// Fix 2 — don't wedge on cancelled closes (primarily iOS):
// Upstream: https://github.com/software-mansion/react-native-reanimated/issues/9945
// RNScreens can emit a "closing" transition-progress event for a screen that
// never unmounts (e.g. a cancelled interactive back gesture). The proxy
// stores that tag and, after the next completed progress transition, refuses
// to resynchronize until the tag leaves the tree — which never happens, so
// shared element transitions die app-wide until restart. Only keep waiting
// while the closing screen is actually mid-removal (tracked but detached
// from its parent).

import fs from 'fs';

const PROXY_CPP_PATH =
    './node_modules/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Experimental.cpp';

const POP_FALLBACK_ANCHOR = `    auto afterTopScreen = findActiveBoundary(root);
    topScreen[surfaceId] = afterTopScreen;`;

const POP_FALLBACK_REPLACEMENT = `    auto afterTopScreen = findActiveBoundary(root);
    // ZEUS PATCH (see patches/patch-reanimated-set-fixes.mjs):
    // When the screen holding the previous top boundary is removed (pop),
    // the revealed screen's boundary may not have received \`isActive=true\`
    // yet — react-navigation's focus update can land a commit after the one
    // containing the removal, so return transitions would silently race.
    // In that case fall back to the topmost mounted boundary.
    if (!afterTopScreen && beforeTopScreen && !lightNodes_.contains(beforeTopScreen->current.tag)) {
      afterTopScreen = findBoundaryGuess(root);
    }
    topScreen[surfaceId] = afterTopScreen;`;

const RESYNC_ANCHOR = `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, filteredMutations);
    if (!lightNodes_.contains(closingScreenTag_)) {
      topScreen[surfaceId] = findActiveBoundary(lightNodes_[surfaceId]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`;

const RESYNC_REPLACEMENT = `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, filteredMutations);
    // ZEUS PATCH (see patches/patch-reanimated-set-fixes.mjs):
    // Only keep waiting while the closing screen is actually mid-removal
    // (tracked but detached from its parent). A cancelled interactive pop
    // emits a closing event for a screen that never unmounts; waiting for
    // it would block resynchronization forever and permanently disable
    // shared element transitions.
    bool waitingForRemoval = false;
    const auto closingIt = lightNodes_.find(closingScreenTag_);
    if (closingIt != lightNodes_.end()) {
      const auto &closingNode = closingIt->second;
      const auto closingParent = closingNode->parent.lock();
      const bool attached = closingParent &&
          std::find(closingParent->children.begin(), closingParent->children.end(), closingNode) !=
              closingParent->children.end();
      waitingForRemoval = !attached;
    }
    if (!waitingForRemoval) {
      topScreen[surfaceId] = findActiveBoundary(lightNodes_[surfaceId]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`;

function applyEdit(content, anchor, replacement, label) {
    if (content.includes(replacement)) {
        console.log(`  - ${label}: already applied, skipping`);
        return content;
    }
    if (!content.includes(anchor)) {
        console.warn(
            `  - ${label}: anchor not found (reanimated version changed?) — NOT applied`
        );
        return content;
    }
    console.log(`  - ${label}: applied`);
    return content.replace(anchor, replacement);
}

export function patchReanimatedSetFixes() {
    console.log(
        'Patching react-native-reanimated (shared element transition fixes)'
    );

    if (!fs.existsSync(PROXY_CPP_PATH)) {
        console.warn(
            '  - LayoutAnimationsProxy_Experimental.cpp not found, skipping'
        );
        return;
    }

    let content = fs.readFileSync(PROXY_CPP_PATH, 'utf8');
    content = applyEdit(
        content,
        RESYNC_ANCHOR,
        RESYNC_REPLACEMENT,
        'resync fix (cancelled close wedge)'
    );
    content = applyEdit(
        content,
        POP_FALLBACK_ANCHOR,
        POP_FALLBACK_REPLACEMENT,
        'pop fallback (return transition race)'
    );
    fs.writeFileSync(PROXY_CPP_PATH, content);
}
