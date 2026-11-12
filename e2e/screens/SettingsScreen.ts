import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

class SettingsScreen {
    get securityButton() {
        return byId(TEST_IDS.settings.securityButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.securityButton);
    }
}

export default new SettingsScreen();
