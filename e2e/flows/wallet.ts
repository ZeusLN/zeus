import { device } from 'detox';

import { E2EElement, waitForVisible } from '../helpers/elements';
import KeypadScreen from '../screens/KeypadScreen';
import RecommendedSettingsScreen from '../screens/RecommendedSettingsScreen';
import WalletScreen from '../screens/WalletScreen';
import {
    answerQuestionnaire,
    openRecommendedSettings,
    startOnboarding
} from './onboarding';

// Creating a wallet builds and starts a real LDK Node on mainnet, which syncs
// in the background.
const WALLET_START_TIMEOUT_MS = 180000;

// The node keeps the app busy while it starts and first syncs, so Detox stops
// waiting for idle until the wallet is up.
const createWallet = async (ready: E2EElement): Promise<void> => {
    await RecommendedSettingsScreen.createWalletButton.tap();

    await device.disableSynchronization();
    try {
        await waitForVisible(ready, WALLET_START_TIMEOUT_MS);
    } finally {
        await device.enableSynchronization();
    }
};

// Creates the wallet ZEUS recommends, ecash on LDK Node, with the recommended
// mints, and waits for the keypad, where an ecash wallet opens.
export const createEcashWallet = async (): Promise<void> => {
    await openRecommendedSettings();
    await RecommendedSettingsScreen.waitForMints();
    await createWallet(KeypadScreen.amount);
};

// Creates a self-custodial LDK Node wallet, which needs no mints, and waits for
// its tabs. The header shows earlier, while the wallet is still connecting.
export const createSelfCustodialWallet = async (): Promise<void> => {
    await startOnboarding();
    await answerQuestionnaire('selfCustody', 'ldkNode');
    await createWallet(WalletScreen.tab('Balance'));
};
