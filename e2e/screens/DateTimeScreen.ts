import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';

const IDS = TEST_IDS.dateTime;

class DateTimeScreen {
    get dateFormatDropdown() {
        return byId(IDS.dateFormatDropdown);
    }

    get timeFormatDropdown() {
        return byId(IDS.timeFormatDropdown);
    }

    get showSecondsSwitch() {
        return byId(IDS.showSecondsSwitch);
    }

    // label is an entry of DATE_FORMAT_KEYS.
    dateFormat(label: string) {
        return textWithin(IDS.dateFormatDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.dateFormatDropdown);
    }

    async selectDateFormat(label: string): Promise<void> {
        await chooseOption(this.dateFormatDropdown, label);
    }
}

export default new DateTimeScreen();
