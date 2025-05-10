import { action, observable, reaction, runInAction } from 'mobx';
import NetworkInfo from '../models/NetworkInfo';
import NodeInfo from '../models/NodeInfo';
import ChannelsStore from './ChannelsStore';
import SettingsStore from './SettingsStore';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import BackendUtils from '../utils/BackendUtils';

import Channel from '../models/Channel';

export default class NodeInfoStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public nodeInfo: NodeInfo | any = {};
    @observable public networkInfo: NetworkInfo | any = {};
    @observable public testnet: boolean;
    @observable public regtest: boolean;
    @observable public supportsOffers: boolean;
    channelsStore: ChannelsStore;
    settingsStore: SettingsStore;

    constructor(channelsStore: ChannelsStore, settingsStore: SettingsStore) {
        this.channelsStore = channelsStore;
        this.settingsStore = settingsStore;

        reaction(
            () => this.channelsStore.channels,
            () => {
                if (this.channelsStore.channels.length !== 0) {
                    this.getNodeInfo();
                }
            }
        );
    }

    @action
    public reset = () => {
        this.error = false;
        this.loading = false;
        this.nodeInfo = {};
        this.regtest = false;
        this.testnet = false;
        this.errorMsg = '';
        this.supportsOffers = false;
    };

    @action
    public handleGetNodeInfoError = () => {
        this.error = true;
        this.loading = false;
        this.nodeInfo = {};
    };

    @action
    private handleGetNetworkInfoError = () => {
        this.error = true;
        this.loading = false;
        this.networkInfo = {};
    };

    private currentRequest: any;

    @action
    public getNodeInfo = () => {
        this.errorMsg = '';
        this.loading = true;
        const currentRequest = (this.currentRequest = {});
        return new Promise((resolve, reject) => {
            BackendUtils.getMyNodeInfo()
                .then((data: any) => {
                    if (this.currentRequest !== currentRequest) {
                        return;
                    }
                    const nodeInfo = new NodeInfo(data);
                    runInAction(() => {
                        this.nodeInfo = nodeInfo;
                        this.testnet = nodeInfo.isTestNet;
                        this.regtest = nodeInfo.isRegTest;
                        this.loading = false;
                        this.error = false;
                        this.supportsOffers = BackendUtils.supportsOffers();
                    });
                    resolve(nodeInfo);
                })
                .catch((error: any) => {
                    if (this.currentRequest !== currentRequest) {
                        resolve('Old getNodeInfo call');
                        return;
                    }
                    runInAction(() => {
                        this.errorMsg = errorToUserFriendly(error.toString());
                        this.handleGetNodeInfoError();
                    });
                    reject(error);
                });
        });
    };

    @action
    public getNetworkInfo = () => {
        this.errorMsg = '';
        this.loading = true;
        return BackendUtils.getNetworkInfo()
            .then((data: any) => {
                runInAction(() => {
                    this.networkInfo = new NetworkInfo(data);
                    this.loading = false;
                    this.error = false;
                });
                return this.networkInfo;
            })
            .catch((error: any) => {
                runInAction(() => {
                    this.errorMsg = errorToUserFriendly(error.toString());
                    this.handleGetNetworkInfoError();
                });
            });
    };

    public isLightningReadyToSend = async () => {
        await this.channelsStore.getChannels();
        await this.getNodeInfo();
        const syncedToChain = this.nodeInfo?.synced_to_chain;

        return (
            syncedToChain &&
            this.channelsStore.channels.some(
                (channel: Channel) => channel.active
            )
        );
    };

    public isLightningReadyToReceive = async () => {
        await this.channelsStore.getChannels();
        let syncedToChain = this.nodeInfo?.synced_to_chain;
        if (!syncedToChain) {
            await this.getNodeInfo();
            syncedToChain = this.nodeInfo?.synced_to_chain;
        }

        return (
            syncedToChain &&
            this.channelsStore.channels.some(
                (channel: Channel) => channel.active
            )
        );
    };

    public flowLspNotConfigured = () => {
        const { implementation, certVerification } = this.settingsStore;

        const scidAlias =
            this.nodeInfo.features && this.nodeInfo.features['47'];
        const zeroConf = this.nodeInfo.features && this.nodeInfo.features['51'];
        const zeroConfConfig = zeroConf && scidAlias;

        const restIsConfigured = certVerification && zeroConfConfig;
        const flowLspNotConfigured =
            implementation === 'lnd'
                ? !restIsConfigured
                : implementation === 'embedded-lnd'
                ? false
                : true;

        return {
            flowLspNotConfigured,
            restIsConfigured,
            zeroConfConfig,
            zeroConf,
            scidAlias
        };
    };
}
