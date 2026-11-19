import { answerQuestionnaire, startOnboarding } from '../../flows/onboarding';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import RecommendedSettingsScreen from '../../screens/RecommendedSettingsScreen';

// Creating the wallet starts a real node, so this stops at the progress
// screen: it proves the button hands the chosen settings to wallet creation.
describe('Wallet creation', () => {
    beforeAll(async () => {
        await startOnboarding();
        await answerQuestionnaire('selfCustody', 'ldkNode');
    });

    it('starts creating the wallet', async () => {
        await RecommendedSettingsScreen.createWalletButton.tap();

        await waitForVisible(
            byText(t('views.Intro.creatingWallet').replace('Zeus', 'ZEUS'))
        );
    });
});
