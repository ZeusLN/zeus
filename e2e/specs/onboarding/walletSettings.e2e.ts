import { expect } from 'detox';

import { openRecommendedSettings } from '../../flows/onboarding';
import { byText, expectLocalizedText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import InfoModal from '../../screens/InfoModal';
import RecommendedSettingsScreen from '../../screens/RecommendedSettingsScreen';
import SelectCurrencyScreen from '../../screens/SelectCurrencyScreen';
import WalletSettingsScreen from '../../screens/WalletSettingsScreen';

const selectCurrencyLabel = (flag: string, code: string): string =>
    `${t('views.Settings.Currency.selectCurrency')} (${flag} ${code})`;

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Wallet settings', () => {
    beforeAll(async () => {
        await openRecommendedSettings();
        await RecommendedSettingsScreen.fiatRow.tap();
        await WalletSettingsScreen.waitUntilDisplayed();
    });

    describe('clipboard', () => {
        it('reads the clipboard by default', async () => {
            await expect(byText(t('views.WalletSettings.title'))).toBeVisible();
            await expect(
                WalletSettingsScreen.clipboardSwitch
            ).toHaveToggleValue(true);
        });

        it('explains clipboard access', async () => {
            await WalletSettingsScreen.clipboardLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await expect(
                byText(
                    t('views.Settings.Privacy.clipboard.explainer').replace(
                        'Zeus',
                        'ZEUS'
                    )
                )
            ).toBeVisible();
            await InfoModal.dismiss();
        });
    });

    describe('fiat currency', () => {
        it('shows fiat rates in US dollars from ZEUS by default', async () => {
            await expect(WalletSettingsScreen.fiatSwitch).toHaveToggleValue(
                true
            );
            await expect(
                WalletSettingsScreen.fiatRatesSourceDropdown
            ).toBeVisible();
            await expect(byText('ZEUS')).toBeVisible();
            await expect(WalletSettingsScreen.selectCurrencyValue).toHaveText(
                selectCurrencyLabel('🇺🇸', 'USD')
            );
        });

        it('finds a currency through search and selects it', async () => {
            await WalletSettingsScreen.selectCurrencyRow.tap();
            await SelectCurrencyScreen.waitUntilDisplayed();
            await SelectCurrencyScreen.search('Euro');
            await SelectCurrencyScreen.select('EUR');

            await WalletSettingsScreen.waitUntilDisplayed();
            await expect(WalletSettingsScreen.selectCurrencyValue).toHaveText(
                selectCurrencyLabel('🇪🇺', 'EUR')
            );
        });

        it('switches the rates source', async () => {
            await WalletSettingsScreen.selectFiatRatesSource('Yadio');

            await expect(byText('Yadio')).toBeVisible();
            // Euro rates are offered by both sources, so the currency stays.
            await expect(WalletSettingsScreen.selectCurrencyValue).toHaveText(
                selectCurrencyLabel('🇪🇺', 'EUR')
            );
        });

        it('hides the currency options when fiat is turned off', async () => {
            await WalletSettingsScreen.fiatSwitch.tap();

            await expect(WalletSettingsScreen.fiatSwitch).toHaveToggleValue(
                false
            );
            await expect(
                WalletSettingsScreen.fiatRatesSourceDropdown
            ).not.toBeVisible();
            await expect(
                WalletSettingsScreen.selectCurrencyRow
            ).not.toBeVisible();
        });
    });

    describe('security', () => {
        it('opens the security settings', async () => {
            await WalletSettingsScreen.securityRow.tap();

            await expect(
                byText(t('views.Settings.Security.title'))
            ).toBeVisible();
            await Header.goBack();
            await WalletSettingsScreen.waitUntilDisplayed();
        });
    });

    describe('summary', () => {
        it('reflects the changes on the settings summary', async () => {
            await WalletSettingsScreen.clipboardSwitch.tap();
            await expect(
                WalletSettingsScreen.clipboardSwitch
            ).toHaveToggleValue(false);
            await Header.goBack();

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.clipboardValue,
                'views.RecommendedSettings.off'
            );
            await expectLocalizedText(
                RecommendedSettingsScreen.fiatValue,
                'views.RecommendedSettings.disabled'
            );
            await expect(
                byText(t('views.RecommendedSettings.titleCustomized'))
            ).toBeVisible();
        });

        it('shows the chosen currency once fiat is back on', async () => {
            await RecommendedSettingsScreen.fiatRow.tap();
            await WalletSettingsScreen.waitUntilDisplayed();
            await WalletSettingsScreen.fiatSwitch.tap();
            await Header.goBack();

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expect(RecommendedSettingsScreen.fiatValue).toHaveText(
                '🇪🇺 EUR'
            );
        });
    });
});
