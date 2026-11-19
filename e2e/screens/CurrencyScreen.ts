import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';
import { t } from '../helpers/locale';

const IDS = TEST_IDS.currency;

class CurrencyScreen {
    get fiatSwitch() {
        return byId(IDS.fiatSwitch);
    }

    get ratesSourceDropdown() {
        return byId(IDS.ratesSourceDropdown);
    }

    get selectCurrencyRow() {
        return byId(IDS.selectCurrencyRow);
    }

    get selectCurrencyLabel() {
        return byId(IDS.selectCurrencyLabel);
    }

    // label is an entry of FIAT_RATES_SOURCE_KEYS.
    ratesSource(label: string) {
        return textWithin(IDS.ratesSourceDropdown, label);
    }

    // The row names the selected currency by its code, e.g. "(USD)".
    selectCurrencyText(currency: string): string {
        return `${t('views.Settings.Currency.selectCurrency')} (${currency})`;
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.fiatSwitch);
    }

    async selectRatesSource(label: string): Promise<void> {
        await chooseOption(this.ratesSourceDropdown, label);
    }
}

export default new CurrencyScreen();
