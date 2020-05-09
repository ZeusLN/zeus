import { action, observable, reaction } from 'mobx';
import Channel from './../models/Channel';
import OpenChannelRequest from './../models/OpenChannelRequest';
import CloseChannelRequest from './../models/CloseChannelRequest';
import SettingsStore from './SettingsStore';
import RESTUtils from './../utils/RESTUtils';

export default class ChannelsStore {
    @observable public loading: boolean = false;
    @observable public error: boolean = false;
    @observable public errorPeerConnect: boolean = false;
    @observable public errorMsgChannel: string | null;
    @observable public errorMsgPeer: string | null;
    @observable public nodes: any = {};
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

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

        reaction(
            () => this.settingsStore.settings,
            () => {
                if (this.settingsStore.macaroonHex) {
                    this.getChannels();
                }
            }
        );

        reaction(
            () => this.channelRequest,
            () => {
                if (this.channelRequest) {
                    const chanReq = new OpenChannelRequest(this.channelRequest);
                    this.openChannel(chanReq);
                }
            }
        );

        reaction(
            () => this.channels,
            () => {
                if (
                    this.channels &&
                    this.settingsStore.implementation !== 'c-lightning-REST'
                ) {
                    this.channels.forEach((channel: Channel) => {
                        if (!this.nodes[channel.remote_pubkey]) {
                            this.getNodeInfo(channel.remote_pubkey).then(
                                nodeInfo => {
                                    this.nodes[
                                        channel.remote_pubkey
                                    ] = nodeInfo;
                                }
                            );
                        }
                    });
                }
            }
        );
    }

    @action
    getNodeInfo = (pubkey: string) => {
        this.loading = true;
        return RESTUtils.getNodeInfo(this.settingsStore, [pubkey]).then(
            (response: any) => {
                // handle success
                const data = response.data;
                return data.node;
            }
        );
    };

    @action
    public getChannels = () => {
        this.channels = [];
        this.loading = true;
        RESTUtils.getChannels(this.settingsStore)
            .then((response: any) => {
                const data = response.data;
                const channels = data.channels || data;
                this.channels = channels.map(
                    (channel: any) => new Channel(channel)
                );
                this.error = false;
                this.loading = false;
            })
            .catch(() => {
                // handle error
                this.channels = [];
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public closeChannel = (
        request?: CloseChannelRequest | null,
        channelId?: string | null,
        satPerByte?: string,
        forceClose?: boolean
    ) => {
        const { implementation } = this.settingsStore;
        this.loading = true;

        let urlParams: Array<string> = [];
        if (implementation === 'c-lightning-REST' && channelId) {
            urlParams = [channelId];
        } else if (request) {
            // lnd
            const { funding_txid_str, output_index } = request;

            urlParams = [funding_txid_str, output_index, forceClose];

            if (satPerByte) {
                urlParams = [
                    funding_txid_str,
                    output_index,
                    forceClose,
                    satPerByte
                ];
            }
        }

        RESTUtils.closeChannel(this.settingsStore, urlParams)
            .then((response: any) => {
                const data = response.data;
                const { chan_close } = data;
                this.closeChannelSuccess = chan_close.success;
                this.error = false;
                this.loading = false;
            })
            .catch(() => {
                this.channels = [];
                this.error = true;
                this.loading = false;
            });
    };

    @action
    public connectPeer = (request: OpenChannelRequest) => {
        const { implementation } = this.settingsStore;
        this.connectingToPeer = true;

        let data;
        if (implementation === 'c-lightning-REST') {
            data = {
                id: `${request.node_pubkey_string}@${request.host}`
            };
        } else {
            data = JSON.stringify({
                addr: {
                    pubkey: request.node_pubkey_string,
                    host: request.host
                }
            });
        }

        RESTUtils.connectPeer(this.settingsStore, data)
            .then(() => {
                // handle success
                this.errorPeerConnect = false;
                this.connectingToPeer = false;
                this.errorMsgPeer = null;
                this.channelRequest = request;
                this.peerSuccess = true;
            })
            .catch((error: any) => {
                // handle error
                const errorInfo = error.response && error.response.data;
                this.errorMsgPeer =
                    (errorInfo && errorInfo.error.message) ||
                    (errorInfo && errorInfo.error) ||
                    error.message;
                this.errorPeerConnect = true;
                this.connectingToPeer = false;
                this.peerSuccess = false;
                this.channelSuccess = false;

                if (
                    this.errorMsgPeer &&
                    this.errorMsgPeer.includes('already connected to peer')
                ) {
                    this.channelRequest = request;
                }
            });
    };

    openChannel = (request: OpenChannelRequest) => {
        const { implementation } = this.settingsStore;
        delete request.host;

        this.peerSuccess = false;
        this.channelSuccess = false;
        this.openingChannel = true;

        let openChannelReq;
        if (implementation === 'c-lightning-REST') {
            openChannelReq = request;
        } else {
            openChannelReq = JSON.stringify(request);
        }

        RESTUtils.openChannel(this.settingsStore, openChannelReq)
            .then((response: any) => {
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
                const errorInfo = error.response.data;
                this.errorMsgChannel =
                    errorInfo.error.message || errorInfo.error;
                this.output_index = null;
                this.funding_txid_str = null;
                this.errorOpenChannel = true;
                this.openingChannel = false;
                this.channelRequest = null;
                this.peerSuccess = false;
                this.channelSuccess = false;
            });
    };
}
