import { action, observable, reaction } from 'mobx';
import NodeInfo from './../models/NodeInfo';
import SettingsStore from './SettingsStore';
import ErrorUtils from './../utils/ErrorUtils';
import RESTUtils from './../utils/RESTUtils';

export default class NodeInfoStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorMsg: string;
    @observable public nodeInfo: NodeInfo | any = {};
    @observable public testnet: boolean;
    @observable public regtest: boolean;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.hasCredentials()) {
                    this.getNodeInfo();
                }
            }
        );
    }

    reset = () => {
        this.error = false;
        this.loading = false;
        this.nodeInfo = {};
        this.regtest = false;
        this.testnet = false;
        this.errorMsg = '';
    };

    @action
    getNodeInfoError = () => {
        this.error = true;
        this.loading = false;
        this.nodeInfo = {};
    };

    @action
    setLoading = () => {
        this.loading = true;
    };

    @action
    public getNodeInfo = () => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getMyNodeInfo()
            .then((data: any) => {
                const nodeInfo = new NodeInfo(data);
                this.nodeInfo = nodeInfo;
                this.testnet = nodeInfo.isTestNet;
                this.regtest = nodeInfo.isRegTest;
                this.loading = false;
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = ErrorUtils.errorToUserFriendly(
                    error.toString()
                );
                this.getNodeInfoError();
            });
    };
}
