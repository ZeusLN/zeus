import { expect } from 'detox';

import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.keypad;
const PIN_PAD = TEST_IDS.pinPad;

class KeypadScreen {
    get amount() {
        return byId(IDS.amount);
    }

    get ecashToggle() {
        return byId(IDS.ecashToggle);
    }

    get unitToggle() {
        return byId(IDS.unitToggle);
    }

    get requestButton() {
        return byId(IDS.requestButton);
    }

    get editButton() {
        return byId(IDS.editButton);
    }

    get sendButton() {
        return byId(IDS.sendButton);
    }

    get sendBitcoinOption() {
        return byId(IDS.sendBitcoinOption);
    }

    get sendEcashOption() {
        return byId(IDS.sendEcashOption);
    }

    get deleteKey() {
        return byId(PIN_PAD.delete);
    }

    amountShortcut(amount: '50000' | '100000' | '1000000' | 'other') {
        return byId(IDS.amountShortcut(amount));
    }

    key(digit: string) {
        return byId(PIN_PAD.key(digit));
    }

    async waitUntilDisplayed(timeoutMs?: number): Promise<void> {
        await waitForVisible(this.amount, timeoutMs);
    }

    // Types the amount one key at a time, including any decimal point.
    async enter(digits: string): Promise<void> {
        for (const char of digits) {
            await (char === '.' ? byId(PIN_PAD.decimal) : this.key(char)).tap();
        }
    }

    async clear(): Promise<void> {
        await this.deleteKey.longPress();
    }

    // The amount reads as one label, such as "1,234 sats".
    async expectAmount(label: string): Promise<void> {
        await expect(this.amount).toHaveLabel(label);
    }
}

export default new KeypadScreen();
