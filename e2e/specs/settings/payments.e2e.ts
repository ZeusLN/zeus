import { device, expect } from 'detox';

import {
    openSettingsFromWallet,
    reopenSettingsFromWallet
} from '../../flows/settings';
import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import AmountKeypadScreen from '../../screens/AmountKeypadScreen';
import Header from '../../screens/Header';
import PaymentsScreen from '../../screens/PaymentsScreen';
import PrivacyScreen from '../../screens/PrivacyScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const openPayments = async (): Promise<void> => {
    await SettingsScreen.paymentsButton.tap();
    await PaymentsScreen.waitUntilDisplayed();
};

const reopenPayments = async (): Promise<void> => {
    await Header.goBack();
    await SettingsScreen.waitUntilDisplayed();
    await openPayments();
};

const expectChanges = async (): Promise<void> => {
    await expect(PaymentsScreen.feeLimitInput).toHaveText('500');
    await expect(PaymentsScreen.feePercentageInput).toHaveText('2.5');
    await expect(PaymentsScreen.slideToPayThresholdValue).toHaveText(
        '25,000 sats'
    );
    await expect(PaymentsScreen.timeoutInput).toHaveText('120');
    await expect(PaymentsScreen.mempoolRatesSwitch).toHaveToggleValue(true);
    await expect(PaymentsScreen.preferredMempoolRate('Hour fee')).toBeVisible();
};

// Payments settings are listed once a wallet exists, so this creates an LDK
// Node wallet first. The tests share it and run in order, each starting where
// the previous one left off.
describe('Payments settings', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openPayments();
    });

    describe('defaults', () => {
        it('limits fees to 1,000 sats or 5%', async () => {
            await expect(PaymentsScreen.feeLimitInput).toHaveText('1000');
            await expect(PaymentsScreen.feePercentageInput).toHaveText('5.0');
            await expect(
                byText(t('views.Settings.Payments.feeLimitMethodExplainer'))
            ).toBeVisible();
        });

        it('asks to slide to pay from 10,000 sats', async () => {
            await expect(PaymentsScreen.slideToPayThresholdValue).toHaveText(
                '10,000 sats'
            );
        });

        it('gives up on a payment after 60 seconds', async () => {
            await expect(PaymentsScreen.timeoutInput).toHaveText('60');
        });

        it('takes the fastest fee rate from mempool', async () => {
            await expect(PaymentsScreen.mempoolRatesSwitch).toHaveToggleValue(
                true
            );
            await expect(
                PaymentsScreen.preferredMempoolRate('Fastest fee')
            ).toBeVisible();
        });

        it('offers donations only on Android', async () => {
            const donations = byText(t('views.PaymentRequest.enableDonations'));
            if (device.getPlatform() === 'ios') {
                await expect(donations).not.toExist();
            } else {
                await expect(donations).toExist();
            }
        });
    });

    // Before the typed fields: their keyboard can't be closed on this
    // screen and covers the preferred rate (e2e-ui-bugs bug 7)
    describe('mempool rates', () => {
        it('picks a preferred fee rate', async () => {
            await PaymentsScreen.selectPreferredMempoolRate('Hour fee');

            await expect(
                PaymentsScreen.preferredMempoolRate('Hour fee')
            ).toBeVisible();
        });

        it('locks the preferred rate while mempool rates are off', async () => {
            await PaymentsScreen.mempoolRatesSwitch.tap();
            await expect(PaymentsScreen.mempoolRatesSwitch).toHaveToggleValue(
                false
            );

            await PaymentsScreen.preferredMempoolRateDropdown.tap();
            await expect(byText('Half hour fee')).not.toBeVisible();
            await expect(
                PaymentsScreen.preferredMempoolRate('Hour fee')
            ).toBeVisible();
        });

        it('shares the switch with Privacy settings', async () => {
            await Header.goBack();
            await SettingsScreen.privacyButton.tap();
            await PrivacyScreen.waitUntilDisplayed();

            await expect(PrivacyScreen.mempoolRatesSwitch).toHaveToggleValue(
                false
            );
            await PrivacyScreen.mempoolRatesSwitch.tap();
            await Header.goBack();
            await SettingsScreen.waitUntilDisplayed();
            await openPayments();

            await expect(PaymentsScreen.mempoolRatesSwitch).toHaveToggleValue(
                true
            );
        });
    });

    describe('fee limit', () => {
        it('sets a fixed fee limit', async () => {
            await PaymentsScreen.feeLimitInput.replaceText('500');

            await expect(PaymentsScreen.feeLimitInput).toHaveText('500');
        });

        it('sets a percentage fee limit', async () => {
            await PaymentsScreen.feePercentageInput.replaceText('2.5');

            await expect(PaymentsScreen.feePercentageInput).toHaveText('2.5');
        });
    });

    describe('slide to pay', () => {
        it('opens the amount keypad with the current threshold', async () => {
            await PaymentsScreen.slideToPayThresholdInput.tap();

            await AmountKeypadScreen.waitUntilDisplayed();
            await AmountKeypadScreen.expectAmount('10,000 sats');
        });

        it('sets a new threshold on the keypad', async () => {
            await AmountKeypadScreen.clear();
            await AmountKeypadScreen.enter('25000');
            await AmountKeypadScreen.confirmButton.tap();

            await PaymentsScreen.waitUntilDisplayed();
            await expect(PaymentsScreen.slideToPayThresholdValue).toHaveText(
                '25,000 sats'
            );
        });
    });

    describe('timeout', () => {
        it('sets how long to wait for a payment', async () => {
            await PaymentsScreen.timeoutInput.replaceText('120');

            await expect(PaymentsScreen.timeoutInput).toHaveText('120');
        });
    });

    describe('persistence', () => {
        it('keeps the changes after leaving', async () => {
            await reopenPayments();

            await expectChanges();
        });

        it('keeps the changes after a restart', async () => {
            await reopenSettingsFromWallet();
            await openPayments();

            await expectChanges();
        });
    });
});
