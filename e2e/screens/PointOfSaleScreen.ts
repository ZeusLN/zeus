import { by, waitFor } from 'detox';

import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    E2EElement,
    textWithin,
    waitForVisible
} from '../helpers/elements';

const IDS = TEST_IDS.pos;

class PointOfSaleScreen {
    get modeDropdown() {
        return byId(IDS.modeDropdown);
    }

    get squareAccessTokenInput() {
        return byId(IDS.squareAccessTokenInput);
    }

    get squareLocationIdInput() {
        return byId(IDS.squareLocationIdInput);
    }

    get squareDevModeSwitch() {
        return byId(IDS.squareDevModeSwitch);
    }

    get merchantNameInput() {
        return byId(IDS.merchantNameInput);
    }

    get confirmationDropdown() {
        return byId(IDS.confirmationDropdown);
    }

    get defaultViewDropdown() {
        return byId(IDS.defaultViewDropdown);
    }

    get disableTipsSwitch() {
        return byId(IDS.disableTipsSwitch);
    }

    get showKeypadSwitch() {
        return byId(IDS.showKeypadSwitch);
    }

    get taxInput() {
        return byId(IDS.taxInput);
    }

    // The pages listed under the settings, keyed by the screen each opens:
    // PointOfSaleRecon, Categories or Products.
    page(screen: string) {
        return byId(IDS.page(screen));
    }

    // label is the English name of an entry of POS_ENABLED_KEYS.
    mode(label: string) {
        return textWithin(IDS.modeDropdown, label);
    }

    confirmation(label: string) {
        return textWithin(IDS.confirmationDropdown, label);
    }

    defaultView(label: string) {
        return textWithin(IDS.defaultViewDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.modeDropdown);
    }

    // The settings run below the screen in standalone mode, so scroll a field
    // into view before using it.
    async reveal(target: E2EElement): Promise<void> {
        await waitFor(target)
            .toBeVisible()
            .whileElement(by.id(IDS.scrollView))
            .scroll(150, 'down');
    }

    async selectMode(label: string): Promise<void> {
        await chooseOption(this.modeDropdown, label);
    }

    async selectConfirmation(label: string): Promise<void> {
        await chooseOption(this.confirmationDropdown, label);
    }

    async selectDefaultView(label: string): Promise<void> {
        await this.reveal(this.defaultViewDropdown);
        await chooseOption(this.defaultViewDropdown, label);
    }
}

export default new PointOfSaleScreen();
