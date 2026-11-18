import { launchFreshApp, relaunchApp } from '../helpers/app';
import { tapUntilVisible, waitForVisible } from '../helpers/elements';
import { withoutSynchronization } from '../helpers/synchronization';
import IntroSplashScreen from '../screens/IntroSplashScreen';
import MenuScreen from '../screens/MenuScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WalletScreen from '../screens/WalletScreen';
import { WALLET_START_TIMEOUT_MS } from './wallet';

// Settings is reachable before any wallet exists, from the splash's advanced
// set-up menu, so the settings specs need no wallet.
export const openSettingsFromSplash = async (): Promise<void> => {
    await IntroSplashScreen.waitUntilDisplayed();
    await IntroSplashScreen.advancedSetupButton.tap();
    await MenuScreen.waitUntilDisplayed();
    await MenuScreen.settingsButton.tap();
    await SettingsScreen.waitUntilDisplayed();
};

export const openSettings = async (): Promise<void> => {
    await launchFreshApp();
    await openSettingsFromSplash();
};

// Restarts the app, keeping its settings, and returns to Settings.
export const reopenSettings = async (): Promise<void> => {
    await relaunchApp();
    await openSettingsFromSplash();
};

// Settings for an open wallet, through the wallet's menu. Payments, Invoices
// and the other wallet settings are listed only once a wallet exists.
export const openSettingsFromWallet = async (): Promise<void> => {
    await WalletScreen.menuButton.tap();
    await MenuScreen.waitUntilDisplayedWithWallet();
    await MenuScreen.settingsButton.tap();
    await SettingsScreen.waitUntilDisplayed();
};

// Restarts the app, keeping its wallet and settings, and returns to Settings
// once the wallet has started again. The node keeps the app busy for a while
// after the restart, so this doesn't wait for the app to go idle. The menu ignores taps until the wallet has
// connected, and its entries while it slides in.
export const reopenSettingsFromWallet = async (): Promise<void> => {
    await relaunchApp();
    await withoutSynchronization(async () => {
        await waitForVisible(WalletScreen.menuButton, WALLET_START_TIMEOUT_MS);
        await tapUntilVisible(
            WalletScreen.menuButton,
            MenuScreen.selectedWalletButton
        );
        await tapUntilVisible(
            MenuScreen.settingsButton,
            SettingsScreen.securityButton
        );
    });
};
