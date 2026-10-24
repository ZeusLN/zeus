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
| `cloudSync` | iOS-only keychain attribute (`kSecAttrSynchronizable`). `true` = the entry syncs to the user's iCloud Keychain and follows them to new devices. Zeus writes with `cloudSync: false` — always. WARNING: unpatched react-native-keychain 10.0.0 treated a PRESENT `cloudSync: false` as true (ObjC pointer truthiness on `@NO`), so all `zeus:*` data was actually synchronizable until `patches/patch-keychain-cloudsync.mjs`; `keychainDesyncMigration` repairs affected installs. |
| EncryptedStorage | The `react-native-encrypted-storage` package (v4.0.3, `package.json`). Zeus's PREVIOUS storage backend. Legacy-only now. |
| AsyncStorage | `@react-native-async-storage/async-storage` — plain unencrypted key-value storage. Non-sensitive flags only. |
| Settings blob | ONE JSON document holding all app settings AND all wallet secrets, stored in the keychain under key `zeus-settings-v2`. |
| MobX observable | Reactive state object (`stores/` classes use MobX decorators). UI re-renders when observables change; replacing an observable object with a string corrupts every observer. |
| Macaroon | LND's bearer-token credential (hex in `Node.macaroonHex` / `Node.adminMacaroon`). Possession = control of the node. |
| Seed / mnemonic | BIP-39 word list that derives all wallet keys (`Node.seedPhrase`, `Node.ldkMnemonic`). Loss = loss of funds. |
| Embedded LND / LDK Node | The two node implementations that run INSIDE the app and keep native on-disk state (channel databases etc.), unlike remote backends. |
| Cashu / CDK | Ecash wallet subsystem backed by the Cashu Dev Kit Rust FFI; keeps its own SQLite database (`cashu_wallet.db`) outside the keychain. |
| VSS | Versioned Storage Service — remote server (`https://vss.zeusln.com/vss`, `utils/LdkNodeUtils.ts` `DEFAULT_VSS_SERVER`) where LDK Node persists encrypted channel state, keyed from the node mnemonic. |
| Duress PIN | Alternate PIN or passphrase that, when entered, runs the full `clearAllData()` wipe and then `restartApp()` instead of unlocking (`views/Lockscreen.tsx` `deleteNodes`). |

## 1. The four storage layers — what belongs where

| Layer | Access via | What belongs there | Examples |
|---|---|---|---|
| **Keychain (canonical)** | `storage/index.ts` ONLY | Everything persisted by app code: the settings blob, all secrets, per-store data | `zeus-settings-v2`, `zeus-contacts-v2`, `zeus-notes-v2`, `swaps-rescue-key`, `<nodeDir>-cashu-seed-phrase` |
| **Legacy EncryptedStorage** | `react-native-encrypted-storage` | ONLY two things: (a) the old `zeus-settings` blob read during legacy upgrade, (b) one-shot migration flag keys (`MOD_KEY*`, `ios-keychain-cloud-sync-migration-v1`, …). **Never add new data here.** | `lsp-taproot-mod`, `invoices-expiry-display-fix-v2` (both read-only legacy flags since PR #4477: still read, never written) |
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

// CORRECT: merge into the group inside the write queue
// (real example: views/Settings/InvoicesSettings.tsx):
await updateSettingsGroup('invoices', { receiverName: text });

// ALSO WRONG: a render-time spread reverts earlier queued writes:
await updateSettings({
    invoices: { ...settings.invoices, receiverName: text }
});
```

This is the single most likely way to silently destroy user data in this codebase. In review, treat any `updateSettings({ group: { ... } })` call as a bug until proven otherwise. Top-level scalar keys (`fiat`, `locale`, …) are safe to pass alone.

**Why not spread `settings.group`:** calls are serialized on `updateSettingsQueue`, and `SettingsStore.settings` only changes once a write lands. A group spread from render-time settings copies the old value of whatever an earlier queued write changed and reverts it (#4841 in `ChannelsSettings`, then every settings view in #4903). Use:

- `updateSettingsGroup(group, patch)` for nested groups. A function patch, `updateSettingsGroup('channels', (current) => ({ ... }))`, receives the group as it is inside the queue.
- `updateSettings((current: Settings) => ({ ... }))` for anything else derived from current settings, such as the `nodes` array (`SeedRecovery`, `WalletConfiguration`, wallet deletion).
- `updateSettingsGroupDebounced(group, patch)` for text inputs that write on every keystroke. It persists 500 ms after the last call. The screen must call `flushPendingSettings()` on unmount; pending patches also flush before any other update and when the app leaves the foreground.

`check-settings-writes.test.ts` (part of `yarn test`) fails on any `...settings.<key>` spread in app code. Do not lock controls with `settingsUpdateInProgress` to serialize settings writes; the queue already does that. Keep a lock only when the handler does other async work (a server request, the theme change in `Display`).

Also note: `updateSettings` internally calls `getSettings(true, true)` first (silent, so `loading` is not set; it can trigger migrations, whose one-shot flags `MigrationUtils` caches once they read `'true'`) and sets `settingsUpdateInProgress` / `triggerSettingsRefresh` flags (the latter only when the persisted settings actually change outside `REFRESH_EXEMPT_SETTINGS`). Each write still costs a keychain read and write; do not call it in tight loops or during boot races.

## 4. Migrations: load paths and versioned settings migrations

### The two load paths (`SettingsStore.getSettings`)

```
getSettings(silentUpdate, fromQueue)
├── await MigrationsUtils.keychainDesyncMigration()      // ALWAYS first: copies synchronizable zeus:* items
│                                                        // into the device-local partition (cloudSync bug repair).
│                                                        // MUST precede keychainCloudSyncMigration, or migrateKey's
│                                                        // Storage.getItem guard misses on the empty local partition
│                                                        // and stale unprefixed legacy data shadows the fresher copy
├── await MigrationsUtils.keychainCloudSyncMigration()   // before any settings read
├── await MigrationsUtils.purgeRescueKeyFiles()          // rescue-key staging file (once per process) and legacy
│                                                        // export files ('rescue-key-file-cleanup' flag)
├── Storage.getItem('zeus-settings-v2')
│   └── empty on iOS → getRawItem('zeus:zeus-settings-v2', true)   // read-only fallback to the synchronizable
│                                                                  // partition; never written back there
├── blob found?
│   ├── YES (modern path): parse → runSettingsMigrations(parsed, fromQueue)
│   │     ├── settingsVersion >= SETTINGS_VERSION and no missing group → return as is (no keystore reads)
│   │     ├── called outside the updateSettings queue → settingsStore.updateSettings({}), which re-enters below
│   │     └── called inside the queue → applySettingsMigrations() if stale, then applyMissingSettingsGroups();
│   │           applySettingsUpdate's setSettings persists the result
│   └── NO  (legacy path): EncryptedStorage.getItem('zeus-settings')
│         → legacySettingsMigrations()   // legacy repairs, read-only legacy flags, applySettingsMigrations(),
│                                        // applyMissingSettingsGroups()
│         → storageMigrationV2()         // writes the stamped blob once; copies every legacy key into the zeus: namespace
└── updateNodeProperties(settings)
```

**Every settings migration must run on BOTH paths** if it can affect users who already migrated to v2. Incident: the invoice-expiry display repair (`26d4215ea`, 2026-05-30) initially ran only on the legacy path; users already on v2 kept the corrupted "3600 hours" display, and the migration had to be re-shipped two days later on the v2 path — under the ORIGINAL flag key (`e8e5b8811`, 2026-06-01). When a further miss (pre-Feb-2024 installs) then forced a re-run, the flag key was bumped to `invoices-expiry-display-fix-v2` (`a7860aa96`, merged `f7b2c30a8`, PR #4149, 2026-06-08) — full narrative: zeus-failure-archaeology FA-3. Since PR #4477 (merged 2026-09-17, `dcf4f4a85`) both paths call the same `applySettingsMigrations`, so a settings migration added there covers both by construction. If a migration missed people, you cannot re-run a shipped version gate: add a new block under a fresh `SETTINGS_VERSION` bump and make it value-conditional.

### The versioned migration recipe (copy this shape)

Settings migrations are gated by a `settingsVersion` stamp stored in the blob, not by per-migration flags (PR #4477; commits `76995a28b`, `1baa3de99`). `SETTINGS_VERSION` lives in `utils/SettingsVersion.ts`. Follow the "Adding a future migration" comment above `runSettingsMigrations` in `utils/MigrationUtils.ts`; the `priorVersion < 3` block calling `applyRetiredThemes` (#4768) is a live example:

```ts
// utils/SettingsVersion.ts
export const SETTINGS_VERSION = 4;                  // current value + 1

// utils/MigrationUtils.ts: pure mutation, no I/O, returns whether it changed anything
public applyMyFix(settings: any): boolean {
    if (/* value still equals the old default */) {
        // ... mutate settings in place ...
        return true;
    }
    return false;
}

// in applySettingsMigrations, after the existing blocks
if (priorVersion < 4) {
    changed = this.applyMyFix(settings) || changed;
}
```

Hard rules:

1. **No `setSettings` call and no flag inside a settings migration.** `applySettingsMigrations` mutates in memory and stamps `settingsVersion = SETTINGS_VERSION`. The one write belongs to `applySettingsUpdate` (modern path, through `runSettingsMigrations`) or `storageMigrationV2` (legacy path), so migrated values and the stamp land together. Wherever you do call `setSettings`, pass the object, never `JSON.stringify(settings)`: a string briefly replaces the MobX `settings` observable and crashes observers reading nested keys (incident `7ed901a10`, issue #4150, PR #4155).
2. **Leave existing `priorVersion < N` blocks untouched** and gate the new block on exactly the bumped version. The test 'keeps the highest version gate equal to SETTINGS_VERSION' in `utils/MigrationUtils.test.ts` scans the source and fails when the highest gate and `SETTINGS_VERSION` differ in either direction.
3. **A shipped version number is frozen.** Once any public build (alphas and TestFlight included) stamps N, blobs at N skip every `< N` block forever, so a migration added later needs its own bump. This replaces the old rule of bumping a flag key's `-v2` suffix.
4. **Make the mutation value-conditional** (touch only values still equal to an old default, or still inconsistent), like `applyOlympusHostsToZeusLsp` and `applyInvoiceExpiryDisplay`. The stamp makes a block run exactly once per blob, but an unstamped blob (any install predating #4477) runs every block once, including blocks added long after that install last launched.
5. **Do not add settings-shape migrations to `legacySettingsMigrations` or to `getSettings`.** `applySettingsMigrations` already runs on both load paths. The flags read there are read-only and never written again: the eight legacy MOD_KEY flags in `legacySettingsMigrations` (`lsp-taproot-mod` through `nostr-relays-2024`, including `'bimodal-bug-9085'` read as `mod7`) and the five v1 flags in the `priorVersion < 1` block (`rgs-defaults-v2`, `zeuslsp-hosts-2026`, `swap-hosts-boltz`, `swap-hosts-retired-eldamar`, `invoices-expiry-display-fix-v2`).
6. **New defaults need no migration; CHANGED defaults need a `SETTINGS_VERSION` bump.** A stored blob replaces `DEFAULT_SETTINGS` wholesale; the only backfill is `applyMissingSettingsGroups` (PR #4788, issue #4776), which fills top-level groups absent from the blob from `DEFAULT_SETTINGS` plus `BACKFILL_OVERRIDES` on every load, independent of the version. Keys the user already persisted, and new fields inside an existing group, are not touched. To change behavior for existing users, ship a versioned migration as above (settings axes: `zeus-config-and-flags`).

Keychain and file one-shots that are not settings-shape changes still use flags, through the private `readFlag`/`writeFlag` helpers (cached in `confirmedFlags`, cleared by Clear All Data via `clearConfirmedFlags`): `keychainDesyncMigration` (`keychain-desync-v1`), `keychainCloudSyncMigration` (`ios-keychain-cloud-sync-migration-v1`, `ios-keychain-cashu-fix-v1`), `purgeRescueKeyFiles` (`rescue-key-file-cleanup`). Write the flag only after the work succeeds (`keychainDesyncMigration` leaves it unset when any copy fails), and bump the key suffix to re-run one.

Add tests in `utils/MigrationUtils.test.ts` (87 `it` blocks as of 2026-10-24; storage-layer cases are in `utils/MigrationUtils.storage.test.ts`). Run `npx jest utils/MigrationUtils` (113 passing, 5 todo, on `3dc9f83e6`).

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

1. **All writes are `cloudSync: false`** — enforced inside `storage/index.ts`. Never write app data with `cloudSync: true`. NOTE: `cloudSync: false` only truly means non-synchronizable because `patches/patch-keychain-cloudsync.mjs` fixes react-native-keychain's presence-check bug; the patch throws at postinstall if a dependency bump ever removes it. Do not bump react-native-keychain without re-verifying `cloudSyncValue()`.
2. **Orphaned pre-migration entries are deleted by the one-shot KEY-004 auto-purge, but never by a MIGRATION.** `MigrationUtils.deleteFromOldKeychain` is still a no-op with the delete code commented out, and no MIGRATION may delete keychain data. Since the KEY-004 remediation, `autoPurgeLegacyKeychain` (`utils/KeychainPurgeUtils.ts`, fired from Wallet boot, iOS only) automatically deletes the iCloud-synced `zeus:*` copies and counterpart-verified legacy orphans: it runs only after `keychainDesyncMigration`'s flag proves local copies exist, is preflight-verified (live local blob must exist; a synchronizable `zeus:*` entry is never deleted while it is the only copy; an unprefixed entry is never deleted without its migrated counterpart), and retries next boot until a zero-failure pass. This was a deliberate maintainer policy reversal (2026-09, PR #4385): deletion still propagates to other devices (the #3625 mode), accepted because the sync copies ARE the KEY-004 exposure, the sync was never an advertised feature, and node-bound wallets never survived device transfer anyway. Tools > Keychain Cleanup remains as the manual, consent-gated fallback (covers Android legacy entries and safety-skipped items). The Keychain Recovery tool (`views/Tools/NodeConfigExportImport.tsx` + `utils/KeychainRecoveryUtils.ts`) still scans `current` / `unprefixed-local` / `unprefixed-cloud` / `encrypted-storage`; post-purge, empty recovery scans are expected. Any NEW deletion path is still maintainer-gated.
3. **Explicit purges must clear BOTH sync variants and BOTH namespaces.** `DataClearUtils.clearKey` is the reference: it resets `zeus:<key>` local + cloud, and unprefixed `<key>` local + cloud, five calls total. Any new wipe path that clears fewer locations leaves secrets behind.
4. `migrateKey` uses read → write → verify → delete ordering with 500 ms iOS sleeps around keychain ops (iCloud sync latency, `35aaf8897`) — keep that ordering and pacing if you extend it.

## 7. Caveats — data that does NOT die when you think it does

| Path | What it actually clears | What SURVIVES |
|---|---|---|
| **Duress PIN/passphrase and max failed attempts** (`views/Lockscreen.tsx` `deleteNodes`, `authenticationFailure`; `7fa37aa9b`) | Both run the full `clearAllData()` (next row) inside `startWipe`, which calls `markWipePending()` first, then `restartApp()` in a `finally`, so a partial wipe still restarts. Errors are logged, never shown (showing one would disclose the duress mechanism). Settings are not written back: `updateSettings` would re-persist the pre-wipe in-memory blob | Same as Clear All Data. A wipe cut short (app killed) is finished on the next launch: the Lockscreen checks `isWipePending()` before loading settings or accepting a credential (#5141) |
| **Clear All Data** (`utils/DataClearUtils.clearAllData`, called from `views/Tools/index.tsx` and the Lockscreen, which then call `restartApp()`) | In order: `Storage.blockWrites()` latch for the rest of the JS context; `markWipePending()` (`wipe-pending` in EncryptedStorage, #5141); `clearNodeKeychainData` per configured node (Cashu keys under both `lndDir` and `ldkNodeDir`, `CASHU_KEY_SUFFIXES`, LNC credentials, xprv cache; xprv re-derivation skipped on Android) plus Cashu keys for `'lnd'`, `'ldk'`, `''`; CDK DB (`clearCDKDatabase`); node data dirs of configured nodes (`deleteNodeDataDirectoryWithRetry`, 3 attempts) and orphaned LND/LDK dirs no config names (`clearOrphanedNodeDataDirectories`, #5266); legacy rescue-key files and the staging copy; POS order records; legacy `zeus-settings`, `STORAGE_KEYS` (all 5 locations), notes; AsyncStorage; EncryptedStorage; HTTP cookies; delivered notifications; step 8 keychain sweep (iOS: every internet-password item in both partitions; Android: delete the `RN_KEYCHAIN` backing store); then the `wipe-pending` record is removed | VSS remote state (no delete path). A node dir that still fails after 3 attempts is logged and skipped, never aborts the wipe |
| **Wallet deletion** (`WalletConfiguration.tsx` `deleteNodeConfig`) | Stops the node if active; `clearCDKDatabaseForNode` (per-wallet CDK DB, before its seed is cleared); `clearNodeKeychainData` (keeps LNC credentials another config shares); removes the blob entry with a functional `updateSettings`; then `deleteNodeDataDirectoryWithRetry` (embedded-lnd → `deleteLndWallet`, ldk-node → `stopLdkNode` + `deleteLdkNodeWallet`), and on failure `promptRetryDataDirDeletion` offers Retry or Skip. Deleting the last wallet also runs `clearCDKDatabase()` to sweep every remaining CDK DB | **VSS remote channel state: there is NO delete path** (`utils/LdkNodeUtils.ts` has no VSS delete; open gap, maintainer-acknowledged). A node dir the user skipped (later removed by Clear All Data's orphan sweep) |

**Per-node Cashu namespacing:** always use `CashuStore.getNodeDir()` (returns `ldkNodeDir || 'ldk'` for ldk-node, else `lndDir || 'lnd'`) — NOT `settingsStore.lndDir || 'lnd'`, which is `'lnd'` for every LDK wallet (the old `CashuStore.getLndDir()` did this and was removed with the migration). That collision mixed ecash funds across LDK wallets in feature-branch builds; fixed by `1242ce94a` (2026-03-20) and for multimint keys by `35fa31fee` (2026-04-08), both before their PRs merged, so no release wrote LDK Cashu data under `lnd` and no migration is needed. The no-op `migrateLegacyCashuKeysToNodeDir` was removed (#4912); do not reintroduce a copy from `lnd-cashu-*`, because on released installs that namespace belongs to remote and embedded LND wallets. Incident narrative: zeus-failure-archaeology FA-11. Any new per-node key must be namespaced with `getNodeDir()`.

**Node dirs are UUIDs:** new embedded wallets get `lndDir = uuidv4()` / `ldkNodeDir = uuidv4()` (`views/Settings/WalletConfiguration.tsx`); old single-wallet installs used the literal `'lnd'` — which is why fallbacks and `clearCashuDataForNode('lnd')` exist.

## 8. SAFETY PROTOCOL for any storage-touching change

This executes within the gate defined in `zeus-change-control` (maintainer sign-off + migration plan required, always).

### Pre-change checklist (do this BEFORE writing code)

- [ ] Written migration plan: what data moves/changes, for which cohorts (legacy-blob users, v2 users, fresh installs), and what happens on crash mid-migration
- [ ] Idempotency argument: running the migration twice is harmless
- [ ] Both load paths covered (Section 4): a settings migration lives in a `priorVersion < N` block of `applySettingsMigrations`, which both `runSettingsMigrations` (modern) and `legacySettingsMigrations` (legacy) call; state that it is not called from anywhere else
- [ ] Settings migration: `SETTINGS_VERSION` bumped to a number no public build has shipped, new block gated on `priorVersion < N` (Section 4). Keychain/file one-shot: flag key named and versioned (`<thing>-<fix>-v1`), read and written with `readFlag`/`writeFlag`
- [ ] New keys registered per Section 5 (all applicable locations)
- [ ] No `setSettings` call inside a settings migration (the stamped blob is written once by `applySettingsUpdate` or `storageMigrationV2`); anywhere else, no `JSON.stringify` into `setSettings` and every `setSettings` awaited; every `updateSettings` nested group spread
- [ ] No deletion of orphaned/unprefixed/iCloud keychain entries (Section 6 rule 2)
- [ ] Jest coverage added in `utils/MigrationUtils.test.ts` for the new migration: the mutation function, an unstamped blob running the block, a blob stamped at N skipping it; the gate-consistency test still passes
- [ ] Rollback story written (below)

### Mandatory manual test matrix

PR CI never builds the app (test/lint/prettier/tsc only; the Android build workflow is manual `workflow_dispatch`) and there are zero store-level integration tests — this matrix is hand-executed, and the maintainer requires hands-on testing on BOTH platforms before merge regardless of CI green. Record results in the PR (the PR template's testing section — see `zeus-change-control`).

| # | Scenario | How to set up | Pass condition |
|---|---|---|---|
| 1 | Fresh install | Wipe app / new simulator | Defaults correct; the first settings write stores `settingsVersion` equal to `SETTINGS_VERSION` (from `DEFAULT_SETTINGS`) so no settings migration runs; no migration UI flash |
| 2 | Upgrade from legacy blob | Seed `zeus-settings` in EncryptedStorage (dev helper: `KeychainRecoveryUtils.copyToLegacyLocations()` writes current settings to all legacy locations) | Full `storageMigrationV2` runs once; all wallets, contacts, notes intact |
| 3 | Upgrade from current v2 | Install released build, add wallets + nested settings, then install your build | Your migration runs exactly once; NO nested settings group reset (diff the blob before/after) |
| 4 | iCloud-restored device (iOS) | Restore a device/simulator from a backup of a pre-`zeus:`-prefix install, or seed unprefixed cloud entries via `copyToLegacyLocations()` | No stale wallet resurrection; Keychain Recovery tool still lists orphans |
| 5 | Multi-wallet | ≥2 embedded wallets incl. ≥2 LDK Node wallets with Cashu enabled | No cross-wallet data bleed; `getNodeDir()` namespacing holds; per-wallet balances distinct |
| 6 | Duress wipe | Set duress PIN, trigger it | Full `clearAllData()` wipe and app restart to a fresh install state; kill the app mid-wipe once and confirm the next launch finishes it; note in the PR anything that survives per Section 7 |

Also re-run the automated floor: `yarn verify` (jest + prettier + tsc + lint — anatomy in `zeus-validation-and-qa`).

### Rollback thinking (revert-first culture)

- Regressions found in release testing get **reverted same-day, never forward-fixed under pressure** (maintainer rule; observed repeatedly for storage/keychain changes — e.g. #3307 merged and reverted within hours on 2025-11-10).
- Design so a revert is safe: a migration that only ADDS/repairs fields can be reverted without a counter-migration; one that deletes or re-keys data cannot. If your change is not revert-safe, say so in the PR and provide the counter-migration.
- Never reuse a shipped `SETTINGS_VERSION` after a botched migration. Once a public build (alphas and TestFlight included) has stamped N, blobs at N skip every `priorVersion < N` block, so the fixed logic goes in a new block under a fresh bump. For keychain/file one-shots, bump the flag key suffix (`-v2`) instead.

### Evidence the maintainer expects in the PR

1. The migration plan (cohorts, idempotency, both-paths coverage, revert story)
2. The filled test matrix with device/OS noted per row, iOS AND Android
3. Before/after dumps of the relevant blob section for scenario 3 (redact secrets)
4. New/updated Jest tests passing (`npx jest utils/MigrationUtils.test.ts`)
5. Explicit statement of which of the Section 5 registration points you touched and why the others don't apply

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by reading `storage/index.ts`, `stores/SettingsStore.ts`, `utils/MigrationUtils.ts`, `utils/DataClearUtils.ts`, `utils/KeychainRecoveryUtils.ts`, `utils/LdkNodeUtils.ts`, `stores/CashuStore.ts`, `views/Lockscreen.tsx`, `views/Settings/WalletConfiguration.tsx`, `views/Tools/*`; cited hashes checked with `git log`/`git show`; `npx jest utils/MigrationUtils.test.ts` executed (22/22 pass). Maintainer policy statements dated 2026-07-06. Section 7, the Duress PIN glossary entry, Section 8 test-matrix row 6 and the duress re-verify row were re-verified 2026-10-24 against master `3dc9f83e6` (`utils/DataClearUtils.ts`, `views/Lockscreen.tsx`, `views/Tools/index.tsx`, `views/Settings/WalletConfiguration.tsx`).

Section 4, the §1 legacy EncryptedStorage example, the Section 8 checklist lines on load paths, `setSettings`, version bumps and Jest coverage, test matrix row 1, the rollback bullet on version numbers, and the re-verify rows for `getSettings` order and flag names re-verified 2026-10-24 against master `3dc9f83e6` (`utils/SettingsVersion.ts`, `utils/MigrationUtils.ts`, `stores/SettingsStore.ts` `getSettings`; `npx jest utils/MigrationUtils`: 113 pass, 5 todo).

Re-verification one-liners for volatile facts:

| Fact | Re-verify with |
|---|---|
| Storage contract (`zeus:` prefix, `cloudSync:false`, `false` on miss, empty→delete) | `cat storage/index.ts` |
| Blob keys `zeus-settings-v2` / legacy `zeus-settings` | `grep -n "STORAGE_KEY" stores/SettingsStore.ts \| head -3` |
| `updateSettings` still shallow-merges | `grep -n -A8 "updateSettings = async" stores/SettingsStore.ts` |
| `getSettings` migration order (desync, cloud sync, rescue-file purge, then the modern or legacy path) | `grep -n "keychainDesyncMigration\|keychainCloudSyncMigration\|purgeRescueKeyFiles\|getRawItem\|runSettingsMigrations\|legacySettingsMigrations\|storageMigrationV2" stores/SettingsStore.ts` |
| `deleteFromOldKeychain` still a no-op | `grep -n -A6 "deleteFromOldKeychain" utils/MigrationUtils.ts` |
| Version gates and flag names (read-only legacy/v1 flags; keychain/file one-shot flags) | `grep -n "EncryptedStorage.getItem('\|MIGRATION_KEY = '\|DESYNC_KEY = '\|MOD_KEY_RESCUE_FILE = '\|priorVersion <" utils/MigrationUtils.ts` |
| `migrationKeys` list contents | `grep -n -A22 "const migrationKeys" utils/MigrationUtils.ts` |
| `STORAGE_KEYS` registration list | `grep -n -A45 "const STORAGE_KEYS" utils/DataClearUtils.ts` |
| `OTHER_KEYS` recovery list | `grep -n -A22 "const OTHER_KEYS" utils/KeychainRecoveryUtils.ts` |
| Duress wipe scope (full `clearAllData` + restart) | `grep -n -A22 "deleteNodes = " views/Lockscreen.tsx; grep -n "^    // [0-9]" utils/DataClearUtils.ts` |
| `getNodeDir` namespacing | `grep -n -A7 "getNodeDir = " stores/CashuStore.ts` |
| VSS default + (absence of) delete path | `grep -n "DEFAULT_VSS_SERVER\|deleteLdkNodeWallet" utils/LdkNodeUtils.ts` |
| CDK DB path | `grep -n -A12 "clearCDKDatabase" utils/DataClearUtils.ts` |
| EncryptedStorage version | `grep -n "react-native-encrypted-storage" package.json` |
| Migration tests still green | `npx jest utils/MigrationUtils.test.ts` |
| Cited incident hashes | `git log -1 --format='%h %ci %s' 7ed901a10 d8e648b58 26d4215ea e8e5b8811 a7860aa96 f7b2c30a8 c6323fff4 318c721e7 1242ce94a 35fa31fee` |

Open/unresolved (do not treat as settled): VSS remote-state deletion (no client delete path); plaintext PIN/passphrase in the blob (accepted debt).
