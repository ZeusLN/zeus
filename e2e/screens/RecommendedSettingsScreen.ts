import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.recommendedSettings;

class RecommendedSettingsScreen {
    get walletTypeRow() {
        return byId(IDS.walletTypeRow);
    }

    get walletTypeValue() {
        return byId(IDS.walletTypeValue);
    }

    get nodeImplementationRow() {
        return byId(IDS.nodeImplementationRow);
    }

    get nodeImplementationValue() {
        return byId(IDS.nodeImplementationValue);
    }

    get mintSourceRow() {
        return byId(IDS.mintSourceRow);
    }

    get mintSourceValue() {
        return byId(IDS.mintSourceValue);
    }

    get clipboardRow() {
        return byId(IDS.clipboardRow);
    }

    get clipboardValue() {
        return byId(IDS.clipboardValue);
    }

    get fiatRow() {
        return byId(IDS.fiatRow);
    }

    get fiatValue() {
        return byId(IDS.fiatValue);
    }

    get createWalletButton() {
        return byId(IDS.createWalletButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.createWalletButton);
    }
}

export default new RecommendedSettingsScreen();
