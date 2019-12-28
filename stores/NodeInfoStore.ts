import { action, observable, reaction } from 'mobx';
import NodeInfo from './../models/NodeInfo';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class NodeInfoStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public errorMsg: string;
    @observable public nodeInfo: NodeInfo = {};
    @observable public testnet: boolean;
    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.macaroonHex) {
                    this.getNodeInfo();
                }
            }
        );
    }

    @action
    public getNodeInfo = () => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getNodeInfo(this.settingsStore)
            .then((response: any) => {
                // handle success
                const nodeInfo = new NodeInfo(response.data);
                this.nodeInfo = nodeInfo;
                this.testnet = nodeInfo.isTestNet;
                this.loading = false;
                this.error = false;
            })
            .catch((error: any) => {
                // handle error
                const data = error.response && error.response.data;
                this.error = true;
                if (data && data.error) {
                    this.errorMsg = data.error;
                }
                this.loading = false;
                this.nodeInfo = {};
            });
    };
}
