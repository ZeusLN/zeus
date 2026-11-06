import { TEST_IDS } from '../../utils/TestIds';
import { byId, byText, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.walletConfiguration;

class WalletConfigurationScreen {
    get interfaceDropdown() {
        return byId(IDS.interfaceDropdown);
    }

    get hostInput() {
        return byId(IDS.hostInput);
    }

    get lndhubUrlInput() {
        return byId(IDS.lndhubUrlInput);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.interfaceDropdown);
    }

    // Opens the native picker (action sheet on iOS, dialog on Android) and
    // picks the entry with the given label from INTERFACE_KEYS.
    async selectInterface(label: string): Promise<void> {
        await this.interfaceDropdown.tap();
        await waitForVisible(byText(label));
        await byText(label).tap();
    }
}

export default new WalletConfigurationScreen();
