import { expect } from 'detox';

import { openSettings, reopenSettings } from '../../flows/settings';
import { byText, expectLocalizedText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import Header from '../../screens/Header';
import NetworkingScreen from '../../screens/NetworkingScreen';
import SettingsScreen from '../../screens/SettingsScreen';

const openNetworking = async (): Promise<void> => {
    await SettingsScreen.networkingButton.tap();
    await NetworkingScreen.waitUntilDisplayed();
};

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Networking settings', () => {
    beforeAll(async () => {
        await openSettings();
        await openNetworking();
    });

    it('checks the connection by default and shows it online', async () => {
        await expect(NetworkingScreen.offlineCheckSwitch).toHaveToggleValue(
            false
        );
        await expectLocalizedText(NetworkingScreen.status, 'general.online');
    });

    it('explains the offline check', async () => {
        await expect(
            byText(t('views.Settings.Networking.disableOfflineCheck.subtitle'))
        ).toBeVisible();
    });

    it('turns the offline check off', async () => {
        await NetworkingScreen.offlineCheckSwitch.tap();

        await expect(NetworkingScreen.offlineCheckSwitch).toHaveToggleValue(
            true
        );
    });

    it('keeps it off after leaving', async () => {
        await Header.goBack();
        await SettingsScreen.waitUntilDisplayed();
        await openNetworking();

        await expect(NetworkingScreen.offlineCheckSwitch).toHaveToggleValue(
            true
        );
    });

    it('keeps it off after a restart', async () => {
        await reopenSettings();
        await openNetworking();

        await expect(NetworkingScreen.offlineCheckSwitch).toHaveToggleValue(
            true
        );
    });

    it('turns the offline check back on, still online', async () => {
        await NetworkingScreen.offlineCheckSwitch.tap();

        await expect(NetworkingScreen.offlineCheckSwitch).toHaveToggleValue(
            false
        );
        await expectLocalizedText(NetworkingScreen.status, 'general.online');
    });
});
