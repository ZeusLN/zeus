import { E2EElement, waitForVisible } from '../helpers/elements';
import { withoutSynchronization } from '../helpers/synchronization';
import AddMintScreen from '../screens/AddMintScreen';
import Header from '../screens/Header';
import KeypadScreen from '../screens/KeypadScreen';
import MintDiscoveryScreen from '../screens/MintDiscoveryScreen';
import MintScreen from '../screens/MintScreen';
import MintsScreen from '../screens/MintsScreen';
import RecommendedSettingsScreen from '../screens/RecommendedSettingsScreen';
import WalletScreen from '../screens/WalletScreen';
import {
    answerQuestionnaire,
    openRecommendedSettings,
    startOnboarding
} from './onboarding';

// Creating a wallet builds and starts a real LDK Node on mainnet, which syncs
// in the background.
export const WALLET_START_TIMEOUT_MS = 180000;

// A public Cashu mint, added by URL so ecash tests don't depend on Nostr
// relays returning recommended mints. E2E_MINT_URL overrides it.
const TEST_MINT_URL =
    process.env.E2E_MINT_URL || 'https://mint.minibits.cash/Bitcoin';

const createWallet = async (ready: E2EElement): Promise<void> => {
    await RecommendedSettingsScreen.createWalletButton.tap();

    await withoutSynchronization(() =>
        waitForVisible(ready, WALLET_START_TIMEOUT_MS)
    );
};

// Skips the mint recommendations, which come from Nostr relays, so the
// summary's Create wallet doesn't wait on them.
const chooseMintsLater = async (): Promise<void> => {
    await RecommendedSettingsScreen.mintSourceRow.tap();
    await MintDiscoveryScreen.waitUntilDisplayed();
    await MintDiscoveryScreen.choose('later');
    await MintDiscoveryScreen.selectButton.tap();
    await RecommendedSettingsScreen.waitUntilDisplayed();
};

// From the keypad, adds the mint through Mints and Add mint, and returns to
// the keypad with it selected.
export const addMint = async (url: string = TEST_MINT_URL): Promise<void> => {
    await KeypadScreen.mintPicker.tap();
    await MintsScreen.waitUntilDisplayed();
    await MintsScreen.addButton.tap();
    await AddMintScreen.waitUntilDisplayed();
    await AddMintScreen.lookUp(url);
    await MintScreen.waitForLookup();
    await MintScreen.addButton.tap();
    await MintsScreen.waitUntilDisplayed();
    await Header.goBack();
    await KeypadScreen.waitUntilDisplayed();
};

// Creates an ecash wallet on LDK Node with one known mint, and waits for the
// keypad, where an ecash wallet opens.
export const createEcashWallet = async (): Promise<void> => {
    await openRecommendedSettings();
    await chooseMintsLater();
    await createWallet(KeypadScreen.amount);
    await addMint();
};

// Creates a self-custodial LDK Node wallet, which needs no mints, and waits for
// its tabs. The header shows earlier, while the wallet is still connecting.
export const createSelfCustodialWallet = async (): Promise<void> => {
    await startOnboarding();
    await answerQuestionnaire('selfCustody', 'ldkNode');
    await createWallet(WalletScreen.tab('Balance'));
};
