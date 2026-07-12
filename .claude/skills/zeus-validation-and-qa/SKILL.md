---
name: zeus-validation-and-qa
description: Load when validating changes to Zeus — running or fixing `yarn verify` / CI checks (Test, Lint, Prettier, Typescript Check), writing or extending Jest unit tests, deciding what evidence a PR needs (manual testing matrix, screenshots, which backends to test), or debugging CI-only failures. Symptoms/keywords - "yarn verify fails", "check-styles.test.ts", "themeColor StyleSheet lint error", "Cannot use import statement outside a module" in jest, "prettier check fails in CI but not locally", "how do I run one test", "where are the tests", "do stores have tests", "what do I need to test before opening a PR", transformIgnorePatterns, moduleNameMapper, test coverage.
---

# Zeus Validation and QA

What counts as evidence in this repo, how the CI gate works internally, how to write tests that actually run, and the honest map of what is (and is not) covered by automation.

Facts verified 2026-07-06 against commit `c5fd094fb` (v13.1.3-alpha). See "Provenance and maintenance" for re-verification commands.

## When to use / When NOT to use

Use this skill when you are:
- Running or debugging `yarn verify` or any of the four PR CI checks
- Writing, extending, or running Jest tests
- Deciding what manual testing / screenshots / backend coverage a change needs before PR
- Hit by the `check-styles.test.ts` lint failure or a jest transform error

Use a sibling skill instead when you need:
- PR/commit/review/locales rules, dependency policy, the storage-change gate → **zeus-change-control**
- Which of the 7 backends supports a feature, `supports*()` flags → **zeus-backends-and-capabilities**
- Recreating the dev environment, postinstall chain, native builds → **zeus-build-and-env**
- Running the app and connecting to test nodes (needed for manual testing) → **zeus-run-and-operate**
- Triage of runtime bugs (not CI failures) → **zeus-debugging-playbook**
- Logging/measurement tooling → **zeus-diagnostics-and-tooling**
- Formal proofs/analysis beyond tests (race analysis, migration proofs) → **zeus-proof-and-analysis-toolkit**

## Glossary (skip if you know both stacks)

| Term | Meaning here |
|---|---|
| Jest | The JavaScript unit-test runner (`yarn test`). Version 29, preset `@react-native/jest-preset`. |
| tsc | The TypeScript compiler run in check-only mode (`yarn tsc`) — no output files, just type errors. |
| ESLint / Prettier | Linter (code-pattern rules) / formatter (whitespace, quotes). Both are CI-blocking. |
| MobX store | Observable state singleton class in `stores/` (e.g. `SettingsStore`). Zeus uses MobX 5 decorators. |
| Backend | One of 7 node-connection implementations in `backends/` (LND REST, embedded LND, LDK Node, CLN, LNC, LNDHub, NWC). |
| `StyleSheet.create` | React Native API that freezes a style object at module load time. |
| `themeColor('key')` | Zeus helper (`utils/ThemeUtils.ts`) returning a color from the *currently selected* theme at call time. |
| BOLT11 | The Lightning invoice string format (`lnbc...`). LNURL = HTTP-based Lightning protocols. Cashu = ecash tokens. Macaroon = LND's auth credential. |

## 1) `yarn verify` anatomy — the entire quality gate

`yarn verify` (package.json) runs four checks in parallel via `concurrently`:

```
"verify": "concurrently \"yarn test\" \"yarn prettier\" \"yarn tsc\" \"yarn lint\""
```

These SAME four checks are the ENTIRE PR CI gate. `.github/workflows/` contains `test.yml`, `lint.yml`, `prettier.yml`, `tsc.yml` (each: ubuntu-latest, Node 24.x, `yarn install --frozen-lockfile`, then the one script). `build-android.yml` and `dependency-scan.yml` are `workflow_dispatch`-only, and `telegram.yml` is a push/issues/release notification workflow, not a check — no mobile build, no emulator, no dependency scan runs on PRs. Green CI proves types, format, lint, and 48 unit-test suites. Nothing more.

| CI check name | Exact local command | What it runs | Common failure modes |
|---|---|---|---|
| Test | `yarn test` | `jest` — 48 suites (45 `utils/`, 2 `models/`, 1 `lndmobile/`); `check-styles.test.ts` excluded via `testPathIgnorePatterns` | New ESM dependency not in `transformIgnorePatterns` ("Cannot use import statement outside a module"); un-mocked native module; importing `stores/Stores` without mocking it drags in the whole app graph |
| Prettier | `yarn prettier` | `prettier --check "**/*.ts*"` (ignores only `zeus_modules`, per `.prettierignore`) | Formatting with a global/newer Prettier — the repo pins **prettier 2.4.1** (devDependency) with `.prettierrc`: tabWidth 4, singleQuote, semi, trailingComma "none". Newer Prettier majors format differently and fail CI. Fix: `yarn prettier-write` (uses the pinned version) |
| Typescript Check | `yarn tsc` | `tsc` check-only; tsconfig has `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, but `strictPropertyInitialization: false` (MobX store fields) | Unused variables/params fail the build; excludes are `node_modules`, `zeus_modules`, `android`, `ios`. Repo convention for suppression is `@ts-ignore` (ban-ts-comment is off) — never `eslint-disable` comments (zero exist in the codebase) |
| Lint | `yarn lint` | `eslint . && yarn run test check-styles.test.ts --testPathIgnorePatterns=` | ESLint 9 flat config (`eslint.config.js`) includes `prettier/prettier` as an **error** rule — so a formatting mistake fails BOTH the Prettier and Lint checks. Second half is the style-sheet ban, see section 2. ESLint ignores `zeus_modules/`, `android/`, `ios/`, `proto/`, `shim.js`, config JS files |

Run the full gate before every PR. Node engines requirement is `>= 22.11.0` (package.json); CI uses 24.x; there is no `.nvmrc`.

Checklist before opening a PR:
- [ ] `yarn verify` passes locally (all four)
- [ ] If you touched a utility: unit tests added/updated (the PR template asks this explicitly)
- [ ] Manual test evidence collected (section 5)

## 2) The `check-styles.test.ts` mechanism, precisely

`check-styles.test.ts` sits at the repo root. It is a Jest test, but it is NOT part of `yarn test`:

- package.json jest config: `"testPathIgnorePatterns": ["check-styles.test.ts"]` → excluded from the Test check.
- `yarn lint` re-includes it by passing an EMPTY ignore list: `yarn run test check-styles.test.ts --testPathIgnorePatterns=` → so a styling violation fails the **Lint** CI check, not Test. This surprises everyone once.

**What it bans:** calling `themeColor()` inside a static `StyleSheet.create({...})` block in any `.tsx` file.

**Why:** `StyleSheet.create` at module scope executes ONCE, at import time. `themeColor('key')` reads the user's *currently selected* theme (Zeus ships 23 themes). A theme color baked into a static sheet freezes at whatever theme was active at first import and silently ignores theme switches — a real correctness bug, not a style nit. The test's own error message says exactly this.

**How it detects:** a dot-all regex — `/\n[^\s][^\n]+StyleSheet\.create\(\{.*themeColor\(/s` — flags any `.tsx` file where a **non-indented (top-level) line containing `StyleSheet.create({`** is followed *anywhere later in the file* by `themeColor(`. Two practical consequences:

1. Keep `const styles = StyleSheet.create({...})` as the LAST thing in the file (the repo-wide convention, e.g. `components/WalletHeader.tsx`) and keep it free of `themeColor()`.
2. Because the `.*` spans newlines, a `themeColor(` call in ordinary component code placed BELOW the styles block will also trip the check even if the sheet itself is clean. Styles-at-bottom avoids this entirely.

**How to fix a violation** — move the themed color out of the static sheet:

```tsx
// BANNED: frozen at import time
const styles = StyleSheet.create({
    label: { fontSize: 16, color: themeColor('text') }
});

// OK: static layout in the sheet, themed color applied at render time
const styles = StyleSheet.create({
    label: { fontSize: 16 }
});
// in render():
<Text style={[styles.label, { color: themeColor('text') }]} />
// or compute the style object inside render/a function, as components/Button.tsx does
```

Run just this check locally: `yarn run test check-styles.test.ts --testPathIgnorePatterns=`

## 3) Jest traps

**`transformIgnorePatterns` whitelist.** React Native ships untranspiled ESM in many packages; jest only transpiles `node_modules` packages explicitly whitelisted. The current list (package.json jest config):

```
react-native | @react-native | react-native-blob-util | react-native-randombytes |
react-native-nfc-manager | dateformat | nostr-tools | @nostr | @noble | @scure | uuid
```

Symptom of a missing entry: `SyntaxError: Cannot use import statement outside a module` (or `Unexpected token 'export'`) pointing into `node_modules/<pkg>`. Fix: add the package name inside the `(?!(...))` group in `"transformIgnorePatterns"` in package.json. (New dependencies themselves require maintainer discussion first — see **zeus-change-control**.)

**`moduleNameMapper` for `@noble/hashes`.** Five explicit mappings (`_assert`, `pbkdf2`, `sha256`, `sha512`, `utils`) pin `@noble/hashes/*` subpath imports to concrete `.js` files, because jest's resolver predates that package's `exports`-map style. If you import a new `@noble/hashes` subpath in tested code and jest says "Cannot find module", add a matching mapper line.

**Colocated test convention.** Tests live NEXT TO the code, named `<File>.test.ts`: `utils/FeeUtils.ts` + `utils/FeeUtils.test.ts`. No `__tests__/` directories, no `.spec.ts`, no `.test.tsx` anywhere. Variants are allowed (`utils/AddressUtils-testnet.test.ts`, `utils/UnitsUtils.alt.test.ts`).

**Mock before import.** Test files start with `jest.mock(...)` calls for native modules and stores BEFORE importing the unit under test — see the top of `utils/handleAnything.test.ts` (mocks `../stores/Stores`, `react-native-notifications`, AsyncStorage, `./BackendUtils`, the Cashu FFI) and `utils/MigrationUtils.test.ts`. Copy one of these preambles when your unit transitively touches stores or native code; importing `stores/Stores` un-mocked pulls in the entire 30-store app graph and usually explodes on a native module.

**Run a subset** (verified working):

```bash
yarn test utils/Bolt11Utils.test.ts          # one file (path pattern)
yarn test utils/Bolt11Utils.test.ts -t "LRU" # one file, test-name filter
yarn jest --listTests                        # enumerate all suites jest will run
```

## 4) Coverage reality — where automation actually protects you

Counted at `c5fd094fb`: **48 test suites** run by `yarn test` — `utils/` 45, `models/` 2 (`Payment.test.ts`, `ClaimTransaction.test.ts`), `lndmobile/` 1 (`channel.test.ts`) — plus the lint-only `check-styles.test.ts` (49 `.test.ts` files total).

**Zero tests exist for `stores/`, `views/`, `components/`, and `backends/`.** That is: all MobX state logic (including the 5000+-line CashuStore), every screen, every reusable component, and all 7 node-backend implementations have NO automated safety net. Consequences you must act on:

- A green `yarn verify` on a store/view/backend change proves only that it compiles, lints, and didn't break *utility* tests. **Manual testing is the real safety net there** (section 5).
- CONTRIBUTING.md ("Test Coverage"): *bug fixes should include a test that would have caught the bug*. For store/view bugs, satisfy this via the extraction pattern in section 7.
- The maintainer-confirmed rule "no drive-by refactors in payment paths" exists largely BECAUSE of this coverage hole (see **zeus-change-control**).

## 5) Evidence standards — what a PR must prove

CI green is necessary, never sufficient. The evidence bar (CONTRIBUTING.md + PR template + maintainer rules confirmed 2026-07-06):

1. **Manual testing on BOTH platforms is mandatory.** CONTRIBUTING.md says "when possible"; the maintainer's actual rule (confirmed 2026-07-06, stricter than the written doc) is: **no merge without hands-on iOS + Android testing by the author, regardless of CI green.** See **zeus-run-and-operate** for how to run the app and connect nodes.
2. **Fill out the PR template — never delete it** (`.github/PULL_REQUEST_TEMPLATE.md`). It requires: change category; the four-check checklist; whether you added unit tests for touched utilities; platforms tested (with OS version and phone model/VM); and the **7-backend testing matrix**: on-device LDK Node, Embedded LND; remote LND (REST), LND (Lightning Node Connect), Core Lightning (CLNRest), Nostr Wallet Connect, LndHub. Check ONLY the boxes for what you actually tested.
3. **Screenshots/video for UI changes** (CONTRIBUTING.md), tested on both platforms because rendering differs. First-time contributors MUST attach screenshot/video proof for features/UI or the PR is closed within 24 hours (CONTRIBUTING.md "Proof of Work").
4. **Regression test with every bug fix** where the logic is unit-testable (CONTRIBUTING.md).

**Which backends to actually test** — guidance derived from the capability matrix (authoritative flags live in **zeus-backends-and-capabilities**); the template asks you to report honestly, not to test all 7 for every change:

| Change class | Minimum sensible manual matrix |
|---|---|
| Pure `utils/`/`models/` logic | Unit tests + smoke-test one backend that exercises the call path |
| Cross-backend feature (dispatched via `BackendUtils`) | Every backend whose `supports*()` gate enables it — missing gates are historically the top cross-backend crash source |
| Payment send/receive paths | Each backend whose code path the diff touches; keep the diff minimal (maintainer rule — see **zeus-change-control**) |
| Cashu/ecash | Embedded LND + LDK Node (the only two with `supportsCashuWallet = true`) |
| Watchtowers | LND-family only |
| Node lifecycle / startup | Embedded LND AND LDK Node (both have distinct race histories) plus one remote backend |
| UI/theme-only | Both platforms, screenshots, at least one theme switch if colors changed; backend largely irrelevant |

## 6) Golden inventory — the highest-value existing suites

Read these before writing your own; they are the house style. Line counts at `c5fd094fb`.

| Suite | Lines | What it protects |
|---|---|---|
| `utils/handleAnything.test.ts` | 1818 | The universal input router (QR scan / clipboard / deep link): detection and its ORDER — bitcoin address, pubkey, BOLT11, BIP21+lnurl fallbacks, nested `LIGHTNING:lnurlp://` schemes, merchant-QR→lightning-address conversion, lightning-address casing. Also the best template for mocking stores/native deps. |
| `utils/AddressUtils.test.ts` (+ `AddressUtils-testnet.test.ts`) | 1398 (+) | All input validators: BIP21 URIs, bitcoin address types, BOLT11 detection, lightning addresses, LNDHub creds, npub/xpub, PSBT, tx hex, wallet-export formats. First line of defense against misrouting funds. |
| `utils/AmountUtils.test.ts` | 1051 | Sat/msat amount parsing, formatting, and millisatoshi-display edge cases — user-visible money math. |
| `utils/MigrationUtils.test.ts` | 567 | Settings-blob migrations (a historically bug-prone area — see **zeus-storage-and-migrations**); mocks `stores/Stores` down to `settingsStore.setSettings`. |
| `utils/ValidationUtils.test.ts` | 447 | Node-connection input validation: server address, port, rune/macaroon charsets, LNC pairing phrase, pubkey/host. |
| `utils/CashuUtils.test.ts` | 347 | Ecash token extraction (URL wrappers), validity checks, proof summing, P2PK helpers. |
| `utils/Bolt11Utils.test.ts` | 243 | Hand-rolled BOLT11 decoder against spec reference vectors; the LRU cache identity guarantee; the lazy signature-recovery getters (deferred secp256k1). Small but guards subtle invariants. |
| `models/Payment.test.ts` | 105 | `Payment.getAmount` with partial/multi-HTLC successes, fee exclusion — displayed-amount correctness. |
| `lndmobile/channel.test.ts` | 57 | The only native-bridge-layer test: verifies channel-backup commands encode the right protobuf request/response types. |

## 7) Testing store-like logic despite zero store tests

Do NOT try to instantiate a real MobX store in jest — none of the 30 stores is constructed in any existing test, the DI graph makes it impractical, and there is no established harness. The observed, accepted pattern is **extract pure logic into `utils/` and test it there**:

- `stores/ActivityStore.ts` delegates filtering to `utils/ActivityFilterUtils.ts` → tested in `utils/ActivityFilterUtils.test.ts` (464 lines).
- `stores/SettingsStore.ts` and `stores/CashuStore.ts` delegate migrations to `utils/MigrationUtils.ts` → tested in `utils/MigrationUtils.test.ts`.

Recipe when fixing a bug in a store:
1. Isolate the buggy computation (parsing, filtering, amount math, migration transform) into a pure function in `utils/<Thing>Utils.ts` — inputs in, value out, no store references. Keep the store method as a thin caller. Keep the diff minimal if it's a payment path (**zeus-change-control**).
2. Add colocated `utils/<Thing>Utils.test.ts` with a case reproducing the bug (fails before the fix, passes after) — this satisfies CONTRIBUTING's "test that would have caught the bug".
3. Where the logic genuinely needs store/native context, mock at the boundary exactly as `utils/MigrationUtils.test.ts` mocks `../stores/Stores` and `utils/handleAnything.test.ts` mocks `./BackendUtils` — mock modules the unit imports, before importing the unit.

Writing the FIRST test harness for an actual store class would be new ground: treat it as a proposal for maintainer discussion, not something to bolt onto a bug-fix PR (see **zeus-research-methodology** for the evidence bar).

## Provenance and maintenance

All facts verified 2026-07-06 against commit `c5fd094fb` (v13.1.3-alpha). Commands below were executed except where a fact is inherently CI-side (workflow YAML claims verified by reading `.github/workflows/*.yml`, not by dispatching CI).

Re-verify volatile facts:

| Fact | Command |
|---|---|
| `verify`/`test`/`lint`/`prettier`/`tsc` script definitions | `grep -A2 '"verify"' package.json` and `grep '"lint"\|"prettier"\|"tsc"\|"test"' package.json` |
| CI = exactly these 4 PR checks | `ls .github/workflows/` and `grep -A3 '^on:' .github/workflows/*.yml` (`build-android.yml`/`dependency-scan.yml` must still say `workflow_dispatch`; note a bare `grep -l 'pull_request'` also matches build-android.yml via a concurrency-group expression, not a trigger) |
| CI Node version / engines | `grep node-version .github/workflows/test.yml`; `grep -A2 '"engines"' package.json` |
| jest `testPathIgnorePatterns`, `transformIgnorePatterns`, `moduleNameMapper` | `python3 -c "import json;print(json.load(open('package.json'))['jest'])"` |
| check-styles ban + regex | `cat check-styles.test.ts` |
| Prettier pin + config | `grep '"prettier"' package.json` (expect `2.4.1` in devDependencies); `cat .prettierrc .prettierignore` |
| tsconfig strictness | `grep 'strict\|noUnused\|exclude' tsconfig.json` |
| Test-file census (expect 45/2/1 + check-styles) | `find . -name "*.test.ts" -not -path "./node_modules/*" -not -path "./zeus_modules/*" \| grep -v check-styles \| awk -F/ '{print $2}' \| sort \| uniq -c` |
| Stores/views/components/backends still untested | `find stores views components backends -name "*.test.ts*"` (expect empty) |
| Suite line counts (golden inventory) | `wc -l utils/*.test.ts models/*.test.ts lndmobile/*.test.ts \| sort -rn \| head` |
| PR template backend matrix | `cat .github/PULL_REQUEST_TEMPLATE.md` |
| CONTRIBUTING testing rules | `grep -n -A5 'Test Coverage\|Manual Testing' CONTRIBUTING.md` |
| Cashu backend support (guidance table) | `grep -rn 'supportsCashuWallet' backends/` |
| Extraction-pattern examples still hold | `grep -n 'ActivityFilterUtils\|MigrationUtils' stores/ActivityStore.ts stores/SettingsStore.ts` |

Note: "no merge without hands-on iOS+Android testing" is a maintainer-stated rule (2026-07-06), stricter than CONTRIBUTING.md's written "when possible" — if CONTRIBUTING.md is later updated, prefer the doc.
