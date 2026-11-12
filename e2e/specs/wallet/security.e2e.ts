import { device, expect } from 'detox';

import {
    createSelfCustodialWallet,
    WALLET_START_TIMEOUT_MS
} from '../../flows/wallet';
import { relaunchApp } from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import MenuScreen from '../../screens/MenuScreen';
import PinPad from '../../screens/PinPad';
import SecurityScreen from '../../screens/SecurityScreen';
import SeedScreen, { HIDDEN_WORD } from '../../screens/SeedScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import WalletScreen from '../../screens/WalletScreen';

const PIN = '1357';
const WRONG_PIN = '2468';

// LDK Node wallets use a 12-word recovery phrase.
const SEED_WORDS = 12;

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Wallet security', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
    });

    describe('backup', () => {
        it('warns before showing the recovery phrase', async () => {
            await WalletScreen.menuButton.tap();
            await MenuScreen.waitUntilDisplayedWithWallet();
            await MenuScreen.backupButton.tap();

            await SeedScreen.waitUntilDisplayed();
            await expect(byText(t('views.Settings.Seed.text2'))).toBeVisible();
            await expect(SeedScreen.word(1)).not.toBeVisible();
        });

        it('shows every word hidden once the warning is accepted', async () => {
            await SeedScreen.understandButton.tap();

            await waitForVisible(SeedScreen.word(1));
            await expect(SeedScreen.word(1)).toHaveText(HIDDEN_WORD);
            await expect(SeedScreen.word(SEED_WORDS)).toHaveText(HIDDEN_WORD);
            await expect(SeedScreen.word(SEED_WORDS + 1)).not.toExist();
        });

        it('reveals a word when its pane is tapped', async () => {
            await SeedScreen.word(1).tap();

            await expect(SeedScreen.word(1)).not.toHaveText(HIDDEN_WORD);
            await expect(SeedScreen.word(2)).toHaveText(HIDDEN_WORD);
        });

        it('returns to the wallet once the phrase is backed up', async () => {
            await SeedScreen.backupCompleteButton.tap();

            await WalletScreen.waitUntilDisplayed();
        });
    });

    describe('PIN', () => {
        it('offers a PIN in the security settings', async () => {
            await WalletScreen.menuButton.tap();
            await MenuScreen.waitUntilDisplayedWithWallet();
            await MenuScreen.settingsButton.tap();
            await SettingsScreen.waitUntilDisplayed();
            await SettingsScreen.securityButton.tap();

            await waitForVisible(SecurityScreen.option('SetPin'));
        });

        it('asks for a new PIN', async () => {
            await SecurityScreen.option('SetPin').tap();

            await waitForVisible(byText(t('views.Settings.SetPin.createPin')));
        });

        it('asks to confirm the PIN', async () => {
            await PinPad.enterAndSubmit(PIN);

            await waitForVisible(byText(t('views.Settings.SetPin.confirmPin')));
        });

        it('starts over when the confirmation does not match', async () => {
            await PinPad.enter(WRONG_PIN);

            await waitForVisible(byText(t('views.Settings.SetPin.noMatch')));
            await expect(
                byText(t('views.Settings.SetPin.createPin'))
            ).toBeVisible();
        });

        it('saves a confirmed PIN', async () => {
            await PinPad.enterAndSubmit(PIN);
            await waitForVisible(byText(t('views.Settings.SetPin.confirmPin')));
            await PinPad.enter(PIN);

            await waitForVisible(SecurityScreen.option('DeletePin'));
            await expect(SecurityScreen.option('SetPin')).toBeVisible();
        });
    });

    // The node starts again after a restart and keeps the app busy, so these
    // steps don't wait for the app to go idle.
    describe('lock', () => {
        beforeAll(async () => {
            await device.disableSynchronization();
        });

        afterAll(async () => {
            await device.enableSynchronization();
        });

        it('asks for the PIN after a restart', async () => {
            await relaunchApp();

            await waitForVisible(byText(t('views.Lockscreen.pin')));
        });

        it('rejects a wrong PIN and counts the attempt', async () => {
            await PinPad.enterAndSubmit(WRONG_PIN);

            await waitForVisible(
                byText(
                    `${t('views.Lockscreen.incorrectPin')}\n4 ${t(
                        'views.Lockscreen.authenticationAttempts'
                    )}`
                )
            );
        });

        it('unlocks the wallet with the right PIN', async () => {
            await PinPad.enterAndSubmit(PIN);

            await waitForVisible(
                WalletScreen.tab('Balance'),
                WALLET_START_TIMEOUT_MS
            );
        });

        it('asks for the PIN again before showing the backup', async () => {
            await WalletScreen.menuButton.tap();
            await waitForVisible(MenuScreen.backupButton);
            await MenuScreen.backupButton.tap();

            await waitForVisible(byText(t('views.Lockscreen.pin')));
            await PinPad.enterAndSubmit(PIN);
            await waitForVisible(SeedScreen.understandButton);
        });

        it('returns from the backup without revealing it', async () => {
            await Header.goBack();

            await waitForVisible(MenuScreen.backupButton);
        });
    });
});
