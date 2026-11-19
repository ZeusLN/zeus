import { expect } from 'detox';

import { openSettings, reopenSettings } from '../../flows/settings';
import { waitForVisible } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import DateTimeScreen from '../../screens/DateTimeScreen';
import DisplayScreen from '../../screens/DisplayScreen';
import Header from '../../screens/Header';
import SettingsScreen from '../../screens/SettingsScreen';

// THEME_KEYS labels: Kyriaki has no translation, the others do.
const DEFAULT_THEME = 'Kyriaki';
const LIGHT_THEME = t('views.Settings.Theme.light');
const KEYPAD_VIEW = t('views.Settings.Display.DefaultView.keypad');
const BALANCE_VIEW = t('views.Settings.Display.DefaultView.balance');
const DEFAULT_DATE_FORMAT = t('views.Settings.DateTime.DateFormat.default');
const ISO_DATE_FORMAT = 'YYYY-MM-DD';

const openDisplay = async (): Promise<void> => {
    await SettingsScreen.displayButton.tap();
    await DisplayScreen.waitUntilDisplayed();
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Display settings', () => {
    beforeAll(async () => {
        await openSettings();
        await openDisplay();
    });

    describe('defaults', () => {
        it('uses the Kyriaki theme and opens on the keypad', async () => {
            await waitForVisible(DisplayScreen.theme(DEFAULT_THEME));
            await expect(DisplayScreen.defaultView(KEYPAD_VIEW)).toBeVisible();
        });

        it('starts with every display option off', async () => {
            for (const option of [
                DisplayScreen.displayNicknameSwitch,
                DisplayScreen.bigKeypadButtonsSwitch,
                DisplayScreen.showAllDecimalPlacesSwitch,
                DisplayScreen.removeDecimalSpacesSwitch,
                DisplayScreen.showMillisatoshiAmountsSwitch,
                DisplayScreen.selectNodeOnStartupSwitch
            ]) {
                await expect(option).toHaveToggleValue(false);
            }
        });
    });

    describe('changes', () => {
        it('switches to the light theme', async () => {
            await DisplayScreen.selectTheme(LIGHT_THEME);

            await waitForVisible(DisplayScreen.theme(LIGHT_THEME));
        });

        it('opens on the balance instead of the keypad', async () => {
            await DisplayScreen.selectDefaultView(BALANCE_VIEW);

            await waitForVisible(DisplayScreen.defaultView(BALANCE_VIEW));
        });

        it('turns on big keypad buttons and all decimal places', async () => {
            await DisplayScreen.bigKeypadButtonsSwitch.tap();
            await DisplayScreen.showAllDecimalPlacesSwitch.tap();

            await expect(
                DisplayScreen.bigKeypadButtonsSwitch
            ).toHaveToggleValue(true);
            await expect(
                DisplayScreen.showAllDecimalPlacesSwitch
            ).toHaveToggleValue(true);
        });

        it('keeps the changes after a restart', async () => {
            await reopenSettings();
            await openDisplay();

            await waitForVisible(DisplayScreen.theme(LIGHT_THEME));
            await expect(DisplayScreen.defaultView(BALANCE_VIEW)).toBeVisible();
            await expect(
                DisplayScreen.bigKeypadButtonsSwitch
            ).toHaveToggleValue(true);
            await expect(
                DisplayScreen.showAllDecimalPlacesSwitch
            ).toHaveToggleValue(true);
            await expect(
                DisplayScreen.removeDecimalSpacesSwitch
            ).toHaveToggleValue(false);
        });

        it('switches back to the Kyriaki theme', async () => {
            await DisplayScreen.selectTheme(DEFAULT_THEME);

            await waitForVisible(DisplayScreen.theme(DEFAULT_THEME));
        });
    });

    describe('date and time', () => {
        it('opens the date and time settings', async () => {
            await DisplayScreen.dateTimeButton.tap();

            await DateTimeScreen.waitUntilDisplayed();
            await expect(
                DateTimeScreen.dateFormat(DEFAULT_DATE_FORMAT)
            ).toBeVisible();
            await expect(DateTimeScreen.showSecondsSwitch).toHaveToggleValue(
                false
            );
        });

        it('switches dates to the ISO format', async () => {
            await DateTimeScreen.selectDateFormat(ISO_DATE_FORMAT);

            await waitForVisible(DateTimeScreen.dateFormat(ISO_DATE_FORMAT));
        });

        it('keeps the format after leaving', async () => {
            await Header.goBack();
            await DisplayScreen.waitUntilDisplayed();
            await DisplayScreen.dateTimeButton.tap();

            await DateTimeScreen.waitUntilDisplayed();
            await expect(
                DateTimeScreen.dateFormat(ISO_DATE_FORMAT)
            ).toBeVisible();
        });
    });
});
