#!/usr/bin/env bash
#
# list-settings-defaults.sh — print the inline defaults object of
# stores/SettingsStore.ts (the module-level
# `export const DEFAULT_SETTINGS: Settings = { ... }` block, since #4788)
# with real line numbers, for drift review.
#
# Usage:
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh          # whole block
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh privacy  # one line-match filter
#
# Why: these inline literals ARE the defaults new users get. Changing a
# default here only affects FRESH installs (and, via
# applyMissingSettingsGroups, existing blobs that lack a whole group);
# existing users need a settings migration (see zeus-storage-and-migrations).
# Diff this output across commits to catch silent default drift.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILE=stores/SettingsStore.ts
FILTER="${1:-}"

# Locate the block by brace counting from the declaration line; do not
# hardcode line numbers — the file is >2000 lines and moves often.
OUT=$(awk '
    /^export const DEFAULT_SETTINGS: Settings = \{/ { inblock = 1 }
    inblock {
        printf "%d\t%s\n", NR, $0
        n = gsub(/\{/, "{")
        m = gsub(/\}/, "}")
        depth += n - m
        if (started && depth == 0) exit
        if (n > 0) started = 1
    }
' "$FILE")

if [ -z "$OUT" ]; then
    echo "defaults block not found in $FILE — the declaration pattern changed; update this script" >&2
    exit 1
fi

if [ -n "$FILTER" ]; then
    printf '%s\n' "$OUT" | grep -iE "$FILTER"
else
    printf '%s\n' "$OUT"
fi
