# End-to-end tests

ZEUS uses [Detox](https://wix.github.io/Detox/) to drive the app on an iOS
simulator or an Android emulator. The suite lives in `e2e/` and is separate
from the Jest unit tests that `yarn test` runs.

## Running the suite

### iOS

```bash
yarn e2e:build:ios
yarn e2e:test:ios
```

This builds and tests a Release build. The JavaScript is bundled into the app,
so Metro is not needed. Rebuild after every change, native or JavaScript; the
first build is slow, later ones are incremental.

The suite runs on the iPhone simulator that is already booted. If none is
booted, it boots an iPhone 17 running iOS 26.5. To pick one by name:

```bash
DETOX_IOS_DEVICE="iPhone 17 Pro" yarn e2e:test:ios
```

Each spec file starts from a fresh install: it uninstalls ZEUS and resets the
simulator's keychain, because ZEUS keeps its settings there and the keychain
survives an uninstall. Don't run the suite on a simulator whose ZEUS data or
keychain you want to keep.

System prompts never interrupt a run: notifications are granted before launch,
and "Paste from Other Apps" is set to Allow, because the simulator syncs the
Mac's clipboard and ZEUS reads the clipboard by default.

While writing tests, the debug variant avoids rebuilding for JavaScript
changes. It loads the bundle from Metro, so start `yarn start` first:

```bash
yarn e2e:build:ios:debug
yarn e2e:test:ios:debug
```

### Android

```bash
yarn start
yarn e2e:build:android
yarn e2e:test:android
```

Android runs a debug build against Metro. The emulator defaults to the
`Pixel_8` AVD; set `DETOX_ANDROID_AVD` to use another. The build compiles
`arm64-v8a` only; set `DETOX_ANDROID_ABI=x86_64` on an Intel machine.

### Options

- One file: `yarn e2e:test:ios e2e/specs/onboarding/questionnaire.e2e.ts`
- One test: add `-t "explains self-custody"`. The tests in a file build on
  each other, so a single test may need the ones before it.
- Metro on another port (debug builds): set `RCT_METRO_PORT`
- Screenshots and logs of failing tests: `e2e/artifacts/`

## Layout

| Path | Contents |
| --- | --- |
| `utils/TestIds.ts` | Every `testID` the suite uses, shared with the views |
| `e2e/screens/` | One page object per screen: element getters and `waitUntilDisplayed()` |
| `e2e/flows/` | Multi-screen journeys reused across specs, such as `openRecommendedSettings()` |
| `e2e/helpers/` | App launch, element queries and locale strings |
| `e2e/specs/` | The tests, one file per feature (`*.e2e.ts`) |

## Writing tests

- Each spec file installs the app once in `beforeAll` and walks through its
  screens as a journey: every test starts on the screen where the previous one
  ended. Keep that order meaningful and say in each test which step it checks.
- Select elements by `testID`, never by visible text. Add the id to
  `utils/TestIds.ts` and pass it to the component.
- To assert copy, use `expectLocalizedText(element, 'locale.key')` or
  `t('locale.key')`. Both read `locales/en.json`, so a copy change doesn't
  break the test.
- Keep element lookups in the page object and multi-step navigation in a flow,
  so specs read as the user's steps.
- Wait with `waitForVisible()` instead of fixed sleeps. Detox ignores network
  activity when deciding whether the app is idle, because ZEUS keeps Nostr and
  mint lookups running in the background.

## Coverage

| Spec | Screens and components |
| --- | --- |
| `onboarding/introSplash` | Splash actions, default language, menu open and close, guided set-up entry and back |
| `onboarding/language` | Language list, search, empty search, back out, apply, persist across restart, switch back |
| `onboarding/questionnaire` | Setup choice, wallet setup and remote connection, wallet type and node choice with every explanation, device check, each answer combination on the summary, back navigation to the splash |
| `onboarding/recommendedSettings` | Every summary row and its default, editing wallet type and node from the summary and back to the defaults, opening each editor |
| `onboarding/mintDiscovery` | Every mint source, top mints, custom npub field and validation, choosing later, backing out versus selecting |
| `onboarding/walletSettings` | Clipboard switch and its explainer, fiat switch, rates source, currency search and selection, security settings, changes carried to the summary |
| `onboarding/walletCreation` | Creating the wallet starts and shows its progress screen |
| `wallet/keypad` | Entering, grouping, deleting and clearing an amount, singular sat, ecash and self-custody modes, switching units through the currency picker, requesting ecash, the send options |
| `wallet/walletHome` | Wallet tabs, the balance of each layer, the activity list, the header menu and wallet list |
| `walletConfiguration` | Picking a backend for a remote wallet connection |

The `wallet/` specs create a real wallet first, with a flow from
`e2e/flows/wallet.ts`. Each builds and starts an LDK Node on mainnet, so those
specs need network access and take a minute or two to reach the wallet. Detox
stops waiting for the app to go idle while the node starts.

- `createEcashWallet()`: the recommended ecash wallet, for tests that need a
  mint. It waits for the recommended mints, which come from Nostr relays; if
  the relays return none, the spec fails in its setup.
- `createSelfCustodialWallet()`: a self-custodial wallet, which needs no mint.
