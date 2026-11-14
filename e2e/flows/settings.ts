import { launchFreshApp, relaunchApp } from '../helpers/app';
import IntroSplashScreen from '../screens/IntroSplashScreen';
import MenuScreen from '../screens/MenuScreen';
import SettingsScreen from '../screens/SettingsScreen';

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
