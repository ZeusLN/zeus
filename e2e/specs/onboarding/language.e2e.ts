import { expect } from 'detox';

import { launchFreshApp, relaunchApp } from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import IntroSplashScreen from '../../screens/IntroSplashScreen';
import LanguageScreen from '../../screens/LanguageScreen';

// Buttons render their titles uppercase.
const ENGLISH_LABEL = 'ENGLISH';
const SPANISH_LABEL = 'ESPAÑOL';

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Language selection', () => {
    beforeAll(async () => {
        await launchFreshApp();
        await IntroSplashScreen.waitUntilDisplayed();
    });

    it('lists the languages, English first', async () => {
        await IntroSplashScreen.languageButton.tap();

        await LanguageScreen.waitUntilDisplayed();
        await expect(LanguageScreen.option('en')).toBeVisible();
        await expect(LanguageScreen.option('es')).toBeVisible();
    });

    it('narrows the list as the user searches', async () => {
        await LanguageScreen.search('Espa');

        await expect(LanguageScreen.option('es')).toBeVisible();
        await expect(LanguageScreen.option('en')).not.toBeVisible();
    });

    it('shows no languages for a search without matches', async () => {
        await LanguageScreen.searchInput.replaceText('Klingon');

        await expect(LanguageScreen.option('es')).not.toBeVisible();
        await expect(LanguageScreen.option('en')).not.toBeVisible();
    });

    it('keeps English when the user backs out', async () => {
        await Header.goBack();

        await IntroSplashScreen.waitUntilDisplayed();
        await expect(byText(ENGLISH_LABEL)).toBeVisible();
    });

    it('applies the chosen language', async () => {
        await IntroSplashScreen.languageButton.tap();
        await LanguageScreen.waitUntilDisplayed();
        await LanguageScreen.search('Espa');
        await LanguageScreen.select('es');

        await IntroSplashScreen.waitUntilDisplayed();
        await waitForVisible(byText(SPANISH_LABEL));
        await expect(
            byText(t('views.Intro.getStarted').toUpperCase())
        ).not.toBeVisible();
    });

    it('keeps the chosen language after a restart', async () => {
        await relaunchApp();

        await IntroSplashScreen.waitUntilDisplayed();
        await waitForVisible(byText(SPANISH_LABEL));
    });

    it('switches back to English', async () => {
        await IntroSplashScreen.languageButton.tap();
        await LanguageScreen.waitUntilDisplayed();
        await LanguageScreen.select('en');

        await IntroSplashScreen.waitUntilDisplayed();
        await waitForVisible(byText(ENGLISH_LABEL));
        await expect(
            byText(t('views.Intro.getStarted').toUpperCase())
        ).toBeVisible();
    });
});
