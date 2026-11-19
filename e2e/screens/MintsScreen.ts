import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

class MintsScreen {
    get addButton() {
        return byId(TEST_IDS.mints.addButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.addButton);
    }
}

export default new MintsScreen();
