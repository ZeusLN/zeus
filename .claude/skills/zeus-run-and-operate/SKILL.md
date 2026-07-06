---
name: zeus-run-and-operate
description: Load when you need to RUN Zeus — start Metro / yarn android / yarn ios, decide whether to restart Metro or rebuild the native app, connect a dev node (Polar, Android emulator 10.0.2.2, macaroon/rune/pairing-phrase/NWC credentials, mutinynet), or perform release operations — ./build.sh reproducible Android Docker build, verify a release APK hash, per-ABI versionCode, PGP-signed commits, "Version bump:" convention, workflow_dispatch-only CI builds, iOS Xcode workspace and its ShareQR/NWCWidget extension targets. Symptoms — "app won't reflect my change", "connection refused from emulator", "how do I verify the APK", "how do releases work".
---

# Zeus: Run and Operate

Runbook for running the app in development, connecting it to a Lightning node, and performing release/reproducible-build operations. Verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha).

## When to use / When NOT to use

USE this skill when you are:
- Starting the app in dev (Metro, emulator, simulator, physical device).
- Deciding "restart Metro or rebuild the native app?" after a change.
- Connecting Zeus to a node in dev (Polar, testnet, mutinynet) or picking which of the 7 backend types to configure.
- Building or verifying a release APK, or answering questions about the release process (versioning, signing, tags).

Do NOT use it for these — load the named sibling instead:

| Need | Sibling skill |
|---|---|
| Recreating the dev environment from scratch, postinstall chain, native binary fetching, vendoring | zeus-build-and-env |
| Per-backend quirks, `supports*` capability gating, adding an RPC | zeus-backends-and-capabilities |
| App misbehaves at runtime (crashes, hangs, wrong data) | zeus-debugging-playbook |
| `yarn verify`, tests, CI check anatomy | zeus-validation-and-qa |
| PR/commit/review rules, what changes are gated | zeus-change-control |
| Settings axes and their defaults | zeus-config-and-flags |

This skill assumes dependencies are already installed (`yarn install` succeeded, including its postinstall chain). If `yarn install` itself fails or native binaries are missing, that is zeus-build-and-env territory.

## 1) Dev run anatomy

Term definitions (once): **Metro** is React Native's JavaScript bundler/dev server — it serves your TS/JS code to the app over HTTP and hot-swaps it ("Fast Refresh"). The **native app** (Java/Kotlin/Swift/ObjC/Rust/Go code plus the React Native runtime) is compiled separately by Gradle (Android) or Xcode (iOS) and only changes when you rebuild it.

Commands (all verified in `package.json` scripts):

```bash
yarn start        # start Metro (react-native start)
yarn android      # build + install + launch on Android emulator/device (react-native run-android)
yarn ios          # build + install + launch on iOS simulator (react-native run-ios)
yarn ra           # alias for yarn android
yarn ri           # alias for yarn ios
```

Notes:
- `yarn android`/`yarn ios` auto-start Metro if it is not running; running `yarn start` in its own terminal first gives you a persistent log window (README's recommended flow).
- iOS can also be run from Xcode: open `ios/zeus.xcworkspace` (the WORKSPACE, not `zeus.xcodeproj` — CocoaPods requires the workspace) and hit Run. See section 4.
- Helper scripts: `yarn gradlew <task>` (runs `./gradlew` inside `android/`), `yarn android:clean` (deletes `android/app/.cxx`, `android/build`, then `gradlew clean`) for corrupted-native-build situations.
- Faster Android debug builds: the debug build type honors `-PreactNativeDebugArchitectures=arm64-v8a` (Gradle property read in `android/app/build.gradle`) to compile only one ABI.

### Restart Metro vs rebuild native — decision table

| You changed... | Action |
|---|---|
| `.ts`/`.tsx` app code, `locales/en.json` | Nothing — Fast Refresh picks it up. Shake device / Cmd+R to force reload |
| `metro.config.js`, `babel.config.js` | Restart Metro: `yarn start --reset-cache` |
| Added a pure-JS npm dependency | `yarn install`, then restart Metro |
| Added/updated a dependency with native code, or anything in `android/`, `ios/`, `patches/`, `fetch-libraries-versions.json`, `zeus_modules/` native parts | **Rebuild native**: `yarn install` (re-runs the postinstall patch/fetch chain — see zeus-build-and-env), then `yarn android` / `cd ios && pod install && cd ..` + `yarn ios` |
| `proto/*.proto` | `yarn gen-proto`, then reload |

Rule of thumb: if the change lives outside the JS bundle (native module, patch, binary, Gradle/Podfile config), Metro cannot deliver it — rebuild. Mysterious "my change does nothing" symptoms after touching native deps are almost always a missing rebuild.

## 2) Connecting a node in dev

CONTRIBUTING.md recommends [Polar](https://github.com/jamaljsr/polar) for a quick local Lightning dev environment (spins up bitcoind + LND/CLN nodes in Docker with a GUI that shows each node's connection credentials).

**Android emulator networking (top dev trap):** the emulator's `127.0.0.1` is the emulator itself, not your machine. When configuring a node in dev on the Android emulator, the Host field MUST be `10.0.2.2` (the emulator's alias for the host machine). Stated in CONTRIBUTING.md. iOS simulator shares the host network, so `127.0.0.1` works there.

Create wallets in-app: Menu → Settings-equivalent wallet list → add wallet (`views/Settings/WalletConfiguration.tsx`). The implementation dropdown offers exactly these 7 (from `INTERFACE_KEYS` in `stores/SettingsStore.ts`):

| Implementation (`value`) | UI label | Type | Credentials you need |
|---|---|---|---|
| `ldk-node` | LDK Node | On-device | None — mnemonic generated in-app (network + optional esplora/RGS/VSS server overrides) |
| `embedded-lnd` | Embedded LND | On-device | None — seed generated in-app (network choice; optional recovery seed + channel-backup base64) |
| `lnd` | LND (REST) | Remote | Host, port, macaroon in **hex** (a macaroon is LND's bearer-token auth credential; convert with `xxd -ps -u -c 1000 admin.macaroon`, per docs/RemoteConnections.md — Polar shows the hex directly) |
| `lightning-node-connect` | LND (Lightning Node Connect) | Remote | LNC pairing phrase (word phrase issued by litd/Terminal) + mailbox server (default `mailbox.terminal.lightning.today:443`; `lnc.zeusln.app:443` and custom also offered) |
| `cln-rest` | Core Lightning (CLNRest) | Remote | Host, port, rune (CLN's auth token format, replaces macaroons) |
| `nostr-wallet-connect` | Nostr Wallet Connect | Remote | A single `nostr+walletconnect://` connection URL from an NWC-capable wallet/service |
| `lndhub` | LNDHub | Remote (custodial) | LNDHub server URL + username + password, or paste an `lndhub://user:pass@url` URI; can also create a new account on the server |

Remote configs also carry per-node `certVerification` and `enableTor` toggles. For per-backend behavior differences and `supports*` capability gating, load zeus-backends-and-capabilities — do not assume a feature exists on all 7.

### Embedded wallet networks

Both on-device implementations pick a network at creation (`EMBEDDED_NODE_NETWORK_KEYS`): `mainnet`, `testnet`, `mutinynet`. **Mutinynet** is a custom public Signet test network (Zeus points its esplora default at `https://mutinynet.com/api`) — inside LDK Node it is mapped to network type `signet` (`getNetworkType` in `utils/LdkNodeUtils.ts`). Caveat verified in `WalletConfiguration.tsx`: the network dropdown for NEW embedded-lnd wallets filters out `mutinynet`; only `ldk-node` offers all three. Remote nodes have no network setting — the network is detected from the node itself.

## 3) Release operations (Android)

Everything in this section verified by reading `build.sh`, `android/app/build.gradle`, `android/gradle.properties`, `.github/workflows/build-android.yml`, and `docs/ReproducibleBuilds.md`. The build itself is verified by source read, not executed here.

### Reproducible build via ./build.sh

`./build.sh` (repo root) runs the whole Android release build inside Docker — requires only Docker, no local Android SDK:

```bash
./build.sh            # interactive terminal
./build.sh --no-tty   # CI / non-interactive (only flag the script accepts)
```

What it does (all in `build.sh`):
- Docker image pinned **by sha256 digest**: `reactnativecommunity/react-native-android@sha256:c390bfb...` (comment says tag 18.0). Digest pinning = byte-identical toolchain for every builder.
- Exports `SOURCE_DATE_EPOCH` (default `0`, overridable via env) so embedded timestamps are deterministic.
- Mounts the repo at `/olympus/zeus`, runs `yarn install --frozen-lockfile`, then `./gradlew generateCodegenArtifactsFromSchema && ./gradlew app:assembleRelease`.
- Renames `app-*-release-unsigned.apk` → `zeus-*.apk` and prints `sha256sum` for each to stdout (hashes are printed, not written to a file).

Reproducibility support in the Gradle config: `org.gradle.parallel=false` in `android/gradle.properties` (comment: parallel execution causes non-deterministic file ordering) and `reproducibleFileOrder = true` / `preserveFileTimestamps = false` on all Zip tasks in `android/app/build.gradle`.

### Outputs

5 APKs land in `android/app/build/outputs/apk/release/` (paths confirmed by the artifact steps in `.github/workflows/build-android.yml`):

`zeus-armeabi-v7a.apk`, `zeus-arm64-v8a.apk`, `zeus-x86.apk`, `zeus-x86_64.apk`, `zeus-universal.apk`

All **unsigned** — the release build type's `signingConfig` line is commented out in `android/app/build.gradle`. APK = Android package file; ABI = CPU architecture a binary targets; the "universal" APK bundles all four ABIs and is the one distributed on the website/GitHub releases.

### Per-ABI versionCode

From `android/app/build.gradle` (`versionCodeOverride`): each ABI split gets `versionCode = base * 1000 + {armeabi-v7a: 1, x86: 2, arm64-v8a: 3, x86_64: 4}`; the universal APK keeps the base. At v13.1.3-alpha the base is `131`, so: armeabi-v7a 131001, x86 131002, arm64-v8a 131003, x86_64 131004, universal 131.

### How a user verifies a release

Per `docs/ReproducibleBuilds.md`:
1. `git clone --depth 1 --branch vX.Y.Z https://github.com/ZeusLN/zeus.git && cd zeus`
2. `./build.sh` — compare the printed sha256 of `zeus-universal.apk` against the hash on the [GitHub releases page](https://github.com/ZeusLN/zeus/releases).
3. Against the officially distributed (signed) APK, unpack both and diff (`diffoscope`, `apksigcopier`, or `diff --brief --recursive`): the ONLY expected differences are the signing certificates.
4. To install your own build you must sign it yourself (`apksigner` + your own keystore, procedure in the same doc) and uninstall the store version first — certificates won't match, and reinstalling loses local connection details.

### CI workflows are manual-only

`.github/workflows/build-android.yml` (runs `bash ./build.sh --no-tty` on ubuntu, Node 24.x, uploads the 5 APKs as artifacts, 5-day retention) and `.github/workflows/dependency-scan.yml` (GuardDog + npm-scan) are both `workflow_dispatch:`-only — they take a branch input and never run on push/PR. PR CI is only the 4 verify checks (see zeus-validation-and-qa).

### PGP signing

Commits and releases are signed with the key published in `PGP.txt` (repo root): RSA-4096, fingerprint `96C225207F2137E278C31CF7AAC48DE8AB8DEE84` (short key ID `AAC48DE8AB8DEE84`), UIDs "Zeus LN <zeusln@tutanota.com>" and "ZEUS Support <support@zeusln.com>", currently expiring 2027-10-21. Verify a commit: `git log --show-signature -1 <hash>`. Note: git tags are **lightweight** (they point straight at commits — `git tag -v` fails with "cannot verify a non-tag object"), with one historical annotated exception (`v0.10.2-rc2`); signature verification therefore happens on the tagged commit, not the tag object.

### What is OUT of this repo (do not look for it here)

- **Release APK signing keys / keystore.** `MYAPP_RELEASE_STORE_FILE` etc. appear as optional Gradle properties but the release build type does not use them; official signing happens outside the repo.
- **Store upload pipeline** (Google Play, App Store, zeusln.com hosting) — no workflow or script in-repo performs uploads.
- **Who can dispatch** `build-android.yml` — GitHub org permission, not visible in-repo.
- **iOS release pipeline** — entirely out-of-repo (see section 4).

## 4) iOS operations

- **No reproducible builds for iOS** — `docs/ReproducibleBuilds.md` explicitly says Android only.
- Run/build via Xcode: open `ios/zeus.xcworkspace`, select the `zeus` scheme, hit Run (after `cd ios && pod install`).
- Targets in `ios/zeus.xcodeproj` you WILL encounter (don't be surprised when Xcode asks about signing for each):
  - `zeus` — the app.
  - `ShareQR` — a **share extension** (app-extension product type): lets users share an image from another app into Zeus; it scans it for a QR code, writes the result into app group `group.com.zeusln.zeus`, and opens `zeusln://share` (`ios/ShareQR/ShareViewController.swift`).
  - `NWCWidget` — a **widget extension** hosting the NWC Live Activity (ActivityKit lock-screen/Dynamic Island UI for the Nostr Wallet Connect background service; `ios/NWCWidget/`).
  - `zeus-tvOS` — present in the project file (React Native template leftover); not a distributed product.
- Extension targets need their own provisioning when building on-device; on simulator they build without special setup.

## 5) Operational conventions

- **Version bump commits**: subject is exactly `Version bump: vX.Y.Z[-suffix]` (e.g. `Version bump: v13.1.3-alpha`, current HEAD `c5fd094fb`). The maximal file set a bump commit touches is 4: `package.json` `version`, `android/app/build.gradle` `versionName` (+ `versionCode` when incremented), `ios/zeus.xcodeproj/project.pbxproj` `MARKETING_VERSION` (all build configs), and the version list in `.github/ISSUE_TEMPLATE/bug_report.yml` — but not every bump touches all 4. Observed at `c5fd094fb`: the pbxproj and bug_report.yml entries only change when the suffix-less base version changes (i.e. on the post-release `-alpha` bump, e.g. `c5fd094fb`); beta/rc/final bumps typically touch only `package.json` + `build.gradle` (e.g. `a2dc04ab8` v13.1.2, `8b45b4111` v13.1.1-beta1 — 2 files each).
- **Cadence** (observed in `git log --grep='Version bump'`): after a release, master is bumped to the next `-alpha`; a release line then walks `-alpha → -beta1… → -rc1… → final` (e.g. v13.1.0-alpha → beta1 → beta2 → rc1 → v13.1.0). Master effectively always sits on an `-alpha` (or in-flight beta/rc) version.
- **Tags**: one tag per shipped version (`v13.1.2` etc., 269 tags at time of writing), lightweight with one historical annotated exception (`v0.10.2-rc2`), usually pointing at the version-bump commit — but not always (`v13.1.1` points at a non-bump commit, and final-release bump commits may sit on release branches rather than master). Signing lives on the commit (PGP key above), not the tag.
- Release-time discipline (revert-first near releases, mandatory 2-platform manual testing) is owned by zeus-change-control — read it before touching anything during a release window.

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha, versionCode 131). `./build.sh` execution itself verified by source read (build.sh + build-android.yml), not executed. Re-verification one-liners for volatile facts:

| Fact | Re-verify with |
|---|---|
| yarn scripts (`start`/`android`/`ios`/`ra`/`ri`, `android:clean`, `gen-proto`) | `python3 -c "import json;print(json.load(open('package.json'))['scripts'])"` |
| Docker image digest, SOURCE_DATE_EPOCH default, `--no-tty` | `head -30 build.sh` |
| `org.gradle.parallel=false` | `grep parallel android/gradle.properties` |
| Unsigned release + per-ABI versionCode map + reproducible Zip settings | `grep -n 'signingConfig\|versionCodeOverride\|versionCodes\|reproducibleFileOrder' android/app/build.gradle` |
| Current versionCode/versionName | `grep -n 'versionCode \|versionName' android/app/build.gradle` |
| 5 APK names/paths | `grep 'path:' .github/workflows/build-android.yml` |
| Workflows dispatch-only | `grep -A2 '^on:' .github/workflows/build-android.yml .github/workflows/dependency-scan.yml` |
| 7 implementations + labels | `grep -n -A14 'INTERFACE_KEYS' stores/SettingsStore.ts \| head -25` |
| Embedded networks + mutinynet filter | `grep -n 'EMBEDDED_NODE_NETWORK_KEYS\|mutinynet' stores/SettingsStore.ts views/Settings/WalletConfiguration.tsx utils/LdkNodeUtils.ts` |
| Android emulator host 10.0.2.2 / Polar | `grep -n '10.0.2.2\|Polar' CONTRIBUTING.md` |
| PGP key/fingerprint/expiry | `gpg --show-keys PGP.txt` |
| Version-bump convention + cadence | `git log --oneline -15 --grep='Version bump'` |
| Tags lightweight | `git cat-file -t v13.1.2` (prints `commit`) |
| LNC mailbox defaults | `grep -n -A8 'LNC_MAILBOX_KEYS' stores/SettingsStore.ts` |
| iOS extension targets | `grep -B2 'app-extension' ios/zeus.xcodeproj/project.pbxproj` |
