---
name: zeus-architecture-contract
description: "Load when you need to understand WHY Zeus is structured the way it is before changing it: app boot/connection sequence (App.tsx vs views/Wallet/Wallet.tsx fetchData, fetchLock, connecting), the stores/Stores.ts singleton DI graph, MobX 5 decorators and @inject/@observer, utils/BackendUtils.ts dispatch and the call()-returns-false invariant, supports*() capability gating vs implementation branching, EmbeddedLND/LndHub inheritance fallthrough, NavigationService/popTo navigation contract, New Architecture (Fabric) constraints, and the catalog of known weak points. Symptoms/triggers: 'false.then is not a function' crashes, a backend method that silently does nothing, a feature appearing on a backend that cannot support it, infinite 'connecting' spinner, reconnect re-entrancy, embedded node hitting a REST URL, navigation going forward instead of back, 'where does the app actually connect to the node', 'where do I add a new store/backend method'."
---

# Zeus Architecture Contract

The load-bearing design decisions of the Zeus wallet, why they exist, and what
breaks when you violate them. Zeus is a React Native (RN) app written in
TypeScript that speaks to 7 different Lightning Network backends. Almost every
recurring crash class in this repo comes from violating one of the invariants
below.

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha, RN 0.85.3).

## When to use / When NOT to use

USE this skill when you are:

- Tracing app startup, node connection, reconnect, or the infinite-loading class of bugs.
- Adding/renaming a method on a backend, adding a store, or wiring a new view to stores.
- Deciding how to gate a feature per backend (`supports*` vs `implementation`).
- Debugging `.then of false` / silent no-op backend calls.
- Writing navigation code (imperative nav, back-navigation, typing).

Do NOT use this skill for — load the sibling instead:

| Need | Sibling skill |
|---|---|
| Per-backend quirks, the full 7-backend capability matrix, adding an RPC end-to-end | zeus-backends-and-capabilities |
| Keychain contract, `zeus-settings-v2` blob, migrations, iCloud rules | zeus-storage-and-migrations |
| Settings axes, defaults, add-a-setting checklist | zeus-config-and-flags |
| Recreating the dev environment, postinstall chain, native binaries | zeus-build-and-env |
| Symptom→triage tables for live debugging | zeus-debugging-playbook |
| Historical incidents in narrative form (root cause chains) | zeus-failure-archaeology |
| The change-gating rules (what needs maintainer sign-off) | zeus-change-control |
| The node-lifecycle-races active campaign | zeus-node-lifecycle-campaign |

## Glossary (jargon used below, defined once)

| Term | Meaning |
|---|---|
| Backend / implementation | One of 7 ways Zeus talks to a Lightning node. The active one is the string `settingsStore.implementation`: `embedded-lnd`, `ldk-node`, `lnd`, `lightning-node-connect`, `cln-rest`, `lndhub`, `nostr-wallet-connect` (default `lnd`). |
| LND / CLN | The two major Lightning node implementations (Go / C). Zeus talks to remote LND over its REST proxy; to CLN via the `cln-rest` plugin. |
| Embedded LND / LDK Node | Node software running *inside* the phone app: LND compiled via gomobile, or LDK Node via a Rust FFI. Both are "local wallets". |
| LNC | Lightning Node Connect — encrypted tunnel (mailbox protocol) to a remote LND, via the vendored `lnc-rn` module. |
| LNDHub / NWC | Custodial-ish account protocols: LNDHub is an accounts API on top of LND; NWC (Nostr Wallet Connect, NIP-47) controls a wallet over Nostr relays. |
| Macaroon | LND's bearer-token credential format, sent as a hex header on REST calls. |
| Store (MobX) | An observable state container class. Zeus uses MobX 5 (`mobx` 5.15.3, `mobx-react` 6.1.4) with legacy decorators (`@observable`, `@action`), enabled by `experimentalDecorators` in tsconfig.json. |
| Class component / `@inject` / `@observer` | Zeus views are React class components (not hooks). `@inject('SettingsStore', ...)` injects store singletons as props (PascalCase names); `@observer` re-renders on observable change. |
| Native stack | `@react-navigation/native-stack` — screen navigation backed by native OS containers (vs the JS-based `@react-navigation/stack`, which Zeus does not use). |
| New Architecture / Fabric | RN's rewritten rendering system (Fabric) + TurboModules. ON in Zeus. Stricter than the legacy bridge about layout/animation misuse. |
| DI (dependency injection) | Passing a component's dependencies in from outside. Zeus does it manually: constructor arguments in `stores/Stores.ts`, no framework. |

---

## 1. Boot sequence — where the app ACTUALLY connects

Statement: `App.tsx` renders shell + navigator only. All node connection logic
lives in `views/Wallet/Wallet.tsx` and re-runs on every Wallet-screen focus.

The chain:

1. `index.js` — polyfills (TextEncoder, URL, random values), wires `protobufjs` to use `Long`, imports `shim.js` (generated by rn-nodeify), registers `App`.
2. `App.tsx` (~1823 lines) — mobx-react `<Provider>` passing all 30 store singletons as PascalCase props, wrapping ONE flat `createNativeStackNavigator()` (`const Stack = createNativeStackNavigator()`) with ~209 `Stack.Screen` entries, `headerShown: false`. There is no `initialRouteName`: `Wallet` is the initial route because it is the FIRST `Stack.Screen`. ~220 `@ts-ignore` lines in App.tsx suppress Screen typing (see §5).
3. `views/Wallet/Wallet.tsx` (~1901 lines) — `handleFocus` / `handleAppStateChange(active)` trigger `getSettingsAndNavigate()` (with an in-flight guard flag so focus events don't stack).
4. `getSettingsAndNavigate()` — awaits `SettingsStore.getSettings()` (which also waits on Tor bootstrap), checks channel-migration lock, lockscreen/POS state, then either navigates (Lockscreen / Wallets / IntroSplash) or calls `fetchData()`.
5. `fetchData()` — the real connect. Guarded by two SettingsStore observables:
   - `connecting` — `@observable public connecting = true` (initialized true so first boot takes the full-connect path).
   - `fetchLock` — `@observable public fetchLock = false`; first line of substance is `if (fetchLock) return; SettingsStore.fetchLock = true;`.

What `fetchData` does when `connecting` is true — resets 11 stores before touching the network:
`AlertStore, NodeInfoStore, BalanceStore, ChannelsStore, TransactionsStore, SyncStore, LightningAddressStore, LSPStore, ChannelBackupStore, UTXOsStore, CashuStore` all `.reset()`, plus `ContactStore.loadContacts()` and `NotesStore.loadNoteKeys()`. `LnurlPayStore.reset()` runs unconditionally (even when not `connecting`).

Then it branches per implementation:

| Implementation | Connect path in fetchData |
|---|---|
| `ldk-node` | stop previous instance → `startLdkNodeWallet(...)` (esplora/RGS/scorer/VSS config, LSPS1, trusted 0-conf peers) → later `waitForLdkNodeReady()` → getNodeInfo → getCombinedBalance → `getChannelsWithPolling()` |
| `embedded-lnd` | `stopLnd()` (if already started) → `initializeLnd()` → optional express graph sync → `startLnd()` → `waitForRpcReady()` → getNodeInfo → listAccounts → getCombinedBalance → `getChannelsWithPolling()`; a 60 s timeout raises a "startup slow" alert; transient RPC errors retry with exponential backoff |
| `lndhub` | `login({ login: username, password })` → lightning balance |
| `lightning-node-connect` | `connect()` → `BackendUtils.checkPerms()` → getNodeInfo → balances → channels |
| `nostr-wallet-connect` | `connectNWC()` → lightning balance |
| default (`lnd`, `cln-rest`) | REST: getNodeInfo → listAccounts (if supported) → getCombinedBalance → getChannels |

Post-connect (all backends): lightning-address status + auto-accept, Cashu
auto-address creation, swap fees, Flow LSP init (`LSPStore.getLSPInfo()`,
`subscribeCustomMessages()`, `initChannelAcceptor()`), NWC service init, then
`SettingsStore.fetchLock = false` and `setConnectingStatus(false)`.

Why: connection must re-run on focus (app resume, wallet switch) but never
twice in parallel — parallel runs double-start embedded nodes and corrupt
store state mid-reset.

What breaks if violated: the UNSAFE-lifecycle refactor `fdad118ed` (2025-10-24)
disturbed this flow and shipped an infinite-loading regression, fixed three
weeks later by `93227029e` (the fix commit cites the offending hash in its
subject). This flow is the #1 maintainer-flagged live problem area
(node-lifecycle races) — see zeus-node-lifecycle-campaign before touching it.

Known sharp edge (verified in source): many early-`return` error paths inside
`fetchData` exit WITHOUT clearing `fetchLock`. `fetchLock` is released only at
the natural end of `fetchData`, or as a side effect of
`SettingsStore.setConnectingStatus(true)` (which also calls
`BackendUtils.clearCachedCalls()` and resets error state). So a failed connect
can leave the lock held until the next explicit reconnect. Do not "fix" this
casually — it is entangled with the lifecycle-races campaign.

## 2. Stores — composition root, singletons, DI order

Statement: `stores/Stores.ts` is the single composition root. It creates 30
module-level singletons with manual constructor DI. Declaration order matters.

- `settingsStore = new SettingsStore()` is first — it is the root dependency nearly everything else takes.
- Dependencies are plain constructor args, e.g. `nodeInfoStore = new NodeInfoStore(channelsStore, settingsStore)`. The biggest consumer is `NostrWalletConnectStore` (10 deps, declared last).
- A store can only depend on stores declared ABOVE it in the file. Adding a store: declare it after all its deps, export it, and add it as a PascalCase prop on the `<Provider>` in App.tsx (prop name = injection name).
- Views: class components with `@inject('PascalCaseName', ...)` + `@observer` (~197 `@observer` uses under views/). Injected prop names match the Provider prop names exactly — a typo'd inject name yields `undefined` at runtime, not a compile error.
- Non-React code (backends, utils, services) does NOT use inject — it imports singletons directly: `import { settingsStore } from '../stores/Stores'`.

Why: no DI framework keeps the graph explicit and debuggable; module-level
singletons let non-React code (backend classes, NavigationService consumers,
push handlers) reach state without a React context.

The circular-import hazard — and why it currently works:

```
stores/Stores.ts → stores/SettingsStore.ts → utils/BackendUtils.ts
      ↑                                              ↓
backends/LND.ts  ←———————————————————————————— (imports LND et al.)
```

`backends/LND.ts` imports `{ settingsStore, nodeInfoStore }` from
`stores/Stores`, while `stores/SettingsStore.ts` imports `BackendUtils`, which
imports the backend classes. This cycle does not explode because every cyclic
reference is used only INSIDE method bodies at call time, never during module
evaluation: `new LND()` / `new BackendUtils()` touch no store, and store
constructors call no backend. What breaks if violated: reference
`settingsStore` (or any store) at module scope or in a backend constructor and
you get `undefined` imports or a require-cycle crash at startup, possibly only
on one platform. Keep cyclic usage lazy.

MobX 5 constraint: the codebase uses MobX 5.15.3 decorator syntax
(`@observable`/`@action` on class fields). Do not introduce MobX 6 idioms
(`makeObservable`/`makeAutoObservable`) piecemeal — mixed modes silently stop
observing. tsconfig has `strictPropertyInitialization: false` specifically to
tolerate decorated store fields.

## 3. Backend dispatch — THE central invariant

Statement: `utils/BackendUtils.ts` (~308 lines) pre-instantiates all 7 backend
classes in its constructor and dispatches every call on
`settingsStore.implementation` via `getClass()` (unknown value falls back to
`this.lnd`).

INVARIANT: `call()` returns `false` SYNCHRONOUSLY for a missing method. It
never throws.

Why: this doubles as the capability mechanism — callers can cheaply probe
"does the active backend have X" without try/catch, and `supports*()` flags
are themselves dispatched through `call()` (missing flag ⇒ `false` ⇒ feature
hidden, which is the safe default).

The dispatcher code and the full consequence catalog (`false.then` crash
class, silent no-op on typos, the two-touch rule for adding an RPC, the
`payLightningInvoiceStreaming` dead dispatch) are owned by
**zeus-backends-and-capabilities §1** — read that before touching dispatch.
The design rule that matters here: always gate with the matching `supports*()`
before awaiting a dispatched method (see §8 for the dead-dispatch weak point).

Side behavior worth knowing: for `ldk-node`, `call()` wraps rejections with
`parseLdkNodeError` to normalize Rust FFI error strings — error-shape handling
lives in the dispatcher, not the backend class.

### The supports*() gating invariant

Statement: views gate feature AVAILABILITY only via `BackendUtils.supports*()`
methods (~55 of them, e.g. `supportsKeysend`, `supportsCashuWallet` — see
zeus-backends-and-capabilities for the authoritative counting command),
never by comparing `implementation` strings.

Why: 7 backends × every feature is unmaintainable as string checks; missing
capability gates are historically the top cross-backend crash source (a
feature renders on a backend that lacks the method → `false.then` crash or
nonsense UI).

Sanctioned exceptions — `implementation` branching IS used for
transport/lifecycle mechanics, where the question is "HOW do I talk to this
backend", not "does it have the feature":

- Connection lifecycle: the per-implementation branches in `views/Wallet/Wallet.tsx fetchData()` (§1).
- Keysend function selection + payment-result handling: `stores/TransactionsStore.ts sendPayment` picks `sendKeysend` vs `payLightningInvoice` by implementation, returns the raw promise for `lightning-node-connect` but routes others through `handlePayment`/`handlePaymentError`, and sets per-implementation request fields (`max_fee_percent` for cln-rest, `timeout_seconds` for LND-based/cln-rest/ldk-node).
- Invoice-creation/subscription wiring: `views/Receive.tsx` selects the payment-detection mechanism per implementation (embedded-lnd vs LNC vs ldk-node vs REST polling etc.).

Other scattered `implementation ===` checks exist in views (grep shows ~100
occurrences across ~30 files beyond the sanctioned Wallet.tsx/Receive.tsx
sites); treat them as debt to contain, not a pattern to extend. New feature
gates must be `supports*`.

Related version-gating caveat: LND-family flags additionally version-gate via
`LND.supports(minVersion)`, which reads `nodeInfoStore.nodeInfo.version` —
this is EMPTY until `getNodeInfo` resolves, so version-gated `supports*`
answers are unreliable during early connect. Don't cache them pre-connect.

## 4. Inheritance leak hazard — EmbeddedLND / LndHub extend LND

Statement: there is no abstract backend base class. `backends/LND.ts` (~942
lines, REST via react-native-blob-util + WebSocket streams, in-flight request
dedup cache, Tor routing) is the de facto base. `EmbeddedLND` and `LndHub`
`extends LND`; `CLNRest`, `LdkNode`, `LightningNodeConnect`,
`NostrWalletConnect` are standalone duck-typed classes.

Why (historical): embedded LND and LNDHub genuinely share LND's data shapes
and many helpers, so extension was cheap. The price:

HAZARD: any method NOT overridden in the subclass falls through to LND's REST
implementation — a network call against `settingsStore.host`, which for an
embedded node is meaningless (there is no REST host) and for LNDHub is the
wrong API. Verified fallthrough surface today: `getFees`, `setFees`,
`getForwardingHistory`, `subscribeInvoice`, `subscribeTransactions`,
`initChanAcceptor` exist only on `LND` among {LND, EmbeddedLND, LndHub}.
EmbeddedLND's own subscription methods are commented out with
`// TODO rewrite subscription logic` (backends/EmbeddedLND.ts), and
`stores/LSPStore.ts` works around the broken `initChanAcceptor` inheritance by
calling the native `lndmobile` `channel.channelAcceptor()` API directly
instead of going through BackendUtils.

Same hazard, capability edition: `LndHub` overrides ~45 `supports*` flags
(43 of them to `false`) but does NOT override `supportsChannelFundMax`, so it inherits `true`
from `LND` (`supportsChannelFundMax = () => true`) — a custodial account
"supporting" max-funding a channel it cannot open. This is the canonical
example: when adding ANY method or `supports*` flag to `LND`, immediately ask
"is this correct for EmbeddedLND and LndHub?" and override in both if not.

What breaks if violated: silent wrong-network calls (embedded node issuing
REST requests to a stale/absent host), or features rendered on backends that
cannot execute them.

## 5. Navigation contract

Statement:

- One flat native-stack navigator (App.tsx). No nested navigators for the main flow.
- Imperative navigation from OUTSIDE React (push handlers, deep links, services) goes through `NavigationService.ts`: `setTopLevelNavigator` (wired from App.tsx's `NavigationContainer` ref), `navigate`, `navigateWhenReady` (retries 50 × 100 ms until the container is ready), `getRouteStack`.
- Back-navigation uses `navigation.popTo('Screen')`, NOT `navigation.navigate('Screen')`. Why: after the react-navigation 6→7 upgrade, `navigate` to an existing route can PUSH a duplicate instead of popping back, corrupting the stack. What breaks: the regression class fixed in PR #2192 (`7abc7a971`, "fix-navigation-upgrade-regressions") — broken back-nav and node-picture selection. ~79 `popTo` call sites exist under views/ today.
- Types: use `NativeStackNavigationProp` from `@react-navigation/native-stack` (7.12.0) — never `StackNavigationProp` from `@react-navigation/stack`, which is not the navigator Zeus uses.
- Known debt, stated plainly: ~220 `@ts-ignore` lines in App.tsx (278 repo-wide excluding zeus_modules) paper over Screen/route typing. There is no typed route-param map. Zeus suppresses with `@ts-ignore` (ban-ts-comment is off), never `eslint-disable`. Don't try to drive-by-fix the typing debt inside a feature PR.

## 6. Persistence boundary (summary — details in zeus-storage-and-migrations)

Everything durable and secret goes through ONE wrapper: `storage/index.ts`, a
react-native-keychain facade with key prefix `zeus:` and `cloudSync: false` on
every call. Contract quirks you must know even when not doing storage work:
`getItem` returns `false` (not `null`) when a key is unset, and writing an
empty string is converted to a delete. All wallet configs and secrets live in
one JSON blob under key `zeus-settings-v2`, owned by `stores/SettingsStore.ts`.
Anything touching that blob, keychain keys, or migrations is a GATED change
(maintainer sign-off + migration plan — see zeus-change-control). For the
migration recipes, iCloud rules, and the three-registries rule for new keys,
load zeus-storage-and-migrations.

## 7. New Architecture (Fabric) is ON

Statement: RN New Architecture has been enabled since the RN 0.74.2 → 0.83.1
jump, commit `d13ebc2cd` ("deps: React Native upgrade: 0.74.2 -> 0.83.1").
Verified today: `android/gradle.properties` has `newArchEnabled=true`; iOS has
no opt-out in the Podfile (New Architecture is the RN 0.85 default). Current
RN: 0.85.3.

Why it's a contract: Fabric is stricter than the legacy renderer. Forbidden /
crash-prone patterns:

- Legacy `Animated` usage that mutated layout outside the declarative flow — WalletHeader crashed on Fabric and was fixed in `f08bfc7c5` ("fix WalletHeader animation crashes on New Architecture").
- Layout assumptions the old renderer tolerated — the keypad Fabric crash required a baseline-layout restructure, `2c55e4f89` (#4163).

What breaks if violated: hard native crashes, often only in release builds or
on one platform. Any pre-2026 RN snippet (Stack Overflow, old Zeus code) that
manipulates Animated values or measures layout imperatively must be treated as
suspect. Fuller incident chains: zeus-failure-archaeology.

## 8. Known weak points — stated plainly

These are acknowledged, open, and NOT invitations for drive-by fixes (payment
paths and storage are change-controlled; several are entangled with active
campaigns). Cite them; don't silently "clean them up".

| Weak point | Location (verified) | Status |
|---|---|---|
| Zero test coverage for stores/, views/, components/, backends/ | 0 `*.test.ts*` files in those trees; all 49 test files live in utils/, models/, lndmobile/, plus `check-styles.test.ts` at the repo root | Open. No safety net for architecture-level changes; see zeus-validation-and-qa |
| `thread.run()` instead of `thread.start()` in the LND sync worker (runs the "thread" synchronously on the caller) | `android/app/src/main/java/com/zeus/LndMobileScheduledSyncWorker.java`, `FIXME(hsjoberg)` comment: "this is really wrong" (Looper.prepare crash blocked the correct form) | Open, Blixt-inherited |
| `unbindLndMobileService` acknowledged broken | `lndmobile/LndMobile.d.ts`: `// TODO(hsjoberg): function looks broken`; Java side parks a Promise in `requests` that the unbind path never resolves | Open |
| EmbeddedLND subscription methods disabled | `backends/EmbeddedLND.ts`: `subscribeInvoice`/`subscribeTransactions` commented out under `// TODO rewrite subscription logic`; un-overridden methods fall through to REST (§4) | Open; LSPStore bypasses via native `lndmobile` |
| `payLightningInvoiceStreaming` dead dispatch | Declared only in `utils/BackendUtils.ts`; no backend implements it; always returns `false` | Open question (vestigial vs planned — unresolved) |
| `readLndLog` stub returns `['']` | `lndmobile/index.ts`, marked `TODO remove` | Open |
| LNC permissions hard-coded to `true` | `backends/LightningNodeConnect.ts checkPerms`: "ZEUS-3642: we are temporarily returning all perms as true until resolved" (github issue #3642) | Open — perm-derived `supports*` on LNC is untrustworthy; read-only pairings show send UI |
| WebSocket streams bypass Tor | `backends/LND.ts wsReq` constructs `new WebSocket(url, ...)` directly — no `doTorRequest`/SOCKS path, unlike `restReq` which routes through Tor when enabled | Open privacy gap |
| LNURL params unfetchable from `.onion` in some flows | `// TODO handle fetching of params with internal Tor` at 3 call sites: `utils/handleAnything.ts`, `components/LayerBalances/LightningSwipeableRow.tsx`, `components/LayerBalances/EcashSwipeableRow.tsx` | Open |
| `fetchLock` not released on early-return error paths in `fetchData` | `views/Wallet/Wallet.tsx` (§1); only cleared at fetchData end or by `setConnectingStatus(true)` | Open, part of node-lifecycle races — see zeus-node-lifecycle-campaign |

## Invariants quick card

| # | Invariant | Breaks as |
|---|---|---|
| 1 | Connection logic lives in Wallet.tsx `fetchData`, guarded by `fetchLock` + `connecting`; never run it in parallel | Infinite loading (`fdad118ed` → fixed `93227029e`), double node start |
| 2 | Stores are constructed once in stores/Stores.ts, deps declared above dependents; cyclic refs only used lazily | `undefined` singleton / require-cycle startup crash |
| 3 | `BackendUtils.call()` returns `false` for missing methods — gate with `supports*()` before awaiting | `TypeError: .then is not a function`; silent no-ops on typos |
| 4 | Feature availability gated ONLY by `supports*()`; `implementation` branching reserved for lifecycle/transport mechanics | Cross-backend crashes (historically the top source) |
| 5 | Every method/flag added to `LND` must be audited for EmbeddedLND + LndHub overrides | Meaningless REST calls from embedded node; LndHub `supportsChannelFundMax` gap |
| 6 | Back-navigation uses `popTo`, imperative nav uses NavigationService, types use `NativeStackNavigationProp` | Duplicate-screen stacks (PR #2192, `7abc7a971`) |
| 7 | All persistence through `storage/index.ts` / `zeus-settings-v2`; storage changes are gated | Data loss; see zeus-storage-and-migrations + zeus-change-control |
| 8 | New Architecture is ON — no legacy Animated/layout patterns | Fabric native crashes (`f08bfc7c5`, `2c55e4f89`) |

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha). All
paths repo-relative. Line counts, screen counts, and `@ts-ignore` totals are
approximate by nature and drift with every release — re-verify before citing.

One-line re-verification commands (all read-only):

| Fact | Command |
|---|---|
| RN / mobx / navigation versions | `grep -nE '"react-native"|"mobx"|"mobx-react"|"@react-navigation/native-stack"' package.json` |
| 30 store singletons + DI order | `grep -c '^export const' stores/Stores.ts` and read the file top-to-bottom |
| Provider props match store names | `sed -n '/<Provider/,/>/p' App.tsx` |
| Wallet is first (initial) screen; screen count | `grep -n 'Stack.Screen' App.tsx \| head -3` ; `grep -c 'Stack.Screen' App.tsx` |
| `call()` returns false for missing methods | `grep -n -A3 'call = (funcName' utils/BackendUtils.ts` |
| 7-way dispatch + default lnd | `grep -n -A20 'getClass = ' utils/BackendUtils.ts` |
| `payLightningInvoiceStreaming` still dead | `grep -rn payLightningInvoiceStreaming --include='*.ts*' . \| grep -v node_modules \| grep -v zeus_modules` (only BackendUtils.ts hits ⇒ still dead) |
| EmbeddedLND/LndHub still extend LND | `grep -n 'extends' backends/*.ts` |
| LndHub `supportsChannelFundMax` gap | `grep -n supportsChannelFundMax backends/LndHub.ts backends/LND.ts` (no LndHub hit ⇒ gap persists) |
| EmbeddedLND subscriptions still disabled | `grep -n -A3 'TODO rewrite subscription logic' backends/EmbeddedLND.ts` |
| `fetchLock` / `connecting` guards | `grep -n 'fetchLock\|@observable public connecting' stores/SettingsStore.ts views/Wallet/Wallet.tsx` |
| fetchData reset list | `sed -n '/if (connecting) {/,/CashuStore.reset/p' views/Wallet/Wallet.tsx \| head -25` |
| NavigationService API | `cat NavigationService.ts` |
| popTo usage level | `grep -rn 'popTo(' views \| wc -l` |
| `@ts-ignore` debt | `grep -c '@ts-ignore' App.tsx` |
| New Arch ON | `grep -n newArchEnabled android/gradle.properties` ; `git log --oneline -1 d13ebc2cd` |
| thread.run() hack | `grep -n -B4 'thread.run()' android/app/src/main/java/com/zeus/LndMobileScheduledSyncWorker.java` |
| unbind broken TODO | `grep -n 'looks broken' lndmobile/LndMobile.d.ts` |
| LNC perms hardcoded | `grep -n -A3 'ZEUS-3642' backends/LightningNodeConnect.ts` |
| WS-bypasses-Tor | `grep -n 'new WebSocket' backends/LND.ts` (constructed directly, no Tor branch) |
| onion LNURL TODOs (3 sites) | `grep -rn 'TODO handle fetching of params with internal Tor' utils components` |
| Zero store/view/backend tests | `find stores views components backends -name '*.test.ts*' \| wc -l` (expect 0) |
| Incident hashes | `git log --oneline -1 <hash>` for `fdad118ed`, `93227029e`, `7abc7a971`, `f08bfc7c5`, `2c55e4f89`, `d13ebc2cd`, `7ed901a10`, `d416052cd` |
