import { device, expect } from 'detox';

import { openSettingsFromWallet } from '../../flows/settings';
import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import PointOfSaleScreen from '../../screens/PointOfSaleScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const MERCHANT = 'E2E Coffee';
const SQUARE_TOKEN = 'e2e-square-token';
const SQUARE_LOCATION = 'e2e-location';

const openPointOfSale = async (): Promise<void> => {
    await SettingsScreen.posButton.tap();
    await PointOfSaleScreen.waitUntilDisplayed();
};

const reopenPointOfSale = async (): Promise<void> => {
    await Header.goBack();
    await SettingsScreen.waitUntilDisplayed();
    await openPointOfSale();
};

// Picks a mode and waits for the dropdown to show it.
const selectMode = async (label: string): Promise<void> => {
    await PointOfSaleScreen.selectMode(label);
    await waitForVisible(PointOfSaleScreen.mode(label));
};

// Fields every mode but Disabled shows
const expectSharedFields = async (): Promise<void> => {
    await expect(PointOfSaleScreen.merchantNameInput).toExist();
    await expect(PointOfSaleScreen.confirmationDropdown).toExist();
    await expect(PointOfSaleScreen.disableTipsSwitch).toExist();
    await expect(PointOfSaleScreen.page('PointOfSaleRecon')).toExist();
};

const expectStandaloneChanges = async (): Promise<void> => {
    await expect(PointOfSaleScreen.mode('Standalone')).toBeVisible();
    await expect(PointOfSaleScreen.merchantNameInput).toHaveText(MERCHANT);
    await expect(PointOfSaleScreen.confirmation('1 confirmation')).toExist();
    await expect(PointOfSaleScreen.defaultView('POS Keypad')).toExist();
    await expect(PointOfSaleScreen.disableTipsSwitch).toHaveToggleValue(true);
    await expect(PointOfSaleScreen.showKeypadSwitch).toHaveToggleValue(false);
    await expect(PointOfSaleScreen.taxInput).toHaveText('8.5');
};

// Point of Sale settings are listed once a wallet exists, so this creates an
// LDK Node wallet first. The tests share it and run in order, each starting
// where the previous one left off.
describe('Point of Sale settings', () => {
    // A new wallet's node polls every second while it syncs, so the app
    // doesn't go idle for long. The steps don't wait for it, and wait for
    // each change to show instead. The next spec's fresh launch turns
    // synchronization back on.
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openPointOfSale();
        await device.disableSynchronization();
    });

    describe('disabled', () => {
        it('starts disabled, with no shop settings', async () => {
            await expect(PointOfSaleScreen.mode('Disabled')).toBeVisible();
            await expect(PointOfSaleScreen.merchantNameInput).not.toExist();
            await expect(
                PointOfSaleScreen.page('PointOfSaleRecon')
            ).not.toExist();
        });

        it('warns that only LND marks orders paid, and that no lock is set', async () => {
            await expect(
                byText(t('pos.views.Settings.PointOfSale.backendWarning'))
            ).toBeVisible();
            await expect(
                byText(t('pos.views.Settings.PointOfSale.authWarning'))
            ).toBeVisible();
        });
    });

    describe('standalone', () => {
        it('shows the shop settings and pages', async () => {
            await selectMode('Standalone');

            await expectSharedFields();
            await expect(PointOfSaleScreen.page('Categories')).toExist();
            await expect(PointOfSaleScreen.page('Products')).toExist();
            await expect(
                PointOfSaleScreen.squareAccessTokenInput
            ).not.toExist();
        });

        it('starts with no merchant, Lightning only and the products', async () => {
            await expect(PointOfSaleScreen.merchantNameInput).toHaveText('');
            await expect(
                PointOfSaleScreen.confirmation('Lightning only')
            ).toBeVisible();
            await expect(PointOfSaleScreen.defaultView('Products')).toExist();
            await expect(PointOfSaleScreen.disableTipsSwitch).toHaveToggleValue(
                false
            );
            await expect(PointOfSaleScreen.showKeypadSwitch).toHaveToggleValue(
                true
            );
            await expect(PointOfSaleScreen.taxInput).toHaveText('');
        });

        it('offers a receipt printer only on Android', async () => {
            const printer = byText(t('views.Settings.POS.enablePrinter'));
            if (device.getPlatform() === 'ios') {
                await expect(printer).not.toExist();
            } else {
                await expect(printer).toExist();
            }
        });

        it('sets a merchant name', async () => {
            await PointOfSaleScreen.merchantNameInput.replaceText(MERCHANT);
            await PointOfSaleScreen.merchantNameInput.tapReturnKey();

            await expect(PointOfSaleScreen.merchantNameInput).toHaveText(
                MERCHANT
            );
        });

        it('waits for one confirmation', async () => {
            await PointOfSaleScreen.selectConfirmation('1 confirmation');

            await waitForVisible(
                PointOfSaleScreen.confirmation('1 confirmation')
            );
        });

        it('opens on the POS keypad', async () => {
            await PointOfSaleScreen.selectDefaultView('POS Keypad');

            await waitForVisible(PointOfSaleScreen.defaultView('POS Keypad'));
        });

        it('turns tips off and hides the keypad', async () => {
            await PointOfSaleScreen.reveal(PointOfSaleScreen.disableTipsSwitch);
            await PointOfSaleScreen.disableTipsSwitch.tap();
            await PointOfSaleScreen.reveal(PointOfSaleScreen.showKeypadSwitch);
            await PointOfSaleScreen.showKeypadSwitch.tap();

            await expect(PointOfSaleScreen.disableTipsSwitch).toHaveToggleValue(
                true
            );
            await expect(PointOfSaleScreen.showKeypadSwitch).toHaveToggleValue(
                false
            );
        });

        it('adds tax', async () => {
            await PointOfSaleScreen.reveal(PointOfSaleScreen.taxInput);
            await PointOfSaleScreen.taxInput.replaceText('8.5');

            await expect(PointOfSaleScreen.taxInput).toHaveText('8.5');
        });

        it('keeps the changes after leaving', async () => {
            await reopenPointOfSale();

            await expectStandaloneChanges();
        });
    });

    describe('Square', () => {
        it('asks for the Square credentials instead of the shop pages', async () => {
            await selectMode('Square');

            await expect(PointOfSaleScreen.squareAccessTokenInput).toExist();
            await expect(PointOfSaleScreen.squareLocationIdInput).toExist();
            await expect(
                PointOfSaleScreen.squareDevModeSwitch
            ).toHaveToggleValue(false);
            await expectSharedFields();
            await expect(PointOfSaleScreen.page('Categories')).not.toExist();
            await expect(PointOfSaleScreen.defaultViewDropdown).not.toExist();
            await expect(PointOfSaleScreen.taxInput).not.toExist();
        });

        it('keeps the merchant settings from standalone', async () => {
            await expect(PointOfSaleScreen.merchantNameInput).toHaveText(
                MERCHANT
            );
            await expect(PointOfSaleScreen.disableTipsSwitch).toHaveToggleValue(
                true
            );
        });

        it('takes the Square credentials and developer mode', async () => {
            await PointOfSaleScreen.reveal(
                PointOfSaleScreen.squareAccessTokenInput
            );
            await PointOfSaleScreen.squareAccessTokenInput.replaceText(
                SQUARE_TOKEN
            );
            await PointOfSaleScreen.squareAccessTokenInput.tapReturnKey();
            await PointOfSaleScreen.squareLocationIdInput.replaceText(
                SQUARE_LOCATION
            );
            await PointOfSaleScreen.squareLocationIdInput.tapReturnKey();
            await PointOfSaleScreen.reveal(
                PointOfSaleScreen.squareDevModeSwitch
            );
            await PointOfSaleScreen.squareDevModeSwitch.tap();

            await expect(
                PointOfSaleScreen.squareDevModeSwitch
            ).toHaveToggleValue(true);
        });

        it('keeps them after leaving', async () => {
            await reopenPointOfSale();

            await expect(PointOfSaleScreen.squareAccessTokenInput).toHaveText(
                SQUARE_TOKEN
            );
            await expect(PointOfSaleScreen.squareLocationIdInput).toHaveText(
                SQUARE_LOCATION
            );
            await expect(
                PointOfSaleScreen.squareDevModeSwitch
            ).toHaveToggleValue(true);
        });
    });

    describe('disabled again', () => {
        it('hides the shop settings', async () => {
            await selectMode('Disabled');

            await expect(PointOfSaleScreen.merchantNameInput).not.toExist();
            await expect(
                PointOfSaleScreen.squareAccessTokenInput
            ).not.toExist();
        });
    });
});
