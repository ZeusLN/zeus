import { Alert, NativeModules, Platform } from 'react-native';
import RNRestart from 'react-native-restart';
import { localeString } from './LocaleUtils';
import { settingsStore } from '../stores/Stores';
import LdkNode from '../ldknode/LdkNodeInjection';

interface Button {
    style: 'cancel' | 'default' | 'destructive' | undefined;
    text: string;
    onPress?: () => void;
}

const stopNode = async () => {
    const { implementation } = settingsStore;

    if (implementation === 'embedded-lnd') {
        try {
            await NativeModules.LndMobile.stopLnd();
            await NativeModules.LndMobileTools.killLnd();
        } catch (e) {
            console.log('Error stopping LND:', e);
        }
    } else if (implementation === 'ldk-node') {
        try {
            await LdkNode.node.stop();
        } catch (e) {
            console.log('Error stopping LDK Node:', e);
        }
    }
};

/**
 * Fully restarts the app. On Android this must go through the native
 * ProcessPhoenix rebirth (LndMobileTools.restartApp): react-native-restart's
 * ReactInstanceManager path throws under the New Architecture (see
 * ReactApplication.getReactNativeHost), so RNRestart.Restart() degrades to
 * Activity.recreate(), which keeps the JS runtime - and every in-memory
 * store - alive. After a data wipe that leaves the pre-wipe settings (node
 * configs, pins) live in memory, and the relaunched UI lands back on the
 * lockscreen instead of the intro screen. iOS has no process-restart API;
 * there RNRestart performs a genuine JS reload, which resets module state.
 */
const restartApp = () => {
    if (Platform.OS === 'android') {
        NativeModules.LndMobileTools.restartApp();
    } else {
        RNRestart.Restart();
    }
};

const restartNeeded = (force?: boolean) => {
    const title = localeString('restart.title');
    const message = localeString('restart.msg');
    if (Platform.OS === 'android') {
        const buttons: Array<Button> = [];
        if (!force) {
            buttons.push({
                style: 'cancel',
                text: localeString('general.no')
            });
        }
        buttons.push({
            style: 'default',
            text: force
                ? localeString('views.Wallet.restart')
                : localeString('general.yes'),
            onPress: async () => {
                await stopNode();
                restartApp();
            }
        });
        Alert.alert(
            title,
            force ? message : message + '\n' + localeString('restart.msg1'),
            buttons
        );
    } else {
        Alert.alert(title, message);
    }
};

export { restartApp, restartNeeded };
