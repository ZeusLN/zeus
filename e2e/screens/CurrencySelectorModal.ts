import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForHidden, waitForVisible } from '../helpers/elements';

class CurrencySelectorModal {
    get content() {
        return byId(TEST_IDS.currencySelectorModal.content);
    }

    option(currency: string) {
        return byId(TEST_IDS.currencyList.option(currency));
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.content);
    }

    // Picking a currency or bitcoin unit closes the picker.
    async select(currency: string): Promise<void> {
        await this.option(currency).tap();
        await waitForHidden(this.content);
    }
}

export default new CurrencySelectorModal();
