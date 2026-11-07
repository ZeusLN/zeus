import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

export type WalletTab = 'Balance' | 'Keypad' | 'Channels' | 'Camera';

class WalletScreen {
    tab(name: WalletTab) {
        return byId(TEST_IDS.wallet.tab(name));
    }

    get activityButton() {
        return byId(TEST_IDS.wallet.activityButton);
    }

    get menuButton() {
        return byId(TEST_IDS.walletHeader.menuButton);
    }

    get walletsButton() {
        return byId(TEST_IDS.walletHeader.walletsButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.menuButton);
    }

    async openTab(name: WalletTab): Promise<void> {
        await this.tab(name).tap();
    }
}

export default new WalletScreen();
