---
name: zeus-change-control
description: How changes get classified, gated, reviewed, and merged in Zeus. Load BEFORE writing a commit message, opening/filling a PR, reviewing a PR, deciding whether a change needs maintainer sign-off, adding a dependency, editing locale files, or editing docs. Triggers/symptoms - "can I refactor this payment code", "which CI checks run on PRs", "how do I format my commit", "PR template", "ACK/tACK/NACK meaning", "why was my locale/de.json PR rejected", "do I need approval to touch keychain/settings storage", "first PR to Zeus", "revert policy", "version bump commit", "license/PGP key questions".
---

# Zeus Change Control

How to get a change into Zeus (a React Native Bitcoin/Lightning wallet) without losing user funds, corrupting user data, or getting your PR closed. Zeus moves money; process rules here exist because each one was paid for by a real incident.

Glossary used throughout (defined once):

- **PR** — GitHub pull request. **CI** — continuous integration; the automated checks GitHub runs on every PR.
- **Lightning** — Bitcoin's payment-channel network; Zeus is a wallet for it. **LND / CLN** — the two major Lightning node implementations Zeus talks to. **Macaroon** — LND's bearer-token auth credential (a secret; leaking one can drain a node).
- **Keychain** — the OS-level secure credential store (iOS Keychain / Android Keystore) where Zeus persists ALL wallet secrets in one JSON blob under key `zeus-settings-v2`.
- **Squash / fixup** — git operations that fold review-fix commits into the original commit before merge.
- **Backend** — one of the 7 node implementations Zeus can drive (embedded LND, LDK Node, remote LND REST, Lightning Node Connect, CLNRest, LndHub, Nostr Wallet Connect).

## When to use / When NOT to use

USE this skill for: change classification and approval gates, commit-message style, PR template and review process, CI-check expectations, dependency policy, locale rules, revert policy, docs/license/signing house rules.

Do NOT use this skill for — go to the sibling instead:

| Need | Sibling skill |
|---|---|
| HOW to write a storage migration, keychain contract details | zeus-storage-and-migrations |
| yarn verify internals, jest traps, themeColor style-sheet lint rule, how to add tests | zeus-validation-and-qa |
| zeus_modules vendoring mechanics, postinstall chain, native builds | zeus-build-and-env |
| Full incident narratives with evidence chains | zeus-failure-archaeology |
| Backend capability matrix, adding an RPC | zeus-backends-and-capabilities |
| Release operations, reproducible builds in practice | zeus-run-and-operate |
| Adding a settings axis (defaults, options) | zeus-config-and-flags |

Authoritative in-repo documents this skill summarizes (read them for full text; nothing here overrides them): `CONTRIBUTING.md`, `CODE_REVIEW.md`, `.github/PULL_REQUEST_TEMPLATE.md`.

## 1. The four maintainer non-negotiables (UNWRITTEN rules)

These four rules are **maintainer-stated (2026-07-06; Rule 4 revised 2026-10-24) and appear in NO repo document**. They bind anyway. Each has a paid-for rationale.

### Rule 1 — Storage/keychain changes are gated

Anything touching the `zeus-settings-v2` blob, keychain keys, `storage/index.ts`, or migrations (`utils/MigrationUtils.ts`, `stores/SettingsStore.ts` persistence paths) requires **maintainer sign-off plus a written migration plan, always** — before you write code. Never route around this by "just changing the format".

- WHY: every wallet's seed, macaroon, and PIN live in one keychain JSON blob. A bad write or migration bricks wallets or leaks seeds; there is no server-side undo.
- INCIDENTS: the iCloud keychain saga — PR #3307 (merged as `5f533bb12`, 2025-11-10) was reverted the **same day** (`7d8678457`, via revert PR #3354); the proper fix took two more PRs (merges `e808fd71a` + `ed161541a`, 2025-12-01) and STILL left stale iCloud-synced wallet copies on new devices, requiring a third migration (`46f2bac00`, 2026-01-14). Separately, a settings migration passed a `JSON.stringify`'d object to `setSettings`, corrupting MobX observables — issue #4150, fixed by `7ed901a10` (2026-06-09). Recipes and the safety protocol: **zeus-storage-and-migrations**; full narratives: **zeus-failure-archaeology**.

### Rule 2 — Revert-first near releases

A regression found during release testing gets **reverted the same day**, never forward-fixed under pressure. If your merged change is implicated, expect a `revert-<PR#>-<branch>` PR with an empty body; don't argue for a hotfix, re-land properly later.

- WHY: forward-fixes under release pressure ship untested code into a funds-handling app.
- INCIDENTS: NWC txlist fix #3432 merged and reverted (#3444) on the same day, 2025-12-15 (`28bc50f5e`); iCloud #3307 reverted same day 2025-11-10; sat-rounding #1568 (2023-08-04) reverted next day by #1587; app-lock-timeout #1679 reverted by #1773 (2023-10).
- Practical consequence: before trusting any merged fix as final, check `git log --grep='revert-<PR#>'`.

### Rule 3 — No refactors of payment paths

Changes to send/receive/payment-handling code (`views/Send.tsx`, `views/PaymentRequest.tsx`, `stores/TransactionsStore.ts`, `backends/*`, `utils/BackendUtils.ts` dispatch) must be **minimal diffs**. No drive-by refactoring, renaming, or "cleanup" inside a funds-touching change.

- WHY: automated coverage of payment-handling code is thin. `stores/TransactionsStore.test.ts`, `views/Send.test.tsx` and `views/PaymentRequest.test.tsx` exist, but they pin specific regressions rather than whole modules. `utils/BackendUtils.ts` has no test of its own, and 55 suites replace it with `jest.mock`, so no test exercises the real dispatch into the 7 backends (test census: zeus-validation-and-qa section 4). A refactor there is checked mostly by human review, across 7 backends.
- INCIDENT (refactors bite even outside payment code): `fdad118ed` (2025-10-24), a "replace UNSAFE React lifecycle methods" refactor, caused an infinite-loading regression fixed only 3 weeks later by `93227029e` (2025-11-12, which cites the offending hash in its subject).

### Rule 4: Manual device testing is mandatory

No merge without hands-on testing by the author on a device or emulator, regardless of green CI. An Android test is sufficient for most PRs. iOS testing is also required when the change touches iOS-native code (`ios/`, Swift/Objective-C, `Podfile`/pods, the iOS extension targets) or iOS-specific rendering or behavior (maintainer decision 2026-10-24, replacing the 2026-07-06 rule that required both platforms for every PR).

- WHY: PR CI runs only unit tests, lint, formatting, and type-check on Linux (Section 5). It never builds or launches the mobile app, so CI green proves almost nothing about runtime behavior. Native modules and some rendering differ per platform, which is why iOS-native and iOS-specific changes still need an iOS run.
- CONTRIBUTING.md asks for testing "on both iOS and Android if possible" and on both for cosmetic/UI changes. Testing both is still welcome; the maintainer minimum is the rule above.
- The PR template's platform and backend checkboxes (Section 3) are how you attest to this. Tick only the platforms you tested.

## 2. Change classification and gates

Classify every change before starting. When a change spans classes, the strictest gate applies.

| Class | What counts | Gate before coding | Gate before merge |
|---|---|---|---|
| **Funds-touching** | Sending/receiving payments, invoice creation/decoding, channel open/close, fee logic, seed/key handling: `views/Send.tsx`, `views/PaymentRequest.tsx`, `stores/TransactionsStore.ts`, `backends/*`, `utils/BackendUtils.ts`, swap/Cashu/NWC payment flows | Open an issue / discuss approach first (CONTRIBUTING "Share Early, Share Often") | Minimal diff (Rule 3); manual device test (Rule 4: Android, plus iOS if iOS-native or iOS-specific); test on every backend the code path can reach, recorded in the PR template matrix; regression test if it's a bug fix |
| **Storage-touching** | `zeus-settings-v2` blob shape, any keychain key, `storage/index.ts`, migrations, changed defaults for existing users | **Maintainer sign-off + migration plan, always** (Rule 1) | Migration follows the gated pattern in zeus-storage-and-migrations; manual test including upgrade-from-previous-version (Rule 4; keychain behavior differs on iOS, so test iOS when the change touches iOS keychain paths) |
| **UI-only** | Screens/components with no store-shape or payment-logic change | None beyond checking for an existing issue/PR | Manual device test (Rule 4); add an iOS run when the UI is iOS-specific or renders differently there (CONTRIBUTING asks for both platforms on UI changes); screenshots/video in the PR; theme check (styling violations fail the Lint CI job, see zeus-validation-and-qa); new user-facing strings go in `locales/en.json` only (Section 7) |
| **Docs-only** | `README.md`, `CONTRIBUTING.md`, `CODE_REVIEW.md`, `docs/*` | None | `docs:` commit prefix; no drive-by doc edits inside code PRs — known stale text is fixed via dedicated docs commits, not opportunistically |
| **Dependency** | Any `package.json` addition/major bump | **Discuss with maintainers first** (Section 6) | PR template third-party-deps section filled; verify `yarn.lock` updated and both platforms still build (a dependency with native code or pods changes the iOS build, so it needs an iOS run) |
| **Locales** | Translation strings | — | Only `locales/en.json` (Section 7) |

## 3. PR process

### The template is sacred

`.github/PULL_REQUEST_TEMPLATE.md` — **never delete or replace it**; fill in every section (CONTRIBUTING.md states this explicitly). Its required sections, as of 2026-07-06:

1. **Description** — issue reference (`ZEUS-0000` placeholder), description + screenshots.
2. **Category checkboxes** — new feature / bug fix / code refactor / configuration change / locales update / quality assurance / other.
3. **Checklist** — you ran `yarn run tsc`, `yarn run lint`, `yarn run prettier`, `yarn run test` (i.e. everything `yarn verify` runs).
4. **Testing** — did you add unit tests for modified or added testable logic; bug fixes should include a test that would have caught the bug (options: "No, I'm a fool" / Yes / N/A).
5. **Platform matrix**: Android and iOS checkboxes, with OS version and phone model/VM. This is where Rule 4 is attested; tick only what you tested.
6. **Backend testing matrix** — which of the 7 node types you tested against, with node/API versions: On-device: LDK Node, Embedded LND; Remote: LND (REST), LND (Lightning Node Connect), Core Lightning (CLNRest), Nostr Wallet Connect, LndHub.
7. **Locales** — new translatable text flagged; acknowledgment that translations happen on Transifex, not in-repo.
8. **Third-party dependencies** — whether contributors must re-run `yarn`, whether `package.json`/`yarn.lock` changed, both-platform install verified.
9. **Other** — README or onboarding updates needed?

### First-time contributors: proof of work

Per CONTRIBUTING.md: first-time contributors submitting features or UI changes **must attach screenshot or video evidence** that the change works, directly in the PR description. PRs without it are closed within 24 hours; repeat offenders are blocked. Also: no trivial typo/whitespace first PRs; issue assignment is team-only — just comment that you've started.

First-time contributors must also state in the PR description whether AI tools wrote any part of the contribution (code, tests, commit messages, PR text) and, if so, list each tool and model and what it was used for (CONTRIBUTING.md "Disclosing AI Assistance", added in `5a13ad257`). AI-assisted PRs are accepted; the author must be able to explain the change, and the testing and proof-of-work rules still apply.

### Review vocabulary (Bitcoin-Core style, defined in CODE_REVIEW.md)

| Term | Meaning |
|---|---|
| `ACK` | Full approval: code reviewed AND changes tested. Usually cites the commit hash: `ACK 3a4b5c6` |
| `tACK` | Tested the changes, but no full code review |
| `cACK` | Concept ACK — agree with the approach, didn't review the implementation |
| `NACK` | Recommend against merging; must include detailed reasoning |
| `Nitpick/nit` | Minor, non-blocking suggestion |

### Review flow

- Fetch a PR locally: `git fetch origin pull/<N>/head:pr-<N>` then `git checkout pr-<N>` (from CODE_REVIEW.md).
- During review, push **fixup commits** (easy to re-review); **squash before merge**. Rebase on master; no merge commits in the branch.
- Merge requirements (CONTRIBUTING.md): all CI checks pass, ≥1 maintainer approval, no unresolved conversations, up to date with base.
- What GitHub enforces on `master` (`gh api repos/ZeusLN/zeus/branches/master/protection`, checked 2026-10-24): 1 approving review, stale approvals dismissed on new pushes, and the branch must be up to date with `master` (`strict: true`). The required-status-checks list is empty, so a red CI check does not block the merge button; conversation resolution, signed commits and linear history are not required; admins are not subject to the rules; force pushes to `master` are allowed and deletion is blocked. The rest of the CONTRIBUTING.md list is enforced by maintainers, not by GitHub.
- Review checklist highlights (full list in CODE_REVIEW.md): no sensitive data (keys, macaroons, seeds) logged or exposed; inputs validated on payment paths; no potential fund-loss scenarios; no unnecessary `any` types; works across themes/locales/font sizes; commits atomic. Separately, CONTRIBUTING.md ("Test Coverage") requires that bug fixes include a test that would have caught the bug.

## 4. Commit style

CONTRIBUTING.md prescribes `component:` prefixes (`views:`, `stores:`, `backends:`, `utils:`, `build:`, `docs:`, `tests:`), and current master history follows it. Of the last 200 commit subjects at `3dc9f83e6`, 56 are merge commits, 98 use an area or component prefix (often nested, `views: Tools: NodeConfigExportImport: ...`, or a store/file name such as `stores: LSPStore:` or `patches:`), and 22 use conventional-commit prefixes, mostly Dependabot's `chore(deps):`. Conventional prefixes are still tolerated in review, but default to the CONTRIBUTING.md component prefixes. Real examples from `git log`:

```
views: Tools: NodeConfigExportImport: hide Export when no wallet can be exported
stores: LSPStore: validate the LSPS7 extendable_channels list
utils: KeychainRecoveryUtils: offer the cloud settings copy over an empty one
patches: make iOS keychain overwrites atomic
build: revert pod-install to 0.1.38 to fix Xcode Cloud
chore(deps): bump fast-uri in /zeus_modules/@lightninglabs/lnc-core
```

Rules:

- Subject ≤ ~50 chars where possible; body wrapped at 72, explaining problem + why this approach (CONTRIBUTING.md).
- Atomic commits; each should ideally pass `yarn verify` independently.
- Version bumps are exactly `Version bump: vX.Y.Z[-alpha|-alphaN|-betaN|-rcN]` (e.g. `Version bump: v13.2.4-alpha`, `Version bump: v13.2.3-rc1`); the final release bump has no suffix (`Version bump: v13.2.3`, on the `v13.2.3-branch` release branch). Maintainer-only.
- Branch names: `feature/...`, `fix/...`, `refactor/...`.
- When citing hashes in commit messages or discussions, use first-parent master hashes: `git log --all` contains duplicated/grafted merge hashes (e.g. PR #3444 appears as both `28bc50f5e` and `f47ef1acf`).

## 5. CI reality: green PR = exactly 4 checks

Verified in `.github/workflows/` at `3dc9f83e6`: exactly four workflows trigger on `pull_request`:

| Check name | Workflow file | Runs |
|---|---|---|
| Test | `test.yml` | `yarn run test:coverage --coverageReporters=json-summary` (jest, all suites, plus a coverage summary artifact) |
| Lint | `lint.yml` | `yarn run lint` (`eslint .`, including `prettier/prettier`, the jest focused/disabled-test rules, and the local `zeus/no-themecolor-in-static-stylesheet` and `zeus/no-negative-layout-offset` rules) |
| Prettier | `prettier.yml` | `yarn run prettier` (format check) |
| Typescript Check | `tsc.yml` | `yarn run tsc` |

`coverage-comment.yml` runs after a successful Test run on a PR (`workflow_run`) and posts or updates one coverage comment. It reports coverage and never fails a PR on it.

All four = `yarn verify` locally (`package.json`: `concurrently "yarn test" "yarn prettier" "yarn tsc" "yarn lint"`). Run `yarn verify` before every push. Details of each job's traps (themeColor style-sheet lint rule, Prettier pinned at 2.4.1, jest transform whitelist): **zeus-validation-and-qa**.

What PR CI does **NOT** do: no mobile build, no dependency scan. `build-android.yml` and `dependency-scan.yml` are `workflow_dispatch`-only (manually triggered); `telegram.yml` is a push/issues/release notifier, not a check. This is exactly why Rule 4 (manual device testing) exists.

CI runs on ubuntu-latest, Node 24.x, `yarn install --frozen-lockfile`.

## 6. Dependency policy

- **Discuss before adding** any new library (CONTRIBUTING.md "Discuss new dependencies"): there may be an existing in-repo solution or a preferred alternative, and every dependency is supply-chain surface in a funds-handling app.
- Zeus vendors some packages under `zeus_modules/` (some via `file:` refs, some imported by relative path and deliberately NOT in `package.json`). Never `yarn add` something that lives there. Mechanics: **zeus-build-and-env**.
- If a PR modifies dependencies: tick the PR-template third-party section, confirm `package.json` + `yarn.lock` are consistent, and verify install on both iOS and Android.
- Dependabot (`.github/dependabot.yml`) opens weekly npm PRs with the `chore(deps)` prefix and weekly GitHub Actions PRs with the `ci` prefix. npm minor and patch bumps are grouped into one `minor-and-patch` PR; each major bump gets its own PR so native or crypto-sensitive upgrades are tested alone. `pod-install` majors are ignored: 1.x broke `yarn install` on Xcode Cloud and most dev Macs, and #5416 (`99b876551`) reverted the #5283 bump to 0.1.38. Treat a Dependabot major like any other dependency change: test it before approving.

## 7. Locales

- **Only `locales/en.json` may be edited in-repo.** The other 36 locale files (37 total in `locales/` as of 2026-10-24) are managed through Transifex (https://explore.transifex.com/ZeusLN/zeus/) and must never be modified directly; such PRs get rejected.
- All user-facing strings must go through the localization system; no hardcoded UI text.
- Want to translate? Request a language role on Transifex, not a PR.

## 8. Docs house rules

- **In-repo docs inventory**: `README.md` (project overview, feature list, integration guides), `CONTRIBUTING.md` (contribution process — source of truth for everything in Sections 2–4 here), `CODE_REVIEW.md` (review process and vocabulary), `docs/Bounties.md` (bounty program; reportedly partially stale — check open bounties against the issue tracker before relying on it), `docs/RemoteConnections.md` (node-connection guides), `docs/ReproducibleBuilds.md` (Android-only reproducible builds).
- **External user docs of record**: https://docs.zeusln.app/ — README links there for all user-facing feature documentation. User-behavior changes may need updates there (out-of-repo), plus README/onboarding per the PR template's "Other" section.
- **License**: AGPLv3 (see `LICENSE`). All contributions must be AGPLv3-compatible; submitting a PR is agreement to that (CONTRIBUTING.md).
- **Signing**: all releases and all maintainer commits since 2021-10-20 are PGP-signed with key `AAC48DE8AB8DEE84` (full fingerprint `96C225207F2137E278C31CF7AAC48DE8AB8DEE84`, Zeus LN <zeusln@tutanota.com>); public key in `PGP.txt` (README.md "Release + Commit Verification" section). Contributors are not required to sign.
- Writing style for docs changes: match existing docs; `docs:` commit prefix; don't bundle doc fixes into code PRs.

## Pre-PR checklist (condensed)

1. Classified the change (Section 2)? Storage-touching → maintainer sign-off FIRST. Funds-touching → minimal diff, discussed first.
2. `yarn verify` green locally.
3. Manually tested on a device (Rule 4: Android suffices unless the change touches iOS-native code or iOS-specific rendering/behavior, then iOS too); backends exercised and recorded.
4. New strings in `locales/en.json` only; no other locale files touched.
5. Commits: CONTRIBUTING.md component-prefix style (conventional-commit-ish prefixes are tolerated in practice), atomic, rebased on master.
6. PR template fully filled in, not deleted; screenshots for UI changes (mandatory for first-timers); first-timers also disclose AI assistance.
7. If a dependency changed: was it discussed first?

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha). Re-verified 2026-10-24 against master `3dc9f83e6` (v13.2.4-alpha): Rule 3 WHY, Rule 4, Section 2 gates, first-time contributor rules, merge requirements and branch protection, Section 4 commit style and version-bump format, Section 5 CI table, Section 6 Dependabot, Section 7 locale count. Maintainer-stated rules (Section 1) confirmed verbally 2026-07-06, Rule 4 revised 2026-10-24. They appear in no repo document; everything else was verified by reading the cited files or running the commands below.

Re-verify volatile facts:

| Fact | Command |
|---|---|
| HEAD / version | `git log -1 --format='%h %s'` |
| PR CI = exactly 4 workflows | `grep -l 'pull_request:' .github/workflows/*.yml` (expect lint, prettier, test, tsc) |
| Branch protection on `master` | `gh api repos/ZeusLN/zeus/branches/master/protection` |
| Dependabot policy | `cat .github/dependabot.yml` |
| build/scan not in PR CI | `grep -A2 '^on:' .github/workflows/build-android.yml .github/workflows/dependency-scan.yml` (expect `workflow_dispatch`) |
| `yarn verify` composition | `grep '"verify"' package.json` |
| CI Node version | `grep node-version .github/workflows/test.yml` (24.x as of 2026-07-06) |
| PR template sections | `cat .github/PULL_REQUEST_TEMPLATE.md` |
| Locale file count / en-only rule | `ls locales \| wc -l` (37 as of 2026-10-24); CONTRIBUTING.md "Internationalization" |
| Proof-of-work rule | CONTRIBUTING.md "Proof of Work for First-Time Contributors" |
| AI disclosure rule | CONTRIBUTING.md "Disclosing AI Assistance" |
| ACK vocabulary | CODE_REVIEW.md "Review Approval Terminology" |
| Commit-style drift | `git log --format='%s' -200 \| grep -Ec '^(fix\|ui\|refactor\|feat\|chore\|docs)[:(]'` (22 at `3dc9f83e6`) |
| Version-bump format | `git log --format='%s' --grep='Version bump' -5` |
| Incident hashes | `git log -1 --format='%h %ad %s' --date=short <hash>` for `5f533bb12`, `7d8678457`, `7ed901a10`, `46f2bac00`, `e808fd71a`, `ed161541a`, `fdad118ed`, `93227029e`, `28bc50f5e` |
| Revert-of-a-PR check | `git log --first-parent --grep='revert-<PR#>'` |
| PGP key | `gpg --show-keys PGP.txt`; README.md "Release + Commit Verification" |
| License | `grep -m1 'GNU AFFERO' LICENSE` |
| Docs inventory | `ls docs/` |
