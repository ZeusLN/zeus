---
name: zeus-debugging-playbook
description: Load when debugging a Zeus failure - a feature silently does nothing, "TypeError x.then is not a function", settings vanished after update, app stuck on "connecting"/infinite loading, CI Lint or Prettier fails though local eslint passes, Jest "unexpected token" on a new dependency, crash in Animated/layout code after RN upgrade, Hermes RangeError/regex stack overflow, identical error repeats on every retry over Tor, "payment timed out" shown as success, back navigation lands on wrong screen, embedded LND won't start or crashes on restart, keychain/settings weirdness on a new device, gRPC stream write reports success but nothing happens, or node start/stop/delete race crashes. Gives a symptom-to-triage table with discriminating experiments and known trap references.
---

# Zeus Debugging Playbook

Symptom → triage for Zeus's recurring failure modes. Each row names the first thing to check, the likely cause, the fix pattern, and (where one exists) the commit that proves the story. Deep incident narratives live in **zeus-failure-archaeology** — this skill gives you the fast path.

## When to use / When NOT to use

**Use this skill when** something is broken and you need to find out why: a runtime misbehavior, a CI failure you can't reproduce locally, a crash, a hang, a silently-no-op feature.

**Do NOT use this skill for:**

| Need | Go to sibling skill |
|---|---|
| Setting up the dev environment, postinstall/build failures | zeus-build-and-env |
| Running the app, connecting to a node, releases | zeus-run-and-operate |
| How to capture logs / measure / inspect state (tooling recipes) | zeus-diagnostics-and-tooling |
| Full incident histories with root-cause narratives | zeus-failure-archaeology |
| Backend capability matrix, per-backend quirks, adding an RPC | zeus-backends-and-capabilities |
| Keychain contract, settings blob, migration recipes | zeus-storage-and-migrations |
| The node-lifecycle-races live problem (embedded LND / LDK Node start-stop-delete) | zeus-node-lifecycle-campaign |
| What counts as test evidence, `yarn verify` anatomy, adding tests | zeus-validation-and-qa |
| Formal race/migration/dispatch analysis methods | zeus-proof-and-analysis-toolkit |

## Jargon in one line each

- **Backend / implementation**: Zeus talks to 7 kinds of Lightning nodes (`embedded-lnd`, `ldk-node`, `lnd`, `lightning-node-connect`, `cln-rest`, `lndhub`, `nostr-wallet-connect`). The active one is the string `settingsStore.implementation`.
- **BackendUtils dispatch**: `utils/BackendUtils.ts` routes every node call to the active backend class in `backends/`. If the class lacks the method, `call()` **returns `false` synchronously** — it does not throw.
- **`supports*()` flags**: per-backend capability methods (e.g. `supportsMessageSigning()`); views must gate features on these, never on the implementation string.
- **MobX store**: an observable state singleton in `stores/` (e.g. `SettingsStore`); views react to its fields.
- **Keychain**: iOS/Android secure credential storage; Zeus persists nearly everything there via `storage/index.ts`, including the whole settings blob.
- **Hermes**: the JavaScript engine React Native uses in Zeus; it has a shallow native stack, so heavy regex backtracking overflows it.
- **Fabric / New Architecture**: React Native's rewritten rendering layer, ON in Zeus since RN 0.83.1 (commit `d13ebc2cd`); it is stricter about Animated/layout usage than the old renderer.
- **Tor**: anonymity network; Zeus can route node REST calls through it (`enableTor` per node).
- **Embedded LND**: a full LND Lightning node compiled to a mobile library (gomobile) running inside the app; **LDK Node** is the same idea built on the Lightning Dev Kit (Rust, uniffi FFI).
- **Macaroon**: LND's bearer auth token, sent as a header on REST calls.
- **gRPC streaming**: long-lived request channels used by the embedded-LND native layer (Blixt-derived code in `android/app/src/main/java/com/zeus/` and `ios/LndMobile/`).

## Before you debug — 4 questions

1. **Which backend?** Most "bugs" are missing capability gates. Reproduce on (or at least reason about) the specific `implementation`. A feature working on `lnd` and dead on `lndhub` is a gating issue, not a logic issue.
2. **Which platform?** The embedded-LND native layer is separate code per platform (`LndMobileService.java` vs `ios/LndMobile/Lnd.swift`); NWC background services, stealth mode, and keychain-iCloud behavior are platform-specific.
3. **Fresh install or upgrade?** One-shot migrations (the MOD_KEY blocks in `utils/MigrationUtils.ts`) only run once per install. Upgrade-only bugs live there — a fresh install will never reproduce them. See zeus-storage-and-migrations.
4. **Tor on or off?** Tor changes the request path (dedup-cache retention, TLS rules, WebSocket bypass). Toggle it as a discriminating experiment.

Also remember: `stores/`, `views/`, `components/`, and `backends/` have **zero test coverage** (tests exist only for `utils/`, `models/`, `lndmobile/`) — a green `yarn test` proves nothing about a store bug. See zeus-validation-and-qa.

## Triage table

| # | Symptom | First check | Likely cause | Fix pattern |
|---|---|---|---|---|
| 1 | Feature silently does nothing on some backend | `grep -n 'theMethod' backends/<ActiveBackend>.ts` | `BackendUtils.call()` returned `false` (method missing on backend), or the view lacks a `supports*` gate | Gate the view with the right `supports*()`; implement or wrap the method (zeus-backends-and-capabilities) |
| 2 | `TypeError: ... .then is not a function` / `.then of false` | Same as #1 | Same root cause: code awaited/`.then`ed the `false` that `call()` returns for a missing method | Same as #1; log `typeof result` at the call site to confirm |
| 3 | User settings vanished after an update | The `updateSettings({...})` call that shipped in the update | `SettingsStore.updateSettings` is a **shallow top-level merge** — passing a partial nested group replaces the whole group | Spread the existing group: `updateSettings({ payments: { ...settings.payments, newField } })` (zeus-config-and-flags for the axes) |
| 4 | App stuck on "connecting" / infinite loading | `fetchLock` and `connecting` values in `views/Wallet/Wallet.tsx` | Re-entrancy guard never released, or a lifecycle refactor changed when `getSettingsAndNavigate()` runs | Ensure every exit path releases `fetchLock`; incident `fdad118ed` → fixed by `93227029e` |
| 5 | CI **Lint** job fails though `eslint .` passes locally | `yarn lint` locally (not bare eslint) | `yarn lint` = `eslint . && yarn run test check-styles.test.ts --testPathIgnorePatterns=` — the second half bans `themeColor()` inside static `StyleSheet.create` in any `.tsx` | Move the themed color out of the static stylesheet (inline style or style function) |
| 6 | Prettier check fails with a reformat that looks wrong | `npx prettier --version` → must print `2.4.1` | You formatted with a global/modern prettier; repo pins `prettier@2.4.1` (tabWidth 4, singleQuote, trailingComma none) | Re-format with the repo-local binary: `yarn prettier --write <file>` |
| 7 | Jest: `SyntaxError: Unexpected token` on a new dependency | `transformIgnorePatterns` in `package.json` (jest block) | New ESM dep isn't in the transform whitelist, so Babel skips it | Add the package name inside the `node_modules/(?!(...))` group |
| 8 | Crash in Animated/layout code after an RN upgrade | Was the pattern written pre-New-Architecture? | Fabric (ON since `d13ebc2cd`, RN 0.83.1) rejects patterns the old renderer tolerated | Restructure per `f08bfc7c5` (WalletHeader Animated) and `2c55e4f89` (keypad baseline layout) |
| 9 | Hermes `RangeError` / stack overflow on string matching | Input length at the regex call site | Hermes regex backtracking overflows on long inputs | Length-cap before matching, like `MERCHANT_QR_MAX_LEN = 500` in `utils/handleAnything.ts` (`5c451839d`) |
| 10 | Identical error repeats on every retry (Tor node) | The `calls` Map in `backends/LND.ts` / `backends/CLNRest.ts` | Tor branch of `restReq` deletes the dedup-cache entry only in `.then` — a **rejected** promise stays cached and is replayed | Retries work after reconnect: `setConnectingStatus(true)` calls `BackendUtils.clearCachedCalls()`. Real fix: delete cache entry on rejection too (`backends/*` is funds-touching — minimal diff, discuss first; see zeus-change-control) |
| 11 | "payment timed out" but payment shows as success (or is handled as one) | `result.payment_error` on the resolved value | LND REST `payLightningInvoice` races a timer that **resolves** with `{ payment_error: localeString('views.SendingLightning.paymentTimedOut') }` (a locale-dependent "Payment timed out…" message) — errors arrive success-shaped | Always check `payment_error` on resolved LND payment results; never treat resolution as success |
| 12 | Back navigation lands on the wrong screen / stale params | Does the code call `navigation.navigate()` to go "back"? | react-navigation 7: `navigate` pushes/reuses unpredictably | Use `navigation.popTo('Screen', params)` (PR #2192, merge `7abc7a971`); type with `NativeStackNavigationProp` |
| 13 | Embedded LND won't start / crashes on restart | Which DB backend: `isSqlite` per node → `db.backend=sqlite\|bolt` in `utils/LndMobileUtils.ts` | SQLite/Bolt DB-backend saga; restart crash fixed in `3e04e6bf2` (#4013) | Read the real logs first — see "Getting embedded-LND logs" below |
| 14 | Keychain/settings weirdness on a new device (old wallets appear, wrong data) | Did the data come from iCloud keychain sync? | Orphaned pre-migration keychain entries are retained **by design** (`deleteFromOldKeychain` is a deliberate no-op); iCloud-synced copies caused the 2025–26 saga | Do NOT "fix" storage yourself — storage changes are gated. Go to zeus-storage-and-migrations |
| 15 | gRPC stream write "succeeded" but nothing happened (embedded LND) | `LndMobileService.java:279` and `ios/LndMobile/Lnd.swift:334` | Android swallows the send exception (`catch (Throwable) { /* TODO */ }`) and reports success anyway; iOS `try write?.send(bytes)` may not throw on failure (TODO: BOOL return) | Don't trust stream-write callbacks in the Blixt-derived layer; verify the effect via a read call |
| 16 | Crash during wallet start/stop/delete/switch (Tokio panic, native crash) | Sequence of node lifecycle calls | Node lifecycle races — the hardest live problem | Go to zeus-node-lifecycle-campaign; ref fixes `d416052cd`, `0e2b89164` |

## Discriminating experiments (rows that need more than one line)

### Rows 1–2: missing backend method vs missing gate

`BackendUtils.call()` in `utils/BackendUtils.ts` returns `false` synchronously for a method the active backend lacks — the dispatcher code and full consequence catalog are owned by **zeus-backends-and-capabilities §1**. Discriminate in three steps:

```sh
# 1. Is the method on the active backend class? (LND is the implicit base;
#    EmbeddedLND and LndHub extend it — check the parent too)
grep -n 'theMethod' backends/LndHub.ts backends/LND.ts

# 2. Is there a dispatch wrapper at all? (a typo'd name silently no-ops)
grep -n 'theMethod' utils/BackendUtils.ts

# 3. At runtime: log what came back
console.log(typeof result, result); // "boolean false" => missing method
```

Known dead dispatch as of 2026-07-06: `payLightningInvoiceStreaming` is declared in `utils/BackendUtils.ts` but implemented by **no** backend — it always returns `false`. Inheritance leaks (un-overridden LND REST methods firing on EmbeddedLND) are in zeus-backends-and-capabilities.

### Row 3: shallow-merge settings loss

`stores/SettingsStore.ts` `updateSettings` does `{ ...existingSettings, ...newSetting }` — top level only. `updateSettings({ privacy: { lurkerMode: true } })` erases every other `privacy` field for the user. Discriminating experiment: diff the settings blob before/after the call (see zeus-diagnostics-and-tooling for inspecting it). If a nested group shrank, you found it. Repair for already-shipped damage requires a migration — zeus-storage-and-migrations, and note storage changes are maintainer-gated (zeus-change-control).

### Row 4: stuck connecting

`views/Wallet/Wallet.tsx` `fetchData()` opens with:

```ts
if (fetchLock) return;
SettingsStore.fetchLock = true;
```

and `SettingsStore.connecting` initializes `true`. `getSettingsAndNavigate()` runs on Wallet-screen focus only for initial load, POS exit, or an explicit settings refresh (`this.state.initialLoad || SettingsStore.posWasEnabled || SettingsStore.triggerSettingsRefresh`), and is skipped while the in-flight `_navigating` guard flag is set. If any code path between lock-set and lock-release throws unhandled or early-returns, the app hangs on the loading state forever — and because focus events won't re-trigger the call outside those three conditions, nothing retries it. `SettingsStore.setConnectingStatus(true)` clears `fetchLock` and the request cache — that's why "go to settings and back" sometimes unsticks it (a diagnostic signal, not a fix). Trap story: the UNSAFE-lifecycle refactor `fdad118ed` caused exactly this; `93227029e` fixed it three weeks later. Deep narrative: zeus-failure-archaeology.

### Rows 5–7: CI failures that lie about their cause

Green PR = 4 checks (Test, Lint, Prettier, Typescript Check) = `yarn verify`. Anatomy and jest traps are owned by zeus-validation-and-qa; the three that masquerade as something else:

- **Lint** runs a jest test: `check-styles.test.ts` (repo root) is excluded from `yarn test` via `testPathIgnorePatterns` and re-included by `yarn lint` with `--testPathIgnorePatterns=`. Failure text lists the offending `.tsx` files.
- **Prettier/Lint double failure**: prettier violations also fail ESLint (`prettier/prettier` is an `error` rule in `eslint.config.js`). Fix formatting once, both clear.
- **Test** on a new dep: extend the `transformIgnorePatterns` whitelist in `package.json`; current members include `react-native`, `@react-native`, `react-native-blob-util`, `nostr-tools`, `@noble`, `@scure`, `uuid`, etc.

### Row 10: Tor request dedup cache retains rejections

Both `backends/LND.ts` and `backends/CLNRest.ts` keep a module-level `const calls = new Map<string, Promise<any>>()` keyed by `url + JSON.stringify(body)`. The non-Tor branch deletes the entry on both success and failure (a `.catch` on the raced promise). The Tor branch deletes only in `.then`:

```ts
doTorRequest(...).then((response: any) => {
    calls.delete(id);   // no .catch — a rejection stays cached
    return response;
})
```

Discriminating experiment: same request, Tor off → retry gets a fresh attempt; Tor on → retry replays the identical rejection instantly (suspiciously fast failure = cached). Cache is cleared on reconnect (`SettingsStore.setConnectingStatus(true)` → `BackendUtils.clearCachedCalls()`).

### Row 13: embedded LND startup — and getting real logs

`lndmobile/index.ts` `readLndLog` is a stub (`return [''];`, marked `TODO remove`) — do not build diagnostics on it. The actual log path is what `views/Settings/EmbeddedNode/LNDLogs.tsx` does: `NativeModules.LndMobileTools.tailLog(...)` plus the `'lndlog'` event listener. In-app: the embedded node settings expose the LND Logs screen. Full log-capture recipes: zeus-diagnostics-and-tooling. The DB backend is chosen per node (`isSqlite` → `db.backend=sqlite|bolt` written into lnd.conf by `utils/LndMobileUtils.ts`); the SQLite/Bolt history (`ef4a42112` → `3c6f4175e` → `d475ef2b4` → `3e04e6bf2`) is chronicled in zeus-failure-archaeology.

### Row 15: stream-write success is unverifiable

`android/app/src/main/java/com/zeus/LndMobileService.java` (line 279 as of 2026-07-06):

```java
try {
  s.send(payload);
} catch (Throwable error) {
  // TODO(hsjoberg): Handle errors
}
// ...then unconditionally reports MSG_GRPC_STREAM_WRITE_RESULT
```

`ios/LndMobile/Lnd.swift` (line 334): `try write?.send(bytes) // TODO(hsjoberg): Figure out whether send returns a BOOL?` — thrown errors are forwarded, but a `false`-returning send would still call back success. Verification pattern: after any stream write you care about, confirm the effect with an independent read RPC.

## Grep hygiene

When searching the repo for debt markers, symbols, or error strings, exclude generated and vendored code or you'll drown in noise:

```sh
grep -rn "TODO" . \
  --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=zeus_modules \
  --exclude-dir=proto --exclude-dir=android --exclude-dir=ios
```

- `ios/LdkNodeMobile/LDKNode.swift` and `android/app/src/main/java/org/lightningdevkit/ldknode/ldk_node.kt` are **uniffi-generated** bindings (18 TODO hits each as of 2026-07-06) — never "fix" them by hand.
- `proto/lightning.js` is generated protobuf output.
- `zeus_modules/` is vendored (lnc-rn has its own `node_modules` inside it).
- `utils/AddressUtils.test.ts` contains `XXX` inside a base64 PSBT fixture (~line 923) — a false positive for placeholder hunts.
- `fetch-libraries.sh` defines a shell function literally named `jq()` (it's python3) — misleading grep target.

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by reading the cited files and running the commands below. All cited commit hashes verified as ancestors of that commit via `git merge-base --is-ancestor <hash> HEAD`.

Re-verification one-liners for volatile facts:

| Fact | Re-verify with |
|---|---|
| `call()` returns `false` for missing method | `grep -n 'return false' utils/BackendUtils.ts` |
| `payLightningInvoiceStreaming` still unimplemented | `grep -rn payLightningInvoiceStreaming backends/` (expect no hits) |
| `updateSettings` still shallow merge | `grep -n -A6 'public updateSettings' stores/SettingsStore.ts` |
| `fetchLock` guard in Wallet.tsx | `grep -n 'fetchLock' views/Wallet/Wallet.tsx` |
| `yarn lint` includes check-styles | `grep -n '"lint"' package.json` |
| Prettier pin 2.4.1 | `grep -n '"prettier"' package.json` |
| Jest transform whitelist members | `grep -n -A2 transformIgnorePatterns package.json` |
| Merchant-QR 500-char cap | `grep -n MERCHANT_QR_MAX_LEN utils/handleAnything.ts` |
| Tor dedup cache deletes only in `.then` | `grep -n -A16 'useTor === true' backends/LND.ts backends/CLNRest.ts` |
| Cache cleared on reconnect | `grep -n clearCachedCalls stores/SettingsStore.ts` |
| Timeout resolves with `payment_error` | `grep -n -B2 -A6 forcedTimeout backends/LND.ts` |
| `readLndLog` still a stub | `grep -n -A3 'export const readLndLog' lndmobile/index.ts` |
| Android stream-write swallow | `grep -n -A3 's.send(payload)' android/app/src/main/java/com/zeus/LndMobileService.java` |
| iOS stream-write BOOL doubt | `grep -n 'returns a BOOL' ios/LndMobile/Lnd.swift` |
| Incident hashes still resolve | `git log --oneline -1 <hash>` for `fdad118ed 93227029e f08bfc7c5 2c55e4f89 7abc7a971 d416052cd 0e2b89164 d13ebc2cd 3e04e6bf2 5c451839d` |
| No tests for stores/views/components/backends | `find stores views components backends -name '*.test.*'` (expect empty) |
