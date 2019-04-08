import { action, observable, reaction } from 'mobx';
import axios from 'axios';
import Channel from './../models/Channel';
import OpenChannelRequest from './../models/OpenChannelRequest';
import CloseChannelRequest from './../models/CloseChannelRequest';
import SettingsStore from './SettingsStore';

export default class ChannelsStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public errorPeerConnect: boolean = false;
    @observable public errorMsgChannel: string | null;
    @observable public errorMsgPeer: string | null;
    @observable public channels: Array<Channel> = [];
    @observable public output_index: number | null;
    @observable public funding_txid_str: string | null;
    @observable public openingChannel: boolean = false;
    @observable public connectingToPeer: boolean = false;
    @observable public errorOpenChannel: boolean = false;
    @observable public peerSuccess: boolean = false;
    @observable public channelSuccess: boolean = false;
    @observable channelRequest: any;
    closeChannelSuccess: boolean;

    settingsStore: SettingsStore

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                this.getChannels()
            }
        );

        reaction(
            () => this.channelRequest,
            () => {
                if (this.channelRequest) {
                    this.openChannel(this.channelRequest);
                }
            }
        );

        reaction(
            () => this.channels,
            () => {
                if (this.channels) {
                    this.nodes = {};
                    const nodes: any = {};
                    this.channels.forEach((channel: Channel) => {
                        this.getNodeInfo(channel.remote_pubkey).then(nodeInfo => {
                            nodes[channel.remote_pubkey] = nodeInfo;
                            this.nodes = nodes;
                        });
                    });
                }
            }
        );
    }

    @action
    getNodeInfo = (pubkey: string) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.loading = true;
        return axios.request({
            method: 'get',
            url: `https://${host}${port ? ':' + port : ''}/v1/graph/node/${pubkey}`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            return data.node;
        });
    }

    @action
    public getChannels = () => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.loading = true;
        axios.request({
            method: 'get',
            url: `https://${host}${port ? ':' + port : ''}/v1/channels`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.channels = data.channels;
            this.error = false;
            this.loading = false;
        })
        .catch(() => {
            // handle error
            this.channels = [];
            this.error = true;
            this.loading = false;
        });
    }

    @action
    public closeChannel = (request: CloseChannelRequest) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        const { funding_txid_str, output_index } = request;

        this.loading = true;
        axios.request({
            method: 'delete',
            url: `https://${host}${port ? ':' + port : ''}/v1/channels/${funding_txid_str}/${output_index}`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            }
        }).then((response: any) => {
            // handle success
            const data = response.data;
            const { chan_close } = data;
            this.closeChannelSuccess = chan_close.success;
            this.error = false;
            this.loading = false;
        })
        .catch(() => {
            // handle error
            this.channels = [];
            this.error = true;
            this.loading = false;
        });
    }

    @action
    public connectPeer = (request: OpenChannelRequest) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        this.connectingToPeer = true;
        axios.request({
            method: 'post',
            url: `https://${host}${port ? ':' + port : ''}/v1/peers`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            },
            data: JSON.stringify({addr: {pubkey: request.node_pubkey_string, host: request.host}})
        }).then(() => {
            // handle success
            this.errorPeerConnect = false;
            this.connectingToPeer = false;
            this.errorMsgPeer = null;
            this.channelRequest = request;
            this.peerSuccess = true;
        })
        .catch((error: any) => {
            // handle error
            const errorInfo = error.response.data;
            this.errorMsgPeer = errorInfo.error;
            this.errorPeerConnect = true;
            this.connectingToPeer = false;
            this.peerSuccess = false;
            this.channelSuccess = false;

            if (this.errorMsgPeer && this.errorMsgPeer.includes('already connected to peer')) {
                this.channelRequest = request;
            }
        });
    }

    openChannel = (request: OpenChannelRequest) => {
        const { settings } = this.settingsStore;
        const { host, port, macaroonHex } = settings;

        delete request.host;

        this.peerSuccess = false;
        this.channelSuccess = false;

        this.openingChannel = true;
        axios.request({
            method: 'post',
            url: `https://${host}${port ? ':' + port : ''}/v1/channels`,
            headers: {
                'Grpc-Metadata-macaroon': macaroonHex
            },
            data: JSON.stringify(request)
        }).then((response: any) => {
            // handle success
            const data = response.data;
            this.output_index = data.output_index;
            this.funding_txid_str = data.funding_txid_str;
            this.errorOpenChannel = false;
            this.openingChannel = false;
            this.errorMsgChannel = null;
            this.channelRequest = null;
            this.channelSuccess = true;
        })
        .catch((error: any) => {
            // handle error
            const errorInfo = error.response.data;
            this.errorMsgChannel = errorInfo.error;
            this.output_index = null;
            this.funding_txid_str = null;
            this.errorOpenChannel = true;
            this.openingChannel = false;
            this.channelRequest = null;
            this.peerSuccess = false;
            this.channelSuccess = false;
        });
    }
}