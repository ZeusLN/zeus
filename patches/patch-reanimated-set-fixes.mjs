// One behavioral fix to react-native-reanimated's shared element transition
// proxy (LayoutAnimationsProxy.cpp), applied as a source patch. It was
// root-caused on-device in ZEUS and is still unfixed upstream as of 4.7.0
// (re-checked 2026-09-21).
//
// Tracking: https://github.com/ZeusLN/zeus/issues/4222
// Remove once the upstream fix ships in a release.
//
// Deterministic SET on pop (primarily Android):
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
// A second edit used to live here, for the cancelled-close wedge that
// permanently disabled transitions on iOS
// (https://github.com/software-mansion/react-native-reanimated/issues/9945).
// That one shipped upstream in 4.7.0 via reanimated#10371, which removed
// `closingScreenTag_` and `synchronized_` altogether, so the edit is gone.
//
// If the anchor below stops matching, or the proxy source moves again, this
// patch fails the install rather than warning: an unapplied edit reintroduces
// a silent SET failure that no test or log would surface. 4.7.0 already
// renamed the file (LayoutAnimationsProxy_Experimental.cpp ->
// LayoutAnimationsProxy.cpp) and re-shaped the surrounding code
// (`topScreen[surfaceId]` -> `topScreen_`), so expect this on a bump.

import fs from 'fs';

const REANIMATED_PATH = './node_modules/react-native-reanimated';

const PROXY_CPP_PATH = `${REANIMATED_PATH}/Common/cpp/reanimated/LayoutAnimations/LayoutAnimationsProxy.cpp`;

const POP_FALLBACK_ANCHOR = `    auto afterTopScreen = findActiveBoundary(root);
    topScreen_ = afterTopScreen;`;

const POP_FALLBACK_REPLACEMENT = `    auto afterTopScreen = findActiveBoundary(root);
    // ZEUS PATCH (see patches/patch-reanimated-set-fixes.mjs):
    // When the screen holding the previous top boundary is removed (pop),
    // the revealed screen's boundary may not have received \`isActive=true\`
    // yet - react-navigation's focus update can land a commit after the one
    // containing the removal, so return transitions would silently race.
    // In that case fall back to the topmost mounted boundary.
    if (!afterTopScreen && beforeTopScreen && !lightNodes_.contains(beforeTopScreen->current.tag)) {
      afterTopScreen = findBoundaryGuess(root);
    }
    topScreen_ = afterTopScreen;`;

const LABEL = 'pop fallback (return transition race)';

function fail(reason) {
    if (process.env.ZEUS_ALLOW_UNPATCHED_REANIMATED === '1') {
        console.warn(
            `  - WARNING: ${LABEL} NOT applied (ZEUS_ALLOW_UNPATCHED_REANIMATED=1): ${reason}. ` +
                'Shared element transitions will be broken on pop; see ZeusLN/zeus#4222.'
        );
        return;
    }
    throw new Error(
        `react-native-reanimated shared element transition fix could not be applied: ${reason}.\n` +
            'The proxy source changed shape, so patches/patch-reanimated-set-fixes.mjs ' +
            'needs to be updated for this reanimated version. Leaving it unapplied ' +
            'silently breaks return transitions (ZeusLN/zeus#4222); check whether ' +
            'software-mansion/react-native-reanimated#9944 shipped first, and drop ' +
            'this patch if so.\n' +
            'To install anyway (transitions will be broken), set ' +
            'ZEUS_ALLOW_UNPATCHED_REANIMATED=1.'
    );
}

export function patchReanimatedSetFixes() {
    console.log(
        'Patching react-native-reanimated (shared element transition fix)'
    );

    if (!fs.existsSync(REANIMATED_PATH)) {
        console.log('  - react-native-reanimated not installed, skipping');
        return;
    }

    if (!fs.existsSync(PROXY_CPP_PATH)) {
        fail(`${PROXY_CPP_PATH} not found`);
        return;
    }

    const content = fs.readFileSync(PROXY_CPP_PATH, 'utf8');

    if (content.includes(POP_FALLBACK_REPLACEMENT)) {
        console.log(`  - ${LABEL}: already applied, skipping`);
        return;
    }

    if (!content.includes(POP_FALLBACK_ANCHOR)) {
        fail('anchor not found');
        return;
    }

    fs.writeFileSync(
        PROXY_CPP_PATH,
        content.replace(POP_FALLBACK_ANCHOR, POP_FALLBACK_REPLACEMENT)
    );
    console.log(`  - ${LABEL}: applied`);
}
