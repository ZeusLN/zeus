import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForHidden, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.nodeChoice;

// The device check pings Neutrino peers, which can take a while on a slow
// network.
const DEVICE_CHECK_TIMEOUT_MS = 60000;

class NodeChoiceScreen {
    get ldkNodeButton() {
        return byId(IDS.ldkNodeButton);
    }

    get ldkNodeInfoButton() {
        return byId(IDS.ldkNodeInfoButton);
    }

    get embeddedLndButton() {
        return byId(IDS.embeddedLndButton);
    }

    get embeddedLndInfoButton() {
        return byId(IDS.embeddedLndInfoButton);
    }

    get deviceCheck() {
        return byId(IDS.deviceCheck);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.ldkNodeButton);
    }

    async waitForDeviceCheck(): Promise<void> {
        await waitForHidden(this.deviceCheck, DEVICE_CHECK_TIMEOUT_MS);
    }
}

export default new NodeChoiceScreen();
