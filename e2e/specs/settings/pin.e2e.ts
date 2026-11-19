import { expect as jestExpect } from '@jest/globals';
import { device, expect } from 'detox';

import {
    openSettingsFromSplash,
    openSettingsFromWallet
} from '../../flows/settings';
import {
    createSelfCustodialWallet,
    WALLET_START_TIMEOUT_MS
} from '../../flows/wallet';
import {
    matchFaceWhenPrompted,
    relaunchApp,
    relaunchAppUnsynchronized,
    setFaceIdEnrollment
} from '../../helpers/app';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import { withoutSynchronization } from '../../helpers/synchronization';
import InfoModal from '../../screens/InfoModal';
import IntroSplashScreen from '../../screens/IntroSplashScreen';
import PinPad from '../../screens/PinPad';
import SecurityScreen from '../../screens/SecurityScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import WalletScreen from '../../screens/WalletScreen';

const PIN = '1357';
const DURESS_PIN = '8642';
const WRONG_PIN = '2468';

const enterPinPrompt = () => byText(t('views.Lockscreen.pin'));

const wrongPinMessage = (attemptsLeft: number) =>
    byText(
        `${t('views.Lockscreen.incorrectPin')}\n${attemptsLeft} ${t(
            'views.Lockscreen.authenticationAttempts'
        )}`
    );

const openSecurity = async (): Promise<void> => {
    await SettingsScreen.securityButton.tap();
    await waitForVisible(SecurityScreen.option('SetPin'));
};

// Sets a PIN from Security, ending back on Security.
const setPin = async (pin: string): Promise<void> => {
    await SecurityScreen.option('SetPin').tap();
    await waitForVisible(byText(t('views.Settings.SetPin.createPin')));
    await PinPad.enterAndSubmit(pin);
    await waitForVisible(byText(t('views.Settings.SetPin.confirmPin')));
    await PinPad.enter(pin);
    await waitForVisible(SecurityScreen.option('DeletePin'));
};

// The wallet's node starts again after a restart and keeps the app busy, so
// the lock steps don't wait for the app to go idle.
const restartToLockscreen = async (): Promise<void> => {
    await relaunchApp();
    await withoutSynchronization(() => waitForVisible(enterPinPrompt()));
};

const unlockToWallet = async (pin: string): Promise<void> => {
    await withoutSynchronization(async () => {
        await PinPad.enterAndSubmit(pin);
        await waitForVisible(
            WalletScreen.tab('Balance'),
            WALLET_START_TIMEOUT_MS
        );
    });
};

const reopenSecurityFromWallet = async (): Promise<void> => {
    await openSettingsFromWallet();
    await openSecurity();
};

// Each key's position on the lock screen's PIN pad.
const keyFrame = async (digit: string) => {
    const attributes = (await PinPad.key(digit).getAttributes()) as {
        frame: { x: number; y: number };
    };
    return attributes.frame;
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off. They create an LDK Node wallet, so the duress PIN
// can be seen to remove it.
describe('PIN', () => {
    beforeAll(async () => {
        if (device.getPlatform() === 'ios') {
            setFaceIdEnrollment(true);
        }
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openSecurity();
    });

    afterAll(async () => {
        if (device.getPlatform() === 'ios') {
            setFaceIdEnrollment(false);
        }
    });

    describe('without a lock', () => {
        it('offers a password or a PIN, and no lock options', async () => {
            await expect(SecurityScreen.option('SetPassword')).toBeVisible();
            await expect(SecurityScreen.option('SetPin')).toBeVisible();
            await expect(SecurityScreen.option('SetDuressPin')).not.toExist();
            await expect(SecurityScreen.scramblePinSwitch).not.toExist();
            await expect(SecurityScreen.loginBackgroundSwitch).not.toExist();
        });

        it('asks for a PIN or password before turning on Face ID', async () => {
            await SecurityScreen.biometricsSwitch.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs([
                'views.Settings.Security.BiometryRequiresPinOrPassword'
            ]);
            await InfoModal.dismiss();
            await expect(SecurityScreen.biometricsSwitch).toHaveToggleValue(
                false
            );
        });
    });

    describe('setting a PIN', () => {
        it('saves a confirmed PIN', async () => {
            await setPin(PIN);

            await expect(SecurityScreen.option('SetPassword')).not.toExist();
        });

        it('offers to change or delete it, and a duress PIN', async () => {
            await expect(SecurityScreen.option('SetPin')).toBeVisible();
            await expect(SecurityScreen.option('DeletePin')).toBeVisible();
            await expect(SecurityScreen.option('SetDuressPin')).toBeVisible();
            await expect(
                SecurityScreen.option('DeleteDuressPin')
            ).not.toExist();
        });

        it('scrambles the PIN pad, and stays unlocked in the background', async () => {
            await expect(SecurityScreen.scramblePinSwitch).toHaveToggleValue(
                true
            );
            await expect(
                SecurityScreen.loginBackgroundSwitch
            ).toHaveToggleValue(false);
        });
    });

    describe('Face ID', () => {
        it('turns on with a matching face', async () => {
            await SecurityScreen.biometricsSwitch.tap();
            await matchFaceWhenPrompted();

            await expect(SecurityScreen.biometricsSwitch).toHaveToggleValue(
                true
            );
        });

        // With Face ID on, the lock screen opens straight into the Face ID
        // prompt, over an empty screen
        it('unlocks with a matching face after a restart', async () => {
            await relaunchAppUnsynchronized();

            await withoutSynchronization(async () => {
                const wallet = WalletScreen.tab('Balance');
                for (let attempt = 0; attempt < 3; attempt++) {
                    await matchFaceWhenPrompted();
                    try {
                        await waitForVisible(wallet, 5000);
                        break;
                    } catch {
                        // the prompt wasn't up yet
                    }
                }
                await waitForVisible(wallet, WALLET_START_TIMEOUT_MS);
            });
        });

        it('turns off', async () => {
            await reopenSecurityFromWallet();
            await SecurityScreen.biometricsSwitch.tap();
            // Turning it off asks for a matching face too
            await matchFaceWhenPrompted();

            await expect(SecurityScreen.biometricsSwitch).toHaveToggleValue(
                false
            );
        });
    });

    describe('scrambled PIN pad', () => {
        it('keeps the digits in order once scrambling is off', async () => {
            await SecurityScreen.scramblePinSwitch.tap();
            await expect(SecurityScreen.scramblePinSwitch).toHaveToggleValue(
                false
            );

            await restartToLockscreen();

            // Detox runs one query at a time, and the node keeps the app
            // busy after the restart
            const [one, two, three, four, zero] = await withoutSynchronization(
                async () => {
                    const frames = [];
                    for (const digit of ['1', '2', '3', '4', '0']) {
                        frames.push(await keyFrame(digit));
                    }
                    return frames;
                }
            );
            jestExpect(one.y).toBe(two.y);
            jestExpect(two.y).toBe(three.y);
            jestExpect(one.x).toBeLessThan(two.x);
            jestExpect(two.x).toBeLessThan(three.x);
            jestExpect(four.y).toBeGreaterThan(one.y);
            jestExpect(four.x).toBe(one.x);
            jestExpect(zero.x).toBe(two.x);
            jestExpect(zero.y).toBeGreaterThan(four.y);
        });

        it('still unlocks with the PIN', async () => {
            await unlockToWallet(PIN);
        });
    });

    describe('locking from the background', () => {
        it('stays unlocked on return while it is off', async () => {
            await device.sendToHome();
            await device.launchApp({ newInstance: false });

            await withoutSynchronization(() =>
                waitForVisible(WalletScreen.tab('Balance'))
            );
            await expect(enterPinPrompt()).not.toExist();
        });

        it('asks for the PIN on return once it is on', async () => {
            await reopenSecurityFromWallet();
            await SecurityScreen.loginBackgroundSwitch.tap();
            await expect(
                SecurityScreen.loginBackgroundSwitch
            ).toHaveToggleValue(true);

            await device.sendToHome();
            await device.launchApp({ newInstance: false });

            await withoutSynchronization(() =>
                waitForVisible(enterPinPrompt())
            );
        });

        it('returns to the app with the PIN', async () => {
            await withoutSynchronization(async () => {
                await PinPad.enterAndSubmit(PIN);
                await waitForVisible(SecurityScreen.option('SetDuressPin'));
            });
        });
    });

    describe('duress PIN', () => {
        it('asks for the current PIN before setting one', async () => {
            await SecurityScreen.option('SetDuressPin').tap();

            await waitForVisible(byText(t('views.Lockscreen.existingPin')));
        });

        it('explains the duress PIN', async () => {
            await PinPad.enterAndSubmit(PIN);

            await waitForVisible(
                byText(t('views.Settings.SetDuressPin.createDuressPin'))
            );
            await expect(
                byText(t('views.Settings.SetDuressPin.duressPinExplanation'))
            ).toBeVisible();
        });

        it('rejects the PIN itself', async () => {
            await PinPad.enterAndSubmit(PIN);
            await waitForVisible(
                byText(t('views.Settings.SetDuressPin.confirmDuressPin'))
            );
            await PinPad.enter(PIN);

            await waitForVisible(byText(t('views.Settings.SetPin.invalid')));
            await expect(
                byText(t('views.Settings.SetDuressPin.createDuressPin'))
            ).toBeVisible();
        });

        it('rejects a confirmation that does not match', async () => {
            await PinPad.enterAndSubmit(DURESS_PIN);
            await waitForVisible(
                byText(t('views.Settings.SetDuressPin.confirmDuressPin'))
            );
            await PinPad.enter(WRONG_PIN);

            await waitForVisible(byText(t('views.Settings.SetPin.noMatch')));
        });

        it('saves a confirmed duress PIN', async () => {
            await PinPad.enterAndSubmit(DURESS_PIN);
            await waitForVisible(
                byText(t('views.Settings.SetDuressPin.confirmDuressPin'))
            );
            await PinPad.enter(DURESS_PIN);

            await waitForVisible(SecurityScreen.option('DeleteDuressPin'));
            await expect(SecurityScreen.option('SetDuressPin')).toBeVisible();
        });

        it('wipes the wallet when it is entered on the lock screen', async () => {
            await restartToLockscreen();

            await withoutSynchronization(async () => {
                await PinPad.enterAndSubmit(DURESS_PIN);
                await waitForVisible(
                    IntroSplashScreen.advancedSetupButton,
                    WALLET_START_TIMEOUT_MS
                );
            });
        });

        it('leaves no lock and no wallet', async () => {
            await relaunchApp();

            await IntroSplashScreen.waitUntilDisplayed();
            await expect(enterPinPrompt()).not.toExist();
            await openSettingsFromSplash();
            await expect(SettingsScreen.paymentsButton).not.toExist();
            await openSecurity();
            await expect(SecurityScreen.option('SetPassword')).toBeVisible();
            await expect(SecurityScreen.option('DeletePin')).not.toExist();
        });
    });

    // Without a wallet, a PIN still locks the app at start.
    describe('failed attempts', () => {
        it('counts each wrong PIN', async () => {
            await setPin(PIN);
            await restartToLockscreen();

            for (const attemptsLeft of [4, 3, 2, 1]) {
                await PinPad.enterAndSubmit(WRONG_PIN);
                await waitForVisible(wrongPinMessage(attemptsLeft));
            }
        });

        it('wipes the app after the fifth wrong PIN', async () => {
            await PinPad.enterAndSubmit(WRONG_PIN);

            await withoutSynchronization(() =>
                waitForVisible(IntroSplashScreen.advancedSetupButton)
            );
            await relaunchApp();
            await IntroSplashScreen.waitUntilDisplayed();
            await expect(enterPinPrompt()).not.toExist();
        });
    });
});
