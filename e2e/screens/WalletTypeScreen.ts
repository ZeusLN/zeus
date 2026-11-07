import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.walletType;

class WalletTypeScreen {
    get selfCustodyButton() {
        return byId(IDS.selfCustodyButton);
    }

    get selfCustodyInfoButton() {
        return byId(IDS.selfCustodyInfoButton);
    }

    get ecashButton() {
        return byId(IDS.ecashButton);
    }

    get ecashInfoButton() {
        return byId(IDS.ecashInfoButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.selfCustodyButton);
    }
}

export default new WalletTypeScreen();
