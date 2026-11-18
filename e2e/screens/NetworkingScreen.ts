import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.networking;

class NetworkingScreen {
    get offlineCheckSwitch() {
        return byId(IDS.offlineCheckSwitch);
    }

    // "Online" or "Offline"
    get status() {
        return byId(IDS.status);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.offlineCheckSwitch);
    }
}

export default new NetworkingScreen();
