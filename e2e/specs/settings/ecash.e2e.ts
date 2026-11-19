import { expect } from 'detox';

import {
    openSettingsFromWallet,
    reopenSettingsFromWallet
} from '../../flows/settings';
import {
    createSelfCustodialWallet,
    WALLET_START_TIMEOUT_MS
} from '../../flows/wallet';
import { relaunchApp } from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import { withoutSynchronization } from '../../helpers/synchronization';
import EcashSettingsScreen from '../../screens/EcashSettingsScreen';
import Header from '../../screens/Header';
import KeypadScreen from '../../screens/KeypadScreen';
import MintsScreen from '../../screens/MintsScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import WalletScreen from '../../screens/WalletScreen';

const reopenKeypad = async (): Promise<void> => {
    await relaunchApp();
    await withoutSynchronization(() =>
        waitForVisible(WalletScreen.tab('Keypad'), WALLET_START_TIMEOUT_MS)
    );
    await WalletScreen.openTab('Keypad');
    await KeypadScreen.waitUntilDisplayed();
};

const openEcash = async (): Promise<void> => {
    await SettingsScreen.ecashButton.tap();
    await EcashSettingsScreen.waitUntilDisplayed();
};

// Ecash settings are listed once a wallet exists. A self-custodial LDK Node
// wallet starts with ecash off. The tests share it and run in order, each
// starting where the previous one left off.
describe('Ecash settings', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openEcash();
    });

    describe('off', () => {
        it('starts with ecash and multi-mint sends off', async () => {
            await expect(EcashSettingsScreen.enableSwitch).toHaveToggleValue(
                false
            );
            await expect(EcashSettingsScreen.multiMintSwitch).toHaveToggleValue(
                false
            );
            await expect(EcashSettingsScreen.mintsRow).not.toExist();
        });

        it('explains ecash', async () => {
            for (const key of [
                'views.Settings.Ecash.enableEcash.subtitle1',
                'views.Settings.Ecash.enableEcash.subtitle2',
                'views.Settings.Ecash.enableEcash.subtitle3'
            ]) {
                await expect(byText(t(key))).toExist();
            }
        });

        it('keeps multi-mint sends off while ecash is off', async () => {
            await EcashSettingsScreen.multiMintSwitch.tap();

            await expect(EcashSettingsScreen.multiMintSwitch).toHaveToggleValue(
                false
            );
        });
    });

    describe('on', () => {
        it('lists the mints once ecash is on', async () => {
            await EcashSettingsScreen.enableSwitch.tap();
            await EcashSettingsScreen.waitUntilReady();

            await expect(EcashSettingsScreen.enableSwitch).toHaveToggleValue(
                true
            );
            await expect(EcashSettingsScreen.mintsRow).toBeVisible();
        });

        it('opens the mints', async () => {
            await EcashSettingsScreen.mintsRow.tap();

            await MintsScreen.waitUntilDisplayed();
            await Header.goBack();
            await EcashSettingsScreen.waitUntilDisplayed();
        });

        it('turns on multi-mint sends', async () => {
            await EcashSettingsScreen.multiMintSwitch.tap();

            await expect(EcashSettingsScreen.multiMintSwitch).toHaveToggleValue(
                true
            );
        });

        it('keeps both on after a restart', async () => {
            await reopenSettingsFromWallet();
            await openEcash();

            await expect(EcashSettingsScreen.enableSwitch).toHaveToggleValue(
                true
            );
            await expect(EcashSettingsScreen.multiMintSwitch).toHaveToggleValue(
                true
            );
        });
    });

    describe('off again', () => {
        it('turns multi-mint sends off with ecash', async () => {
            await EcashSettingsScreen.enableSwitch.tap();

            await expect(EcashSettingsScreen.enableSwitch).toHaveToggleValue(
                false
            );
            await expect(EcashSettingsScreen.multiMintSwitch).toHaveToggleValue(
                false
            );
            await expect(EcashSettingsScreen.mintsRow).not.toExist();
        });
    });

    // The keypad offers an ecash request only while ecash is on. A restart
    // opens the wallet again, on its balances.
    describe('keypad', () => {
        it('has no ecash toggle while ecash is off', async () => {
            await reopenKeypad();

            await expect(KeypadScreen.ecashToggle).not.toExist();
        });

        it('offers ecash once it is turned on', async () => {
            await openSettingsFromWallet();
            await openEcash();
            await EcashSettingsScreen.enableSwitch.tap();
            await EcashSettingsScreen.waitUntilReady();
            await reopenKeypad();

            await expect(KeypadScreen.ecashToggle).toBeVisible();
        });
    });
});
