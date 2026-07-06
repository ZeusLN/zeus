---
name: zeus-failure-archaeology
description: Chronicle of Zeus's settled battles — every major investigation, revert, dead end, and multi-attempt saga as symptom → root cause → evidence (verified commit hashes/PRs) → status. Load BEFORE re-attempting anything that smells familiar, and whenever you hit these symptoms - stale wallet data appearing on a new iOS device / iCloud keychain leftovers; Fabric or New Architecture crashes (WalletHeader, keypad); infinite loading on app boot; settings corrupted or lost after a migration; "3600 hours" invoice expiry; Tor TLS certificate errors; navigation stack buildup or broken back-navigation; LDK Node crash on wallet deletion; embedded LND crash on restart (SQLite vs Bolt DB); Hermes regex stack overflow on QR scan; Cashu mint data shared between wallets; a merged fix that later vanished (revert). Also load before trusting any merged PR as final, before proposing a React Native or react-navigation upgrade, or when a commit hash/PR number from history needs context.
---

# Zeus Failure Archaeology

The chronicle of every costly investigation in this repo: what broke, why, what fixed it (or didn't), and the receipts. Purpose: **no one re-fights a settled battle.** Before you attempt a fix that feels obvious, search this file — someone may have shipped it and reverted it already.

All hashes below were verified with read-only git against master snapshot `c5fd094fb` ("Version bump: v13.1.3-alpha", 2026-07-02; no v13.1.3 tag exists yet — nearest tag is v13.1.2). Dates are commit author dates (`git log --date=short`).

## When to use / When NOT to use

**Use when:**
- A bug matches a symptom in the index below — read the entry before touching code.
- You are about to propose a fix in storage/keychain, React Native upgrades, Tor TLS, navigation, LDK Node lifecycle, or embedded LND DB config — all have prior failed attempts.
- You need to know whether a merged fix is still live (this repo reverts fast — see MP-1).
- You need verified hashes/PR numbers for a historical claim.

**Use a sibling instead when you need:**
- The *rules* derived from these incidents (gating, review, migration sign-off) → **zeus-change-control**
- How storage/keychain/migrations work *today* and how to change them safely → **zeus-storage-and-migrations**
- Live debugging of a *new* symptom (triage tables, experiments) → **zeus-debugging-playbook**
- The currently-open node-lifecycle race campaign → **zeus-node-lifecycle-campaign**
- Design rationale and invariants (why the architecture is shaped this way) → **zeus-architecture-contract**
- Analysis technique (how to *prove* a race or migration is safe) → **zeus-proof-and-analysis-toolkit**

## How to verify any claim in this chronicle

Jargon: a **first-parent** history walk follows only the main line of merge commits, skipping the internal commits of merged branches.

```bash
# Confirm a hash exists and read its subject/date:
git log -1 --format='%h %ad %s' --date=short <hash>
# Confirm it is on the master lineage (run from the v13.1.3-alpha snapshot or newer):
git merge-base --is-ancestor <hash> HEAD && echo on-master
# Read what it changed:
git show --stat <hash>
```

**Two traps when citing history:**
1. `git log --all` contains grafted duplicates — the same change can appear under two hashes (verified example: revert of PR #3307 exists as both `7d8678457` on the master lineage and duplicate `1cbf4a2c8` on a side ref). Always cite the hash that passes `git merge-base --is-ancestor <hash> <master-snapshot>`.
2. In development clones, the local `master` branch pointer can be stale or divergent from upstream. Verify ancestry against a known-good snapshot (`c5fd094fb` = the v13.1.3-alpha version-bump commit) or `origin/master`, never against a bare local `master`.

## Entry format

Each entry: **ID · dates · Symptom · Root cause · Evidence (hashes/PRs) · Status · Lesson** (one imperative line).
Status values: **settled** (fixed, closed), **policy** (resolution is a standing rule, not just a patch), **open** (still live or candidate).

---

## FA-1 — The iCloud keychain saga (costliest failure; 3 attempts over ~3 months)

**Dates:** 2025-11-10 → 2026-01-30. **Status: policy.**

Background terms: the **keychain** is the OS secure credential store (accessed via react-native-keychain); on iOS, entries flagged `kSecAttrSynchronizable` are synced by **iCloud Keychain** to all of a user's devices. Zeus keeps every wallet secret (seeds, macaroons) in keychain entries, so unwanted sync means *wallet seeds silently propagate across devices*, and unwanted deletion means *funds-losing data loss*. That tension is why this took three attempts.

**Timeline (all hashes verified on master lineage):**

| Date | Event | Evidence |
|---|---|---|
| 2025-11-10 | Attempt 1 merged: "fix: exclude our storage from iCloud backup" | PR #3307, merge `5f533bb12` |
| 2025-11-10 | **Reverted the same day** via GitHub auto-revert branch `revert-3307-...` | PR #3354, merge `d1dcb7ba7`, revert commit `7d8678457` (no explanation in commit body) |
| 2025-12-01 | Attempt 2 (the "proper fix") merged: re-introduces `keychainCloudSyncMigration` (first added in Attempt 1 as `c6794cf85`, reverted with it) — rewrites keychain entries in place with `cloudSync: false` (same key names; no `zeus:` prefix yet) | PR #3371 merge `e808fd71a`; PR #3405 merge `ed161541a` ("Change migration Key"); refactor PR #3404 `4c3d6dc6d` |
| 2026-01-06 | Fallout fix: "fix: lost data after updating to v0.12.0" | `2ae645824` |
| 2026-01-14 | Attempt 3: `iCloudCleanupMigration` added — the Dec fix only *created* local copies and never deleted the old `kSecAttrSynchronizable` entries, so a user setting up a new iPhone inherited **stale wallet data from iCloud**; cleanup purges via `Keychain.resetInternetCredentials({ ..., cloudSync: true })`; commit body says "Properly closed #2915" | `46f2bac00` |
| 2026-01-13 | Restructured: separate `iCloudCleanupMigration` function removed; cloud-synced data deleted before writing local, inside `keychainCloudSyncMigration`. Same day, `zeus:`-prefixed key namespacing added: "migration: move to new prefixed keys, added safety steps" | `bddf52507` + `318c721e7` (+ dedup refactor `f79ae68ff`) |
| 2026-01-30 | **Final reversal of the deletion idea**: "migration: disable key deletion for now" — `deleteFromOldKeychain` becomes a deliberate no-op | `c6323fff4`; also iOS timing mitigation `35aaf8897` (500ms delays around keychain reads/writes) |

**Current state (verified in source, 2026-07-06):** `utils/MigrationUtils.ts` → `migrateKey()` does read → write → verify → delete, but `deleteFromOldKeychain()` is a no-op whose comment reads "DISABLED: To prevent potential data loss during migration. Old keychain entries will remain but are harmless (orphaned data)." The old un-prefixed (and possibly iCloud-synced) entries are **retained deliberately**; the Keychain Recovery tool (`utils/KeychainRecoveryUtils.ts`, surfaced under `views/Tools/`) depends on those orphans existing. All new writes go through `storage/index.ts` with the `zeus:` prefix and `cloudSync: false` (both `setItem` and `removeItem`).

**Root cause (of the whole saga):** deleting keychain data is irreversible and iCloud sync timing is unobservable, so every "clean up old entries" attempt risked destroying the only copy of a seed. The team converged on: never delete, namespace instead.

**Lesson:** never delete keychain data in a migration — namespace new data (`zeus:` prefix), leave orphans, and treat any keychain deletion as a maintainer-gated change (see zeus-change-control).

---

## FA-2 — React Native upgrade / New Architecture saga (~19-month freeze, then Fabric fallout)

**Dates:** 2024-06-13 → 2026-06-12 (fallout); ongoing platform risk. **Status: settled (0.85.3 current), policy for Animated/layout patterns.**

Background terms: **React Native (RN)** is the cross-platform mobile framework; its **New Architecture** replaces the old bridge with **Fabric** (new renderer) and TurboModules; **Hermes** is RN's JavaScript engine. Layout/animation code that was tolerated by the old renderer can hard-crash under Fabric.

**Timeline:**

| Date | Event | Evidence |
|---|---|---|
| 2024-06-13 | RN 0.74.2 lands | `1c97cdd4b`, merge `e89187c68` (PR #2178) |
| 2025 | Two upgrade attempts die as `wip` branches: `deps-react-native-0.76.9` (tip `563f8fe1f`, 2025-10-07, subject "wip") and `deps-react-native-0.78.2` (tip `e34e356a6`, 2025-10-26, "wip"); also `react-native-0.76.2` (tip `a5264a298`, 2025-03-03, "revert react-native-tor (for now)") | local branches; see MP-2 caveat |
| 2026-01-04 | The jump: "deps: React Native upgrade: 0.74.2 -> 0.83.1" — **~19 months** after 0.74.2 — with New Architecture ON (`android/gradle.properties` `newArchEnabled=true`, verified) | `d13ebc2cd`, merged `5c678f54b` (PR #3501, 2026-01-09) |
| 2026-02-18 | RN 0.84.0 | `bb09f99c1` |
| 2026-03-28 | Fabric fallout 1: "fix WalletHeader animation crashes on New Architecture" | `f08bfc7c5`, merge `6baf1051c` (PR #3910) |
| 2026-05-12 | RN 0.85.3 (current — package.json `"react-native": "0.85.3"`, verified) | `5613ec2b7` |
| 2026-06-12 | Fabric fallout 2: "fix(keypad): prevent Fabric crash by restructuring baseline layout" | `2c55e4f89`, merge `fe15a65ef` (PR #4163) |

**Root cause pattern:** the codebase accumulated 19 months of Animated/layout patterns validated only against the legacy renderer; Fabric enforces stricter invariants, so crashes surfaced screen-by-screen for months after the jump (WalletHeader at +3 months, keypad at +5 months).

**Lesson:** treat any pre-2026 Animated/layout pattern as Fabric-suspect, and never let the RN version freeze again — incremental upgrades are cheaper than a 9-minor-version jump. (An `rn-v0.86.0` branch exists locally as candidate follow-up work — open, unmerged.)

---

## FA-3 — Settings-migration corruption cluster (stringify, missing await, expiry re-run)

**Dates:** 2026-05-30 → 2026-06-22. **Status: settled + policy.**

Background terms: **MobX** is the state-management library; Zeus stores keep settings as MobX *observables* (proxied objects). A **MOD_KEY migration** is Zeus's one-shot pattern: check a flag key in legacy EncryptedStorage → mutate settings → `settingsStore.setSettings(...)` → set the flag (details in zeus-storage-and-migrations).

Three related failures:

1. **Stringify corruption.** Symptom: settings corrupted after a migration ran. Root cause: a migration passed a `JSON.stringify`'d string to `setSettings`, which expects a real object — corrupting the MobX observable state. Fix: `7ed901a10` "fix(migrations): pass object to setSettings to avoid MobX observable corruption (#4150)" (2026-06-09; #4150 is the issue — merged via PR #4155, merge `45e9d2095`, 2026-06-22).
2. **Un-awaited setSettings.** Root cause: MOD_KEY blocks called `setSettings` without `await`, so the flag could be set before the write landed (or interleave with other writes). Fix: `d8e648b58` "fix(migrations): await settingsStore.setSettings in all MOD_KEY blocks" (2026-05-30).
3. **Invoice-expiry repair had to run twice.** Symptom: invoice screen displayed "3600 hours" while invoices (BOLT11 = the standard Lightning payment-request format) actually expired in one hour. First repair `26d4215ea` (2026-05-30) fixed users whose settings *had* an `expirySeconds` field. It missed pre-Feb-2024 installs, which never stored `expirySeconds`/`timePeriod` at all — so a second pass `f7b2c30a8` (merge of `a7860aa96`, 2026-06-08, subject references #4149) derives a canonical seconds value and re-runs under a **new** flag key `invoices-expiry-display-fix-v2` (verified in `utils/MigrationUtils.ts` `migrateInvoiceExpiryDisplay`).

**Lesson:** in migrations, always `await settingsStore.setSettings(realObject)` — never a stringified blob — and enumerate every historical settings shape (including fields that may have never existed) before declaring a repair complete.

---

## FA-4 — UNSAFE-lifecycle refactor → infinite loading (3-week regression)

**Dates:** 2025-10-24 → 2025-11-12. **Status: settled.**

Background: React class components have deprecated `UNSAFE_componentWillMount`-style lifecycle methods; Zeus's views are class components, and its boot/connect logic re-runs on screen focus (see zeus-architecture-contract).

- **Symptom:** app stuck on infinite loading at boot.
- **Root cause:** `fdad118ed` "refactor: replacing UNSAFE React lifecycle methods" (2025-10-24) changed when boot logic ran.
- **Fix:** `93227029e` (2025-11-12) — subject literally cites the offender: "fix: infinite loading regression fdad118ed4a72cd3824863638f668215c01c3b85".

**Lesson:** lifecycle-method refactors in boot/connect paths are behavior changes, not cleanups — test the cold-start path on both platforms before merging (this repo's naming convention of citing the offending hash in the fix subject is worth copying).

---

## FA-5 — Tor TLS near-miss and the nitro-tor migration

**Dates:** 2026-05-26 → 2026-06-20. **Status: settled + policy.**

Background terms: **Tor** routes traffic through an anonymity network; a **.onion** address is a Tor hidden service (its TLS certs can't be CA-validated normally); a **TLS cert bypass** disables certificate verification. Bypassing certs for *clearnet* hosts reached over Tor exposes users to exit-node man-in-the-middle attacks.

- 2026-05-27: Tor stack replaced — merge `c512ea687` (PR #3971) migrates from the retired `ZeusLN/react-native-tor` fork to `react-native-nitro-tor` (package.json pins `0.6.0`, verified).
- 2026-05-26: hardening: `d4c8f12e1` "fix(TorUtils): treat HTTP >= 300 responses as errors".
- 2026-06-19: **the near-miss** — `9de1742f6` "fix(tor): trust invalid certs on LND/CLN REST over Tor" trusted invalid certs *broadly* on the Tor path.
- 2026-06-20: scoped **one day later** by `8792003ee` "fix(tor): scope TLS bypass to .onion HTTPS endpoints", merge `5a7422a4b` (PR #4186). Standing rule since: cert bypass ONLY for HTTPS .onion; clearnet-over-Tor keeps strict TLS.

**Lesson:** never widen a TLS bypass beyond `.onion` HTTPS — any Tor networking change must state exactly which hosts lose cert verification.

---

## FA-6 — react-navigation upgrade regressions → the popTo rule

**Dates:** 2024-05-05 → 2024-05-21 (recurring class since). **Status: policy.**

Background: **react-navigation** manages the screen stack; `navigation.navigate(X)` *pushes* a new instance if X isn't the immediate target, while `popTo(X)` unwinds the stack back to the existing X. Using `navigate` for "go back" silently builds duplicate screens.

- **Symptom:** broken back-navigation and node-picture selection after "upgrade react navigation" `3bae746ad` (2024-05-05; bumped `@react-navigation/bottom-tabs` 5.11→6.5 among others).
- **Fix:** PR #2192 merge `7abc7a971` (2024-05-21), key commit `a54b3c91b` "use popTo instead of navigate to navigate back" — a sweep across 23 views.
- **The class recurs:** `7830d772c` (2026-03-30) "fix: use popTo when returning from MintDiscovery to prevent navigation stack buildup"; `bc135dda7` (2026-03-11) moved navigation types to `NativeStackNavigationProp` (from `@react-navigation/native-stack` — the repo standard). Current deps: `@react-navigation/native` 7.1.28, `@react-navigation/native-stack` 7.12.0 (verified).

**Lesson:** for back-navigation always use `popTo`/`popToTop`, never `navigate`, and type screens with `NativeStackNavigationProp`.

---

## FA-7 — LDK Node crash on wallet deletion (Tokio thread)

**Dates:** 2026-03-10. **Status: settled (rule lives on).**

Background terms: **LDK Node** is a Rust Lightning node embedded via FFI (foreign function interface — calling Rust from JS/native); **Tokio** is Rust's async runtime; dropping (freeing) a Tokio-owning object *from inside a Tokio worker thread* aborts the process.

- **Symptom:** native crash when deleting an LDK Node wallet, and on delete-then-create sequences.
- **Root cause:** the Node reference was released on a Tokio thread, and stop wasn't awaited before proceeding.
- **Fix (same day, two commits):** `d416052cd` "prevent LDK Node crash on wallet deletion by releasing Node ref off Tokio thread" + `0e2b89164` "block on LDK Node stop before resolving to prevent crash on delete-then-create" (both 2026-03-10). Related later hardening (both 2026-05-17): `b54e8f138` "enhancement: LDK: wait for node readiness before fetching startup data" (added `waitForLdkNodeReady`) and `8fc9698a0` "fix(ldk-node): tolerate buildNode race during wallet startup" (added the `walletJustCreated` skip flag).
- Lifecycle races in this area remain a live campaign → **zeus-node-lifecycle-campaign**.

**Lesson:** release LDK Node references off the Tokio thread and block on stop before resolving any delete/recreate flow.

---

## FA-8 — Embedded LND SQLite/Bolt DB saga (4 course corrections)

**Dates:** 2026-01-27 → 2026-04-23. **Status: settled.**

Background terms: **embedded LND** is the LND Lightning node compiled with gomobile and run inside the app; LND stores channel/wallet state in either **Bolt DB** (bbolt, the legacy key-value store) or **SQLite**. Which backend a wallet was *created* with matters — you can't silently switch.

| Date | Event | Evidence |
|---|---|---|
| 2026-01-27 | SQLite enabled for newly created/restored embedded wallets | `251aa1b92` |
| 2026-03-27 | Restricted: SQLite iOS-only | `ef4a42112` |
| 2026-03-28 | Re-enabled on Android (next day) | `3c6f4175e` |
| 2026-04-20 | Retreat: default back to Bolt DB + explicit DB selector in Wallet Config, `[SQLite]` suffix labels | `d475ef2b4` (subject references #4002) |
| 2026-04-23 | Final crash fix: "prevent embedded LND crash on app restart with Bolt default" — restart crashed for wallets created during the SQLite-default window once the default flipped back | `3e04e6bf2`, merge `dc2415df4` (PR #4013) |

**Root cause pattern:** the DB backend default was treated as a config toggle, but it's a per-wallet persistent property (`isSqlite` per node) — flipping the default desynced existing wallets from the engine they were created with.

**Lesson:** a storage-engine default is per-wallet state, not a global flag — changing it requires tracking what each existing wallet was created with.

---

## FA-9 — Hermes regex stack overflow on merchant QR

**Dates:** 2026-06-01. **Status: settled.**

- **Symptom:** app crash (Hermes engine stack overflow) when scanning/pasting long inputs that hit the merchant-QR regex matcher.
- **Root cause:** Hermes's regex engine recurses per character class; unbounded input length → stack overflow.
- **Fix:** `5c451839d` "fix: length-cap merchant-QR matching to avoid Hermes regex stack overflow" — `MERCHANT_QR_MAX_LEN = 500` guard, verified at `utils/handleAnything.ts` (constant + two early-return checks). The detector-chain ordering in that file is separately load-bearing → see zeus-lightning-reference (§ handleAnything universal input router).

**Lesson:** length-cap every input before running non-trivial regexes under Hermes.

---

## FA-10 — NWC transaction-list fix: merged and reverted the same day

**Dates:** 2025-12-15. **Status: settled (as a revert); the underlying bug's final resolution is not chronicled here — check current NWC code before assuming it's fixed.**

Background: **NWC (Nostr Wallet Connect, NIP-47)** lets Nostr clients drive the wallet; Zeus runs an NWC wallet service.

- PR #3432 "fix: lightning node transaction list bug in Nostr clients" merged `285da755a` (2025-12-15).
- Reverted **the same day** via auto-revert branch: PR #3444, merge `28bc50f5e`, revert commit `1c8400515` — commit body empty, no recorded reason.

**Lesson:** NWC store/service-shape changes get reverted fast when release testing flags them — re-read MP-1 before building on any recent NWC fix.

---

## FA-11 — Cashu node-dir collision: all LDK wallets shared one mint DB

**Dates:** 2026-03-20 → 2026-04-08. **Status: settled.**

Background: **Cashu** is a Chaumian ecash protocol; Zeus embeds the CDK (Cashu Dev Kit, Rust). Per-wallet Cashu data is namespaced by a node directory string.

- **Symptom:** multiple LDK Node wallets on one device saw each other's mint data/balances.
- **Root cause:** namespacing used the LND directory getter, which returns the literal fallback `'lnd'` for every LDK Node wallet — so all LDK wallets collided on one namespace.
- **Fix:** `1242ce94a` (2026-03-20) "fix: Cashu: isolate mint data per LDK node using getNodeDir()" — `CashuStore.getNodeDir()` returns `ldkNodeDir || 'ldk'` for ldk-node, `lndDir || 'lnd'` otherwise (verified in `stores/CashuStore.ts`). Follow-up `35fa31fee` (2026-04-08) "use getNodeDir for cashu multimint keys". Recovery is a **copy** migration, not a move: `MigrationUtils.migrateLegacyCashuKeysToNodeDir` copies four `cashu-*` key suffixes from the legacy `lnd`-prefixed keys to node-dir keys, only when the node key is empty (verified in `utils/MigrationUtils.ts`).

**Lesson:** namespace per-wallet data with `CashuStore.getNodeDir()` (never the raw lndDir getter), and migrate by copying — leave legacy keys in place (same no-delete doctrine as FA-1).

---

## FA-12 — Bimodal pathfinding: default diverges for new vs migrated users (upstream lnd bug)

**Dates:** standing config quirk. **Status: policy (tracks upstream).**

Background: **bimodal pathfinding** is an lnd payment-routing probability model (alternative to the default "apriori" estimator).

- **Root cause:** upstream bug lightningnetwork/lnd#9085 made bimodal mode unsafe for users who had it enabled; rather than change the fresh-install default, Zeus force-disabled it only for existing users.
- **Evidence (verified in source):** `stores/SettingsStore.ts` default `bimodalPathfinding: true` (fresh installs); `utils/MigrationUtils.ts` MOD_KEY7 = `'bimodal-bug-9085'` sets `bimodalPathfinding = false` for migrated users, with the lnd issue URL in a comment.
- **Consequence:** new and upgraded installs behave differently by design. Same divergence pattern exists for `showMillisatoshiAmounts` (see zeus-config-and-flags for the full new-vs-migrated list).

**Lesson:** when an upstream bug forces a behavior change, decide explicitly whether fresh installs and migrated users should diverge — and record the upstream issue number in the MOD_KEY name.

---

## MP-1 — Meta-pattern: the rapid revert

**Status: policy** (maintainer-confirmed: regressions found in release testing get reverted, never forward-fixed under pressure).

Merged ≠ final in this repo. Reverts arrive via GitHub auto-revert branches named `revert-<PR#>-<branch>`, and the revert commits carry **no explanation in the body** — the reasoning lives in out-of-repo release testing.

Verified revert pairs:

| Original PR (merge, date) | Revert PR (merge, date) | Gap |
|---|---|---|
| #3307 iCloud exclusion (`5f533bb12`, 2025-11-10) | #3354 (`d1dcb7ba7`, revert `7d8678457`, 2025-11-10) | same day |
| #3432 NWC txlist (`285da755a`, 2025-12-15) | #3444 (`28bc50f5e`, revert `1c8400515`, 2025-12-15) | same day |
| #1568 sat rounding (`4c0b2ad48`, 2023-08-04) | #1587 (`3d4377935`, revert `cd7b30479`, 2023-08-05) | 1 day |
| #1679 app-lock timeout (`3c1634710`, 2023-10-10) | #1773 (`4dd71b8da`, revert `c0dc4e1f8`, 2023-10-16) | 6 days |

**Before trusting any merged fix** (especially in storage/keychain/NWC territory), run:

```bash
git log --oneline --grep='revert-<PR#>'           # revert merge, if any
git log --oneline --grep='Revert' --since=<merge-date> | head
```

**Lesson:** always check for a `revert-<PR#>` branch/merge before citing, extending, or reintroducing a merged change.

---

## MP-2 — The stalled-branch graveyard

**Status: open** (each branch is unfinished work, not abandoned-by-decision unless noted).

Caveat: these are **local branches in the primary development clone** (hundreds exist); a fresh fork won't have them. Verify with `git branch --list <name>` (or `git branch -r` against the ZeusLN remote). Counts below are commits not reachable from `c5fd094fb`.

| Branch | Tip (verified) | Unmerged | What it is |
|---|---|---|---|
| `android-16kb-page-size` | `fa2212457`, 2025-10-10, "config: Android: 16 KB page size" | 1 | Android 16KB-page-size compliance; note `android/check_elf_alignment.sh` already exists on master but is invoked by nothing |
| `bip-321` | `3c1210922`, 2025-08-20, "feat: BIP-321" | 1 | BIP-321 (unified bitcoin payment URIs) support |
| `cdk-init-remote-nodes` | `62437d4c8`, 2026-05-01 | 4 | Cashu (CDK) redemption for remote-node backends |
| `cashu-backup` | `34228aac7`, 2025-04-04 | 73 | Large stalled effort (ecash backup / ZEUS Pay-adjacent) — oldest and biggest |
| `zeus-rgs` | `10cc63b7b`, 2026-05-12 | **0** | Fully contained in master as of `c5fd094fb` — NOT stalled, safe to ignore |
| `deps-react-native-0.76.9` / `deps-react-native-0.78.2` / `react-native-0.76.2` | see FA-2 | 1–3 | Dead RN upgrade attempts, superseded by the 0.83.1 jump |
| `rn-v0.86.0` | `203cb9147`, 2026-06-26 | 6 | Candidate next RN bump — open |

**`backup-*` and `*-backup-*` branches** (`backup-before-rebase`, `backup-pre-squash`, `ldk-node-backup-0326-*`) are pre-rebase safety copies of work that already landed — **not** stalled work. Don't mine them for "lost" features.

**Lesson:** before starting 16KB-page-size, BIP-321, remote-node Cashu, or cashu-backup work, diff the graveyard branch first — someone already broke ground.

---

## Lessons index (one line each)

1. **FA-1:** Never delete keychain data in a migration — namespace and retain orphans.
2. **FA-2:** Treat pre-2026 Animated/layout code as Fabric-suspect; never freeze the RN version for months.
3. **FA-3:** `await settingsStore.setSettings(realObject)` — never stringified — and enumerate every historical settings shape.
4. **FA-4:** Lifecycle refactors in boot paths are behavior changes; test cold start on both platforms.
5. **FA-5:** TLS cert bypass only for HTTPS `.onion`; treat HTTP ≥ 300 over Tor as errors.
6. **FA-6:** Use `popTo` for back-navigation and `NativeStackNavigationProp` for types.
7. **FA-7:** Release LDK Node refs off the Tokio thread; block on stop before delete/recreate.
8. **FA-8:** A storage-engine default is per-wallet state, not a global flag.
9. **FA-9:** Length-cap inputs before regexing under Hermes.
10. **FA-10/MP-1:** Check for `revert-<PR#>` before trusting any merged fix.
11. **FA-11:** Namespace per-wallet data via `getNodeDir()`; migrate by copy, never move.
12. **FA-12:** Record upstream issue numbers in MOD_KEY names; decide fresh-vs-migrated divergence explicitly.
13. **MP-2:** Diff the graveyard branch before restarting stalled work.

---

## Provenance and maintenance

Facts verified 2026-07-06 against master snapshot `c5fd094fb` (`git describe --tags` = `v13.1.2-3-gc5fd094fb`; package.json version `13.1.3-alpha`). Every hash above passed `git log -1 <hash>` and `git merge-base --is-ancestor <hash> c5fd094fb`. Dates are author dates from `git log --date=short`. Not independently verifiable from the repo: GitHub PR *bodies* (revert reasons confirmed absent only in commit bodies) and the maintainer's revert-first policy statement (2026-07-06, authoritative).

Re-verification one-liners for volatile facts:

| Fact | Command |
|---|---|
| Any cited hash exists + subject/date | `git log -1 --format='%h %ad %s' --date=short <hash>` |
| Hash is on master lineage | `git merge-base --is-ancestor <hash> HEAD && echo ok` |
| RN version (0.85.3 as of 2026-07) | `grep '"react-native"' package.json` |
| New Architecture still ON | `grep newArchEnabled android/gradle.properties` |
| nitro-tor version (0.6.0) | `grep react-native-nitro-tor package.json` |
| Keychain deletion still disabled | `grep -n 'Skipping delete' utils/MigrationUtils.ts` |
| Orphan-retention comment intact | `grep -n 'DISABLED' utils/MigrationUtils.ts` |
| `zeus:`-prefix + `cloudSync: false` writes | `grep -n 'cloudSync' storage/index.ts` |
| Merchant-QR length cap (500) | `grep -n MERCHANT_QR_MAX_LEN utils/handleAnything.ts` |
| Bimodal default (true) + migration off-switch | `grep -n bimodalPathfinding stores/SettingsStore.ts utils/MigrationUtils.ts` |
| Cashu node-dir logic | `grep -n -A6 'getNodeDir = ' stores/CashuStore.ts` |
| Expiry-repair MOD key (`...-fix-v2`) | `grep -n 'invoices-expiry-display-fix' utils/MigrationUtils.ts` |
| New reverts since this was written | `git log --oneline --grep='revert-' --since=2026-07-06` |
| Graveyard branch still unmerged | `git log --oneline HEAD..<branch> \| wc -l` |
| react-navigation major (7.x) | `grep '@react-navigation/native' package.json` |

If any command's output disagrees with an entry, the repo wins — update the entry and re-stamp this section.
