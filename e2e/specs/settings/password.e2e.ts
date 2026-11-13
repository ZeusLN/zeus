import { expect } from 'detox';

import {
    openSettings,
    openSettingsFromSplash,
    reopenSettings
} from '../../flows/settings';
import { relaunchApp } from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import IntroSplashScreen from '../../screens/IntroSplashScreen';
import LockscreenScreen from '../../screens/LockscreenScreen';
import SecurityScreen from '../../screens/SecurityScreen';
import SetPasswordScreen from '../../screens/SetPasswordScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const PASSWORD = 'zeus-e2e-password';
const WRONG_PASSWORD = 'not-the-password';

const incorrectPassword = (attemptsLeft: number) =>
    byText(
        `${t('views.Lockscreen.incorrectPassword')}\n${attemptsLeft} ${t(
            'views.Lockscreen.authenticationAttempts'
        )}`
    );

const openSecurity = async (): Promise<void> => {
    await SettingsScreen.securityButton.tap();
    await waitForVisible(SecurityScreen.option('SetPassword'));
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off. A password can be set before any wallet exists.
describe('Password', () => {
    beforeAll(async () => {
        await openSettings();
        await openSecurity();
    });

    describe('setting a password', () => {
        it('offers a password or a PIN', async () => {
            await expect(SecurityScreen.option('SetPin')).toBeVisible();
            await expect(SecurityScreen.option('DeletePassword')).not.toExist();
        });

        it('rejects an empty password', async () => {
            await SecurityScreen.option('SetPassword').tap();
            await SetPasswordScreen.waitUntilDisplayed();
            await SetPasswordScreen.save();

            await waitForVisible(byText(t('views.Settings.SetPassword.empty')));
        });

        it('rejects a confirmation that does not match', async () => {
            await SetPasswordScreen.fill(PASSWORD, WRONG_PASSWORD);
            await SetPasswordScreen.save();

            await waitForVisible(
                byText(t('views.Settings.SetPassword.noMatch'))
            );
        });

        it('saves a matching password', async () => {
            await SetPasswordScreen.fill(PASSWORD, PASSWORD);
            await SetPasswordScreen.save();

            await waitForVisible(SecurityScreen.option('DeletePassword'));
            await expect(
                SecurityScreen.option('SetDuressPassword')
            ).toBeVisible();
            await expect(SecurityScreen.option('SetPin')).not.toExist();
        });
    });

    describe('changing the password', () => {
        it('asks for the current password first', async () => {
            await SecurityScreen.option('SetPassword').tap();

            await LockscreenScreen.waitUntilDisplayed();
            await expect(
                byText(t('views.Lockscreen.enterPassword'))
            ).toBeVisible();
        });

        it('rejects a wrong password and counts the attempt', async () => {
            await LockscreenScreen.enterPassword(WRONG_PASSWORD);

            await waitForVisible(incorrectPassword(4));
        });

        it('opens the password form after the right one', async () => {
            await LockscreenScreen.enterPassword(PASSWORD);

            await SetPasswordScreen.waitUntilDisplayed();
        });

        it('returns to the security settings', async () => {
            await Header.goBack();

            await waitForVisible(SecurityScreen.option('DeletePassword'));
        });
    });

    describe('lock', () => {
        it('asks for the password after a restart', async () => {
            await relaunchApp();

            await LockscreenScreen.waitUntilDisplayed();
        });

        it('rejects a wrong password', async () => {
            await LockscreenScreen.enterPassword(WRONG_PASSWORD);

            await waitForVisible(incorrectPassword(4));
        });

        it('unlocks with the right password', async () => {
            await LockscreenScreen.enterPassword(PASSWORD);

            await IntroSplashScreen.waitUntilDisplayed();
        });
    });

    describe('deleting the password', () => {
        it('asks for the password before deleting it', async () => {
            await openSettingsFromSplash();
            await SettingsScreen.securityButton.tap();
            await waitForVisible(SecurityScreen.option('DeletePassword'));
            await SecurityScreen.option('DeletePassword').tap();

            await LockscreenScreen.waitUntilDisplayed();
            // Buttons render their titles uppercase.
            await expect(
                byText(
                    t('views.Settings.SetPassword.deletePassword').toUpperCase()
                )
            ).toExist();
        });

        it('deletes it with the right password', async () => {
            await LockscreenScreen.enterPassword(PASSWORD);

            await waitForVisible(SecurityScreen.option('SetPin'));
            await expect(SecurityScreen.option('DeletePassword')).not.toExist();
        });

        it('no longer locks after a restart', async () => {
            await reopenSettings();

            await expect(SettingsScreen.securityButton).toBeVisible();
        });
    });
});
