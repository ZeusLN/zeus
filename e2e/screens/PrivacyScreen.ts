import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';

const IDS = TEST_IDS.privacy;

class PrivacyScreen {
    get blockExplorerDropdown() {
        return byId(IDS.blockExplorerDropdown);
    }

    get customBlockExplorerInput() {
        return byId(IDS.customBlockExplorerInput);
    }

    get clipboardLabel() {
        return byId(IDS.clipboardLabel);
    }

    get clipboardSwitch() {
        return byId(IDS.clipboardSwitch);
    }

    get lurkerModeLabel() {
        return byId(IDS.lurkerModeLabel);
    }

    get lurkerModeSwitch() {
        return byId(IDS.lurkerModeSwitch);
    }

    get mempoolRatesSwitch() {
        return byId(IDS.mempoolRatesSwitch);
    }

    get mempoolInstanceDropdown() {
        return byId(IDS.mempoolInstanceDropdown);
    }

    get customMempoolInstanceInput() {
        return byId(IDS.customMempoolInstanceInput);
    }

    // label is an entry of BLOCK_EXPLORER_KEYS or MEMPOOL_INSTANCE_KEYS.
    blockExplorer(label: string) {
        return textWithin(IDS.blockExplorerDropdown, label);
    }

    mempoolInstance(label: string) {
        return textWithin(IDS.mempoolInstanceDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.clipboardSwitch);
    }

    async selectBlockExplorer(label: string): Promise<void> {
        await chooseOption(this.blockExplorerDropdown, label);
    }

    async selectMempoolInstance(label: string): Promise<void> {
        await chooseOption(this.mempoolInstanceDropdown, label);
    }
}

export default new PrivacyScreen();
