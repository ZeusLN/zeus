import { Alert, NativeModules, Platform } from 'react-native';
import RNRestart from 'react-native-restart';
import EncryptedStorage from 'react-native-encrypted-storage';
import { localeString } from './LocaleUtils';

interface Button {
    style: 'cancel' | 'default' | 'destructive' | undefined;
    text: string;
    onPress?: () => void;
}

const PENDING_PAYMENT_KEY = 'zeus-pending-payment-restart';
const RESTART_REASON_KEY = 'zeus-restart-reason';

export interface PendingPaymentData {
    type: 'invoice' | 'keysend' | 'cashu';
    timestamp: number;
    paymentRequest?: string;
    amount?: string;
    destination?: string;
    message?: string;
}

export interface RestartReason {
    type: 'express-graph-sync-enabled';
    timestamp: number;
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
     * Save payment state before restart
     */
    public static async savePendingPayment(
        paymentData: PendingPaymentData
    ): Promise<void> {
        try {
            await EncryptedStorage.setItem(
                PENDING_PAYMENT_KEY,
                JSON.stringify({
                    ...paymentData,
                    timestamp: Date.now()
                })
            );
        } catch (error) {
            console.error('Failed to save pending payment:', error);
            throw error;
        }
    }

    /**
     * Retrieve pending payment after restart
     */
    public static async getPendingPayment(): Promise<PendingPaymentData | null> {
        try {
            const data = await EncryptedStorage.getItem(PENDING_PAYMENT_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // Check if payment data is less than 5 minutes old
                if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                    return parsed;
                }
                // Clean up old data
                await this.clearPendingPayment();
            }
            return null;
        } catch (error) {
            console.error('Failed to retrieve pending payment:', error);
            return null;
        }
    }

    /**
     * Clear pending payment data
     */
    public static async clearPendingPayment(): Promise<void> {
        try {
            await EncryptedStorage.removeItem(PENDING_PAYMENT_KEY);
        } catch (error) {
            console.error('Failed to clear pending payment:', error);
        }
    }

    /**
     * Save restart reason
     */
    public static async saveRestartReason(
        reason: RestartReason
    ): Promise<void> {
        try {
            await EncryptedStorage.setItem(
                RESTART_REASON_KEY,
                JSON.stringify(reason)
            );
        } catch (error) {
            console.error('Failed to save restart reason:', error);
        }
    }

    /**
     * Get restart reason
     */
    public static async getRestartReason(): Promise<RestartReason | null> {
        try {
            const data = await EncryptedStorage.getItem(RESTART_REASON_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // Clear after reading
                await EncryptedStorage.removeItem(RESTART_REASON_KEY);
                return parsed;
            }
            return null;
        } catch (error) {
            console.error('Failed to get restart reason:', error);
            return null;
        }
    }

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
     * Restart app with payment preservation
     */
    public static async restartWithPaymentPreservation(
        paymentData: PendingPaymentData,
        reason: RestartReason
    ): Promise<void> {
        try {
            // Save both payment data and restart reason
            await Promise.all([
                this.savePendingPayment(paymentData),
                this.saveRestartReason(reason)
            ]);

            // Show restart message
            Alert.alert(
                localeString('utils.RestartUtils.restarting'),
                localeString('utils.RestartUtils.restartingMessage'),
                [],
                { cancelable: false }
            );

            // Schedule restart
            this.scheduleRestart(1500);
        } catch (error) {
            console.error('Failed to prepare restart:', error);
            // Try to restart anyway
            this.scheduleRestart(1500);
        }
    }

    /**
     * Check if app needs to handle post-restart actions
     */
    public static async checkPostRestartActions(): Promise<{
        hasRestartReason: boolean;
        reason?: RestartReason;
        hasPendingPayment: boolean;
        pendingPayment?: PendingPaymentData;
    }> {
        const [reason, pendingPayment] = await Promise.all([
            this.getRestartReason(),
            this.getPendingPayment()
        ]);

        return {
            hasRestartReason: !!reason,
            reason: reason || undefined,
            hasPendingPayment: !!pendingPayment,
            pendingPayment: pendingPayment || undefined
        };
    }
}

export { restartNeeded };
export default RestartUtils;
