import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.walletSetup;

class WalletSetupScreen {
    get createWalletButton() {
        return byId(IDS.createWalletButton);
    }

    get connectRemoteNodeButton() {
        return byId(IDS.connectRemoteNodeButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.createWalletButton);
    }
}

export default new WalletSetupScreen();
