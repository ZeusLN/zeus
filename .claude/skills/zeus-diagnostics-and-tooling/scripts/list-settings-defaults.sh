#!/usr/bin/env bash
#
# list-settings-defaults.sh — print the inline defaults object of
# stores/SettingsStore.ts (the `@observable settings: Settings = { ... }`
# block) with real line numbers, for drift review.
#
# Usage:
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh          # whole block
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh privacy  # one line-match filter
#
# Why: these inline literals ARE the defaults new users get. There is no
# schema versioning — changing a default here only affects FRESH installs;
# existing users need a MOD_KEY migration (see zeus-storage-and-migrations).
# Diff this output across commits to catch silent default drift.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILE=stores/SettingsStore.ts
FILTER="${1:-}"

# Locate the block by brace counting from the declaration line; do not
# hardcode line numbers — the file is >2000 lines and moves often.
OUT=$(awk '
    /@observable settings: Settings = \{/ { inblock = 1 }
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
