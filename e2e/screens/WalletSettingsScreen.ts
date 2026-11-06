import { TEST_IDS } from '../../utils/TestIds';
import { byId, byText, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.walletSettings;

class WalletSettingsScreen {
    get clipboardLabel() {
        return byId(IDS.clipboardLabel);
    }

    get clipboardSwitch() {
        return byId(IDS.clipboardSwitch);
    }

    get fiatSwitch() {
        return byId(IDS.fiatSwitch);
    }

    get fiatRatesSourceDropdown() {
        return byId(IDS.fiatRatesSourceDropdown);
    }

    get selectCurrencyRow() {
        return byId(IDS.selectCurrencyRow);
    }

    get selectCurrencyValue() {
        return byId(IDS.selectCurrencyValue);
    }

    get securityRow() {
        return byId(IDS.securityRow);
    }

    get createWalletButton() {
        return byId(IDS.createWalletButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.clipboardSwitch);
    }

    // Opens the native picker (action sheet on iOS, dialog on Android) and
    // picks the entry with the given label from FIAT_RATES_SOURCE_KEYS.
    async selectFiatRatesSource(label: string): Promise<void> {
        await this.fiatRatesSourceDropdown.tap();
        await waitForVisible(byText(label));
        await byText(label).tap();
    }
}

export default new WalletSettingsScreen();
