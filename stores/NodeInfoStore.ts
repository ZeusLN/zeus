import { action, observable, reaction, runInAction } from 'mobx';
import NetworkInfo from '../models/NetworkInfo';
import NodeInfo from '../models/NodeInfo';
import ChannelsStore from './ChannelsStore';
import SettingsStore from './SettingsStore';
import { errorToUserFriendly } from '../utils/ErrorUtils';
import BackendUtils from '../utils/BackendUtils';
import NetInfo from '@react-native-community/netinfo';

import Channel from '../models/Channel';

export default class NodeInfoStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public nodeInfo: NodeInfo | any = {};
    @observable public networkInfo: NetworkInfo | any = {};
    @observable public testnet: boolean;
    @observable public regtest: boolean;
    @observable public connectionIssuesDebounced: boolean = false;
    @observable public isInternetReachable: boolean = true;
    channelsStore: ChannelsStore;
    settingsStore: SettingsStore;
    private lastConnectionIssueTime: number = 0;
    private debounceTimeMs: number = 5000; // 5 seconds debounce time
    private netInfoUnsubscribe: Function | null = null;
    private connectivityCheckInterval: any = null;

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

        // Setup the connectivity check on construction
        this.setupConnectivityCheck();
    }

    @action
    public setupConnectivityCheck = () => {
        // Start by checking current connectivity state
        this.checkInternetConnectivity();

        // Set up NetInfo event listener for real-time connectivity changes
        if (!this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe = NetInfo.addEventListener((state) => {
                runInAction(() => {
                    this.isInternetReachable = !!state.isInternetReachable;

                    // If internet connectivity is lost, mark error immediately
                    if (!state.isConnected || !state.isInternetReachable) {
                        this.error = true;
                        this.errorMsg = 'Internet connectivity lost';
                    } else if (
                        this.error &&
                        this.errorMsg === 'Internet connectivity lost'
                    ) {
                        // Only clear internet errors, not other errors
                        this.error = false;
                        this.errorMsg = '';
                        // Try to get node info to check sync status after regaining connectivity
                        this.getNodeInfo();
                    }
                });
            });
        }

        // Set up periodic connectivity and node sync check
        if (!this.connectivityCheckInterval) {
            this.connectivityCheckInterval = setInterval(() => {
                // Only run if not already loading
                if (!this.loading) {
                    this.checkInternetConnectivity()
                        .then((isConnected) => {
                            if (isConnected) {
                                this.getNodeInfo();
                            }
                        })
                        .catch((error) => {
                            console.log('Error checking connectivity:', error);
                        });
                }
            }, 30000); // Check every 30 seconds
        }
    };

    @action
    public cleanupConnectivityCheck = () => {
        // Clean up the NetInfo listener when necessary
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }

        // Clean up interval
        if (this.connectivityCheckInterval) {
            clearInterval(this.connectivityCheckInterval);
            this.connectivityCheckInterval = null;
        }
    };

    @action
    public reset = () => {
        this.error = false;
        this.loading = false;
        this.nodeInfo = {};
        this.regtest = false;
        this.testnet = false;
        this.errorMsg = '';
        this.isInternetReachable = true;

        // Also cleanup and reset connectivity checks
        this.cleanupConnectivityCheck();
        this.setupConnectivityCheck();
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

    // Function to check internet connectivity
    public checkInternetConnectivity = async (): Promise<boolean> => {
        const state = await NetInfo.fetch();

        if (!state.isConnected || !state.isInternetReachable) {
            runInAction(() => {
                this.error = true;
                this.errorMsg = 'Internet connectivity lost';
                this.isInternetReachable = false;
            });
            return false;
        }

        runInAction(() => {
            this.isInternetReachable = true;
        });

        return true;
    };

    public hasConnectionIssues = () => {
        // Check if there's a connection error
        const connectionError = this.error === true;

        // Only consider the node not synced if:
        // 1. We have a valid nodeInfo object
        // 2. The synced_to_chain property explicitly exists and is false
        const notSynced =
            this.nodeInfo &&
            Object.keys(this.nodeInfo).length > 0 &&
            this.nodeInfo.synced_to_chain === false;

        // Determine if there are connection issues
        const hasIssue = connectionError || notSynced;

        // Apply debouncing to avoid UI flicker:
        // - If transitioning from no issues to has issues, update immediately
        // - If transitioning from has issues to no issues, debounce for a few seconds
        const now = Date.now();
        if (hasIssue) {
            // If we have issues, update the debounce time and show immediately
            this.lastConnectionIssueTime = now;
            this.connectionIssuesDebounced = true;
        } else if (this.connectionIssuesDebounced) {
            // Only clear the debounced state if enough time has passed since the last issue
            if (now - this.lastConnectionIssueTime > this.debounceTimeMs) {
                this.connectionIssuesDebounced = false;
            }
        }

        console.log(
            'Connection check - Error:',
            connectionError,
            'Not Synced:',
            notSynced
        );
        console.log(
            'Debounced connection issues:',
            this.connectionIssuesDebounced
        );

        return {
            hasIssue: this.connectionIssuesDebounced,
            isConnectionError: connectionError,
            isNotSynced: notSynced
        };
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
