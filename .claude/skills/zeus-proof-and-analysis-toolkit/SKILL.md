---
name: zeus-proof-and-analysis-toolkit
description: 'First-principles analysis recipes for Zeus — how to PROVE a change correct instead of merely shipping it. Load when you need to: analyze a race condition or lifecycle crash (start/stop/delete/focus interleavings, Tokio panics, "Node not initialized", fetchData re-entrancy); prove a settings/keychain migration correct across all persisted-state shapes (fresh install, legacy blob, zeus-settings-v2, iCloud restore, one-shot MOD_KEY flags); audit whether a BackendUtils method is implemented/gated across all 7 backends (supports* gating, inherited-leak, silent false); verify satoshi/msat amount or fee arithmetic; write a spec-conformance test with known-good vectors (BOLT11, TLV, key derivation); prove a bug fix with a failing-test-first regression test; or verify reproducible Android build equivalence. Keywords: race analysis, interleaving table, migration proof, idempotency, dispatch audit, capability leak, unit trace, test vector, regression test, reproducible build.'
---

# Zeus proof and analysis toolkit

Zeus moves real bitcoin. CONTRIBUTING.md requires tests that would have caught the bug ("Test Coverage") and proof-of-work evidence for first-time contributors; this skill generalizes that into an evidence discipline: correctness claims come with an enumeration, a trace, a test, or a byte-for-byte comparison. This skill is the catalog of the analysis methods that produce that evidence, each written as a recipe with a worked example from this repo's actual history (all commit hashes verified against `master`).

"Prove it, don't just install it" here means: before you claim a fix works, you can name the full space of states/interleavings/backends/inputs it must handle, show which cell of that space the bug lived in, and show a check (test, table, diff) that would have caught it and now guards it.

## When to use / When NOT to use

Use this skill when you must **establish that something is correct**: a race is closed, a migration is safe, a dispatch is complete, an amount path is exact, a decoder matches the spec, a fix cannot regress, a build is reproducible.

Do NOT use this skill for:

| Need | Use instead |
|---|---|
| How changes are classified/gated, PR and review rules, storage-change sign-off | zeus-change-control |
| Writing/locating migrations, keychain contract details, iCloud rules | zeus-storage-and-migrations |
| The 7-backend capability matrix and per-backend quirks | zeus-backends-and-capabilities |
| What happened historically (full incident chronicle) | zeus-failure-archaeology |
| `yarn verify` anatomy, jest configuration traps, adding tests mechanically | zeus-validation-and-qa |
| Measuring at runtime: logs, dev tools, inspection scripts | zeus-diagnostics-and-tooling |
| The live node-lifecycle-races campaign (decision-gated work plan) | zeus-node-lifecycle-campaign |
| Lightning/Bitcoin domain theory (BOLT11 fields, LSPS, Cashu semantics) | zeus-lightning-reference |
| Evidence bar / idea lifecycle / adversarial refutation discipline | zeus-research-methodology |

This skill owns the **methods**; siblings own the facts those methods operate on.

## Terms used below (defined once)

- **sat / msat** — satoshi (1e-8 BTC) / millisatoshi (1/1000 sat). Lightning protocols speak msat; most Zeus UI speaks sats. Every amount variable has exactly one of these units.
- **BOLT11** — the Lightning invoice encoding spec (bech32 string starting `lnbc…`). **TLV** — type-length-value binary encoding used in Lightning custom records.
- **LSP** — Lightning Service Provider; sells inbound channels. **Zero-conf fee** — the fee an LSP deducts for a just-in-time channel, subtracted from the invoice amount.
- **Backend** — one of Zeus's 7 node implementations dispatched through `utils/BackendUtils.ts` (`lnd`, `embedded-lnd`, `ldk-node`, `lightning-node-connect`, `cln-rest`, `lndhub`, `nostr-wallet-connect`).
- **Keychain** — the OS secure credential store (iOS Keychain / Android Keystore), Zeus's canonical persistence via `storage/index.ts`. **Settings blob** — the single JSON document under key `zeus-settings-v2` holding all wallets and settings.
- **MobX observable** — reactive state object; Zeus stores are MobX classes, views re-render when observables change.
- **Tokio** — the Rust async runtime inside the LDK Node native library. Dropping its last reference **on one of its own worker threads** panics Rust ("runtime dropped from within a runtime") and kills the app.
- **FFI / UniFFI** — foreign-function interface; the generated Kotlin/Swift bindings that bridge React Native to Rust (LDK Node, Cashu).
- **One-shot migration flag (MOD_KEY)** — a key in legacy EncryptedStorage marking that a settings migration already ran, so it never runs twice.

---

## Recipe 1 — Race / interleaving analysis

**When to use:** any crash or corruption that only reproduces "sometimes"; any change to node start/stop/delete, wallet create/switch, or `views/Wallet/Wallet.tsx` connection logic; any native module holding a long-lived resource (node handle, file, socket).

**Steps**

1. **Enumerate the trigger events.** In Zeus the recurring set is:
   - *Wallet screen focus* — `handleFocus` in `views/Wallet/Wallet.tsx` runs `getSettingsAndNavigate()` → `fetchData()` on Wallet-screen focus when `initialLoad`, `posWasEnabled`, or `triggerSettingsRefresh` is set (guarded by an in-flight `_navigating` flag).
   - *App foreground* — `handleAppStateChange('active')` in the same file, again calling `getSettingsAndNavigate()`.
   - *Wallet creation* — `createOnboardingWallet` in `utils/WalletCreationUtils.ts` (may build the node itself, then sets `settingsStore.walletJustCreated = true` so Wallet.tsx skips re-init).
   - *Wallet deletion / switch* — `views/Settings/WalletConfiguration.tsx` (stop node, delete on-disk dirs, update `settings.nodes`).
   - *Reconnect* — `SettingsStore` clears `fetchLock` when connection settings change (see `fetchLock = false` near the bottom of `stores/SettingsStore.ts`).
2. **Enumerate the shared mutable state** each event touches: the native node reference (Kotlin/Swift module field), `SettingsStore.connecting` (initialized `true`), `SettingsStore.fetchLock`, `SettingsStore.walletJustCreated`, on-disk node directories, and the ~12 stores `fetchData` resets. Grep the guards:
   ```bash
   grep -n "fetchLock\|walletJustCreated\|connecting" views/Wallet/Wallet.tsx | head -30
   ```
3. **Build the interleaving table.** Rows = ordered steps of operation A (e.g. delete: `stop node → release ref → delete dirs → clear settings`); columns = every other event that can fire between two rows (focus, foreground, create, second delete). For each cell ask: *what state does the interloper observe, and is that state valid?*
4. **Classify each unsafe cell**: needs serialization (lock/flag/blocking await), or can be **tolerated** (retry on a known transient error), or is unreachable (prove why — e.g. `fetchLock` early-return at the top of `fetchData`).
5. **Verify with a discriminating experiment** — add temporary interleaving logs (the repo's own pattern: the `[Wallet] handleFocus: triggering getSettingsAndNavigate (…connecting=…)` lines in Wallet.tsx were added exactly for this) and force the ordering by hand (delete-then-immediately-recreate; background/foreground during startup). See zeus-diagnostics-and-tooling for log capture.

**Worked example — the LDK Node delete crash (`d416052cd` + `0e2b89164`, both 2026-03-10) and buildNode race (`b54e8f138` + `8fc9698a0`, 2026-05-17).**

Symptom: deleting an LDK Node wallet crashed the app in Rust. Root cause: the native `stop` handler released the **last reference** to the Rust `Node` object on a Tokio worker thread, so the Tokio runtime destructor ran on its own thread → panic. The interleaving table that would have caught it has one row that native code hid from JS: *"who drops the final Arc reference, and on which thread?"* — a critical section invisible at the TypeScript layer.

The fix history is itself a lesson in incomplete interleaving analysis:

- `d416052cd` released the ref off-thread but **resolved the JS promise immediately**, stopping the node in the background. That opened a new unsafe cell: *delete-then-create* — JS proceeded to delete wallet files and build a new node while the old one was still stopping.
- `0e2b89164`, same day, closed that cell: block on `stop()` (on a dedicated non-Tokio thread) **before** resolving, hold the reference ~2s afterward so internal Tokio tasks drop their references first, and add an `NSLock` around the node field on iOS. Read both diffs: `git show d416052cd` / `git show 0e2b89164`.

The buildNode race (fixed 2026-05-17 in two commits three minutes apart): `createOnboardingWallet` builds the node, then Wallet.tsx `fetchData` re-runs on focus and calls into the module while native `buildNode` has **cleared the node reference up-front** and is rebuilding on a background queue — every call in that window rejects with "Node not initialized". Fix = *tolerate* rather than serialize: `b54e8f138` added `waitForLdkNodeReady` in `utils/LdkNodeUtils.ts`, which retries `status()` every 500 ms treating "Node not initialized" and "not running yet" as retryable; `8fc9698a0` added the `walletJustCreated` flag to skip redundant re-init. The docstring on `waitForLdkNodeReady` documents the race explicitly — that is the standard: a tolerated race must be written down at the tolerance point.

**What counts as done:** the table exists in your PR description or analysis notes; every event×step cell is labeled serialized / tolerated (with the retryable error named) / unreachable (with the guard named); thread-affinity of native resource release is stated explicitly; you reproduced the bad interleaving at least once before the fix and not after.

---

## Recipe 2 — Migration correctness proof

**When to use:** any change to `utils/MigrationUtils.ts`, `stores/SettingsStore.ts` load/save paths, keychain keys, or default values for existing users. Note: these changes are **gated** — maintainer sign-off plus a migration plan is mandatory (see zeus-change-control); this recipe produces the proof that goes in that plan.

**Steps**

1. **Enumerate the persisted-state space (rows).** Minimum rows for Zeus:
   | # | State on disk before app launch |
   |---|---|
   | 1 | Fresh install — nothing stored |
   | 2 | Legacy blob only — `zeus-settings` in EncryptedStorage, no v2 |
   | 3 | v2 blob — `zeus-settings-v2` in keychain (the common case) |
   | 4 | iCloud-restored device — old un-prefixed cloud-synced keychain entries exist, local `zeus:` entries do not |
   | 5 | Multi-wallet — `settings.nodes[]` has several entries, mixed implementations |
   | 6 | Post-duress — `settings.nodes` nulled but on-disk node dirs / Cashu DB / orphaned keychain copies survive |
   Add rows for any state your change introduces. Columns = each migration function, in **actual execution order**.
2. **Pin the execution order from the code, not from memory.** Verified order in `SettingsStore.getSettings`:
   `keychainCloudSyncMigration()` runs **first**, before any settings read → then try `Storage.getItem('zeus-settings-v2')` → if present: `migrateRgsDefaultToZeus` + `migrateInvoiceExpiryDisplay` run on the parsed object → **else** fall back to legacy `zeus-settings` → `legacySettingsMigrations()` (the MOD_KEY chain) → `storageMigrationV2()`. Consequence: **a repair placed only in `legacySettingsMigrations` never runs for any user already on v2.**
   ```bash
   grep -n "keychainCloudSyncMigration\|legacySettingsMigrations\|storageMigrationV2\|migrateInvoiceExpiryDisplay" stores/SettingsStore.ts
   ```
3. **Prove each cell terminates in a valid state.** For every row × column: does the migration fire? If yes, is the result valid AND is the source state gone or harmless? If no, is skipping correct for that row?
4. **Prove one-shot flag idempotency.** Each MOD_KEY block must be a no-op on second run (flag read → skip) and the flag must be set only after the mutation persisted (`await settingsStore.setSettings(...)` — un-awaited setSettings was a real bug, fixed in `d8e648b58`). Run the mental test "app killed between mutation and flag write": re-running the mutation must be safe.
5. **Check the two poison patterns:** (a) passing a `JSON.stringify`'d payload to `setSettings` — corrupts the MobX observable (issue #4150, fixed `7ed901a10`, guarded by a test in `utils/MigrationUtils.test.ts` asserting the persisted argument is not a string); (b) shallow `updateSettings` merges destroying sibling keys in nested groups (see zeus-storage-and-migrations).

**Worked example A — the #4149 double-repair (missing column cell).** `26d4215ea` (2026-05-30) added the "3600 hours" invoice-expiry display repair as `MOD_KEY9 = 'invoices-expiry-display-fix'` **inside `legacySettingsMigrations`** — which only executes when the v2 blob is absent (row 2). Every already-upgraded user (row 3, the majority) never ran it. The repair had to be shipped a second time: `e8e5b8811` (2026-06-01) moved it onto the v2 load path as the shared `migrateInvoiceExpiryDisplay` (removing the v1 MOD_KEY9 block) — under the ORIGINAL flag key. A third repair for pre-Feb-2024 installs that never stored `expirySeconds` then bumped the flag to `invoices-expiry-display-fix-v2` (`a7860aa96`, merged `f7b2c30a8`, PR #4149, 2026-06-08). The 6×N table makes the first miss a mechanical catch: cell (row 3 × repair) was empty. Bonus: the first attempt also passed `JSON.stringify(newSettings)` to `setSettings` — poison pattern (a) — later fixed by `7ed901a10`.

**Worked example B — the iCloud keychain saga (missing row).** The dated timeline with hashes is owned by **zeus-failure-archaeology FA-1** — cite that, don't retell it. The proof-relevant lesson: the Dec 2025 migration rewrote keychain entries as local-only (`cloudSync: false`) but never deleted the old `kSecAttrSynchronizable` cloud copies, and row 4 of the table ("iCloud-restored new device") was never analyzed — on a new device, iCloud repopulated the old entries and the migration faithfully resurrected stale wallet data. Deletion attempts followed and were ultimately disabled. Current master policy: `deleteFromOldKeychain` in `utils/MigrationUtils.ts` is a deliberate no-op ("safety measure"); orphaned pre-migration copies persist by design and `utils/KeychainRecoveryUtils.ts` depends on them. **Do not "fix" this** — it is a policy decision, and reversing it goes through change control.

The lesson for your table: a migration's source state is a **live replica** if the OS can regenerate it (iCloud sync). "Copied to new location" does not empty the source cell; either delete it (with its own proof) or document it as a permanent row.

**What counts as done:** the full table with every cell justified; idempotency argument for each new flag (including kill-between-steps); explicit statement that both the legacy and v2 load paths are covered (or why one is N/A); jest cases in `utils/MigrationUtils.test.ts` for the new blocks; the plan reviewed under the storage-change gate.

---

## Recipe 3 — Dispatch-completeness audit

**When to use:** adding a method to `utils/BackendUtils.ts`; adding a `supports*` capability; investigating a crash like `false.then is not a function` or a feature silently doing nothing on one backend.

**Background (verified):** `BackendUtils.call(funcName)` returns **`false` synchronously** when the active backend class lacks the method — no throw, no rejected promise (`utils/BackendUtils.ts`, the `if (!cls[funcName]) return false;` line). `EmbeddedLND` and `LndHub` `extend LND`, so a method or flag **absent** from those two files is **inherited from LND**, not absent. The other four backends (`CLNRest`, `LdkNode`, `LightningNodeConnect`, `NostrWalletConnect`) are standalone.

**Steps — the exact greps**

```bash
# 1. Does the dispatcher wrapper exist? (a typo'd name silently no-ops)
grep -n "myMethod" utils/BackendUtils.ts

# 2. Who implements or overrides it? Absence in EmbeddedLND.ts/LndHub.ts = inherited from LND.ts
grep -n "myMethod" backends/*.ts

# 3. Confirm the inheritance edges (do not assume)
grep -n "extends" backends/*.ts     # EmbeddedLND extends LND; LndHub extends LND

# 4. Every call site, and what gates it
grep -rn "BackendUtils.myMethod(" views/ components/ stores/ utils/

# 5. For each call site: is it reachable only behind a supports* gate?
grep -rn "supportsMyFeature" views/ components/ stores/
```

Build the 7-row table for the method: for each of `lnd`, `embedded-lnd`, `ldk-node`, `lightning-node-connect`, `cln-rest`, `lndhub`, `nostr-wallet-connect`, label the method **implemented** (own definition), **deliberately absent** (explicit `=> false` override or no definition on a standalone class, with a gate protecting every call site), or **inherited-leak** (subclass of LND with no override where LND's behavior is wrong for it). Then prove every view call site is unreachable when the capability is false.

**Worked example — the LndHub `supportsChannelFundMax` inherited-leak (present on master today).** Grep output: explicit `=> true` in `LND.ts`, `EmbeddedLND.ts`, `CLNRest.ts`, `LightningNodeConnect.ts`, `LdkNode.ts`; explicit `=> false` in `NostrWalletConnect.ts`; **no override in `LndHub.ts`** → LndHub inherits `true` from LND even though a custodial LNDHub account cannot fund channels at all. The only view call site is `views/OpenChannel.tsx`, and the leak is currently *latent* because LndHub sets `supportsChannelManagement = () => false`, which gates every route into that screen — but the flag itself is wrong, and any new call site trusting `supportsChannelFundMax()` alone would misbehave on LndHub. Classify, then either fix the override or record the masking gate. (Cross-backend crash history and the full capability matrix: zeus-backends-and-capabilities.)

Second pattern worth grepping for — **dead dispatch**: `payLightningInvoiceStreaming` is declared in `utils/BackendUtils.ts` but implemented by zero backends (`grep -rn "payLightningInvoiceStreaming" backends/` returns nothing), so it always returns `false`. A completeness audit of a new method should confirm you did not just add another one of these.

**What counts as done:** the 7-row table with a file:line evidence pointer per row; every call site listed with its gate; each inherited-leak either fixed (override added) or documented with the exact masking condition; for LND-family version-gated flags, a note on behavior **before** `getNodeInfo` resolves (version is unknown then).

---

## Recipe 4 — Amount / fee arithmetic verification

**When to use:** anything that computes, converts, or displays an amount or fee — invoice creation, LSP wrapping, routing-fee limits, swaps, Cashu melts.

**Steps**

1. **Unit-trace the path.** Write every variable in the path with its unit annotated (`value: sats (string)`, `amount_msat: msat (number)`, …). Each `×1000` / `÷1000` must sit at a named boundary (usually the wire). A path with an unannotatable variable is unproven.
2. **BigNumber everywhere.** Amount arithmetic uses `bignumber.js` (imported in 16+ utils/stores incl. `AmountUtils`, `Bolt11Utils`, `FeeStore`, `InvoicesStore`). Never use float math on msat values; msat quantities exceed float-safe display assumptions and decimal sats (e.g. `123.456` sats) are legal inputs.
3. **Test the boundary values:** `0`, `1`, `999`, `1000`, `1001` sats (the fee-rule boundary), amounts with msat remainders (`x.5` sats), and fee == amount.
4. **Know the fee rule (verified in `utils/FeeUtils.ts`):** `calculateDefaultRoutingFee(amount)` returns `amount * 0.05` rounded (`DEFAULT_ROUTING_FEE_PERCENT = 0.05`) when `amount > 1000` sats, but returns **the full amount** (i.e. a 100% fee limit) when `amount <= 1000` — tiny payments may cost up to themselves in routing fees. `views/PaymentRequest.tsx` mirrors the same boundary: `requestAmount > 1000` selects the percent fee option, otherwise fixed. Tests pinning this: `utils/FeeUtils.test.ts` (`1000 → '1000'`, `10000 → '500'`).
5. **Check error-shape traps on the same path** — e.g. LND REST payment timeouts *resolve* success-shaped with `{payment_error: …}` (see zeus-backends-and-capabilities); an amount proof that ends at "the call resolved" has not proven payment.

**Worked example — the Flow LSP wrapped-invoice amount mutation (`stores/InvoicesStore.ts` + `stores/LSPStore.ts`, verified on master).** Unit trace for "user requests an invoice for `value` sats with LSP enabled":

| Step | Code | Unit |
|---|---|---|
| 1 | user input `value` | sats (string) |
| 2 | `lspStore.getZeroConfFee(Number(new BigNumber(value).times(1000)))` | **msat** over the wire (`amount_msat` in the POST body) |
| 3 | LSPStore stores `zeroConfFee = parseInt(fee_amount_msat / 1000)` | back to **sats** |
| 4 | if `value > zeroConfFee`: `req.value = new BigNumber(value).minus(zeroConfFee)` | sats — **the created invoice is for less than the user asked** |
| 5 | `getZeroConfInvoice(...)` wraps it; `jit_bolt11` replaces the payment request | — |
| 6 | on wrap failure: silently fall back to the **unwrapped** invoice (error state cleared) | — |
| 7 | lnurl-withdraw callback uses `qs.pr = jit_bolt11 || invoice.getPaymentRequest` | must be the wrapped one when it exists |

Three provable claims fall out: (a) the msat↔sat conversions occur exactly at steps 2–3; (b) the amount the payer pays ≠ the amount the node receives, by design — any display or bookkeeping code comparing them must add `zeroConfFee` back; (c) step 6 means "invoice created" does not imply "channel will be opened" — degradation is silent. If your change touches this path, your proof must state which of the three it preserves.

**What counts as done:** a unit-annotated trace table like the above in the PR; BigNumber (or integer msat) for every operation; a colocated jest test exercising the boundary set from step 3; no float appears between user input and wire encoding.

---

## Recipe 5 — Crypto / protocol conformance

**When to use:** writing or modifying any encoder/decoder or key-derivation function — invoice parsing, TLV records, bech32 variants, signature schemes, seed→key paths.

**Steps**

1. **Prefer the spec's own vectors.** BOLT11 ships worked examples (`11-payment-encoding.md` in the lightning/bolts repo). Pin them as constants with a comment citing the source.
2. **When the spec has no vectors, capture them from a reference implementation** (lnd/CLN decode output, or the library version currently in production) and pin the exact hex. The vector then *defines* the contract across future library swaps.
3. **Test failure modes too:** truncated input, wrong prefix, bad checksum — assert the exact error.
4. **If the decoder caches or lazies, test that behavior explicitly** — caching bugs are conformance bugs (a mutated cached object corrupts every later decode).

**Where the known-good vectors live in this repo (all verified):**

| File | What it pins |
|---|---|
| `utils/Bolt11Utils.test.ts` | BOLT11 **spec reference vectors** (the `lnbc2500u` hashed-description example and the no-amount example, with source URL in comments), including the expected payee pubkey `BOLT11_SPEC_PAYEE` recovered via secp256k1 signature recovery; regtest/signet fixtures; amount-prefix parsing (`1230n` = 123 sats = 123000 msat); **lazy-getter semantics** — a `jest.spyOn(secp, 'recoverPublicKey')` asserts recovery runs zero times unless `destination` is read, and exactly once when read repeatedly |
| `utils/SigningUtils.test.ts` | secp256k1 DER-signature vectors, including the canonical `privKey = 1 → pubkey = G`, `hash = SHA256("")` case, plus invalid-key rejections |
| `utils/VssAuthUtils.test.ts` | mnemonic → BIP-32 `m/130'/0'` VSS auth-key vectors, commented "captured against bip39@3.1.0 … MUST remain stable across any BIP-39 library swap" — the textbook example of step 2 |
| `utils/ClinkUtils.test.ts` | `noffer` bech32-TLV round-trip tests with a local `encodeTLV` helper (round-trip style — weaker than pinned vectors; if you touch the wire format, add pinned hex) |
| `utils/AddressUtils.test.ts`, `utils/CashuUtils.test.ts` | address-format and cashu-token fixtures for the input-router paths |

**Worked example — verifying an invoice decode against BOLT11.** `utils/Bolt11Utils.ts` is a hand-rolled decoder (LRU-cached, with lazy self-replacing getters deferring signature recovery). Its conformance proof is exactly the pattern to copy: (1) spec vector in, assert every parsed field including the recovered `destination` equals the spec's stated payee; (2) realistic network fixtures (regtest `bcrt`, signet `tbs`) for prefixes the spec examples don't cover; (3) invalid string throws the exact message `'Not a proper lightning payment request'`; (4) the caching/laziness contract is itself under test — which is why "don't naively serialize/spread decoded invoices" (see zeus-lightning-reference) is an enforced property, not folklore.

**What counts as done:** at least one spec-sourced vector (or reference-captured, provenance-commented), one repo-realistic fixture, and one invalid-input case; any caching/lazy behavior asserted; vectors are constants with a source citation, never generated inside the test.

---

## Recipe 6 — Regression proof (failing-test-first)

**When to use:** every bug fix. CONTRIBUTING.md, Test Coverage section: *"Bug fixes should include a test that would have caught the bug."*

**Steps**

1. **Write the test before (or at worst, alongside) the fix, at the layer that owns the logic.** Reality check (verified): tests exist only for `utils/` (45 files), `models/` (2), and `lndmobile/channel.test.ts` — plus the repo-root `check-styles.test.ts` lint helper, 49 files total. `stores/`, `views/`, `components/`, `backends/` have **zero** coverage.
2. **If the bug lives in an untested layer, extract the pure logic into `utils/` first, then test it there.** This is established repo practice, not a workaround — see the worked examples.
3. **Demonstrate the test fails without the fix.** Temporarily undo the fix hunk in your working tree, run the single test, watch it fail, restore. State this in the PR ("test fails on pre-fix code").
4. **Run the full gate:** `yarn verify` (jest + prettier + tsc + eslint, matching the 4 PR checks — anatomy and jest traps in zeus-validation-and-qa).
5. The test must **encode the bug's mechanism, not its symptom** — assert the property whose violation caused the bug.

**Worked examples (verified in git):**

- **Extract-then-test:** invoice-expiry logic was extracted to `utils/ExpiryUtils.ts` (#3795, merged `3b4cdd0b5`, 2026-03-08); when the "3600 hours" bug was fixed (`26d4215ea`), the fix shipped with new cases in both `ExpiryUtils.test.ts` and `MigrationUtils.test.ts`. Similarly `d6af12ae4` ("extract signing utils, add test") pulled DER signing out of backend code into `utils/SigningUtils.ts` + vectors.
- **Mechanism-encoding test:** the #4150 fix (`7ed901a10`) added a `MigrationUtils.test.ts` case asserting `settingsStore.setSettings` receives a **non-string object** (`expect(typeof persistedSettings).not.toBe('string')`) — guarding the entire "stringified payload corrupts the MobX observable" class, not just the one call site.
- **Race fixed in an untestable layer:** `b54e8f138` placed the tolerance (`waitForLdkNodeReady`) in `utils/LdkNodeUtils.ts` — where a jest test *can* reach it — with the race documented in its docstring; companion commit `8fc9698a0` added the `walletJustCreated` skip flag.

**What counts as done:** a colocated test that fails on pre-fix code and passes after; if the fix is in stores/views/backends, either extracted-and-tested pure logic or an explicit PR note that the layer is untestable and what manual test covered it (manual iOS+Android testing is mandatory regardless — zeus-change-control).

---

## Recipe 7 — Reproducible-build equivalence

**When to use:** verifying a released APK matches the source; changing anything under `android/` that could affect determinism (Gradle config, packaging, dependencies); auditing the release pipeline.

**How determinism is achieved (all verified by source read; the build itself was not executed for this document):**

| Mechanism | Where |
|---|---|
| Builder image pinned by **sha256 digest** (`reactnativecommunity/react-native-android@sha256:c390bfb3…`) | `build.sh` |
| `SOURCE_DATE_EPOCH` fixed (defaults to `0`) and exported into the container | `build.sh` |
| `yarn install --frozen-lockfile` inside the container | `build.sh` |
| Parallel Gradle **disabled** ("parallel execution causes non-deterministic file ordering") | `android/gradle.properties` (`org.gradle.parallel=false`) |
| `tasks.withType(Zip) { reproducibleFileOrder = true; preserveFileTimestamps = false }` | `android/app/build.gradle` |
| Release APKs are **unsigned**; per-ABI `versionCodeOverride = versionCode*1000 + {armeabi-v7a:1, x86:2, arm64-v8a:3, x86_64:4}` (base `versionCode 131` at this writing) | `android/app/build.gradle` |
| Output: 5 renamed APKs (`app-` → `zeus-`, `-release-unsigned` stripped) + `sha256sum` per file | `build.sh` |

The only `build.sh` flag is `--no-tty`. CI never runs this on PRs — `.github/workflows/build-android.yml` is `workflow_dispatch`-only. Android only; there is no iOS reproducible build.

**Steps to verify equivalence (per `docs/ReproducibleBuilds.md` — read it first):**

1. Clone the exact tag: `git clone --depth 1 --branch <tag> https://github.com/ZeusLN/zeus.git && cd zeus`
2. `./build.sh` (requires Docker; add `--no-tty` in scripts/CI).
3. Compare your `sha256sum` output against the GitHub release page hashes. The web-distributed APK is the `-universal` one.
4. Hashes will **not** match the official signed APK byte-for-byte — the official one carries a signature. Unpack both and diff: `diffoscope`, `apksigcopier`, or `diff --brief --recursive ./unpacked_official ./unpacked_built`.
5. **Equivalence claim = the only differences are the signing certificates** (META-INF signature files). Any other diff is a finding: trace it to a non-determinism source and check the table above for which mechanism failed.

**Worked example:** the mechanisms table *is* the archaeology — each row exists because its absence produced non-identical builds (the `gradle.properties` comment records the parallel-ordering failure explicitly). When auditing a Gradle change, re-run the mental checklist: does it introduce a timestamp, an absolute path, a parallel task, or an unpinned input? Releases and commits are PGP-signed with key `AAC48DE8AB8DEE84` (`PGP.txt`) — hash comparison plus signature check is the full trust chain.

**What counts as done:** two independent builds of the same tag produce identical sha256 sums; official-vs-built unpacked diff shows only signing material; any new build input is digest- or lockfile-pinned.

---

## Provenance and maintenance

All facts verified **2026-07-06** against `master` @ `c5fd094fb` (v13.1.3-alpha). Commit hashes cited were confirmed with read-only `git show`/`git log` on first-parent master. Re-verify volatile facts before relying on them:

| Fact | Re-verification command |
|---|---|
| Cited commits still exist / messages match | `git show -s --oneline d416052cd 0e2b89164 b54e8f138 8fc9698a0 c6323fff4 26d4215ea e8e5b8811 a7860aa96 7ed901a10 d8e648b58 3b4cdd0b5 d6af12ae4 f7b2c30a8` |
| `call()` returns `false` for missing methods | `grep -n "return false" utils/BackendUtils.ts` |
| Backend inheritance edges | `grep -n "extends" backends/*.ts` |
| LndHub fund-max leak still present | `grep -n "supportsChannelFundMax" backends/*.ts` (fixed when LndHub.ts gains an override) |
| `payLightningInvoiceStreaming` still dead | `grep -rn "payLightningInvoiceStreaming" backends/` (empty = still dead) |
| Fee rule boundary (5% / ≤1000 sats) | `grep -n "DEFAULT_ROUTING_FEE_PERCENT\|amount > 1000" utils/FeeUtils.ts` |
| Settings blob keys | `grep -n "STORAGE_KEY\b\|LEGACY_STORAGE_KEY" stores/SettingsStore.ts` |
| Migration execution order | `grep -n "keychainCloudSyncMigration\|legacySettingsMigrations\|storageMigrationV2\|migrateInvoiceExpiryDisplay" stores/SettingsStore.ts` |
| Keychain deletion still disabled (policy) | `grep -n "Skipping delete" utils/MigrationUtils.ts` |
| Expiry-repair flag (v2 only; the v1 MOD_KEY9 block was removed by `e8e5b8811`) | `grep -n "invoices-expiry-display-fix-v2" utils/MigrationUtils.ts` |
| Race-tolerance retry still in place | `grep -n "LDK_NODE_NOT_INITIALIZED\|LDK_NODE_NOT_RUNNING_YET" utils/LdkNodeUtils.ts` |
| `fetchData` re-entrancy guard | `grep -n "fetchLock" views/Wallet/Wallet.tsx stores/SettingsStore.ts` |
| Builder image digest / SOURCE_DATE_EPOCH | `grep -n "BUILDER_IMAGE\|SOURCE_DATE_EPOCH" build.sh` |
| Gradle determinism settings | `grep -n "org.gradle.parallel" android/gradle.properties && grep -n "reproducibleFileOrder\|versionCodeOverride\|versionCode " android/app/build.gradle` |
| build workflow still dispatch-only | `grep -n "workflow_dispatch" .github/workflows/build-android.yml` |
| Test-coverage reality (count) | `find . -name "*.test.ts*" -not -path "./node_modules/*" -not -path "./zeus_modules/*" \| wc -l` (49 at this writing) |
| BOLT11 spec vectors present | `grep -n "BOLT11_SPEC" utils/Bolt11Utils.test.ts` |
| Regression-test rule in docs | `grep -n "would have caught the bug" CONTRIBUTING.md` |

Labeled uncertainties: the LndHub `supportsChannelFundMax` leak is **latent** (masked by `supportsChannelManagement = false`) — reconfirm both flags before citing it; `versionCode 131` and the Docker digest change every release; execution of `build.sh` itself is verified by source read only.
