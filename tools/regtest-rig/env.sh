# shellcheck shell=bash
# Source this from bash scripts (bin/* do it for you). It loads the rig env
# file and exports every derived setting. Pick the file with RIG_ENV;
# without it, $RIG_DIR/.env is used when present, else the defaults below.

RIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RIG_DIR

if [ -n "${RIG_ENV:-}" ]; then
    [ -f "$RIG_ENV" ] || { echo "RIG_ENV=$RIG_ENV not found" >&2; exit 1; }
    set -a; . "$RIG_ENV"; set +a
elif [ -f "$RIG_DIR/.env" ]; then
    set -a; . "$RIG_DIR/.env"; set +a
fi

: "${RIG_NAME:=zrig}"
: "${PORT_BASE:=24600}"
p() { echo $((PORT_BASE + $1)); }
: "${BTC_RPC_PORT:=$(p 1)}"
: "${BTC_P2P_PORT:=$(p 2)}"
: "${ALICE_REST_PORT:=$(p 10)}"
: "${ALICE_GRPC_PORT:=$(p 11)}"
: "${ALICE_P2P_PORT:=$(p 12)}"
: "${BOB_REST_PORT:=$(p 20)}"
: "${BOB_GRPC_PORT:=$(p 21)}"
: "${BOB_P2P_PORT:=$(p 22)}"
: "${CAROL_REST_PORT:=$(p 30)}"
: "${CAROL_GRPC_PORT:=$(p 31)}"
: "${CAROL_P2P_PORT:=$(p 32)}"
: "${ESPLORA_PORT:=$(p 40)}"
: "${ELECTRUM_PORT:=$(p 41)}"
: "${MINT_PORT:=$(p 50)}"
: "${RELAY_PORT:=$(p 60)}"
: "${LSP_PORT:=$(p 70)}"
: "${LNURL_PORT:=$(p 80)}"
: "${METRO_PORT:=$(p 90)}"
unset -f p
: "${MINT_MIN_DELAY:=1}"
: "${MINT_MAX_DELAY:=3}"
: "${ADB_SERVER_PORT:=5137}"
: "${EMU_PORT:=5640}"
: "${AVD_NAME:=zrig}"
: "${AVD_IMAGE:=system-images;android-35;google_apis;arm64-v8a}"
: "${AVD_DEVICE:=pixel_7}"
# Default: the Zeus checkout this rig lives in (tools/regtest-rig/../..).
: "${ZEUS_DIR:=$(cd "$RIG_DIR/../.." && pwd)}"
: "${APK:=}"
: "${PROFILES:=}"
# Android SDK: ANDROID_HOME, else ANDROID_SDK_ROOT, else the Android Studio
# default on macOS.
: "${ANDROID_HOME:=${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"

# RIG_STATE overrides the state directory (rig.test.js uses a temp dir)
STATE="${RIG_STATE:-$RIG_DIR/state/$RIG_NAME}"
mkdir -p "$STATE/logs" "$STATE/run"

ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
# Private adb server and fixed serial: adb/emulator read these from the env.
ANDROID_ADB_SERVER_PORT="$ADB_SERVER_PORT"
ANDROID_SERIAL="emulator-$EMU_PORT"
# Stop the private adb server from scanning 5555-5585 for emulators, which
# would attach it to other sessions' emulators. Our emulator registers
# itself with this server (it boots with ANDROID_ADB_SERVER_PORT set).
# Keep EMU_PORT above 5585 so the default adb server on 5037 does not find
# ours either.
ADB_LOCAL_TRANSPORT_MAX_PORT=5554
APP_ID=app.zeusln.zeus

export RIG_NAME PORT_BASE BTC_RPC_PORT BTC_P2P_PORT \
    ALICE_REST_PORT ALICE_GRPC_PORT ALICE_P2P_PORT \
    BOB_REST_PORT BOB_GRPC_PORT BOB_P2P_PORT \
    CAROL_REST_PORT CAROL_GRPC_PORT CAROL_P2P_PORT \
    ESPLORA_PORT ELECTRUM_PORT MINT_PORT RELAY_PORT LSP_PORT LNURL_PORT \
    METRO_PORT MINT_MIN_DELAY MINT_MAX_DELAY ADB_SERVER_PORT EMU_PORT \
    AVD_NAME AVD_IMAGE AVD_DEVICE ZEUS_DIR APK PROFILES ANDROID_HOME \
    STATE ADB EMULATOR AVDMANAGER ANDROID_ADB_SERVER_PORT ANDROID_SERIAL APP_ID \
    ADB_LOCAL_TRANSPORT_MAX_PORT

# Checkout Metro is serving (bin/metro start --dir), else ZEUS_DIR.
METRO_DIR="$(cat "$STATE/metro.dir" 2>/dev/null || echo "$ZEUS_DIR")"
export METRO_DIR

# Ports the app reaches as localhost:<port> through adb reverse.
APP_PORTS="$ALICE_REST_PORT $BOB_REST_PORT $CAROL_REST_PORT $ESPLORA_PORT $MINT_PORT $RELAY_PORT $LSP_PORT $LNURL_PORT"
export APP_PORTS
