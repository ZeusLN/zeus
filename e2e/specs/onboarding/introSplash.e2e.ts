import { expect } from 'detox';

import { launchFreshApp } from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import IntroSplashScreen from '../../screens/IntroSplashScreen';
import MenuScreen from '../../screens/MenuScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Intro splash', () => {
    beforeAll(async () => {
        await launchFreshApp();
        await IntroSplashScreen.waitUntilDisplayed();
    });

    it('greets a first-time user with the setup options', async () => {
        await expect(IntroSplashScreen.languageButton).toBeVisible();
        await expect(IntroSplashScreen.advancedSetupButton).toBeVisible();
        await expect(IntroSplashScreen.getStartedButton).toBeVisible();
    });

    it('defaults the language to English', async () => {
        // Buttons render their titles uppercase.
        await expect(byText('ENGLISH')).toBeVisible();
    });

    it('opens the menu for an advanced set-up', async () => {
        await IntroSplashScreen.advancedSetupButton.tap();

        await MenuScreen.waitUntilDisplayed();
        await expect(
            byText(t('views.Settings.createConnectWallet'))
        ).toBeVisible();
    });

    it('closes the menu back to the splash', async () => {
        await Header.close();

        await IntroSplashScreen.waitUntilDisplayed();
    });

    it('starts the guided set-up', async () => {
        await IntroSplashScreen.getStartedButton.tap();

        await OnboardingScreen.waitUntilDisplayed();
        await waitForVisible(byText(t('views.Onboarding.setupQuestion')));
    });

    it('returns to the splash from the guided set-up', async () => {
        await Header.goBack();

        await IntroSplashScreen.waitUntilDisplayed();
    });
});
