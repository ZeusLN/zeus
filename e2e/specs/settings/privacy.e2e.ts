import { expect } from 'detox';

import { openSettings, reopenSettings } from '../../flows/settings';
import { byText, waitForHidden, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import InfoModal from '../../screens/InfoModal';
import PrivacyScreen from '../../screens/PrivacyScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const DEFAULT_BLOCK_EXPLORER = 'mempool.space';
const DEFAULT_MEMPOOL_INSTANCE = 'electrs.zeusln.com';
const CUSTOM = t('general.custom');

const INVALID_URL = 'explorer.example.com';
const CUSTOM_BLOCK_EXPLORER = 'https://explorer.example.com';
const CUSTOM_MEMPOOL_INSTANCE = 'https://mempool.example.com';

const invalidUrlError = () =>
    byText(t('views.Settings.Privacy.invalidCustomUrl'));

const reopenPrivacy = async (): Promise<void> => {
    await Header.goBack();
    await SettingsScreen.waitUntilDisplayed();
    await SettingsScreen.privacyButton.tap();
    await PrivacyScreen.waitUntilDisplayed();
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Privacy settings', () => {
    beforeAll(async () => {
        await openSettings();
        await SettingsScreen.privacyButton.tap();
        await PrivacyScreen.waitUntilDisplayed();
    });

    describe('defaults', () => {
        it('looks transactions up on mempool.space', async () => {
            await expect(
                PrivacyScreen.blockExplorer(DEFAULT_BLOCK_EXPLORER)
            ).toBeVisible();
        });

        it('reads the clipboard, with lurker mode off', async () => {
            await expect(PrivacyScreen.clipboardSwitch).toHaveToggleValue(true);
            await expect(PrivacyScreen.lurkerModeSwitch).toHaveToggleValue(
                false
            );
        });

        it('takes fee rates from the ZEUS mempool instance', async () => {
            await expect(PrivacyScreen.mempoolRatesSwitch).toHaveToggleValue(
                true
            );
            await expect(
                PrivacyScreen.mempoolInstance(DEFAULT_MEMPOOL_INSTANCE)
            ).toBeVisible();
        });
    });

    describe('explainers', () => {
        it('explains clipboard access', async () => {
            await PrivacyScreen.clipboardLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await expect(
                byText(
                    t('views.Settings.Privacy.clipboard.explainer').replace(
                        'Zeus',
                        'ZEUS'
                    )
                )
            ).toBeVisible();
            await InfoModal.dismiss();
        });

        it('explains lurker mode', async () => {
            await PrivacyScreen.lurkerModeLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs([
                'views.Settings.Privacy.lurkerMode.explainer1',
                'views.Settings.Privacy.lurkerMode.explainer3',
                'views.Settings.Privacy.lurkerMode.explainer2'
            ]);
            await InfoModal.dismiss();
        });
    });

    describe('custom block explorer', () => {
        it('asks for the URL of a custom explorer', async () => {
            await PrivacyScreen.selectBlockExplorer(CUSTOM);

            await expect(PrivacyScreen.blockExplorer(CUSTOM)).toBeVisible();
            await waitForVisible(PrivacyScreen.customBlockExplorerInput);
            await expect(invalidUrlError()).not.toBeVisible();
        });

        it('rejects a URL without http or https', async () => {
            await PrivacyScreen.customBlockExplorerInput.replaceText(
                INVALID_URL
            );

            await waitForVisible(invalidUrlError());
        });

        it('accepts an https URL', async () => {
            await PrivacyScreen.customBlockExplorerInput.replaceText(
                CUSTOM_BLOCK_EXPLORER
            );

            await waitForHidden(invalidUrlError());
        });

        it('keeps the custom explorer after leaving', async () => {
            await reopenPrivacy();

            await expect(PrivacyScreen.blockExplorer(CUSTOM)).toBeVisible();
            await expect(PrivacyScreen.customBlockExplorerInput).toHaveText(
                CUSTOM_BLOCK_EXPLORER
            );
        });

        it('switches back to mempool.space', async () => {
            await PrivacyScreen.selectBlockExplorer(DEFAULT_BLOCK_EXPLORER);

            await expect(
                PrivacyScreen.blockExplorer(DEFAULT_BLOCK_EXPLORER)
            ).toBeVisible();
            await expect(
                PrivacyScreen.customBlockExplorerInput
            ).not.toBeVisible();
        });
    });

    describe('custom mempool instance', () => {
        it('asks for the URL of a custom instance', async () => {
            await PrivacyScreen.selectMempoolInstance(CUSTOM);

            await expect(PrivacyScreen.mempoolInstance(CUSTOM)).toBeVisible();
            await waitForVisible(PrivacyScreen.customMempoolInstanceInput);
        });

        it('rejects a URL without http or https', async () => {
            await PrivacyScreen.customMempoolInstanceInput.replaceText(
                INVALID_URL
            );

            await waitForVisible(invalidUrlError());
        });

        it('accepts an https URL', async () => {
            await PrivacyScreen.customMempoolInstanceInput.replaceText(
                CUSTOM_MEMPOOL_INSTANCE
            );

            await waitForHidden(invalidUrlError());
        });

        it('falls back to the ZEUS instance when left without a URL', async () => {
            await PrivacyScreen.customMempoolInstanceInput.clearText();
            await reopenPrivacy();

            await expect(
                PrivacyScreen.mempoolInstance(DEFAULT_MEMPOOL_INSTANCE)
            ).toBeVisible();
            await expect(
                PrivacyScreen.customMempoolInstanceInput
            ).not.toBeVisible();
        });
    });

    describe('switches', () => {
        it('turns lurker mode on and clipboard reading off', async () => {
            await PrivacyScreen.lurkerModeSwitch.tap();
            await PrivacyScreen.clipboardSwitch.tap();

            await expect(PrivacyScreen.lurkerModeSwitch).toHaveToggleValue(
                true
            );
            await expect(PrivacyScreen.clipboardSwitch).toHaveToggleValue(
                false
            );
        });

        it('keeps them after a restart', async () => {
            await reopenSettings();
            await SettingsScreen.privacyButton.tap();
            await PrivacyScreen.waitUntilDisplayed();

            await expect(PrivacyScreen.lurkerModeSwitch).toHaveToggleValue(
                true
            );
            await expect(PrivacyScreen.clipboardSwitch).toHaveToggleValue(
                false
            );
        });
    });
});
