// Mock React Native modules
jest.mock('react-native-encrypted-storage', () => ({
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined)
}));

import EncryptedStorage from 'react-native-encrypted-storage';
import ExpressGraphSyncDetector from './ExpressGraphSyncDetector';
import SettingsStore from '../stores/SettingsStore';

// Mock SettingsStore
const mockSettingsStore = {
    settings: {
        expressGraphSync: false
    }
} as SettingsStore;

describe('ExpressGraphSyncDetector', () => {
    let detector: ExpressGraphSyncDetector;
    const mockGetItem = EncryptedStorage.getItem as jest.MockedFunction<any>;
    const mockSetItem = EncryptedStorage.setItem as jest.MockedFunction<any>;
    const mockRemoveItem =
        EncryptedStorage.removeItem as jest.MockedFunction<any>;

    beforeEach(() => {
        detector = new ExpressGraphSyncDetector(mockSettingsStore);
        jest.clearAllMocks();
    });

    describe('detectPaymentAttempt', () => {
        it('should prompt on first payment attempt when Express Graph Sync is disabled', async () => {
            // Mock first payment attempt (no stored value)
            mockGetItem
                .mockResolvedValueOnce(null) // First payment attempt check
                .mockResolvedValueOnce(null); // Prompt shown check

            const result = await detector.detectPaymentAttempt();

            expect(result).toEqual({
                shouldPrompt: true,
                isFirstPayment: true,
                expressGraphSyncDisabled: true
            });

            // Should mark first payment attempted
            expect(mockSetItem).toHaveBeenCalledWith(
                'zeus-first-payment-attempt',
                expect.any(String)
            );
        });

        it('should not prompt on subsequent payment attempts', async () => {
            // Mock subsequent payment attempt (stored value exists)
            mockGetItem
                .mockResolvedValueOnce('2024-01-01T00:00:00.000Z') // First payment attempt exists
                .mockResolvedValueOnce(null); // Prompt shown check

            const result = await detector.detectPaymentAttempt();

            expect(result).toEqual({
                shouldPrompt: false,
                isFirstPayment: false,
                expressGraphSyncDisabled: true
            });

            // Should not mark first payment attempted again
            expect(mockSetItem).not.toHaveBeenCalled();
        });

        it('should not prompt when Express Graph Sync is already enabled', async () => {
            // Mock settings with Express Graph Sync enabled
            const enabledSettingsStore = {
                settings: { expressGraphSync: true }
            } as SettingsStore;

            detector = new ExpressGraphSyncDetector(enabledSettingsStore);

            mockGetItem
                .mockResolvedValueOnce(null) // First payment attempt check
                .mockResolvedValueOnce(null); // Prompt shown check

            const result = await detector.detectPaymentAttempt();

            expect(result).toEqual({
                shouldPrompt: false,
                isFirstPayment: true,
                expressGraphSyncDisabled: false
            });
        });

        it('should not prompt when prompt has already been shown', async () => {
            mockGetItem
                .mockResolvedValueOnce(null) // First payment attempt check
                .mockResolvedValueOnce('true'); // Prompt already shown

            const result = await detector.detectPaymentAttempt();

            expect(result).toEqual({
                shouldPrompt: false,
                isFirstPayment: true,
                expressGraphSyncDisabled: true
            });
        });

        it('should handle storage errors gracefully', async () => {
            mockGetItem.mockRejectedValue(new Error('Storage error'));

            const result = await detector.detectPaymentAttempt();

            expect(result).toEqual({
                shouldPrompt: false,
                isFirstPayment: false,
                expressGraphSyncDisabled: true
            });
        });
    });

    describe('markPromptShown', () => {
        it('should mark prompt as shown in storage', async () => {
            await detector.markPromptShown();

            expect(mockSetItem).toHaveBeenCalledWith(
                'zeus-express-sync-prompt-shown',
                'true'
            );
        });

        it('should handle storage errors gracefully', async () => {
            mockSetItem.mockRejectedValue(new Error('Storage error'));

            await expect(detector.markPromptShown()).resolves.not.toThrow();
        });
    });

    describe('isExpressGraphSyncEnabled', () => {
        it('should return current Express Graph Sync status', () => {
            expect(detector.isExpressGraphSyncEnabled()).toBe(false);

            const enabledSettingsStore = {
                settings: { expressGraphSync: true }
            } as SettingsStore;

            const enabledDetector = new ExpressGraphSyncDetector(
                enabledSettingsStore
            );
            expect(enabledDetector.isExpressGraphSyncEnabled()).toBe(true);
        });
    });

    describe('resetFirstPaymentTracking', () => {
        it('should remove tracking items from storage', async () => {
            await detector.resetFirstPaymentTracking();

            expect(mockRemoveItem).toHaveBeenCalledWith(
                'zeus-first-payment-attempt'
            );
            expect(mockRemoveItem).toHaveBeenCalledWith(
                'zeus-express-sync-prompt-shown'
            );
        });

        it('should handle storage errors gracefully', async () => {
            mockRemoveItem.mockRejectedValue(new Error('Storage error'));

            await expect(
                detector.resetFirstPaymentTracking()
            ).resolves.not.toThrow();
        });
    });
});
