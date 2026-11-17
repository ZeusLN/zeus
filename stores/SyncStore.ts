import { action, observable, when, runInAction, computed } from 'mobx';
import { EmitterSubscription, NativeModules } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import BackendUtils from '../utils/BackendUtils';
import { LndMobileToolsEventEmitter } from '../utils/EventListenerUtils';
import { sleep } from '../utils/SleepUtils';
import SyncUtils from '../utils/SyncUtils';
import UrlUtils from '../utils/UrlUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

import NodeInfo from '../models/NodeInfo';

import ConnectivityStore from './ConnectivityStore';
import SettingsStore from './SettingsStore';
import { alertStore } from './Stores';

const TIP_FETCH_MAX_ATTEMPTS = 3;
const TIP_FETCH_RETRY_DELAY_MS = 3000;

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
    // Bumped by reset() and by each start, so a polling loop left over
    // from an earlier run exits instead of polling alongside the new one
    private syncRun = 0;
    private recoveryRun = 0;

    nodeInfo: any;
    settingsStore: SettingsStore;
    connectivityStore: ConnectivityStore;

    constructor(
        settingsStore: SettingsStore,
        connectivityStore: ConnectivityStore
    ) {
        this.settingsStore = settingsStore;
        this.connectivityStore = connectivityStore;
        // Resume syncing when connectivity is restored (embedded-lnd only)
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
        this.syncRun++;
        this.recoveryRun++;
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
            // if the mempool instance is unreachable, estimate the tip from
            // the node's own best header instead
            if (this.currentBlockHeight >= this.bestBlockHeight) {
                await this.getBestBlockHeight().catch(() => {});
                if (this.error) {
                    this.bestBlockHeight = SyncUtils.estimateBestBlockHeight(
                        this.currentBlockHeight,
                        nodeInfo?.best_header_timestamp
                    );
                }
            }

            this.updateProgress();
        }

        // An estimated tip can undershoot the real one, so while the mempool
        // instance is unreachable only the node's synced_to_chain may declare
        // the sync complete
        if (
            nodeInfo?.synced_to_chain ||
            (!this.error && this.numBlocksUntilSynced <= 0)
        ) {
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
        // nodeInfoStore.nodeInfo isn't populated during initial sync, so the
        // network comes from settings instead. SyncStore only runs for embedded
        // LND (Mainnet/Testnet). The URL we actually fetch is the only
        // authoritative source for which host is being contacted — do not
        // recompute the host from nodeInfoStore.nodeInfo.
        const url = `${UrlUtils.getMempoolApiUrl({
            isMutinynet: false,
            isTestNet: this.settingsStore.embeddedLndNetwork === 'Testnet'
        })}/blocks/tip/height`;
        await new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch('get', url)
                .then(async (response: any) => {
                    const status = response.info().status;

                    if (status !== 200) {
                        this.error = true;
                        alertStore.setMempoolErrorFromUrl(
                            url,
                            `HTTP ${status}`
                        );
                        reject();
                        return;
                    }

                    let height: number;
                    try {
                        height = Number.parseInt(response.json());
                    } catch {
                        height = NaN;
                    }

                    if (!Number.isFinite(height)) {
                        this.error = true;
                        alertStore.setMempoolErrorFromUrl(
                            url,
                            'Invalid response'
                        );
                        reject();
                        return;
                    }

                    this.bestBlockHeight = height;
                    this.error = false;
                    alertStore.clearMempoolError();
                    if (this.currentBlockHeight) {
                        this.updateProgress();
                    }
                    resolve(this.bestBlockHeight);
                })
                .catch((error: any) => {
                    this.error = true;
                    alertStore.setMempoolErrorFromUrl(
                        url,
                        errorToUserFriendly(error)
                    );
                    reject();
                });
        });
    };

    @action
    public startSyncing = async () => {
        const run = ++this.syncRun;
        const isCurrent = () => run === this.syncRun && this.isSyncing;
        this.isSyncing = true;
        this.error = false;
        this.bestBlockHeight = 0;
        this.numBlocksUntilSynced = 1;

        // Fetch best block height with bounded retries; an unreachable
        // mempool instance must not wedge the sync UI, since the tip can
        // be estimated from the node's own best header while it is down
        for (let attempt = 0; attempt < TIP_FETCH_MAX_ATTEMPTS; attempt++) {
            if (!isCurrent()) return;
            try {
                await this.getBestBlockHeight();
                break;
            } catch {
                await sleep(TIP_FETCH_RETRY_DELAY_MS);
            }
        }

        // initial fetch
        try {
            while (!this.nodeInfo?.block_height) {
                if (!isCurrent()) return;
                await this.getNodeInfo();
                if (!this.nodeInfo?.block_height) {
                    await sleep(3000);
                }
            }
        } catch {
            // Clear the flag so callers and onReconnect can start again
            if (run === this.syncRun) this.isSyncing = false;
            return;
        }
        if (!isCurrent()) return;

        await this.setSyncInfo();

        let i = 0;
        while (isCurrent()) {
            // Loops until setSyncInfo declares the sync complete, reset()
            // is called (e.g. LND stopped for wallet creation) or a newer
            // startSyncing() takes over
            await sleep(2000);
            if (!isCurrent()) return;
            this.getNodeInfo().then(() => this.setSyncInfo());

            // only query Mempool instance every 30 seconds
            // a success here swaps an estimated tip back to a real one
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
        // checkRecoveryStatus runs on every refresh; keep one loop
        if (this.isRecovering) return;
        const run = ++this.recoveryRun;
        const isCurrent = () => run === this.recoveryRun && this.isRecovering;
        this.isRecovering = true;

        while (isCurrent()) {
            await sleep(2000);
            if (!isCurrent()) return;
            try {
                await this.getRecoveryStatus();
            } catch {
                // Clear the flag so the next checkRecoveryStatus can
                // restart the loop or see that recovery finished
                if (run === this.recoveryRun) this.isRecovering = false;
                return;
            }
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
