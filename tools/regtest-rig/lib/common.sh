# shellcheck shell=bash
# Shared helpers for bin/*. Source after env.sh.

die() { echo "error: $*" >&2; exit 1; }
log() { echo "[$RIG_NAME] $*" >&2; }

# usage_if_help "$@" : print the script's header comment block on -h/--help
usage_if_help() {
    for a in "$@"; do
        if [ "$a" = "-h" ] || [ "$a" = "--help" ] || [ "$a" = "help" ]; then
            sed -n '2,/^[^#]/{/^#/!d;s/^# \{0,1\}//;p;}' "$0"
            exit 0
        fi
    done
}

compose() {
    docker compose -p "$RIG_NAME" -f "$RIG_DIR/docker-compose.yml" "$@"
}

# Compose --profile flags for the PROFILES list (lsp has no container).
profile_flags() {
    local list="${1:-$PROFILES}" out=""
    [ "$list" = all ] && list="lsp,cashu,nwc,ldk"
    local IFS=','
    for prof in $list; do
        [ -n "$prof" ] && out="$out --profile $prof"
    done
    echo "$out"
}

has_profile() {
    local list="${PROFILES}"
    [ "$list" = all ] && return 0
    case ",$list," in *",$1,"*) return 0 ;; esac
    return 1
}

container() { echo "$RIG_NAME-$1-1"; }

lncli() {
    local node="$1"; shift
    docker exec "$(container "$node")" lncli --network=regtest --tlscertpath=/tls/tls.cert --macaroonpath=/home/lnd/.lnd/data/chain/bitcoin/regtest/admin.macaroon "$@"
}

btc() {
    docker exec "$(container bitcoind)" bitcoin-cli -regtest -rpcuser=polaruser -rpcpassword=polarpass "$@"
}

# Start a long-running host process with a PID file and log.
# start_proc <name> <cmd...>
start_proc() {
    local name="$1"; shift
    local pidf="$STATE/run/$name.pid" logf="$STATE/logs/$name.log"
    if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
        log "$name already running (pid $(cat "$pidf"))"
        return 0
    fi
    nohup "$@" >>"$logf" 2>&1 </dev/null &
    echo $! >"$pidf"
    log "$name started (pid $!, log $logf)"
}

stop_proc() {
    local name="$1" pidf="$STATE/run/$1.pid"
    [ -f "$pidf" ] || return 0
    local pid; pid="$(cat "$pidf")"
    if kill -0 "$pid" 2>/dev/null; then
        # kill the process group children first (Metro spawns workers)
        pkill -TERM -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
        for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
        kill -KILL "$pid" 2>/dev/null || true
        log "$name stopped (pid $pid)"
    fi
    rm -f "$pidf"
}

proc_running() {
    local pidf="$STATE/run/$1.pid"
    [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null
}

# wait_until <seconds> <cmd...> : retry cmd every second until it succeeds
wait_until() {
    local t="$1"; shift
    local i=0
    until "$@" >/dev/null 2>&1; do
        i=$((i + 1))
        [ "$i" -ge "$t" ] && return 1
        sleep 1
    done
}

adb_() { "$ADB" -s "$ANDROID_SERIAL" "$@"; }
