import { action, observable, reaction } from 'mobx';
import NodeInfo from './../models/NodeInfo';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class NodeInfoStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
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
                if (this.settingsStore.macaroonHex) {
                    this.getNodeInfo();
                }
            }
        );
    }

    getNodeInfoError = () => {
        this.error = true;
        this.loading = false;
        this.nodeInfo = {};
    };

    @action
    public getNodeInfo = () => {
        this.errorMsg = '';
        this.loading = true;
        RESTUtils.getMyNodeInfo(this.settingsStore)
            .then((response: any) => {
                const status = response.info().status;
                if (status == 200) {
                    // handle success
                    const nodeInfo = new NodeInfo(response.json());
                    this.nodeInfo = nodeInfo;
                    this.testnet = nodeInfo.isTestNet;
                    this.regtest = nodeInfo.isRegTest;
                    this.loading = false;
                    this.error = false;
                } else {
                    const data = response.json().data;
                    if (data && data.error) {
                        this.errorMsg = data.error;
                    }
                    this.getNodeInfoError();
                }
            })
            .catch((error: any) => {
                // handle error
                this.errorMsg = error.toString();
                this.getNodeInfoError();
            });
    };
}
