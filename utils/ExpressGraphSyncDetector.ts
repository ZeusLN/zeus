import EncryptedStorage from 'react-native-encrypted-storage';
import SettingsStore from '../stores/SettingsStore';

const FIRST_PAYMENT_ATTEMPT_KEY = 'zeus-first-payment-attempt';
const EXPRESS_SYNC_PROMPT_SHOWN_KEY = 'zeus-express-sync-prompt-shown';

export interface PaymentDetectionResult {
    shouldPrompt: boolean;
    isFirstPayment: boolean;
    expressGraphSyncDisabled: boolean;
}

class ExpressGraphSyncDetector {
    private settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
    }

    /**
     * Checks if this is the first Lightning payment attempt and if Express Graph Sync prompt should be shown
     */
    public async detectPaymentAttempt(): Promise<PaymentDetectionResult> {
        const isFirstPayment = await this.isFirstPaymentAttempt();
        const expressGraphSyncDisabled =
            !this.settingsStore.settings.expressGraphSync;
        const promptAlreadyShown = await this.hasPromptBeenShown();
        const userSkipped =
            this.settingsStore.settings.expressGraphSyncPromptSkipped || false;

        const shouldPrompt =
            isFirstPayment &&
            expressGraphSyncDisabled &&
            !promptAlreadyShown &&
            !userSkipped;

        // Mark that we've attempted a payment (even if we're showing prompt)
        if (isFirstPayment) {
            await this.markFirstPaymentAttempted();
        }

        return {
            shouldPrompt,
            isFirstPayment,
            expressGraphSyncDisabled
        };
    }

    /**
     * Mark that the Express Graph Sync prompt has been shown to the user
     */
    public async markPromptShown(): Promise<void> {
        try {
            await EncryptedStorage.setItem(
                EXPRESS_SYNC_PROMPT_SHOWN_KEY,
                'true'
            );
        } catch (error) {
            console.error(
                'Failed to mark Express Graph Sync prompt as shown:',
                error
            );
        }
    }

    /**
     * Check if this is the first payment attempt
     */
    private async isFirstPaymentAttempt(): Promise<boolean> {
        try {
            const firstAttempt = await EncryptedStorage.getItem(
                FIRST_PAYMENT_ATTEMPT_KEY
            );
            return firstAttempt === null;
        } catch (error) {
            console.error(
                'Failed to check first payment attempt status:',
                error
            );
            return false;
        }
    }

    /**
     * Mark that the first payment attempt has been made
     */
    private async markFirstPaymentAttempted(): Promise<void> {
        try {
            await EncryptedStorage.setItem(
                FIRST_PAYMENT_ATTEMPT_KEY,
                new Date().toISOString()
            );
        } catch (error) {
            console.error('Failed to mark first payment attempt:', error);
        }
    }

    /**
     * Check if the Express Graph Sync prompt has already been shown
     */
    private async hasPromptBeenShown(): Promise<boolean> {
        try {
            const promptShown = await EncryptedStorage.getItem(
                EXPRESS_SYNC_PROMPT_SHOWN_KEY
            );
            return promptShown === 'true';
        } catch (error) {
            console.error('Failed to check prompt shown status:', error);
            return false;
        }
    }

    /**
     * Reset first payment attempt tracking (useful for testing)
     */
    public async resetFirstPaymentTracking(): Promise<void> {
        try {
            await EncryptedStorage.removeItem(FIRST_PAYMENT_ATTEMPT_KEY);
            await EncryptedStorage.removeItem(EXPRESS_SYNC_PROMPT_SHOWN_KEY);
        } catch (error) {
            console.error('Failed to reset first payment tracking:', error);
        }
    }

    /**
     * Check current Express Graph Sync status
     */
    public isExpressGraphSyncEnabled(): boolean {
        return this.settingsStore.settings.expressGraphSync;
    }
}

export default ExpressGraphSyncDetector;
