import { expect } from 'detox';

import {
    openSettingsFromWallet,
    reopenSettingsFromWallet
} from '../../flows/settings';
import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import InfoModal from '../../screens/InfoModal';
import InvoicesScreen from '../../screens/InvoicesScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const MEMO = 'Coffee at the corner';
const RECEIVER_NAME = 'Alice';

const openInvoices = async (): Promise<void> => {
    await SettingsScreen.invoicesButton.tap();
    await InvoicesScreen.waitUntilDisplayed();
};

const reopenInvoices = async (): Promise<void> => {
    await Header.goBack();
    await SettingsScreen.waitUntilDisplayed();
    await openInvoices();
};

const expectChanges = async (): Promise<void> => {
    await expect(InvoicesScreen.memoInput).toHaveText(MEMO);
    await expect(InvoicesScreen.receiverNameInput).toHaveText(RECEIVER_NAME);
    await expect(InvoicesScreen.defaultInvoiceType('Unified')).toBeVisible();
    await expect(InvoicesScreen.expiryInput).toHaveText('12');
    await expect(InvoicesScreen.timePeriod('Days')).toBeVisible();
};

// Invoices settings are listed once a wallet exists, so this creates an LDK
// Node wallet first. The tests share it and run in order, each starting where
// the previous one left off.
describe('Invoices settings', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openInvoices();
    });

    describe('defaults', () => {
        it('starts with no memo or receiver name', async () => {
            await expect(InvoicesScreen.memoInput).toHaveText('');
            await expect(InvoicesScreen.receiverNameInput).toHaveText('');
        });

        it('creates Lightning invoices from the keypad', async () => {
            await expect(
                InvoicesScreen.defaultInvoiceType('Lightning')
            ).toBeVisible();
        });

        it('lets invoices expire after 1 hour', async () => {
            await expect(InvoicesScreen.expiryInput).toHaveText('1');
            await expect(InvoicesScreen.timePeriod('Hours')).toBeVisible();
        });

        // LDK Node supports none of these, so they are hidden
        it('hides the options LDK Node does not support', async () => {
            for (const key of [
                'views.Receive.routeHints',
                'views.Receive.ampInvoice',
                'views.Receive.blindedPaths',
                'views.Settings.Invoices.showCustomPreimageField'
            ]) {
                await expect(byText(t(key))).not.toExist();
            }
        });
    });

    describe('explainers', () => {
        it('explains the memo', async () => {
            await InvoicesScreen.memoLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs([
                'views.Settings.Invoices.memoExplainer'
            ]);
            await InfoModal.dismiss();
        });

        it('explains the receiver name', async () => {
            await InvoicesScreen.receiverNameLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs([
                'views.Settings.Invoices.receiverNameExplainer'
            ]);
            await InfoModal.dismiss();
        });

        it('explains the default invoice type', async () => {
            await InvoicesScreen.defaultInvoiceTypeLabel.tap();

            await InfoModal.waitUntilDisplayed();
            await InfoModal.expectParagraphs([
                'views.Settings.Invoices.defaultInvoiceType.explainer'
            ]);
            await InfoModal.dismiss();
        });
    });

    describe('changes', () => {
        it('sets a default memo', async () => {
            await InvoicesScreen.memoInput.replaceText(MEMO);
            await InvoicesScreen.dismissKeyboard();

            await expect(InvoicesScreen.memoInput).toHaveText(MEMO);
        });

        it('sets a receiver name', async () => {
            await InvoicesScreen.receiverNameInput.replaceText(RECEIVER_NAME);
            await InvoicesScreen.dismissKeyboard();

            await expect(InvoicesScreen.receiverNameInput).toHaveText(
                RECEIVER_NAME
            );
        });

        it('switches the keypad to unified invoices', async () => {
            await InvoicesScreen.selectDefaultInvoiceType('Unified');

            await expect(
                InvoicesScreen.defaultInvoiceType('Unified')
            ).toBeVisible();
        });

        it('keeps only the digits of an expiry', async () => {
            await InvoicesScreen.expiryInput.replaceText('12h');
            await InvoicesScreen.dismissKeyboard();

            await expect(InvoicesScreen.expiryInput).toHaveText('12');
        });

        it('counts the expiry in days', async () => {
            await InvoicesScreen.selectTimePeriod('Days');

            await expect(InvoicesScreen.timePeriod('Days')).toBeVisible();
        });
    });

    describe('persistence', () => {
        it('keeps the changes after leaving', async () => {
            await reopenInvoices();

            await expectChanges();
        });

        it('does not save an expiry of zero', async () => {
            await InvoicesScreen.expiryInput.replaceText('0');
            await InvoicesScreen.dismissKeyboard();
            await expect(InvoicesScreen.expiryInput).toHaveText('0');

            await reopenInvoices();

            await expect(InvoicesScreen.expiryInput).toHaveText('12');
        });

        it('keeps the changes after a restart', async () => {
            await reopenSettingsFromWallet();
            await openInvoices();

            await expectChanges();
        });
    });
});
