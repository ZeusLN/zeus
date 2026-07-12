---
name: zeus-config-and-flags
description: Catalog of every Zeus configuration axis and the add-a-setting checklist. Load when you need to add/change/remove a user setting or flag, find where a setting lives (settings blob key, per-node vs global, nested group vs top-level), look up a default value (theme, routing fee, LSP/swap/esplora/RGS/VSS URLs, neutrino peers, invoice expiry), change a default for existing users, work in views/Settings/* or stores/SettingsStore.ts, or answer "why does a fresh install behave differently from a migrated one" (bimodalPathfinding, showMillisatoshiAmounts). Keywords: settings, defaults, updateSettings, zeus-settings-v2, certVerification, enableLSP, DropdownSetting, feature flag, deprecated setting, MOD_KEY, per-node config, embeddedLndNetwork, ldkNetwork, mutinynet.
---

# Zeus Config and Flags

Every user-facing configuration axis in Zeus: where it lives, its options, its default, and the exact checklist for adding or changing a setting. Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha). Defaults drift — re-verify with the commands in the final section before relying on any specific value.

## When to use / When NOT to use

USE this skill when you are:
- Adding a new setting/flag, or changing an existing one (checklist below is mandatory).
- Looking up any default value or the full option list for a settings axis.
- Deciding whether config belongs per-node (`settings.nodes[]`) or global.
- Debugging "my setting change wiped other settings" (shallow-merge trap) or "fresh installs behave differently from upgraded installs" (new-vs-migrated divergence).

Do NOT use this skill for:
- The keychain storage contract, the `zeus-settings-v2` blob mechanics, migration recipes, or iCloud rules → **zeus-storage-and-migrations** (that skill owns the storage layer; this one owns the catalog of what is stored).
- Which backends support which features (`supports*()` gating) → **zeus-backends-and-capabilities**.
- The change-approval process for storage-format changes → **zeus-change-control**. Anything that changes what is persisted (new keys, changed defaults for existing users, removed fields) requires maintainer sign-off plus a migration plan — never route around that.
- Boot sequence / how settings are loaded at startup → **zeus-architecture-contract**.

## Glossary (terms used below, defined once)

| Term | Meaning |
|---|---|
| settings blob | One JSON object holding almost all config AND all wallet secrets, persisted in the device keychain under key `zeus-settings-v2` (see zeus-storage-and-migrations for the contract) |
| keychain | OS secure credential store (iOS Keychain / Android Keystore), accessed via `storage/index.ts` |
| AsyncStorage | React Native's plain, unencrypted key-value store — non-sensitive UI flags only |
| macaroon | LND's bearer-token credential (hex-encoded here) authorizing REST API calls |
| rune | Core Lightning's equivalent bearer-token credential |
| LNC | Lightning Node Connect — LND remote-control protocol using a human-readable "pairing phrase" and a relay ("mailbox") server |
| NWC | Nostr Wallet Connect (NIP-47) — wallet control over the Nostr protocol via a `nostr+walletconnect://` URL |
| embedded node | A Lightning node running inside the app: `embedded-lnd` (LND compiled via gomobile) or `ldk-node` (LDK Node via Rust FFI) |
| LSP | Lightning Service Provider — sells inbound channels. "Flow" is Olympus's zero-conf JIT-channel API; LSPS1/LSPS7 are standardized channel-purchase specs |
| esplora | Blockstream-style HTTP block-explorer API used by LDK Node for chain data |
| RGS | Rapid Gossip Sync — pre-digested Lightning network-graph snapshots for LDK |
| VSS | Versioned Storage Service — remote encrypted storage for LDK channel state |
| neutrino | LND's light-client chain backend (BIP157/158); "peers" are the btcd nodes it syncs from |
| EGS / speedloader | Express Graph Sync — pre-baked graph download for embedded LND |
| mutinynet | A custom signet (test network with 30s blocks) run by Mutiny; LDK treats it as `signet` |
| Cashu / ecash | Chaumian ecash tokens issued by "mints"; Zeus embeds a Cashu wallet on embedded backends |
| POS | Point of Sale mode (merchant checkout UI), standalone or Square-integrated |
| zero-conf | Accepting a channel/payment before on-chain confirmation |
| MOD_KEY migration | One-shot settings mutation flagged by a key in legacy EncryptedStorage so it runs exactly once per install (recipe owned by zeus-storage-and-migrations) |

## 1) Where config lives

| Location | Key(s) | What | Defined in |
|---|---|---|---|
| Keychain blob | `zeus-settings-v2` (`STORAGE_KEY`) | Everything in the `Settings` interface: all groups below + `nodes[]` + secrets (PINs, seeds, macaroons) | `stores/SettingsStore.ts` |
| Keychain, separate | `zeus-units-v2` (`UNIT_KEY`) | Display units; default `'sats'` | `stores/UnitsStore.ts` |
| Keychain, separate | `zeus-favorite-currencies` (`FAVORITE_CURRENCIES_KEY`) | Starred fiat currencies (JSON array) | `stores/SettingsStore.ts` |
| Keychain, separate | `zeus-currency-codes` (`CURRENCY_CODES_KEY`) | Cached currency-code list | `stores/SettingsStore.ts` |
| Keychain, separate | `zeus-activity-filters-v2` (`ACTIVITY_FILTERS_KEY`) | Activity-list filters | `stores/ActivityStore.ts` |
| AsyncStorage | `persistentServicesEnabled` | Embedded-LND persistent background services (Android) | `views/Settings/EmbeddedNode/Advanced.tsx`, `views/PendingHTLCs.tsx` |
| AsyncStorage | `persistentLdkNodeServicesEnabled` | LDK Node persistent background services | `views/Settings/EmbeddedNode/index.tsx` (`PERSISTENT_LDK_KEY`) |
| AsyncStorage | `persistentNWCServicesEnabled` (`NWC_PERSISTENT_SERVICE_ENABLED`) | NWC wallet-service persistence | `stores/NostrWalletConnectStore.ts` |

Rules of thumb:
- Secrets and anything financial → the blob (keychain). Non-sensitive UI-only flags → AsyncStorage. Never put new data in legacy `react-native-encrypted-storage` (migration flags only).
- Any NEW persisted keychain key must be registered in three registries (`utils/DataClearUtils.ts` STORAGE_KEYS, `utils/KeychainRecoveryUtils.ts` OTHER_KEYS, `MigrationUtils.keychainCloudSyncMigration` migrationKeys) or it leaks on wallet clear/recovery — full recipe in **zeus-storage-and-migrations**.

Critical load semantics (verified in `SettingsStore.getSettings`): when a stored blob exists, `this.settings = parsedSettings` REPLACES the entire inline-default object. There is NO deep merge of defaults into stored blobs. Consequence: a newly added field is `undefined` for every existing user until they touch its UI control — every consumer must tolerate that (`settings?.group?.field ?? fallback`, or `||` fallbacks like `getLspConfigForNetwork` uses).

## 2) Per-node axes — `settings.nodes[]` + `settings.selectedNode`

Each wallet is a `Node` object (interface in `stores/SettingsStore.ts`). `selectedNode` is the array index of the active wallet. On load/switch, `updateNodeProperties` copies the selected node's fields onto flat observables (`this.host`, `this.implementation`, ...) that the rest of the app reads.

| Field | Applies to | Notes |
|---|---|---|
| `implementation` | all | One of 7: `'embedded-lnd' \| 'ldk-node' \| 'lnd' \| 'lightning-node-connect' \| 'cln-rest' \| 'lndhub' \| 'nostr-wallet-connect'`. Falls back to `'lnd'` when unset. Picker labels in `INTERFACE_KEYS` |
| `host`, `port`, `url` | remote REST | Node endpoint |
| `macaroonHex` | lnd | LND REST credential |
| `rune` | cln-rest | CLN credential |
| `accessKey` | lndhub | LNDHub access key |
| `certVerification` | remote REST | **Default `false`** (UI initial state and `updateNodeProperties` fallback). SECURITY: `false` → `trusty: !certVerification` in `backends/LND.ts`, i.e. TLS certificate validation is DISABLED by default for remote node connections (accepted because self-signed node certs are the norm). Turning it on requires installing the node's cert (`views/Settings/CertInstallInstructions.tsx`). The separate Tor `.onion` TLS rule is owned by zeus-backends-and-capabilities |
| `enableTor` | remote | Route requests through Tor |
| `pairingPhrase`, `mailboxServer`, `customMailboxServer` | lightning-node-connect | Mailbox options in `LNC_MAILBOX_KEYS` (`mailbox.terminal.lightning.today:443` \| `lnc.zeusln.app:443` \| custom) |
| `nostrWalletConnectUrl` | nostr-wallet-connect | The NWC pairing URL (note the field name — it is NOT `nwcUrl`) |
| `seedPhrase`, `walletPassword`, `adminMacaroon` | embedded-lnd | Wallet secrets, plaintext in the blob |
| `embeddedLndNetwork` | embedded-lnd | Stored values are CAPITALIZED `'Mainnet'`/`'Testnet'` (code compares `=== 'Mainnet'`), while the creation picker uses lowercase `EMBEDDED_NODE_NETWORK_KEYS` values — a real casing trap. Mutinynet is filtered OUT of the picker for new embedded-lnd wallets (`WalletConfiguration.tsx` filters `k.value !== 'mutinynet'`) |
| `lndDir` | embedded-lnd | Per-wallet data dir; new wallets get a uuid, absent → falls back to `'lnd'` |
| `isSqlite` | embedded-lnd | Database backend: `false` = Bolt DB (default, `?? false`), `true` = SQLite. Picker: "bolt"/"sqlite" in WalletConfiguration |
| `ldkNetwork` | ldk-node | Picker shows all of `mainnet \| testnet \| mutinynet` (lowercase). `mutinynet` maps to LDK network `signet` via `getNetworkType` in `utils/LdkNodeUtils.ts`. The `SupportedNetwork` type also includes `'signet'` and `'regtest'` but neither has UI exposure (types-only, as of 2026-07-06) |
| `ldkNodeDir`, `ldkMnemonic`, `ldkPassphrase` | ldk-node | Data dir (`ldk-node/<uuid>`) + wallet secrets |
| `ldkEsploraServer` | ldk-node | Default per network via `getDefaultEsploraServer` — mainnet `https://electrs.zeusln.com` |
| `ldkRgsServer` | ldk-node | Mainnet default `https://rgs.zeusln.com/snapshot`, testnet `https://rapidsync.lightningdevkit.org/testnet/snapshot`, none for signet/mutinynet |
| `ldkScorerUrl` | ldk-node | Default `https://scores.zeusln.com/latest.bin` (`DEFAULT_SCORER_URL`) |
| `ldkVssServer` | ldk-node | Default `https://vss.zeusln.com/vss` (`DEFAULT_VSS_SERVER`) |
| `nickname`, `photo`, `dismissCustodialWarning` | all | Cosmetics + custodial-warning dismissal |

Quirks:
- LNDHub credentials (`username`, `password`, `lndhubUrl`) are read by `updateNodeProperties` via an `any` cast but are NOT declared on the `Node` interface — grep for them before assuming the interface is complete.
- Remote nodes have NO network field; network is detected from `getinfo` at connect time. Only embedded wallets choose a network.
- Per-node editing UI: `views/Settings/WalletConfiguration.tsx` (single 3000+ line view handling all 7 implementations); wallet list: `views/Settings/Wallets.tsx`.

## 3) Global settings catalog

All defaults below are the inline initializer of `@observable settings: Settings` in `stores/SettingsStore.ts` (currently starting near line 1467 — search `@observable settings: Settings =`). "Nested" groups are replaced wholesale by `updateSettings` (see checklist); "flat" keys sit at the blob top level.

### Top-level scalars (flat)

| Axis | Options | Default | UI | Stability |
|---|---|---|---|---|
| `pin`, `passphrase`, `duressPin`, `duressPassphrase` | strings | unset | `views/Settings/SetPin.tsx`, `SetPassword.tsx`, `SetDuressPin.tsx`, `SetDuressPassword.tsx` | production — stored PLAINTEXT in the blob (keychain is the security boundary; do not "fix" by hashing without maintainer sign-off) |
| `scramblePin` | bool | `true` | `views/Settings/Security.tsx` | production |
| `loginBackground` | bool | `false` | Security.tsx | production |
| `isBiometryEnabled` / `supportedBiometryType` | bool / detected enum | `false` / `undefined` | Security.tsx | production |
| `authenticationAttempts` | number | unset | incremented by `views/Lockscreen.tsx` on failed login | internal counter, not a user toggle |
| `fiatEnabled` | bool | `true` | `views/Settings/Currency.tsx` | production |
| `fiat` | 101 entries in `CURRENCY_KEYS` (99 fiat currencies plus XAU/XAG; one commented-out KWD entry inflates a naive `grep -c "key:"` to 102 — count with `grep -c '^        key:'`) | `'USD'` (`DEFAULT_FIAT`) | Currency.tsx / SelectCurrency.tsx | production |
| `fiatRatesSource` | `'Zeus' \| 'Yadio'` (`FIAT_RATES_SOURCE_KEYS`) | `'Zeus'` | Currency.tsx | production |
| `locale` | 33 ISO codes in `LOCALE_KEYS` | unset → English. NOTE: exported `DEFAULT_LOCALE = 'English'` is a STALE pre-ISO-migration constant; do not copy it | `views/Settings/Language.tsx` | production |
| `selectNodeOnStartup` | bool | `false` | surfaced in `views/Settings/Display.tsx` | production |
| `lndHubLnAuthMode` | `'BlueWallet' \| 'Alby'` (`LNDHUB_AUTH_MODES`) | unset; `views/LnurlAuth.tsx` state defaults to `'Alby'` | LnurlAuth.tsx | production |
| `justDeletedWallet` | bool | unset | internal flag consumed by `views/Settings/Wallets.tsx` | internal |

### `privacy` (nested) — UI: `views/Settings/Privacy.tsx`, `views/Settings/StealthMode.tsx`

| Axis | Options | Default |
|---|---|---|
| `defaultBlockExplorer` | `mempool.space \| blockstream.info \| Custom` (`BLOCK_EXPLORER_KEYS`) + `customBlockExplorer` | `'mempool.space'` |
| `clipboard` | bool (auto-detect clipboard contents) | `true` |
| `lurkerMode` | bool (hide balances; `SettingsStore.toggleLurker` reveals for 3s then re-hides) | `false` |
| `enableMempoolRates` | bool (fetch fee rates from mempool.space) | `true` |
| `stealthMode` | bool — Android only (activity-alias app disguises) | `false` |
| `stealthApp` | `'zeus' \| 'calculator' \| 'vpn' \| 'qrscanner' \| 'notepad'` | `'calculator'` |
| `stealthPinLength` | number of unlock taps | `5` |
| `stealthVpnCountry` / `stealthVpnServer` | strings (VPN-disguise unlock combo) | `'Switzerland'` / `'Geneva'` |

### `display` (nested) — UI: `views/Settings/Display.tsx`

| Axis | Options | Default |
|---|---|---|
| `theme` | 23 themes in `THEME_KEYS` | `'kyriaki'` (`DEFAULT_THEME`) |
| `defaultView` | `'Keypad' \| 'Balance'` (`DEFAULT_VIEW_KEYS`) | `'Keypad'` |
| `displayNickname` | bool | `false` |
| `bigKeypadButtons` | bool | `false` |
| `showAllDecimalPlaces` | bool | `false` |
| `removeDecimalSpaces` | bool | `false` |
| `showMillisatoshiAmounts` | bool | `false` fresh — but `true` for legacy-migrated users (MOD_KEY `millisat_amounts`); see §5 |

### `payments` (nested) — UI: `views/Settings/PaymentsSettings.tsx`

| Axis | Options | Default |
|---|---|---|
| `defaultFeeMethod` | `'fixed' \| 'percent'` | `'fixed'` — DEPRECATED (see §4) |
| `defaultFeePercentage` | string percent | `'5.0'` — the 5% routing-fee limit. Companion rule (verified `utils/FeeUtils.ts`): amounts ≤ 1000 sats allow up to 100% fee (`calculateDefaultRoutingFee`) |
| `defaultFeeFixed` | string sats | `'1000'` |
| `timeoutSeconds` | string | `'60'` |
| `preferredMempoolRate` | `fastestFee \| halfHourFee \| hourFee \| minimumFee` (`MEMPOOL_RATES_KEYS`) | `'fastestFee'` |
| `slideToPayThreshold` | number sats — payments above it require slide-to-confirm | `10000` (`DEFAULT_SLIDE_TO_PAY_THRESHOLD`) |
| `enableDonations` / `defaultDonationPercentage` | bool / number | `false` / `5` |

### `invoices` (nested) — UI: `views/Settings/InvoicesSettings.tsx`

| Axis | Options | Default |
|---|---|---|
| `addressType` | on-chain address type code | `'0'` |
| `memo`, `receiverName` | strings | `''` |
| `expiry` + `timePeriod` + `expirySeconds` | display value + `TIME_PERIOD_KEYS` unit + canonical seconds | `'1'` / `'Hours'` / `'3600'`. This TRIPLET must stay mutually consistent — `MigrationUtils.migrateInvoiceExpiryDisplay` repairs drift on both load paths ("3600 hours" bug, #4149). Never update one field alone |
| `routeHints` | bool | `false` |
| `ampInvoice` | bool (AMP = LND's Atomic Multi-Path invoices) | `false` |
| `blindedPaths` | bool (receiver-privacy routes) | `false` |
| `showCustomPreimageField` | bool | `false` |
| `displayAmountOnInvoice` | bool | `false` — DEPRECATED |
| `defaultInvoiceType` | `'unified' \| 'lightning'` (`DEFAULT_INVOICE_TYPE_KEYS`) | `'lightning'` |

### `channels` (nested) — UI: `views/Settings/ChannelsSettings.tsx`

| Axis | Options | Default |
|---|---|---|
| `min_confs` | number (confirmations for funding inputs) | `1` |
| `privateChannel` | bool (unannounced channel) | `true` |
| `scidAlias` | bool (short-channel-id alias, needed for private-channel invoices) | `true` |
| `simpleTaprootChannel` | bool (experimental taproot channel type) | `false` |

### Embedded-node group — FLAT top-level keys — UI: `views/Settings/EmbeddedNode/*`

| Axis | Options | Default |
|---|---|---|
| `automaticDisasterRecoveryBackup` | bool (channel-backup upload) | `true` |
| `expressGraphSync` | bool (EGS download) | `false` |
| `resetExpressGraphSyncOnStartup` | bool | `false` |
| `bimodalPathfinding` | bool (LND bimodal payment-probability model) | `true` fresh — but forced `false` for legacy-migrated users (MOD_KEY `bimodal-bug-9085`, lnd issue #9085); see §5 |
| `graphSyncPromptNeverAsk` / `graphSyncPromptIgnoreOnce` | bool | `false` / `false` |
| `dontAllowOtherPeers` | bool (restrict neutrino to listed peers) | `false` |
| `neutrinoPeersMainnet` | string[] | `DEFAULT_NEUTRINO_PEERS_MAINNET` (5 peers: `btcd1.lnolymp.us`, `btcd2.lnolymp.us`, `btcd-mainnet.lightning.computer`, `node.eldamar.icu`, `noad.sathoarder.com`); regional alternates in `SECONDARY_NEUTRINO_PEERS_MAINNET` |
| `neutrinoPeersTestnet` | string[] | 3 peers (`testnet.lnolymp.us`, `btcd-testnet.lightning.computer`, `testnet.blixtwallet.com`) |
| `zeroConfPeers` | string[] pubkeys allowed to open zero-conf channels | `[]` |
| `rescan`, `compactDb`, `recovery` | bool one-shot startup flags | `false` |
| `initialLoad` | bool | `true` |
| `embeddedTor` | bool (run embedded LND over Tor) | `false` |
| `feeEstimator` + `customFeeEstimator` | `FEE_ESTIMATOR_KEYS` (lightning.computer \| strike.me \| Custom) | `https://nodes.lightning.computer/fees/v1/btc-fee-estimates.json` (`DEFAULT_FEE_ESTIMATOR`) |
| `speedloader` + `customSpeedloader` | `SPEEDLOADER_KEYS` (ZEUS \| Blixt \| Custom) | `https://egs.lnze.us/` (`DEFAULT_SPEEDLOADER`) |

### LSP group — FLAT top-level keys — UI: `views/Settings/LSP.tsx`, `views/Settings/LSPServicesList.tsx`

Per-network TRIPLETS (mainnet/testnet/mutinynet). The canonical resolver is `getLspConfigForNetwork(settings, network)` in `stores/SettingsStore.ts` — it accepts a network string or NodeInfo-style flags, and treats `'signet'` as testnet. Always use it; never read the triplet fields directly.

| Axis | Default |
|---|---|
| `enableLSP` | `true` |
| `lspMainnet` / `lspTestnet` / `lspMutinynet` (Olympus Flow hosts) | `https://0conf.lnolymp.us` / `https://testnet-0conf.lnolymp.us` / `https://mutinynet-flow.lnolymp.us` |
| `lspAccessKey` | `''` |
| `requestSimpleTaproot` | `true` |
| `lsps1RestMainnet` / `...Testnet` / `...Mutinynet` | `https://lsps1.lnolymp.us` / `https://testnet-lsps1.lnolymp.us` / `https://mutinynet-lsps1.lnolymp.us` |
| `lsps1PubkeyMainnet` / `...Testnet` / `...Mutinynet` | Olympus node pubkeys (see `DEFAULT_LSPS1_PUBKEY_*` consts) |
| `lsps1HostMainnet` / `...Testnet` / `...Mutinynet` | `45.79.192.236:9735` / `139.144.22.237:9735` / `45.79.201.241:9735` |
| `lsps1Token` | `''` |
| `lsps1ShowPurchaseButton` | unset — DEPRECATED |

### `swaps` (nested) — UI: `views/Swaps/Settings.tsx` (note: under views/Swaps/, not views/Settings/)

| Axis | Options | Default |
|---|---|---|
| `hostMainnet` | `SWAP_HOST_KEYS_MAINNET`: ZEUS (`https://swaps.zeuslsp.com/api/v2`), Boltz, SwapMarket, Eldamar Swaps, Custom | ZEUS host (`DEFAULT_SWAP_HOST_MAINNET`) |
| `hostTestnet` | `SWAP_HOST_KEYS_TESTNET`: ZEUS, Boltz, Custom | `https://testnet-swaps.zeuslsp.com/api/v2` |
| `customHost` | string | `''` |
| `proEnabled` | bool — unlocks `pro: true` hosts (Boltz mainnet, Custom) | `false` |

### `lightningAddress` (nested) — UI: `views/LightningAddress/LightningAddressSettings.tsx` (+ Cashu/NWC variants under `views/Cashu/LightningAddress/`, `views/LightningAddress/NWCAddressSettings.tsx`)

| Axis | Options | Default |
|---|---|---|
| `enabled` | bool (ZEUS Pay address) | `false` |
| `automaticallyAccept` | bool | `true` |
| `automaticallyAcceptAttestationLevel` | `0 \| 1 \| 2` (`AUTOMATIC_ATTESTATION_KEYS`: disabled / success only / success+not-found) | `2` |
| `automaticallyRequestOlympusChannels` | bool | `false` — DEPRECATED |
| `routeHints` | bool | `false` |
| `allowComments` | bool | `true` |
| `zapReceiptsEnabled` | bool (Nostr zap receipts) | `true` |
| `nostrPrivateKey` | string | `''` |
| `nostrRelays` | string[] | `DEFAULT_NOSTR_RELAYS` (8 relays; the older 3-relay list survives as `DEFAULT_NOSTR_RELAYS_2023` for migration) |
| `notifications` | `0 \| 1 \| 2` (`NOTIFICATIONS_PREF_KEYS`: disabled / push / nostr) | `0` |
| `mintUrl` | string (Cashu-type address mint) | `''` |
| `posEnabled` | bool — ZEUS Pay+ web POS | `false` (newer, treat as experimental) |

### `bolt12Address` (nested) — UI: `views/Settings/Bolt12Address.tsx`

Single axis: `localPart` (string, default `''`) — username for a BOLT12 offer-based address (CLN/LDK backends).

### `ecash` (nested) — UI: `views/Settings/EcashSettings.tsx`

| Axis | Options | Default |
|---|---|---|
| `enableCashu` | bool | `false` |
| `enableMultiMint` | bool (NUT-15 multi-mint payments) | `false` |
| `automaticallySweep` | bool (sweep ecash to LN balance) | `false` |
| `sweepThresholdSats` | number | `10000` |
| `initialMintUrls` | string[] | unset (optional) |

Cashu is only available on embedded backends — gating rules live in **zeus-backends-and-capabilities**.

### `pos` (nested) — UI: `views/Settings/PointOfSale.tsx`

| Axis | Options | Default |
|---|---|---|
| `posEnabled` | `'disabled' \| 'square' \| 'standalone'` (`PosEnabled` enum / `POS_ENABLED_KEYS`) | `'disabled'` |
| `squareEnabled` | bool | `false` — DEPRECATED (migrated into `posEnabled`) |
| `squareAccessToken` / `squareLocationId` / `squareDevMode` | Square API config | `''` / `''` / `false` |
| `merchantName`, `taxPercentage` | strings | `''` |
| `confirmationPreference` | `'0conf' \| '1conf' \| 'lnOnly'` (`POS_CONF_PREF_KEYS`) | `'lnOnly'` |
| `disableTips` | bool | `false` |
| `showKeypad` | bool | `true` |
| `enablePrinter` | bool | `false` |
| `defaultView` | `'Products' \| 'POS Keypad'` (`DEFAULT_VIEW_KEYS_POS`) | `'Products'` |

### `networking` (nested) — UI: `views/Settings/Networking.tsx`

Single axis: `disableOfflineCheck` (bool, default `false`) — skips the connectivity probe before requests.

### Not a setting: developer mode

There is NO developer-mode toggle. Developer tools are gated purely by `supportsDevTools()` in `utils/BackendUtils.ts` (`isLNDBased() || this.call('supportsDevTools')` — LND-based backends, plus any backend that implements `supportsDevTools`, currently LndHub and CLNRest). Don't invent a settings flag for it.

## 4) Deprecated-but-retained flags

All five are marked `// deprecated` in `stores/SettingsStore.ts` and MUST stay in the type + defaults:

| Flag | Group | Why it can't be casually deleted |
|---|---|---|
| `defaultFeeMethod` | payments | Still read as a fallback by `views/Settings/PaymentsSettings.tsx` (`feeLimitMethod`); present in every existing blob |
| `displayAmountOnInvoice` | invoices | Present in existing blobs; type removal breaks migration code paths |
| `squareEnabled` | pos | `MigrationUtils.legacySettingsMigrations` still reads it to migrate old installs to `posEnabled` (and its test fixtures reference it) |
| `automaticallyRequestOlympusChannels` | lightningAddress | Still explicitly written `false` by `stores/LightningAddressStore.ts` and `utils/MigrationUtils.ts` |
| `lsps1ShowPurchaseButton` | LSP (flat) | Present in existing blobs; optional field |

General rule: removing a persisted field is a storage-format change. Old blobs keep the field forever; migration code and its tests reference it; and TypeScript on those paths breaks if the type disappears. Removal requires the gated process in **zeus-change-control** plus a migration plan per **zeus-storage-and-migrations**.

## 5) New-vs-migrated divergences (document yours if you create one)

Because MOD_KEY migrations in `MigrationUtils.legacySettingsMigrations` run only for users upgrading from the legacy `zeus-settings` blob, some settings intentionally differ between fresh installs and migrated installs:

| Setting | Fresh install | Legacy-migrated | Cause |
|---|---|---|---|
| `bimodalPathfinding` | `true` (inline default) | `false` | MOD_KEY `bimodal-bug-9085` disables it for existing users while lnd issue #9085 stands |
| `display.showMillisatoshiAmounts` | `false` (inline default) | `true` | MOD_KEY `millisat_amounts` opted existing users in |

If your change creates such a divergence, it must be stated in the PR description and added to this table.

## 6) ADD-A-SETTING CHECKLIST

Follow every step; skipping any one has caused real bugs (data loss via shallow merge, "3600 hours" display corruption, leaked keys).

1. **Choose the home.**
   - Per-wallet behavior → new field on the `Node` interface (`stores/SettingsStore.ts`).
   - Global, thematically grouped → the matching nested group interface (`PrivacySettings`, `PaymentsSettings`, ...).
   - Global, embedded-node/LSP-style → flat top-level key on `Settings`.
   - Non-sensitive UI-only flag that shouldn't live in the secrets blob → AsyncStorage (see §1 examples).
2. **Type it** in `stores/SettingsStore.ts`. Prefer optional (`field?:`) — existing blobs won't have it (see §1 load semantics).
3. **Add the inline default** in the `@observable settings: Settings = {...}` initializer (search for it; near line 1467 as of 2026-07-06). Remember this default only applies before a stored blob loads — every reader still needs a fallback for `undefined`.
4. **If it's an enumerated axis**, add an exported `*_KEYS` array (key/value/translateKey objects) next to the other pickers so DropdownSetting UIs and tests can consume it.
5. **Build the UI** in the matching `views/Settings/*.tsx` (or per-node in `WalletConfiguration.tsx`). When persisting, use the shallow-merge-safe pattern — `SettingsStore.updateSettings` merges ONLY the top level, so nested groups are replaced wholesale:
   ```ts
   await updateSettings({
       payments: {
           ...settings.payments, // MANDATORY spread — omitting it silently
           myNewField: value     // destroys every sibling payments setting
       }
   });
   ```
   Flat top-level keys (`updateSettings({ enableLSP: false })`) are safe without a spread.
6. **Locale strings**: add English copy to `locales/en.json` ONLY (the other 33 locale files are Transifex-managed — rule owned by **zeus-change-control**). Reference via `localeString('views.Settings.<...>')`.
7. **Changing an existing default for existing users?** That is a storage-format change: write a one-shot MOD_KEY migration (recipe, ordering, and `setSettings`-with-a-real-object rules in **zeus-storage-and-migrations**) and note that it must run on the modern `zeus-settings-v2` load path (like `migrateRgsDefaultToZeus`), not only inside `legacySettingsMigrations`. Maintainer sign-off required.
8. **Creating a fresh-vs-migrated divergence?** Document it (§5).
9. **New separate keychain key** (not in the blob)? Register it in the three registries (§1) — recipe in **zeus-storage-and-migrations**.
10. **Verify**: `yarn verify` (test + prettier + tsc + lint) and fill in the PR template's backend-testing matrix — details in **zeus-validation-and-qa** / **zeus-change-control**.

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by reading `stores/SettingsStore.ts`, `utils/MigrationUtils.ts`, `utils/LdkNodeUtils.ts`, `utils/FeeUtils.ts`, `utils/BackendUtils.ts`, `backends/LND.ts`, `stores/UnitsStore.ts`, `stores/ActivityStore.ts`, `stores/NostrWalletConnectStore.ts`, and `views/Settings/*`. Defaults are volatile — re-verify before citing:

| Volatile fact | Re-verification command |
|---|---|
| Inline defaults block location + every default value | `grep -n '@observable settings: Settings' stores/SettingsStore.ts` then read the initializer |
| Blob key / out-of-blob keys | `grep -rn "STORAGE_KEY\|UNIT_KEY\|FAVORITE_CURRENCIES_KEY\|CURRENCY_CODES_KEY\|ACTIVITY_FILTERS_KEY = " stores/` |
| AsyncStorage flag names | `grep -rn "persistentServicesEnabled\|persistentLdkNodeServicesEnabled\|persistentNWCServicesEnabled" stores views` |
| 7 implementations + picker labels | `grep -n "Implementations =" -A 8 stores/SettingsStore.ts && grep -n "INTERFACE_KEYS" -A 12 stores/SettingsStore.ts` |
| certVerification default + TLS implication | `grep -n "certVerification: false" views/Settings/WalletConfiguration.tsx && grep -n "trusty" backends/LND.ts` |
| Theme count + default | `sed -n '/THEME_KEYS/,/^];/p' stores/SettingsStore.ts \| grep -c "key:"` and `grep -n "DEFAULT_THEME" stores/SettingsStore.ts` |
| Locale count | `sed -n '/LOCALE_KEYS = /,/^];/p' stores/SettingsStore.ts \| grep -c "key:"` and `ls locales/*.json \| wc -l` |
| Routing-fee default + ≤1000-sat rule | `grep -n "defaultFeePercentage\|DEFAULT_ROUTING_FEE_PERCENT" stores/SettingsStore.ts utils/FeeUtils.ts` |
| LSP/LSPS1 triplets + signet→testnet | `grep -n "DEFAULT_LSP\|DEFAULT_LSPS1\|signet" stores/SettingsStore.ts` |
| Swap hosts | `grep -n "SWAP_HOST_KEYS\|DEFAULT_SWAP_HOST" stores/SettingsStore.ts` |
| LDK server defaults + mutinynet→signet | `grep -n "DEFAULT_VSS_SERVER\|DEFAULT_SCORER_URL\|rgs.zeusln\|electrs.zeusln\|case 'mutinynet'" utils/LdkNodeUtils.ts` |
| Neutrino peer lists | `grep -n "DEFAULT_NEUTRINO_PEERS" -A 8 stores/SettingsStore.ts` |
| Deprecated flags still present | `grep -n "deprecated" stores/SettingsStore.ts` |
| MOD_KEY list (divergences) | `grep -n "MOD_KEY" utils/MigrationUtils.ts` |
| Mutinynet filtered from embedded-lnd picker | `grep -n "mutinynet" views/Settings/WalletConfiguration.tsx` |
| embeddedLndNetwork capitalization | `grep -rn "embeddedLndNetwork === 'Mainnet'" views/ \| head -3` |
| No dev-mode toggle | `grep -n "supportsDevTools" utils/BackendUtils.ts` |
