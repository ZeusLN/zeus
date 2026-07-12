#!/usr/bin/env bash
#
# capability-matrix.sh — print the supports* capability matrix across all 7
# Zeus backends, extracted live from backends/*.ts (never trust a stale doc).
#
# Usage:
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/capability-matrix.sh
#   .claude/skills/zeus-diagnostics-and-tooling/scripts/capability-matrix.sh supportsOffers   # single flag
#
# Cell legend:
#   T      -> () => true
#   F      -> () => false
#   expr   -> computed (usually version-gated: this.supports('vX.Y.Z'))
#   ^T/^F/^expr -> NOT declared in this class; inherited from LND.ts
#                  (EmbeddedLND and LndHub extend LND)
#   -      -> not declared anywhere: BackendUtils.call() returns literal
#             false (sync) for this backend
#
# Composite flags that live in utils/BackendUtils.ts, NOT in backend classes
# (this script does not show them):
#   supportsDevTools        = isLNDBased() || call('supportsDevTools')
#   supportsLightningAddress = supportsCustomPreimages() || supportsCashuWallet()
#   supportsForwardingHistoryChannelFilter = isLNDBased() && version >= v0.20.0

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

FILTER="${1:-}"

# Column order: LND family first (LND, EmbeddedLND), then the rest
FILES=(
    backends/LND.ts
    backends/EmbeddedLND.ts
    backends/LightningNodeConnect.ts
    backends/LdkNode.ts
    backends/CLNRest.ts
    backends/LndHub.ts
    backends/NostrWalletConnect.ts
)
LABELS=(LND eLND LNC LDK CLN Hub NWC)
# Which columns inherit from LND.ts when a flag is not declared locally:
INHERITS=(0 1 0 0 0 1 0)

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Extract "file flag value" triples. Also capture isLNDBased for context.
for f in "${FILES[@]}"; do
    grep -nE '^\s*(supports[A-Za-z0-9_]+|supportInboundFees|isLNDBased)\s*=' "$f" \
    | awk -v file="$f" '
        {
            line = $0
            sub(/^[0-9]+:/, "", line)
            # flag name
            match(line, /(supports[A-Za-z0-9_]+|supportInboundFees|isLNDBased)/)
            flag = substr(line, RSTART, RLENGTH)
            # value
            if (line ~ /=>[[:space:]]*true;?([[:space:]]*\/\/.*)?$/)       val = "T"
            else if (line ~ /=>[[:space:]]*false;?([[:space:]]*\/\/.*)?$/) val = "F"
            else                                                           val = "expr"
            print file, flag, val
        }'
done > "$TMP"

# All flags, sorted (skip the bare "supports" version helper — the regex
# above already requires at least one char after "supports")
FLAGS=$(awk '{print $2}' "$TMP" | sort -u)
if [ -n "$FILTER" ]; then
    FLAGS=$(printf '%s\n' "$FLAGS" | grep -iE "$FILTER" || true)
    if [ -z "$FLAGS" ]; then
        echo "no flag matching '$FILTER'" >&2
        exit 1
    fi
fi

printf '%-42s' 'FLAG'
for l in "${LABELS[@]}"; do printf '%-7s' "$l"; done
printf '\n'

for flag in $FLAGS; do
    printf '%-42s' "$flag"
    i=0
    for f in "${FILES[@]}"; do
        val=$(awk -v f="$f" -v fl="$flag" '$1==f && $2==fl {print $3; exit}' "$TMP")
        if [ -z "$val" ]; then
            if [ "${INHERITS[$i]}" -eq 1 ]; then
                inherited=$(awk -v fl="$flag" '$1=="backends/LND.ts" && $2==fl {print $3; exit}' "$TMP")
                if [ -n "$inherited" ]; then
                    val="^$inherited"
                else
                    val="-"
                fi
            else
                val="-"
            fi
        fi
        printf '%-7s' "$val"
        i=$((i + 1))
    done
    printf '\n'
done
