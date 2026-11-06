import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.introSplash;

class IntroSplashScreen {
    get languageButton() {
        return byId(IDS.languageButton);
    }

    get advancedSetupButton() {
        return byId(IDS.advancedSetupButton);
    }

    get getStartedButton() {
        return byId(IDS.getStartedButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.getStartedButton);
    }
}

export default new IntroSplashScreen();
