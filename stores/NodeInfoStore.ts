import { action, observable, reaction } from 'mobx';
import axios from 'axios';
import NodeInfo from './../models/NodeInfo';
import SettingsStore from './SettingsStore';

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
        const { host, port, macaroonHex } = this.settingsStore;

        this.errorMsg = '';
        this.loading = true;
        axios
            .request({
                method: 'get',
                url: `https://${host}${port ? ':' + port : ''}/v1/getinfo`,
                headers: {
                    'Grpc-Metadata-macaroon': macaroonHex
                }
            })
            .then((response: any) => {
                // handle success
                const data = response.data;
                this.nodeInfo = data;
                this.testnet = data.testnet;
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
