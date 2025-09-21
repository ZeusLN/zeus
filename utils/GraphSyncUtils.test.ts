import {
    handleEnableGraphSync,
    handleIgnoreOnce,
    handleNeverAskAgain,
    checkGraphSyncBeforePayment
} from './GraphSyncUtils';

import { settingsStore, transactionsStore } from '../stores/Stores';

import { restartNeeded } from './RestartUtils';

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

describe('GraphSyncUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('handleEnableGraphSync', () => {
        it('should enable graph sync and trigger restart', async () => {
            await handleEnableGraphSync();

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
});
