import { action, observable, when, runInAction } from 'mobx';
import { EmitterSubscription, NativeModules } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import BackendUtils from '../utils/BackendUtils';
import { LndMobileToolsEventEmitter } from '../utils/EventListenerUtils';
import { sleep } from '../utils/SleepUtils';

import NodeInfo from '../models/NodeInfo';

import SettingsStore from './SettingsStore';

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
    // rescan tracking
    @observable public isRescanning: boolean = false;
    @observable public rescanStartHeight: number | null = null;
    @observable public rescanCurrentHeight: number | null = null;
    @observable public rescanAddressCount: number | null = null;
    @observable public rescanTxnsFound: number = 0;
    @observable public isLogObservationActive: boolean = false;
    private logListener: EmitterSubscription | null = null;

    nodeInfo: any;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;
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
        this.stopRescanTracking();
    };

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
                        this.bestBlockHeight = Number.parseInt(response.json());
                        if (
                            typeof this.bestBlockHeight === 'number' &&
                            this.currentBlockHeight
                        ) {
                            this.updateProgress();
                        }
                        resolve(this.bestBlockHeight);
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

        await this.getBestBlockHeight();

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

            if (queryMempool) this.getBestBlockHeight();
        }
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
}
