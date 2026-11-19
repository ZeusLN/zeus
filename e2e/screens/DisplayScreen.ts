import { TEST_IDS } from '../../utils/TestIds';
import {
    byId,
    chooseOption,
    textWithin,
    waitForVisible
} from '../helpers/elements';

const IDS = TEST_IDS.display;

class DisplayScreen {
    get themeDropdown() {
        return byId(IDS.themeDropdown);
    }

    get defaultViewDropdown() {
        return byId(IDS.defaultViewDropdown);
    }

    get displayNicknameSwitch() {
        return byId(IDS.displayNicknameSwitch);
    }

    get bigKeypadButtonsSwitch() {
        return byId(IDS.bigKeypadButtonsSwitch);
    }

    get showAllDecimalPlacesSwitch() {
        return byId(IDS.showAllDecimalPlacesSwitch);
    }

    get removeDecimalSpacesSwitch() {
        return byId(IDS.removeDecimalSpacesSwitch);
    }

    get showMillisatoshiAmountsSwitch() {
        return byId(IDS.showMillisatoshiAmountsSwitch);
    }

    get selectNodeOnStartupSwitch() {
        return byId(IDS.selectNodeOnStartupSwitch);
    }

    get dateTimeButton() {
        return byId(IDS.dateTimeButton);
    }

    // label is an entry of THEME_KEYS or DEFAULT_VIEW_KEYS.
    theme(label: string) {
        return textWithin(IDS.themeDropdown, label);
    }

    defaultView(label: string) {
        return textWithin(IDS.defaultViewDropdown, label);
    }

    async waitUntilDisplayed(): Promise<void> {
        await waitForVisible(this.themeDropdown);
    }

    async selectTheme(label: string): Promise<void> {
        await chooseOption(this.themeDropdown, label);
    }

    async selectDefaultView(label: string): Promise<void> {
        await chooseOption(this.defaultViewDropdown, label);
    }
}

export default new DisplayScreen();
