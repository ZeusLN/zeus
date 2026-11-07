import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.onboarding;

class OnboardingScreen {
    get recommendedButton() {
        return byId(IDS.recommendedButton);
    }

    get questionnaireButton() {
        return byId(IDS.questionnaireButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.recommendedButton);
    }
}

export default new OnboardingScreen();
