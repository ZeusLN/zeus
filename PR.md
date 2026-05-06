# perf: cut offline wallet startup from 60s+ to ~3s

## Summary

When the device is offline, Zeus's LDK Node and Cashu init paths used to block on a series of internal HTTP timeouts — VSS dual-store build (30–60s), `node.syncWallets()` Esplora + RGS fetch (~30s+), and on a fresh recovery, the sequential Nostr relay loop (8 × 10s = up to 80s). End-to-end an offline cold-start could take 60s+ for an existing wallet and several minutes for a fresh recovery.

This PR seeds `connectivityStore.isOffline` *before* any wallet implementation init runs, then short-circuits the network-bound work that would otherwise stall on those internal timeouts. Online cold-start is unchanged apart from a one-time probe capped at ~1.5s.

## Impact

| Path | Before | After |
| --- | --- | --- |
| Initial reachability probe | ~5s probe budget | ~1.5s |
| LDK VSS dual-store build (offline) | ~30s existing / ~60s restore | skipped |
| LDK `syncWallets()` (offline) | ~30s+ Esplora + RGS fetch | skipped |
| Cashu Nostr mint restore (fresh recovery, offline) | up to ~80s sequential | skipped |
| LDK VSS build timeout when online-but-VSS-slow | 30s | 10s |
| **Offline cold-start, existing wallet** | **~60s+** | **~3s** |
| **Offline cold-start, fresh recovery** | **several minutes** | **~3s** |

Online cold-start regresses by at most the new ~1.5s `checkNow()` probe; when online, the same VSS build and sync paths run as before. As a secondary benefit, online Nostr mint restore now fans out across all relays in parallel instead of trying them one-at-a-time.

## What changed

- **`stores/ConnectivityStore.ts`** — Added public `checkNow(timeoutMs?)` that runs the existing fallback-URL probe with a tight 1.5s default budget and updates `isOffline` synchronously. Refactored `probeUrl`/`verifyConnectivity` to accept an optional timeout.
- **`views/Wallet/Wallet.tsx`** — In `fetchData()` (when `connecting=true`), `connectivityStore.start()` + `await connectivityStore.checkNow()` runs before any wallet implementation init, so downstream code sees a reliable `isOffline`.
- **`stores/CashuStore.ts`** — Removed `connectivityStore.start()`/`stop()` ownership (moved to `Wallet`); `startConnectivityMonitoring` now only registers the reconnect callback. Gated the fresh-recovery `nostrRestoreMints()` call on `!isOffline`.
- **`utils/LdkNodeUtils.ts`** — In `initNode`, skip the VSS keypair derivation and pass `vssConfig: undefined` when offline so the native module goes straight to local-only build. In `startLdkNodeWallet`, skip `syncWallets()` and the post-sync RGS status check when offline.
- **`utils/NostrMintBackup.ts`** — Replaced the sequential relay loop in `restoreMintsFromNostr` with parallel fan-out (first non-null wins). Dropped per-relay timeout from 10s to 5s.
- **`ldknode/LdkNodeInjection.ts`** — Tightened existing-wallet VSS build timeout from 30s → 10s. Restore-from-seed timeout (60s) unchanged.

## Behaviour notes / risks

- **VSS deferral while offline.** A session built offline uses local-only SQLite. VSS resumes on the next launch once we're online; we do not currently rebuild the node mid-session on reconnect.
- **No alerts when offline.** When VSS / sync / RGS are skipped because we're offline, `vssError` / `esploraError` / `rgsError` stay `undefined`, so `Wallet.tsx` doesn't surface alerts the user already understands. Online failures alert as before.
- **Tighter VSS budget.** Existing-wallet VSS timeout drops from 30s → 10s. Users on slow connections may occasionally see a `vssError` alert where the previous 30s budget would have eventually succeeded. The graceful fallback (local-only build, retry on next launch) is unchanged.
- **Connectivity ownership.** `ConnectivityStore` lifecycle (`start`/`stop`) is now owned by `Wallet.fetchData()` rather than `CashuStore.initializeWallets()`. Cashu still registers its reconnect callback via `startConnectivityMonitoring`.

## Test plan

- [ ] **Offline cold-start, existing wallet** — disable Wi-Fi/cellular, launch app; confirm UI is interactive within ~3s and no VSS / Esplora / RGS alerts surface.
- [ ] **Online cold-start, existing wallet** — confirm startup time has not regressed beyond the ~1.5s probe.
- [ ] **Online → offline mid-session** — confirm the running session keeps working off local state; on next cold-start, offline path is taken.
- [ ] **Offline → online reconnect** — confirm `connectivityStore.onReconnect` fires and Cashu pending tokens sweep.
- [ ] **Fresh recovery, online** — verify Nostr mint restore still finds the backup with parallel fan-out.
- [ ] **Fresh recovery, offline** — verify we no longer hang on the relay loop and the wallet still loads (no mints, as expected).
- [ ] **VSS reachable but slow** — confirm the new 10s budget falls back to local with a clear `vssError` alert.
