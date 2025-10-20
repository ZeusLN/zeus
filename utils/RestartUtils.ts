import { Alert, NativeModules, Platform } from 'react-native';
import RNRestart from 'react-native-restart';
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

class RestartUtils {
    /**
     * Schedule app restart with optional delay
     */
    public static scheduleRestart(delayMs: number = 1000): void {
        setTimeout(() => {
            this.restartApp();
        }, delayMs);
    }

    /**
     * Restart the app immediately
     */
    public static restartApp(): void {
        try {
            if (Platform.OS === 'android') {
                // Try native restart module first for Android
                if (NativeModules.LndMobileTools?.restartApp) {
                    // Clean up LND before restart
                    Promise.all([
                        NativeModules.LndMobile?.stopLnd?.(),
                        NativeModules.LndMobileTools?.killLnd?.()
                    ]).finally(() => {
                        NativeModules.LndMobileTools.restartApp();
                    });
                } else {
                    // Fallback to react-native-restart
                    RNRestart.Restart();
                }
            } else if (Platform.OS === 'ios') {
                // Use react-native-restart for iOS
                RNRestart.Restart();
            } else if (__DEV__ && NativeModules.DevSettings) {
                // Fallback to DevSettings in development
                NativeModules.DevSettings.reload();
            } else {
                // Last resort - show alert
                this.showRestartFailedAlert();
            }
        } catch (error) {
            console.error('Failed to restart app:', error);
            this.showRestartFailedAlert();
        }
    }

    /**
     * Show restart instructions when automatic restart fails
     */
    private static showRestartFailedAlert(): void {
        Alert.alert(
            localeString('utils.RestartUtils.restartRequired'),
            localeString('utils.RestartUtils.restartInstructions'),
            [
                {
                    text: localeString('general.ok'),
                    style: 'default'
                }
            ]
        );
    }

    /**
     * Restart app with payment data preservation
     * Note: Payment preservation is handled by the caller through state management
     */
    public static async restartWithPaymentPreservation(
        _paymentData: any,
        _reason: any
    ): Promise<void> {
        // Payment data is already persisted by the caller
        // Just schedule a restart
        this.scheduleRestart(1000);
    }
}

export { restartNeeded };
export default RestartUtils;
