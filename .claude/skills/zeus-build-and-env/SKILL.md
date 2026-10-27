---
name: zeus-build-and-env
description: Load when setting up the Zeus dev environment from scratch, running yarn install / postinstall, or debugging build/toolchain failures. Triggers - "yarn install fails", "postinstall error", missing Lndmobile.aar / Lndmobile.xcframework / LDKNodeFFI / CashuDevKitFFI / zeusRestoreFFI, "checksum failed", fetch-libraries.sh, rn-nodeify, shim.js, pod install / CocoaPods errors, Gradle / Kotlin / NDK / minSdk questions, Xcode framework-not-found, autolinking / native module not found, MainApplication.kt package registration, zeus_modules / lnc-rn vendoring, uniffi binding version mismatch, gen-proto, Hermes or New Architecture build crashes.
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

## 1) Prerequisites (re-verified 2026-10-24, master `3dc9f83e6`, v13.2.4-alpha)

| Requirement | Value | Source of truth |
|---|---|---|
| Node.js | `^22.13.0 \|\| ^24.3.0 \|\| >= 26.0.0` (package.json `engines`); CI uses Node `24.x`, so prefer 24.x LTS to match CI | `package.json`, `.github/workflows/*.yml` |
| Package manager | Yarn classic (v1) — `yarn.lock` is "yarn lockfile v1"; CI runs `yarn install --frozen-lockfile` | `yarn.lock`, workflows |
| React Native | 0.87.1 (see `package.json`), New Architecture ON, Hermes ON | `package.json`, `android/gradle.properties` |
| Android | minSdk 28, compileSdk 37, targetSdk 36, buildTools 37.0.0, Kotlin 2.2.0, NDK 28.0.13004108, Gradle 9.4.1 (AGP 9) | `android/build.gradle`, `android/gradle/wrapper/gradle-wrapper.properties` |
| iOS | Xcode (per RN 0.87 requirements; the repo does not pin one), deployment floor `min_ios_version_supported` from RN (15.1 at RN 0.87), CocoaPods `>= 1.13` excluding 1.15.0/1.15.1, Ruby `>= 3.1.0`, `xcodeproj >= 1.28.1` (needed for the ShareQR/NWCWidget synchronized groups; deliberately diverges from the RN template's `< 1.26.0`), `activesupport ~> 7.2, >= 7.2.3.1`. The Podfile sets `RCT_USE_PREBUILT_RNCORE=0`, so React core builds from source (the 0.87 prebuilt `React.xcframework` breaks the Objective-C++ app code) | `ios/Podfile`, `Gemfile` |
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

Seven patches, run in the order listed in `patches/index.mjs`, each idempotent, each rewriting files inside `node_modules/` (so they must re-run after every install):

| Patch file | What it does | What breaks if skipped |
|---|---|---|
| `patches/patch-jcenter.mjs` | Replaces removed `jcenter()` Maven repo with `mavenCentral()` in `react-native-hce`'s build.gradle (jcenter was removed in Gradle 9) | Android Gradle sync fails resolving that library |
| `patches/patch-native-event-emitter.mjs` | In RN's `NativeEventEmitter.js`, downgrades the iOS null-module `invariant()` throw to a `console.warn` (RN 0.83+ throws for deprecated modules loaded during React Refresh) | iOS dev builds crash/red-screen on refresh |
| `patches/patch-react-native-notifications.mjs` | Fully rewrites `FcmToken.java` in react-native-notifications (the upstream library uses `ReactInstanceManager`, unsupported in New Architecture bridgeless mode), and swaps the release buildType's `proguard-android.txt` for `proguard-android-optimize.txt` because AGP 9 removed the former | Android push-token handling fails to compile / crashes under New Arch; AGP 9 rejects the library at configuration time |
| `patches/patch-noble-hashes.mjs` | Adds `./crypto.js` to every `@noble/hashes` package.json `exports` map so Metro can resolve deep imports | Metro bundler "module not found" for @noble/hashes/crypto.js |
| `patches/patch-reanimated-set-fixes.mjs` | Source-patches react-native-reanimated's `LayoutAnimationsProxy.cpp` so shared element transitions find the revealed screen on pop (issue #4222) | Nondeterministic shared element transitions on back navigation, mainly Android |
| `patches/patch-keychain-cloudsync.mjs` | Makes react-native-keychain on iOS respect `cloudSync: false` (upstream checks presence, not value, so every write was iCloud-synchronizable; issue #4403) | Wallet secrets sync to iCloud Keychain |
| `patches/patch-keychain-atomic-update.mjs` | Makes react-native-keychain overwrites on iOS atomic: `SecItemUpdate` first, `SecItemAdd` only when no item exists (#5413). Has its own test, `patches/patch-keychain-atomic-update.test.ts` | A crash between the upstream delete and add removes `zeus-settings-v2`, and the next launch lands on the intro screen with no wallets |

### Step 2 — `rn-nodeify --install crypto,stream,dgram --hack` (Node core-module shims)

rn-nodeify makes Node.js core modules (crypto, stream, dgram) usable in React Native. It **regenerates**:
- the `react-native` and `browser` alias maps at the bottom of `package.json` (crypto → react-native-crypto, stream → stream-browserify, dgram → react-native-udp, `tls: false`, readable-stream aliases)
- `shim.js` at the repo root (global Buffer/process polyfills), imported by `index.js`

**Trap: hand edits to those alias maps or to `shim.js` are clobbered on the next `yarn install`.** If skipped: Metro fails to resolve `crypto`/`stream` imports and the app crashes at JS boot.

### Step 3 — `yarn run fetch-libraries` = `bash fetch-libraries.sh` (native binaries)

Downloads the pre-built native binaries that are gitignored (see `.gitignore` lines for `Lndmobile.aar`, `Lndmobile.xcframework`, `cashudevkit.aar`, `CashuDevKitFFI.xcframework`, `zeus-cashu-restore.aar`, `zeusRestoreFFI.xcframework`, `jniLibs/`, `LDKNodeFFI.xcframework`). All versions and SHA256 hashes live in **`fetch-libraries-versions.json`**. When bumping a binary, change version AND sha256 there, never inside the script.

Versions pinned as of 2026-10-24 (always check `fetch-libraries-versions.json`):

| Artifact | Version | Android destination | iOS destination |
|---|---|---|---|
| embedded LND (`ZeusLN/lnd` release) | `v0.21.5-beta.rc1-zeus` | `android/lndmobile/Lndmobile.aar` | unzipped to `ios/LncMobile/Lndmobile.xcframework` (yes, **Lnc**Mobile; see §4) |
| LDK Node (`ZeusLN/ldk-node` release) | `v0.7.1-zeus` | `.so` files unzipped into `android/app/src/main/jniLibs/<abi>/libldk_node.so` | `ios/LdkNodeMobile/LDKNodeFFI.xcframework` |
| CDK (Android: `org.cashudevkit:cdk-android` aar from Maven Central, which bundles the Kotlin bindings; iOS: `cashubtc/cdk-swift` release) | `0.18.1` | `android/cdk/cashudevkit.aar` | `ios/Cdk/CashuDevKitFFI.xcframework` (macOS slice stripped). Only the iOS Swift bindings have a separate hash (`iosBindingsSha256`) |
| zeus-cashu-restore (`ZeusLN/zeus-cashu-restore` release) | `0.1.0` | `android/zeus-restore/zeus-cashu-restore.aar` | `ios/ZeusRestore/zeusRestoreFFI.xcframework` |

Behavior and caveats (all verified by reading the script):
- **SHA256 enforcement**: ALL downloads — binaries AND the uniffi source bindings (`ios/CashuDevKit/CashuDevKit.swift`, `ios/CashuDevKit/zeus_cashu_restore.swift`, `android/app/src/main/java/uniffi/zeus_cashu_restore/zeus_cashu_restore.kt`, pinned via the `*BindingsSha256` fields) — hard-fail (`exit 1`) on checksum mismatch, always. An empty or malformed hash field in `fetch-libraries-versions.json` fails closed up front (the script validates every hash is 64-char hex before any download, because macOS `sha256sum -c` exits 0 on improperly formatted lines); never blank one to "fix" a checksum failure. (Before this hardening the bindings were curl'd from raw.githubusercontent.com tag URLs with no checksum; that supply-chain gap is closed.)
- **`jq()` is not jq**: the script defines a shell function literally named `jq()` that is a `python3 -c` one-liner reading the versions JSON. Don't grep-conclude the repo depends on the jq binary.
- **Error noise is normal**: the script has no `set -e`; on a fresh clone you will see `sha256sum: ... No such file or directory` and failed `rm` messages before each download, and on re-runs `mkdir: ios/LndMobileLibZipFile: File exists` (the directory doesn't exist on a truly fresh clone — its contents are gitignored). Only an explicit "checksum failed" + exit 1 is a real failure.
- If skipped: Android fails at Gradle time (missing `.aar`/`.so`); iOS fails at Xcode link time ("framework 'Lndmobile' not found" etc.).

### Step 4 — `pod-install` (iOS pods)

The `pod-install` npm package runs CocoaPods for `ios/`. On non-macOS it prints "CocoaPods is only supported on darwin" and exits gracefully (this is why `yarn install` passes on ubuntu CI). Note `react-native.config.js` sets `automaticPodsInstallation: false`, so the RN CLI will NOT install pods for you — only this postinstall step (or a manual `cd ios && pod install`) does. If skipped: `zeus.xcworkspace` fails to build with missing-pod errors.

## 3) Vendoring rules (`zeus_modules/`)

`zeus_modules/` holds vendored (checked-in) packages: `@lightninglabs/lnc-core`, `@lightninglabs/lnc-rn`, `noble_ecc.ts`.

- `@lightninglabs/lnc-core` IS in `package.json` dependencies via `"file:zeus_modules/@lightninglabs/lnc-core"`.
- `@lightninglabs/lnc-rn` is NOT in `package.json` at all. It is vendored with its own committed `yarn.lock` (no committed `node_modules/`) and imported by relative path (`backends/LightningNodeConnect.ts`: `import LNC from '../zeus_modules/@lightninglabs/lnc-rn'`). **Never `yarn add` lnc-rn**: you would get a second, unpatched copy and break the LNC backend.
- **Do not run `yarn` inside `zeus_modules/@lightninglabs/lnc-rn/`** unless you delete its `node_modules/` afterwards. That installs its devDependency `react-native` (0.72) into a nested, gitignored `node_modules/`, and Metro would resolve lnc-rn's `react-native` imports to it and crash on `PlatformConstants` when an LNC node connects. `metro.config.js` now blocks `zeus_modules/**/node_modules/react-native` and `@react-native` via `resolver.blockList` and pins `react-native` with `extraNodeModules`; other nested duplicates (e.g. protobufjs) are not blocked.
- `zeus_modules` is excluded from all tooling: `tsconfig.json` `exclude` (along with `node_modules`, `android`, `ios`), `eslint.config.js` ignores, and `.prettierignore`. Code inside it is not held to repo lint/format/type standards; don't "fix" it in a normal PR.

## 4) Native-layer wiring

### Android

- App source root: `android/app/src/main/java/` with THREE package trees: `com/zeus/` (bulk of modules — note `MainApplication.kt` lives here even though its declared package is `app.zeusln.zeus`; it also holds `cashudevkit/`, declared package `app.zeusln.zeus.cashudevkit` — another dir/package mismatch), `app/zeusln/zeus/` (LdkNode, StealthMode, ZipUtils), and `org/lightningdevkit/ldknode/` + `uniffi/zeus_cashu_restore/` (uniffi bindings). The `com/zeus/lnc-rn/` directory name contains a hyphen (nonstandard Java layout) — it is correct, don't "fix" it.
- **Manual native-package registration**: `android/app/src/main/java/com/zeus/MainApplication.kt` manually `add(...)`s 10 packages that RN autolinking cannot discover (they are app-local, not npm packages): `MobileToolsPackage`, `LndMobilePackage`, `LndMobileToolsPackage`, `LndMobileScheduledSyncPackage`, `LncPackage`, `NostrConnectPackage`, `StealthModePackage`, `CashuDevKitPackage`, `LdkNodePackage`, `ZipUtilsPackage`. **A new app-local native module must be added here or `NativeModules.YourModule` is null at runtime.**
- Binary consumption (`android/app/build.gradle` + `android/build.gradle`): `Lndmobile.aar` via the `:lndmobile` subproject and a `flatDir` repo; CDK and restore AARs via `implementation files("../cdk/cashudevkit.aar")` / `files("../zeus-restore/zeus-cashu-restore.aar")`; LDK Node via raw `.so` files in `jniLibs/` plus the **checked-in** Kotlin binding `android/app/src/main/java/org/lightningdevkit/ldknode/ldk_node.kt`.
- Release APKs are split per ABI (armeabi-v7a, arm64-v8a, x86_64; x86 was dropped) with `versionCodeOverride = versionCode * 1000 + {1, 3, 4}`; suffix 2 is retired. Release mechanics belong to **zeus-run-and-operate**.

### iOS

- Workspace: `ios/zeus.xcworkspace` (always open the workspace, not the .xcodeproj — pods live in a companion project).
- **One `Lndmobile.xcframework`, shared by two modules, in a misleading directory**: fetch-libraries.sh unzips it to `ios/LncMobile/` (NOT `ios/LndMobile/`). The embedded-LND Swift layer (`ios/LndMobile/Lnd.swift`, `LndMobile.swift`: `import Lndmobile`) and the LNC layer (`ios/LncMobile/LncModule.mm`, which #imports the header straight out of the xcframework) both link against it; `zeus.xcodeproj` references it at path `LncMobile/Lndmobile.xcframework`.
- **Podfile post_install** appends to every pod's `FRAMEWORK_SEARCH_PATHS`: `"$(SRCROOT)/Cdk"`, `"$(SRCROOT)/ZeusRestore"`, `"$(SRCROOT)/LncMobile"`, and floors `IPHONEOS_DEPLOYMENT_TARGET` at RN's `min_ios_version_supported` (15.1 at RN 0.87; raised from a hardcoded 13.4 in #4672, `8d56e620f`, because Xcode 27 rejects targets below 15.0). Local podspecs `ios/CashuDevKit.podspec` and `ios/ZeusCashuRestore.podspec` are consumed as `pod 'CashuDevKit', :path => '.'` / `pod 'ZeusCashuRestore', :path => '.'`.
- Other frameworks: `ios/LdkNodeMobile/LDKNodeFFI.xcframework` (with **checked-in** binding `ios/LdkNodeMobile/LDKNode.swift`), `ios/Cdk/CashuDevKitFFI.xcframework`, `ios/ZeusRestore/zeusRestoreFFI.xcframework`; downloaded (sha256-pinned) Swift bindings land in `ios/CashuDevKit/`.

### uniffi binding version-match rule

uniffi generates wrapper source (Kotlin/Swift) whose function/type checksums must match the compiled Rust library. In Zeus the two halves arrive by different routes:
- **Checked into git** (must be updated by hand when the binary version bumps): `ldk_node.kt`, `LDKNode.swift`.
- **Downloaded by fetch-libraries.sh pinned to the same version tag AND sha256-pinned** via the `*BindingsSha256` fields in `fetch-libraries-versions.json`: `CashuDevKit.swift`, `zeus_cashu_restore.swift`, `zeus_cashu_restore.kt`. (CDK Android bindings ship inside the checksummed `cashudevkit.aar`.)

If binding source and binary versions diverge you get runtime symbol/checksum errors (uniffi aborts on API-checksum mismatch), not compile errors. When bumping `ldk-node` in `fetch-libraries-versions.json`, regenerate/replace the two checked-in binding files from the same release. When bumping `cdk` or `zeus-cashu-restore`, update the binary hashes AND the `*BindingsSha256` fields from the same release in the same commit.

### TypeScript wrapper layers (where JS meets native)

| Dir | Role |
|---|---|
| `lndmobile/` | TS API over the embedded-LND native modules (Blixt-derived); protobuf encode/decode per RPC |
| `ldknode/` | TS API over `NativeModules.LdkNodeModule` (uniffi LDK Node) |
| `cashu-cdk/` | TS API over the CDK native module |
| `zeus_modules/@lightninglabs/lnc-rn` | vendored LNC RN client |

### Tor

Tor support is `react-native-nitro-tor` (version in `package.json`, **0.6.1** as of 2026-10-24; normal npm dependency, autolinked; used via `import { RnTor } from 'react-native-nitro-tor'` in `utils/TorUtils.ts`). The old `react-native-tor` ZeusLN fork is **retired**, replaced in PR #3971 (commit `a58b4cefc`, merge `c512ea687`). Ignore any older notes about building/patching the Sifir react-native-tor fork; there is nothing to build.

## 5) Known traps

1. **Android emulator localhost**: emulator host rule — see **zeus-run-and-operate** §2 (the owner of the `10.0.2.2` fact).
2. **Proto changes**: `proto/lightning.js` + `proto/lightning.d.ts` are generated artifacts (checked in). After editing any `proto/**/*.proto`, run `yarn gen-proto` (pbjs/pbts from protobufjs-cli) and commit the regenerated pair.
3. **Stale Android build state**: `yarn android:clean` removes `android/app/.cxx`, `android/build`, then runs `gradlew clean`. Use it after NDK/Gradle/RN version changes or C++ codegen weirdness. `yarn gradlew <task>` is the repo shortcut for arbitrary Gradle tasks.
4. **New ESM dependency breaks jest** ("Unexpected token 'export'"): extend the jest `transformIgnorePatterns` whitelist in `package.json` — full anatomy in **zeus-validation-and-qa**.
5. **Hermes + New Architecture are ON** (`android/gradle.properties`: `hermesEnabled=true`, `newArchEnabled=true`; New Arch since RN 0.83.1 upgrade, commit `d13ebc2cd`). Consequences: pre-2026 Animated/layout patterns can crash Fabric, and Hermes regexes need input length caps — details and incident hashes in **zeus-failure-archaeology** / **zeus-debugging-playbook**.
6. **Never hand-edit** the `react-native`/`browser` alias maps in `package.json` or `shim.js` — rn-nodeify regenerates them (§2 step 2).
7. **`pod install` didn't run automatically from the RN CLI**: expected — `automaticPodsInstallation: false` in `react-native.config.js`; run `npx pod-install` or `cd ios && pod install`.
8. **Checksum failure on a binary**: means the release asset changed or the download was corrupted. Delete the cached artifact (paths in §2 step 3 table) and re-run `yarn fetch-libraries`. Do NOT blank the hash in `fetch-libraries-versions.json` (an empty hash fails closed anyway).
9. **`gradle.properties` sets `org.gradle.parallel=false`** — a reproducible-build requirement; don't flip it for speed in a PR.
10. **New npm dependencies require maintainer discussion first** (CONTRIBUTING.md) — see **zeus-change-control** before adding anything.
11. **`pod-install` is pinned at `0.1.38`; do not bump it to 1.x.** pod-install 1.2.1 (#5283) runs `bundle exec pod` when the Gemfile lists cocoapods. Where `bundle` is macOS's Ruby 2.6 and `pod` is Homebrew's (Xcode Cloud, most dev Macs), the first probe writes a `Gemfile.lock` stamped with Homebrew Bundler and the next `bundle` call fails, breaking `yarn install` and Xcode Cloud's `ci_post_clone.sh`. Reverted in #5416 (`99b876551`); `.github/dependabot.yml` ignores semver-major pod-install bumps.
12. **AGP 9 stopped generating `BuildConfig`** unless a module opts in. `android/build.gradle` re-enables `buildFeatures { buildConfig true }` for every Android subproject because several RN libraries reference their own `BuildConfig.DEBUG`. Keep that block when touching the subprojects loop.

## 6) From-scratch bring-up checklists

Build/run steps below are labeled **[source-read]** = verified by reading package.json/CONTRIBUTING/README/CI usage, not executed in this session; everything else was executed read-only.

### Common (both platforms)

1. Install a Node version that satisfies `engines` (24.x recommended to match CI) and Yarn classic: `npm i -g yarn`. [source-read]
2. Set up the React Native environment per the RN "Building Projects with Native Code" guide for your target platform (README, "Starting development").
3. `git clone https://github.com/ZeusLN/zeus.git && cd zeus`
4. `yarn` — runs install + the full postinstall chain of §2. Requires network access to GitHub releases; expect harmless first-run noise from fetch-libraries.sh. [source-read]
5. Sanity-check the toolchain-free gates: `yarn tsc` and `yarn test` should pass on a clean master checkout. [source-read; full gate anatomy in zeus-validation-and-qa]

### Android

6. Install Android Studio with SDK Platform 37, build-tools 37.0.0, NDK 28.0.13004108 (Gradle will prompt/fetch NDK if missing). [source-read]
7. Start an emulator, or enable USB debugging on a device and confirm `adb devices` lists it.
8. Terminal A: `yarn start` (Metro bundler — RN's JS dev server).
9. Terminal B: `yarn android` (= `react-native run-android`): builds debug APK, installs, launches. [source-read]
10. Verify: app boots to the Wallet screen. To connect a node running on your machine, use host `10.0.2.2`.
11. If the build fails on missing `.aar`/`.so`: re-run `yarn fetch-libraries`; on C++/codegen residue: `yarn android:clean`.

### iOS (macOS only)

6. Install Xcode + command line tools and Ruby ≥ 3.1; `sudo gem install cocoapods` or `bundle install` (Gemfile pins cocoapods ≥ 1.13, != 1.15.0/1.15.1, plus xcodeproj and activesupport floors). [source-read]
7. Pods were installed by postinstall; if not, `cd ios && pod install && cd ..`.
8. Terminal A: `yarn start`.
9. Either `yarn ios` (= `react-native run-ios`) or open `ios/zeus.xcworkspace` in Xcode, select the `zeus` scheme + a simulator, hit Run. [source-read]
10. Verify: app boots to the Wallet screen; simulator can use `127.0.0.1` for local nodes (no 10.0.2.2 remap needed — that trap is Android-emulator-specific).
11. If linking fails with "framework not found" for Lndmobile/CashuDevKitFFI/zeusRestoreFFI/LDKNodeFFI: re-run `yarn fetch-libraries` then `pod install` (search paths come from the Podfile post_install, §4).

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by direct file reads and read-only commands in this repo. §1, §2 (patch list, binary versions), §3, the §4 Podfile/ABI/Tor facts, §5 traps 11-12, and the §6 version numbers were re-verified 2026-10-24 against master `3dc9f83e6` (v13.2.4-alpha). Build/run commands not executed are labeled [source-read] above.

Re-verification one-liners for every volatile fact:

| Fact | Re-verify with |
|---|---|
| Node engines floor | `node -e "console.log(require('./package.json').engines.node)"` |
| CI Node version | `grep -h node-version .github/workflows/*.yml` |
| RN / key dep versions | `node -e "const p=require('./package.json');console.log(p.dependencies['react-native'],p.dependencies['react-native-nitro-tor'],p.devDependencies['pod-install'],p.devDependencies['rn-nodeify'])"` |
| Postinstall chain | `node -e "console.log(require('./package.json').scripts.postinstall)"` |
| Patch list | `ls patches/` and read `patches/index.mjs` |
| Native binary versions + hashes | `cat fetch-libraries-versions.json` |
| No unchecked downloads in fetch-libraries.sh | `grep -n -e 'if \[ -n' -e 'curl -L ' fetch-libraries.sh` (expect no hits; all curls are `-fL` and every download, bindings included, is sha256-checked) |
| Android SDK/Kotlin/NDK | `sed -n '1,10p' android/build.gradle` |
| Gradle version | `grep distributionUrl android/gradle/wrapper/gradle-wrapper.properties` |
| Hermes / New Arch / parallel | `grep -n -e newArchEnabled -e hermesEnabled -e org.gradle.parallel android/gradle.properties` |
| Manually registered packages | `grep -n 'add(' android/app/src/main/java/com/zeus/MainApplication.kt` |
| Podfile search paths / pods | `grep -n -e FRAMEWORK_SEARCH_PATHS -e "pod '" ios/Podfile` |
| xcframework location | `grep -n 'LncMobile/Lndmobile.xcframework' ios/zeus.xcodeproj/project.pbxproj` |
| lnc-rn not in package.json | `grep -c lnc-rn package.json` (expect 0); `grep -n lnc-rn backends/LightningNodeConnect.ts` |
| lnc-rn has no committed node_modules; Metro blocks nested RN | `git ls-files zeus_modules/@lightninglabs/lnc-rn \| grep -c node_modules` (expect 0); `grep -n -A4 blockList metro.config.js` |
| pod-install pin + Dependabot ignore | `grep -n '"pod-install"' package.json; grep -n -A6 pod-install .github/dependabot.yml` |
| iOS deployment floor / prebuilt core off | `grep -n -e min_ios_version_supported -e RCT_USE_PREBUILT_RNCORE ios/Podfile` |
| Tooling excludes zeus_modules | `grep -n zeus_modules tsconfig.json eslint.config.js .prettierignore` |
| Checked-in vs downloaded uniffi bindings | `git ls-files -- '*ldk_node.kt' '*LDKNode.swift' '*zeus_cashu_restore*' '*CashuDevKit.swift'` (only the first two are tracked; the rest are downloaded sha256-pinned) |
| Emulator host rule | `grep -n 10.0.2.2 CONTRIBUTING.md` |
| CocoaPods / Ruby / xcodeproj constraints | `grep -n -e cocoapods -e '^ruby' -e xcodeproj -e activesupport Gemfile` |
| nitro-tor migration commit | `git log --oneline --all --grep=nitro-tor` |
| New Arch upgrade commit | `git log --oneline -1 d13ebc2cd` |
