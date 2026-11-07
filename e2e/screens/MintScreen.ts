import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

// Looking a mint up fetches its info from the mint itself.
const MINT_LOOKUP_TIMEOUT_MS = 30000;

class MintScreen {
    get addButton() {
        return byId(TEST_IDS.mint.addButton);
    }

    async waitForLookup(): Promise<void> {
        await waitForVisible(this.addButton, MINT_LOOKUP_TIMEOUT_MS);
    }
}

export default new MintScreen();
