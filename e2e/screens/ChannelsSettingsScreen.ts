import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.channelsSettings;

// The defaults for new channels. On LDK Node only announcing is offered.
class ChannelsSettingsScreen {
    get announceLabel() {
        return byId(IDS.announceLabel);
    }

    get announceSwitch() {
        return byId(IDS.announceSwitch);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.announceSwitch);
    }
}

export default new ChannelsSettingsScreen();
