import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.addMint;

class AddMintScreen {
    get urlInput() {
        return byId(IDS.urlInput);
    }

    get submitButton() {
        return byId(IDS.submitButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.urlInput);
    }

    // Sets the URL without the keyboard, which would cover the submit button.
    async lookUp(url: string): Promise<void> {
        await this.urlInput.replaceText(url);
        await this.submitButton.tap();
    }
}

export default new AddMintScreen();
