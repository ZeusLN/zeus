jest.mock('react-native-keychain', () => ({
    setInternetCredentials: jest.fn(() => Promise.resolve(true)),
    getInternetCredentials: jest.fn(() => Promise.resolve({ password: false })),
    resetInternetCredentials: jest.fn(() => Promise.resolve(true))
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
import * as Keychain from 'react-native-keychain';

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
const mockKeychain = Keychain as jest.Mocked<typeof Keychain>;

describe('GraphSyncUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handleEnableGraphSync', () => {
        it('should enable graph sync and trigger restart without pending data', async () => {
            mockTransactionsStore.pendingPaymentData = null;

            await handleEnableGraphSync();

            expect(mockKeychain.setInternetCredentials).not.toHaveBeenCalled();
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

            expect(mockKeychain.setInternetCredentials).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync',
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

            expect(mockKeychain.setInternetCredentials).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync',
                'zeus-pending-payment-after-graph-sync',
                JSON.stringify(paymentData)
            );
        });

        it('should handle storage errors gracefully', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            mockKeychain.setInternetCredentials.mockRejectedValueOnce(
                new Error('Storage full')
            );

            const paymentData = { payment_request: 'lnbc123...' };
            await savePendingPaymentData(paymentData);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error saving pending payment data:',
                expect.any(Error)
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
            mockKeychain.getInternetCredentials.mockResolvedValueOnce({
                password: JSON.stringify(paymentData)
            } as any);

            const result = await loadPendingPaymentData();

            expect(mockKeychain.getInternetCredentials).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync'
            );
            expect(result).toEqual(paymentData);
        });

        it('should return null when no data is stored', async () => {
            mockKeychain.getInternetCredentials.mockResolvedValueOnce({
                password: false
            } as any);

            const result = await loadPendingPaymentData();

            expect(result).toBeNull();
        });

        it('should handle storage errors gracefully', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            mockKeychain.getInternetCredentials.mockRejectedValueOnce(
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

            expect(mockKeychain.resetInternetCredentials).toHaveBeenCalledWith(
                'zeus-pending-payment-after-graph-sync'
            );
        });

        it('should handle removal errors gracefully', async () => {
            const consoleErrorSpy = jest
                .spyOn(console, 'error')
                .mockImplementation();
            mockKeychain.resetInternetCredentials.mockRejectedValueOnce(
                new Error('Removal failed')
            );

            await clearPendingPaymentData();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error clearing pending payment data:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });
});
