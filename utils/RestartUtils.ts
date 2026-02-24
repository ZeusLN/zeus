import { Alert, NativeModules, Platform } from 'react-native';
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
    } else if (implementation === 'embedded-ldk-node') {
        try {
            await LdkNode.node.stop();
        } catch (e) {
            console.log('Error stopping LDK Node:', e);
        }
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
                NativeModules.LndMobileTools.restartApp();
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

export { restartNeeded };
