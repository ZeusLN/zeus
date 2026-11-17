import { TEST_IDS } from '../../utils/TestIds';
import { expect } from 'detox';

import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.amountKeypad;
const PIN_PAD = TEST_IDS.pinPad;

// The keypad an amount field opens, such as the slide-to-pay threshold in
// Payments settings.
class AmountKeypadScreen {
    get amount() {
        return byId(IDS.amount);
    }

    get confirmButton() {
        return byId(IDS.confirmButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.confirmButton);
    }

    async clear(): Promise<void> {
        await byId(PIN_PAD.delete).longPress();
    }

    // The amount reads as one label, such as "1,234 sats".
    async expectAmount(label: string): Promise<void> {
        await expect(this.amount).toHaveLabel(label);
    }

    async enter(digits: string): Promise<void> {
        for (const digit of digits) {
            await byId(PIN_PAD.key(digit)).tap();
        }
    }
}

export default new AmountKeypadScreen();
