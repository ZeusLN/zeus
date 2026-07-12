---
name: zeus-research-frontier
description: Load when the task is choosing or scoping research/roadmap work on Zeus — "what should we build next", "where can Zeus advance the state of the art", "is this feature/scheme novel", "can we claim X publicly", picking up stalled work (bip-321, android-16kb-page-size, LSPS7 refund UI, payLightningInvoiceStreaming), or writing external-facing claims (blog posts, release notes, conference talks, comparisons with other wallets). Covers the four maintainer-endorsed research directions (self-custodial UX parity, protocol leadership, multi-backend robustness, privacy leadership), candidate infrastructure problems, and the proof/reproducibility standards required before any public novelty claim.
---

# Zeus Research Frontier

Open problems where Zeus can advance the state of the art in self-custodial Lightning wallets, plus the standards for claiming anything publicly. Four directions below are maintainer-endorsed (2026-07-06); everything labeled **candidate** or **open** is discovery output, not endorsed roadmap.

## When to use / When NOT to use

**Use this skill when:**
- Deciding what research or frontier work to pick up next in this repo.
- Picking up a stalled thread named here (LSPS7 refund UI, `bip-321` branch, `payLightningInvoiceStreaming`, `android-16kb-page-size`, NUT-15 upstreaming).
- Writing anything external-facing that makes a claim about Zeus (novelty, "first", benchmarks, privacy properties).
- Evaluating whether a feature idea is genuinely novel vs. already known in the ecosystem.

**Do NOT use this skill for:**
- *How* to turn a hunch into an accepted change (evidence bar, idea lifecycle) → **zeus-research-methodology**.
- Concrete analysis recipes (race analysis, dispatch audits, migration proofs) → **zeus-proof-and-analysis-toolkit**.
- The node-lifecycle-races problem specifically → **zeus-node-lifecycle-campaign** (it has its own executable campaign).
- Backend capability mechanics and adding an RPC → **zeus-backends-and-capabilities**.
- Storage/migration changes (several steps below touch defaults or persisted data — those are gated) → **zeus-storage-and-migrations** and **zeus-change-control**.
- Domain theory (what BOLT12/LSPS/Cashu *are* in depth) → **zeus-lightning-reference**. This skill defines terms only enough to scope the work.

## Glossary (first-use definitions)

| Term | Meaning here |
|---|---|
| LSP | Lightning Service Provider — a well-connected node that sells inbound capacity (channels) to wallets |
| LSPS1 / LSPS7 | Interop specs for buying channels from an LSP (LSPS1) and extending a channel lease (LSPS7) |
| JIT channel | "Just-in-time" channel an LSP opens while a payment is in flight, so a fresh wallet can receive |
| BOLT11 / BOLT12 | Lightning invoice formats; BOLT12 "offers" are static, reusable payment codes |
| NWC | Nostr Wallet Connect (NIP-47) — remote-control a wallet over nostr relays |
| Cashu / ecash / NUT-15 | Chaumian ecash protocol; a "mint" is its custodian; NUT-15 = paying one invoice from multiple mints via MPP |
| MPP | Multi-part payment — one invoice paid in several HTLC shards |
| CLINK / noffer | Nostr-based payment negotiation (`noffer1…` bech32 codes, kind-21001 events) |
| BIP-321 | Successor to BIP-21 `bitcoin:` payment URIs (unified on-chain + Lightning QR) |
| hodl invoice / preimage | Invoice whose settlement is deferred until a chosen secret (preimage) is released — lets a third party hold payments for an offline wallet |
| Tor / .onion | Anonymity network / its hidden-service addresses; Zeus embeds Tor via `react-native-nitro-tor` |
| Embedded node | A full Lightning node compiled into the app: `embedded-lnd` (Go, gomobile) or `ldk-node` (Rust, uniffi) |
| supports\*() | Per-backend capability flags in `backends/*.ts`, dispatched through `utils/BackendUtils.ts` — the gate for every feature |

---

## Direction 1 — Self-custodial UX parity (zero-config receive, background payments, swaps)

**Why current SOTA fails.** Custodial wallets receive instantly with zero setup and work while the app is closed. Self-custodial mobile wallets need inbound liquidity (a channel) before first receive, and the node is offline whenever the OS suspends the app — so unattended receive/pay is unreliable. No shipping wallet has closed both gaps without custody.

**Zeus's specific assets.**
- Two embedded node engines behind one UI: `embedded-lnd` (gomobile AAR/xcframework) and `ldk-node` (uniffi FFI, ZeusLN fork `v0.7.0-zeus-pathfinder-config` per `fetch-libraries-versions.json`).
- A three-generation LSP stack in `stores/LSPStore.ts`: Olympus Flow 2.0 REST (default `https://0conf.lnolymp.us`, JIT invoice wrapping via `jit_bolt11`), LSPS1 over three transports (custom message type `37913`, REST, native — chosen per backend via `supportsLSPScustomMessage` / `supportsLSPS1rest` / `supportsLSPS1native`), and LSPS7 lease extension (`supportsLSPS7native`, currently `true` only on `backends/LdkNode.ts`).
- ZEUS Pay lightning address (`stores/LightningAddressStore.ts`) with three receive modes — `zaplocker`, `cashu`, `nwc` — giving offline receive without custody of keys.
- Boltz-protocol swaps (`stores/SwapStore.ts`, default host `https://swaps.zeuslsp.com/api/v2` defined in `stores/SettingsStore.ts`) with deterministic rescue keys (`DERIVATION_PATH = 'm/44/0/0/0'`).

**First three concrete steps in this repo.**
1. **Finish LSPS7.** The refund-address UI in `views/LSPS7/index.tsx` is disabled behind `{false && (` with the comment `TODO add conditions for refund onchain address` (search: `grep -n "false && (" views/LSPS7/index.tsx`). Note `state.refundOnchainAddress` is ALREADY plumbed into both LSPS7 order paths (`stores/LSPStore.ts` lines ~1174 and ~1207); because the input is fenced, the value is always `''`. The remaining work is defining when the LSP requires a refund address and enabling the fenced input block — not re-implementing the wiring.
2. **Measure NWC background delivery before changing it.** `stores/NostrWalletConnectStore.ts` (3232 lines, zero tests) runs the wallet-service side; iOS keep-alive is a background-audio hack (`ios/zeus/NWCAudioKeepAlive.m` + bundled ambient `.m4a` files in `ios/zeus/`), Android uses a persistent foreground service gated by the AsyncStorage flag `persistentNWCServicesEnabled` (constant `NWC_PERSISTENT_SERVICE_ENABLED` in the store). Build a delivery-success-rate harness (N payment attempts against a backgrounded device, per platform, per keep-alive mode) so improvements are measurable. Measurement recipes: **zeus-diagnostics-and-tooling**.
3. **Map the fresh-install receive funnel.** Instrument the path from new embedded wallet → first receive: `views/Wallet/Wallet.tsx` post-connect LSP init (`getLSPInfo`, `initChannelAcceptor`), Flow JIT wrapping in `stores/LSPStore.ts` (note: wrapping mutates the invoice amount by subtracting the zero-conf fee and silently degrades to unwrapped on failure), and `views/Receive.tsx`. Record where users stall and what fees they pay.

**You have a result when:** a fresh install on both platforms receives a Lightning payment within a bounded time (pick and publish the bound, e.g. 5 minutes) with zero manual channel-management screens, and the measured all-in fee vs. a custodial baseline is documented. Falsified if any step requires the user to understand channels, or if background NWC payment delivery stays below the published target rate.

---

## Direction 2 — Protocol leadership (BOLT12, Cashu NUT-15, CLINK, BIP-321)

**Why current SOTA fails.** BOLT12 offers barely exist on mobile: receiving to an offer needs an online node with blinded-path support, so most wallets ship nothing. Multimint ecash payments (NUT-15) are unimplemented in mainstream client libraries. Unified payment URIs (BIP-321) are stalled ecosystem-wide.

**Zeus's specific assets.** Offers already work on two backends — `supportsOffers()` is `true` only in `backends/CLNRest.ts` and `backends/LdkNode.ts` (verify: `grep -rn supportsOffers backends/`); Zeus maintains its own ldk-node fork; the Cashu integration is CDK-FFI-based with a working NUT-15 client that CDK itself lacks.

**Concrete threads, file-level.**
- **BOLT12 beyond cln-rest/ldk-node.** LDK Node cannot persist offers — `listOffers` in `backends/LdkNode.ts` hard-returns `{ offers: [] }` with the comment "LDK Node doesn't store offers natively". Local offer persistence (per-node, keychain- or SQLite-backed) is the missing piece for real offer management on the embedded backend. Any persisted-key addition is a gated storage change → **zeus-storage-and-migrations**.
- **Cashu multimint NUT-15 — upstream or standardize.** `stores/CashuStore.ts` `queryMeltQuoteMpp` bypasses CDK entirely, POSTing raw `{mint}/v1/melt/quote/bolt11` with `options.mpp`, then classifying rejections (`classifyMppRejection`). CDK is pinned at `0.14.2` (`fetch-libraries-versions.json`). Either upstream multimint melt to CDK (removing the bypass) or publish the probe/rejection-classification approach as a client-interop note.
- **CLINK/noffer.** `utils/ClinkUtils.ts`: `noffer1…` bech32 TLV, `CLINK_KIND = 21001`, NIP-44 encryption, and a hard `ONION_NOT_SUPPORTED` error (no .onion relay support — overlaps Direction 4).
- **BIP-321 pickup.** Local branch `bip-321` (one commit `3c1210922`, 2025-08-20, unmerged: `git branch --list bip-321`; diff vs master touches `views/Receive.tsx`, `utils/AmountUtils.ts` + test, `stores/InvoicesStore.ts`). Concrete pickup: rebase onto current master and re-test the receive flow.
- **`payLightningInvoiceStreaming` — resolve the dead dispatch.** Declared in `utils/BackendUtils.ts` but implemented by NO backend (verify: `grep -rn payLightningInvoiceStreaming backends/ utils/` — only BackendUtils hits). Because missing methods return sync `false` (see Direction 3), every call would silently no-op. Decide: delete the wrapper, or implement streaming payment progress on the LND family. This is a design decision to surface to the maintainer, not a drive-by fix — payment-path changes must be minimal diffs (**zeus-change-control**).

**First three steps:** (1) rebase and revive `bip-321`; (2) write the maintainer proposal for `payLightningInvoiceStreaming` (delete vs. implement, with call-site evidence); (3) open the CDK upstream issue for multimint melt with Zeus's `queryMeltQuoteMpp` as the reference client.

**You have a result when:** (a) a mainnet BOLT12 offer created on an embedded ldk-node wallet survives app restart and receives a payment from a third-party wallet, or (b) the NUT-15 bypass is deleted because an upstream CDK release covers it, or (c) BIP-321 receive ships and a third-party wallet parses the QR. Each is binary and externally checkable.

---

## Direction 3 — Multi-backend robustness (the 7-backend matrix, crash-free)

**Why current SOTA fails.** No other wallet drives 7 heterogeneous backends (`embedded-lnd`, `ldk-node`, `lnd`, `lightning-node-connect`, `cln-rest`, `lndhub`, `nostr-wallet-connect`) behind one UI. The cost is silent capability drift: `BackendUtils.call()` returns **synchronous `false`** when the active backend lacks a method (`utils/BackendUtils.ts`: `if (!cls[funcName]) return false;`), so a typo'd or unimplemented dispatch never throws — it no-ops, and `false.then(...)` crashes at the call site. Missing `supports*` gates are historically the top cross-backend crash source.

**Zeus's specific assets.** The `supports*` capability system already exists: 55 distinct `supports*` flags dispatched through `utils/BackendUtils.ts` (count: `grep -o 'supports[A-Za-z0-9]*' utils/BackendUtils.ts | sort -u | wc -l`), including composites like `supportsLightningAddress = supportsCustomPreimages() || supportsCashuWallet()` computed in the dispatcher itself.

**First three concrete steps in this repo.**
1. **Dispatch-completeness audit tooling.** Mechanically enumerate every wrapper in `utils/BackendUtils.ts`, check which of the 7 backend classes implement it, and flag call sites lacking a `supports*` guard. Known true-positive the tool must catch: `payLightningInvoiceStreaming` (zero implementers); known cosmetic finding: `backends/NostrWalletConnect.ts` declares `supportsLSPS1customMessage` (typo — the dispatched name is `supportsLSPScustomMessage`; harmless only because both resolve to `false`). The audit recipe with worked examples lives in **zeus-proof-and-analysis-toolkit** — build the runnable version there, not here.
2. **Store test scaffolding.** There are zero tests under `stores/` today — all 49 test files live in `utils/` (45), `models/` (2), `lndmobile/` (1), plus root `check-styles.test.ts` (verify: `ls stores/*.test.ts` → no matches). Start with a keychain-mocking harness for `SettingsStore` (everything depends on it), then the dispatch-heavy stores. Jest ESM/transform traps → **zeus-validation-and-qa**.
3. **Typed dispatcher (candidate design, not started).** Replace the stringly `call(funcName: string)` with a typed interface over the backend classes so a missing implementation is a compile error, and absence must be expressed as an explicit capability. This changes payment-path plumbing — proposal first, minimal diff, maintainer sign-off (**zeus-change-control**).

**You have a result when:** the audit tool runs in CI and reports zero dispatched methods that are both unimplemented on some backend AND unguarded by `supports*` at every call site — and adding a new unguarded wrapper fails the build. Falsified if the tool exists but the matrix still produces a missing-method crash in release testing.

---

## Direction 4 — Privacy leadership (Tor gaps, TLS defaults, ecash, stealth)

**Why current SOTA fails.** "Tor support" in wallets is usually partial: some code paths route through Tor, others silently leak to clearnet, and users can't tell the difference. Zeus is closest to full Tor-by-default among self-custodial wallets but has verified gaps.

**Verified gaps in this repo (2026-07-06).**
| Gap | Evidence | Verify |
|---|---|---|
| WebSocket streams bypass Tor entirely | `backends/LND.ts` constructs `new WebSocket(url, …)` directly in 4 places; only the REST path goes through `doTorRequest` | `grep -n "new WebSocket" backends/LND.ts` |
| .onion LNURL params unfetchable | 3 identical `// TODO handle fetching of params with internal Tor` sites | `grep -rn "internal Tor" utils/ components/` → `utils/handleAnything.ts`, `components/LayerBalances/LightningSwipeableRow.tsx`, `components/LayerBalances/EcashSwipeableRow.tsx` |
| TLS verification OFF by default | `@observable certVerification: boolean = false` in `stores/SettingsStore.ts`; passed as `trusty: !certVerification` to react-native-blob-util | `grep -n "certVerification: boolean = " stores/SettingsStore.ts` |
| CLINK refuses .onion relays | `ONION_NOT_SUPPORTED` error in `utils/ClinkUtils.ts` | `grep -n ONION_NOT_SUPPORTED utils/ClinkUtils.ts` |

**Zeus's specific assets.** Embedded Tor (`react-native-nitro-tor` `0.6.0` in `package.json`); the hardened Tor TLS rule (cert bypass only for HTTPS .onion — the invariant and its incident history belong to **zeus-failure-archaeology** FA-5); Android Stealth Mode (three disabled-by-default `activity-alias` app disguises — calculator, VPN, QR scanner — in `android/app/src/main/AndroidManifest.xml`); an ecash small-balance model already wired (`settings.ecash` defaults in `stores/SettingsStore.ts`: `enableCashu: false`, `enableMultiMint: false`, `automaticallySweep: false`, `sweepThresholdSats: 10000` — ecash holds small change, auto-sweeps to Lightning above threshold).

**First three concrete steps in this repo.**
1. **Close the .onion LNURL gap:** implement Tor fetching of LNURL params at the 3 TODO sites using `utils/TorUtils.ts` (`doTorRequest`), respecting the .onion-HTTPS-only TLS rule.
2. **Route or fence the WebSocket gap:** either proxy `backends/LND.ts` WS streams through the embedded Tor SOCKS layer, or make the UI state explicitly that streaming falls back to clearnet when Tor is enabled — today it leaks silently.
3. **`certVerification` default-flip campaign:** flipping the default to `true` for existing users is a settings-default change requiring a MOD_KEY migration and maintainer sign-off — scope the breakage first (self-signed home-node certs are the common case), design the migration + UX (pin-on-first-use?), and route through **zeus-storage-and-migrations** + **zeus-change-control**. Do not just flip the initializer.

**You have a result when:** with Tor enabled, a full send+receive+stream session on a device under packet capture shows zero clearnet connections (WS included), and the LNURL flows work against a .onion service. Falsified by a single observed clearnet packet.

---

## Candidate infrastructure problems (discovery output — NOT maintainer-endorsed roadmap)

| Problem | Status | Evidence / verify |
|---|---|---|
| Supply-chain hash gaps in `fetch-libraries.sh` | **candidate** | CDK and zeus-cashu-restore SHA256 checks are conditional: `[ -n "$CDK_ANDROID_SHA256" ]` etc. — an empty hash field in `fetch-libraries-versions.json` silently skips verification (all four hashes ARE currently populated: `cat fetch-libraries-versions.json`). Worse: the uniffi binding SOURCE downloads (`CashuDevKit.swift`, `zeus_cashu_restore.swift`/`.kt` — `grep -n curl fetch-libraries.sh`) have no checksum at all. Fix = pin binding-source hashes + fail on empty hash. Maintainer intent unknown (open question: deliberate dev escape hatch?). |
| `android-16kb-page-size` branch | **open/stalled** | Single commit `fa2212457` (2025-10-10), touches 3 gradle files, unmerged; `android/check_elf_alignment.sh` exists in master but no build script invokes it (`grep -rn check_elf_alignment --include='*.gradle' --include='*.yml' .` → no hits). Google Play's 16 KB page-size requirement makes this time-sensitive — check current Play policy before scoping. |
| Test coverage for the 5 largest untested stores | **candidate** (feeds Direction 3 step 2) | `wc -l stores/*.ts \| sort -rn \| head`: `CashuStore.ts` 5591, `NostrWalletConnectStore.ts` 3232, `SettingsStore.ts` 2248, `LightningAddressStore.ts` 1486, `LSPStore.ts` 1330 — all with zero tests. |

---

## External positioning: novelty claims and proof obligations

Three things in Zeus are *candidates* for genuine novelty. For each, the proof obligation before ANY public "first"/"only" claim:

| Candidate claim | What's actually in the repo | Known prior art to check | Proof obligation before claiming |
|---|---|---|---|
| Self-custodial lightning address at scale (ZEUS Pay zaplocker mode) | `stores/LightningAddressStore.ts`: 250 pre-generated preimages, schnorr-signed hash submission to `zeuspay.com`, redemption by creating an invoice with a fixed preimage, nostr kind-`55869` attestations (>1 attestation per hash = fraud signal). Requires `supportsCustomPreimages()` (true on LND family only). | The Zaplocker scheme itself is supertestnet's prior work — Zeus's contribution is the production implementation + attestation-based fraud detection, NOT the scheme | Prior-art survey vs. Zaplocker repo and any LSP-held-invoice services; then claim "production deployment of" not "invention of" |
| Multimint NUT-15 MPP melt (pay one invoice from multiple mints) | `stores/CashuStore.ts` `queryMeltQuoteMpp` + per-mint NUT-15 probing and rejection classification, bypassing CDK | NUT-15 is specified; nutshell implements the mint side. Survey client wallets (Minibits, eNuts, cashu-ts consumers) for client-side multi-mint orchestration before claiming first | Working mainnet demo across ≥2 public mints, reproducible by a third party from a tagged release |
| NWC as a full wallet backend (not just a service) | `backends/NostrWalletConnect.ts` is one of the 7 dispatched backends; Zeus is simultaneously an NWC wallet-service (`stores/NostrWalletConnectStore.ts`) | Alby Go and others are NWC-native clients — "NWC as one of N interchangeable backends" is the defensible framing, plain "NWC client" is not novel | Comparative table vs. named wallets, dated |

**Standing proof obligations for ANY published claim:**
1. **Prior-art survey artifact** — dated, named projects checked, kept with the claim. No survey → no novelty claim.
2. **Third-party reproducibility** — the demo must work from a public tagged release, on mainnet where applicable, without Zeus-internal infrastructure knowledge.
3. **Verifiable builds** — Android releases are reproducible via `./build.sh` (Docker image pinned by sha256 digest, `SOURCE_DATE_EPOCH=0`; procedure in `docs/ReproducibleBuilds.md` — **Android only, there is no iOS reproducibility story**; don't imply one). Releases/commits are PGP-signed — key fingerprint `96C225207F2137E278C31CF7AAC48DE8AB8DEE84` (long ID `AAC48DE8AB8DEE84`, `PGP.txt`).
4. **AGPLv3 obligations** (see `LICENSE`): derivative works and network-served modifications must publish source. Any published benchmark/claim about Zeus must be checkable from the public repo.
5. **No-oversell rule:** "Zeus supports X" is only claimable when a `supports*` gate returns `true` on at least one shipping backend AND the feature passed the maintainer's mandatory hands-on iOS+Android testing. Benchmarks ship with methodology. Disabled code (`{false && ...}`), stalled branches, and dead dispatches are never "supported" — they are "in progress" at most. When in doubt, the framing standard is Bitcoin-Core-style conservatism: understate, link evidence.

---

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by direct file reads and read-only commands in this repo. Maintainer endorsement of the four directions dated 2026-07-06. Expensive claims (build reproducibility procedure) verified by source read of `build.sh`/`docs/ReproducibleBuilds.md`, not executed.

Re-verify volatile facts before relying on them:

| Fact | Re-verify with |
|---|---|
| LSPS7 refund UI still disabled | `grep -n "false && (" views/LSPS7/index.tsx` |
| `payLightningInvoiceStreaming` still unimplemented | `grep -rn payLightningInvoiceStreaming backends/ utils/` (backends/ hits = implemented) |
| Offers backends (cln-rest, ldk-node only) | `grep -rn "supportsOffers" backends/` |
| LDK Node offers not persisted | `grep -n -A2 "listOffers" backends/LdkNode.ts` |
| NUT-15 CDK bypass still present | `grep -n "v1/melt/quote/bolt11" stores/CashuStore.ts` |
| CDK / ldk-node / lnd pinned versions | `cat fetch-libraries-versions.json` |
| Empty-hash skip + unchecked binding downloads | `grep -n 'SHA256" ]' fetch-libraries.sh; grep -n curl fetch-libraries.sh` |
| Stalled branches exist | `git branch --list \| grep -E 'bip-321\|16kb'` |
| Zero store tests | `ls stores/*.test.ts` (expect: no matches) |
| Largest untested stores | `wc -l stores/*.ts \| sort -rn \| head -6` |
| `certVerification` default | `grep -n "certVerification: boolean = " stores/SettingsStore.ts` |
| WS-bypasses-Tor | `grep -n "new WebSocket" backends/LND.ts` |
| .onion LNURL TODO count (3) | `grep -rn "internal Tor" utils/ components/` |
| ecash defaults (enableCashu false, sweep 10000) | `grep -n -A4 "ecash: {" stores/SettingsStore.ts` |
| CLINK kind 21001 / onion unsupported | `grep -n "CLINK_KIND\|ONION_NOT_SUPPORTED" utils/ClinkUtils.ts` |
| supports\* flag count (55) | `grep -o 'supports[A-Za-z0-9]*' utils/BackendUtils.ts \| sort -u \| wc -l` |
| NWC typo flag | `grep -n supportsLSPS1customMessage backends/NostrWalletConnect.ts` |
| nitro-tor version (0.6.0) | `grep -n nitro-tor package.json` |
| PGP key fingerprint | `gpg --show-keys PGP.txt` |
| Zaplocker constants (250 preimages, kind 55869, zeuspay.com) | `grep -n "i < 250\|55869\|zeuspay.com" stores/LightningAddressStore.ts` |
| Stealth aliases disabled by default | `grep -n -A2 activity-alias android/app/src/main/AndroidManifest.xml` |
| Reproducible-build pins | `head -12 build.sh` |
