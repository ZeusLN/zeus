---
name: zeus-diagnostics-and-tooling
description: How to MEASURE Zeus instead of eyeballing it — find and tail logs (embedded LND lnd.log paths on Android/iOS, LDK Node ldk_node.log, adb logcat tags, Metro/Xcode consoles), use in-app diagnostics (Developer Tools view, Keychain Recovery scanner, log viewers), inspect network traffic (REST/WebSocket/Tor paths, TLS caveats), grep the codebase without generated-file noise, and run the shipped scripts (find-debt.sh, capability-matrix.sh, list-settings-defaults.sh). Load this when you need to answer "where are the logs?", "why is the node stuck syncing/connecting?", "which backend supports feature X?" (measured, not guessed), "how do I see the app's HTTP requests?", or when a grep is drowning in uniffi/protobuf bindings.
---

# Zeus Diagnostics and Tooling

Zeus is a React Native (RN) Bitcoin/Lightning wallet supporting 7 node
backends. This skill is the measurement toolbox: where every log lives, how
to read it, and runnable scripts that extract ground truth from the code
instead of from stale docs.

## When to use / When NOT to use

Use this skill when you need to:
- Find or tail node logs (embedded LND, LDK Node) on device, emulator, or in-app.
- Watch native-layer behavior via `adb logcat` / Xcode console.
- Inspect what the app sends over the network (REST, WebSocket, Tor).
- Query the live capability matrix, settings defaults, or debt markers.
- Interpret a log: is this node healthy, syncing, or wedged?

Use a sibling skill instead for:
- Symptom → root-cause triage flowcharts: **zeus-debugging-playbook** (this skill tells you how to observe; that one tells you what the observation means for known failure classes).
- What `yarn verify` runs and how to add tests: **zeus-validation-and-qa**.
- Backend quirks and the add-an-RPC recipe: **zeus-backends-and-capabilities** (this skill only ships the script that *prints* the matrix).
- Keychain/storage semantics and migration safety: **zeus-storage-and-migrations** (the Keychain Recovery tool is described here only as a diagnostic; never change storage behavior without that skill's gated process).
- Building the dev environment / running the app / connecting Polar nodes: **zeus-build-and-env** and **zeus-run-and-operate**.
- Formal race/dispatch analysis techniques: **zeus-proof-and-analysis-toolkit**.

## Vocabulary (defined once)

| Term | Meaning here |
|---|---|
| Backend / implementation | One of 7 node-connection strategies selected per wallet: `embedded-lnd`, `ldk-node`, `lnd` (remote REST), `lightning-node-connect` (LNC), `cln-rest`, `lndhub`, `nostr-wallet-connect` (NWC). Dispatch lives in `utils/BackendUtils.ts`. |
| Embedded LND | A full LND Lightning node compiled to a mobile library (gomobile) running *inside* the app process tree. |
| LDK Node | An alternative embedded node built on the Lightning Dev Kit, integrated via uniffi (Rust→Kotlin/Swift FFI bindings). |
| Neutrino | LND's light-client chain backend (BIP-157/158 compact block filters); embedded LND uses it instead of a full bitcoind. |
| Metro | React Native's JS bundler/dev server (`yarn start`). In dev, all JS `console.*` output appears in the Metro terminal. |
| logcat | Android's system log stream, read with `adb logcat`. Native (Java/Kotlin) `Log.d/i/e` calls land here, filtered by TAG. |
| uniffi bindings | Machine-generated Kotlin/Swift glue code for Rust libraries — huge files you must exclude from greps. |
| Tor | Anonymity network; Zeus routes REST calls through it per-node via `react-native-nitro-tor` (0.6.0 as of 2026-07-06). |

## 1) Log access per node type

### Summary table

| Node type | Node's own log | In-app viewer | Off-device access |
|---|---|---|---|
| embedded-lnd | `lnd.log` (paths below), `debuglevel=info` hardcoded | Settings → Embedded node → "LND Logs" (`views/Settings/EmbeddedNode/LNDLogs.tsx`, tail 100 + live follow, Copy button) | `adb shell run-as` (debug builds) / simulator container |
| ldk-node | `ldk_node.log` in the node dir, `LogLevel.DEBUG` hardcoded | Settings → Embedded node → "LDK Node Logs" (`views/Settings/EmbeddedNode/LDKLogs.tsx`) | same |
| lnd / cln-rest / lndhub (remote) | on the remote server, not the phone | — (use Developer Tools for RPC probes) | server-side (e.g. Polar, below) |
| lightning-node-connect | on the litd server | — | server-side |
| nostr-wallet-connect | remote wallet service | — | relay/service side |
| App itself (JS layer) | `console.*` | — | Metro terminal (dev), `ReactNativeJS` logcat tag (Android), Xcode console (iOS) |

### Embedded LND log file paths (verified in native code)

Android (`android/app/src/main/java/com/zeus/LndMobileTools.java`, `tailLog`/`observeLndLogFile`):

- Legacy first wallet (`lndDir == 'lnd'`): `<filesDir>/logs/bitcoin/<network>/lnd.log`
- Every other wallet (uuid dir): `<filesDir>/<lndDir>/logs/bitcoin/<network>/lnd.log`

where `<filesDir>` = `/data/user/0/app.zeusln.zeus/files` and `<network>` is
`mainnet` or `testnet`. Note the asymmetry: the legacy `'lnd'` wallet lives at
the files-dir *root*, not in a `lnd/` subfolder.

iOS (`ios/LndMobile/LndMobileTools.swift`, `tailLog`): always
`<Application Support>/<lndDir>/logs/bitcoin/<network>/lnd.log` — the `lndDir`
subfolder is used even for `'lnd'` (unlike Android).

`lndDir` per wallet: `stores/SettingsStore.ts` sets `this.lndDir =
node.lndDir || 'lnd'`; new wallets get `uuidv4()` dirs
(`views/Settings/WalletConfiguration.tsx`). To map uuid → wallet, use Tools →
"Export/Import Wallet Configurations".

Verbosity: `writeLndConfig` in `utils/LndMobileUtils.ts` hardcodes
`debuglevel=info` in the generated lnd.conf. For a local debugging session you
may bump it to `debug` there (dev-only; never commit).

**Trap — `readLndLog` is a stub.** `lndmobile/index.ts` `readLndLog` returns
`['']` with a `TODO remove` comment. Do not build tooling on it; the real
mechanisms are `NativeModules.LndMobileTools.tailLog(numberOfLines, lndDir,
network)` and `observeLndLogFile(lndDir, network)` which emits `lndlog`
device events (used by both the LNDLogs view and `SyncStore` rescan tracking).

Pulling the file off a device (debug builds only — `run-as` requires
`android:debuggable`):

```bash
# legacy 'lnd' wallet on mainnet:
adb shell "run-as app.zeusln.zeus tail -n 200 files/logs/bitcoin/mainnet/lnd.log"
# list wallet dirs to find uuid dirs:
adb shell "run-as app.zeusln.zeus ls files/"
```

iOS simulator:

```bash
APP=$(xcrun simctl get_app_container booted com.zeusln.zeus data)
find "$APP/Library/Application Support" -name lnd.log
```

(`com.zeusln.zeus` = iOS bundle id; Android applicationId is
`app.zeusln.zeus` — they differ.)

### LDK Node logs

- Path: `<DocumentDirectoryPath>/ldk-node/<ldkNodeDir-uuid>/ldk_node.log`.
  The storage dir comes from `utils/LdkNodeUtils.ts`
  `getLdkNodeStoragePath(nodeDir)`; `ldkNodeDir` is a `uuidv4()` per wallet.
  On Android `DocumentDirectoryPath` = `/data/user/0/app.zeusln.zeus/files`;
  on iOS it is the app sandbox `Documents/` folder.
- Log level: `LogLevel.DEBUG` / `.debug`, hardcoded at
  `builder.setFilesystemLogger(...)` in
  `android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt` and
  `ios/LdkNodeMobile/LdkNodeModule.swift`. Not user-configurable.
- In-app: `views/Settings/EmbeddedNode/LDKLogs.tsx` calls
  `NativeModules.LdkNodeModule.tailLdkNodeLog(100)` and subscribes to
  `ldklog` events from `observeLdkNodeLogFile()` (backed by
  `LogFileObserver.kt` / `LogFileObserver.swift`).
- The native module ALSO logs its own lifecycle to logcat under tag
  `LdkNodeModule` (e.g. `[timing] FFI buildWithDualStore completed in Nms`) —
  often more useful than ldk_node.log for start/stop races.

### adb logcat — verified filter tags

All tags below appear in the checked-in native sources
(`git grep -n 'TAG = "' android/app/src/main/java` to re-verify — with one
exception: `LdkNodeModule` has no `TAG` constant and uses inline
`Log.d("LdkNodeModule", ...)` literals; re-verify that one with
`git grep -n '"LdkNodeModule"' android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt`):

| Tag | Source | What you see |
|---|---|---|
| `ReactNativeJS` | RN runtime (standard) | all JS `console.*` on device |
| `LndMobileService` | `com/zeus/LndMobileService.java` | embedded LND process/IPC lifecycle |
| `LndMobile` | `com/zeus/LndMobile.java` | RN↔LND bridge module |
| `LndMobileTools` | `com/zeus/LndMobileTools.java` | log observation, chain tools |
| `LndScheduledSyncWorker` | `com/zeus/LndMobileScheduledSyncWorker.java` | background sync worker |
| `LndMobileScheduledSync` | `com/zeus/LndMobileScheduledSync.java` | sync scheduling |
| `LdkNodeModule` | `app/zeusln/zeus/LdkNodeModule.kt` | LDK Node build/start/stop, VSS, timing |
| `LdkNodeService` | `app/zeusln/zeus/LdkNodeService.kt` | LDK foreground service |
| `NostrConnectService` / `NostrConnectModule` | `com/zeus/NostrConnect*.java` | NWC background service |
| `CashuDevKitModule` | `com/zeus/cashudevkit/CashuDevKitModule.kt` | Cashu FFI |
| `MainActivity` | `com/zeus/MainActivity.kt` | activity lifecycle, intents |
| `MobileTools` | `com/zeus/MobileTools.java` | misc native tools |
| `StealthMode` | `app/zeusln/zeus/StealthMode.java` | icon-disguise switching |

Copy-paste starters:

```bash
# Embedded LND session:
adb logcat -s LndMobileService:* LndMobile:* LndMobileTools:* ReactNativeJS:*
# LDK Node session (start/stop/delete races):
adb logcat -s LdkNodeModule:* LdkNodeService:* ReactNativeJS:*
# NWC background service:
adb logcat -s NostrConnectService:* NostrConnectModule:* ReactNativeJS:*
```

### iOS console & Metro

- Xcode: run the `zeus` scheme (`ios/zeus.xcworkspace`) — the debug console
  shows both native `NSLog`/`os_log` and JS console output.
- Console.app: filter by process `zeus` on a connected device (release-ish
  builds where Xcode isn't attached). Standard macOS tooling.
- Metro: `yarn start` (script = `react-native start`, verified in
  package.json). All dev-mode JS logs appear there. Press `j` in the Metro
  terminal to open React Native DevTools (network + console + profiler) —
  standard RN ≥0.76 tooling, not Zeus-specific.
- JS-side embedded-LND logging goes through `lndmobile/log.ts`: a tiny
  wrapper that prefixes `console.*` output with a tag, e.g. lines starting
  `utils/LndMobileUtils.ts: ...` (see `const log = Log('utils/LndMobileUtils.ts')`).
  Grep Metro/logcat output for that prefix during embedded-LND triage.

## 2) In-app diagnostics

### Developer Tools view

- File: `views/Tools/DeveloperTools.tsx`; route `DeveloperTools`; reached via
  Menu → Tools ("Developers" row).
- Gating: shown when `BackendUtils.supportsDevTools()` is true, which is
  `isLNDBased() || call('supportsDevTools')` (`utils/BackendUtils.ts`).
  Measured availability (2026-07-06):
  - **Available**: `lnd`, `embedded-lnd`, `lightning-node-connect`
    (`isLNDBased = true`), plus `cln-rest` and `lndhub` (declare
    `supportsDevTools = () => true`).
  - **Not available**: `ldk-node`, `nostr-wallet-connect`.
  - There is NO developer-mode setting; gating is purely capability-based.
- Contents: 18 raw RPC probes in 4 accordions (General, Lightning, On-chain,
  Channels): `getMyNodeInfo`, `getNetworkInfo`, `getLightningBalance`,
  `getInvoices`, `getPayments`, `getBlockchainBalance`, `getTransactions`,
  `getUTXOs`, `getNewAddress`, `listAccounts`, `listAddresses`,
  `getChannels`, `getPendingChannels`, `getClosedChannels`, `getChannelInfo`,
  `getFees`, `getForwardingHistory`, `abandonChannel`. Each command carries a
  `compatibleImplementations` allowlist, so what you see varies per backend.
  Responses render as copyable JSON — this is the fastest way to see exactly
  what a backend returns without adding temporary logging.
- Danger rail: `abandonChannel` (drops a channel without an on-chain close;
  can burn funds) requires an "I know what I am doing" switch AND a native
  confirm dialog. Do not script around it.

### Keychain Recovery tool

- File: `views/Tools/NodeConfigExportImport.tsx` ("Export/Import Wallet
  Configurations" in Tools), backed by `utils/KeychainRecoveryUtils.ts`.
- The "Recover Lost Configurations" flow scans four sources for orphaned
  data: `current`, `unprefixed-local`, `unprefixed-cloud` (old
  iCloud-synchronizable keychain entries), and `encrypted-storage` (legacy
  `zeus-settings` blob). It exists because pre-migration keychain copies are
  deliberately never deleted — see **zeus-storage-and-migrations** for the
  whole saga and the rules before touching any of this.
- As a *diagnostic*, a scan tells you which storage generation a user's data
  is in — run it (read-only until the user restores) before hypothesizing
  about "lost wallets".
- Same view's Export flow is also the sanctioned way to inspect a device's
  wallet configuration set (per-wallet `lndDir`/`ldkNodeDir` uuids included).

### Activity / store inspection

- Tools → "Activity export" (`views/Tools/ActivityExport.tsx`) dumps
  invoices/payments/transactions to CSV — use it to diff what the app
  *thinks* happened against node truth (Developer Tools `getPayments` etc.).
- Sync observability is a store, not a screen: `stores/SyncStore.ts` polls
  `getMyNodeInfo` every 2s while syncing, compares `block_height` against a
  mempool.space tip (refetched every ~30s), and flips `isSyncing` off on
  `synced_to_chain`. Rescans are tracked by parsing lnd.log lines matching
  `/Rescanned through block.*\(height (\d+)\)/` via the `lndlog` event stream.
- MobX stores are module singletons (`stores/Stores.ts`); in a dev build you
  can inspect them from the React Native DevTools console via imports in
  scope of any breakpoint. No Reactotron/Flipper integration is configured
  (verified: no such deps in package.json).

## 3) Network debugging

### How requests flow (verified in `backends/LND.ts` + `utils/TorUtils.ts`)

```
view → BackendUtils.<method> → call(funcName) → active backend class
   REST (clearnet):   ReactNativeBlobUtil.config({ trusty: !certVerification }).fetch(...)
   REST (Tor):        doTorRequest(...)  [react-native-nitro-tor]
   Streaming:         wsReq(...) → new WebSocket(wss://host:port/route?method=...)
   Embedded backends: no network at this layer (gomobile IPC / uniffi FFI)
```

Facts you need before reaching for a proxy:

1. **TLS verification is OFF by default for remote REST.** `restReq`'s
   `certVerification` parameter defaults to `false`, and blob-util is called
   with `trusty: !certVerification` — i.e. invalid/self-signed certs are
   accepted unless the user enabled "Certificate Verification" on the node
   config. Consequence: a MITM proxy (mitmproxy, Charles, Proxyman) can
   intercept remote-node REST traffic *without installing its CA cert*, as
   long as certVerification is off and you route the emulator/device through
   the proxy (Android emulator: `-http-proxy`; iOS simulator honors macOS
   system proxy). There is no cert pinning anywhere in the REST path.
2. **WebSocket streams bypass Tor entirely.** `wsReq` and the other
   `new WebSocket(...)` call sites in `backends/LND.ts` build `wss://` URLs
   straight from host/port — even when the node has Tor enabled. When
   debugging "subscription works but payments leak clearnet" (or vice
   versa), remember these are two different transports.
3. **Tor path cannot be trivially proxied.** Tor requests go through the
   embedded nitro-tor daemon (`utils/TorUtils.ts` `doTorRequest`), not the
   system proxy. TLS bypass on this path is scoped to HTTPS `.onion` URLs
   only (`isOnionHttpsUrl`); clearnet-over-Tor keeps strict validation and
   `doTorRequest` treats HTTP ≥ 300 as errors. To observe Tor traffic,
   instrument at the far end (your node) instead.
4. **The request-dedup cache can replay failures.** `backends/LND.ts` keeps
   a module-level `calls` Map keyed by url+body. On the Tor branch the entry
   is only deleted on success, so a rejected promise is returned again for
   identical retries until `clearCachedCalls()` runs — which happens on
   reconnect via `SettingsStore.setConnectingStatus(true)`. If "the same
   error keeps coming back instantly with no network activity", suspect this
   cache, not the network. (`backends/CLNRest.ts` has the same structure.)
5. Cheap first probe: Developer Tools → `getMyNodeInfo` exercises the whole
   REST stack with one tap; React Native DevTools' Network panel shows
   fetch-based traffic in dev (blob-util requests may not appear there —
   fall back to the proxy or server-side logs).

### Server-side (Polar) inspection

Polar (https://github.com/jamaljsr/polar) is the recommended local Lightning
network for dev (CONTRIBUTING.md). For connecting Zeus to it, see
**zeus-run-and-operate**. Diagnostics side (external tooling — verify
against your Polar version):

- Each Polar node is a Docker container; view logs in the Polar UI (node →
  Logs) or `docker logs -f <container>` (containers are named per
  network/node, e.g. `polar-n1-alice`; `docker ps` lists them).
- lnd-side truth beats app-side guesses: watch the lnd container log while
  reproducing a payment to see whether the failure is client (Zeus) or node.
- LNC (`lightning-node-connect`) requires a litd (Lightning Terminal)
  instance to pair against; its session/mailbox logs live on that server.
  (litd-in-Polar support depends on Polar version — unverified here.)

## 4) Grep hygiene

Generated and vendored files will bury your signal: the two uniffi bindings
alone are ~31k lines, `proto/lightning.js` is ~133k lines, and `zeus_modules/`
is vendored third-party code with its own node_modules. Canonical grep:

```bash
git grep -nIw -E 'YOUR_PATTERN' -- . \
  ':(exclude)zeus_modules' \
  ':(exclude)proto/lightning.js' \
  ':(exclude)proto/lightning.d.ts' \
  ':(exclude)ios/LdkNodeMobile/LDKNode.swift' \
  ':(exclude)android/app/src/main/java/org/lightningdevkit/ldknode/ldk_node.kt' \
  ':(exclude)android/app/src/main/java/uniffi/zeus_cashu_restore/zeus_cashu_restore.kt' \
  ':(exclude)ios/CashuDevKit/CashuDevKit.swift' \
  ':(exclude)ios/CashuDevKit/zeus_cashu_restore.swift'
```

Rules of thumb:

- Prefer `git grep` over `grep -r`: `node_modules/`, `ios/Pods/`, and
  `android/app/build/` are gitignored, so git grep skips them for free
  (verified with `git check-ignore`). Plain `grep -r` and some `rg` setups
  will wade straight into them.
- Use `-w`, not `\b`: this git's ERE engine (macOS) does not support `\b`
  and **fails silently with zero matches** — a nasty way to conclude "no
  hits". `-w` gives whole-word matching portably.
- Known false positive: `utils/AddressUtils.test.ts` contains `XXX` inside a
  base64 PSBT fixture (line ~923). `-w` filters it; substring searches won't.
- `fetch-libraries.sh` defines a shell function literally named `jq()`
  (a python3 wrapper) — a misleading hit when grepping for jq usage.
- Config blind spots: tsconfig excludes `node_modules`, `zeus_modules`,
  `android`, `ios`; ESLint additionally ignores `proto/`; Prettier ignores
  ONLY `zeus_modules/` (per `.prettierignore` — so regenerated `proto/*.d.ts`
  can still fail the Prettier CI check). Code in excluded dirs is neither
  linted nor type-checked, so absence of CI complaints proves nothing
  about it.

## 5) Scripts

All live in `.claude/skills/zeus-diagnostics-and-tooling/scripts/`, are
executable, safe (read-only), and were run against master `c5fd094fb`.
Run them from anywhere inside the repo; they `cd` to the git root themselves.

### find-debt.sh — debt-marker census

```bash
.claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh            # full listing
.claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh --summary  # per-file counts
.claude/skills/zeus-diagnostics-and-tooling/scripts/find-debt.sh TODO       # single marker
```

Sample output (2026-07-06, `--summary`, top of list):

```
   5 android/app/src/main/java/com/zeus/LndMobile.java
   4 lndmobile/wallet.ts
   3 proto/lightning.proto
   3 lndmobile/index.ts
   3 android/app/src/main/java/com/zeus/LndMobileService.java
   2 views/Wallet/Wallet.tsx
   2 views/Activity/Activity.tsx
   ...
---
total markers: 63
```

Sample detail lines:

```
android/app/src/main/java/com/zeus/LndMobile.java:71:// TODO break this class up
android/app/src/main/java/com/zeus/LndMobile.java:350:  // TODO unbind LndMobileService?
```

Interpretation: the debt concentrates in the Blixt-derived embedded-LND
native layer (`com/zeus/*.java`, `lndmobile/*.ts`) — expected; see
**zeus-failure-archaeology** for which of those TODOs have bitten before.
Standalone `HACK`/`XXX` markers: zero in hand-written code (as of the date
above).

### capability-matrix.sh — live supports* matrix

```bash
.claude/skills/zeus-diagnostics-and-tooling/scripts/capability-matrix.sh                  # all flags
.claude/skills/zeus-diagnostics-and-tooling/scripts/capability-matrix.sh supportsOffers   # filter (regex)
```

Cell legend: `T`/`F` literal, `expr` computed (usually LND version gates like
`this.supports('v0.13.0')`), `^T`/`^F`/`^expr` inherited from `LND.ts`
(EmbeddedLND and LndHub extend LND — inherited `T` is the classic silent-bug
pattern), `-` not declared anywhere → `BackendUtils.call()` returns literal
`false`. Composite flags computed in `utils/BackendUtils.ts`
(`supportsDevTools`, `supportsLightningAddress`,
`supportsForwardingHistoryChannelFilter`) are listed in the script header,
not the matrix.

Sample output (2026-07-06, excerpt; 56 flags total):

```
FLAG                                      LND    eLND   LNC    LDK    CLN    Hub    NWC
isLNDBased                                T      T      T      F      F      F      F
supportsCashuWallet                       F      T      F      T      F      F      F
supportsChannelFundMax                    T      T      T      T      T      ^T     F
supportsDevTools                          -      -      -      -      T      T      -
supportsOffers                            F      F      F      T      T      F      F
supportsTaproot                           expr   expr   expr   T      T      F      F
supportsWatchtowerClient                  T      T      T      F      -      F      -
```

Hand-verified against source (3 flags): `supportsCashuWallet` T only in
`backends/EmbeddedLND.ts` and `backends/LdkNode.ts`; `supportsOffers` T only
in `backends/LdkNode.ts` and `backends/CLNRest.ts`; `supportsChannelFundMax`
absent from `backends/LndHub.ts` hence inherited `^T` from `backends/LND.ts`
(the known LndHub override gap).

### list-settings-defaults.sh — defaults drift review

```bash
.claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh            # whole block
.claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh 'Fee'      # filtered
```

Prints the inline `@observable settings: Settings = { ... }` defaults object
of `stores/SettingsStore.ts` with real line numbers (located by brace
counting, not hardcoded lines — 147 lines spanning 1467–1613 as of
2026-07-06). Sample:

```
1467	    @observable settings: Settings = {
1468	        privacy: {
1469	            defaultBlockExplorer: 'mempool.space',
...
1612	        selectNodeOnStartup: false
1613	    };
```

Why it matters: these literals are what FRESH installs get; existing users
keep old values unless a migration runs. Diff this output between two
commits to catch silent default drift. The catalog of every axis lives in
**zeus-config-and-flags**; the migration recipe in
**zeus-storage-and-migrations**.

## 6) Interpretation guides — healthy vs unhealthy

### Embedded LND startup (the state machine Zeus itself watches)

`utils/LndMobileUtils.ts` subscribes to LND's state stream and drives on
`lnrpc.WalletState`: `NON_EXISTING → LOCKED → UNLOCKED → RPC_ACTIVE →
SERVER_ACTIVE`. Readiness is declared at RPC_ACTIVE/SERVER_ACTIVE (after an
RPC-ready check); the hard ceiling is `LND_READY_TIMEOUT_MS = 60000` (60s),
after which the slow-start path triggers.

Healthy session, in order:
1. logcat `LndMobileService`: process/service start, no restarts.
2. State log line `Current LND state: ...` advancing through the machine
   (JS side, tag prefix `utils/LndMobileUtils.ts:` in Metro/ReactNativeJS).
3. `lnd.log`: wallet opened/unlocked, neutrino peers connected, sync
   progress advancing. (Exact lnd.log wording is upstream-LND behavior and
   varies by version — treat specific phrasings as unverified here; the
   one pattern Zeus's own code depends on is
   `Rescanned through block ... (height N)` in `stores/SyncStore.ts`.)
4. App: Wallet screen leaves "connecting", balances populate.

Unhealthy signatures (all from `utils/LndMobileErrors.ts`, the canonical
error-code → raw-pattern map — read it before inventing new matching):

| Symptom / matched pattern | Code | Meaning |
|---|---|---|
| `wallet locked` | `WALLET_LOCKED` | normal right after start; app should auto-unlock — persistent means unlock failed |
| `already started`, `already running` | `LND_ALREADY_RUNNING` | informational; a stop didn't complete before a start (lifecycle race territory — see **zeus-node-lifecycle-campaign**) |
| `starting up`, `not yet ready` | `RPC_NOT_READY` | transient; only a problem if still there near the 60s ceiling |
| stuck LOCKED→nothing, then timeout | `RPC_READY_TIMEOUT` / `LND_READY_TIMEOUT` | RPC never came up; check lnd.log for the real cause |
| `no such file or directory` etc. | `LND_FOLDER_MISSING` | wallet dir gone (post-delete or dir-mapping bug) |
| `unable to read TLS cert`, `connection refused` during stop | `STOP_LND_EXPECTED` | expected shutdown noise — NOT an error |

### Neutrino sync

`stores/SyncStore.ts` semantics: `numBlocksUntilSynced = bestBlockHeight −
currentBlockHeight` where best comes from mempool.space and current from
`getMyNodeInfo().block_height` (polled every 2s).

- Healthy: `currentBlockHeight` strictly increasing between polls; gap
  shrinking; ends with `synced_to_chain: true`.
- Unhealthy: current height frozen across many polls with peers configured →
  neutrino peer trouble (check `[Neutrino]` section peers in generated
  lnd.conf, `neutrino.connect` vs `addpeer` is controlled by the
  `dontAllowOtherPeers` setting); best height 0/erroring → the mempool.space
  fetch failed and the store falls back to current height, which can
  *mask* remaining sync distance.
- Recovery (seed restore) is separate: `getRecoveryInfo` polled at 2s;
  healthy = `progress` monotonically rising to `recovery_finished`.

### LDK Node startup

Healthy (logcat, tag `LdkNodeModule`): `applyBuilderSettings: Enabling
filesystem logger` → `Building node with dual store (VSS + local): <url>` →
`[timing] FFI buildWithDualStore completed in <N>ms` → started/running.
Unhealthy: `[timing] FFI buildWithDualStore failed in <N>ms: <msg>`;
JS-layer sentinels `Node not initialized` (native ref still rebuilding —
transient by design, retried) and `LDK Node not running yet` (both defined
in `utils/LdkNodeUtils.ts`). Repeated build attempts or a stop that never
returns → lifecycle race; gather the logcat trace FIRST, then switch to
**zeus-node-lifecycle-campaign**.

### Remote backends (lnd REST / cln-rest / lndhub)

- Healthy: Developer Tools `getMyNodeInfo` returns JSON quickly; Wallet
  populates.
- Error-shaped success trap: LND REST `payLightningInvoice` timeouts
  *resolve* with `{ payment_error: localeString('views.SendingLightning.paymentTimedOut') }`
  (a locale-dependent "Payment timed out…" message) — a "successful"
  response that is actually a failure. Don't classify by promise
  resolution, and don't match the string literally.
- Instantly repeating identical error with no traffic → stale dedup-cache
  rejection (section 3, item 4).
- Method returns literal `false` (and `.then` crashes with "false is not a
  function"-style errors) → the active backend simply lacks that method;
  check the capability matrix, not the network.

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by
reading the cited files and running every command/script in this skill
(scripts run to completion with the sample outputs shown; adb/simulator/
proxy commands are standard platform tooling verified by source read of the
paths they target, not executed against a device).

One-line re-verification commands for volatile facts:

| Fact | Re-verify with |
|---|---|
| `readLndLog` still a stub | `git grep -n -A3 'readLndLog = async' lndmobile/index.ts` |
| Android lnd.log paths | `git grep -n 'logs/bitcoin' android/app/src/main/java/com/zeus/LndMobileTools.java` |
| iOS lnd.log path | `git grep -n 'lnd.log' ios/LndMobile/LndMobileTools.swift` |
| lnd `debuglevel=info` | `git grep -n 'debuglevel' utils/LndMobileUtils.ts` |
| LDK log path + DEBUG level | `git grep -n 'setFilesystemLogger' android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt ios/LdkNodeMobile/LdkNodeModule.swift` |
| logcat TAG list | `git grep -n 'TAG = "' android/app/src/main/java` (exception: `LdkNodeModule` uses inline literals — `git grep -n '"LdkNodeModule"' android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt`) |
| DevTools gating rule | `git grep -n -A2 'supportsDevTools' utils/BackendUtils.ts backends/` |
| DevTools command list | `git grep -n "name: '" views/Tools/DeveloperTools.tsx` |
| `trusty:` TLS default | `git grep -n 'trusty' backends/LND.ts` |
| WS-bypasses-Tor | `git grep -n 'new WebSocket' backends/LND.ts` |
| Tor onion-only bypass | `git grep -n 'isOnionHttpsUrl' utils/TorUtils.ts backends/LND.ts` |
| nitro-tor version | `git grep -n 'react-native-nitro-tor' package.json` |
| dedup-cache clear site | `git grep -n 'clearCachedCalls' stores/SettingsStore.ts backends/` |
| WalletState machine + 60s timeout | `git grep -n 'LND_READY_TIMEOUT_MS\|WalletState\.' utils/LndMobileUtils.ts` |
| Rescan log regex | `git grep -n 'Rescanned through block' stores/SyncStore.ts` |
| defaults block location | `.claude/skills/zeus-diagnostics-and-tooling/scripts/list-settings-defaults.sh \| head -2` |
| capability matrix | rerun `capability-matrix.sh` and spot-check any 3 flags against `backends/*.ts` |
| app/bundle ids | `git grep -n 'applicationId' android/app/build.gradle; git grep -n 'PRODUCT_BUNDLE_IDENTIFIER = com' ios/zeus.xcodeproj/project.pbxproj` |

If any script errors with "pattern changed", the source file moved under it —
fix the script in the same change and re-paste fresh sample output here.
