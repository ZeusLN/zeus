// Two behavioral fixes to react-native-reanimated's experimental shared
// element transition proxy (LayoutAnimationsProxy_Experimental.cpp), applied
// as source patches. Both were root-caused on-device in ZEUS; neither is
// fixed upstream as of 4.7.0-nightly-20260901 (re-checked 2026-09-02).
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
//
// Each fix carries one anchor per upstream source layout, because reanimated
// 4.7.0 refactored the proxy to one instance per surface:
//   4.6.x and earlier: `topScreen[surfaceId]`, `surfaceId` parameter,
//                      `filteredMutations` passed to updateLightTree()
//   4.7.x and later:   `topScreen_`, `surfaceId_` member, `TransactionMeta`
// The member names the edits rely on (lightNodes_, closingScreenTag_,
// findActiveBoundary, findBoundaryGuess, LightNode::parent/children) are
// unchanged across both layouts. If no anchor matches, this patch fails the
// install rather than warning: an unapplied edit reintroduces two silent
// SET failures that no test or log would surface.

import fs from 'fs';

const PROXY_CPP_PATH =
    './node_modules/react-native-reanimated/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy_Experimental.cpp';

const POP_FALLBACK_COMMENT = `    // ZEUS PATCH (see patches/patch-reanimated-set-fixes.mjs):
    // When the screen holding the previous top boundary is removed (pop),
    // the revealed screen's boundary may not have received \`isActive=true\`
    // yet — react-navigation's focus update can land a commit after the one
    // containing the removal, so return transitions would silently race.
    // In that case fall back to the topmost mounted boundary.`;

const RESYNC_COMMENT = `    // ZEUS PATCH (see patches/patch-reanimated-set-fixes.mjs):
    // Only keep waiting while the closing screen is actually mid-removal
    // (tracked but detached from its parent). A cancelled interactive pop
    // emits a closing event for a screen that never unmounts; waiting for
    // it would block resynchronization forever and permanently disable
    // shared element transitions.`;

const RESYNC_GUARD = `    bool waitingForRemoval = false;
    const auto closingIt = lightNodes_.find(closingScreenTag_);
    if (closingIt != lightNodes_.end()) {
      const auto &closingNode = closingIt->second;
      const auto closingParent = closingNode->parent.lock();
      const bool attached = closingParent &&
          std::find(closingParent->children.begin(), closingParent->children.end(), closingNode) !=
              closingParent->children.end();
      waitingForRemoval = !attached;
    }`;

const POP_FALLBACK_EDITS = [
    {
        layout: '4.6.x',
        anchor: `    auto afterTopScreen = findActiveBoundary(root);
    topScreen[surfaceId] = afterTopScreen;`,
        replacement: `    auto afterTopScreen = findActiveBoundary(root);
${POP_FALLBACK_COMMENT}
    if (!afterTopScreen && beforeTopScreen && !lightNodes_.contains(beforeTopScreen->current.tag)) {
      afterTopScreen = findBoundaryGuess(root);
    }
    topScreen[surfaceId] = afterTopScreen;`
    },
    {
        layout: '4.7.x',
        anchor: `    auto afterTopScreen = findActiveBoundary(root);
    topScreen_ = afterTopScreen;`,
        replacement: `    auto afterTopScreen = findActiveBoundary(root);
${POP_FALLBACK_COMMENT}
    if (!afterTopScreen && beforeTopScreen && !lightNodes_.contains(beforeTopScreen->current.tag)) {
      afterTopScreen = findBoundaryGuess(root);
    }
    topScreen_ = afterTopScreen;`
    }
];

const RESYNC_EDITS = [
    {
        layout: '4.6.x',
        anchor: `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, filteredMutations);
    if (!lightNodes_.contains(closingScreenTag_)) {
      topScreen[surfaceId] = findActiveBoundary(lightNodes_[surfaceId]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`,
        replacement: `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, filteredMutations);
${RESYNC_COMMENT}
${RESYNC_GUARD}
    if (!waitingForRemoval) {
      topScreen[surfaceId] = findActiveBoundary(lightNodes_[surfaceId]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`
    },
    {
        layout: '4.7.x',
        anchor: `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, transaction);
    if (!lightNodes_.contains(closingScreenTag_)) {
      topScreen_ = findActiveBoundary(lightNodes_[surfaceId_]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`,
        replacement: `  } else if (!synchronized_) {
    updateLightTree(propsParserContext, mutations, transaction);
${RESYNC_COMMENT}
${RESYNC_GUARD}
    if (!waitingForRemoval) {
      topScreen_ = findActiveBoundary(lightNodes_[surfaceId_]);
      synchronized_ = true;
      closingScreenTag_ = -1;
    }
  } else if (!mutations.empty()) {`
    }
];

function applyEdit(content, edits, label) {
    const applied = edits.find((edit) => content.includes(edit.replacement));
    if (applied) {
        console.log(
            `  - ${label}: already applied (${applied.layout}), skipping`
        );
        return content;
    }

    const match = edits.find((edit) => content.includes(edit.anchor));
    if (!match) {
        console.warn(`  - ${label}: no anchor matched`);
        return null;
    }

    console.log(`  - ${label}: applied (${match.layout})`);
    return content.replace(match.anchor, match.replacement);
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
    const failed = [];

    for (const [edits, label] of [
        [RESYNC_EDITS, 'resync fix (cancelled close wedge)'],
        [POP_FALLBACK_EDITS, 'pop fallback (return transition race)']
    ]) {
        const next = applyEdit(content, edits, label);
        if (next === null) {
            failed.push(label);
            continue;
        }
        content = next;
    }

    if (failed.length && process.env.ZEUS_ALLOW_UNPATCHED_REANIMATED === '1') {
        console.warn(
            `  - WARNING: ${failed.join(
                ', '
            )} NOT applied (ZEUS_ALLOW_UNPATCHED_REANIMATED=1). ` +
                'Shared element transitions will be broken; see ZeusLN/zeus#4222.'
        );
    } else if (failed.length) {
        throw new Error(
            `react-native-reanimated shared element transition fixes could not be applied: ${failed.join(
                ', '
            )}.\n` +
                'The proxy source changed shape, so the anchors in ' +
                'patches/patch-reanimated-set-fixes.mjs need to be updated for this ' +
                'reanimated version. Leaving them unapplied silently breaks shared ' +
                'element transitions (ZeusLN/zeus#4222); check whether ' +
                'software-mansion/react-native-reanimated#9944 and #9945 shipped first, ' +
                'and drop the corresponding edit if so.\n' +
                'To install anyway (transitions will be broken), set ' +
                'ZEUS_ALLOW_UNPATCHED_REANIMATED=1.'
        );
    }

    fs.writeFileSync(PROXY_CPP_PATH, content);
}
