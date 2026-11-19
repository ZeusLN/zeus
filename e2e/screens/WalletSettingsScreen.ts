import { TEST_IDS } from '../../utils/TestIds';
import { byId, chooseOption, waitForVisible } from '../helpers/elements';

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

    // label is an entry of FIAT_RATES_SOURCE_KEYS.
    async selectFiatRatesSource(label: string): Promise<void> {
        await chooseOption(this.fiatRatesSourceDropdown, label);
    }
}

export default new WalletSettingsScreen();
