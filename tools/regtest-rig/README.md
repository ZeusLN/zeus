# tools/regtest-rig

A regtest device-test rig for Zeus on an Android emulator: bitcoind, three
lnd nodes, optional electrs, cdk-mintd (fakewallet) and nostr-rs-relay in
Docker, plus host helpers (stub Olympus Flow LSP, LNURL-withdraw server, NWC
client) and scripts that drive the app over Metro's CDP inspector.

The rig is regtest-only. Never point it, or a wallet it configures, at
mainnet, testnet with real value, or real funds. The macaroons, certs and
mint mnemonic it generates are throwaway test material.

Every script is bash with `set -euo pipefail` and has `--help`. Configuration
is one env file; all state for a rig lives in `state/<RIG_NAME>/`
(gitignored). Paths below are relative to `tools/regtest-rig/`.

## Prerequisites

- Docker with Compose v2 (`docker compose`). Docker Desktop on macOS works;
  published ports bind to 127.0.0.1.
- Android SDK with `platform-tools`, `emulator`, `cmdline-tools/latest`
  (for `avdmanager`) and the `system-images;android-35;google_apis;arm64-v8a`
  image. The image must be `google_apis` (not `google_apis_playstore`)
  because `bin/avd install-ca` needs `adb root`. On x86_64 hosts set
  `AVD_IMAGE` to the matching x86_64 image. The SDK is found through
  `ANDROID_HOME`, then `ANDROID_SDK_ROOT`, then
  `~/Library/Android/sdk` (the macOS Android Studio default).
- Node in the repo's `engines` range (`^22.13.0 || ^24.3.0 || >= 26.0.0`)
  and `yarn install` done in the checkout Metro serves. The host helpers load
  `ws`, `bech32` and `@getalby/sdk` from that checkout's `node_modules`.
- `jq`, `xxd`, `openssl`, `curl`, `lsof`.
- A Zeus debug APK (`android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk`
  after `cd android && ./gradlew assembleDebug`).

macOS notes: the scripts are written for macOS and its BSD userland.
`bin/shot` uses `sips` for the preview image (skipped if missing), and the
quickstart's `cp -cR` is an APFS clone. Nothing else depends on GNU-only
flags, but Linux is not tested.

## Relationship to the app code

`lib/prelude.js` and `bin/zeus` call into app internals over CDP: module
paths (`stores/Stores.ts`, `NavigationService.ts`, `utils/handleAnything.ts`,
`utils/LdkNodeUtils.ts`), the shape of their exports (Stores.ts exports store
instances; NavigationService and handleAnything are default exports), store
fields and methods (`settingsStore.updateSettings`, `nodeInfoStore.nodeInfo`,
`balanceStore`, `invoicesStore.createUnifiedInvoice`, `cashuStore.addMint`,
`createInvoice`, `checkInvoicePaid`, `nostrWalletConnectStore.createConnection`)
and settings keys (`nodes`, `selectedNode`, `enableLSP`, `lspMainnet`,
`lspTestnet`, `lspMutinynet`, `ecash`, `pos`, `invoices`). A PR that renames
or reshapes any of these should update the rig in the same PR.

## Layout

```
.env.example        every setting with its default (copy to .env)
env.sh              loads the env file, derives ports, exports everything
docker-compose.yml  bitcoind, alice, bob, carol; profiles ldk/cashu/nwc
templates/          cdk-mintd config template (port, fakewallet delay)
lib/common.sh       compose/lncli/btc wrappers, PID-file process helpers
lib/cdp.js          Metro CDP client (sync and async evaluation)
lib/prelude.js      in-app helper object globalThis.Z
lib/stub-lsp.js     stub Olympus Flow LSP
lib/lnurlw.js       LNURL-withdraw server
lib/nwc.js          NWCClient from @getalby/sdk
bin/                up down ca avd app metro cdp zeus lsp lnurlw nwc
                    pay mine decode ln shot teardown
state/<RIG_NAME>/   tls/ macaroons/ pubkeys.json urls.json nwc/ logs/
                    run/ (PID files) screenshots/
```

## Defaults

`ZEUS_DIR` (the checkout Metro serves) defaults to the checkout the rig lives
in. Set it in the env file, or use `bin/metro start --dir PATH`, to serve a
different worktree.

Ports are `PORT_BASE + offset` (PORT_BASE=24600), all bound to 127.0.0.1:

| what | port | | what | port |
|---|---|---|---|---|
| bitcoind RPC | 24601 | | electrs HTTP (esplora) | 24640 |
| bitcoind p2p | 24602 | | electrum RPC | 24641 |
| alice REST/gRPC/p2p | 24610/24611/24612 | | mint | 24650 |
| bob REST/gRPC/p2p | 24620/24621/24622 | | relay | 24660 |
| carol REST/gRPC/p2p | 24630/24631/24632 | | stub LSP | 24670 |
| Metro | 24690 | | LNURL server | 24680 |

Android: private adb server on 5137, emulator console 5640 (serial
`emulator-5640`), AVD `zrig` from
`system-images;android-35;google_apis;arm64-v8a`. These avoid the usual
Polar, Metro (8081) and adb (5037, 5554-5585) ports. Check
`lsof -iTCP -sTCP:LISTEN` and `docker ps` before the first run and change
`PORT_BASE` if anything collides.

## Quickstart: Android device test of a Zeus PR

1. Worktree and dependencies:
   ```
   git -C <zeus checkout> fetch upstream pull/NNNN/head
   git -C <zeus checkout> worktree add --detach <zeus checkout>/.claude/worktrees/pr-NNNN FETCH_HEAD
   cd <zeus checkout>/.claude/worktrees/pr-NNNN && yarn install
   ```
   Any path works for the worktree; `.claude/worktrees/` is gitignored. If
   the worktree's `yarn.lock` matches another checkout's, an APFS clone of
   that `node_modules` is near-instant and costs no disk:
   `cp -cR <other checkout>/node_modules ./node_modules`.
2. Native build or APK reuse. If the PR does not touch `android ios
   package.json yarn.lock zeus_modules patches`, reuse an existing debug APK
   whose commit has the same native inputs:
   ```
   git diff --stat <apk-commit> <pr-head> -- android ios package.json yarn.lock zeus_modules patches
   ```
   Empty output means the APK's native side matches and Metro can serve the
   PR's JS. Otherwise build (`cd android && ./gradlew assembleDebug`, about
   6 minutes, needs well over 15 GB free disk).
3. Configure the rig:
   ```
   cd <pr worktree>/tools/regtest-rig
   cp .env.example .env     # set APK and PROFILES; ZEUS_DIR defaults to this checkout
   ```
4. Bring it up:
   ```
   bin/up --profiles all        # or lsp / cashu / nwc / ldk as needed
   bin/avd create && bin/avd boot && bin/avd install-ca
   bin/app setup                # install APK, debug_http_host, adb reverse
   bin/metro start
   bin/app restart              # waits until CDP answers
   ```
5. Connect a wallet and run the test:
   ```
   bin/zeus add-lnd alice --select     # REST, certVerification true
   bin/zeus status
   bin/cdp --async 'await Z.S().invoicesStore.createUnifiedInvoice({memo:"t",value:"1500",expirySeconds:"3600",noLsp:true}); return Z.S().invoicesStore.payment_request'
   bin/pay <bolt11>                    # bob pays
   bin/shot case1
   ```
6. Clean up: `bin/teardown`.

If the PR predates `tools/regtest-rig`, run the rig from a checkout that has
it and point `ZEUS_DIR` (or `bin/metro start --dir`) at the PR worktree.

## Profiles

| profile | containers / processes | used for |
|---|---|---|
| (base) | bitcoind, lnd alice, bob, carol; bob opens 10M-sat channels to alice and carol, pushing 4M | LND REST wallets, payments |
| `lsp` | host process lib/stub-lsp.js (started by `bin/up`) | Flow LSP fee quotes and JIT invoices |
| `cashu` | cdk-mintd 0.18.1 fakewallet | mint quotes, ecash |
| `nwc` | nostr-rs-relay | Nostr Wallet Connect |
| `ldk` | mempool/electrs (esplora API) | LDK Node regtest wallets |

`--profiles all` enables all four. alice, bob and carol all run with
`--protocol.option-scid-alias --protocol.zero-conf`, so Zeus's
`flowLspNotConfigured()` passes for alice.

## Script reference (short)

- `bin/up`, `bin/down`: stack lifecycle; `up` is idempotent.
- `bin/ca [--force]`: CA plus alice/bob/carol certs with SANs localhost,
  127.0.0.1, ::1, 10.0.2.2.
- `bin/avd create|boot|install-ca|stop|delete|adb-kill|status`.
- `bin/app install|prefs|reverse|setup|launch|terminate|restart [--node]|wait|clear|logcat|uninstall`.
- `bin/metro start [--dir PATH] [--reset-cache]|stop|status|log|check <symbol>`.
- `bin/cdp '<expr>'`, `bin/cdp --async '<body>'`, `bin/cdp -f file.js`.
  In-app helpers (lib/prelude.js): `Z.S()` stores, `Z.nav()`, `Z.go()`,
  `Z.home()`, `Z.mod('path/file.ts')`, `Z.settings({...})`, `Z.status()`,
  `Z.nodes()`, `Z.route()`, `Z.screenText()`, `Z.hasText()`, `Z.press(label)`,
  `Z.inst('Receive')`, `Z.walk(fn)`, `Z.wrap(obj,'method','tag')` with
  `Z.log(clear)`, `Z.captureConsole()`, `Z.logbox()`, `Z.handle(input)`.
- `bin/zeus status|nodes|add-lnd|select|lsp on|off|ldk-create|mint-add|mint-quote|pos|invoices|set|restart`.
- `bin/lsp start|stop|status|fee <msat>|none [--queue]|log`.
- `bin/lnurlw start|stop|make <id> [--hold] [--delay MS] [--pay] [--min] [--max]|release <id>|log`.
  Feed a string to the app with `bin/cdp --async "return await Z.handle('LNURL1...')"`.
- `bin/nwc create <name> [budget]|info|balance|make <name> <sats>|pay <name> <bolt11>|lookup|list`.
- `bin/pay <bolt11> [--from node] [--amt sats] [--async]`, `bin/mine [N]`,
  `bin/decode <bolt11>`, `bin/ln <alice|bob|carol|btc> args...`.
- `bin/shot <name>`: PNG plus a 1000 px preview `screenshots/view.png`.
- `bin/teardown [--keep-avd] [--keep-state]`.

## Master baseline on the same native build

To compare a PR against master without a second native build:

1. Keep the emulator, APK and stack. `bin/app terminate` first: with Fast
   Refresh, a live app hot-loads whatever Metro serves.
2. `bin/metro stop && bin/metro start --dir <master checkout>`, where
   `<master checkout>` is any worktree you pick at upstream/master
   (`git -C <zeus checkout> worktree add --detach <path> upstream/master`,
   then `yarn install` or an APFS clone of a matching `node_modules`).
3. Prove which code is served: `bin/metro check '<string only the PR adds>'`
   must print 0 for master and more than 0 for the PR checkout.
4. `bin/app restart --node` and repeat the case. Switch back the same way.
   Module IDs can change between checkouts; `Z.mod()` looks modules up by
   path, so helpers keep working.

## Several rigs side by side

Each rig needs its own `RIG_NAME`, `PORT_BASE`, `AVD_NAME`,
`ADB_SERVER_PORT` and `EMU_PORT`:

```
cat > rig2.env <<EOF
RIG_NAME=zrig2
PORT_BASE=24700
AVD_NAME=zrig2
ADB_SERVER_PORT=5138
EMU_PORT=5642
ZEUS_DIR=/path/to/other/worktree
EOF
RIG_ENV=$PWD/rig2.env bin/up
```

Compose projects, containers, volumes, state directories, PID files and adb
servers are all keyed on those values, so `bin/teardown` of one rig never
touches the other or any container it did not start (Polar or other
stacks). This is supported by the naming but has not been run (see
Verified).

## Traps

- **Other emulators.** Other tools and sessions on the same machine can
  install builds onto any emulator the default adb server sees. The rig
  boots its own AVD with `ANDROID_ADB_SERVER_PORT` set and addresses it as
  `ANDROID_SERIAL=emulator-<EMU_PORT>`.
- **adb port scanning.** An adb server scans 5555-5585 for emulators. The
  rig sets `ADB_LOCAL_TRANSPORT_MAX_PORT=5554` so its private server does not
  scan that range and attach to other emulators. Keep `EMU_PORT` above 5585
  so the default adb server on 5037 does not find the rig's emulator either.
- **adb kill drops reverse rules.** Killing or restarting an adb server
  drops `adb reverse` rules; `bin/app restart` (or `bin/app reverse`)
  re-applies them.
- **Metro port.** Another process often owns host 8081. Metro runs on
  `METRO_PORT`; `adb reverse tcp:8081 tcp:<METRO_PORT>` plus
  `debug_http_host=localhost:8081` in
  `shared_prefs/app.zeusln.zeus_preferences.xml` (written with run-as,
  copied through /data/local/tmp with chmod 644) pin the app to it. The
  debug build's default `10.0.2.2:8081` would load another Metro's bundle.
  `pm clear` wipes the pref; `bin/app clear` rewrites it.
- **CDP.** Use the `ws` package from the checkout with an `origin` header;
  Node's built-in WebSocket gets HTTP 401. Hermes has `globalThis`, not
  `global`. `Runtime.evaluate` with awaitPromise does not await RN's promise
  polyfill, so `bin/cdp --async` stores the result in a global and polls.
  Start store work from a setTimeout (the async mode does this): a
  debugger-attached microtask drain has crashed Hermes. `stores/Stores.ts`
  exports store instances directly; NavigationService and LogBox need
  `.default`. Hermes `String(fn)` is bytecode, so match fibers by rendered
  text. Android dev bundle URL:
  `index.bundle?platform=android&dev=true&minify=false`.
- **lncli in the polarlightning image.** The entrypoint only drops to the
  lnd user for a bare `lnd` command, and an explicit `--lnddir` makes both
  lnd and lncli ignore `--tlscertpath`. The compose file runs `gosu lnd lnd`
  without `--lnddir`, and the scripts call lncli with `--tlscertpath` and
  `--macaroonpath`.
- **New lnd identities after down/up.** `bin/down` removes the volumes, so
  after `bin/down` + `bin/up` the lnd nodes have new pubkeys and macaroons.
  Rerun `bin/zeus add-lnd alice --select` (it replaces the old entry).
- **Flow LSP.** `flowLspNotConfigured()` needs `certVerification: true` and
  zero-conf plus scid-alias feature bits. So alice's REST cert is signed by
  the rig CA and `bin/avd install-ca` installs the CA as a user CA (Zeus's
  `network_security_config` trusts user CAs; installing needs `adb root`,
  hence a google_apis image). Regtest falls through to the mainnet LSP
  config, so `bin/zeus lsp on` sets lspMainnet, lspTestnet and lspMutinynet
  to the stub. Restart the app after changing LSP settings.
- **LNURL-withdraw.** `http://localhost:<LNURL_PORT>` through adb reverse
  works because the withdraw path does not apply the LNURL host policy
  (LnurlPay does). Use bech32 `LNURL1...` strings (`bin/lnurlw make`).
- **NWC.** Zeus rate-limits make_invoice to 5 per minute per connection.
  nostr-rs-relay allows 32 subscriptions per socket. The app sees the relay
  as `ws://localhost:<RELAY_PORT>`; lib/nwc.js rewrites that to 127.0.0.1
  on the host.
- **LDK Node regtest.** Esplora is the rig electrs. VSS points at
  `http://127.0.0.1:1` with `failOnVssError: false` so nothing reaches
  production VSS (wallet creation reports a `vssError`, which is expected).
  No RGS on regtest. LDK rejects inbound channels without on-chain funds
  (anchor reserve); fund it and open outbound to bob at
  `10.0.2.2:<BOB_P2P_PORT>`.
- **cdk-mintd 0.18** keeps its config in its database. The container runs
  `config init` once and `config apply` on every start, so editing
  `MINT_MIN_DELAY`/`MINT_MAX_DELAY` and rerunning `bin/up` changes when
  fakewallet quotes turn PAID. `cashuStore.checkInvoicePaid()` returns an
  object even when unpaid; test `.isPaid`.
- **bitcoind funding.** bob gets several UTXOs so it can open both channels
  in one block without waiting for change to confirm.
- **Shells.** zsh does not word-split `$var` (use `${=var}`), so
  `A="adb -s ..."; $A devices` fails there. The scripts are bash; call them,
  don't paste their bodies into zsh.
- **Background processes.** Scripts start Metro, the emulator, the stub LSP
  and the LNURL server with nohup, a PID file in `state/<RIG>/run/` and a
  log in `state/<RIG>/logs/`; stop them with the matching script or
  `bin/teardown`. When driving the rig from an agent tool such as Claude
  Code, do not append `&` to commands; use the tool's background option.

## iOS notes (not verified with this rig)

These come from earlier iOS test setups and were not exercised with this
rig.

- The paste prompt ("ZEUS would like to paste from ...") blocks the JS thread
  at startup, so CDP evals time out. With the simulator shut down, insert a
  TCC grant and boot it:
  `sqlite3 <sim>/data/Library/TCC/TCC.db "insert or replace into access (service,client,client_type,auth_value,auth_reason,auth_version,flags) values ('kTCCServicePasteboard','com.zeusln.zeus',0,2,4,1,0)"`.
  Uninstalling the app drops the entry.
- Metro on a non-default port: `xcrun simctl spawn <udid> defaults write com.zeusln.zeus RCT_jsLocation localhost:<METRO_PORT>`; delete the key afterwards.
- Trust lnd certs: `xcrun simctl keychain <udid> add-root-cert state/<RIG>/tls/ca.crt`
  (the rig CA covers alice, bob and carol), then use `https://localhost:<port>`.
- With two debug targets, filter Metro's `/json/list` by `deviceName`
  (lib/cdp.js currently picks the last Zeus target).
- The notification prompt keeps the app `inactive`; a Metro `resolveRequest`
  shim for react-native-notifications avoids it.

## Verified

2026-10-25 on macOS (Apple Silicon), Docker Desktop, Android emulator
37.2.12 with an API 35 `google_apis` arm64 AVD, Metro 0.87.1, a debug APK
whose native inputs matched upstream/master 5ebf3678d, and Metro serving
upstream/master.

Passed:

- Stack: `bin/up` from nothing, `bin/down`, `bin/up` again (all profiles)
  in about 12 s; a second `bin/up` on the running stack changed nothing. bob
  had two active 10M-sat channels. alice's REST cert verified against the
  rig CA, and getinfo showed feature bits 47 (scid-alias) and 51
  (zero-conf).
- Host helpers: the stub LSP returned queued fee quotes in order and a bob
  hold invoice for `/api/v1/proposal`; the LNURL server's `--pay` callback
  made bob pay, and a held response was released by `/release/<id>`.
- AVD isolation: create, boot and install-ca on the private adb server;
  another emulator on the machine stayed invisible to the rig's adb.
- App over CDP: an LND REST wallet (alice, certVerification true); a
  1500-sat invoice paid by bob and shown as received in Activity; a Flow LSP
  JIT invoice from the stub with the queued 3000-sat fee; NWC create, info,
  make_invoice and pay_invoice from the host; an LDK Node regtest wallet
  created and started; the rig mint added and a 500-sat mint quote paid.
- Teardown: no rig processes, containers, volumes, listening ports or AVD
  left; the other emulator kept running.

Not verified: the iOS section, two rigs running side by side, completing an
LNURL-withdraw inside the app (`Z.handle()` reached the withdraw screen; the
withdraw was not submitted), and a native Gradle build with the rig (an
existing APK was reused).
