import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    byText,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';
import { t } from '../helpers/locale';

const IDS = TEST_IDS.invoices;

class InvoicesScreen {
    get memoLabel() {
        return byId(IDS.memoLabel);
    }

    get memoInput() {
        return byId(IDS.memoInput);
    }

    get receiverNameLabel() {
        return byId(IDS.receiverNameLabel);
    }

    get receiverNameInput() {
        return byId(IDS.receiverNameInput);
    }

    get defaultInvoiceTypeLabel() {
        return byId(IDS.defaultInvoiceTypeLabel);
    }

    get defaultInvoiceTypeDropdown() {
        return byId(IDS.defaultInvoiceTypeDropdown);
    }

    get expiryInput() {
        return byId(IDS.expiryInput);
    }

    get timePeriodDropdown() {
        return byId(IDS.timePeriodDropdown);
    }

    // label is the English name of an entry of DEFAULT_INVOICE_TYPE_KEYS.
    defaultInvoiceType(label: string) {
        return textWithin(IDS.defaultInvoiceTypeDropdown, label);
    }

    // label is the English name of an entry of TIME_PERIOD_KEYS.
    timePeriod(label: string) {
        return textWithin(IDS.timePeriodDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.memoInput);
    }

    // The settings scroll and close the keyboard on a tap outside a field,
    // as a user would. Until then, the first tap on a dropdown only closes
    // the keyboard.
    async dismissKeyboard(): Promise<void> {
        await byText(t('views.Receive.expiration')).tap();
    }

    async selectDefaultInvoiceType(label: string): Promise<void> {
        await chooseOption(this.defaultInvoiceTypeDropdown, label);
    }

    async selectTimePeriod(label: string): Promise<void> {
        await chooseOption(this.timePeriodDropdown, label);
    }
}

export default new InvoicesScreen();
