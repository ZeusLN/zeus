import { settingsStore, transactionsStore } from '../stores/Stores';
import { restartNeeded } from './RestartUtils';
import storage from '../storage';
import { SendPaymentReq } from '../stores/TransactionsStore';

const PENDING_PAYMENT_STORAGE_KEY = 'zeus-pending-payment-after-graph-sync';

export const handleEnableGraphSync = async (): Promise<void> => {
    if (transactionsStore.pendingPaymentData) {
        await savePendingPaymentData(transactionsStore.pendingPaymentData);
    }

    await settingsStore.updateSettings({
        expressGraphSync: true,
        graphSyncPromptIgnoreOnce: false
    });

    restartNeeded(true);
};

export const handleIgnoreOnce = async (): Promise<void> => {
    await settingsStore.updateSettings({
        graphSyncPromptIgnoreOnce: true
    });

    transactionsStore.proceedWithPayment();
};

export const handleNeverAskAgain = async (): Promise<void> => {
    await settingsStore.updateSettings({
        graphSyncPromptNeverAsk: true,
        graphSyncPromptIgnoreOnce: false
    });
};

export const savePendingPaymentData = async (
    paymentData: SendPaymentReq
): Promise<void> => {
    try {
        await storage.setItem(
            PENDING_PAYMENT_STORAGE_KEY,
            JSON.stringify(paymentData)
        );
    } catch (error) {
        console.error('Error saving pending payment data:', error);
        throw error;
    }
};

export const loadPendingPaymentData =
    async (): Promise<SendPaymentReq | null> => {
        try {
            const data = await storage.getItem(PENDING_PAYMENT_STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading pending payment data:', error);
        }
        return null;
    };

export const clearPendingPaymentData = async (): Promise<void> => {
    try {
        await storage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    } catch (error) {
        console.error('Error clearing pending payment data:', error);
        throw error;
    }
};

export const checkGraphSyncBeforePayment = (
    settings: any,
    implementation: string,
    paymentData: any,
    transactionsStore: any
): boolean => {
    const isEmbeddedNode = implementation === 'embedded-lnd';
    if (!isEmbeddedNode) {
        return true;
    }

    const isGraphSyncEnabled = settings.expressGraphSync === true;
    if (isGraphSyncEnabled) {
        return true;
    }

    if (settings.graphSyncPromptNeverAsk) {
        return true;
    }

    if (settings.graphSyncPromptIgnoreOnce) {
        settingsStore.updateSettings({
            graphSyncPromptIgnoreOnce: false
        });
    }

    transactionsStore.pendingPaymentData = paymentData;
    transactionsStore.showGraphSyncPrompt = true;
    return false;
};
