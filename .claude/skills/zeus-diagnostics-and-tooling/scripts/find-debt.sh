#!/usr/bin/env bash
#
# find-debt.sh — list TODO/FIXME/HACK/XXX debt markers in HAND-WRITTEN Zeus code.
#
# Usage:
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh            # all markers
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh TODO      # one marker only
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh --summary # per-file counts only
#
# Excludes generated/vendored code (uniffi bindings, protobuf output,
# zeus_modules). node_modules/ios Pods/android build are gitignored and
# skipped automatically because this uses `git grep`.
#
# Known false positive: utils/AddressUtils.test.ts contains "XXX" inside a
# base64 test fixture, not a debt marker. The -w (whole-word) match below
# already filters it out; if you loosen the pattern, expect it to reappear.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SUMMARY=0
PATTERN='TODO|FIXME|HACK|XXX'
for arg in "$@"; do
    case "$arg" in
        --summary) SUMMARY=1 ;;
        *) PATTERN="$arg" ;;
    esac
done

# Generated or vendored files that are full of upstream TODOs we don't own:
EXCLUDES=(
    ':(exclude)zeus_modules'
    ':(exclude)proto/lightning.js'
    ':(exclude)proto/lightning.d.ts'
    ':(exclude)ios/LdkNodeMobile/LDKNode.swift'
    ':(exclude)android/app/src/main/java/org/lightningdevkit/ldknode/ldk_node.kt'
    ':(exclude)android/app/src/main/java/uniffi/zeus_cashu_restore/zeus_cashu_restore.kt'
    ':(exclude)ios/CashuDevKit/CashuDevKit.swift'
    ':(exclude)ios/CashuDevKit/zeus_cashu_restore.swift'
    ':(exclude)*.lock'
    ':(exclude)*.svg'
    ':(exclude)*.map'
)

# Note: -w (whole word) instead of \b — git grep's ERE on macOS does not
# support \b, and it fails silently (zero matches, exit 1).
if [ "$SUMMARY" -eq 1 ]; then
    git grep -nIwE "${PATTERN}" -- . "${EXCLUDES[@]}" \
        | cut -d: -f1 | sort | uniq -c | sort -rn
    echo '---'
    TOTAL=$(git grep -nIwE "${PATTERN}" -- . "${EXCLUDES[@]}" | wc -l | tr -d ' ')
    echo "total markers: $TOTAL"
else
    git grep -nIwE "${PATTERN}" -- . "${EXCLUDES[@]}" \
        | sort -t: -k1,1 -k2,2n
fi
