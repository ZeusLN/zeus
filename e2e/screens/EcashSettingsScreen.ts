import { TEST_IDS } from '../../utils/TestIds';
import { waitFor } from 'detox';

import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.ecashSettings;

class EcashSettingsScreen {
    get enableSwitch() {
        return byId(IDS.enableSwitch);
    }

    // Enabled only while ecash is on.
    get multiMintSwitch() {
        return byId(IDS.multiMintSwitch);
    }

    // Listed only while ecash is on.
    get mintsRow() {
        return byId(IDS.mintsRow);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.enableSwitch);
    }

    // Turning ecash on sets up its wallets, with a spinner in the header.
    // Both switches are disabled until it ends.
    async waitUntilReady(): Promise<void> {
        await waitFor(byId(IDS.loading)).not.toExist().withTimeout(60000);
    }
}

export default new EcashSettingsScreen();
