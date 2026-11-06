import { expect } from 'detox';

import { openRecommendedSettings } from '../../flows/onboarding';
import { byText, expectLocalizedText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import MintDiscoveryScreen from '../../screens/MintDiscoveryScreen';
import RecommendedSettingsScreen from '../../screens/RecommendedSettingsScreen';

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Mint discovery', () => {
    beforeAll(async () => {
        await openRecommendedSettings();
        await RecommendedSettingsScreen.mintSourceRow.tap();
        await MintDiscoveryScreen.waitUntilDisplayed();
    });

    describe('sources', () => {
        it('lists every way to discover mints', async () => {
            await expect(
                byText(t('views.MintDiscovery.subtitle'))
            ).toBeVisible();
            await expect(MintDiscoveryScreen.option('zeus')).toBeVisible();
            await expect(MintDiscoveryScreen.option('all')).toBeVisible();
            await expect(MintDiscoveryScreen.option('custom')).toBeVisible();
            await expect(MintDiscoveryScreen.option('later')).toBeVisible();
        });

        it('shows the top mints for the selected source', async () => {
            await expect(
                byText(t('views.MintDiscovery.topMints'))
            ).toBeVisible();
        });
    });

    describe('custom source', () => {
        it('asks for an npub', async () => {
            await expect(MintDiscoveryScreen.npubInput).not.toBeVisible();

            await MintDiscoveryScreen.choose('custom');

            await expect(MintDiscoveryScreen.npubInput).toBeVisible();
            await expect(MintDiscoveryScreen.fetchMintsButton).toBeVisible();
        });

        it('rejects a malformed npub', async () => {
            await MintDiscoveryScreen.npubInput.typeText('npub1notvalid');

            await expectLocalizedText(
                MintDiscoveryScreen.npubError,
                'views.Cashu.AddMint.invalidNpub'
            );
        });

        it('clears the error once the field is emptied', async () => {
            await MintDiscoveryScreen.npubInput.clearText();

            await expect(MintDiscoveryScreen.npubError).not.toBeVisible();
        });
    });

    describe('choosing later', () => {
        it('hides the npub field and the top mints', async () => {
            await MintDiscoveryScreen.choose('later');

            await expect(MintDiscoveryScreen.npubInput).not.toBeVisible();
            await expect(
                byText(t('views.MintDiscovery.topMints'))
            ).not.toBeVisible();
        });

        it('discards the choice when the user backs out', async () => {
            await Header.goBack();

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.mintSourceValue,
                'views.Cashu.AddMint.zeusFollows'
            );
        });

        it('applies the choice when the user selects it', async () => {
            await RecommendedSettingsScreen.mintSourceRow.tap();
            await MintDiscoveryScreen.waitUntilDisplayed();
            await MintDiscoveryScreen.choose('later');
            await MintDiscoveryScreen.selectButton.tap();

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.mintSourceValue,
                'views.MintDiscovery.chooseLater'
            );
            await expect(
                byText(t('views.RecommendedSettings.titleCustomized'))
            ).toBeVisible();
        });
    });
});
