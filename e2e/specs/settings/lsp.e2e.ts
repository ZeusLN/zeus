import { expect } from 'detox';

import {
    openSettingsFromWallet,
    reopenSettingsFromWallet
} from '../../flows/settings';
import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import LSPScreen, { lspService } from '../../screens/LSPScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const DEFAULT_LSP = 'https://flow.zeuslsp.com';
const CUSTOM_LSP = 'https://lsp.example.com';
const DISCOUNT_CODE = 'E2E-DISCOUNT';

const openFlowLsp = async (): Promise<void> => {
    await SettingsScreen.lspButton.tap();
    await waitForVisible(lspService('LSPSettings'));
    await lspService('LSPSettings').tap();
    await LSPScreen.waitUntilDisplayed();
};

const reopenFlowLsp = async (): Promise<void> => {
    await Header.goBack();
    await waitForVisible(lspService('LSPSettings'));
    await lspService('LSPSettings').tap();
    await LSPScreen.waitUntilDisplayed();
};

const expectDefaults = async (): Promise<void> => {
    await expect(LSPScreen.enableSwitch).toHaveToggleValue(true);
    await expect(LSPScreen.hostInput).toHaveText(DEFAULT_LSP);
    await expect(LSPScreen.accessKeyInput).toHaveText('');
    await expect(LSPScreen.resetButton).not.toExist();
};

// The LSP settings are listed once a wallet exists, so this creates an LDK
// Node wallet first. The tests share it and run in order, each starting where
// the previous one left off.
describe('LSP settings', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
    });

    describe('services', () => {
        it('offers just-in-time channels and channels in advance', async () => {
            await SettingsScreen.lspButton.tap();

            await waitForVisible(lspService('LSPSettings'));
            await expect(lspService('LSPS1Settings')).toBeVisible();
        });

        it('opens just-in-time channels', async () => {
            await lspService('LSPSettings').tap();

            await LSPScreen.waitUntilDisplayed();
        });
    });

    describe('defaults', () => {
        it('uses the ZEUS LSP with no discount code', async () => {
            await expectDefaults();
        });

        it('explains the LSP', async () => {
            await expect(
                byText(t('views.Settings.LSP.enableLSP.subtitle'))
            ).toBeVisible();
        });
    });

    describe('discount code', () => {
        it('offers a reset once a code is entered', async () => {
            await LSPScreen.accessKeyInput.replaceText(DISCOUNT_CODE);
            await LSPScreen.accessKeyInput.tapReturnKey();

            await expect(LSPScreen.accessKeyInput).toHaveText(DISCOUNT_CODE);
            await expect(LSPScreen.resetButton).toBeVisible();
        });

        it('clears the code on reset', async () => {
            await LSPScreen.resetButton.tap();

            await expectDefaults();
        });
    });

    describe('custom LSP', () => {
        it('takes another LSP host', async () => {
            await LSPScreen.hostInput.replaceText(CUSTOM_LSP);
            await LSPScreen.hostInput.tapReturnKey();

            await expect(LSPScreen.hostInput).toHaveText(CUSTOM_LSP);
            await expect(LSPScreen.resetButton).toBeVisible();
        });

        it('keeps the host after leaving', async () => {
            await reopenFlowLsp();

            await expect(LSPScreen.hostInput).toHaveText(CUSTOM_LSP);
        });
    });

    describe('turning the LSP off', () => {
        it('turns off', async () => {
            await LSPScreen.enableSwitch.tap();

            await expect(LSPScreen.enableSwitch).toHaveToggleValue(false);
        });

        it('keeps the changes after a restart', async () => {
            await reopenSettingsFromWallet();
            await openFlowLsp();

            await expect(LSPScreen.enableSwitch).toHaveToggleValue(false);
            await expect(LSPScreen.hostInput).toHaveText(CUSTOM_LSP);
        });

        it('returns to the defaults on reset', async () => {
            await LSPScreen.resetButton.tap();

            await expectDefaults();
        });

        it('keeps the defaults after leaving', async () => {
            await reopenFlowLsp();

            await expectDefaults();
        });
    });
});
