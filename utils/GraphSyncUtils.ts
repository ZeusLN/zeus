import { settingsStore, transactionsStore } from '../stores/Stores';
import { restartNeeded } from './RestartUtils';

export const handleEnableGraphSync = async (): Promise<void> => {
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
