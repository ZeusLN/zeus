import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.lockscreen;

// The password form of the Lockscreen. A PIN is entered with PinPad.
class LockscreenScreen {
    get passwordInput() {
        return byId(IDS.passwordInput);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.passwordInput);
    }

    // Submits with the keyboard's return key, which logs in, or confirms a
    // deletion when the Lockscreen was opened to delete the password. Opened
    // from Settings, the focused field's keyboard covers the submit button,
    // so the return key is the one way to submit there too.
    async enterPassword(password: string): Promise<void> {
        await this.passwordInput.replaceText(password);
        await this.passwordInput.tapReturnKey();
    }
}

export default new LockscreenScreen();
