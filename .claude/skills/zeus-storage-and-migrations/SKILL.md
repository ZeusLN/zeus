---
name: zeus-storage-and-migrations
description: Load when touching ANY persisted data in Zeus - keychain reads/writes, the zeus-settings-v2 settings blob, SettingsStore.setSettings/updateSettings, MigrationUtils MOD_KEY migrations, DataClearUtils/KeychainRecoveryUtils, adding a new storage key, iCloud keychain behavior, duress-PIN wipe, Cashu/LDK/LND on-disk data, or VSS remote state. Also load when debugging symptoms like "settings lost after update", "wallet disappeared", "nested settings group reset to defaults", "migration ran twice / never ran", "old data reappeared on a new iPhone", "data survives Clear All Data", or "3600 hours" style display corruption. Keywords: Storage.getItem, Storage.setItem, EncryptedStorage, AsyncStorage, keychain, cloudSync, zeus-settings-v2, MOD_KEY, migration, storageMigrationV2, keychainCloudSyncMigration, clearAllData, duress.
---

# Zeus Storage and Migrations

Persistence contracts for the ZEUS wallet (React Native, Bitcoin/Lightning) and the safety protocol for changing them. Storage/keychain integrity is one of the two hardest live problem areas in this repo (maintainer, 2026-07-06). Bugs here lose users' wallet configurations, seeds, and money-adjacent data. Treat every change as high-risk.

**The maintainer's gate (non-negotiable):** anything touching `zeus-settings-v2`, keychain keys, or migrations requires maintainer sign-off plus a written migration plan BEFORE implementation. See the `zeus-change-control` skill for the gating process; this skill tells you what to write in that plan and how to not corrupt data while executing it.

## When to use / When NOT to use

**Use this skill when you are:**
- Reading or writing anything through `storage/index.ts`, `react-native-encrypted-storage`, or `AsyncStorage`
- Adding, renaming, or removing a persisted key
- Modifying `SettingsStore` (`setSettings`, `updateSettings`, `getSettings`), the `Settings`/`Node` shapes, or a settings default that existing users already have
- Writing or reviewing a migration in `utils/MigrationUtils.ts`
- Touching wipe/recovery paths: `utils/DataClearUtils.ts`, `utils/KeychainRecoveryUtils.ts`, duress PIN, wallet deletion
- Debugging lost/duplicated/stale persisted data

**Do NOT use this skill for:**
- The catalog of settings options/defaults and the add-a-setting UI checklist → `zeus-config-and-flags`
- The change-classification/review/PR process itself → `zeus-change-control`
- General race analysis or proving a migration correct from first principles → `zeus-proof-and-analysis-toolkit`
- The history of past storage incidents in narrative form → `zeus-failure-archaeology` (this skill embeds only what you need to act safely)
- Running/adding Jest tests in general → `zeus-validation-and-qa`
- Boot sequence and store dependency-injection order → `zeus-architecture-contract`

## Glossary (jargon used below, defined once)

| Term | Meaning |
|---|---|
| Keychain | The OS-level encrypted credential store (iOS Keychain / Android Keystore-backed), accessed via the `react-native-keychain` package. Survives app reinstall on iOS; the most durable storage the app has. |
| Internet credentials | The `react-native-keychain` API flavor Zeus uses (`getInternetCredentials`/`setInternetCredentials`): each entry is keyed by a `server` string and stores a `password` string. Zeus stores JSON in the `password` field. |
| `cloudSync` | iOS-only keychain attribute (`kSecAttrSynchronizable`). `true` = the entry syncs to the user's iCloud Keychain and follows them to new devices. Zeus writes with `cloudSync: false` — always. |
| EncryptedStorage | The `react-native-encrypted-storage` package (v4.0.3, `package.json`). Zeus's PREVIOUS storage backend. Legacy-only now. |
| AsyncStorage | `@react-native-async-storage/async-storage` — plain unencrypted key-value storage. Non-sensitive flags only. |
| Settings blob | ONE JSON document holding all app settings AND all wallet secrets, stored in the keychain under key `zeus-settings-v2`. |
| MobX observable | Reactive state object (`stores/` classes use MobX decorators). UI re-renders when observables change; replacing an observable object with a string corrupts every observer. |
| Macaroon | LND's bearer-token credential (hex in `Node.macaroonHex` / `Node.adminMacaroon`). Possession = control of the node. |
| Seed / mnemonic | BIP-39 word list that derives all wallet keys (`Node.seedPhrase`, `Node.ldkMnemonic`). Loss = loss of funds. |
| Embedded LND / LDK Node | The two node implementations that run INSIDE the app and keep native on-disk state (channel databases etc.), unlike remote backends. |
| Cashu / CDK | Ecash wallet subsystem backed by the Cashu Dev Kit Rust FFI; keeps its own SQLite database (`cashu_wallet.db`) outside the keychain. |
| VSS | Versioned Storage Service — remote server (`https://vss.zeusln.com/vss`, `utils/LdkNodeUtils.ts` `DEFAULT_VSS_SERVER`) where LDK Node persists encrypted channel state, keyed from the node mnemonic. |
| Duress PIN | Alternate PIN that, when entered, silently wipes wallet references instead of unlocking (`views/Lockscreen.tsx`). |

## 1. The four storage layers — what belongs where

| Layer | Access via | What belongs there | Examples |
|---|---|---|---|
| **Keychain (canonical)** | `storage/index.ts` ONLY | Everything persisted by app code: the settings blob, all secrets, per-store data | `zeus-settings-v2`, `zeus-contacts-v2`, `zeus-notes-v2`, `swaps-rescue-key`, `<nodeDir>-cashu-seed-phrase` |
| **Legacy EncryptedStorage** | `react-native-encrypted-storage` | ONLY two things: (a) the old `zeus-settings` blob read during legacy upgrade, (b) one-shot migration flag keys (`MOD_KEY*`, `ios-keychain-cloud-sync-migration-v1`, …). **Never add new data here.** | `lsp-taproot-mod`, `invoices-expiry-display-fix-v2` |
| **AsyncStorage** | `@react-native-async-storage/async-storage` | Non-sensitive UI/service flags only | persistent-service flags (`views/Settings/EmbeddedNode/`), Stealth Mode app data (`views/Stealth/`), NWC service flags |
| **Native disk + remote** | native modules / FFI | Node and ecash state that app-level storage never sees | LND dirs (deleted via `deleteLndWallet` → `LndMobileTools.deleteLndDirectory`), `Documents/ldk-node/<uuid>/` (`utils/LdkNodeUtils.ts getLdkNodeStoragePath`), CDK SQLite `cashu_wallet.db`, remote VSS channel state |

Rules of thumb:
- New persisted app data → keychain via `storage/index.ts`. No exceptions for "small" or "temporary" data.
- If you find yourself importing `react-native-keychain` directly outside `storage/`, `MigrationUtils`, `DataClearUtils`, or `KeychainRecoveryUtils`, stop — you are bypassing the contract.
- Migration flags go in EncryptedStorage (that is their one remaining legitimate home — a flag must survive independently of the keychain data it guards).

## 2. The storage contract (`storage/index.ts`, 57 lines — read it)

The canonical wrapper is a singleton `Storage` with exactly three methods. Its semantics are load-bearing:

| Behavior | Detail | Trap |
|---|---|---|
| Key prefix | Every key is stored as `zeus:<key>` (`KEY_PREFIX = 'zeus:'`) | Raw keychain inspection shows `zeus:zeus-settings-v2`; unprefixed entries are pre-2026 orphans (Section 6) |
| `cloudSync: false` | On get, set, AND remove | Never flip to `true` for app data — that re-opens the iCloud saga (Section 6) |
| `getItem` returns **`false`** when missing | Not `null`, not `undefined` | `value !== null` checks are always true; use truthiness (`if (value)`) like the rest of the codebase |
| `setItem('')` **deletes** the key | Empty/null string values route to `removeItem` (keychain rejects empty passwords) | "Clearing" a value and "deleting" a key are the same operation; a later `getItem` gives `false`, not `''` |
| `setItem` auto-stringifies | Non-string values pass through `JSON.stringify` | Convenient for `Storage.setItem` — but NEVER pre-stringify for `settingsStore.setSettings` (Section 4, incident `7ed901a10`) |

## 3. `zeus-settings-v2`: one blob, one shallow merge, the #1 data-loss footgun

**What's inside (`stores/SettingsStore.ts`, `Settings` + `Node` interfaces):** every wallet's connection config and secrets — `macaroonHex`, `rune`, `pairingPhrase` (LNC), `nostrWalletConnectUrl`, `seedPhrase`, `walletPassword`, `adminMacaroon`, `ldkMnemonic`, `ldkPassphrase` — plus app-level `pin`, `passphrase`, `duressPin`, `duressPassphrase` (stored in plaintext inside the blob; keychain-is-the-boundary is the current model — known/accepted, do not "fix" drive-by), plus every settings group (`privacy`, `display`, `payments`, `invoices`, `channels`, `pos`, `ecash`, …).

**The two write APIs (`stores/SettingsStore.ts`):**

- `setSettings(settings)` — writes the WHOLE object to `Storage.setItem(STORAGE_KEY, settings)` and replaces `this.settings`. Callers must pass a complete settings object.
- `updateSettings(newSetting)` — does `{ ...existingSettings, ...newSetting }`. This is a **SHALLOW top-level merge**: any nested group you pass **replaces that group wholesale**.

```ts
// DESTRUCTIVE ANTI-PATTERN — silently deletes every other key in settings.invoices
// (memo, addressType, expiry, routeHints, blindedPaths, ...):
await updateSettings({
    invoices: { receiverName: text }
});

// CORRECT — spread the existing group, then override
// (real example: views/Settings/InvoicesSettings.tsx):
await updateSettings({
    invoices: {
        ...settings.invoices,
        receiverName: text
    }
});
```

This is the single most likely way to silently destroy user data in this codebase. In review, treat any `updateSettings({ group: { ... } })` call without a spread of the existing group as a bug until proven otherwise. Top-level scalar keys (`fiat`, `locale`, `nodes`, …) are safe to pass alone.

Also note: `updateSettings` internally calls `getSettings()` first (which can trigger migrations) and sets `settingsUpdateInProgress` / `triggerSettingsRefresh` flags — do not call it in tight loops or during boot races.

## 4. Migrations: load paths and the MOD_KEY recipe

### The two load paths (`SettingsStore.getSettings`)

```
getSettings()
├── await MigrationsUtils.keychainCloudSyncMigration()   // ALWAYS first, before any settings read
├── Storage.getItem('zeus-settings-v2') exists?
│   ├── YES (modern path): parse → migrateRgsDefaultToZeus() → migrateInvoiceExpiryDisplay()
│   └── NO  (legacy path): EncryptedStorage.getItem('zeus-settings')
│         → legacySettingsMigrations()   // all MOD_KEY blocks + migrateInvoiceExpiryDisplay + migrateRgsDefaultToZeus
│         → storageMigrationV2()         // copies every legacy key into the zeus: keychain namespace
└── updateNodeProperties(settings)
```

**Every settings migration must run on BOTH paths** if it can affect users who already migrated to v2. Incident: the invoice-expiry display repair (`26d4215ea`, 2026-05-30) initially ran only on the legacy path; users already on v2 kept the corrupted "3600 hours" display, and the migration had to be re-shipped two days later on the v2 path — under the ORIGINAL flag key (`e8e5b8811`, 2026-06-01). When a further miss (pre-Feb-2024 installs) then forced a re-run, the flag key was bumped to `invoices-expiry-display-fix-v2` (`a7860aa96`, merged `f7b2c30a8`, PR #4149, 2026-06-08) — full narrative: zeus-failure-archaeology FA-3. If your migration missed people, you cannot "re-arm" the old flag — bump the key with a `-v2`/`-v3` suffix and make the migration idempotent.

### The MOD_KEY recipe (copy this shape)

One-shot migrations live in `utils/MigrationUtils.ts`. Pattern (see `MOD_KEY7 = 'bimodal-bug-9085'` or `migrateRgsDefaultToZeus` for live examples):

```ts
const MOD_KEY_MY_FIX = 'my-fix-v1';                          // flag key, EncryptedStorage
const mod = await EncryptedStorage.getItem(MOD_KEY_MY_FIX);
if (!mod) {
    // ... mutate newSettings in place (idempotently!) ...
    await settingsStore.setSettings(newSettings);            // (a) AWAIT it  (b) pass the OBJECT
    await EncryptedStorage.setItem(MOD_KEY_MY_FIX, 'true');  // set flag ONLY after write succeeds
}
```

Hard rules, each backed by a shipped incident:

1. **Pass a real object to `setSettings`, never `JSON.stringify(settings)`.** A stringified payload briefly turns the MobX `settings` observable into a string and crashes observers reading nested keys. Incident fixed in `7ed901a10` (issue #4150, merged via PR #4155, 2026-06-09); a regression test now pins this (`utils/MigrationUtils.test.ts`, "persists the settings object rather than a JSON string"). (`Storage.setItem` stringifies internally — that is fine; the observable assignment is what breaks.)
2. **`await` the `setSettings` call.** Un-awaited writes let the flag get set before the data lands (or after the app moves on), producing migrations that "ran" but persisted nothing. Fixed across all MOD_KEY blocks in `d8e648b58` (2026-05-30).
3. **Set the flag AFTER the mutation is persisted**, so a crash mid-migration retries next boot instead of skipping forever.
4. **Make the mutation idempotent** (safe to run twice) — flags can be lost (EncryptedStorage cleared) while keychain data survives.
5. **Cover both load paths** (see above). For settings-shape migrations that must also hit v2 users, call your function from the modern branch of `getSettings` too, like `migrateInvoiceExpiryDisplay`.
6. **New defaults need no migration; CHANGED defaults do.** Inline defaults in `SettingsStore` only apply to keys the user has never persisted. To change behavior for existing users you must ship a MOD_KEY migration (details of the settings axes: `zeus-config-and-flags`).

Add a test in `utils/MigrationUtils.test.ts` (22 tests passing as of 2026-07-06; run `npx jest utils/MigrationUtils.test.ts`).

## 5. Checklist: adding a NEW persisted key

Convention: export the key constant from its owning store/util (e.g. `export const NOTES_KEY = 'zeus-notes-v2'` in `stores/NotesStore.ts`) and import it everywhere else — never inline string literals. New keys use a `zeus-` prefix and `-v2` style suffix by convention.

Then register it, or it leaks:

| # | Register in | Why | Mandatory? |
|---|---|---|---|
| 1 | `utils/DataClearUtils.ts` → `STORAGE_KEYS` | Otherwise the key **survives "Clear All Data"** (Tools → clear storage) — orphaned user data, possibly secrets, left on device | **Always** |
| 2 | `utils/KeychainRecoveryUtils.ts` → `OTHER_KEYS` | Otherwise the Keychain Recovery tool (`views/Tools/NodeConfigExportImport.tsx`) cannot find/restore it for users with lost data | Yes, if it holds user data worth recovering |
| 3 | `utils/MigrationUtils.ts` → `keychainCloudSyncMigration` `migrationKeys` | Otherwise pre-2026 unprefixed keychain copies of the key are never migrated into the `zeus:` namespace | Only if the key **existed before the `zeus:` prefix migration** (Jan 2026, `318c721e7`). Brand-new keys have no unprefixed ancestor — skip. (Precedent: `FAVORITE_CURRENCIES_KEY`, added post-migration, is in `STORAGE_KEYS` only.) |

If the key is dynamic (per-node/per-mint, like `<nodeDir>-cashu-*`), you must ALSO handle enumeration in `DataClearUtils` (see `clearCashuDataForNode`) — static lists can't clear keys they can't name.

## 6. iCloud rules and the orphaned-entry policy

History you must know before "improving" anything here: the multi-attempt iCloud keychain saga (merge → same-day revert → re-land → stale-restore fallout → `zeus:`-prefix re-keying → deletion disabled). The full dated timeline with hashes is owned by **zeus-failure-archaeology FA-1** — do not rely on memory of it; read that entry before touching this area.

Current rules (verified against master 2026-07-06):

1. **All writes are `cloudSync: false`** — enforced inside `storage/index.ts`. Never write app data with `cloudSync: true`.
2. **Orphaned pre-migration entries are retained BY DESIGN.** `MigrationUtils.deleteFromOldKeychain` is a no-op with the delete code commented out. Old unprefixed local AND iCloud-synced entries (including seed copies) persist on purpose: the Keychain Recovery tool (`views/Tools/NodeConfigExportImport.tsx` + `utils/KeychainRecoveryUtils.ts`) scans exactly those four sources (`current` / `unprefixed-local` / `unprefixed-cloud` / `encrypted-storage`) to rescue users' lost wallets. **Do not "clean up" orphans** — that deletes the recovery path. Re-enabling deletion is maintainer-gated.
3. **Explicit purges must clear BOTH sync variants and BOTH namespaces.** `DataClearUtils.clearKey` is the reference: it resets `zeus:<key>` local + cloud, and unprefixed `<key>` local + cloud, five calls total. Any new wipe path that clears fewer locations leaves secrets behind.
4. `migrateKey` uses read → write → verify → delete ordering with 500 ms iOS sleeps around keychain ops (iCloud sync latency, `35aaf8897`) — keep that ordering and pacing if you extend it.

## 7. Caveats — data that does NOT die when you think it does

| Path | What it actually clears | What SURVIVES |
|---|---|---|
| **Duress PIN/passphrase** (`views/Lockscreen.tsx deleteNodes`) | `updateSettings({ nodes: undefined, selectedNode: undefined, authenticationAttempts: 0 })` — only the wallet REFERENCES in the blob | Embedded LND dirs, `ldk-node/<uuid>` dirs, CDK Cashu SQLite DB, per-node keychain keys (`<nodeDir>-cashu-seed-phrase`, …), other blob keys, VSS remote state. Forensically recoverable — this is the current design; document, don't silently "harden" |
| **Clear All Data** (`utils/DataClearUtils.clearAllData`, Tools view, then `RNRestart.Restart()`) | Registered keys (all 5 locations), notes, Cashu keys for `node.lndDir` namespaces (plus literals `'lnd'` and `''`) + CDK DB, AsyncStorage, EncryptedStorage | Any key NOT in `STORAGE_KEYS`/enumerable (Section 5); LND/LDK native dirs (deleted only via wallet deletion in `views/Settings/WalletConfiguration.tsx`); VSS remote state. Note: `<ldkNodeDir>-cashu-*` keys are not enumerated by `clearAllData` — this is **by design** (maintainer-stated 2026-07-06): the Cashu seed is deterministically re-derived from the wallet seed every time, so these entries carry no independent secret material. Do not re-flag this as a wipe gap |
| **Wallet deletion** (`WalletConfiguration.tsx`) | Blob entry; embedded-lnd → `deleteLndWallet(lndDir)`; ldk-node → `deleteLdkNodeWallet(ldkNodeDir)` (local `RNFS.unlink` only) | **VSS remote channel state — there is NO delete path** (`utils/LdkNodeUtils.ts` has no VSS delete; open gap, maintainer-acknowledged). Cashu data unless separately cleared |

**Per-node Cashu namespacing:** always use `CashuStore.getNodeDir()` (returns `ldkNodeDir || 'ldk'` for ldk-node, else `lndDir || 'lnd'`) — NOT `getLndDir()`, which returns `'lnd'` for every LDK wallet. That collision mixed ecash funds across LDK wallets; fixed by `1242ce94a` (2026-03-20) with a copy migration (`migrateLegacyCashuKeysToNodeDir`), and again for multimint keys in `35fa31fee` (2026-04-08) — incident narrative: zeus-failure-archaeology FA-11. Any new per-node key must be namespaced with `getNodeDir()`.

**Node dirs are UUIDs:** new embedded wallets get `lndDir = uuidv4()` / `ldkNodeDir = uuidv4()` (`views/Settings/WalletConfiguration.tsx`); old single-wallet installs used the literal `'lnd'` — which is why fallbacks and `clearCashuDataForNode('lnd')` exist.

## 8. SAFETY PROTOCOL for any storage-touching change

This executes within the gate defined in `zeus-change-control` (maintainer sign-off + migration plan required, always).

### Pre-change checklist (do this BEFORE writing code)

- [ ] Written migration plan: what data moves/changes, for which cohorts (legacy-blob users, v2 users, fresh installs), and what happens on crash mid-migration
- [ ] Idempotency argument: running the migration twice is harmless
- [ ] Both load paths covered (Section 4) — state explicitly which of `legacySettingsMigrations` / modern `getSettings` branch calls your code
- [ ] Flag key named and versioned (`<thing>-<fix>-v1`), stored in EncryptedStorage
- [ ] New keys registered per Section 5 (all applicable locations)
- [ ] No `JSON.stringify` into `setSettings`; every `setSettings` awaited; every `updateSettings` nested group spread
- [ ] No deletion of orphaned/unprefixed/iCloud keychain entries (Section 6 rule 2)
- [ ] Jest coverage added in `utils/MigrationUtils.test.ts` for the new migration logic
- [ ] Rollback story written (below)

### Mandatory manual test matrix

PR CI never builds the app (test/lint/prettier/tsc only; the Android build workflow is manual `workflow_dispatch`) and there are zero store-level integration tests — this matrix is hand-executed, and the maintainer requires hands-on testing on BOTH platforms before merge regardless of CI green. Record results in the PR (the PR template's testing section — see `zeus-change-control`).

| # | Scenario | How to set up | Pass condition |
|---|---|---|---|
| 1 | Fresh install | Wipe app / new simulator | Defaults correct; migration flags set without touching anything; no migration UI flash |
| 2 | Upgrade from legacy blob | Seed `zeus-settings` in EncryptedStorage (dev helper: `KeychainRecoveryUtils.copyToLegacyLocations()` writes current settings to all legacy locations) | Full `storageMigrationV2` runs once; all wallets, contacts, notes intact |
| 3 | Upgrade from current v2 | Install released build, add wallets + nested settings, then install your build | Your migration runs exactly once; NO nested settings group reset (diff the blob before/after) |
| 4 | iCloud-restored device (iOS) | Restore a device/simulator from a backup of a pre-`zeus:`-prefix install, or seed unprefixed cloud entries via `copyToLegacyLocations()` | No stale wallet resurrection; Keychain Recovery tool still lists orphans |
| 5 | Multi-wallet | ≥2 embedded wallets incl. ≥2 LDK Node wallets with Cashu enabled | No cross-wallet data bleed; `getNodeDir()` namespacing holds; per-wallet balances distinct |
| 6 | Duress wipe | Set duress PIN, trigger it | `nodes`/`selectedNode` nulled, app lands on IntroSplash; verify (and note in PR) what survives per Section 7 |

Also re-run the automated floor: `yarn verify` (jest + prettier + tsc + lint — anatomy in `zeus-validation-and-qa`).

### Rollback thinking (revert-first culture)

- Regressions found in release testing get **reverted same-day, never forward-fixed under pressure** (maintainer rule; observed repeatedly for storage/keychain changes — e.g. #3307 merged and reverted within hours on 2025-11-10).
- Design so a revert is safe: a migration that only ADDS/repairs fields can be reverted without a counter-migration; one that deletes or re-keys data cannot. If your change is not revert-safe, say so in the PR and provide the counter-migration.
- Never reuse a burned flag key after a botched migration — bump the suffix (`-v2`) so already-flagged users are re-processed by the fixed logic.

### Evidence the maintainer expects in the PR

1. The migration plan (cohorts, idempotency, both-paths coverage, revert story)
2. The filled test matrix with device/OS noted per row, iOS AND Android
3. Before/after dumps of the relevant blob section for scenario 3 (redact secrets)
4. New/updated Jest tests passing (`npx jest utils/MigrationUtils.test.ts`)
5. Explicit statement of which of the Section 5 registration points you touched and why the others don't apply

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by reading `storage/index.ts`, `stores/SettingsStore.ts`, `utils/MigrationUtils.ts`, `utils/DataClearUtils.ts`, `utils/KeychainRecoveryUtils.ts`, `utils/LdkNodeUtils.ts`, `stores/CashuStore.ts`, `views/Lockscreen.tsx`, `views/Settings/WalletConfiguration.tsx`, `views/Tools/*`; cited hashes checked with `git log`/`git show`; `npx jest utils/MigrationUtils.test.ts` executed (22/22 pass). Maintainer policy statements dated 2026-07-06.

Re-verification one-liners for volatile facts:

| Fact | Re-verify with |
|---|---|
| Storage contract (`zeus:` prefix, `cloudSync:false`, `false` on miss, empty→delete) | `cat storage/index.ts` |
| Blob keys `zeus-settings-v2` / legacy `zeus-settings` | `grep -n "STORAGE_KEY" stores/SettingsStore.ts \| head -3` |
| `updateSettings` still shallow-merges | `grep -n -A8 "updateSettings = async" stores/SettingsStore.ts` |
| `getSettings` migration order (cloud-sync migration first, both load paths) | `grep -n -A35 "public getSettings" stores/SettingsStore.ts` |
| `deleteFromOldKeychain` still a no-op | `grep -n -A6 "deleteFromOldKeychain" utils/MigrationUtils.ts` |
| Current MOD_KEY flag names | `grep -n "MOD_KEY\|MIGRATION_KEY" utils/MigrationUtils.ts` |
| `migrationKeys` list contents | `grep -n -A22 "const migrationKeys" utils/MigrationUtils.ts` |
| `STORAGE_KEYS` registration list | `grep -n -A45 "const STORAGE_KEYS" utils/DataClearUtils.ts` |
| `OTHER_KEYS` recovery list | `grep -n -A22 "const OTHER_KEYS" utils/KeychainRecoveryUtils.ts` |
| Duress wipe scope | `grep -n -A10 "deleteNodes = " views/Lockscreen.tsx` |
| `getNodeDir` namespacing | `grep -n -A7 "getNodeDir = " stores/CashuStore.ts` |
| VSS default + (absence of) delete path | `grep -n "DEFAULT_VSS_SERVER\|deleteLdkNodeWallet" utils/LdkNodeUtils.ts` |
| CDK DB path | `grep -n -A12 "clearCDKDatabase" utils/DataClearUtils.ts` |
| EncryptedStorage version | `grep -n "react-native-encrypted-storage" package.json` |
| Migration tests still green | `npx jest utils/MigrationUtils.test.ts` |
| Cited incident hashes | `git log -1 --format='%h %ci %s' 7ed901a10 d8e648b58 26d4215ea e8e5b8811 a7860aa96 f7b2c30a8 c6323fff4 318c721e7 1242ce94a 35fa31fee` |

Open/unresolved (do not treat as settled): VSS remote-state deletion (no client delete path); permanent-retention-vs-eventual-deletion of orphaned keychain entries (retention is current policy, revisiting is maintainer-gated); plaintext PIN/passphrase in the blob (accepted debt).
