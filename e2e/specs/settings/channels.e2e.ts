import { expect } from 'detox';

import {
    openSettingsFromWallet,
    reopenSettingsFromWallet
} from '../../flows/settings';
import { createSelfCustodialWallet } from '../../flows/wallet';
import { byText } from '../../helpers/elements';
import { t } from '../../helpers/locale';
import ChannelsSettingsScreen from '../../screens/ChannelsSettingsScreen';
import Header from '../../screens/Header';
import InfoModal from '../../screens/InfoModal';
import SettingsScreen from '../../screens/SettingsScreen';

const openChannels = async (): Promise<void> => {
    await SettingsScreen.channelsButton.tap();
    await ChannelsSettingsScreen.waitUntilDisplayed();
};

// Channels settings are listed once a wallet exists, so this creates an LDK
// Node wallet first. The tests share it and run in order, each starting where
// the previous one left off.
describe('Channels settings', () => {
    beforeAll(async () => {
        await createSelfCustodialWallet();
        await openSettingsFromWallet();
        await openChannels();
    });

    it('opens private channels by default', async () => {
        await expect(ChannelsSettingsScreen.announceSwitch).toHaveToggleValue(
            false
        );
    });

    // LDK Node supports none of these, so they are hidden
    it('hides the options LDK Node does not support', async () => {
        for (const key of [
            'views.OpenChannel.numConf',
            'views.OpenChannel.scidAlias',
            'views.OpenChannel.simpleTaprootChannel'
        ]) {
            await expect(byText(t(key))).not.toExist();
        }
    });

    it('explains announcing a channel', async () => {
        await ChannelsSettingsScreen.announceLabel.tap();

        await InfoModal.waitUntilDisplayed();
        await InfoModal.expectParagraphs([
            'views.OpenChannel.announceChannelExplainer'
        ]);
        await InfoModal.dismiss();
    });

    it('announces new channels once turned on', async () => {
        await ChannelsSettingsScreen.announceSwitch.tap();

        await expect(ChannelsSettingsScreen.announceSwitch).toHaveToggleValue(
            true
        );
    });

    it('keeps it on after leaving', async () => {
        await Header.goBack();
        await SettingsScreen.waitUntilDisplayed();
        await openChannels();

        await expect(ChannelsSettingsScreen.announceSwitch).toHaveToggleValue(
            true
        );
    });

    it('keeps it on after a restart', async () => {
        await reopenSettingsFromWallet();
        await openChannels();

        await expect(ChannelsSettingsScreen.announceSwitch).toHaveToggleValue(
            true
        );
    });
});
