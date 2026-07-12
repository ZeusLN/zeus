---
name: zeus-research-methodology
description: The discipline that turns a hunch into an accepted change in Zeus — or a documented retirement. Load BEFORE proposing a fix for a bug whose cause you have not proven, designing an experiment or feature rollout, deciding whether a hypothesis is confirmed, promoting an experimental setting to default, deprecating/removing a flag or feature, or deciding when to abandon an investigation. Triggers/symptoms - "I think the cause is X", "should this be behind a flag", "can we make this the default now", "is this feature dead, can I delete it", "how do I prove this fix works", "my fix works on my machine", "when do I give up on this bug", "where do Zeus features come from", "hypothesis", "experiment", "root cause", "retire this setting".
---

# Zeus Research Methodology

How an idea (a bug hypothesis, a feature, a protocol integration) becomes an accepted change in Zeus — a React Native Bitcoin/Lightning wallet — or gets retired with a paper trail. Zeus moves real money across 7 node backends on 2 mobile platforms with near-zero automated test coverage outside `utils/`; the methodology below is what has actually kept quality up, reconstructed from the repo's own history. Every stage, rule, and example here is verifiable with the commands in the final section.

Glossary (defined once, used throughout):

- **Backend** — one of the 7 node implementations Zeus can drive: embedded LND, LDK Node (both on-device), remote LND REST, Lightning Node Connect (LNC), CLNRest, LndHub, Nostr Wallet Connect (NWC). Details: zeus-backends-and-capabilities.
- **Settings blob** — the single keychain JSON object (key `zeus-settings-v2`) holding ALL settings and wallet secrets. **MOD_KEY migration** — Zeus's one-shot settings-migration pattern: a flag key checked in legacy storage, mutate settings, persist, set flag (see `utils/MigrationUtils.ts`; recipes live in zeus-storage-and-migrations).
- **Fresh vs migrated user** — a new install gets the inline defaults in `stores/SettingsStore.ts`; an upgrading user gets defaults *as rewritten by migrations*. The two populations can legitimately diverge (worked example in Section 2).
- **`supports*()` capability flag** — per-backend boolean method gating features; views must branch on these, never on the backend name.
- **LSP / LSPS1 / LSPS7** — Lightning Service Provider (sells inbound channel capacity); LSPS1/LSPS7 are the standardized channel-purchase/extension protocols.
- **Pathfinding (apriori / bimodal)** — LND's two payment-route probability estimators; bimodal is the newer experimental one.
- **Bolt / SQLite** — the two on-disk database backends of embedded LND.
- **Fabric / New Architecture** — React Native's re-written rendering layer, ON in Zeus since RN 0.83.1; old layout/animation patterns can crash under it.
- **Same-day revert** — Zeus's release-pressure policy: a regression found in release testing is reverted, not forward-fixed (policy owned by zeus-change-control).

## When to use / When NOT to use

USE this skill for: the evidence bar for claiming a root cause or a working fix; how to design an experiment (prediction-first); the observed lifecycle idea → flag → default → retirement; retirement/deprecation discipline; where ideas come from; the hypothesis template and promotion checklist; when and how to stop.

Do NOT use this skill for — go to the sibling instead:

| Need | Sibling skill |
|---|---|
| The actual gates/sign-offs/PR mechanics your promoted change must pass | zeus-change-control |
| Writing the migration your default-change needs | zeus-storage-and-migrations |
| Adding the setting itself (defaults, options, checklist) | zeus-config-and-flags |
| Live-debugging a symptom right now (triage tables) | zeus-debugging-playbook |
| Formal analysis machinery (race analysis, migration proofs) | zeus-proof-and-analysis-toolkit |
| Full incident narratives with evidence chains | zeus-failure-archaeology |
| What counts as test evidence, jest mechanics | zeus-validation-and-qa |
| Open problems worth researching / external claim standards | zeus-research-frontier |

## 1. The evidence bar

A hypothesis about a Zeus bug, and a fix for it, are ACCEPTED only when all three hold:

### 1a. One mechanism explains ALL observations — including the negatives

If your mechanism explains why the bug happens on Android but not why it *doesn't* happen on iOS, you don't have the mechanism yet. Negative observations (backends/platforms/paths where the bug does NOT reproduce) are constraints, not noise.

Repo-history motivation: the invoice-expiry migration bug produced "3600 hours" displays only for *upgraded* users, never fresh installs — a repair first shipped in `26d4215ea` (2026-05-30) covering only the legacy load path, and had to be shipped **again** (`e8e5b8811`, 2026-06-01, "run invoice expiry display repair on zeus-settings-v2 path") because the first pass missed that settings load through two distinct code paths (modern `zeus-settings-v2` vs legacy) in `stores/SettingsStore.ts getSettings`. A mechanism that had explained "why only some users" fully would have named both paths the first time.

### 1b. Predictions are written down BEFORE the experiment runs

State the observable outcome your hypothesis entails, with numbers, before you run anything. Format:

> If [mechanism] is the cause, then [concrete experiment] must produce [observable outcome with a threshold], and [control experiment] must NOT.

Example of the required specificity: "If the in-flight request dedup cache is the cause, the second identical request must return in <5ms with the *same* error object instance; after `clearCachedCalls()` it must take network time again."

A prediction you write after seeing the data is a description, not a test. If the outcome surprises you, the hypothesis is wrong or incomplete — do not quietly widen it to fit; write a new prediction and re-run.

### 1c. The fix survives ASSIGNED adversarial refutation

Before promotion, someone other than the author — a reviewer, or an AI model given this instruction verbatim — is assigned to actively try to BREAK the fix, not confirm it. The refutation sweep, in priority order (each item has caught or would have caught a real Zeus incident):

| Attack axis | What to try | Real miss it targets |
|---|---|---|
| Other 6 backends | Does the fix assume methods/semantics only your backend has? Does a `supports*` flag gate it? Check inherited flags: LndHub extends LND and silently inherits `supportsChannelFundMax = true` with no override (verify: `grep supportsChannelFundMax backends/LndHub.ts` returns nothing) | Missing capability gates are historically the top cross-backend crash source |
| Both platforms | Run it on iOS AND Android hardware; Fabric rendering, keychain, and background behavior all differ | RN New-Arch fallout; iCloud is iOS-only |
| Upgrade paths | Fresh install AND legacy→v2 migrated AND already-on-v2 upgraded user; both settings load paths | Invoice-expiry repair re-shipped (`e8e5b8811`; first pass `26d4215ea` covered only the legacy path); iCloud fix left stale synced copies for upgraders, needing a third migration (`46f2bac00`, 2026-01-14) |
| Re-entrancy/lifecycle | Trigger the flow twice fast; background/foreground mid-flow; kill/restart | `fdad118ed` lifecycle refactor (2025-10-24) caused infinite loading, found only 3 weeks later (`93227029e`) |
| Revert the fix | Does the bug come back on demand? If you can't re-trigger the bug without the fix, you haven't proven the fix did anything | General |

Record the refutation attempts and their outcomes in the PR description. "I tried to break it via X, Y, Z and failed" is evidence; "works for me" is not.

## 2. The idea lifecycle observed in this repo

Zeus does not have a written RFC process. The observed, repeated lifecycle is:

```
discussion → experiment behind a setting (default OFF) → default ON (fresh installs)
   → [bug or obsolescence] → migrate existing users' default via MOD_KEY migration
   → retire: flag marked optional + "// deprecated", RETAINED in the blob forever
```

**Stage 0 — discussion-first.** `CONTRIBUTING.md` ("Share Early, Share Often"): open an issue to discuss the approach before writing code for significant changes; discuss new dependencies with maintainers BEFORE adding them. Gates and mechanics: zeus-change-control.

**Stage 1 — experiment behind a default-off setting.** New risky behavior lands as an opt-in boolean in the settings blob with an inline default in `stores/SettingsStore.ts`. Adding the setting correctly (shallow-merge trap, defaults): zeus-config-and-flags.

**Stage 2 — promote the default.** Flip the inline default (affects fresh installs only) and, if existing users should follow, ship a MOD_KEY migration (zeus-storage-and-migrations owns the recipe; the migration MUST pass a real object to `setSettings`, never a `JSON.stringify`'d one — that corrupted MobX observables, fixed in `7ed901a10`, #4150).

**Stage 3 — demote or retire.** When upstream bugs or product decisions kill the experiment: migrate existing users OFF via a new MOD_KEY, and/or mark the flag deprecated-but-retained (Section 3).

### Worked example A: `bimodalPathfinding` (full lifecycle; all hashes reachable from master `c5fd094fb`)

| Date | Commit | Stage |
|---|---|---|
| 2023-08-07 | `cc735f923` | Introduced as opt-in, default `false` (experiment) |
| 2023-10-03 | `519dea9ad` | Promoted: default `true` |
| 2024-09-16 | `88dd94abe` | Demoted for existing users: "switch to apriori pathfinding for now" — MOD_KEY migration `bimodal-bug-9085` flips migrated users to `false` because of upstream bug lnd#9085 (URL in the code comment, `utils/MigrationUtils.ts`) |
| today | — | Fresh-install default remains `true` (`grep bimodalPathfinding stores/SettingsStore.ts`) while users who ran the migration stay `false` — a **deliberate fresh-vs-migrated divergence**, not a bug |

Lessons: upstream bugs demote experiments without deleting them; MOD_KEY migrations are the tool for touching existing users; fresh/migrated divergence is an accepted end state (second known case: `showMillisatoshiAmounts`).

### Worked example B: `lsps1ShowPurchaseButton` (introduce → retire)

Introduced with the LSPS1 client (`f81439ee7`, 2024-05-06), with a migration setting it `true` for existing users. Retired by `c89b75426` (2025-07-16, "remove 'Purchase inbound channel' button"): the UI went away, the inline default and the migration block were deleted, but the interface key was kept as `lsps1ShowPurchaseButton?: boolean; // deprecated`. The key was never removed from users' blobs.

### Worked example C: embedded LND SQLite/Bolt (platform experiment → selector + conservative default)

`ef4a42112` (2026-03-27) restricted SQLite to iOS → `3c6f4175e` (next day) re-enabled it on Android → `d475ef2b4` (2026-04-20, #4002) settled on: default **Bolt** for new wallets (`isSqlite: false` in `utils/WalletCreationUtils.ts`) plus a per-wallet DB selector in Wallet Configuration → `3e04e6bf2` (2026-04-23) fixed a restart crash the selector exposed. Lesson: when an experiment thrashes across platforms, converge on a user-visible selector with the conservative option as default, rather than flip-flopping a hidden global.

## 3. Retirement discipline

Zeus retires ideas without destroying evidence or user data. Follow these three patterns; never invent a fourth.

**3a. Deprecated flags are RETAINED, never hard-deleted.** Current deprecated-retained keys in `stores/SettingsStore.ts` (all marked `// deprecated`, verified 2026-07-06): `defaultFeeMethod`, `displayAmountOnInvoice`, `squareEnabled`, `automaticallyRequestOlympusChannels`, `lsps1ShowPurchaseButton`. Removing a key from users' `zeus-settings-v2` blobs is a storage-format change and goes through the storage gate — maintainer sign-off plus migration plan, always (rule owned by zeus-change-control; mechanics by zeus-storage-and-migrations). The minimum retirement is a `// deprecated` comment on the interface field; the inline default MAY also be deleted and the field marked optional (done for `lsps1ShowPurchaseButton` in `c89b75426`), but 4 of the 5 current deprecated keys retain their inline defaults (and `automaticallyRequestOlympusChannels` is not marked optional). Either way, the bytes stay in users' blobs.

**3b. Dead UI is fenced in place, with a marker.** Two observed fencing styles:
- `{false && ( ... )}` around the JSX plus a TODO comment stating the re-enable condition — e.g. the LSPS7 refund-onchain-address block in `views/LSPS7/index.tsx` ("TODO add conditions for refund onchain address").
- A comment citing a `ZEUS-NNNN` private-tracker ID — e.g. `// TODO re-enable for iOS once ZEUS-3514 is resolved` in `views/Wallet/Wallet.tsx` (bottom-tab animation), and the LNC `checkPerms` workaround `// ZEUS-3642` in `backends/LightningNodeConnect.ts`. `ZEUS-NNNN` IDs map (at least sometimes) to ZeusLN/zeus GitHub issue numbers — the ZEUS-3642 comment links to https://github.com/ZeusLN/zeus/issues/3642 right in `backends/LightningNodeConnect.ts`. Check github.com/ZeusLN/zeus/issues/NNNN first; if the issue is missing or not readable, treat the fenced code as intentionally dormant — do not delete or re-enable it without maintainer confirmation.

**3c. Stalled work is left as archaeology, not deleted.** Abandoned or paused efforts survive as branches (observed 2026-07-06 on maintainer-fork remotes in a contributor clone — NOT branches of ZeusLN/zeus itself; treat as leads, environment-dependent): `android-16kb-page-size` (single commit, 2025-10), `bip-321`, `cdk-init-remote-nodes` (remote-node Cashu), `cashu-backup`, `zeus-rgs` (partially landed elsewhere). Before restarting any such effort, run `git log master --oneline -S '<distinctive-symbol>'` to check whether it landed piecemeal already.

## 4. Where good ideas historically came from

Calibrate where to look before inventing from scratch:

1. **Upstream ecosystems, adapted.** The embedded-LND native layer (`lndmobile/`, `android/app/src/main/java/com/zeus/LndMobileService.java`) was adapted from Blixt Wallet — it still carries its author's `TODO(hsjoberg)`/`FIXME(hsjoberg)` markers (attribution inferred from those markers plus commit "Neutrino: update Blixt peers", `bd2bbd996`). LDK Node ships as a ZeusLN fork; Cashu rides the CDK Rust library. Pattern: adopt a proven implementation, fork only when Zeus needs diverge.
2. **Specs shipped early.** Zeus implements Lightning/ecash protocols close to spec publication: LSPS1 client landed 2024-05 (`f81439ee7`); LSPS7 (`views/LSPS7/`), NWC as both service and backend (`stores/NostrWalletConnectStore.ts`), Cashu multimint, CLINK. Early-spec work is EXPECTED to enter at lifecycle Stage 1 (flag, default off) and to keep dormant fenced UI (Section 3b) while the spec settles.
3. **User reports.** Telegram (`t.me/zeusLN`, linked from README.md and CONTRIBUTING.md) and GitHub issues are the primary bug-hypothesis source. A Telegram report is an observation, not a mechanism — it enters at Section 1, not straight to a fix.
4. **The same-day-revert loop as a quality mechanism.** Merged ≠ accepted. Release testing routinely ejects merged work the same day (NWC txlist: #3432 merged `285da755a` and reverted via #3444 `28bc50f5e` both on 2025-12-15; the iCloud PR #3307 likewise). Methodological consequences: (a) a revert is DATA — the idea returns to Stage 1 with a new constraint, it is not a rejection of the idea; (b) always check `git log --grep='revert-<PR#>'` before citing any merged commit as the accepted state. Revert policy and etiquette: zeus-change-control.

## 5. Hypothesis → experiment → numbers template, and the promotion checklist

### 5a. Investigation template (copy-paste into your issue/PR/notes)

```markdown
## Hypothesis
Mechanism (one sentence, causal):
Explains ALL of these observations:        [list, incl. where the bug does NOT occur]
Fails to explain (open):                   [be honest; empty = suspicious]

## Predictions (written BEFORE running anything)
P1: If the mechanism is right, [experiment] must show [observable, with number/threshold].
P2: Control — [experiment without the suspected factor] must NOT show it.

## Experiments & numbers
| # | Setup (backend, platform, fresh/migrated) | Predicted | Observed | Verdict |
|---|---|---|---|---|
| P1 |  |  |  | pass/fail |
| P2 |  |  |  | pass/fail |

## Fix & refutation record
Fix (minimal diff, no drive-by refactors — see zeus-change-control):
Refuter assigned:                          [person or model]
Refutation attempts (axis → outcome):      [other backends / other platform /
                                            upgrade paths / re-entrancy / fix reverted → bug returns]

## Status
[open | confirmed | fix merged (PR #) | reverted (PR #) | dead end → archaeology entry filed]
```

### 5b. Promotion checklist (experiment → default / merged fix)

All gates are owned by zeus-change-control; this list is the methodology-side ordering. Do not merge until every line is true:

- [ ] Discussion happened first (issue opened; deps discussed before adding — CONTRIBUTING.md).
- [ ] Evidence bar met: one mechanism, pre-registered predictions passed, adversarial refutation survived and RECORDED in the PR (Section 1).
- [ ] Manual evidence on BOTH platforms (iOS + Android, real hands-on — maintainer non-negotiable) and on every backend the code path can reach, recorded in the PR-template backend matrix.
- [ ] Bug fixes include a test that would have caught the bug (CONTRIBUTING.md "Test Coverage") — feasible today for `utils/` and `models/` code; see zeus-validation-and-qa for coverage reality.
- [ ] `yarn verify` green (= the 4 PR CI checks; anatomy in zeus-validation-and-qa).
- [ ] Default-change for existing users ships as a MOD_KEY migration (zeus-storage-and-migrations), which triggers the storage gate: maintainer sign-off + migration plan.
- [ ] **Revert-readiness**: the change is a single squashable unit that can be reverted same-day without a data migration. If reverting your change would strand users' data in a new format, it is not ready — redesign so the format change is separable, or get the storage gate's explicit plan for both directions.

### 5c. Escalation routing

- Fix touches send/receive/payment code → minimal-diff rule, zeus-change-control.
- Fix touches `zeus-settings-v2` / keychain / migrations → storage gate, zeus-storage-and-migrations.
- Hypothesis is about a start/stop/delete race → the live campaign in zeus-node-lifecycle-campaign.
- You need formal machinery (interleaving analysis, migration proof) → zeus-proof-and-analysis-toolkit.

## 6. When to stop: the documented dead end

Stop when any of these holds: (a) two full hypothesis cycles (Section 5a) ended with failed predictions and no surviving mechanism; (b) the fix would require breaking a maintainer non-negotiable (e.g. a payment-path refactor) for an unproven gain; (c) the bug is upstream and tracked there (then do what `88dd94abe` did: mitigate via settings/migration, link the upstream issue in a code comment, move on).

Stopping is a deliverable. File an entry in zeus-failure-archaeology (its skill owns the chronicle format) containing at minimum:

```markdown
### <symptom, one line>  [status: DEAD END — <date>]
- Observations: [incl. negatives]
- Hypotheses tried: H1 <mechanism> → prediction <P> → observed <O> → refuted
                    H2 ...
- Evidence: commit hashes, logs, device/backend matrix actually tested
- Upstream refs: [issue links, e.g. lnd#9085 pattern]
- What would reopen this: [the specific new observation that would justify another cycle]
```

A dead end without a written trail is the one outcome this methodology forbids: the repo's costliest sagas (iCloud keychain, RN-upgrade fallout) were expensive precisely where earlier attempts left no machine-findable record of what was already refuted. Fenced code and deprecated flags (Section 3) are the in-code half of the trail; the archaeology entry is the narrative half.

## Provenance and maintenance

Facts verified 2026-07-06 against master `c5fd094fb` (v13.1.3-alpha) by direct file reads and read-only git commands. Every cited commit hash was confirmed reachable from `c5fd094fb` via `git merge-base --is-ancestor <hash> c5fd094fb` (grafted `git log --all` duplicates avoided; note a clone's local `master` ref may lag — verify against the ZeusLN/zeus master tip). Branch leads are labeled environment-dependent. `TODO(hsjoberg)`→Blixt attribution is inferred from in-repo markers, labeled as such in Section 4. Re-verify volatile facts before relying on them:

| Fact | Re-verification command |
|---|---|
| HEAD / version | `git log --oneline -1 && grep '"version"' package.json` |
| Deprecated-retained flag list | `grep -n '// deprecated' stores/SettingsStore.ts` |
| bimodalPathfinding fresh default | `grep -n 'bimodalPathfinding' stores/SettingsStore.ts` |
| bimodal demotion migration + lnd#9085 link | `grep -n -B2 'bimodal-bug-9085' utils/MigrationUtils.ts` |
| MOD_KEY migration inventory | `grep -n 'MOD_KEY' utils/MigrationUtils.ts` |
| Two settings load paths (modern/legacy) | `grep -n 'modernSettings\|LEGACY_STORAGE_KEY' stores/SettingsStore.ts` |
| Fenced LSPS7 UI | `grep -n -B3 'false && (' views/LSPS7/index.tsx` |
| ZEUS-3514 / ZEUS-3642 fences | `grep -rn 'ZEUS-3514' views/Wallet/Wallet.tsx; grep -n 'ZEUS-3642' backends/LightningNodeConnect.ts` |
| LndHub capability-inheritance gap | `grep -n 'supportsChannelFundMax' backends/*.ts` (no LndHub line) |
| SQLite/Bolt conservative default | `grep -n 'isSqlite' utils/WalletCreationUtils.ts` |
| Same-day revert example | `git log --format='%h %ad %s' --date=short -1 285da755a; git log --format='%h %ad %s' --date=short -1 28bc50f5e` |
| Lifecycle example hashes | `git show --no-patch --format='%h %ad %s' --date=short cc735f923 519dea9ad 88dd94abe f81439ee7 c89b75426 ef4a42112 3c6f4175e d475ef2b4 3e04e6bf2 26d4215ea e8e5b8811 7ed901a10 fdad118ed 93227029e 46f2bac00` |
| Discussion-first + test-coverage rules | `grep -n -i 'open an issue first\|Discuss new dependencies\|would have caught the bug' CONTRIBUTING.md` |
| Stalled-branch leads (environment-dependent) | `git branch -r \| grep -E '16kb\|bip-321\|cashu-backup\|cdk-init\|zeus-rgs'` |
| Blixt-origin markers | `grep -rn 'hsjoberg' lndmobile/ android/app/src/main/java/com/zeus/` |
