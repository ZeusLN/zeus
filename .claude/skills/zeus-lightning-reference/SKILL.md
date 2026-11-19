---
name: zeus-lightning-reference
description: Bitcoin/Lightning/ecash domain theory AS IMPLEMENTED IN ZEUS, for readers who may know React Native but zero Lightning (or vice versa). Load when working on or reading code that touches - BOLT11 invoice decoding (utils/Bolt11Utils.ts), payments (MPP/AMP/keysend, TLV records, routing fee limits), LNURL pay/withdraw/auth/channel or lightning addresses, ZEUS Pay / Zaplocker / nostr attestations, LSP flows (Olympus Flow 2.0, jit_bolt11 wrapping, LSPS0/1/7, 0-conf channel acceptance), Cashu/ecash (CDK FFI, multimint melts, token extraction), Nostr Wallet Connect (NIP-47, service and client roles), Boltz-protocol swaps, on-chain (address types, taproot, PSBT, coin control, CPFP bump retry, mempool.space fees), the universal input router utils/handleAnything.ts and its detector ordering, CLINK/noffer, or watchtowers. Also load when confused by terms like HTLC, preimage, hodl invoice, JIT channel, melt quote, submarine swap, or keysend while reading Zeus code.
---

# Zeus Lightning & Ecash Domain Reference

Protocol knowledge tied to the exact Zeus file that implements it, plus the Zeus-specific
twist on each protocol. Every claim below was verified against the code at the commit in
"Provenance and maintenance". Paths are repo-relative.

## When to use / When NOT to use

**Use this skill when** you need to understand WHAT a protocol does and HOW Zeus implements
it: decoding invoices, payment flows, LNURL, ZEUS Pay, LSPs, Cashu, NWC, swaps, on-chain,
or the input router.

**Do NOT use this skill for:**

| Need | Use instead |
| --- | --- |
| Which of the 7 backends supports feature X; per-backend RPC quirks; adding an RPC | `zeus-backends-and-capabilities` |
| Settings defaults, config axes, add-a-setting checklist | `zeus-config-and-flags` |
| Keychain keys, storage blob, migrations (e.g. Cashu per-node namespacing details) | `zeus-storage-and-migrations` |
| Boot sequence, stores DI, dispatch design rationale | `zeus-architecture-contract` |
| Symptom-driven debugging, past incident history | `zeus-debugging-playbook` / `zeus-failure-archaeology` |
| PR/commit/review rules, what changes are gated | `zeus-change-control` |

One rule from change control that this skill must echo because everything here is
funds-touching: **send/receive/payment-handling code takes minimal diffs only — no
drive-by refactoring.** See `zeus-change-control` for the full policy.

## 1. Lightning in three paragraphs (just enough to read this codebase)

**Channels and HTLCs.** The Lightning Network is a payment layer on top of Bitcoin. Two
nodes lock bitcoin into a shared 2-of-2 on-chain output called a **channel**; they then pay
each other instantly by exchanging signed balance updates off-chain. Multi-hop payments are
forwarded through chains of channels using **HTLCs** (Hashed Time-Locked Contracts): each
hop's payment is locked to the SHA-256 hash of a secret (the **preimage**); revealing the
preimage settles every hop atomically. A **hodl invoice** is one where the receiver
deliberately delays revealing the preimage — the payment hangs "in-flight" until released
(ZEUS Pay's retired Zaplocker scheme, section 5, was built on this). **0-conf** channels are usable
before their funding transaction confirms — safe only when you trust the channel opener,
which is why Zeus only auto-accepts 0-conf from its LSP (section 6).

**Invoices and routing.** A **BOLT11 invoice** (a `lnbc...` bech32 string) encodes amount,
payment hash, expiry, destination and a signature (section 2). **BOLT12 "offers"**
(`lno1...`) are reusable payment codes; Zeus supports them on the cln-rest and ldk-node
backends. Payment senders find a route themselves and pay **routing fees** to intermediate
hops; wallets set a fee cap per payment (section 3). **MPP** (multi-path payments) split
one payment across several routes; **AMP** (atomic multi-path) is LND's variant that also
works without an invoice. **Keysend** is a spontaneous payment (no invoice) where the sender
generates the preimage and ships it inside the payment's **TLV** (type-length-value) custom
records.

**LSPs and the rest.** An **LSP** (Lightning Service Provider) sells inbound channel
capacity, including **JIT** (just-in-time) channels opened at the moment a payment arrives
(fee deducted from the received amount). **LNURL** is a family of HTTP-based UX protocols
(pay/withdraw/auth/channel) layered on Lightning; a **lightning address**
(`user@domain.com`) is LNURL-pay behind an email-like name. **Ecash (Cashu)** is a
custodial-but-blinded token system: a **mint** holds sats and issues bearer tokens
(**proofs**) it cannot link to you; **melting** a token converts it back into a Lightning
payment. **NWC** (Nostr Wallet Connect, NIP-47) lets apps drive a wallet remotely over the
Nostr relay network. **Submarine swaps** move funds between on-chain and Lightning through
a swap provider (Boltz protocol): submarine = on-chain in, Lightning out; reverse = Lightning
in, on-chain out.

## 2. BOLT11 invoices — `utils/Bolt11Utils.ts`

Zeus does NOT use a stock bolt11 npm decoder; it has a hand-rolled one (based on
light-bolt11-decoder) with two load-bearing performance features:

1. **LRU cache** (`CACHE_LIMIT = 256`), keyed by the lowercased payment request. The
   Activity list decodes the same invoices repeatedly; the cache collapses that. Cache hits
   return **the same object instance** to every caller.
2. **Lazy self-replacing getters** for `destination`, `payeeNodeKey`, `signature`,
   `recoveryFlag`. Recovering the payee node key from the invoice signature is an
   ECDSA public-key recovery via `@noble/secp256k1` (~5–20 ms per call on a phone — the
   comment in the file says so). `decode()` defers it: those four fields are installed as
   `Object.defineProperty` getters that run recovery on first access, then replace
   themselves with plain values. Callers that only read `payment_hash` / `description` /
   `expiry` / `timestamp` pay zero crypto cost. If the invoice carries an explicit payee
   tag (tag 19), `destination`/`payeeNodeKey` are set eagerly from it and the getters are
   skipped.

**Consequences — the rules:**

- **Never naively serialize or spread a decoded invoice** (`JSON.stringify(decoded)`,
  `{...decoded}`). The lazy getters are enumerable, so both operations force the expensive
  secp256k1 recovery immediately — for every cached invoice you touch — defeating the
  entire design. Read individual fields instead.
- **Never mutate the returned object.** It is shared cache state; your mutation poisons
  every future `decode()` of that invoice.
- `decode()` throws on non-`ln` strings — callers gate with
  `AddressUtils.isValidLightningPaymentRequest` first (see `utils/handleAnything.ts`).
- Amount fields: `satoshis` (number|null), `millisatoshis` (string|null), plus
  Zeus-convention `num_satoshis` / `num_msat` (strings, `'0'` when absent).
- **Duplicate singleton tags follow lnd's zpay32** (#4631, `bdfaee04f`): more than one
  `p` (payment hash) field throws, counted by presence regardless of length; an invoice
  with no valid payment hash throws (`'No valid payment hash found'`); for the other
  singletons (`s`, `d`, `h`, `n`, `x`, `c`, `m`) the first well-formed occurrence wins,
  and fixed-size fields of the wrong length (`HASH_TAG_WORDS = 52`,
  `PAYEE_TAG_WORDS = 53`) are skipped. `sections` still records every occurrence.

The interface is `DecodedBolt11` in the same file. Tests: `utils/Bolt11Utils.test.ts`.

## 3. Paying: MPP, AMP, keysend, fee limits

Payment dispatch lives in `stores/TransactionsStore.ts` (`sendPayment` →
`sendPaymentInternal`); the send UI is `views/PaymentRequest.tsx`.

### MPP vs AMP and their version gates

- `supportsMPP()` and `supportsAMP()` are per-backend capability flags (see
  `zeus-backends-and-capabilities` for the doctrine). On the LND family
  (`backends/LND.ts`, `backends/EmbeddedLND.ts`, `backends/LightningNodeConnect.ts`)
  they are node-version-gated: MPP requires LND ≥ v0.10.0, AMP requires LND ≥ v0.13.0.
  `backends/LdkNode.ts`: MPP true, AMP false. CLNRest, LndHub, NostrWalletConnect: both false.
- AMP is also **forced on** when the invoice's feature bit 30 is `is_required`
  (`views/PaymentRequest.tsx`, `lockAtomicMultiPathPayment`). Enabling AMP sets
  `no_inflight_updates = true`. Tor also sets `no_inflight_updates = true` ("Tor can't
  handle streaming updates").

### The `max_parts` quirk (verify before relying on defaults)

- `TransactionsStore.sendPaymentInternal`: `data.max_parts = max_parts ? max_parts : '1'`
  — the **store default is `'1'`** (single path) for any caller that doesn't pass it.
- `views/PaymentRequest.tsx` `triggerPayment`:
  `max_parts: enableMultiPathPayment ? maxParts : '16'` with state default
  `maxParts: '16'` — the **main send screen always passes `'16'`**, whether or not the
  MPP toggle is on. So payments from PaymentRequest allow 16 shards; payments from other
  call sites (e.g. programmatic sends) allow 1.
- `sendPaymentSilently` has `if (max_parts) { data.max_parts = max_parts || '16'; }` —
  the `|| '16'` branch is unreachable (dead fallback); if the caller omits `max_parts`
  the field is simply not set.

### Keysend

Constants at the top of `stores/TransactionsStore.ts`:

| TLV record type | Content | Encoding in Zeus |
| --- | --- | --- |
| `5482373484` | payment preimage (sender-generated) | random bytes → base64 (`preimage.toString('base64')`) |
| `34349334` | optional text message | UTF-8 → hex → base64 (`Base64Utils.hexToBase64(Base64Utils.utf8ToHex(message))`) |

Plus: `data.dest = Base64Utils.hexToBase64(pubkey)` and
`data.last_hop_pubkey = Base64Utils.hexToBase64(...)` — **LND REST wants raw bytes
base64-encoded, not hex strings**; forgetting the conversion is a classic bug.
`payment_hash` is `hexToBase64(sha256(preimage))`.

Function selection is one of the few sanctioned `implementation` branches (see
`zeus-architecture-contract`): `cln-rest` / `embedded-lnd` / `ldk-node` with a pubkey go
through `BackendUtils.sendKeysend`; everything else — including remote LND REST, which has
no dedicated keysend endpoint — goes through `BackendUtils.payLightningInvoice` carrying
`dest_custom_records`.

### Routing fee conventions — `utils/FeeUtils.ts`

`calculateDefaultRoutingFee(amount)`:

- amount > 1000 sats → fee cap = 5% (`DEFAULT_ROUTING_FEE_PERCENT = 0.05`), rounded.
- amount ≤ 1000 sats → fee cap = the amount itself (i.e. 100%; tiny payments routinely
  need proportionally huge fees).

`views/PaymentRequest.tsx` always passes `fee_limit_sat`. It adds `max_fee_percent` only
when the backend is cln-rest and the percent fee option is selected (`feeOption ===
'percent'`); the percent defaults to `settings.payments.defaultFeePercentage || '5.0'`.
The store also only forwards `max_fee_percent` when `implementation === 'cln-rest'`.

`sendPayment` holds a send guard, `paymentInFlight`, that blocks a second send while one
is in flight (#4492). If no completion callback arrives within `timeout_seconds` (300
when unset) plus 60 seconds, `backstopPaymentInFlight` does not release the guard
blindly: where `lookupPayment` is supported it polls the payment
(`PAYMENT_TRACK_POLL_MS`) until SUCCEEDED or FAILED, giving up after
`PAYMENT_TRACK_MAX_FAILURES` failed lookups or the `PAYMENT_TRACK_MAX_MS` (10 min)
ceiling. AMP payments have no single hash to track and stay on the timer.

## 4. LNURL family and lightning addresses

Zeus uses the `js-lnurl` package (`getParams`, `findlnurl`, `decodelnurl` — imported in
`utils/handleAnything.ts`; version pinned in `package.json`). LNURL flows are routed by
the input router (section 11) to one of four screens based on `params.tag`:

| tag | Meaning | Zeus screen |
| --- | --- | --- |
| `payRequest` (LNURL-pay / LUD-06) | server gives min/max, you request an invoice from its callback | `views/LnurlPay/` (or `ChoosePaymentMethod` when ecash is enabled) |
| `withdrawRequest` (LNURL-withdraw) | server offers sats; you submit YOUR invoice to its callback | `views/Receive.tsx` with `lnurlParams` (or `ChoosePaymentMethod` when ecash is enabled) |
| `channelRequest` (LNURL-channel) | server opens a channel to you | `views/LnurlChannel.tsx`, gated by `supportsPeers()` (only `connectPeer` + own pubkey needed) |
| `login` (LNURL-auth) | key-based login challenge | `views/LnurlAuth.tsx`, gated by `supportsLnurlAuth()` |

**Lightning address (LUD-16)** resolution is in `handleAnything.ts`, but the lnurlp URL
is built by `getLnurlpUrl` in `utils/LnurlPayUtils.ts` (#4762, shared with
`utils/DonationUtils.ts`): `https://<domain>/.well-known/lnurlp/<user>` (plain `http://`
for `.onion`). Per LUD-16 the domain is always lowercased; the username is lowercased
and percent-encoded with `encodeURIComponent` so it stays one path segment (#5187),
**except for `cryptoqr.net` addresses**, whose usernames are already URL-encoded
merchant payloads where hex-digit casing matters server-side (`isCryptoQR` check; only
`/`, `\`, `?`, `#` and `%2e` are encoded; covered by `utils/handleAnything.test.ts` and
`utils/LnurlPayUtils.test.ts`). Before the LNURL-pay lookup, Zeus also tries a
**BOLT12 DNS lookup** (BIP-353: TXT record at `<user>.user._bitcoin-payment.<domain>` via
`cloudflare-dns.com/dns-query`, query name encoded). The answer is used only when
Cloudflare reports it DNSSEC-validated (`Status === 0 && AD === true`), the echoed
question name matches the name asked, and exactly one TXT record starts with `bitcoin:`
(#4361). The lookup is skipped for `.onion` domains (#4729). If both exist Zeus offers a
payment-method choice; if the lnurlp fetch fails and there is no offer, it falls back to
a NIP-05 lookup (`attemptNip05Lookup`).

**Verification before paying or signing** (`utils/LnurlPayUtils.ts`):
`isLnurlCallbackAllowed` rejects callbacks that are not https (http only for `.onion`)
or that target loopback/private/link-local IP literals; `verifyLnurlPayInvoice` checks
the returned invoice's amount equals the requested msat and that its `description_hash`,
when present, matches the sha256 of the shown metadata (#4374, #5200);
`verifyLnurlAuthCallback` requires the callback host to equal the signing domain and
rejects backslashes and userinfo (#4576). Callers: `views/LnurlPay/LnurlPay.tsx`
(`isLnurlCallbackAllowed`, `verifyLnurlPayInvoice`) and `views/LnurlAuth.tsx`
(`verifyLnurlAuthCallback`).

**Onion gap:** direct `.onion` lightning-address lookups go through `doTorRequest` when
Tor is enabled, but generic LNURL parameter fetches via `js-lnurl`'s `getParams` do NOT
route over Zeus's internal Tor — there is a literal
`// TODO handle fetching of params with internal Tor` in `handleAnything.ts`; `.onion`
LNURL endpoints currently error out of that path. Open gap, not a bug you introduced.

Nested URI schemes `lnurlp://` / `lnurlw://` / `lnurlc://` / `lnurlauth://` are rewritten
to `https://` (or `http://` for `.onion`) before processing.

## 5. ZEUS Pay — `stores/LightningAddressStore.ts` + `stores/LnurlPayStore.ts`

ZEUS Pay gives a wallet a lightning address (`user@zeuspay.com`) even though the phone is
usually offline. Server: `LNURL_HOST = 'https://zeuspay.com'`. The client creates two
address types (`address_type` sent to the server): `'cashu'` (payments held as Cashu mint
quotes, redeemed via `/api/lnurl/nuts/redeem`) and `'nwc'` (the server pays through the
user's NWC connection, nothing to redeem). Gate: `supportsLightningAddress()` in
`utils/BackendUtils.ts` is the composite `supportsCustomPreimages() || supportsCashuWallet()`;
the `supportsCustomPreimages` half is what lets remote LND and LNC reach the NWC address type.

**Zaplocker (retired).** The third type, `'zaplocker'`, was a hodl-invoice scheme: the phone
pre-generated preimages and submitted their hashes, the server held each payer's HTLC, and
the app later redeemed it by creating an invoice with the fixed preimage. Payers published
nostr kind-`55869` attestations so the receiver could detect a server lying about amounts.
All of that client code was removed (onboarding in #4419, redemption, attestations, nostr
keys/relays screens and the payer-side checks afterwards). What is left: a hub banner and a
pared-down `views/LightningAddress/LightningAddressSettings.tsx` that let an existing
Zaplocker address switch to Cashu/NWC or be deleted; `status()` drops held Zaplocker payments
from `paid`; the storage key `zeuspay-lightning-address-hashes` stays only so address
deletion and data wipes clear it; the Zaplocker-only `lightningAddress` settings fields are
marked deprecated but still in the settings type and defaults.

## 6. LSP integration — three generations, all in `stores/LSPStore.ts`

Default endpoints (per network) are exported from `stores/SettingsStore.ts`
(`DEFAULT_LSP_MAINNET = 'https://flow.zeuslsp.com'`, LSPS1 REST
`DEFAULT_LSPS1_REST_MAINNET = 'https://lsps1.zeuslsp.com'`, etc.; moved to zeuslsp.com
in `d6ea24009`). Resolution is `getLspConfigForNetwork`, exported from the same file;
`LSPStore`'s private `getLspConfig` wraps it. Endpoint/default details belong to
`zeus-config-and-flags`.

### Generation 1: Olympus "Flow 2.0" REST (JIT channels on receive)

- `getZeroConfFee` POSTs the msat amount to `<flowHost>/api/v1/fee`;
  `getZeroConfInvoice(bolt11, quote)` POSTs to `/api/v1/proposal` and resolves `data.jit_bolt11`
  — a **wrapped invoice** routing through the LSP, which opens a 0-conf channel just in
  time and deducts its fee.
- **The wrapping MUTATES the requested amount** (`stores/InvoicesStore.ts`,
  `createInvoice`): when Flow LSP is active and the requested value is greater than the
  quoted fee, Zeus creates the local invoice for `req.value = requested − fee`, then swaps
  the displayed payment request for `jit_bolt11` (which asks the payer for the full
  amount). The payer sees the full amount; your node's invoice is smaller by the fee. A
  fee at or above the requested value is added on top instead.
- **Each invoice is priced with its own quote** (#5142, `3ef7361ab`): `createInvoice`
  keeps the quote returned by its own `getZeroConfFee` call in a local `lspQuote` and
  passes it to `getZeroConfInvoice(bolt11, lspQuote)`, which sends that quote's `fee_id`.
  The shared `lspStore.zeroConfFee`/`feeId` are not re-read, since another request may
  have replaced them. `getZeroConfFee` tags each call with `feeRequestId`; a call
  replaced by a newer one (or by `reset()`) rejects, and `createInvoice` stops without
  an invoice.
- **The wrapped invoice is verified** (#4673): `getZeroConfInvoice` checks `jit_bolt11`
  with `verifyWrappedInvoice` in `utils/LspUtils.ts`: same network, same payment hash,
  both amounts present, and wrapped amount between the inner amount and inner amount
  plus the quoted fee (plus 999 msat rounding when a fee was quoted). A failed check
  rejects with `flow_error` set.
- **LSP rejection is a hard fail** (`a9d62a063`): if `getZeroConfInvoice` rejects,
  `createInvoice` clears `lspStore.zeroConfFee`, `lspStore.feeId`, `payment_request` and
  `payment_request_amt` and returns without an invoice. There is no fallback to the
  unwrapped invoice, which could dead-end without the channel it needs.
- **LNURL-withdraw interaction**: the withdraw callback must receive the wrapped invoice:
  `qs.pr = jit_bolt11 || invoice.getPaymentRequest` in `InvoicesStore`. Passing the
  unwrapped one would make the withdrawing service pay an invoice the LSP never sees.
  The invoice is submitted as soon as it is wrapped, so with a non-zero fee
  `createInvoice` requires the caller's `confirmLspFee(feeSats, value)` to accept the fee
  first (no callback means no invoice). A quote older than `LSP_FEE_QUOTE_MAX_AGE_MS`
  (3 min) by the time the user accepts is re-fetched, and the user is asked again unless
  the new fee is the same or zero. A fee at or above the amount is added on top, and is
  refused with `lspFeeAboveMaxWithdrawable` when amount plus fee exceeds the service's
  `maxWithdrawable`.

### Generation 2/3: LSPS0 transport + LSPS1 (buy channel) / LSPS7 (extend lease)

- **LSPS0** = JSON-RPC 2.0 over the Lightning peer-to-peer **custom message type `37913`**
  (`CUSTOM_MESSAGE_TYPE` in `LSPStore.ts`). Requests are correlated by `uuidv4()` ids
  (`this.getInfoId = uuidv4()`; responses matched by `data.id` in
  `handleCustomMessages`) with a **7-second timeout**
  (`CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS = 7000`).
- Three transports, chosen by backend capability flags:
  - **native** = `supportsLSPS7native()`: ldk-node only, and only for LSPS7
    (`BackendUtils.lsps7*` → `LdkNodeInjection.lsps7.*`). `supportsLSPS1native()` is false on ldk-node
    ("Olympus doesn't support native LSPS1"), so native LSPS1 is unused.
  - **custom message** = `supportsLSPScustomMessage()`: lnd, embedded-lnd and LNC.
    Sends go through `LSPStore.sendCustomMessage` → `BackendUtils.sendCustomMessage`;
    the subscription on embedded-lnd uses the `lndmobile` `SubscribeCustomMessages`
    event stream, other backends use `BackendUtils.subscribeCustomMessages`.
  - **REST** = `supportsLSPS1rest()`: lnd, LNC, cln-rest and ldk-node, LSPS1 only
    (`<lsps1Rest>/api/v1/get_info`, `/api/v1/create_order`).

  LSPS1 prefers native, then REST, then custom message (`isOlympus` and the transport
  choice in `stores/LSPStore.ts`); LSPS7 runs over native or custom message only.
  Methods: `lsps1.get_info`, `lsps1.create_order`, `lsps1.get_order`, and the LSPS7
  equivalents for channel-lease extension.
- **0-conf acceptance policy** (`handleChannelAcceptorEvent`): a channel-acceptor hook
  rejects any **0-conf** channel unless the opener is the LSP pubkey or listed in
  `settings.zeroConfPeers`; normal (confirmed) channels are accepted regardless. On
  embedded-lnd this is wired via the `ChannelAcceptor` native event stream; other backends
  go through `BackendUtils.initChanAcceptor`.

## 7. Cashu / ecash — `stores/CashuStore.ts` + `utils/CashuUtils.ts`

Ecash primer: a Cashu **mint** custodies sats and issues blinded bearer tokens
(**proofs**). Receiving Lightning through a mint = **mint quote** (pay invoice → get
proofs); paying Lightning from proofs = **melt quote**. Tokens serialize as
`cashuA...` (v3 JSON) / `cashuB...` (v4 CBOR) strings.

- **Implementation is the CDK Rust FFI, NOT cashu-ts**: `import CashuDevKit ... from
  '../cashu-cdk'` — a native module wrapping the Cashu Dev Kit with its own SQLite DB.
  Wallet ops (`initializeWallet(mnemonic, 'sat')`, `addMint`, `getBalances`, `melt`,
  `restoreFromSeed`) all cross the FFI. Cashu is available only where
  `supportsCashuWallet()` is true: **embedded-lnd and ldk-node**.
- **Seed versions**: `seedVersion` is `'v1'` (legacy: key material derived from the LND
  seed, bytes [32:64]) or `'v2-bip39'` (dedicated cashu BIP-39 phrase; stored under
  `<nodeDir>-cashu-seed-phrase` with version marker `<nodeDir>-cashu-seed-version`).
  v1 wallets keep their original P2PK key via `originalSeedVersion` special-casing.
  Per-node storage namespacing (`getNodeDir()` and the collision it fixed) is owned by
  `zeus-storage-and-migrations`.
- **Multimint MPP (NUT-15) bypasses CDK**: to pay one invoice from several mints at once,
  `mintSupportsMpp` probes each mint's info for NUT-15 (note the quirk: `nuts['15']` is
  an ARRAY of methods, not `{methods: [...]}`), then `queryMeltQuoteMpp` POSTs **raw mint
  REST** — `<mint>/v1/melt/quote/bolt11` with `options: { mpp: { amount: <msat> } }` —
  because CDK doesn't expose partial-amount melt quotes. Rejections are classified by
  `classifyMppRejection`: "internal mpp not allowed" / "self payment" → `'selfSend'`
  (mints refuse MPP toward their own invoices; the planner falls back to a single-mint
  regular quote via `prepareSingleMintRegularQuote`, executed with `CashuDevKit.melt`
  instead of `meltPartial`).
- **Melt success rules**: a melt counts as paid only when its normalized state is
  `PAID` (#4696); anything else throws `errorPayingInvoice`. When the invoice was created
  on our own node (self-custody), `isOwnInvoicePaid` also requires the returned preimage
  to hash to the invoice's payment hash, or asks the node whether the invoice is settled
  when the mint omits the preimage (#5140). `payLnInvoiceFromEcash` takes the
  `paymentRequest` the caller reviewed and pays nothing if it differs from the invoice
  whose quotes `getPayReq` loaded; `getPayReq` clears the previous invoice's quotes
  first (#5137).
- **Token extraction from URL wrappers** (`CashuUtils.extractTokenString`): a greedy regex
  `cashu[AB][0-9A-Za-z+/_=-]+` pulls a token out of any wrapper (zeusln.com/e/,
  wallet.cashu.me, nutstash, etc.) and stops at URL noise like `&memo=`; failing that it
  strips the known prefixes in `cashuTokenPrefixes`
  (`https://wallet.nutstash.app/#`, `https://wallet.cashu.me/?token=`, `web+cashu://`,
  `cashu://`, `cashu:`).
- **P2PK DoS guards**: P2PK-locked tokens carry attacker-controlled JSON in proof secrets.
  `safeParseP2PKSecret` rejects secrets over `MAX_P2PK_SECRET_LENGTH = 2048` chars or
  nested deeper than `MAX_P2PK_SECRET_DEPTH = 10` (bracket-scan before `JSON.parse`).
  Keep these guards when touching token parsing.

## 8. NWC (NIP-47) — Zeus plays BOTH roles

- **Wallet service** (`stores/NostrWalletConnectStore.ts`): Zeus exposes its own node to
  external apps. Each connection has an optional **budget**
  (`budgetAmount`/`budgetRenewal` with `BudgetRenewalType`, periodic resets via
  `checkAndResetAllBudgets`, capped by wallet balance `maxBudgetLimit`). Staying reachable
  in the background is the hard part: on iOS the store drives a **background-audio
  keep-alive** (`utils/IOSAudioKeepAliveUtils.ts`, bundled silent m4a) that auto-starts
  whenever at least one connection exists; Android uses a foreground service. This store
  is a known hotspot (~4400 lines, about a third of its statements tested); see `zeus-debugging-playbook` before
  touching it.
- **Client backend** (`backends/NostrWalletConnect.ts`): Zeus can itself be a thin client
  driving a remote NWC wallet, via `@getalby/sdk`'s `NostrWebLNProvider` constructed from
  the node's `nostr+walletconnect://` URL. Capability surface is minimal (no keysend, no
  on-chain, no channels — see the `supports*` block at the bottom of the file). Quirk:
  NWC `makeInvoice` returns only `paymentRequest`, so `createInvoice` back-fills
  `payment_hash` by decoding the bolt11 with `Bolt11Utils`.

## 9. Swaps — Boltz protocol v2, `stores/SwapStore.ts`

Zeus speaks the Boltz v2 REST API, but no longer against Boltz itself: the default
provider is SATS Routing (`DEFAULT_SWAP_HOST_MAINNET = 'https://satsrouting.exchange/v2'`
in `stores/SettingsStore.ts`), with Coinos (`https://swap.coinos.io/v2`) and Custom
selectable. Both run `boltz-backend`, so the wire protocol is unchanged. Endpoints used
(relative to the `/v2` host): `GET /swap/submarine` and `GET /swap/reverse` (pairs and
fees), `POST /swap/submarine` and `POST /swap/reverse` (create), `GET /swap/<id>`
(status), `GET /swap/submarine/<id>/transaction`, `GET /swap/reverse/<id>/transaction`
(lockup), `GET /swap/submarine/<id>/claim` (cooperative claim, `views/Swaps/SwapDetails.tsx`),
`POST /chain/BTC/transaction` (broadcast fallback after the mempool API's `/tx`),
`POST /swap/restore`, and the `/ws` websocket (`swapWebSocketUrl`). Native claim and
refund code (boltz-client) gets the host with `/v2` stripped (`nativeSwapEndpoint`).

Retired hosts are moved to the current default by `MigrationUtils`, and each generation
has its own mechanism:

- `swaps.zeuslsp.com`, the former ZEUS default (`LEGACY_ZEUS_SWAP_HOST_*`), is rewritten
  by `applySwapHostsToBoltz` in the settings-version 1 block.
- Eldamar Swaps is in `RETIRED_SWAP_HOSTS_MAINNET`, applied by `applyRetiredSwapHosts` in
  the version 1 block.
- Boltz, which suspended its swap service on 2026-08-03, and SwapMarket, whose API is
  gated behind a secret ZEUS cannot hold, are in `RETIRED_SWAP_HOSTS_MAINNET_V2`, applied
  by `applyRetiredSwapHosts` in the version 2 block.

A later retirement takes a new list under a new version gate rather than extending one of
these, so a finished version's migration never re-runs.

**Deterministic rescue key** — the design goal is that a single mnemonic can recover any
in-flight swap:

- The rescue key is a BIP-39 mnemonic stored under `swaps-rescue-key`
  (`SWAPS_RESCUE_KEY` in `utils/SwapUtils.ts`). `generateRescueKey` **always generates
  a fresh, independent mnemonic**, on every backend including ldk-node (`03979d766`). It
  never reuses the wallet seed, because restore sends the swap master xpub to the
  provider, and an xpub from the wallet seed would expose the wallet's own key tree.
- Per-swap keys derive at **`m/44/0/0/0/<index>`** (`DERIVATION_PATH = 'm/44/0/0/0'`,
  `getPath(index)` appends the index; last used index persisted under
  `swaps-last-used-key`).
- **Reverse-swap preimage = `sha256(child privkey)`** (`derivePreimageFromRescueKey`) —
  so preimages never need separate backup; the mnemonic regenerates them.
- **Restore**: `getRescuableSwaps` derives an xpub from the mnemonic and POSTs it to
  `<host>/swap/restore`; the server returns swaps whose keys belong to that xpub.

**Provider responses are verified before funds move** (`utils/SwapUtils.ts`,
`stores/SwapStore.ts`):

- `verifySubmarineSwapResponse` (#5125): the claim leaf pays the server key against our
  invoice's payment hash, the refund leaf pays our key after the stated timeout (at most
  `MAX_SUBMARINE_SWAP_TIMEOUT_BLOCKS = 4320`), the address is the taproot output of
  exactly that tree, and `expectedAmount` is not above what the Swaps screen showed.
- `verifyReverseSwapInvoice`: the provider's invoice has our preimage hash and the
  expected amount.
- `verifyReverseSwapResponse` (#5139): the claim leaf pays our key against our preimage
  hash, the refund leaf pays the server key, the lockup address matches the tree, and
  `onchainAmount` is a whole positive number at least the amount shown plus the claim
  fee. At creation SwapStore also refuses an `onchainAmount` not above the claim fee
  (`lockup-below-claim-fee`) and a refund deadline fewer than
  `MIN_REVERSE_SWAP_CLAIM_BLOCKS = 6` blocks away (`verifyReverseSwapDeadline`). The
  claim fee rate is decided at creation and stored (`claimFeeRate`, #5126).
- Before the claim reveals the preimage, `verifyReverseLockup` re-checks the tree and
  looks up the lockup transaction on the user's mempool instance: it must be confirmed,
  pay the swap's output script at least the expected amount, be unspent, and be at least
  6 blocks from the refund deadline. For rescued swaps and swaps created before the
  amount check (v13.2.2, v13.2.3), the floor comes from what this wallet paid: the
  invoice amount (#5010) and `rescuedLockupFloor` (`RESCUED_SWAP_MIN_LOCKUP_PERCENT = 90`
  percent of the payment); a shortfall needs the user to confirm the amount.

## 10. On-chain: address types, PSBT/coin control, CPFP, fees

- **Address types** (`views/Receive.tsx`, values are LND `AddressType` enum strings):
  `'0'` = p2wkh (native SegWit, `bc1q...`, the default), `'1'` = np2wkh (nested SegWit,
  `3...`, shown only if `supportsNestedSegWit()`), `'4'` = p2tr (**taproot**, `bc1p...`,
  shown only if `supportsTaproot()` — LND-family gates this at node ≥ v0.15.0).
- **Coin control / PSBT**: a **UTXO** is an unspent output; **coin control** means picking
  which UTXOs fund a transaction; a **PSBT** (Partially Signed Bitcoin Transaction) is the
  interchange format for building/signing across devices. `stores/UTXOsStore.ts` lists
  UTXOs and on-chain accounts; `BackendUtils.fundPsbt`/`finalizePsbt` dispatch to capable
  backends (`supportsCoinControl()`: LND-family ≥ v0.12.0, CLNRest, LdkNode, and LNC
  — gated on the session's `permNewAddress` permission). Scanned/pasted
  PSBTs and raw tx hex route to the `PSBT` / `TxHex` screens via `handleAnything.ts`.
- **CPFP bump with the output-index flip** (`stores/FeeStore.ts`,
  `bumpFeeOpeningChannel`): **CPFP** (child-pays-for-parent) accelerates a stuck funding
  tx by spending its change output at a high fee. Zeus parses `outpoint` as
  `txid:output_index`, tries the bump, and if LND answers
  `"the passed output does not belong to the wallet"` it **retries once with the index
  flipped (0↔1)** — the channel-open change output is at whichever index the funding
  output isn't. Comment in code: only works for single-party-funded channels. Force-close
  bumps go through `bumpForceCloseFee` (no flip retry).
- **Fee estimation**: `FeeStore.getOnchainFeesviaMempool` fetches
  `<UrlUtils.getMempoolApiUrl()>/v1/fees/recommended` (fastest/halfHour/hour/economy).
  The instance is `settings.privacy.mempoolInstance`: default `DEFAULT_MEMPOOL_INSTANCE
  = 'electrs.zeusln.com'` (also used when unset), or `mempool.space`, or `Custom`
  (`customMempoolInstance`, used on every network). Without Custom, testnet uses
  `https://mempool.space/testnet/api` and mutinynet `https://mutinynet.com/api`. The
  response passes through `sanitizeRecommendedFees` (`utils/FeeUtils.ts`); an
  implausible one is rejected and the store sets `error`. Backend-native estimators
  exist per backend but the fee picker UI is driven by this endpoint.

## 11. `utils/handleAnything.ts` — the universal input router

Every scanned QR, pasted string, deep link, and NFC payload goes through
`handleAnything(data, setAmount?, isClipboardValue?)`. It returns a
`[screenName, params]` navigation tuple — or, in **clipboard mode**
(`isClipboardValue = true`, used to decide whether to show the "paste detected" prompt),
**plain booleans** (`true` = recognized, `false` = not) from most detectors. Caveat:
several detectors (PSBT, `zeuscontact:`, TxHex, account imports, bare Cashu tokens,
BOLT12 withdrawal requests) have no `isClipboardValue` check and return the
navigation tuple even in clipboard mode — callers must treat any truthy return as
"recognized". New detectors should add the boolean guard. Don't mix up
the two return shapes.

**Detector ORDER is load-bearing.** It is one giant if/else chain; earlier detectors
shadow later ones. Current order (verified):

1. BIP-21 URI unpack (`AddressUtils.processBIP21Uri`) + multiple-payment-method choice
2. CLINK noffer → `ClinkPay`; BOLT12 offer → `Send`
3. On-chain address (+ optional embedded lightning param) → `Send`/`Accounts`
4. Lightning pubkey → keysend `Send`; BOLT11 → `PaymentRequest` (or
   `ChoosePaymentMethod` when ecash enabled); BOLT12 offer string → `Send`; bare
   `noffer1...` → `ClinkPay`
5. **PSBT** → `PSBT` (#5175, `48cc9b496`). A PSBT's base64 text can contain any
   substring, so it is checked before the detectors below that search the text
   (`clnrest+`, `lndconnect`, `findlnurl`).
6. Node-connection strings (clnrest://, nostr+walletconnect://, LNC pairing, lndconnect,
   LNDHub) → `WalletConfiguration`
7. Node URI (`pubkey@host`) → `OpenChannel` (without `supportsChannelManagement()`:
   error, and no clipboard suggestion); lightning address (LUD-16, with BOLT12 DNS
   probe and the cryptoqr.net casing exception, section 4)
8. BTCPay pairing config
9. **Web-wrapped Cashu tokens BEFORE the LNURL detector**: an https URL containing a
   `cashu[AB]...` base64 body. The comment in the file is explicit: `findlnurl` can match
   bech32-like substrings INSIDE cashu tokens and misroute them; the base64 shape gate
   avoids swallowing URLs that merely contain the literal "cashuA" (e.g. `?ref=cashuAfrica`).
10. LNURL (findlnurl / decoded lnurl / `/lnurl|lnurlp|...` path regex) → tag dispatch
    (section 4)
11. npub / `zeuscontact:` → contacts; TxHex; account imports (xpub, descriptors,
    keystore JSON) gated by `supportsAccounts()`
12. Bare Cashu token (`isValidCashuTokenAsync`) → `CashuToken`
13. BOLT12 withdrawal requests (gated `supportsWithdrawalRequests()`)
14. **Merchant QR near-LAST** (`isMerchantQR`): South-African merchant payloads
    (Pick n Pay, Ecentric, SnapScan, Zapper...) are converted to `...@cryptoqr.net`
    lightning addresses and **recursively re-fed** into `handleAnything`. Guard:
    `MERCHANT_QR_MAX_LEN = 500` — the alternation-heavy regexes catastrophically
    backtrack and **overflow Hermes' regex stack** on long inputs (Hermes = React
    Native's JS engine), so anything longer is skipped. Keep this near the end: its
    regexes are greedy enough to steal inputs that earlier detectors parse precisely.
15. Fallback: WIF private-key sweep → `WIFSweeper`, else "not valid" error.

**When adding a detector**: place it as late as correctness allows, add clipboard-mode
boolean returns, cap regex input length if patterns use nested alternation, and add cases
to `utils/handleAnything.test.ts`.

## 12. One-liners

- **CLINK / noffer** (`utils/ClinkUtils.ts`): `noffer1...` bech32-TLV payment codes
  resolved over nostr — kind-`21001` (`CLINK_KIND`) NIP-44-encrypted request/response with
  a 30 s default timeout (`DEFAULT_TIMEOUT_MS = 30_000`); `.onion` relays are explicitly
  refused (`ONION_NOT_SUPPORTED`) rather than silently leaking clearnet traffic.
- **Watchtowers** (LND-family only): a watchtower watches the chain for old-state channel
  breaches while you're offline. `BackendUtils` dispatches
  `listWatchtowers`/`addWatchtower`/etc.; `supportsWatchtowerClient()` is true on
  LND, EmbeddedLND, and LNC, false/absent elsewhere (absent methods dispatch to `false` —
  see `zeus-backends-and-capabilities`).

## Provenance and maintenance

Facts verified **2026-07-06** against master `c5fd094fb` (v13.1.3-alpha) by reading the
implementing files directly. Sections 2 (duplicate tags), 3 (fee limits, send guard),
4, 6, 7 (melt success rules), 9 (endpoints, rescue key, response verification), 10 (fee
estimation) and 11 were re-verified
**2026-10-24** against master `3dc9f83e6`. No commands below mutate anything.

| Volatile fact | Re-verify with |
| --- | --- |
| Bolt11 LRU size / lazy getters | `grep -n "CACHE_LIMIT\|defineLazyRecoveryFields" utils/Bolt11Utils.ts` |
| Keysend TLV constants | `grep -n "5482373484\|34349334" stores/TransactionsStore.ts` |
| `max_parts` defaults `'1'` vs `'16'` | `grep -n "max_parts" stores/TransactionsStore.ts views/PaymentRequest.tsx` |
| Routing fee 5% / 1000-sat threshold | `grep -n "DEFAULT_ROUTING_FEE_PERCENT\|1000" utils/FeeUtils.ts` |
| MPP/AMP version gates | `grep -rn "supportsMPP\|supportsAMP" backends/` |
| cryptoqr.net casing exception, merchant QR 500-char cap | `grep -n "isCryptoQR\|MERCHANT_QR_MAX_LEN" utils/handleAnything.ts` |
| js-lnurl version | `grep js-lnurl package.json` |
| ZEUS Pay host, address types | `grep -n "LNURL_HOST\|address_type" stores/LightningAddressStore.ts` |
| LSPS0 message type 37913 / 7 s timeout | `grep -n "CUSTOM_MESSAGE_TYPE\|TIMEOUT_MS" stores/LSPStore.ts` |
| Flow amount mutation + jit_bolt11 swap | `grep -n "zeroConfFee\|jit_bolt11" stores/InvoicesStore.ts` |
| Flow/LSPS1 default hosts, resolver | `grep -n "DEFAULT_LSP\|getLspConfigForNetwork" stores/SettingsStore.ts` |
| LSP own-quote pricing, hard fail, LNURL-withdraw fee confirm | `grep -n "lspQuote\|confirmLspFee\|LSP_FEE_QUOTE_MAX_AGE_MS\|hard-fail" stores/InvoicesStore.ts` |
| Wrapped invoice checks | `grep -n "fail('" utils/LspUtils.ts` |
| LSPS transport flags per backend | `grep -rn "supportsLSPS" backends/*.ts \| grep -v test` |
| Cashu raw MPP melt endpoint | `grep -n "melt/quote/bolt11" stores/CashuStore.ts` |
| Cashu token prefixes / P2PK limits | `grep -n "cashuTokenPrefixes\|MAX_P2PK" utils/CashuUtils.ts` |
| Cashu seed versions | `grep -n "v2-bip39\|originalSeedVersion" stores/CashuStore.ts` |
| NWC client SDK | `head -20 backends/NostrWalletConnect.ts` |
| Swap rescue key is always fresh | `grep -n -A10 "generateRescueKey = " stores/SwapStore.ts` |
| Swap response verification | `grep -n "export const verify\|MIN_REVERSE_SWAP_CLAIM_BLOCKS\|RESCUED_SWAP_MIN_LOCKUP_PERCENT" utils/SwapUtils.ts` |
| Swap hosts / path / preimage derivation | `grep -n "DEFAULT_SWAP_HOST" stores/SettingsStore.ts; grep -n "DERIVATION_PATH\|derivePreimageFromRescueKey\|swap/restore" stores/SwapStore.ts` |
| Mempool fee instance, sanitizer | `grep -n "DEFAULT_MEMPOOL_INSTANCE" stores/SettingsStore.ts; grep -n "sanitizeRecommendedFees" utils/FeeUtils.ts stores/FeeStore.ts` |
| BOLT11 duplicate-tag rules | `grep -n "paymentHashSeen\|HASH_TAG_WORDS\|No valid payment hash" utils/Bolt11Utils.ts` |
| LNURL verification helpers | `grep -n "^export const" utils/LnurlPayUtils.ts` |
| CPFP output-index flip | `grep -n "does not belong" stores/FeeStore.ts` |
| Address type values 0/1/4 | `grep -n "value: '0'\|value: '1'\|value: '4'" views/Receive.tsx` |
| CLINK kind / timeout | `grep -n "CLINK_KIND\|DEFAULT_TIMEOUT_MS" utils/ClinkUtils.ts` |
| Watchtower support matrix | `grep -rn "supportsWatchtowerClient" backends/` |
| Detector chain order | read the if/else chain in `utils/handleAnything.ts` top to bottom |

Labeled uncertainties: none of the facts above are speculative; server-side behavior of
zeuspay.com / the swap providers / flow.zeuslsp.com and lsps1.zeuslsp.com is described only as far as the client code
shows (request/response shapes) — API contracts are not versioned in this repo.
