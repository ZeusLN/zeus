import { expect } from 'detox';

import { openSettings, reopenSettings } from '../../flows/settings';
import { waitForVisible } from '../../helpers/elements';
import CurrencyScreen from '../../screens/CurrencyScreen';
import SelectCurrencyScreen from '../../screens/SelectCurrencyScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const openCurrency = async (): Promise<void> => {
    await SettingsScreen.currencyButton.tap();
    await CurrencyScreen.waitUntilDisplayed();
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Currency settings', () => {
    beforeAll(async () => {
        await openSettings();
        await openCurrency();
    });

    it('shows fiat in US dollars from ZEUS rates by default', async () => {
        await expect(CurrencyScreen.fiatSwitch).toHaveToggleValue(true);
        await expect(CurrencyScreen.ratesSource('ZEUS')).toBeVisible();
        await expect(CurrencyScreen.selectCurrencyLabel).toHaveText(
            CurrencyScreen.selectCurrencyText('USD')
        );
    });

    it('picks another currency', async () => {
        await CurrencyScreen.selectCurrencyRow.tap();
        await SelectCurrencyScreen.waitUntilDisplayed();
        await SelectCurrencyScreen.search('EUR');
        await SelectCurrencyScreen.select('EUR');

        await CurrencyScreen.waitUntilDisplayed();
        await expect(CurrencyScreen.selectCurrencyLabel).toHaveText(
            CurrencyScreen.selectCurrencyText('EUR')
        );
    });

    it('takes rates from Yadio, keeping a currency it supports', async () => {
        await CurrencyScreen.selectRatesSource('Yadio');

        await waitForVisible(CurrencyScreen.ratesSource('Yadio'));
        await expect(CurrencyScreen.selectCurrencyLabel).toHaveText(
            CurrencyScreen.selectCurrencyText('EUR')
        );
    });

    it('hides the rates and currency when fiat is off', async () => {
        await CurrencyScreen.fiatSwitch.tap();

        await expect(CurrencyScreen.fiatSwitch).toHaveToggleValue(false);
        await expect(CurrencyScreen.ratesSourceDropdown).not.toBeVisible();
        await expect(CurrencyScreen.selectCurrencyRow).not.toBeVisible();
    });

    it('brings back the earlier choices when fiat is on again', async () => {
        await CurrencyScreen.fiatSwitch.tap();

        await waitForVisible(CurrencyScreen.ratesSource('Yadio'));
        await expect(CurrencyScreen.selectCurrencyLabel).toHaveText(
            CurrencyScreen.selectCurrencyText('EUR')
        );
    });

    it('keeps the choices after a restart', async () => {
        await reopenSettings();
        await openCurrency();

        await expect(CurrencyScreen.fiatSwitch).toHaveToggleValue(true);
        await expect(CurrencyScreen.ratesSource('Yadio')).toBeVisible();
        await expect(CurrencyScreen.selectCurrencyLabel).toHaveText(
            CurrencyScreen.selectCurrencyText('EUR')
        );
    });
});
