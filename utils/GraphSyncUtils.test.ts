jest.mock('../storage', () => ({
    setItem: jest.fn(() => Promise.resolve(true)),
    getItem: jest.fn(() => Promise.resolve(false)),
    removeItem: jest.fn(() => Promise.resolve(true))
}));

import {
    handleEnableGraphSync,
    handleIgnoreOnce,
    handleNeverAskAgain,
    checkGraphSyncBeforePayment,
    savePendingPaymentData,
    loadPendingPaymentData,
    clearPendingPaymentData
} from './GraphSyncUtils';

import { settingsStore, transactionsStore } from '../stores/Stores';

import { restartNeeded } from './RestartUtils';
import storage from '../storage';

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        updateSettings: jest.fn()
    },
    transactionsStore: {
        proceedWithPayment: jest.fn(),
        pendingPaymentData: null,
        showGraphSyncPrompt: false
    }
}));

jest.mock('./RestartUtils', () => ({
    restartNeeded: jest.fn()
}));

const mockSettingsStore = settingsStore as jest.Mocked<typeof settingsStore>;
const mockTransactionsStore = transactionsStore as jest.Mocked<
    typeof transactionsStore
>;
const mockRestartNeeded = restartNeeded as jest.MockedFunction<
    typeof restartNeeded
>;
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('GraphSyncUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handleEnableGraphSync', () => {
        it('should enable graph sync and trigger restart without pending data', async () => {
            mockTransactionsStore.pendingPaymentData = null;

            await handleEnableGraphSync();

            expect(mockStorage.setItem).not.toHaveBeenCalled();
            expect(mockSettingsStore.updateSettings).toHaveBeenCalledWith({
                expressGraphSync: true,
                graphSyncPromptIgnoreOnce: false
            });
            expect(mockRestartNeeded).toHaveBeenCalledWith(true);
        });

        it('should save pending payment data before restart', async () => {
            const paymentData = { payment_request: 'lnbc123...' };
            mockTransactionsStore.pendingPaymentData = paymentData;

            await handleEnableGraphSync();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync',
                JSON.stringify(paymentData)
            );
            expect(mockSettingsStore.updateSettings).toHaveBeenCalledWith({
                expressGraphSync: true,
                graphSyncPromptIgnoreOnce: false
            });
            expect(mockRestartNeeded).toHaveBeenCalledWith(true);
        });
    });

    describe('handleIgnoreOnce', () => {
        it('should set ignore once flag and proceed with payment', async () => {
            await handleIgnoreOnce();

            expect(mockSettingsStore.updateSettings).toHaveBeenCalledWith({
                graphSyncPromptIgnoreOnce: true
            });
            expect(mockTransactionsStore.proceedWithPayment).toHaveBeenCalled();
        });
    });

    describe('handleNeverAskAgain', () => {
        it('should set never ask flag and reset ignore once', async () => {
            await handleNeverAskAgain();

            expect(mockSettingsStore.updateSettings).toHaveBeenCalledWith({
                graphSyncPromptNeverAsk: true,
                graphSyncPromptIgnoreOnce: false
            });
        });
    });

    describe('checkGraphSyncBeforePayment', () => {
        const mockSettings = {
            expressGraphSync: false,
            graphSyncPromptNeverAsk: false,
            graphSyncPromptIgnoreOnce: false
        };

        it('should return true for non-embedded nodes', () => {
            const result = checkGraphSyncBeforePayment(
                mockSettings,
                'lnd',
                { payment_request: 'test' },
                mockTransactionsStore
            );

            expect(result).toBe(true);
        });

        it('should return true when graph sync is enabled', () => {
            const settingsWithGraphSync = {
                ...mockSettings,
                expressGraphSync: true
            };

            const result = checkGraphSyncBeforePayment(
                settingsWithGraphSync,
                'embedded-lnd',
                { payment_request: 'test' },
                mockTransactionsStore
            );

            expect(result).toBe(true);
        });

        it('should return true when never ask is set', () => {
            const settingsNeverAsk = {
                ...mockSettings,
                graphSyncPromptNeverAsk: true
            };

            const result = checkGraphSyncBeforePayment(
                settingsNeverAsk,
                'embedded-lnd',
                { payment_request: 'test' },
                mockTransactionsStore
            );

            expect(result).toBe(true);
        });

        it('should reset ignore once flag and show prompt when ignore once is set', () => {
            const settingsIgnoreOnce = {
                ...mockSettings,
                graphSyncPromptIgnoreOnce: true
            };

            const result = checkGraphSyncBeforePayment(
                settingsIgnoreOnce,
                'embedded-lnd',
                { payment_request: 'test' },
                mockTransactionsStore
            );

            expect(mockSettingsStore.updateSettings).toHaveBeenCalledWith({
                graphSyncPromptIgnoreOnce: false
            });
            expect(mockTransactionsStore.pendingPaymentData).toEqual({
                payment_request: 'test'
            });
            expect(mockTransactionsStore.showGraphSyncPrompt).toBe(true);
            expect(result).toBe(false);
        });

        it('should show prompt and return false when graph sync is disabled', () => {
            const result = checkGraphSyncBeforePayment(
                mockSettings,
                'embedded-lnd',
                { payment_request: 'test' },
                mockTransactionsStore
            );

            expect(mockTransactionsStore.pendingPaymentData).toEqual({
                payment_request: 'test'
            });
            expect(mockTransactionsStore.showGraphSyncPrompt).toBe(true);
            expect(result).toBe(false);
        });
    });

    describe('savePendingPaymentData', () => {
        it('should save payment data to storage', async () => {
            const paymentData = {
                payment_request: 'lnbc123...',
                amount: '1000'
            };

            await savePendingPaymentData(paymentData);

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync',
                JSON.stringify(paymentData)
            );
        });

        it('should re-throw storage errors', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            const storageError = new Error('Storage full');
            mockStorage.setItem.mockRejectedValueOnce(storageError);

            const paymentData = { payment_request: 'lnbc123...' };

            await expect(savePendingPaymentData(paymentData)).rejects.toThrow(
                'Storage full'
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error saving pending payment data:',
                storageError
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('loadPendingPaymentData', () => {
        it('should load and parse payment data from storage', async () => {
            const paymentData = {
                payment_request: 'lnbc123...',
                amount: '1000'
            };
            mockStorage.getItem.mockResolvedValueOnce(
                JSON.stringify(paymentData)
            );

            const result = await loadPendingPaymentData();

            expect(mockStorage.getItem).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync'
            );
            expect(result).toEqual(paymentData);
        });

        it('should return null when no data is stored', async () => {
            mockStorage.getItem.mockResolvedValueOnce(false);

            const result = await loadPendingPaymentData();

            expect(result).toBeNull();
        });

        it('should handle storage errors gracefully', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            mockStorage.getItem.mockRejectedValueOnce(
                new Error('Storage error')
            );

            const result = await loadPendingPaymentData();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error loading pending payment data:',
                expect.any(Error)
            );
            expect(result).toBeNull();

            consoleErrorSpy.mockRestore();
        });
    });

    describe('clearPendingPaymentData', () => {
        it('should remove payment data from storage', async () => {
            await clearPendingPaymentData();

            expect(mockStorage.removeItem).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync'
            );
        });

        it('should re-throw removal errors', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            const removalError = new Error('Removal failed');
            mockStorage.removeItem.mockRejectedValueOnce(removalError);

            await expect(clearPendingPaymentData()).rejects.toThrow(
                'Removal failed'
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error clearing pending payment data:',
                removalError
            );

            consoleErrorSpy.mockRestore();
        });
    });
});
