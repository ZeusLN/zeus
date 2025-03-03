import { Alert, NativeModules, Platform } from 'react-native';
import { localeString } from './LocaleUtils';

interface Button {
    style: 'cancel' | 'default' | 'destructive' | undefined;
    text: string;
    onPress?: () => void;
}

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
                try {
                    // await NativeModules.ZeusTor.stopTor();
                    await NativeModules.LndMobile.stopLnd();
                    await NativeModules.LndMobileTools.killLnd();
                } catch (e) {
                    console.log(e);
                }
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
