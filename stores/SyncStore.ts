import { action, observable, when, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import BackendUtils from '../utils/BackendUtils';
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
            await this.getNodeInfo();
            if (!this.nodeInfo?.block_height) {
                await sleep(3000);
            }
        }

        await this.setSyncInfo();

        let i = 0;
        while (this.numBlocksUntilSynced > 0) {
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
}
