import { Alert, NativeModules, Platform } from 'react-native';
import { localeString } from './LocaleUtils';

const restartNeeded = () => {
    const title = localeString('restart.title');
    const message = localeString('restart.msg');
    if (Platform.OS === 'android') {
        Alert.alert(title, message + '\n' + localeString('restart.msg1'), [
            {
                style: 'cancel',
                text: localeString('general.no')
            },
            {
                style: 'default',
                text: localeString('general.yes'),
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
            }
        ]);
    } else {
        Alert.alert(title, message);
    }
};

export { restartNeeded };
