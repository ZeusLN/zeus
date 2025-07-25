import OnDemandGraphSync from './OnDemandGraphSync';
import { expressGraphSync } from './LndMobileUtils';
import { settingsStore, syncStore } from '../stores/Stores';
import EncryptedStorage from 'react-native-encrypted-storage';

// Mock dependencies
jest.mock('./LndMobileUtils', () => ({
    expressGraphSync: jest.fn()
}));

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            initialLoad: true,
            expressGraphSync: true,
            resetExpressGraphSyncOnStartup: false
        },
        embeddedLndNetwork: 'Mainnet',
        updateSettings: jest.fn()
    },
    syncStore: {
        isInExpressGraphSync: false,
        waitForExpressGraphSyncEnd: jest.fn()
    }
}));

jest.mock('react-native-encrypted-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));

describe('OnDemandGraphSync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default settings
        settingsStore.settings.initialLoad = true;
        settingsStore.settings.expressGraphSync = true;
        settingsStore.embeddedLndNetwork = 'Mainnet';
        syncStore.isInExpressGraphSync = false;
    });

    describe('checkGraphSyncStatus', () => {
        it('should require sync on initial load with Express Graph Sync enabled on mainnet', async () => {
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);

            const status = await OnDemandGraphSync.checkGraphSyncStatus();

            expect(status.requiresSync).toBe(true);
            expect(status.isCompleted).toBe(false);
            expect(status.isInProgress).toBe(false);
        });

        it('should not require sync if already completed', async () => {
            (EncryptedStorage.getItem as jest.Mock).mockImplementation(
                (key) => {
                    if (key === 'zeus-graph-sync-completed')
                        return Promise.resolve('true');
                    return Promise.resolve(null);
                }
            );

            const status = await OnDemandGraphSync.checkGraphSyncStatus();

            expect(status.requiresSync).toBe(false);
            expect(status.isCompleted).toBe(true);
        });

        it('should not require sync on testnet', async () => {
            settingsStore.embeddedLndNetwork = 'Testnet';
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);

            const status = await OnDemandGraphSync.checkGraphSyncStatus();

            expect(status.requiresSync).toBe(false);
        });

        it('should not require sync if Express Graph Sync is disabled', async () => {
            settingsStore.settings.expressGraphSync = false;
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);

            const status = await OnDemandGraphSync.checkGraphSyncStatus();

            expect(status.requiresSync).toBe(false);
        });

        it('should not require sync if not initial load', async () => {
            settingsStore.settings.initialLoad = false;
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);

            const status = await OnDemandGraphSync.checkGraphSyncStatus();

            expect(status.requiresSync).toBe(false);
        });
    });

    describe('ensureGraphSyncCompleted', () => {
        it('should return true if sync not required', async () => {
            settingsStore.settings.initialLoad = false;
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);

            const result = await OnDemandGraphSync.ensureGraphSyncCompleted();

            expect(result).toBe(true);
            expect(expressGraphSync).not.toHaveBeenCalled();
        });

        it('should return true if already completed', async () => {
            (EncryptedStorage.getItem as jest.Mock).mockImplementation(
                (key) => {
                    if (key === 'zeus-graph-sync-completed')
                        return Promise.resolve('true');
                    return Promise.resolve(null);
                }
            );

            const result = await OnDemandGraphSync.ensureGraphSyncCompleted();

            expect(result).toBe(true);
            expect(expressGraphSync).not.toHaveBeenCalled();
        });

        it('should run sync if required and not completed', async () => {
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);
            (expressGraphSync as jest.Mock).mockResolvedValue(true);

            const result = await OnDemandGraphSync.ensureGraphSyncCompleted();

            expect(result).toBe(true);
            expect(expressGraphSync).toHaveBeenCalled();
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeus-graph-sync-in-progress',
                'true'
            );
            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeus-graph-sync-completed',
                'true'
            );
            expect(EncryptedStorage.removeItem).toHaveBeenCalledWith(
                'zeus-graph-sync-in-progress'
            );
        });

        it('should return false if sync fails', async () => {
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);
            (expressGraphSync as jest.Mock).mockRejectedValue(
                new Error('Sync failed')
            );

            const result = await OnDemandGraphSync.ensureGraphSyncCompleted();

            expect(result).toBe(false);
            expect(expressGraphSync).toHaveBeenCalled();
            expect(EncryptedStorage.removeItem).toHaveBeenCalledWith(
                'zeus-graph-sync-in-progress'
            );
        });

        it('should update settings if resetExpressGraphSyncOnStartup is true', async () => {
            settingsStore.settings.resetExpressGraphSyncOnStartup = true;
            (EncryptedStorage.getItem as jest.Mock).mockResolvedValue(null);
            (expressGraphSync as jest.Mock).mockResolvedValue(true);

            await OnDemandGraphSync.ensureGraphSyncCompleted();

            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                resetExpressGraphSyncOnStartup: false
            });
        });
    });

    describe('markGraphSyncCompleted', () => {
        it('should mark graph sync as completed', async () => {
            await OnDemandGraphSync.markGraphSyncCompleted();

            expect(EncryptedStorage.setItem).toHaveBeenCalledWith(
                'zeus-graph-sync-completed',
                'true'
            );
        });
    });

    describe('resetGraphSyncStatus', () => {
        it('should reset graph sync status', async () => {
            await OnDemandGraphSync.resetGraphSyncStatus();

            expect(EncryptedStorage.removeItem).toHaveBeenCalledWith(
                'zeus-graph-sync-completed'
            );
            expect(EncryptedStorage.removeItem).toHaveBeenCalledWith(
                'zeus-graph-sync-in-progress'
            );
        });
    });
});
