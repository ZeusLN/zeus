import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

class MenuScreen {
    get addWalletButton() {
        return byId(TEST_IDS.menu.addWalletButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.addWalletButton);
    }
}

export default new MenuScreen();
