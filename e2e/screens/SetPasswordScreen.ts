import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.setPassword;

class SetPasswordScreen {
    get passwordInput() {
        return byId(IDS.passwordInput);
    }

    get confirmInput() {
        return byId(IDS.confirmInput);
    }

    get saveButton() {
        return byId(IDS.saveButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.passwordInput);
    }

    // replaceText fills the secure fields without the keyboard, so iOS's
    // password suggestions never cover the Save button.
    async fill(password: string, confirmation: string): Promise<void> {
        await this.passwordInput.replaceText(password);
        await this.confirmInput.replaceText(confirmation);
    }

    async save(): Promise<void> {
        await this.saveButton.tap();
    }
}

export default new SetPasswordScreen();
