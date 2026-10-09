# Threat model

## What this project does

ZEUS is a self-custodial Bitcoin and Lightning wallet for Android and iOS, written in TypeScript with React Native. It runs in one of two modes:

- Embedded node: the app runs its own Lightning node on the phone (LND via `lndmobile/`, or LDK Node via `ldknode/`) and holds the seed and keys. It also holds Cashu ecash through the CDK bindings in `cashu-cdk/`.
- Remote node manager: the app connects to a node the user runs elsewhere (LND REST, Core Lightning REST, Lightning Node Connect, LndHub, Nostr Wallet Connect) and holds the credentials for it (macaroons, runes, pairing phrases, NWC secrets).

`backends/` contains one class per backend and `utils/BackendUtils.ts` dispatches calls to the active one. App state lives in MobX stores in `stores/`. Most parsing, validation, amount math and protocol logic lives in `utils/`, and that is where most of the testable attack surface is.

The native node binaries (Lndmobile, LDK Node, CDK) are downloaded prebuilt by `fetch-libraries.sh` and are out of scope here; their source lives in other repositories.

## Where untrusted input enters

Treat all of the following as attacker-controlled:

- Anything scanned, pasted, shared into the app, read over NFC, or opened as a deep link. `utils/handleAnything.ts` routes this input to the right flow. Related code: `utils/LinkingUtils.ts`, `utils/ShareIntentProcessor.ts`, `utils/NFCUtils.ts`, `utils/BbqrUtils.ts`, `zeus_modules/ur`, `zeus_modules/bc-ur`, `zeus_modules/bc-bech32`.
- Payment data: BOLT11 invoices (`utils/Bolt11Utils.ts`), BOLT12 offers, BIP21 and BIP 353 payment instructions, on-chain addresses (`utils/AddressUtils.ts`), PSBTs (`views/PSBT.tsx`), WIF private keys for sweeps (`utils/WIFUtils.ts`), Cashu tokens and payment requests (`utils/CashuUtils.ts`, `stores/CashuStore.ts`), CLINK offers (`utils/ClinkUtils.ts`).
- Responses from third-party HTTP servers: LNURL pay, withdraw, auth and channel servers and Lightning address hosts (`utils/LnurlPayUtils.ts`, `stores/LnurlPayStore.ts`, `views/LnurlPay/`, `views/LnurlAuth.tsx`, `views/LnurlChannel.tsx`), swap providers that speak the Boltz protocol (`stores/SwapStore.ts`, `utils/SwapUtils.ts`), LSPs (`stores/LSPStore.ts`, `utils/LspUtils.ts`, `views/LSPS1/`, `views/LSPS7/`), Cashu mints, fiat rate and fee estimate services (`stores/FiatStore.ts`, `stores/FeeStore.ts`), and mempool/esplora explorers.
- Nostr events and relays, including Nostr Wallet Connect requests from client apps when ZEUS acts as an NWC service (`stores/NostrWalletConnectStore.ts`, `utils/NostrConnectUtils.ts`, `utils/NostrUtils.ts`).
- Responses from the user's own remote node. The node is trusted to hold the user's funds, but the transport to it may not be: a network attacker can sit in the path unless TLS verification or Tor protects it. Connection strings such as lndconnect and clnrest URIs (`utils/ConnectionFormatUtils.ts`, `utils/NodeConfigUtils.ts`) are attacker-controlled when scanned.

## What we protect

- Seeds, private keys, and preimages that can claim or refund funds (including swap preimages and refund keys).
- Credentials for remote nodes (macaroons, runes, LNC pairing phrases, NWC secrets, LndHub logins).
- The amount, destination and fee the user approves. The app must pay exactly what the confirmation screen showed: no wrong unit conversion (sats, msats, fiat), no silent change of destination, no fee above the limit the user set.
- Payment state shown to the user. Reporting a payment as sent or received when it was not is a security bug.
- The lock screen: PIN, passphrase, biometrics, and the duress PIN/password, which must wipe data (`utils/DataClearUtils.ts`, `views/Lockscreen.tsx`, `stores/SettingsStore.ts`).
- Privacy: when Tor is enabled, no request may go out over clearnet (`utils/TorUtils.ts`). Certificate verification settings for remote nodes must be honored (`certVerification` in `backends/LND.ts`, `backends/CLNRest.ts`).
- Persisted data: settings and secrets in the keychain and encrypted storage (`storage/`, `utils/MigrationUtils.ts`, `utils/KeychainRecoveryUtils.ts`). Data must not leak to other apps, to logs, or to iCloud/Android backups where the code says it should not.

## Components that matter most

1. `utils/handleAnything.ts` and every parser it reaches.
2. Send and receive flows and their amount math: `views/Send.tsx`, `views/PaymentRequest.tsx`, `utils/AmountUtils.ts`, `utils/UnitsUtils.ts`, `utils/FeeUtils.ts`.
3. Swaps (`stores/SwapStore.ts`, `utils/SwapUtils.ts`): claim, refund and lockup verification, where a malicious provider can steal funds.
4. LSP flows: verification that a wrapped invoice pays the user's own invoice minus the agreed fee.
5. Cashu: token parsing, mint trust, melt and mint quote handling.
6. NWC service mode: request authorization and spending budgets.
7. LNURL and Lightning address handling: domain binding for LNURL-auth, amount bounds, metadata and description hash checks.
8. Lock screen, duress and data wipe.
9. Logging: secrets must never reach logs or exported diagnostics.

Lower priority: UI layout, themes, locale files (`locales/`), and generated code (`proto/`).

## How to exercise it

The Docker image has dependencies installed and the native libraries fetched. The native Android and iOS apps are not built, and there is no Lightning node or network inside the scanner, so use Jest:

- `yarn test` runs the whole suite. `yarn test utils/Bolt11Utils.test.ts` runs one file.
- `yarn tsc` type-checks. `yarn lint` runs ESLint plus the style checks.
- Most `utils/` files and many stores have a `*.test.ts` next to them. A new test file next to the code under test is the expected way to show a reproducer. Native modules are mocked by the `@react-native/jest-preset` preset and by mocks inside each test file.

## How we rate severity

- Critical: loss or theft of funds without user error (for example a swap or LSP flow that lets the provider keep the user's money, or an input that makes the app pay a different amount or destination than it showed); disclosure of seeds, private keys or remote node admin credentials to a third party; remote code execution.
- High: a payment reported as successful when it failed, or the reverse, in a way that leads to loss; bypass of the PIN, passphrase or duress wipe by someone holding the unlocked or locked device; clearnet traffic while Tor is enabled; TLS verification not applied when the user enabled it; secrets written to logs or backups.
- Medium: privacy leaks that do not expose secrets (for example linking the user's IP to a payment without Tor); denial of service from untrusted input that crashes the app or makes a wallet unusable until reinstall.
- Low: crashes that recover on restart, issues that need a malicious remote node the user configured themselves with full trust, and UI spoofing that needs several unusual user actions.

Issues that need root or jailbreak on the user's device, or physical access to an unlocked phone with no app lock set, are out of scope.

## Reports and patches

Include a failing Jest test that reproduces the issue where possible, and a patch that makes it pass. Patches should be TypeScript that passes `yarn tsc`, `yarn lint` and `yarn prettier`. Name the backend(s) affected, since many bugs only apply to one of LND, embedded LND, LDK Node, LNC, Core Lightning, LndHub or NWC.

## Anything to leave alone

- Vulnerabilities in LND, Core Lightning, LDK, CDK or other upstream projects, unless ZEUS uses them in an unsafe way. Report those upstream.
- `proto/` is generated from the LND protobuf files. `zeus_modules/@lightninglabs` is vendored LNC code.
- Missing hardening that has no concrete attack (for example missing certificate pinning where the user disabled verification on purpose).
