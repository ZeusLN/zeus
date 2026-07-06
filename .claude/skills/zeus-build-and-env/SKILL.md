---
name: zeus-build-and-env
description: Load when setting up the Zeus dev environment from scratch, running yarn install / postinstall, or debugging build/toolchain failures. Triggers - "yarn install fails", "postinstall error", missing Lndmobile.aar / Lndmobile.xcframework / LDKNodeFFI / cdkFFI / zeusRestoreFFI, "checksum failed", fetch-libraries.sh, rn-nodeify, shim.js, pod install / CocoaPods errors, Gradle / Kotlin / NDK / minSdk questions, Xcode framework-not-found, autolinking / native module not found, MainApplication.kt package registration, zeus_modules / lnc-rn vendoring, uniffi binding version mismatch, gen-proto, Hermes or New Architecture build crashes.
---

# Zeus: Build and Environment

Zeus is a React Native (RN) Bitcoin/Lightning mobile wallet. This skill is the runbook for recreating the development environment from nothing, understanding the postinstall chain that assembles the native layer, and avoiding the traps that break builds.

Jargon quick-reference (terms used below):
- **LND**: Lightning Network Daemon — a Lightning node implementation. Zeus embeds a mobile build of it ("embedded LND") compiled with **gomobile** (Go-to-mobile compiler) into `Lndmobile.aar` (Android archive) / `Lndmobile.xcframework` (iOS multi-arch framework bundle).
- **LNC**: Lightning Node Connect — Lightning Labs' encrypted-tunnel protocol for reaching a remote LND node. Shares the same Lndmobile binary.
- **LDK Node**: a self-contained Lightning node library from the Lightning Dev Kit project; second embedded-node option. Rust, exposed via **uniffi** (Mozilla's Rust FFI binding generator that emits matching Kotlin/Swift wrapper source).
- **CDK**: Cashu Dev Kit — Rust library for Cashu ecash wallets, also uniffi-based.
- **Hermes**: Meta's JS engine for RN (enabled here). **New Architecture / Fabric**: RN's rewritten native rendering/bridge layer (enabled here).
- **CocoaPods / pod**: iOS dependency manager; `pod install` generates the Xcode workspace's dependency project.

## When to use / When NOT to use

Use this skill when you need to: install dependencies, understand or debug the postinstall chain, fix missing/failing native binaries, wire a new native module, or bring up a dev build on Android/iOS.

Do NOT use it for:
- Running the app day-to-day, connecting nodes, releases and reproducible builds (`build.sh`, Docker, APK signing) → **zeus-run-and-operate**
- `yarn verify` / jest / CI check anatomy, adding tests, `transformIgnorePatterns` details → **zeus-validation-and-qa**
- Runtime bugs once the app builds and boots → **zeus-debugging-playbook**
- Adding dependencies (requires maintainer discussion first), commit/PR rules → **zeus-change-control**
- Backend/RPC code structure → **zeus-backends-and-capabilities**; architecture rationale → **zeus-architecture-contract**

## 1) Prerequisites (verified 2026-07-06, master `c5fd094fb`, v13.1.3-alpha)

| Requirement | Value | Source of truth |
|---|---|---|
| Node.js | `>= 22.11.0` (package.json `engines`); CI uses Node `24.x` — prefer 24.x LTS to match CI | `package.json`, `.github/workflows/*.yml` |
| Package manager | Yarn classic (v1) — `yarn.lock` is "yarn lockfile v1"; CI runs `yarn install --frozen-lockfile` | `yarn.lock`, workflows |
| React Native | 0.85.3, New Architecture ON, Hermes ON | `package.json`, `android/gradle.properties` |
| Android | minSdk 28, compileSdk 36, targetSdk 36, buildTools 36.0.0, Kotlin 2.1.20, NDK 28.0.13004108, Gradle 9.3.1 | `android/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties` |
| iOS | Xcode (current version per RN 0.85 requirements — repo does not pin one), CocoaPods `>= 1.13` excluding 1.15.0/1.15.1, Ruby `>= 2.6.10` | `ios/Podfile`, `Gemfile` |
| Shell tools for fetch-libraries.sh | `curl`, `unzip`, `python3`, `sha256sum` (present on modern macOS at /sbin and on Linux) | `fetch-libraries.sh` |
| Docker | ONLY for reproducible release builds — not needed for dev (see zeus-run-and-operate) | `build.sh` |

There is no `.nvmrc`, no `.ruby-version`, no `.yarnrc`. CONTRIBUTING.md says "Node.js (LTS version)" — the hard floor is the `engines` field.

## 2) The postinstall chain (order matters)

`yarn install` triggers (`package.json` scripts.postinstall):

```
node patches/index.mjs && rn-nodeify --install crypto,stream,dgram --hack && yarn run fetch-libraries && pod-install
```

Run each step manually if you need to re-do part of it. Skipping the chain leaves unpatched node_modules, missing shims, and missing native binaries — the app will fail to compile or crash at boot.

### Step 1 — `node patches/index.mjs` (patch node_modules in place)

Four patches, each idempotent, each rewriting files inside `node_modules/` (so they must re-run after every install):

| Patch file | What it does | What breaks if skipped |
|---|---|---|
| `patches/patch-jcenter.mjs` | Replaces removed `jcenter()` Maven repo with `mavenCentral()` in `react-native-hce` and `react-native-securerandom` build.gradle files (jcenter was removed in Gradle 9) | Android Gradle sync fails resolving those two libraries |
| `patches/patch-native-event-emitter.mjs` | In RN's `NativeEventEmitter.js`, downgrades the iOS null-module `invariant()` throw to a `console.warn` (RN 0.83+ throws for deprecated modules loaded during React Refresh) | iOS dev builds crash/red-screen on refresh |
| `patches/patch-react-native-notifications.mjs` | Fully rewrites `FcmToken.java` in react-native-notifications — the upstream library uses `ReactInstanceManager`, unsupported in New Architecture bridgeless mode | Android push-token handling fails to compile / crashes under New Arch |
| `patches/patch-noble-hashes.mjs` | Adds `./crypto.js` to every `@noble/hashes` package.json `exports` map so Metro can resolve deep imports | Metro bundler "module not found" for @noble/hashes/crypto.js |

### Step 2 — `rn-nodeify --install crypto,stream,dgram --hack` (Node core-module shims)

rn-nodeify makes Node.js core modules (crypto, stream, dgram) usable in React Native. It **regenerates**:
- the `react-native` and `browser` alias maps at the bottom of `package.json` (crypto → react-native-crypto, stream → stream-browserify, dgram → react-native-udp, `tls: false`, readable-stream aliases)
- `shim.js` at the repo root (global Buffer/process polyfills), imported by `index.js`

**Trap: hand edits to those alias maps or to `shim.js` are clobbered on the next `yarn install`.** If skipped: Metro fails to resolve `crypto`/`stream` imports and the app crashes at JS boot.

### Step 3 — `yarn run fetch-libraries` = `bash fetch-libraries.sh` (native binaries)

Downloads the pre-built native binaries that are gitignored (see `.gitignore` lines for `Lndmobile.aar`, `Lndmobile.xcframework`, `cashudevkit.aar`, `cdkFFI.xcframework`, `zeus-cashu-restore.aar`, `zeusRestoreFFI.xcframework`, `jniLibs/`, `LDKNodeFFI.xcframework`). All versions and SHA256 hashes live in **`fetch-libraries-versions.json`** — when bumping a binary, change version AND sha256 there, never inside the script.

Versions pinned at time of writing:

| Artifact | Version | Android destination | iOS destination |
|---|---|---|---|
| embedded LND (`ZeusLN/lnd` release) | `v0.20.1-beta-zeus.1` | `android/lndmobile/Lndmobile.aar` | unzipped to `ios/LncMobile/Lndmobile.xcframework` (yes, **Lnc**Mobile — see §4) |
| LDK Node (`ZeusLN/ldk-node` release) | `v0.7.0-zeus-pathfinder-config` | `.so` files unzipped into `android/app/src/main/jniLibs/<abi>/libldk_node.so` | `ios/LdkNodeMobile/LDKNodeFFI.xcframework` |
| CDK (`cashubtc/cdk-kotlin` / `cdk-swift` releases) | `0.14.2` | `android/cdk/cashudevkit.aar` | `ios/Cdk/cdkFFI.xcframework` |
| zeus-cashu-restore (`ZeusLN/zeus-cashu-restore` release) | `0.1.0` | `android/zeus-restore/zeus-cashu-restore.aar` | `ios/ZeusRestore/zeusRestoreFFI.xcframework` |

Behavior and caveats (all verified by reading the script):
- **SHA256 enforcement**: embedded-LND and LDK Node downloads hard-fail (`exit 1`) on checksum mismatch, always.
- **Empty-hash skip caveat**: for `cdk` and `zeus-cashu-restore` ONLY, the checksum check is wrapped in `[ -n "$SHA256" ]` — if the hash field in `fetch-libraries-versions.json` is an empty string, verification is **skipped** and the script just prints the downloaded file's hash. All four hash fields are currently non-empty; never blank one to "fix" a checksum failure.
- **Unchecked binding-source downloads**: the script also `curl`s uniffi **source** bindings with NO checksum: `ios/CashuDevKit/CashuDevKit.swift` (from cdk-swift tag), `ios/CashuDevKit/zeus_cashu_restore.swift` and `android/app/src/main/java/uniffi/zeus_cashu_restore/zeus_cashu_restore.kt` (from zeus-cashu-restore tag). Known supply-chain gap — labeled open, not planned-fixed.
- **`jq()` is not jq**: the script defines a shell function literally named `jq()` that is a `python3 -c` one-liner reading the versions JSON. Don't grep-conclude the repo depends on the jq binary.
- **Error noise is normal**: the script has no `set -e`; on a fresh clone you will see `sha256sum: ... No such file or directory` and failed `rm` messages before each download, and on re-runs `mkdir: ios/LndMobileLibZipFile: File exists` (the directory doesn't exist on a truly fresh clone — its contents are gitignored). Only an explicit "checksum failed" + exit 1 is a real failure.
- If skipped: Android fails at Gradle time (missing `.aar`/`.so`); iOS fails at Xcode link time ("framework 'Lndmobile' not found" etc.).

### Step 4 — `pod-install` (iOS pods)

The `pod-install` npm package runs CocoaPods for `ios/`. On non-macOS it prints "CocoaPods is only supported on darwin" and exits gracefully (this is why `yarn install` passes on ubuntu CI). Note `react-native.config.js` sets `automaticPodsInstallation: false`, so the RN CLI will NOT install pods for you — only this postinstall step (or a manual `cd ios && pod install`) does. If skipped: `zeus.xcworkspace` fails to build with missing-pod errors.

## 3) Vendoring rules (`zeus_modules/`)

`zeus_modules/` holds vendored (checked-in) packages: `@lightninglabs/lnc-core`, `@lightninglabs/lnc-rn`, `@remobile/react-native-qrcode-local-image`, `bc-bech32`, `bc-ur`, `ur`, `noble_ecc.ts`.

- `@lightninglabs/lnc-core` IS in `package.json` dependencies via `"file:zeus_modules/@lightninglabs/lnc-core"`.
- `@lightninglabs/lnc-rn` is NOT in `package.json` at all. It is vendored **with its own committed `node_modules/` and `yarn.lock`** and imported by relative path (`backends/LightningNodeConnect.ts`: `import LNC from '../zeus_modules/@lightninglabs/lnc-rn'`). **Never `yarn add` lnc-rn** — you would get a second, unpatched copy and break the LNC backend.
- `zeus_modules` is excluded from all tooling: `tsconfig.json` `exclude` (along with `node_modules`, `android`, `ios`), `eslint.config.js` ignores, and `.prettierignore`. Code inside it is not held to repo lint/format/type standards; don't "fix" it in a normal PR.

## 4) Native-layer wiring

### Android

- App source root: `android/app/src/main/java/` with THREE package trees: `com/zeus/` (bulk of modules — note `MainApplication.kt` lives here even though its declared package is `app.zeusln.zeus`; it also holds `cashudevkit/`, declared package `app.zeusln.zeus.cashudevkit` — another dir/package mismatch), `app/zeusln/zeus/` (LdkNode, StealthMode, ZipUtils), and `org/lightningdevkit/ldknode/` + `uniffi/zeus_cashu_restore/` (uniffi bindings). The `com/zeus/lnc-rn/` directory name contains a hyphen (nonstandard Java layout) — it is correct, don't "fix" it.
- **Manual native-package registration**: `android/app/src/main/java/com/zeus/MainApplication.kt` manually `add(...)`s 10 packages that RN autolinking cannot discover (they are app-local, not npm packages): `MobileToolsPackage`, `LndMobilePackage`, `LndMobileToolsPackage`, `LndMobileScheduledSyncPackage`, `LncPackage`, `NostrConnectPackage`, `StealthModePackage`, `CashuDevKitPackage`, `LdkNodePackage`, `ZipUtilsPackage`. **A new app-local native module must be added here or `NativeModules.YourModule` is null at runtime.**
- Binary consumption (`android/app/build.gradle` + `android/build.gradle`): `Lndmobile.aar` via the `:lndmobile` subproject and a `flatDir` repo; CDK and restore AARs via `implementation files("../cdk/cashudevkit.aar")` / `files("../zeus-restore/zeus-cashu-restore.aar")`; LDK Node via raw `.so` files in `jniLibs/` plus the **checked-in** Kotlin binding `android/app/src/main/java/org/lightningdevkit/ldknode/ldk_node.kt`.
- Release APKs are split per ABI with `versionCodeOverride = versionCode * 1000 + {1..4}` — release mechanics belong to **zeus-run-and-operate**.

### iOS

- Workspace: `ios/zeus.xcworkspace` (always open the workspace, not the .xcodeproj — pods live in a companion project).
- **One `Lndmobile.xcframework`, shared by two modules, in a misleading directory**: fetch-libraries.sh unzips it to `ios/LncMobile/` (NOT `ios/LndMobile/`). The embedded-LND Swift layer (`ios/LndMobile/Lnd.swift`, `LndMobile.swift`: `import Lndmobile`) and the LNC layer (`ios/LncMobile/LncModule.mm`, which #imports the header straight out of the xcframework) both link against it; `zeus.xcodeproj` references it at path `LncMobile/Lndmobile.xcframework`.
- **Podfile post_install** appends to every pod's `FRAMEWORK_SEARCH_PATHS`: `"$(SRCROOT)/Cdk"`, `"$(SRCROOT)/ZeusRestore"`, `"$(SRCROOT)/LncMobile"`, and floors `IPHONEOS_DEPLOYMENT_TARGET` at 13.4. Local podspecs `ios/CashuDevKit.podspec` and `ios/ZeusCashuRestore.podspec` are consumed as `pod 'CashuDevKit', :path => '.'` / `pod 'ZeusCashuRestore', :path => '.'`.
- Other frameworks: `ios/LdkNodeMobile/LDKNodeFFI.xcframework` (with **checked-in** binding `ios/LdkNodeMobile/LDKNode.swift`), `ios/Cdk/cdkFFI.xcframework`, `ios/ZeusRestore/zeusRestoreFFI.xcframework`; downloaded Swift bindings land in `ios/CashuDevKit/`.

### uniffi binding version-match rule

uniffi generates wrapper source (Kotlin/Swift) whose function/type checksums must match the compiled Rust library. In Zeus the two halves arrive by different routes:
- **Checked into git** (must be updated by hand when the binary version bumps): `ldk_node.kt`, `LDKNode.swift`.
- **Downloaded by fetch-libraries.sh pinned to the same version tag as the binary** (auto-matching): `CashuDevKit.swift`, `zeus_cashu_restore.swift`, `zeus_cashu_restore.kt`.

If binding source and binary versions diverge you get runtime symbol/checksum errors (uniffi aborts on API-checksum mismatch), not compile errors. When bumping `ldk-node` in `fetch-libraries-versions.json`, regenerate/replace the two checked-in binding files from the same release.

### TypeScript wrapper layers (where JS meets native)

| Dir | Role |
|---|---|
| `lndmobile/` | TS API over the embedded-LND native modules (Blixt-derived); protobuf encode/decode per RPC |
| `ldknode/` | TS API over `NativeModules.LdkNodeModule` (uniffi LDK Node) |
| `cashu-cdk/` | TS API over the CDK native module |
| `zeus_modules/@lightninglabs/lnc-rn` | vendored LNC RN client |

### Tor

Tor support is `react-native-nitro-tor` **0.6.0** (normal npm dependency, autolinked; used via `import { RnTor } from 'react-native-nitro-tor'` in `utils/TorUtils.ts`). The old `react-native-tor` ZeusLN fork is **retired** — replaced in PR #3971 (commit `a58b4cefc`, merge `c512ea687`). Ignore any older notes about building/patching the Sifir react-native-tor fork; there is nothing to build.

## 5) Known traps

1. **Android emulator localhost**: emulator host rule — see **zeus-run-and-operate** §2 (the owner of the `10.0.2.2` fact).
2. **Proto changes**: `proto/lightning.js` + `proto/lightning.d.ts` are generated artifacts (checked in). After editing any `proto/**/*.proto`, run `yarn gen-proto` (pbjs/pbts from protobufjs-cli) and commit the regenerated pair.
3. **Stale Android build state**: `yarn android:clean` removes `android/app/.cxx`, `android/build`, then runs `gradlew clean`. Use it after NDK/Gradle/RN version changes or C++ codegen weirdness. `yarn gradlew <task>` is the repo shortcut for arbitrary Gradle tasks.
4. **New ESM dependency breaks jest** ("Unexpected token 'export'"): extend the jest `transformIgnorePatterns` whitelist in `package.json` — full anatomy in **zeus-validation-and-qa**.
5. **Hermes + New Architecture are ON** (`android/gradle.properties`: `hermesEnabled=true`, `newArchEnabled=true`; New Arch since RN 0.83.1 upgrade, commit `d13ebc2cd`). Consequences: pre-2026 Animated/layout patterns can crash Fabric, and Hermes regexes need input length caps — details and incident hashes in **zeus-failure-archaeology** / **zeus-debugging-playbook**.
6. **Never hand-edit** the `react-native`/`browser` alias maps in `package.json` or `shim.js` — rn-nodeify regenerates them (§2 step 2).
7. **`pod install` didn't run automatically from the RN CLI**: expected — `automaticPodsInstallation: false` in `react-native.config.js`; run `npx pod-install` or `cd ios && pod install`.
8. **Checksum failure on a binary**: means the release asset changed or the download was corrupted. Delete the cached artifact (paths in §2 step 3 table) and re-run `yarn fetch-libraries`. Do NOT blank the hash in `fetch-libraries-versions.json` (empty-hash skip caveat).
9. **`gradle.properties` sets `org.gradle.parallel=false`** — a reproducible-build requirement; don't flip it for speed in a PR.
10. **New npm dependencies require maintainer discussion first** (CONTRIBUTING.md) — see **zeus-change-control** before adding anything.

## 6) From-scratch bring-up checklists

Build/run steps below are labeled **[source-read]** = verified by reading package.json/CONTRIBUTING/README/CI usage, not executed in this session; everything else was executed read-only.

### Common (both platforms)

1. Install Node ≥ 22.11 (24.x recommended to match CI) and Yarn classic: `npm i -g yarn`. [source-read]
2. Set up the React Native environment per the RN "Building Projects with Native Code" guide for your target platform (README, "Starting development").
3. `git clone https://github.com/ZeusLN/zeus.git && cd zeus`
4. `yarn` — runs install + the full postinstall chain of §2. Requires network access to GitHub releases; expect harmless first-run noise from fetch-libraries.sh. [source-read]
5. Sanity-check the toolchain-free gates: `yarn tsc` and `yarn test` should pass on a clean master checkout. [source-read; full gate anatomy in zeus-validation-and-qa]

### Android

6. Install Android Studio with SDK Platform 36, build-tools 36.0.0, NDK 28.0.13004108 (Gradle will prompt/fetch NDK if missing). [source-read]
7. Start an emulator, or enable USB debugging on a device and confirm `adb devices` lists it.
8. Terminal A: `yarn start` (Metro bundler — RN's JS dev server).
9. Terminal B: `yarn android` (= `react-native run-android`): builds debug APK, installs, launches. [source-read]
10. Verify: app boots to the Wallet screen. To connect a node running on your machine, use host `10.0.2.2`.
11. If the build fails on missing `.aar`/`.so`: re-run `yarn fetch-libraries`; on C++/codegen residue: `yarn android:clean`.

### iOS (macOS only)

6. Install Xcode + command line tools; `sudo gem install cocoapods` or `bundle install` (Gemfile pins cocoapods ≥ 1.13, != 1.15.0/1.15.1). [source-read]
7. Pods were installed by postinstall; if not, `cd ios && pod install && cd ..`.
8. Terminal A: `yarn start`.
9. Either `yarn ios` (= `react-native run-ios`) or open `ios/zeus.xcworkspace` in Xcode, select the `zeus` scheme + a simulator, hit Run. [source-read]
10. Verify: app boots to the Wallet screen; simulator can use `127.0.0.1` for local nodes (no 10.0.2.2 remap needed — that trap is Android-emulator-specific).
11. If linking fails with "framework not found" for Lndmobile/cdkFFI/zeusRestoreFFI/LDKNodeFFI: re-run `yarn fetch-libraries` then `pod install` (search paths come from the Podfile post_install, §4).

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by direct file reads and read-only commands in this repo. Build/run commands not executed are labeled [source-read] above.

Re-verification one-liners for every volatile fact:

| Fact | Re-verify with |
|---|---|
| Node engines floor | `node -e "console.log(require('./package.json').engines.node)"` |
| CI Node version | `grep -h node-version .github/workflows/*.yml` |
| RN / key dep versions | `node -e "const p=require('./package.json');console.log(p.dependencies['react-native'],p.dependencies['react-native-nitro-tor'],p.devDependencies['pod-install'],p.devDependencies['rn-nodeify'])"` |
| Postinstall chain | `node -e "console.log(require('./package.json').scripts.postinstall)"` |
| Patch list | `ls patches/` and read `patches/index.mjs` |
| Native binary versions + hashes | `cat fetch-libraries-versions.json` |
| Empty-hash skip + unchecked binding downloads | `grep -n -e 'if \[ -n' -e BINDINGS_URL fetch-libraries.sh` |
| Android SDK/Kotlin/NDK | `sed -n '1,10p' android/build.gradle` |
| Gradle version | `grep distributionUrl android/gradle/wrapper/gradle-wrapper.properties` |
| Hermes / New Arch / parallel | `grep -n -e newArchEnabled -e hermesEnabled -e org.gradle.parallel android/gradle.properties` |
| Manually registered packages | `grep -n 'add(' android/app/src/main/java/com/zeus/MainApplication.kt` |
| Podfile search paths / pods | `grep -n -e FRAMEWORK_SEARCH_PATHS -e "pod '" ios/Podfile` |
| xcframework location | `grep -n 'LncMobile/Lndmobile.xcframework' ios/zeus.xcodeproj/project.pbxproj` |
| lnc-rn not in package.json | `grep -c lnc-rn package.json` (expect 0); `grep -n lnc-rn backends/LightningNodeConnect.ts` |
| Tooling excludes zeus_modules | `grep -n zeus_modules tsconfig.json eslint.config.js .prettierignore` |
| Checked-in vs downloaded uniffi bindings | `git ls-files -- '*ldk_node.kt' '*LDKNode.swift' '*zeus_cashu_restore*' '*CashuDevKit.swift'` (only the first two are tracked) |
| Emulator host rule | `grep -n 10.0.2.2 CONTRIBUTING.md` |
| CocoaPods constraint | `grep cocoapods Gemfile` |
| nitro-tor migration commit | `git log --oneline --all --grep=nitro-tor` |
| New Arch upgrade commit | `git log --oneline -1 d13ebc2cd` |
