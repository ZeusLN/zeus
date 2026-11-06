import { expect } from 'detox';

import {
    chooseNode,
    chooseWalletType,
    openRecommendedSettings
} from '../../flows/onboarding';
import { byText, expectLocalizedText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import MintDiscoveryScreen from '../../screens/MintDiscoveryScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';
import RecommendedSettingsScreen from '../../screens/RecommendedSettingsScreen';
import WalletSettingsScreen from '../../screens/WalletSettingsScreen';

const expectCustomizedTitle = async (): Promise<void> => {
    await expect(
        byText(t('views.RecommendedSettings.titleCustomized'))
    ).toBeVisible();
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Recommended settings', () => {
    beforeAll(async () => {
        await openRecommendedSettings();
    });

    describe('summary', () => {
        it('recommends an ecash wallet on LDK Node', async () => {
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.cashu'
            );
            await expect(
                byText(t('views.RecommendedSettings.walletType.subtitle'))
            ).toBeVisible();
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.ldkNodeDescription'
            );
        });

        it('recommends mints followed by ZEUS', async () => {
            await expectLocalizedText(
                RecommendedSettingsScreen.mintSourceValue,
                'views.Cashu.AddMint.zeusFollows'
            );
        });

        it('recommends reading the clipboard', async () => {
            await expectLocalizedText(
                RecommendedSettingsScreen.clipboardValue,
                'views.Settings.Privacy.clipboard'
            );
        });

        it('shows fiat rates in US dollars', async () => {
            await expect(RecommendedSettingsScreen.fiatValue).toHaveText(
                '🇺🇸 USD'
            );
        });

        it('offers to create the wallet', async () => {
            await expect(
                RecommendedSettingsScreen.createWalletButton
            ).toBeVisible();
        });

        it('returns to the setup choice', async () => {
            await Header.goBack();
            await OnboardingScreen.waitUntilDisplayed();

            await OnboardingScreen.recommendedButton.tap();
            await RecommendedSettingsScreen.waitUntilDisplayed();
        });
    });

    describe('wallet type', () => {
        it('switches to self-custody', async () => {
            await RecommendedSettingsScreen.walletTypeRow.tap();
            await chooseWalletType('selfCustody');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectCustomizedTitle();
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.selfCustody'
            );
            await expect(
                RecommendedSettingsScreen.mintSourceRow
            ).not.toBeVisible();
        });

        it('switches back to ecash', async () => {
            await RecommendedSettingsScreen.walletTypeRow.tap();
            await chooseWalletType('ecash');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.cashu'
            );
            await expect(RecommendedSettingsScreen.mintSourceRow).toBeVisible();
        });
    });

    describe('node implementation', () => {
        it('switches to embedded LND', async () => {
            await RecommendedSettingsScreen.nodeImplementationRow.tap();
            await chooseNode('embeddedLnd');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectCustomizedTitle();
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.embeddedLndDescription'
            );
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.cashu'
            );
        });

        it('switches back to LDK Node', async () => {
            await RecommendedSettingsScreen.nodeImplementationRow.tap();
            await chooseNode('ldkNode');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.ldkNodeDescription'
            );
        });
    });

    describe('editors', () => {
        it('opens mint discovery from the mint source', async () => {
            await RecommendedSettingsScreen.mintSourceRow.tap();

            await MintDiscoveryScreen.waitUntilDisplayed();
            await Header.goBack();
            await RecommendedSettingsScreen.waitUntilDisplayed();
        });

        it('opens wallet settings from the clipboard row', async () => {
            await RecommendedSettingsScreen.clipboardRow.tap();

            await WalletSettingsScreen.waitUntilDisplayed();
            await Header.goBack();
            await RecommendedSettingsScreen.waitUntilDisplayed();
        });

        it('opens wallet settings from the fiat row', async () => {
            await RecommendedSettingsScreen.fiatRow.tap();

            await WalletSettingsScreen.waitUntilDisplayed();
            await Header.goBack();
            await RecommendedSettingsScreen.waitUntilDisplayed();
        });
    });

    describe('navigation', () => {
        it('returns to the setup choice after editing', async () => {
            await Header.goBack();

            await OnboardingScreen.waitUntilDisplayed();
        });
    });
});
