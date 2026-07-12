---
name: zeus-node-lifecycle-campaign
description: Load when working on Zeus's node lifecycle races - the #1 live problem (maintainer, 2026-07-06). Symptoms/tasks that trigger this skill - embedded LND or LDK Node crashes on wallet switch/delete/create, "Node not initialized" errors, Tokio thread panics / native SIGABRT on stop or delete, app stuck on "Starting node" or infinite connecting spinner, duplicate node builds, fetchData or getSettingsAndNavigate re-entrancy, "lnd already started" after JS reload, wallet-switch leaves the previous node running, background/foreground storms breaking the connection, stopLnd/startLnd/stopLdkNode/buildNode ordering questions, or any change to Wallet.tsx connection flow / SettingsStore connecting-fetchLock flags / LndMobileService / LdkNodeModule. Contains the verified lifecycle state map, reproducible baseline experiments, a ranked solution menu with obligations, and fenced wrong paths with commit hashes.
---

# Zeus Node Lifecycle Campaign

This is an executable, decision-gated investigation campaign for Zeus's hardest live problem (maintainer-confirmed, 2026-07-06): **races in starting, stopping, deleting, and switching embedded nodes** (embedded LND and LDK Node), including Tokio-thread crashes and `Wallet.tsx` `fetchData` re-entrancy. Everything below was verified by reading the code at master `c5fd094fb` (v13.1.3-alpha) unless explicitly labeled HYPOTHESIS.

## When to use / When NOT to use

**Use this skill when** you are reproducing, diagnosing, or fixing node start/stop/delete/switch races, or reviewing any PR that touches `views/Wallet/Wallet.tsx` connection flow, `SettingsStore` lifecycle flags, `utils/LndMobileUtils.ts`, `utils/LdkNodeUtils.ts`, or the native node modules.

**Do NOT use this skill for:**

| Need | Go to sibling skill |
|---|---|
| General symptom→triage for other bugs | zeus-debugging-playbook |
| How to capture logs / measure (general tooling) | zeus-diagnostics-and-tooling |
| Past incident narratives beyond lifecycle | zeus-failure-archaeology |
| Backend capability matrix, adding an RPC | zeus-backends-and-capabilities |
| Formal race-analysis method (generic recipes) | zeus-proof-and-analysis-toolkit |
| PR/commit/review rules, the non-negotiables | zeus-change-control |
| Running the app / connecting nodes at all | zeus-run-and-operate |
| Settings blob, migrations, keychain | zeus-storage-and-migrations |
| What counts as test evidence, jest traps | zeus-validation-and-qa |

## Jargon (one line each, both domains)

- **Embedded LND**: a full LND Lightning node compiled to a mobile library (gomobile) running *inside* the Zeus app process; Zeus implementation string `'embedded-lnd'`.
- **LDK Node**: a Rust Lightning node (`ldk-node` crate, ZeusLN fork) embedded via uniffi FFI bindings; implementation string `'ldk-node'`.
- **Tokio**: the Rust async runtime ldk-node uses. If the *last* reference to the Node object is dropped from one of Tokio's own worker threads, the runtime is destroyed from inside itself → Rust panic → native crash (SIGABRT), killing the whole app.
- **uniffi**: Mozilla's Rust↔Kotlin/Swift binding generator; the checked-in `ldk_node.kt` / `LDKNode.swift` are its output.
- **gomobile / Messenger IPC**: embedded LND is a Go library; on Android it runs behind `LndMobileService.java`, a bound Android Service the RN module talks to via `Messenger` message passing (Blixt-derived code, `TODO(hsjoberg)` debt).
- **Foreground service**: an Android service with a persistent notification, allowed to keep running in background; used for "persistent mode".
- **Focus event**: react-navigation fires `'focus'` every time a screen becomes active — including returning from another screen. `Wallet.tsx` re-runs its connect logic on focus.
- **AppState**: React Native's app-level state (`active`/`background`/`inactive`); Wallet also re-runs connect logic on `active`.
- **MobX observable**: mutable store field that re-renders observers; the lifecycle flags below are plain observables with **no atomicity guarantees**.
- **Neutrino**: LND's light-client chain backend (connects to Bitcoin P2P peers). **Esplora/RGS/VSS**: LDK Node's chain API server / rapid gossip sync server / remote channel-state storage (`vss.zeusln.com`).
- **fetchData**: the ~800-line method in `views/Wallet/Wallet.tsx` that resets stores, starts/attaches to the node for the active backend, and loads wallet data. It IS the boot sequence (not App.tsx).

## The lifecycle state machine as it actually exists (verified 2026-07-06)

There is **no single owner**. Lifecycle state is smeared across four layers:

| Layer | File | Owns |
|---|---|---|
| Orchestration | `views/Wallet/Wallet.tsx` | `handleFocus` / `handleAppStateChange` / `handleOpenURL` → `getSettingsAndNavigate()` → `fetchData()`; the `_navigating` instance flag; a 60s slow-startup alert timer |
| Flags | `stores/SettingsStore.ts` | `connecting` (init **true**), `fetchLock`, `embeddedLndStarted`, `walletJustCreated`, `triggerSettingsRefresh`, `posWasEnabled`, `ldkNodeSyncing`; `setConnectingStatus()`; `updateNodeProperties()` (swaps `implementation`, dirs, creds on every settings write) |
| JS node control | `utils/LndMobileUtils.ts` (`initializeLnd`, `startLnd`, `stopLnd`, `waitForRpcReady`, `createLndWallet`, `deleteLndWallet`) and `utils/LdkNodeUtils.ts` (`startLdkNodeWallet`, `stopLdkNode`, `waitForLdkNodeReady`, `createLdkNodeWallet`, `deleteLdkNodeWallet`) | retry loops, sleeps, error classification (`utils/LndMobileErrors.ts`) |
| Native | Android `android/app/src/main/java/com/zeus/LndMobileService.java` (+ `LndMobile.java`, `LndMobileScheduledSyncWorker.java`), `android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt`; iOS `ios/LndMobile/`, `ios/LdkNodeMobile/LdkNodeModule.swift` | the actual daemon/Node object, `lndStarted` boolean, `nodeLock`/`takeNode()` |
| Mutation entry points | `views/Settings/Wallets.tsx` (switch), `views/Settings/WalletConfiguration.tsx` (create/edit/delete), `utils/WalletCreationUtils.ts` (Quick Start), `views/Settings/SeedRecovery.tsx` | write `settings.nodes`/`selectedNode` via `updateSettings`, then `setConnectingStatus(true)` + `popTo('Wallet')` |

### The guards, in evaluation order

1. **`_navigating`** (Wallet.tsx instance field) — guards `getSettingsAndNavigate` re-entry from the focus event and AppState `active`. Added in `c71a04ce9` (2026-04-07) because the focus event fires twice on startup and both raced into `fetchData` → duplicate `buildNode`, second build times out holding VSS resources. **Bypassed by three call sites** that invoke `getSettingsAndNavigate()` directly: pull-to-refresh (`LayerBalances onRefresh`), the error-screen Restart button (iOS branch), and `handleOpenURL` for `zeusln://share`.
2. **`fetchLock`** (SettingsStore observable) — checked/set at `fetchData` entry (`if (fetchLock) return; SettingsStore.fetchLock = true;`). Cleared in exactly two places: the happy-path end of `fetchData`, and `setConnectingStatus(true)`. **Every early-return error path leaves `fetchLock === true`** — by design: the app then shows the error screen, and recovery requires `setConnectingStatus(true)` (Restart button, wallet switch, transient-retry loop), which clears the lock. Consequence: any code path that errors out and then expects a plain focus event to reconnect will hang silently.
3. **`connecting`** — initialized `true`, so the first `fetchData` after cold start runs the full connect branch (stop→init→start + reset of ~12 stores). Set `false` at the end of a successful connect or on fatal errors; set `true` by every wallet-switch/create/restart path. When `false`, `fetchData` becomes a light data refresh (embedded-lnd still calls `waitForRpcReady()` + full data fetch on every focus).
4. **`walletJustCreated`** — set by `createLndWallet` / LDK create paths; makes `fetchData` skip the stop→init→start cycle because the node is already running from wallet creation. Consumed (set `false`) on first use.
5. **`embeddedLndStarted`** — whether `stopLnd()` is called before re-init (`if (!recovery && SettingsStore.embeddedLndStarted) await stopLnd();`). Set `true` in `startLnd` (only when a wallet password is present), `false` in `stopLnd` and several views.
6. **Native guards** — LDK: `nodeLock` (Kotlin `synchronized`) / `takeNode()` (Swift) makes stop/build swap the node reference atomically; LND Android: a single `lndStarted` boolean inside `LndMobileService`; the Go daemon itself rejects double starts with "lnd already started".

### `setConnectingStatus(true)` side effects (SettingsStore.ts)

Resets `error`/`errorMsg`/`lndFolderMissing`, calls `BackendUtils.clearCachedCalls()` (flushes the request dedup cache — see zeus-backends-and-capabilities), and clears `fetchLock`. This is the universal "reconnect" lever; treat any call to it as a lifecycle transition.

### Per-backend connect branch inside `fetchData` (only when `connecting`)

- **ldk-node**: `stopLdkNode()` (unless `walletJustCreated`) → `startLdkNodeWallet` (`initializeNode` FFI + `node.start()` retried up to 5×500ms on "Node not initialized" + `syncWallets`) → later branch `waitForLdkNodeReady()` (polls `status()` every 500ms up to 60s, tolerating "Node not initialized" and not-running — added by `b54e8f138`, 2026-05-17; the companion `buildNode`-race fix `8fc9698a0`, same day, added the `walletJustCreated` skip).
- **embedded-lnd**: `stopLnd()` (if started) → `initializeLnd` (writes lnd.conf, binds service) → optional express graph sync → `startLnd` (retry ladder incl. force-stop on `LND_ALREADY_RUNNING`, wallet unlock on `WALLET_LOCKED`) → `waitForRpcReady()` (polls `getInfo` 500ms up to 30s). Transient RPC errors route through `retryOnTransientError` (max 5 retries, 2s base exponential backoff; it toggles `connecting` false→true, which is also what re-clears `fetchLock`).
- Remote backends (lndhub login, LNC `connect()`, NWC `connectNWC()`, REST default) have no native lifecycle but share the same flags.

### Native stop/delete rules (the Tokio contract)

From `LdkNodeModule.kt` (`stop`, `buildNode`) and `LdkNodeModule.swift` (same methods), established by `d416052cd` + `0e2b89164` (both 2026-03-10):

1. Take the node reference out of the module under `nodeLock`/`takeNode()` **first**, so no other call can reach a stopping node.
2. Call `node.stop()` on a **dedicated non-Tokio thread** (raw `Thread` on Android, GCD global queue on iOS) — never on a Tokio callback thread.
3. Resolve the JS promise only **after** `stop()` returns — callers may delete wallet files or build a new node the moment `stop()` resolves.
4. Keep the reference alive **2 more seconds** after resolving (`Thread.sleep(2000)` + `hashCode()` on Android, `withExtendedLifetime` on iOS) so internal Tokio tasks drop their `Arc` refs before ours — otherwise the "Runtime dropped on worker thread" panic.
5. `buildNode` applies the same stop-and-hold to any existing node before building, and clears the JS-visible node reference up front — which is why **any FFI call during a rebuild window rejects with `"Node not initialized"`** (JS must tolerate it: `LDK_NODE_NOT_INITIALIZED` handling in `utils/LdkNodeUtils.ts`).

Embedded LND has no equivalent contract; `stopLnd()` in `utils/LndMobileUtils.ts` approximates one (status check → `stopDaemon` → `killLnd` → poll status up to 10×500ms).

## Known race windows (the target list)

Each window is verified by code read at `c5fd094fb`. Runtime confirmation status noted.

| # | Window | Status |
|---|---|---|
| W1 | Double focus → duplicate `getSettingsAndNavigate` | FIXED by `_navigating` (`c71a04ce9`); residual: the three bypass call sites rely only on `fetchLock`, which does NOT stop a second `getSettingsAndNavigate` from re-running the pre-`fetchData` navigation logic concurrently |
| W2 | JS call into LDK during `buildNode` rebuild → `"Node not initialized"` rejection | Tolerated in `waitForLdkNodeReady` (`b54e8f138`) and the pre-existing `start` retries; **unguarded** for every other store that calls the backend during the window (e.g. polling stores) |
| W3 | Cross-implementation switch leaves the previous node running: `fetchData`'s `ldk-node` branch calls only `stopLdkNode()`, the `embedded-lnd` branch only `stopLnd()`. Switching embedded-lnd → ldk-node (or reverse) stops NEITHER the old node; `views/Settings/Wallets.tsx onWalletPress` only calls `setPersistentMode(false)` (dismisses the Android notification, does not stop the node) and `BackendUtils.disconnect()` for LNC | Confirmed by code read; runtime impact (two chain-syncing nodes, memory/battery, port/db contention) needs Phase 3 measurement |
| W4 | Delete-active-wallet flow: `WalletConfiguration.deleteNodeConfig` stops node → `updateSettings({ justDeletedWallet: active })` → deletes files → navigates to Wallets; selecting the next wallet runs `handleJustDeletedWallet` which does `setConnectingStatus(true)` then **`sleep(2000)`** — a bare time-based wait standing in for "old node fully gone" | Open; the sleep is a fenced symptom-patch pattern (below) |
| W5 | JS reload with live daemon: LND runs **in the app process** (`android/app/src/main/AndroidManifest.xml` declares `LndMobileService` with no `android:process` attribute), so a JS-only restart (`RNRestart`, dev-menu reload, JS crash) leaves the Go daemon running → next start hits `LND_ALREADY_RUNNING` → force-stop ladder in `startLndWithRetry` with 2–4s cleanup sleeps | Handled but fragile; see W6 |
| W6 | `LndMobileTools.killLnd()` scans running processes for `packageName + ":zeusLndMobile"`, but no such process is ever created (no `android:process` in the manifest) — so `killLnd` can never find/kill anything and resolves `false`. Recovery therefore rests entirely on the Go `stopDaemon` call. Also `killLndProcess()` uses `getCurrentActivity()` which is null when no Activity is attached (background) → NPE risk | Code-read finding; runtime confirmation = log `killLnd` result in Phase 4. Blixt heritage: Blixt runs the service in a separate process, Zeus does not |
| W7 | `LndMobileScheduledSyncWorker.java` (background sync) binds the same `LndMobileService` and — per its own FIXME at ~line 310 — calls `thread.run()` instead of `thread.start()`, executing the "thread" body synchronously on the worker's calling thread with handlers on the **main looper**. A scheduled sync racing a foreground app start can send `MSG_START_LND` against an already-started daemon (the worker's own comment: "Make sure we don't attempt to start lnd twice... better fix would be MSG_CHECKSTATUS") | Open, acknowledged debt (`TODO(hsjoberg)`) |
| W8 | `LndMobileService.onUnbind`: when the last client unbinds it calls `stopLnd(null, -1)` + `stopSelf()` — but the RN module (`LndMobile.java`) binds once in `initialize()` and its `unbindLndMobileService` is flagged in `lndmobile/LndMobile.d.ts` as "function looks broken" and is never called from TS (verified: zero TS call sites). So service lifetime ≈ process lifetime; unbind-triggered stop is effectively dead code in the app (only the sync worker unbinds) | Confirmed by code read |
| W9 | Background/foreground storm: AppState `active` triggers `getSettingsAndNavigate` (guarded by `_navigating`), `inactive` resets `NostrWalletConnectStore`; iOS fires `inactive` on mere app-switcher/notification-shade interactions | Guarded but untested under storm; Phase 0 E4 |
| W10 | LDK delete-then-create same dir: `stop()` resolves before the 2s native Arc-hold expires; `deleteLdkNodeWallet` then `RNFS.unlink`s the storage dir while background Tokio cleanup may still touch it | HYPOTHESIS — the 2s hold was added for the ref-drop panic, not for file-handle safety; needs Phase 5 experiment |

---

## Phase 0 — Baseline: reproduce and measure

Goal: a numeric crash/hang rate per scenario BEFORE any fix, so any fix can be judged. Do not skip; the maintainer's revert-first culture means an unmeasured "fix" is unlandable.

### Prerequisites

- Dev builds on BOTH platforms (see zeus-run-and-operate; `yarn android` / `yarn ios`, Metro via `yarn start`).
- Two test wallets on one device: one `embedded-lnd` (Mainnet or Testnet) and one `ldk-node`. Create via IntroSplash Quick Start + Settings → Wallets → Add.
- Log capture:

```bash
# Android — native lifecycle tags + crashes (works on debug and release):
adb logcat -v time | grep -E "ReactNativeJS|LdkNodeModule|LndMobileService|LndMobile|AndroidRuntime|FATAL|Fatal signal"

# Android — crash buffer only (count crashes across trials):
adb logcat -b crash -v time

# Android JS console in DEBUG builds goes to the Metro terminal, not logcat.
# In RELEASE builds console.log appears under the ReactNativeJS logcat tag.

# LDK Node's own Rust log (debug builds; substitute the wallet's uuid dir):
adb shell run-as app.zeusln.zeus sh -c 'ls files/ldk-node/'
adb shell run-as app.zeusln.zeus sh -c 'tail -f files/ldk-node/<uuid>/ldk_node.log'

# Embedded LND's log: in-app Settings → Embedded node → LND Logs, or (debug):
adb shell run-as app.zeusln.zeus sh -c 'tail -f files/<lndDir>/logs/bitcoin/mainnet/lnd.log'

# iOS — native NSLog (simulator; process name is "zeus"):
xcrun simctl spawn booted log stream --predicate 'process == "zeus"' --style compact
# iOS JS console: Metro terminal.
```

### Log milestones (the vocabulary of every experiment)

All verified present in source:

| Milestone | Exact string (grep-able) | Source |
|---|---|---|
| Focus fired, connect starting | `[Wallet] handleFocus: triggering getSettingsAndNavigate` | Wallet.tsx |
| Re-entry suppressed | `skipping — getSettingsAndNavigate already in flight` | Wallet.tsx (focus + AppState variants) |
| LDK teardown | `[LDK startup] stopping previous instance` / `[LDK startup] stopped` | Wallet.tsx |
| LDK build+start | `[LDK startup] calling startLdkNodeWallet` / `LDK Node: Started successfully` / `LDK Node: Sync complete` | Wallet.tsx / LdkNodeUtils.ts |
| LDK ready-wait | `[LDK startup] waiting for node to be ready` | Wallet.tsx |
| LDK native timing | `LdkNodeModule: [timing] FFI buildWithDualStore starting/completed` | LdkNodeModule.kt/.swift |
| LND ready | `RPC ready - Node pubkey:` | LndMobileUtils.ts `waitForRpcReady` |
| LND states | `Current LND state:` (NON_EXISTING/LOCKED/UNLOCKED/RPC_ACTIVE/SERVER_ACTIVE) | LndMobileUtils.ts |
| LND double-start recovery | `LND already started - force stop (Go thinks running)` | LndMobileUtils.ts |
| Connect finished | `[Wallet] connect time: ` | Wallet.tsx |
| LDK race symptom | `Node not initialized` | native modules / LdkNodeUtils.ts |
| Transient-retry loop | `Transient ... - retry N/5 in Xms` | LndMobileErrors.ts |

### E1 — Cold start, each backend (control; 5 trials each)

Kill the app (swipe from recents), relaunch, wait for balance screen.

- **Expect**: one `triggering` line, typically followed by one `skipping` line (the startup focus event fires twice — see `c71a04ce9`), the backend's start milestones once each, exactly one `connect time:` line.
- **If you see two `triggering` lines with no `skipping`** → the `_navigating` guard regressed or a bypass path fired → branch to Phase 2.
- **If `connect time:` never appears and the spinner persists** → note which milestone was last; `fetchLock` is likely stranded (Phase 2's flag table tells you which return path).

### E2 — Rapid wallet switch, embedded-lnd ↔ ldk-node (20 cycles)

Settings → Wallets → tap the other wallet; as soon as the Wallet screen shows *anything* (don't wait for full sync), switch back. Record: crashes (`logcat -b crash`), stuck-spinner incidents, and whether the OLD node keeps running.

- **Old-node liveness probe (W3)**: after switching embedded→ldk, keep `tail -f` on the old wallet's `lnd.log` — if new log lines keep appearing (neutrino banner/filter activity), the LND daemon is still running alongside LDK. Expected per code read: **it is**. Symmetrically, `ldk_node.log` continues after switching ldk→embedded.
- **Expect per switch**: `triggering` → store resets → old-backend stop milestone **only if switching within the same implementation** → new-backend start milestones → `connect time:`.
- **If crash with `Fatal signal 6 (SIGABRT)` mentioning tokio/runtime** → LDK ref released on a Tokio thread; capture the full tombstone; this is the `d416052cd` class — branch to Phase 5.
- **If `Node not initialized` surfaces in the UI (error screen)** rather than being retried → an unguarded call site hit W2 — branch to Phase 2 call-site census.
- **If a switch hangs with no `triggering` line at all** → focus fired while `_navigating` was stuck true (a `getSettingsAndNavigate` that never resolved) — capture the last milestone.

### E3 — Delete active wallet mid-operation (5 trials each backend)

While the node is mid-sync (do this within ~30s of connect), Settings → Wallets → gear icon → Delete wallet → confirm; then immediately select the remaining wallet.

- **Expect**: stop milestone, `justDeletedWallet` flow (2s pause in `Wallets.handleJustDeletedWallet` before reconnect), new wallet connects.
- **If crash on the delete itself (LDK)** → W10 or a `d416052cd` regression — branch to Phase 5.
- **If "wallet not found"/`LND_FOLDER_MISSING` alert on the NEXT connect** → stale `lndDir`/`ldkNodeDir` read from a not-yet-propagated settings write — record `selectedNode` at each step (Phase 1 instrumentation).

### E4 — Background/foreground storm (20 cycles)

Rapidly background/foreground the app (Android: home + reopen; iOS: app switcher). Then once more with ≥30s in background.

- **Expect**: `skipping` lines for suppressed re-entries; at most one connect flow per foregrounding; NWC store reset lines on iOS `inactive` are normal.
- **If store data visibly resets (balance flashes to 0) on every foreground** → `connecting` got stuck true, making every `fetchData` run the full reset branch.

### E5 — JS reload with live daemon (Android, 10 trials)

With embedded-lnd running: dev-menu Reload (debug) or trigger the in-app restart. The process survives, so the Go daemon does too.

- **Expect**: `LND already started - force stop (Go thinks running)` → stop ladder → successful restart within ~10s (includes the 4s `ANDROID_PROCESS_CLEANUP_DELAY_MS`).
- **If it loops on `LND still running (attempt N) - force stop`** until `LND_START_FAILED` → the stop ladder can't actually kill the daemon (consistent with W6: `killLnd` is a no-op on this manifest) → Phase 4.

**Baseline record**: for each experiment, `crashes / trials`, `hangs / trials`, and the last milestone before each failure. This table is the campaign's ground truth.

---

## Phase 1 — Instrument the flags (temporary)

Add TEMPORARY logging so every flag transition is attributable. **Instrumentation must not ship**: strip it before any PR, or land it only behind an explicit maintainer-approved debug gate — unconditional console noise in the connect path will be rejected in review (zeus-change-control; there is no developer-mode toggle to hide behind, see zeus-config-and-flags).

Instrumentation points (grep anchors, all verified):

| Where | Anchor | Log |
|---|---|---|
| `stores/SettingsStore.ts` `setConnectingStatus` | `public setConnectingStatus = (status = false)` | old→new value + `new Error().stack` (caller attribution — MobX gives you none) |
| `views/Wallet/Wallet.tsx` `fetchData` entry | `if (fetchLock) return;` | log BOTH the rejected entries (currently silent) and the acquisitions, with `implementation`, `connecting`, `walletJustCreated` |
| `views/Wallet/Wallet.tsx` `fetchData` exit | `SettingsStore.fetchLock = false;` | matched release log; any acquisition without a release = a stranded lock |
| `utils/LndMobileUtils.ts` `stopLnd`/`startLnd` | function heads | entry/exit + `embeddedLndStarted` value |
| `utils/LdkNodeUtils.ts` `stopLdkNode`/`startLdkNodeWallet` | function heads | entry/exit timestamps (measures overlap with builds) |
| `views/Settings/Wallets.tsx` `onWalletPress` | `const onWalletPress` | old/new `selectedNode`, old/new implementation |

Re-run E1–E5 with instrumentation. **Decision gate**: produce a timeline for every Phase 0 failure showing which flag was in the wrong state. If any failure shows two node-start sequences interleaved (start A begins, start B begins before A's ready milestone), the serialization defect is confirmed and Phase 2 is mandatory.

## Phase 2 — Entry-path and lock-outcome census (desk analysis + targeted tests)

Enumerate every path into `getSettingsAndNavigate`/`fetchData` and every exit's flag outcome. Starting set (verified at `c5fd094fb` — re-derive, don't trust):

```bash
grep -n "getSettingsAndNavigate\|_navigating" views/Wallet/Wallet.tsx
grep -rn "setConnectingStatus(true)" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Entry paths: focus (guarded), AppState active (guarded), componentDidMount→handleFocus, pull-to-refresh (UNguarded), error-screen Restart (UNguarded, iOS), `zeusln://share` URL (UNguarded), transient-retry recursion (`retryOnTransientError` → `getSettingsAndNavigate(undefined, count+1)`).

For each `return`/`throw` inside `fetchData`, record: `fetchLock` left true? `connecting` left true? Is there a UI affordance that will call `setConnectingStatus(true)` to recover? Build the full table (there are ~12 early returns).

**Decision gate**: 
- If every observed Phase 0 hang maps to a "lock stranded + no recovery affordance" row → solution (b) below fixes the hangs; scope it to those rows.
- If hangs occur even with clean flag states → the defect is deeper (native), go to Phase 4/5 first.

## Phase 3 — Cross-implementation teardown (W3)

Experiment: E2's old-node liveness probe, plus resource measurement:

```bash
# Memory of the app process while both nodes run vs one:
adb shell dumpsys meminfo app.zeusln.zeus | head -30
```

Also test: switch embedded→ldk, wait 5 min, switch back — does the returning `stopLnd()`+`startLnd()` find a healthy daemon or a wedged one?

**Decision gate**: if the old node demonstrably keeps syncing after a switch (expected), classify severity: (i) resource-only → fold the fix into solution (a)/(c); (ii) causes E2 crashes or db contention → promote solution (c) to first.

## Phase 4 — Android native service model (W5–W8)

1. Log `killLnd`'s return value during E5. Expected per code read: always `false` (no `:zeusLndMobile` process exists to kill). If confirmed, the "force stop" ladder is `stopDaemon`-only, and the manifest/no-process finding should be written into the fix design.
2. Audit `LndMobileScheduledSyncWorker` interaction: enable persistent mode / scheduled sync, background the app, watch for a worker-initiated `MSG_START_LND` colliding with a foreground start.
3. Decide (with maintainer, this is Blixt-heritage territory): separate process like Blixt (`android:process`), or keep in-process and delete the dead `killLnd` scan + fix the `thread.run()` FIXME.

**Decision gate**: only proceed to native changes if Phase 0/1 shows failures that JS-level serialization cannot prevent (e.g. daemon survives all stop attempts). Native service changes require full re-test of: background receive, persistent mode notification, scheduled sync, graceful-stop notification action.

## Phase 5 — LDK stop/delete timing (W2, W10)

1. Census every JS call site that can reach the LDK FFI while `buildNode`/`stop` is in flight (`grep -rn "LdkNode\." stores/ backends/ utils/ --include="*.ts"`); classify each as tolerant (retries on `Node not initialized`) or crash/error-surfacing.
2. W10 experiment: script delete-then-recreate of an ldk-node wallet as fast as the UI allows, 10 cycles, watching `ldk_node.log` and the crash buffer. If unlink-during-cleanup errors appear, the fix is to move the delete into native (delete after the Arc-hold) or extend the JS wait — with a real completion signal, NOT a longer sleep.

**Decision gate**: any crash here re-opens the `d416052cd`/`0e2b89164` contract — fix in the native module (both platforms symmetrically; the Kotlin and Swift implementations are deliberate mirrors), never by adding JS-side sleeps.

---

## Solution menu — ranked, with obligations

Ranking reflects maintainer culture: minimal diffs first, big designs only with prior sign-off. Every option below is **funds-adjacent** (a node torn down mid-payment can strand an HTLC or force-close exposure), so all inherit: no drive-by refactors in payment paths, manual 2-platform testing by the author, revert-first if release testing regresses (zeus-change-control).

### 1. `fetchData` lock-hygiene + serialization audit (smallest, do first)
Make lock acquire/release provably paired: single exit point (try/finally) for `fetchLock`; extend the `_navigating` guard (or fold it into one SettingsStore-owned in-flight promise) to cover the three bypass call sites.
- **Theory obligations**: the Phase 2 table with every entry path × every exit → flags outcome; prove the error-screen Restart and transient-retry recovery still work (they depend on `setConnectingStatus(true)` clearing the lock — don't break that contract silently).
- **Blast radius**: Wallet.tsx + SettingsStore only. No storage change, no migration.
- **Gates**: standard PR gates + E1/E2/E4 re-run showing hang rate → 0.

### 2. Cross-implementation teardown fix (W3)
Before starting backend B, stop whichever embedded node type is actually running — e.g. track "last started native node" (type + dir) in SettingsStore and stop it in `fetchData`'s connect branch regardless of the NEW implementation, or stop-old in `onWalletPress` before `updateSettings`.
- **Theory obligations**: prove `stopLnd()` is safe when LND isn't running (it is — status-check path returns early) and `stopLdkNode()` likewise (native stop resolves ok on null node); measure added switch latency; prove the delete flow (which stops nodes itself) doesn't double-stop into an error state.
- **Blast radius**: Wallet.tsx or Wallets.tsx + SettingsStore. No storage change (the tracking flag must stay a non-persisted observable — persisting it would trigger the storage gate, zeus-storage-and-migrations).
- **Gates**: E2 with liveness probe showing old node actually stops; both platforms.

### 3. LDK stop/delete hardening (W2, W10)
Give delete a real completion signal (native-side delete after Arc-hold, or a `stopAndAwaitCleanup` FFI method); make non-tolerant FFI call sites tolerant or gate them on a ready flag.
- **Theory obligations**: preserve the four-step Tokio contract verbatim; enumerate all FFI call sites (Phase 5 census) and prove each is either serialized-after-ready or retry-tolerant.
- **Blast radius**: `LdkNodeModule.kt` + `LdkNodeModule.swift` (must change in lockstep) + `utils/LdkNodeUtils.ts`. Native binary/bindings untouched (pure module-layer change) — if the ldk-node fork itself must change, that's a `fetch-libraries-versions.json` bump with its own process (zeus-build-and-env).
- **Gates**: E3 ×20 both platforms, crash buffer clean.

### 4. Single lifecycle state machine (the end state — design sign-off REQUIRED first)
One owner (e.g. a `NodeLifecycleStore` / manager) with explicit states — `STOPPED, STARTING, RUNNING, STOPPING, DELETING, SWITCHING` — through which ALL start/stop/delete/switch flows pass; `Wallet.tsx` becomes a consumer, not an owner.
- **Theory obligations (non-negotiable before code)**: (i) full state/transition enumeration with the illegal transitions listed; (ii) proof of no orphaned native handle — every `start` has exactly one matching `stop` on every path including error paths and app-kill (invariant: at most one native node per implementation, and after the W3 fix, at most one total); (iii) mapping of ALL existing flags (`connecting`, `fetchLock`, `embeddedLndStarted`, `walletJustCreated`, `_navigating`) onto machine states, with a staged migration so each PR stays reviewable; (iv) re-entrancy story: transitions are serialized on one async queue, concurrent requests coalesce or queue, never interleave.
- **Blast radius**: Wallet.tsx, SettingsStore, Wallets/WalletConfiguration/SeedRecovery/WalletCreationUtils, both utils files. This is exactly the shape of refactor that produced `fdad118ed` — land it as a series of minimal PRs, each independently revertible.
- **Gates**: maintainer design ACK before implementation; full Phase 0 suite as regression harness; both platforms per PR.

### 5. Android native service overhaul (W6–W8)
Fix/delete dead `killLnd`, resolve the `thread.run()` FIXME, decide the process model, fix or remove the broken `unbindLndMobileService`.
- **Theory obligations**: document Blixt-divergence (separate process vs in-process) and its tradeoffs (a separate process makes kill reliable but changes IPC failure modes and memory accounting); prove scheduled-sync and persistent-mode still work.
- **Blast radius**: highest — background receive, notifications, WorkManager. Android-only, which violates the "both platforms behave the same" instinct — extra review scrutiny.
- **Gates**: only after Phase 4's decision gate says JS-level fixes are insufficient; maintainer sign-off; full background-services manual test matrix.

## Fenced wrong paths (do not repeat; hashes verified in this repo)

- **UNSAFE-lifecycle shortcut**: `fdad118ed` (2025-10-24) refactored Wallet's React lifecycle methods and caused infinite loading, fixed only three weeks later by `93227029e`. Fence: no mechanical lifecycle refactors of `Wallet.tsx`; behavior-preserving proof + full Phase 0 suite or don't touch it.
- **Releasing LDK refs on the Tokio thread / resolving stop early**: crash class fixed by `d416052cd` + `0e2b89164` (2026-03-10). Fence: the four-step native contract above is load-bearing; any "simplification" that drops the dedicated thread, the blocking resolve, or the 2s hold re-introduces a hard native crash.
- **Treating the buildNode window as fatal**: before `b54e8f138` (2026-05-17), startup had no ready-wait, so "Node not initialized" from post-start FFI calls could surface as a fatal error (the `node.start()` retry itself predates that commit). Fence: during rebuild windows, retry-with-classification (specific error strings, bounded retries) — but do NOT blanket-retry all FFI errors; only the two sentinels in `utils/LdkNodeUtils.ts`.
- **Sleeps as synchronization**: the codebase already carries load-bearing sleeps (`sleep(2000)` in `Wallets.handleJustDeletedWallet`, `ANDROID_PROCESS_CLEANUP_DELAY_MS = 4000`, the 2s Arc-holds, `STATE_SUBSCRIPTION_SETTLE_MS`). Fence: adding another timeout to make a race "go away" is symptom-patching; every new wait must be a real completion signal (status poll, event, promise) or it will be NACKed. Existing sleeps may only be removed by a change that replaces them with an owned signal.
- **Forward-fixing under release pressure**: regressions found in release testing get reverted same-day, never patched forward (maintainer rule; see zeus-change-control and the same-day-revert record in zeus-failure-archaeology). Fence: if your lifecycle change regresses anything in manual testing, the move is revert, then re-derive.
- **Unattributed duplicate-work "fixes"**: `c71a04ce9` shows the right shape — the commit body names the exact double-fire mechanism (focus fires twice with `initialLoad=true`) before adding the guard. Fence: no guard/lock may be added without a written statement of which concrete interleaving it prevents.

## Validation & promotion protocol

A lifecycle fix is promotable when ALL of the following hold:

1. **Scripted counts, both platforms** (Android device/emulator AND iOS device/simulator — maintainer's manual 2-platform rule, CI builds nothing mobile):
   - E2 wallet-switch: **0 crashes and 0 stuck-spinners in 30 cycles** per platform.
   - E3 delete/create: 0 crashes in 10 cycles per backend.
   - E4 bg/fg storm: 0 duplicate connects, 0 hangs in 20 cycles.
   - E5 JS-reload recovery: reconnect succeeds 10/10 (Android).
2. **Log-assertion checklist** on captured logs: exactly one `triggering` per user action (plus `skipping` lines); one `connect time:` per connect; zero UI-surfaced `Node not initialized`; zero `Fatal signal` in `adb logcat -b crash`; after a cross-implementation switch, the old node's log file goes quiet (post W3 fix).
3. **No stranded flags**: with Phase 1 instrumentation applied locally, every `fetchLock` acquisition has a matching release in every experiment (then strip the instrumentation).
4. **`yarn verify` green** (Test, Lint, Prettier, Typescript Check — see zeus-validation-and-qa). Note stores/views have zero jest coverage; your manual evidence IS the test.
5. **PR structure** (zeus-change-control): minimal diff; no drive-by refactors (especially none in payment paths); PR template intact with the backend testing matrix filled (embedded-lnd + ldk-node at minimum, plus one remote backend to prove the shared flags still work); commit message names the interleaving fixed and cites the relevant hashes; screenshots/recordings of the connect flow if UI-visible.
6. **Change-control routing**: storage untouched (no new persisted keys — else zeus-storage-and-migrations gates apply); new dependencies need prior maintainer discussion; native ldk-node/lnd binary bumps go through `fetch-libraries-versions.json` (zeus-build-and-env).

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by direct code read; commit hashes verified with `git log`. The maintainer priority statement dates from 2026-07-06. Runtime numbers (crash rates) are deliberately absent — Phase 0 produces them.

One-line re-verification commands (run from repo root):

```bash
git log -1 --format="%h %s"                                          # still c5fd094fb?
grep -n "_navigating" views/Wallet/Wallet.tsx                        # re-entry guard still present
grep -n "if (fetchLock) return" views/Wallet/Wallet.tsx              # lock acquire site
grep -n "remove fetchLock on reconnect" stores/SettingsStore.ts      # lock cleared in setConnectingStatus(true)
grep -n "connecting = true" stores/SettingsStore.ts                  # connecting initialized true
grep -n "walletJustCreated" views/Wallet/Wallet.tsx | head -3        # skip-start flag still consumed
grep -n "stopLdkNode()" views/Wallet/Wallet.tsx                      # ldk branch stops only ldk (W3)
grep -rn "stopLnd" views/Wallet/Wallet.tsx | head -3                 # lnd branch stops only lnd (W3)
grep -n "thread.run()" android/app/src/main/java/com/zeus/LndMobileScheduledSyncWorker.java   # W7 FIXME
grep -n "zeusLndMobile" android/app/src/main/java/com/zeus/LndMobileTools.java                # W6 dead scan
grep -n "android:process" android/app/src/main/AndroidManifest.xml   # expect NO output (in-process LND)
grep -n "looks broken" lndmobile/LndMobile.d.ts                      # W8 unbind still flagged broken
grep -n "Thread.sleep(2000)" android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt       # 2s Arc-hold
grep -n "withExtendedLifetime" ios/LdkNodeMobile/LdkNodeModule.swift # iOS mirror of the hold
grep -n "LDK_NODE_NOT_INITIALIZED" utils/LdkNodeUtils.ts             # tolerated sentinel
grep -n "MAX_TRANSIENT_RPC_RETRIES\|TRANSIENT_RPC_RETRY_BASE_MS" utils/LndMobileErrors.ts     # 5 / 2000ms
grep -n "sleep(2000)" views/Settings/Wallets.tsx                     # delete-flow sleep still load-bearing
git log -1 --format="%h %ad %s" --date=short c71a04ce9 d416052cd 0e2b89164 b54e8f138 8fc9698a0 fdad118ed 93227029e
```

If any of these greps come back empty or changed, the corresponding claim above is stale — re-read the file before acting on it.
