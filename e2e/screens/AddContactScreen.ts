import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.addContact;

class AddContactScreen {
    get nameInput() {
        return byId(IDS.nameInput);
    }

    get lightningAddressInput() {
        return byId(IDS.lightningAddressInput);
    }

    get saveButton() {
        return byId(IDS.saveButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.nameInput);
    }

    // Sets the fields without the keyboard, which would cover Save.
    async fill(name: string, lightningAddress: string): Promise<void> {
        await this.nameInput.replaceText(name);
        await this.lightningAddressInput.replaceText(lightningAddress);
    }
}

export default new AddContactScreen();
