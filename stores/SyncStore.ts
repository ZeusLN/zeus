import { action, observable, when, runInAction, computed } from 'mobx';
import { EmitterSubscription, NativeModules } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import BackendUtils from '../utils/BackendUtils';
import { LndMobileToolsEventEmitter } from '../utils/EventListenerUtils';
import { sleep } from '../utils/SleepUtils';
import Storage from '../storage';

import NodeInfo from '../models/NodeInfo';

import ConnectivityStore from './ConnectivityStore';
import SettingsStore from './SettingsStore';

const ADVANCED_SYNC_METRICS_KEY = 'advancedSyncMetrics';

interface AdvancedSyncMetrics {
    headerSyncHeight: number | null;
    filterHeaderSyncHeight: number | null;
}

export default class SyncStore {
    @observable public isSyncing: boolean = false;
    @observable public isRecovering: boolean = false;
    @observable public recoveryProgress: number | null;
    @observable public isInExpressGraphSync: boolean = false;
    @observable public bestBlockHeight: number;
    @observable public currentBlockHeight: number;
    @observable public currentProgress: number;
    @observable public numBlocksUntilSynced: number;
    @observable public error: boolean = false;
    @observable public isRescanning: boolean = false;
    @observable public rescanStartHeight: number | null = null;
    @observable public rescanCurrentHeight: number | null = null;
    @observable public rescanAddressCount: number | null = null;
    @observable public rescanTxnsFound: number = 0;
    @observable public isLogObservationActive: boolean = false;
    private logListener: EmitterSubscription | null = null;

    @observable public headerSyncHeight: number | null = null;
    @observable public filterHeaderSyncHeight: number | null = null;
    @observable public showAdvancedSyncMetrics: boolean = false;
    private syncLogListener: EmitterSubscription | null = null;

    nodeInfo: any;
    settingsStore: SettingsStore;
    connectivityStore: ConnectivityStore;

    constructor(
        settingsStore: SettingsStore,
        connectivityStore: ConnectivityStore
    ) {
        this.settingsStore = settingsStore;
        this.connectivityStore = connectivityStore;
        this.loadAdvancedMetrics();
        connectivityStore.onReconnect(() => {
            if (
                !this.isSyncing &&
                this.settingsStore.implementation === 'embedded-lnd'
            ) {
                this.startSyncing();
            }
        });
    }

    @action
    public reset = () => {
        this.isSyncing = false;
        this.isRecovering = false;
        this.isInExpressGraphSync = false;
        this.error = false;
        this.nodeInfo = undefined;
        this.bestBlockHeight = 0;
        this.currentBlockHeight = 0;
        this.currentProgress = 0;
        this.numBlocksUntilSynced = 1;
        this.stopSyncLogObservation();

        this.stopRescanTracking();
    };

    @computed
    get isBusy() {
        return this.isSyncing || this.isRecovering || this.isRescanning;
    }

    public setExpressGraphSyncStatus = (syncing: boolean) =>
        (this.isInExpressGraphSync = syncing);

    public waitForExpressGraphSyncEnd = () => {
        return when(() => !this.isInExpressGraphSync);
    };

    private setSyncInfo = async () => {
        const nodeInfo = this.nodeInfo;

        if (this.currentBlockHeight !== nodeInfo?.block_height) {
            this.currentBlockHeight = nodeInfo?.block_height || 0;

            // if current block exceeds or equals best block height, query mempool for new tip
            // if mempool call fails, set best block height to current height, then proceed
            if (this.currentBlockHeight >= this.bestBlockHeight) {
                await this.getBestBlockHeight();
                if (this.error) this.bestBlockHeight = this.currentBlockHeight;
            }

            this.updateProgress();
        }

        if (nodeInfo?.synced_to_chain || this.numBlocksUntilSynced <= 0) {
            this.isSyncing = false;
        }

        return;
    };

    private getNodeInfo = () =>
        BackendUtils.getMyNodeInfo().then(
            (data: any) => (this.nodeInfo = new NodeInfo(data))
        );

    @action
    private updateProgress = () => {
        this.currentProgress =
            (this.currentBlockHeight ?? 0) - (this.bestBlockHeight ?? 0);
        this.numBlocksUntilSynced =
            (this.bestBlockHeight ?? 0) - this.currentBlockHeight;
    };

    private getBestBlockHeight = async () => {
        await new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'get',
                `https://mempool.space/${
                    this.settingsStore.embeddedLndNetwork === 'Testnet'
                        ? 'testnet/'
                        : ''
                }api/blocks/tip/height`
            )
                .then(async (response: any) => {
                    const status = response.info().status;
                    if (status == 200) {
                        try {
                            const rawText = response.text
                                ? response.text()
                                : response.data;
                            const parsedVal = Number.parseInt(rawText, 10);
                            if (!isNaN(parsedVal)) {
                                this.bestBlockHeight = parsedVal;
                                if (
                                    typeof this.bestBlockHeight === 'number' &&
                                    this.currentBlockHeight
                                ) {
                                    this.updateProgress();
                                }
                                resolve(this.bestBlockHeight);
                            } else {
                                this.error = true;
                                reject('Not a number');
                            }
                        } catch (e) {
                            this.error = true;
                            reject(e);
                        }
                    } else {
                        this.error = true;
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    reject();
                });
        });
    };

    @action
    public startSyncing = async () => {
        this.isSyncing = true;
        this.error = false;
        this.bestBlockHeight = 0;
        this.numBlocksUntilSynced = 1;

        if (this.settingsStore.implementation === 'embedded-lnd') {
            await this.loadAdvancedMetrics();
            this.startSyncLogObservation();
        }

        // Fetch best block height, retrying until successful
        while (!this.bestBlockHeight) {
            if (!this.isSyncing) return;
            try {
                await this.getBestBlockHeight();
            } catch {
                await sleep(3000);
            }
        }

        // initial fetch
        while (!this.nodeInfo?.block_height) {
            if (!this.isSyncing) return;
            await this.getNodeInfo();
            if (!this.nodeInfo?.block_height) {
                await sleep(3000);
            }
        }

        await this.setSyncInfo();

        let i = 0;
        while (this.numBlocksUntilSynced > 0) {
            if (!this.isSyncing) break; // Abort when reset() called (e.g. LND stopped for wallet creation)
            await sleep(2000);
            this.getNodeInfo().then(() => this.setSyncInfo());

            // only query Mempool instance every 30 seconds
            const queryMempool = i === 14;
            if (queryMempool) {
                i = 0;
            } else {
                i++;
            }

            if (queryMempool) {
                this.getBestBlockHeight().catch(() => {});
            }
        }
        this.stopSyncLogObservation();
    };

    public checkRecoveryStatus = () => {
        BackendUtils.getRecoveryInfo().then((data: any) => {
            if (data.recovery_mode && !data.recovery_finished) {
                this.startRecovering();
            }
        });
    };

    private getRecoveryStatus = async () => {
        await BackendUtils.getRecoveryInfo().then((data: any) => {
            runInAction(() => {
                if (data.recovery_mode) {
                    if (data.progress) {
                        this.recoveryProgress = data.progress;
                    }
                    if (data.recovery_finished) {
                        this.isRecovering = false;
                        this.recoveryProgress = null;
                    }
                } else {
                    this.isRecovering = false;
                    this.recoveryProgress = null;
                }
            });
            return data;
        });
    };

    private startRecovering = async () => {
        this.isRecovering = true;

        while (this.isRecovering) {
            await sleep(2000);
            await this.getRecoveryStatus();
        }
    };
    // Rescan tracking methods
    private getNetwork = (): string => {
        const network = this.settingsStore.embeddedLndNetwork?.toLowerCase();
        if (network === 'testnet3' || network === 'testnet') {
            return 'testnet';
        } else if (network === 'testnet4') {
            return 'testnet4';
        }
        return 'mainnet';
    };

    @action
    public startRescanTracking = (startHeight: number) => {
        // Remove existing listener if any to prevent memory leaks
        if (this.logListener) {
            this.logListener.remove();
            this.logListener = null;
        }

        this.isRescanning = true;
        this.rescanStartHeight = startHeight;
        this.rescanCurrentHeight = startHeight;
        this.rescanTxnsFound = 0;
        this.rescanAddressCount = null;

        const network = this.getNetwork();
        const lndDir = this.settingsStore.lndDir || 'lnd';
        // Add listener for log events
        this.logListener = LndMobileToolsEventEmitter.addListener(
            'lndlog',
            (data: string) => this.parseRescanLog(data)
        );
        // Start observing log file (may fail if file doesn't exist yet)
        NativeModules.LndMobileTools.observeLndLogFile(lndDir, network)
            .then(() => {
                runInAction(() => {
                    this.isLogObservationActive = true;
                });
            })
            .catch((e: any) => {
                console.log('Could not observe log file:', e);
                runInAction(() => {
                    this.isLogObservationActive = false;
                });
            });
    };

    @action
    public stopRescanTracking = () => {
        if (this.logListener) {
            this.logListener.remove();
            this.logListener = null;
        }
        this.isRescanning = false;
        this.rescanStartHeight = null;
        this.rescanCurrentHeight = null;
        this.rescanAddressCount = null;
        this.rescanTxnsFound = 0;
        this.isLogObservationActive = false;
    };

    @action
    private parseRescanLog = (logLine: string) => {
        // Log lines have format: "2026-01-21 02:15:44.368 [INF] BTWL: Finished rescan..."
        // Use regex that matches anywhere in the line

        // Check for rescan start with height
        // Pattern: "Started rescan from block ... (height 118957) for 9 addrs"
        const startMatch = logLine.match(
            /Started rescan from block.*\(height (\d+)\)/
        );
        if (startMatch) {
            this.rescanStartHeight = parseInt(startMatch[1], 10);
            this.rescanCurrentHeight = parseInt(startMatch[1], 10);
            return;
        }
        // Check for rescan progress updates
        // Pattern: "Rescanned through block ... (height 119000)"
        const progressMatch = logLine.match(
            /Rescanned through block.*\(height (\d+)\)/
        );
        if (progressMatch) {
            this.rescanCurrentHeight = parseInt(progressMatch[1], 10);
            return;
        }

        // Check for rescan completion
        // Pattern: "Finished rescan for 9 addresses (synced to block ..., height 119438)"
        const finishedMatch = logLine.match(
            /Finished rescan for (\d+) addresses.*height (\d+)/
        );
        if (finishedMatch) {
            this.rescanAddressCount = parseInt(finishedMatch[1], 10);
            this.rescanCurrentHeight = parseInt(finishedMatch[2], 10);
            this.stopRescanTracking();
            return;
        }

        // Check for address count
        // Pattern: "Rescan called for 9 addresses, 0 outpoints"
        const addrMatch = logLine.match(/Rescan called for (\d+) addresses/);
        if (addrMatch) {
            this.rescanAddressCount = parseInt(addrMatch[1], 10);
        }
    };

    @action
    public startSyncLogObservation = () => {
        if (this.syncLogListener) {
            this.syncLogListener.remove();
            this.syncLogListener = null;
        }

        const network = this.getNetwork();
        const lndDir = this.settingsStore.lndDir || 'lnd';

        this.syncLogListener = LndMobileToolsEventEmitter.addListener(
            'lndlog',
            (data: string) => this.parseSyncLog(data)
        );

        NativeModules.LndMobileTools.observeLndLogFile(lndDir, network).catch(
            (e: any) => {
                console.log('Could not observe log file for sync metrics:', e);
            }
        );
    };

    @action
    public loadAdvancedMetrics = async () => {
        try {
            const metrics = await Storage.getItem(ADVANCED_SYNC_METRICS_KEY);
            if (metrics) {
                const parsed: AdvancedSyncMetrics = JSON.parse(metrics);
                this.headerSyncHeight =
                    parsed?.headerSyncHeight != null
                        ? Number(parsed.headerSyncHeight)
                        : null;
                this.filterHeaderSyncHeight =
                    parsed?.filterHeaderSyncHeight != null
                        ? Number(parsed.filterHeaderSyncHeight)
                        : null;
                return;
            }

            const h = await Storage.getItem('headerSyncHeight');
            const f = await Storage.getItem('filterHeaderSyncHeight');
            this.headerSyncHeight = h ? parseInt(h, 10) : null;
            this.filterHeaderSyncHeight = f ? parseInt(f, 10) : null;
            this.persistAdvancedMetrics();
        } catch (e) {
            console.log('Error loading advanced sync metrics', e);
        }
    };

    private persistAdvancedMetrics = async () => {
        try {
            await Storage.setItem(ADVANCED_SYNC_METRICS_KEY, {
                headerSyncHeight: this.headerSyncHeight,
                filterHeaderSyncHeight: this.filterHeaderSyncHeight
            });
        } catch (e) {
            console.log('Error saving advanced sync metrics', e);
        }
    };

    @action
    public stopSyncLogObservation = () => {
        if (this.syncLogListener) {
            this.syncLogListener.remove();
            this.syncLogListener = null;
        }
    };

    @action
    private parseSyncLog = (logLine: string) => {
        // "Processed 18000 blocks in the last 10.7s (height 1100008,"
        const blockMatch = logLine.match(
            /Processed .* blocks .* \(height (\d+),/
        );
        if (blockMatch) {
            this.headerSyncHeight = parseInt(blockMatch[1], 10);
            this.persistAdvancedMetrics();
            return;
        }

        // "Verified 18000 filter headers in the last 10.68s (height 1104001,"
        const verifiedMatch = logLine.match(
            /Verified .* filter headers .* \(height (\d+),/
        );
        if (verifiedMatch) {
            this.filterHeaderSyncHeight = parseInt(verifiedMatch[1], 10);
            this.persistAdvancedMetrics();
            return;
        }

        // "Successfully got filter headers for 1100 checkpoints"
        const checkpointMatch = logLine.match(
            /Successfully got filter headers for (\d+) checkpoints/
        );
        if (checkpointMatch) {
            this.filterHeaderSyncHeight =
                parseInt(checkpointMatch[1], 10) * 1000;
            this.persistAdvancedMetrics();
            return;
        }
    };

    @action
    public toggleAdvancedSyncMetrics = () => {
        this.showAdvancedSyncMetrics = !this.showAdvancedSyncMetrics;
    };
}