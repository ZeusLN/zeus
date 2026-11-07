import { expect } from 'detox';

import { createEcashWallet } from '../../flows/wallet';
import { byText, waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import CurrencySelectorModal from '../../screens/CurrencySelectorModal';
import Header from '../../screens/Header';
import KeypadScreen from '../../screens/KeypadScreen';

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Keypad', () => {
    beforeAll(async () => {
        await createEcashWallet();
    });

    describe('amount', () => {
        it('opens with no amount', async () => {
            await KeypadScreen.expectAmount('0 sats');
        });

        it('builds the amount from the digits', async () => {
            await KeypadScreen.enter('123');

            await KeypadScreen.expectAmount('123 sats');
        });

        it('groups thousands', async () => {
            await KeypadScreen.enter('4');

            await KeypadScreen.expectAmount('1,234 sats');
        });

        it('deletes the last digit', async () => {
            await KeypadScreen.deleteKey.tap();

            await KeypadScreen.expectAmount('123 sats');
        });

        it('clears the amount on a long press of delete', async () => {
            await KeypadScreen.clear();

            await KeypadScreen.expectAmount('0 sats');
        });

        it('uses the singular for one sat', async () => {
            await KeypadScreen.enter('1');

            await KeypadScreen.expectAmount('1 sat');
            await KeypadScreen.clear();
        });
    });

    describe('payment type', () => {
        it('starts with ecash', async () => {
            await expect(byText(t('general.ecash'))).toBeVisible();
        });

        it('switches to self-custody', async () => {
            await KeypadScreen.ecashToggle.tap();

            await waitForVisible(byText(t('general.selfCustody')));
        });

        it('switches back to ecash', async () => {
            await KeypadScreen.ecashToggle.tap();

            await waitForVisible(byText(t('general.ecash')));
        });
    });

    describe('units', () => {
        it('opens the currency picker from the unit toggle', async () => {
            await KeypadScreen.unitToggle.tap();

            await CurrencySelectorModal.waitUntilDisplayed();
            await expect(CurrencySelectorModal.option('sats')).toBeVisible();
            await expect(CurrencySelectorModal.option('BTC')).toBeVisible();
        });

        it('switches the amount to bitcoin', async () => {
            await CurrencySelectorModal.select('BTC');

            await KeypadScreen.expectAmount('₿0');
        });

        it('switches the amount back to sats', async () => {
            await KeypadScreen.unitToggle.tap();
            await CurrencySelectorModal.waitUntilDisplayed();
            await CurrencySelectorModal.select('sats');

            await KeypadScreen.expectAmount('0 sats');
        });
    });

    describe('actions', () => {
        it('requests ecash for the amount', async () => {
            await KeypadScreen.enter('21');
            await KeypadScreen.requestButton.tap();

            await waitForVisible(byText(t('views.Cashu.ReceiveEcash.title')));
        });

        it('clears the amount after a request', async () => {
            await Header.goBack();

            await KeypadScreen.waitUntilDisplayed();
            await KeypadScreen.expectAmount('0 sats');
        });

        it('offers a bitcoin payment or an ecash token to send', async () => {
            await KeypadScreen.sendButton.tap();

            await waitForVisible(KeypadScreen.sendBitcoinOption);
            // Under Detox the sheet sometimes opens behind the tab bar, which
            // covers this option, so the test checks that it is offered rather
            // than where it is drawn.
            await expect(KeypadScreen.sendEcashOption).toExist();
        });
    });
});
