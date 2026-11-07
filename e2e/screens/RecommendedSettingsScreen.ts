import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.recommendedSettings;

// Mint recommendations come from Nostr relays.
const MINTS_TIMEOUT_MS = 60000;

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

    get recommendedMints() {
        return byId(IDS.recommendedMints);
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

    // Create wallet stays disabled for an ecash wallet until the recommended
    // mints have loaded. They come from Nostr relays; if the relays return
    // none, the wallet would be created without a mint.
    async waitForMints(): Promise<void> {
        await waitForVisible(this.recommendedMints, MINTS_TIMEOUT_MS);
    }
}

export default new RecommendedSettingsScreen();
