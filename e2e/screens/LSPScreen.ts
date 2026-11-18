import { TEST_IDS } from '../../utils/TestIds';
import { byId, waitForVisible } from '../helpers/elements';

const IDS = TEST_IDS.lsp;

// The services an LSP offers, keyed by the screen each opens, such as
// LSPSettings (Flow 2.0) or LSPS1Settings.
export const lspService = (screen: string) =>
    byId(TEST_IDS.lspServices.option(screen));

// Flow 2.0, the LSP that opens channels just in time for a payment.
class LSPScreen {
    get enableSwitch() {
        return byId(IDS.enableSwitch);
    }

    get hostInput() {
        return byId(IDS.hostInput);
    }

    get accessKeyInput() {
        return byId(IDS.accessKeyInput);
    }

    // Shown once anything differs from the defaults.
    get resetButton() {
        return byId(IDS.resetButton);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.enableSwitch);
    }
}

export default new LSPScreen();
