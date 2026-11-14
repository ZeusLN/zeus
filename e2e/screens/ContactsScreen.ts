import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

class ContactsScreen {
    get addButton() {
        return byId(TEST_IDS.contacts.addButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.addButton);
    }
}

export default new ContactsScreen();
