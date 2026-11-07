import { expect } from 'detox';

import {
    chooseNode,
    chooseWalletType,
    startOnboarding
} from '../../flows/onboarding';
import { byText, expectLocalizedText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import InfoModal from '../../screens/InfoModal';
import IntroSplashScreen from '../../screens/IntroSplashScreen';
import NodeChoiceScreen from '../../screens/NodeChoiceScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';
import RecommendedSettingsScreen from '../../screens/RecommendedSettingsScreen';
import WalletConfigurationScreen from '../../screens/WalletConfigurationScreen';
import WalletSetupScreen from '../../screens/WalletSetupScreen';
import WalletTypeScreen from '../../screens/WalletTypeScreen';

const SELF_CUSTODY_INFO = [
    'views.WalletType.selfCustody.info1',
    'views.WalletType.selfCustody.info2',
    'views.WalletType.selfCustody.info3'
];
const ECASH_INFO = [
    'views.WalletType.cashu.info1',
    'views.WalletType.cashu.info2',
    'views.WalletType.cashu.info3'
];
const LDK_NODE_INFO = [
    'views.NodeChoice.ldkNode.info1',
    'views.NodeChoice.ldkNode.info2',
    'views.NodeChoice.ldkNode.info3'
];
const EMBEDDED_LND_INFO = [
    'views.NodeChoice.embeddedLnd.info1',
    'views.NodeChoice.embeddedLnd.info2',
    'views.NodeChoice.embeddedLnd.info3'
];

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Onboarding questionnaire', () => {
    beforeAll(async () => {
        await startOnboarding();
    });

    describe('setup choice', () => {
        it('offers the recommended settings or the questionnaire', async () => {
            await expect(
                byText(t('views.Onboarding.setupQuestion'))
            ).toBeVisible();
            await expect(OnboardingScreen.recommendedButton).toBeVisible();
            await expect(OnboardingScreen.questionnaireButton).toBeVisible();
        });
    });

    describe('wallet setup', () => {
        it('asks how the user wants to use ZEUS', async () => {
            await OnboardingScreen.questionnaireButton.tap();

            await WalletSetupScreen.waitUntilDisplayed();
            await expect(
                byText(t('views.WalletSetup.howToUseZeus'))
            ).toBeVisible();
            await expect(
                WalletSetupScreen.connectRemoteNodeButton
            ).toBeVisible();
        });

        it('connects to a remote node instead', async () => {
            await WalletSetupScreen.connectRemoteNodeButton.tap();

            await WalletConfigurationScreen.waitUntilDisplayed();
        });

        it('returns from the remote connection form', async () => {
            await Header.goBack();

            await WalletSetupScreen.waitUntilDisplayed();
        });
    });

    describe('wallet type', () => {
        it('asks what matters most', async () => {
            await WalletSetupScreen.createWalletButton.tap();

            await WalletTypeScreen.waitUntilDisplayed();
            await expect(
                byText(t('views.WalletType.whatsImportant'))
            ).toBeVisible();
            await expect(WalletTypeScreen.ecashButton).toBeVisible();
        });

        it('explains self-custody', async () => {
            await WalletTypeScreen.selfCustodyInfoButton.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs(SELF_CUSTODY_INFO);
            await InfoModal.dismiss();
        });

        it('explains ecash', async () => {
            await WalletTypeScreen.ecashInfoButton.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs(ECASH_INFO);
            await InfoModal.dismiss();
        });
    });

    describe('node choice', () => {
        it('asks what the user values in a wallet', async () => {
            await chooseWalletType('selfCustody');

            await NodeChoiceScreen.waitUntilDisplayed();
            await expect(
                byText(t('views.NodeChoice.whatMatters'))
            ).toBeVisible();
            await expect(NodeChoiceScreen.embeddedLndButton).toBeVisible();
        });

        it('finishes checking the device', async () => {
            await NodeChoiceScreen.waitForDeviceCheck();
        });

        it('explains LDK Node', async () => {
            await NodeChoiceScreen.ldkNodeInfoButton.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs(LDK_NODE_INFO);
            await InfoModal.dismiss();
        });

        it('explains embedded LND', async () => {
            await NodeChoiceScreen.embeddedLndInfoButton.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs(EMBEDDED_LND_INFO);
            await InfoModal.dismiss();
        });
    });

    describe('answers', () => {
        it('sets up a self-custodial LDK Node wallet', async () => {
            await chooseNode('ldkNode');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expect(
                byText(t('views.RecommendedSettings.titleCustomized'))
            ).toBeVisible();
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.selfCustody'
            );
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.ldkNodeDescription'
            );
            // Mints only matter for an ecash wallet.
            await expect(
                RecommendedSettingsScreen.mintSourceRow
            ).not.toBeVisible();
        });

        it('switches to embedded LND after going back', async () => {
            await Header.goBack();
            await chooseNode('embeddedLnd');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.selfCustody'
            );
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.embeddedLndDescription'
            );
        });

        it('sets up an ecash wallet after going back', async () => {
            await Header.goBack();
            await NodeChoiceScreen.waitUntilDisplayed();
            await Header.goBack();
            await chooseWalletType('ecash');
            await chooseNode('ldkNode');

            await RecommendedSettingsScreen.waitUntilDisplayed();
            await expectLocalizedText(
                RecommendedSettingsScreen.walletTypeValue,
                'views.RecommendedSettings.walletType.cashu'
            );
            await expectLocalizedText(
                RecommendedSettingsScreen.nodeImplementationValue,
                'views.NodeChoice.ldkNodeDescription'
            );
            await expect(RecommendedSettingsScreen.mintSourceRow).toBeVisible();
        });
    });

    describe('navigation', () => {
        it('walks back through every step to the splash', async () => {
            await Header.goBack();
            await NodeChoiceScreen.waitUntilDisplayed();

            await Header.goBack();
            await WalletTypeScreen.waitUntilDisplayed();

            await Header.goBack();
            await WalletSetupScreen.waitUntilDisplayed();

            await Header.goBack();
            await OnboardingScreen.waitUntilDisplayed();

            await Header.goBack();
            await IntroSplashScreen.waitUntilDisplayed();
        });
    });
});
