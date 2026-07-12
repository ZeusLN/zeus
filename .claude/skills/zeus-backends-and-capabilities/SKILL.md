---
name: zeus-backends-and-capabilities
description: Load when working across Zeus's 7 Lightning backends (lnd, embedded-lnd, ldk-node, lightning-node-connect, cln-rest, lndhub, nostr-wallet-connect) - adding a new RPC or feature to backends/ or utils/BackendUtils.ts, adding or checking a supports* capability flag, gating a view on backend support, debugging "works on LND but crashes on CLN/NWC/LndHub", ".then is not a function" / "false.then" crashes, features silently doing nothing on one backend, payment success reported despite timeout, LNC showing send UI on read-only pairings, CLN invoice/payment lists missing entries, LDK Node channel-open or payment result handling, stale Tor request errors, or filling in the PR-template backend testing matrix.
---

# Zeus Backends and Capabilities

Zeus is one wallet UI in front of 7 interchangeable Lightning node backends. This skill covers: what the 7 backends are, how per-call dispatch works, how the `supports*` capability system gates every feature, each backend's sharp edges, and the exact checklist for adding a new RPC or feature across the matrix.

Glossary of terms used once and reused throughout:

- **Lightning**: Bitcoin's layer-2 payment-channel network. A **channel** is a 2-party on-chain-funded balance that lets the parties pay each other off-chain instantly.
- **LND, CLN (Core Lightning), LDK Node**: three independent Lightning node implementations. Zeus can drive all of them.
- **Macaroon**: LND's bearer auth token (a hex blob granting RPC permissions). **Rune**: CLN's equivalent. **Pairing phrase**: Lightning Node Connect's one-time connection secret. **NWC URL**: a `nostr+walletconnect://` connection string.
- **BOLT11**: standard Lightning invoice format. **BOLT12**: newer reusable "offers" format. **Keysend**: spontaneous payment to a pubkey without an invoice. **MPP/AMP**: multi-part / atomic multi-path payments (splitting one payment across routes). **LSP**: Lightning Service Provider (sells inbound channels); **LSPS0/1/7** are LSP protocol specs. **Cashu**: Chaumian ecash protocol. **Watchtower**: third party that punishes channel cheating while you're offline. **PSBT**: partially signed Bitcoin transaction.
- **gomobile**: Go-to-mobile bindings (how LND runs on-device). **uniffi**: Mozilla's Rust-to-mobile FFI generator (how LDK Node and Cashu run on-device). **REST**: plain HTTPS JSON calls.

## When to use / When NOT to use

Use this skill when you are:
- adding/changing anything in `backends/` or `utils/BackendUtils.ts`
- adding a feature that must work (or deliberately not work) on more than one backend
- debugging behavior that differs between backends
- deciding which `supports*` flag to gate a view on

Do NOT use this skill for:
- boot/connect sequence, store wiring, `Wallet.tsx fetchData()` — see **zeus-architecture-contract**
- running the app, connecting to Polar/regtest nodes, release ops — see **zeus-run-and-operate**
- Lightning protocol theory (BOLT11 internals, LSPS message formats, Cashu NUTs) — see **zeus-lightning-reference**
- settings axes and per-node config fields — see **zeus-config-and-flags**
- keychain/settings-blob persistence — see **zeus-storage-and-migrations**
- symptom-driven triage of app-wide bugs — see **zeus-debugging-playbook**
- PR/commit/review process — see **zeus-change-control**

## 1) The dispatch mechanism (read this first)

`utils/BackendUtils.ts` pre-instantiates ALL 7 backend classes in its constructor and dispatches every call at runtime based on `settingsStore.implementation` (`getClass()` switch; default case returns the `lnd` instance). The implementation key is one of the 7 string values of the `Implementations` type in `stores/SettingsStore.ts`.

The core dispatcher:

```ts
call = (funcName: string, args?: any) => {
    const cls: any = this.getClass();
    // return false if function is not defined in backend, as a fallback
    if (!cls[funcName]) return false;
    const result = cls[funcName].apply(cls, args);
    // ldk-node only: rejected promises get .catch(parseLdkNodeError) attached
    ...
};
```

**THE FOOTGUN, memorize it:** if the active backend does not define `funcName`, `call()` returns `false` *synchronously* — not a rejected Promise, not an exception. Consequences:

1. `BackendUtils.someMethod().then(...)` crashes with `TypeError: ... .then is not a function` on backends that lack the method. Always gate with the matching `supports*` flag before calling.
2. A typo'd method name (backend class says `getRcoveryInfo`, wrapper says `getRecoveryInfo`) silently no-ops as `false` forever. There is no abstract base class or interface to catch this at compile time.
3. This same mechanism IS the capability system: `supportsX()` flags are dispatched through `call()` too, so a backend that simply omits a flag reads as `false` (e.g. `supportsLSPS1native` is only defined on `LdkNode` — every other backend returns `false` by omission; `supportsWatchtowerClient` is not defined on `CLNRest`, so CLN reads `false` by omission).

Known dead dispatch (as of 2026-07-06): `payLightningInvoiceStreaming` is declared in `utils/BackendUtils.ts` but implemented by NO backend — it always returns `false`. Do not model new code on it.

Also in the dispatcher, not the backend class: when `implementation === 'ldk-node'`, `call()` attaches a `.catch` that normalizes raw uniffi error strings (Android `org.lightningdevkit.ldknode.NodeException.X: msg`, iOS `X(message: "msg")`) into clean messages via `parseLdkNodeError` in `utils/ErrorUtils.ts`. If you bypass `BackendUtils` and call the `LdkNode` class directly, you get raw FFI error strings.

There is no abstract base: `backends/LND.ts` is the *implicit* base class. `EmbeddedLND` and `LndHub` **extend** it (inheriting REST methods and flags — see section 5); `CLNRest`, `LdkNode`, `LightningNodeConnect`, `NostrWalletConnect` are standalone classes that duck-type the same method names.

## 2) The 7-backend inventory

All files under `backends/`. Auth material lives per-node in the settings blob (see zeus-config-and-flags).

| Implementation key | Class (file) | Runs | Transport | Auth material |
|---|---|---|---|---|
| `lnd` (default) | `LND` (`backends/LND.ts`) | remote | REST via `react-native-blob-util`; WebSocket for streams (`wsReq`, `openChannelStream`, `initChanAcceptor`, `subscribeCustomMessages`); optional Tor routing via `utils/TorUtils.doTorRequest` | macaroon (hex, `Grpc-Metadata-macaroon` header) |
| `embedded-lnd` | `EmbeddedLND` (`backends/EmbeddedLND.ts`) **extends LND** | on-device | gomobile `Lndmobile` via `lndmobile/LndMobileInjection` (Messenger-IPC service on Android) | seed / wallet password (node is local) |
| `ldk-node` | `LdkNode` (`backends/LdkNode.ts`) | on-device | uniffi FFI via `ldknode/LdkNodeInjection` (Rust ldk-node, ZeusLN fork) | BIP-39 mnemonic (also derives VSS remote-state auth) |
| `lightning-node-connect` | `LightningNodeConnect` (`backends/LightningNodeConnect.ts`) | remote | native LNC module (`NativeModules.LncModule` inside vendored `zeus_modules/@lightninglabs/lnc-rn`) — gRPC tunneled through an LNC mailbox server (`mailbox.terminal.lightning.today:443`, `lnc.zeusln.app:443`, or custom; `LNC_MAILBOX_KEYS` in `stores/SettingsStore.ts`) | pairing phrase (+ creds cached by `backends/LNC/credentialStore.ts`) |
| `cln-rest` | `CLNRest` (`backends/CLNRest.ts`) | remote | REST (all calls are POST, incl. reads) + response reshaping in `backends/CoreLightningRequestHandler.ts`; invoices/payments via raw SQL to `/v1/sql` | rune (`Rune` header) |
| `lndhub` | `LndHub` (`backends/LndHub.ts`) **extends LND** | remote custodial | REST against `lndhubUrl` (`/auth`, `/gettxs`, `/balance`, `/addinvoice`, `/payinvoice`, ...) | login/password → Bearer `accessToken` (overrides `getHeaders`) |
| `nostr-wallet-connect` | `NostrWalletConnect` (`backends/NostrWalletConnect.ts`) | remote custodial-ish | `NostrWebLNProvider` from `@getalby/sdk` (NIP-47 over Nostr relays) | `nostrWalletConnectUrl` |

Zeus is also an NWC *service* (wallet side) — that lives in `stores/NostrWalletConnectStore.ts`, not in this backend, which is the *client* side.

`BackendUtils.isLocalWallet()` returns true for `embedded-lnd` and `ldk-node` only (checks `implementation`, not a flag — one of the sanctioned implementation checks).

## 3) The capability system

### How supports* works

Every feature surface in views/stores must be gated by a `supports*()` call on `BackendUtils`, which dispatches to the active backend class. Flags are plain methods returning booleans (a few return Promise-shaped values; treat truthiness only). There are ~55 flags — get the authoritative current list with:

```bash
grep -n "supports\w*\s*=\s*()" backends/LND.ts        # implicit base
grep -n "    supports" utils/BackendUtils.ts           # dispatcher wrappers
```

**Invariant (top historical cross-backend crash source when violated):** views never branch on `settingsStore.implementation` for *features* — only on `supports*()`. The sanctioned exceptions that DO branch on implementation:
- connection lifecycle in `views/Wallet/Wallet.tsx` (per-backend connect flows)
- payment function selection and result handling in `stores/TransactionsStore.ts` (`sendPayment`: keysend goes through `sendKeysend` for `cln-rest`/`embedded-lnd`/`ldk-node` but through `payLightningInvoice` for LND REST; LNC results are returned raw to the caller instead of `.then(handlePayment)`; embedded-lnd statuses decoded through `lnrpc.Payment.PaymentStatus` enums)
- the embedded-lnd channel acceptor in `stores/LSPStore.ts initChannelAcceptor` (see section 4)
- `BackendUtils.isLocalWallet()`

### Version gating (LND family)

`LND.supports(minVersion, eosVersion?)` (also on `LightningNodeConnect`) compares `nodeInfoStore.nodeInfo.version` using `utils/VersionUtils.isSupportedVersion`. `CLNRest.supports` additionally accepts `minApiVersion` checked against `nodeInfo.api_version`.

**Trap:** `nodeInfoStore.nodeInfo` initializes to `{}` and is reset on disconnect, and `isSupportedVersion(undefined, ...)` parses the missing version as `0.0.0`. So every version-gated flag returns **false until `getMyNodeInfo` has resolved** during connect. Version-gated flags read at boot (before node info lands) are pessimistically false, then flip to true — code that caches a flag value at construction time will be wrong. Read flags lazily at render/call time.

Version-gated flags (all verified in `backends/LND.ts` at c5fd094fb; `EmbeddedLND`/`LightningNodeConnect` mirror most):

| Flag | Min LND version |
|---|---|
| `supportsMPP` | v0.10.0 |
| `supportsHopPicking` | v0.11.0 |
| `supportsCoinControl` | v0.12.0 |
| `supportsAMP`, `supportsAccounts` (LND only; EmbeddedLND hardcodes true) | v0.13.0 |
| `supportsTaproot` | v0.15.0 |
| `supportsChannelCoinControl`, `supportsSimpleTaprootChannels` | v0.17.0 |
| `supportInboundFees`, `supportsAddressesWithDerivationPaths` | v0.18.0 |
| `supportsOnchainSendMax`, `supportsBolt11BlindedRoutes` | v0.18.3 |
| `supportsForwardingHistoryChannelFilter` (dispatcher-level composite in `utils/BackendUtils.ts`, takes `nodeInfoVersion` argument) | v0.20.0 |

### Composite flags (computed in the dispatcher, not backend classes)

- `supportsLightningAddress = supportsCustomPreimages() || supportsCashuWallet()` — ZEUS Pay lightning addresses need either hodl-preimage support or an embedded Cashu wallet.
- `supportsDevTools = isLNDBased() || call('supportsDevTools')` — so the LND family gets dev tools implicitly; `CLNRest` and `LndHub` opt in with an explicit flag; `ldk-node` and `nostr-wallet-connect` get **false** (neither LND-based nor flag-defining).

### Capability matrix for major features

Verified flag-by-flag against the six backend files at c5fd094fb (2026-07-06). "vX.Y" means version-gated as above. LNC "perm" flags are all effectively **true** — see the ZEUS-3642 quirk in section 4.

| Feature (flag) | lnd | embedded-lnd | lnc | cln-rest | ldk-node | lndhub | nwc |
|---|---|---|---|---|---|---|---|
| Lightning sends (`supportsLightningSends`) | Y | Y | perm | Y | Y | Y* | Y |
| On-chain send/receive (`supportsOnchainSends`/`Receiving`) | Y | Y | perm | Y | Y | N / URL-dependent* | N |
| Keysend (`supportsKeysend`) | Y | Y | Y | Y | Y | N | N |
| MPP (`supportsMPP`) | v0.10 | v0.10 | v0.10 | N | Y | N | N |
| AMP (`supportsAMP`) | v0.13 | v0.13 | v0.13 | N | N | N | N |
| Channel management (`supportsChannelManagement`) | Y | Y | perm | Y | Y | N | N |
| Force close (`supportsForceClose`) | Y | Y | Y | N | Y | N | N |
| Pending channels (`supportsPendingChannels`) | Y | Y | Y | N | Y | N | N |
| Coin control (`supportsCoinControl`) | v0.12 | v0.12 | perm | Y | Y | N | N |
| Watchtower client (`supportsWatchtowerClient`) | Y | Y | Y | N (by omission) | N | N | N |
| Cashu embedded wallet (`supportsCashuWallet`) | N | **Y** | N | N | **Y** | N | N |
| BOLT12 offers (`supportsOffers`) | N | N | N | **Y** | **Y** | N | N |
| Listing offers (`supportsListingOffers`) | N | N | N | **Y** | N (LDK can't store/list offers; its `listOffers` returns `{offers: []}`) | N | N |
| BOLT12 address (`supportsBolt12Address`) | N | N | N | **Y** | N | N | N |
| Withdrawal requests (`supportsWithdrawalRequests`) | N | N | N | **Y** | **Y** | N | N |
| Custom preimages (`supportsCustomPreimages`) | Y | Y | Y | N | N | N | N |
| Lightning address (composite) | Y | Y | Y | N | Y (via Cashu) | N | N |
| Flow LSP (`supportsFlowLSP`) | Y | Y | N | N | Y | N | N |
| LSPS1 REST (`supportsLSPS1rest`) | Y | N | Y | Y | Y | N | N |
| LSPS custom message (`supportsLSPScustomMessage`) | Y | Y | Y | N | N | N | N |
| LSPS1/7 native (`supportsLSPS1native`/`supportsLSPS7native`, LdkNode-only flags) | N | N | N | N | N / **Y** | N | N |
| Routing/forwarding (`supportsRouting`) | Y | N | perm | Y | N | N | N |
| Forwarding history (`supportsForwardingHistory`) | Y | N | Y | Y | N | N | N |
| Circular rebalancing (`supportsCircularRebalancing`) | Y | Y | Y | Y | N | N | N |
| Fee bumping / CPFP (`supportsBumpFee`) | Y | Y | Y | N | N | N | N |
| Message signing (`supportsMessageSigning`) | Y | Y | perm | Y | Y | N | N |
| Sweep (`supportsSweep`) | Y | Y | Y | Y | N | N | N |
| Dev tools (composite) | Y | Y | Y | Y | N | Y | N |
| Set invoice expiry (`supportsSettingInvoiceExpiration`) | Y | Y | Y | Y | Y | N | N |
| NWC service (`supportsNostrWalletConnectService`) | Y | Y | Y | Y | Y | Y | N |
| `requiresVerifyPubkey` (verifyMessage needs pubkey arg) | N | N | N | N | **Y** | N (inherited) | n/a |

\* LndHub URL-dependent: `supportsOnchainReceiving` is false for known custodial hosts (Alby, lntxbot, LNBits `/lndhub/ext/`, LNbank); `supportsLightningSends` is false for LNBits invoice-only credentials (`username === 'invoice'`). Read `backends/LndHub.ts` before assuming.

Do NOT trust this table for a new feature decision without re-grepping — flags change. One command rebuilds any row:

```bash
grep -n "supportsOffers" backends/*.ts
```

## 4) Per-backend quirks (each one has cost real debugging time)

**LND (REST)**
- `payLightningInvoice` races the actual `/v2/router/send` call against a forced timeout that **resolves** (not rejects) with `{ payment_error: localeString('views.SendingLightning.paymentTimedOut') }` (a locale-dependent "Payment timed out…" message — don't match the string literally) — timeout errors arrive *success-shaped*. `TransactionsStore.handlePayment` must (and does) check `result.payment_error`; new callers must too.
- In-flight request dedup: a module-level `calls` Map keyed by `url+body` returns the same promise for identical concurrent requests. **On the Tor branch, `calls.delete(id)` only happens in `.then`** — a rejected Tor request stays cached, so identical retries replay the stale rejection until `clearCachedCalls()` runs (it is wired into `SettingsStore.setConnectingStatus(true)` on reconnect). Same pattern duplicated in `CLNRest.ts`.
- TLS: cert verification is OFF unless the node's `certVerification` setting is on (`trusty: !certVerification` in blob-util). Tor requests bypass TLS validation only for HTTPS `.onion` URLs (see zeus-failure-archaeology FA-5 for the incident that set this rule). WebSocket streaming endpoints bypass Tor entirely.
- Streaming/subscription endpoints use raw `WebSocket` with `wss://` rewritten URLs, not blob-util.

**EmbeddedLND** (extends LND — inheritance hazards in section 5)
- Subscription methods are commented out at the backend layer (`// TODO rewrite subscription logic` near the bottom of `backends/EmbeddedLND.ts`) — `subscribeInvoice`/`subscribeTransactions`/`initChanAcceptor` fall through to LND's REST/WebSocket implementations, which point at `settingsStore.host` — meaningless for an on-device node. `stores/LSPStore.ts initChannelAcceptor` works around this by branching on `implementation === 'embedded-lnd'` and calling `lndmobile` `channel.channelAcceptor()` + `LndMobileEventEmitter` directly.
- `getFees`/`setFees`/`getForwardingHistory` also not overridden (commented "N/A") — same REST fall-through; guarded only because `supportsForwardingHistory` is false (fees screens are LND-family gated; embedded inherits `getFees` exposure — be careful surfacing anything that calls them).
- Extra methods not in the base: `getRecoveryInfo`, `rescan`.

**LightningNodeConnect (LNC)**
- `checkPerms()` is **hard-coded to set all perms true** (ZEUS-3642 workaround, github.com/ZeusLN/zeus/issues/3642; the real `lnc.hasPerms` calls are commented out in `backends/LightningNodeConnect.ts`). Every perm-derived flag (`supportsLightningSends`, `supportsOnchainSends`, `supportsChannelManagement`, `supportsAccounts`, `supportsRouting`, `supportsMessageSigning`, ...) therefore reads true — read-only pairings still show send UI and fail at call time. Do not build new features assuming LNC perms are meaningful.
- `payLightningInvoice` returns lnc-rn's streaming call object, not a settled result — `TransactionsStore.sendPayment` special-cases LNC by returning it to the caller instead of `.then(handlePayment)`.
- Responses are camelCase protobuf objects converted with `snakeize()` per call; forget it and field names silently mismatch the LND-REST-shaped models.
- lnc-rn is vendored in `zeus_modules/` and imported by relative path — never `yarn add` it (see zeus-build-and-env).

**CLNRest**
- Invoice and payment lists come from **raw SQL** POSTed to `/v1/sql` against CLN's internal `invoices`/`sendpays` tables — filtered to `status = 'paid'` (invoices). The invoices query defaults to `LIMIT 150`, but callers can override via `getInvoices({ limit })`; the payments query is hardcoded to `limit 150`. Unpaid/expired invoices don't appear, payment histories truncate at 150, and **any CLN schema change breaks Zeus silently**. Treat `/v1/sql` queries as version-coupled code.
- Every call is a POST, including reads (`/v1/getinfo`, `/v1/listfunds`, ...). Raw responses are reshaped into LND-ish shapes by `backends/CoreLightningRequestHandler.ts` (balances, peers, closed channels) — new CLN RPCs usually need a transform there.
- `closeChannel` force-close is expressed as `unilateraltimeout: 2` (seconds) on `/v1/close`; `urlParams[0]` is the CLN channel/peer id, NOT a funding txid.
- Circular rebalancing uses CLN-only askrene methods (`askReneCreateLayer`/`askReneUpdateChannel`/`askReneRemoveLayer`, `sendPay`/`waitSendPay`) that exist on no other backend.
- Shares LND's dedup-cache-retains-rejections Tor trap (module-level `calls` map, own `clearCachedCalls`).

**LdkNode**
- No request/response protocol at all — direct uniffi FFI calls. Payment completion is **poll-based**: `awaitPaymentCompletion` polls `listPayments()` at 1 Hz for `timeout_seconds + 5` attempts, capturing failure reasons from a parallel event subscription; `payLightningInvoice`, `sendKeysend`, and `fetchInvoiceFromOffer` all block on it and then return a synthetic `{status: 'SUCCEEDED'}` LND-shaped result.
- `openChannelSync` waits up to 60s for a `channelPending`/`channelClosed` event, then **resolves optimistically** with just `{user_channel_id}` (no funding txid) on timeout — callers cannot assume `funding_txid_str` exists.
- Errors are normalized by `parseLdkNodeError` **in `BackendUtils.call`**, not in the class — direct class usage yields raw FFI strings.
- `closeChannel` takes LND-format urlParams but internally looks up the channel by funding txid to find `userChannelId`/`counterpartyNodeId`.
- Runs its own JS event loop (`startEventLoop` polling `nextEvent()`); node start/stop lifecycle races are a live problem — see **zeus-node-lifecycle-campaign** before touching start/stop paths.
- `requiresVerifyPubkey() === true`: its `verifyMessage` needs an explicit `pubkey` argument (LDK can't recover the signer).
- BOLT12: can create/pay offers and do refund-based withdrawal requests, but cannot list or truly disable offers (`listOffers` returns empty, `disableOffer` is a no-op).

**LndHub**
- Thin custodial API; everything channel/on-chain is flagged off (with the URL-dependent exceptions in the matrix footnote). Inherits LND's REST plumbing: `request()` uses `host || lndhubUrl` and `macaroonHex || accessToken`, with `getHeaders` overridden to Bearer auth.
- Known inheritance gaps (unfixed as of 2026-07-06): `supportsChannelFundMax` and `supportsAddressMessageSigning` are NOT overridden and inherit `true` from LND. This is the canonical example of the extends-LND hazard.
- `lnurlAuth` signs differently per `lndHubLnAuthMode` setting ('Alby' default vs 'BlueWallet').

**NostrWalletConnect**
- Smallest surface: balance, list transactions (split into invoices/payments by `type`), make invoice, pay invoice, lookup invoice. Everything else flagged false.
- `createInvoice` backfills `payment_hash` by decoding the returned bolt11 with `Bolt11Utils` (NWC only returns `paymentRequest`).
- Flag typo lives here: `supportsLSPS1customMessage` (dispatcher calls `supportsLSPScustomMessage`) — harmless because omission already means false, but don't copy it.
- `decodePaymentRequest` (like LndHub's) is done client-side via `Bolt11Utils.decode`, so decoded fields are Zeus's hand-rolled decoder output, not node output.

### Call signatures are NOT portable across backends

Capability flags make a feature *available*; they do not make the *arguments* uniform. The dispatcher passes `...args` through verbatim. Live examples (verified at c5fd094fb):

- `getRoutes`: LND/EmbeddedLND/LNC take positional `urlParams` (`[pubkey, amt]`); **CLNRest takes a single object** `{source, destination, amount_msat, layers?, maxfee_msat?, final_cltv?}` (askrene `/v1/getroutes`). LdkNode/LndHub/NWC don't implement it.
- `closeChannel`: all take `urlParams` arrays, but element meaning differs — LND-family: `[funding_txid, output_index, force, sat_per_vbyte, delivery_address]`; CLNRest: `[channel_id, force→unilateraltimeout]`; LdkNode: LND format but resolves internally.
- `createInvoice`: field names differ (`value_msat` vs `amount_msat` vs `amt`); each backend adapts internally, but only for the fields it knows about — new invoice fields must be threaded through every implementation.

When adding a cross-backend call, define ONE canonical argument shape at the call site and adapt inside each backend class — never make views build per-backend arguments.

## 5) THE RECIPE: adding a new RPC / feature end-to-end

Checklist (do every step; the dispatch design gives you zero compile-time safety):

1. **Implement the method on each backend** in `backends/` — or deliberately omit it (omission = feature absent, `call()` returns `false`). For each of the 7, decide: native support / emulation / omit. Match the method name EXACTLY across classes and wrapper.
2. **Add the dispatcher wrapper** in `utils/BackendUtils.ts`:
   ```ts
   myNewCall = (...args: any[]) => this.call('myNewCall', args);
   ```
   String must match the class method name character-for-character (typo = permanent silent `false`).
3. **Add a `supports*` flag** to every backend class (explicit `true`/`false`/version-gate on each standalone class: `LND`, `CLNRest`, `LdkNode`, `LightningNodeConnect`, `NostrWalletConnect`), plus a wrapper `supportsMyFeature = () => this.call('supportsMyFeature');` in `utils/BackendUtils.ts`. Relying on omission-as-false works but explicit flags are the observed convention.
4. **Run the inheritance-override checklist** (below) for `EmbeddedLND` and `LndHub`.
5. **Gate every view/store call site** with `BackendUtils.supportsMyFeature()` — never with `settingsStore.implementation`, and never call the method unguarded (remember: `false.then` crashes). Missing gates are the top historical cross-backend crash source.
6. **Version-gate if needed**: inside LND-family flags use `this.supports('vX.Y.Z')`; remember it reads false until node info resolves.
7. **Keep the argument contract canonical** at call sites; adapt shapes inside each backend class (section 4).
8. **Fill in the PR-template backend matrix** (`.github/PULL_REQUEST_TEMPLATE.md` — never delete it): check each of the 7 node types you actually tested (On-device: LDK Node, Embedded LND; Remote: LND REST, LNC, CLNRest, NWC, LndHub) with node/API versions. Test at minimum every backend whose flag you set to `true`. Manual iOS+Android testing by the author is mandatory regardless of CI (see zeus-change-control).
9. If the feature emits errors on ldk-node, confirm they read cleanly through `parseLdkNodeError`; extend `utils/ErrorUtils.ts` mappings if a new NodeException variant appears.

### Inheritance-override checklist (EmbeddedLND / LndHub)

Whenever you add a method OR flag to `backends/LND.ts`, `EmbeddedLND` and `LndHub` inherit it silently. For each addition ask:

- **EmbeddedLND**: the inherited implementation is a REST/WebSocket call against `settingsStore.host` — meaningless for an on-device node. Override with an `lndmobile` implementation, or ensure the corresponding flag is `false` on EmbeddedLND so nothing reaches it. (Existing debt: `getFees`/`setFees`/subscriptions fall through today.)
- **LndHub**: the inherited implementation would hit `lndhubUrl` with LND REST routes that don't exist there, and inherited `true` flags advertise features a custodial account lacks. Override the flag to `false` explicitly. (Existing bugs of this class: `supportsChannelFundMax` and `supportsAddressMessageSigning` inherit `true`.)

Quick audit command — flags defined on LND but missing from a subclass:

```bash
comm -23 <(grep -o "supports\w*" backends/LND.ts | sort -u) \
         <(grep -o "supports\w*" backends/LndHub.ts | sort -u)
```

(The bare `supports` line in the output is LND's version-gate helper, not a flag — ignore it. Run 2026-07-06, this prints exactly `supportsAddressMessageSigning` and `supportsChannelFundMax`: the two open gaps above.)

## 6) Testing each backend cheaply

Full environment setup and node connection walkthroughs live in **zeus-run-and-operate**; this is the per-backend minimum:

| Backend | Cheapest test rig |
|---|---|
| `lnd` (REST) | [Polar](https://github.com/jamaljsr/polar) regtest LND node (CONTRIBUTING.md recommends Polar); connect with REST host/port + hex admin macaroon |
| `cln-rest` | Polar Core Lightning node with the clnrest plugin; connect with a rune |
| `embedded-lnd` | create an on-device wallet in the app (emulator works); network choice per zeus-config-and-flags |
| `ldk-node` | create an on-device LDK wallet in the app |
| `lightning-node-connect` | requires a node running litd (Lightning Terminal) for a pairing phrase — the most expensive rig; test last |
| `lndhub` | any LNDHub-compatible account (e.g. an LNBits instance's LNDHub extension) |
| `nostr-wallet-connect` | any NWC connection string (e.g. Alby, or Zeus's own NWC service from a second device/wallet) |

Android emulator gotcha: emulator host rule — see **zeus-run-and-operate** §2 (the owner of the `10.0.2.2` fact).

Backend-difference triage shortcut: if a feature works on `lnd` but not backend X, check in order (1) X's `supports*` flag, (2) whether X defines the method at all (silent `false`), (3) argument-shape mismatch (section 4), (4) X-specific quirk (section 4).

## Provenance and maintenance

All facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by reading `backends/*.ts`, `utils/BackendUtils.ts`, `utils/VersionUtils.ts`, `utils/ErrorUtils.ts`, `stores/TransactionsStore.ts`, `stores/LSPStore.ts`, `stores/NodeInfoStore.ts`, `stores/SettingsStore.ts`, CONTRIBUTING.md, and `.github/PULL_REQUEST_TEMPLATE.md`. No build/run commands were executed for this skill; Polar/litd rig suggestions are verified by source/docs read, not executed.

Re-verification one-liners for volatile facts:

| Fact | Re-verify with |
|---|---|
| 7 implementation keys + default `lnd` | `grep -n "Implementations" stores/SettingsStore.ts; grep -n "default:" utils/BackendUtils.ts` |
| `call()` returns `false` on missing method; ldk-node error normalization | `sed -n '55,74p' utils/BackendUtils.ts` |
| Any flag's per-backend values | `grep -n "<flagName>" backends/*.ts` |
| Composite flags (`supportsLightningAddress`, `supportsDevTools`) | `grep -n "supportsLightningAddress\|supportsDevTools" utils/BackendUtils.ts` |
| LND version gates table | `grep -n "this.supports('v" backends/LND.ts` |
| Version reads 0.0.0 before node info | `grep -n "nodeInfo: NodeInfo" stores/NodeInfoStore.ts; sed -n '17,28p' utils/VersionUtils.ts` |
| LNC perms hardcoded (ZEUS-3642) | `grep -n "ZEUS-3642" backends/LightningNodeConnect.ts` |
| CLN raw SQL, paid-only, LIMIT 150 | `grep -n "v1/sql\|LIMIT" backends/CLNRest.ts` |
| LDK poll loop + optimistic open | `grep -n "awaitPaymentCompletion\|CHANNEL_OPEN_TIMEOUT" backends/LdkNode.ts` |
| LND timeout resolves success-shaped | `grep -n "payment_error" backends/LND.ts` |
| Tor dedup cache retains rejections; cleared on reconnect | `grep -n "calls.delete" backends/LND.ts backends/CLNRest.ts; grep -rn "clearCachedCalls" stores/SettingsStore.ts` |
| LndHub inheritance gaps still open | the `comm -23` audit command in section 5 |
| `payLightningInvoiceStreaming` still dead | `grep -rn "payLightningInvoiceStreaming" backends/ utils/` |
| EmbeddedLND subscription TODO / LSPStore workaround | `grep -n "TODO rewrite subscription" backends/EmbeddedLND.ts; grep -n "channelAcceptor()" stores/LSPStore.ts` |
| PR template backend matrix | `grep -n "LDK Node\|LndHub" .github/PULL_REQUEST_TEMPLATE.md` |
| LNC mailbox servers | `grep -n "LNC_MAILBOX_KEYS" -A 9 stores/SettingsStore.ts` |
| Emulator host `10.0.2.2`, Polar recommendation | `grep -n "10.0.2.2\|polar" -i CONTRIBUTING.md` |
