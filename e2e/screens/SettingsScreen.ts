import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.settings;

class SettingsScreen {
    get privacyButton() {
        return byId(IDS.privacyButton);
    }

    get securityButton() {
        return byId(IDS.securityButton);
    }

    get currencyButton() {
        return byId(IDS.currencyButton);
    }

    get displayButton() {
        return byId(IDS.displayButton);
    }

    // Payments and Invoices are listed only once a wallet exists.
    get paymentsButton() {
        return byId(IDS.paymentsButton);
    }

    get invoicesButton() {
        return byId(IDS.invoicesButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.securityButton);
    }
}

export default new SettingsScreen();
