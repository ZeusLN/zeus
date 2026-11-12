import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.seed;

// Shown in place of each recovery word until its pane is tapped.
export const HIDDEN_WORD = '********';

class SeedScreen {
    get understandButton() {
        return byId(IDS.understandButton);
    }

    get backupCompleteButton() {
        return byId(IDS.backupCompleteButton);
    }

    // Positions start at 1, as the screen numbers the words.
    word(position: number) {
        return byId(IDS.word(position));
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.understandButton);
    }
}

export default new SeedScreen();
