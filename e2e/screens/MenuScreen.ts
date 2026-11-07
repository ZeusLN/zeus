import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

class MenuScreen {
    get addWalletButton() {
        return byId(TEST_IDS.menu.addWalletButton);
    }

    get selectedWalletButton() {
        return byId(TEST_IDS.menu.selectedWalletButton);
    }

    // Before any wallet exists, the menu offers to add one.
    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.addWalletButton);
    }

    async waitUntilDisplayedWithWallet(): Promise<void> {
        await waitForVisible(this.selectedWalletButton);
    }
}

export default new MenuScreen();
