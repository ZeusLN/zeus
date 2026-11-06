import { launchFreshApp } from '../helpers/app';
import { waitForVisible } from '../helpers/elements';
import IntroSplashScreen from '../screens/IntroSplashScreen';
import MenuScreen from '../screens/MenuScreen';
import WalletConfigurationScreen from '../screens/WalletConfigurationScreen';

// The tests share one fresh install and run in order, each starting where the
// previous one left off.
describe('Wallet configuration', () => {
    beforeAll(async () => {
        await launchFreshApp();
        await IntroSplashScreen.waitUntilDisplayed();
        await IntroSplashScreen.advancedSetupButton.tap();
        await MenuScreen.waitUntilDisplayed();
        await MenuScreen.addWalletButton.tap();
        await WalletConfigurationScreen.waitUntilDisplayed();
    });

    it('asks for a host when connecting to a remote LND node', async () => {
        await WalletConfigurationScreen.selectInterface('LND (REST)');

        await waitForVisible(WalletConfigurationScreen.hostInput);
    });

    it('asks for a server address when connecting to LNDHub', async () => {
        await WalletConfigurationScreen.selectInterface('LNDHub');

        await waitForVisible(WalletConfigurationScreen.lndhubUrlInput);
    });
});
