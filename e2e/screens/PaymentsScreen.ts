import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';

const IDS = TEST_IDS.payments;

class PaymentsScreen {
    get feeLimitInput() {
        return byId(IDS.feeLimitInput);
    }

    get feePercentageInput() {
        return byId(IDS.feePercentageInput);
    }

    // Opens the amount keypad.
    get slideToPayThresholdInput() {
        return byId(IDS.slideToPayThresholdInput);
    }

    get slideToPayThresholdValue() {
        return byId(`${IDS.slideToPayThresholdInput}.value`);
    }

    get timeoutInput() {
        return byId(IDS.timeoutInput);
    }

    get mempoolRatesSwitch() {
        return byId(IDS.mempoolRatesSwitch);
    }

    get preferredMempoolRateDropdown() {
        return byId(IDS.preferredMempoolRateDropdown);
    }

    // label is the English name of an entry of MEMPOOL_RATES_KEYS.
    preferredMempoolRate(label: string) {
        return textWithin(IDS.preferredMempoolRateDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.mempoolRatesSwitch);
    }

    async selectPreferredMempoolRate(label: string): Promise<void> {
        await chooseOption(this.preferredMempoolRateDropdown, label);
    }
}

export default new PaymentsScreen();
