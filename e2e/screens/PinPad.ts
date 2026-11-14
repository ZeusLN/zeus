import { TEST_IDS } from '../../utils/TestIds';
import { byId } from '../helpers/elements';

const IDS = TEST_IDS.pinPad;

// The PIN pad used to set a PIN and on the lockscreen. Keys are found by digit,
// so the order stays correct when the pad scrambles them.
class PinPad {
    key(digit: string) {
        return byId(IDS.key(digit));
    }

    get submitButton() {
        return byId(IDS.submit);
    }

    // Types the digits only. A PIN confirmation submits by itself once it is
    // as long as the PIN being confirmed.
    async enter(pin: string): Promise<void> {
        for (const digit of pin) {
            await this.key(digit).tap();
        }
    }

    // Types the digits and taps the confirm key, which shows once enough
    // digits are entered.
    async enterAndSubmit(pin: string): Promise<void> {
        await this.enter(pin);
        await this.submitButton.tap();
    }
}

export default new PinPad();
