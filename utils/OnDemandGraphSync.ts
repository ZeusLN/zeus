/**
 * OnDemandGraphSync - Handles on-demand graph synchronization for first-run scenarios
 *
 * This service ensures users can make Lightning payments in their first session
 * by running Express Graph Sync on-demand when needed, even if initialLoad is true.
 */

import { expressGraphSync } from './LndMobileUtils';
import { settingsStore, syncStore } from '../stores/Stores';
import EncryptedStorage from 'react-native-encrypted-storage';

const GRAPH_SYNC_COMPLETED_KEY = 'zeus-graph-sync-completed';
const GRAPH_SYNC_IN_PROGRESS_KEY = 'zeus-graph-sync-in-progress';

export interface GraphSyncStatus {
    isCompleted: boolean;
    isInProgress: boolean;
    requiresSync: boolean;
}

class OnDemandGraphSync {
    private syncPromise: Promise<boolean> | null = null;

    /**
     * Check if graph sync is needed for the current session
     */
    public async checkGraphSyncStatus(): Promise<GraphSyncStatus> {
        try {
            const [completed, inProgress] = await Promise.all([
                EncryptedStorage.getItem(GRAPH_SYNC_COMPLETED_KEY),
                EncryptedStorage.getItem(GRAPH_SYNC_IN_PROGRESS_KEY)
            ]);

            const isInitialLoad = settingsStore.settings.initialLoad;
            const expressGraphSyncEnabled =
                settingsStore.settings.expressGraphSync;
            const embeddedLndNetwork = settingsStore.embeddedLndNetwork;

            // Graph sync is only needed on mainnet when Express Graph Sync is enabled
            const requiresSync =
                expressGraphSyncEnabled &&
                embeddedLndNetwork === 'Mainnet' &&
                !completed &&
                isInitialLoad;

            return {
                isCompleted: completed === 'true',
                isInProgress:
                    inProgress === 'true' || syncStore.isInExpressGraphSync,
                requiresSync
            };
        } catch (error) {
            console.error('Failed to check graph sync status:', error);
            return {
                isCompleted: false,
                isInProgress: false,
                requiresSync: false
            };
        }
    }

    /**
     * Ensure graph sync has completed before allowing payment
     * This is called when a payment is attempted in the first session
     */
    public async ensureGraphSyncCompleted(): Promise<boolean> {
        const status = await this.checkGraphSyncStatus();

        // If sync is not required or already completed, return success
        if (!status.requiresSync || status.isCompleted) {
            return true;
        }

        // If sync is already in progress, wait for it
        if (status.isInProgress || this.syncPromise) {
            return this.waitForSync();
        }

        // Start sync if needed
        return this.startOnDemandSync();
    }

    /**
     * Start on-demand graph sync for first session
     */
    private async startOnDemandSync(): Promise<boolean> {
        // Prevent multiple simultaneous syncs
        if (this.syncPromise) {
            return this.syncPromise;
        }

        console.log(
            '[OnDemandGraphSync] Starting Express Graph Sync for first session payment'
        );

        this.syncPromise = (async () => {
            try {
                // Mark sync as in progress
                await EncryptedStorage.setItem(
                    GRAPH_SYNC_IN_PROGRESS_KEY,
                    'true'
                );

                // Run Express Graph Sync
                const syncStart = new Date().getTime();
                await expressGraphSync();
                const syncDuration = new Date().getTime() - syncStart;

                console.log(
                    `[OnDemandGraphSync] Express Graph Sync completed in ${syncDuration}ms`
                );

                // Mark sync as completed
                await Promise.all([
                    EncryptedStorage.setItem(GRAPH_SYNC_COMPLETED_KEY, 'true'),
                    EncryptedStorage.removeItem(GRAPH_SYNC_IN_PROGRESS_KEY)
                ]);

                // Update settings if resetExpressGraphSyncOnStartup was set
                if (settingsStore.settings.resetExpressGraphSyncOnStartup) {
                    await settingsStore.updateSettings({
                        resetExpressGraphSyncOnStartup: false
                    });
                }

                return true;
            } catch (error) {
                console.error(
                    '[OnDemandGraphSync] Express Graph Sync failed:',
                    error
                );

                // Clean up in-progress flag on error
                await EncryptedStorage.removeItem(GRAPH_SYNC_IN_PROGRESS_KEY);

                // Don't mark as completed on error - allow retry
                return false;
            } finally {
                this.syncPromise = null;
            }
        })();

        return this.syncPromise;
    }

    /**
     * Wait for an in-progress sync to complete
     */
    private async waitForSync(): Promise<boolean> {
        if (this.syncPromise) {
            return this.syncPromise;
        }

        // If no promise but sync store shows in progress, wait for it
        if (syncStore.isInExpressGraphSync) {
            console.log(
                '[OnDemandGraphSync] Waiting for in-progress Express Graph Sync'
            );
            await syncStore.waitForExpressGraphSyncEnd();

            // Mark as completed after sync ends
            await EncryptedStorage.setItem(GRAPH_SYNC_COMPLETED_KEY, 'true');
            return true;
        }

        return false;
    }

    /**
     * Reset graph sync status (useful after app updates or for testing)
     */
    public async resetGraphSyncStatus(): Promise<void> {
        try {
            await Promise.all([
                EncryptedStorage.removeItem(GRAPH_SYNC_COMPLETED_KEY),
                EncryptedStorage.removeItem(GRAPH_SYNC_IN_PROGRESS_KEY)
            ]);
        } catch (error) {
            console.error('Failed to reset graph sync status:', error);
        }
    }

    /**
     * Mark graph sync as completed (called after normal startup sync)
     */
    public async markGraphSyncCompleted(): Promise<void> {
        try {
            await EncryptedStorage.setItem(GRAPH_SYNC_COMPLETED_KEY, 'true');
        } catch (error) {
            console.error('Failed to mark graph sync as completed:', error);
        }
    }
}

export default new OnDemandGraphSync();
