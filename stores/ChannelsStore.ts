import { action, observable, reaction } from 'mobx';
import { randomBytes } from 'react-native-randombytes';
import BigNumber from 'bignumber.js';

import Channel from './../models/Channel';
import ClosedChannel from './../models/ClosedChannel';
import ChannelInfo from './../models/ChannelInfo';

import OpenChannelRequest from './../models/OpenChannelRequest';
import CloseChannelRequest from './../models/CloseChannelRequest';

import SettingsStore from './SettingsStore';

import Base64Utils from './../utils/Base64Utils';
import BackendUtils from './../utils/BackendUtils';

interface ChannelInfoIndex {
    [key: string]: ChannelInfo;
}

export enum ChannelsType {
    Open = 0,
    Pending = 1,
    Closed = 2
}

export default class ChannelsStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorPeerConnect = false;
    @observable public errorMsgChannel: string | null;
    @observable public errorMsgPeer: string | null;
    @observable public nodes: any = {};
    @observable public aliasesById: any = {};
    @observable public channels: Array<Channel> = [];
    @observable public pendingChannels: Array<Channel> = [];
    @observable public closedChannels: Array<Channel> = [];
    @observable public output_index: number | null;
    @observable public funding_txid_str: string | null;
    @observable public openingChannel = false;
    @observable public connectingToPeer = false;
    @observable public errorOpenChannel = false;
    @observable public peerSuccess = false;
    @observable public channelSuccess = false;
    @observable channelRequest: any;
    closeChannelSuccess: boolean;
    // redesign
    @observable public largestChannelSats = 0;
    @observable public totalOutbound = 0;
    @observable public totalInbound = 0;
    @observable public totalOffline = 0;
    @observable public chanInfo: ChannelInfoIndex = {};
    @observable public channelsType = ChannelsType.Open;
    // enriched
    @observable public enrichedChannels: Array<Channel> = [];
    @observable public enrichedPendingChannels: Array<Channel> = [];
    @observable public enrichedClosedChannels: Array<Channel> = [];
    // search and sort
    @observable public search: string = '';
    @observable public filteredChannels: Array<Channel> = [];
    @observable public filteredPendingChannels: Array<Channel> = [];
    @observable public filteredClosedChannels: Array<Channel> = [];
    @observable public sort = {
        param: 'channelCapacity',
        dir: 'DESC',
        type: 'numeric'
    };
    @observable public showSearch: boolean = false;

    settingsStore: SettingsStore;

    constructor(settingsStore: SettingsStore) {
        this.settingsStore = settingsStore;

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
            async () => {
                if (this.channels) {
                    this.enrichedChannels = await this.enrichChannels(
                        this.channels
                    );
                    this.filterChannels();
                }
            }
        );

        reaction(
            () => this.pendingChannels,
            async () => {
                if (this.pendingChannels) {
                    this.enrichedPendingChannels = await this.enrichChannels(
                        this.pendingChannels
                    );
                    this.filterPendingChannels();
                }
            }
        );

        reaction(
            () => this.closedChannels,
            async () => {
                if (this.closedChannels) {
                    this.enrichedClosedChannels = await this.enrichChannels(
                        this.closedChannels
                    );
                    this.filterClosedChannels();
                }
            }
        );
    }

    @action
    resetOpenChannel = () => {
        this.loading = false;
        this.error = false;
        this.errorPeerConnect = false;
        this.errorMsgChannel = null;
        this.errorMsgPeer = null;
        this.output_index = null;
        this.funding_txid_str = null;
        this.openingChannel = false;
        this.connectingToPeer = false;
        this.errorOpenChannel = false;
        this.peerSuccess = false;
        this.channelSuccess = false;
        this.channelRequest = null;
    };

    @action
    reset = () => {
        this.resetOpenChannel();
        this.nodes = {};
        this.channels = [];
        this.largestChannelSats = 0;
        this.totalOutbound = 0;
        this.totalInbound = 0;
        this.totalOffline = 0;
        this.channelsType = ChannelsType.Open;
    };

    @action
    setSearch = (query: string) => {
        this.search = query;
        this.filterChannels();
        this.filterPendingChannels();
        this.filterClosedChannels();
    };

    @action
    setSort = (value: any) => {
        this.sort = value;
        this.filterChannels();
        this.filterPendingChannels();
        this.filterClosedChannels();
    };

    @action
    filter = (channels: Array<Channel>) => {
        const query = this.search;
        const filtered = channels.filter(
            (channel: Channel) =>
                channel.alias
                    ?.toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()) ||
                channel.remotePubkey
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()) ||
                channel.channelId
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase())
        );

        const sorted = filtered.sort((a: any, b: any) => {
            if (this.sort.type === 'numeric') {
                return Number(a[this.sort.param]) < Number(b[this.sort.param])
                    ? 1
                    : -1;
            } else {
                return a[this.sort.param].toLowerCase() <
                    b[this.sort.param].toLowerCase()
                    ? 1
                    : -1;
            }
        });

        return this.sort.dir === 'DESC' ? sorted : sorted.reverse();
    };

    @action
    filterChannels = () => {
        this.filteredChannels = this.filter(this.enrichedChannels);
    };

    @action
    filterPendingChannels = () => {
        this.filteredPendingChannels = this.filter(
            this.enrichedPendingChannels
        );
    };

    @action
    filterClosedChannels = () => {
        this.filteredClosedChannels = this.filter(this.enrichedClosedChannels);
    };

    @action
    getNodeInfo = (pubkey: string) =>
        BackendUtils.getNodeInfo([pubkey]).then((data: any) => {
            return data.node;
        });

    @action
    enrichChannels = async (channels: Array<Channel>) => {
        this.loading = true;
        await Promise.all(
            channels.map(async (channel: Channel) => {
                if (!channel.remotePubkey) return;
                if (
                    this.settingsStore.implementation !== 'c-lightning-REST' &&
                    !this.nodes[channel.remotePubkey]
                ) {
                    await this.getNodeInfo(channel.remotePubkey)
                        .then((nodeInfo: any) => {
                            if (!nodeInfo) return;
                            this.nodes[channel.remotePubkey] = nodeInfo;
                            this.aliasesById[channel.channelId] =
                                nodeInfo.alias;
                        })
                        .catch(() => {
                            // console.log(
                            //     `Couldn't find node alias for ${channel.remotePubkey}`,
                            //     err
                            // );
                        });
                }
                if (!channel.alias && this.aliasesById[channel.channelId]) {
                    channel.alias = this.aliasesById[channel.channelId];
                }
                channel.displayName =
                    channel.alias || channel.remotePubkey || channel.channelId;
            })
        );
        this.loading = false;
        return channels;
    };

    getChannelsError = () => {
        this.channels = [];
        this.error = true;
        this.loading = false;
    };

    @action
    public getChannels = () => {
        this.loading = true;
        this.channels = [];
        this.largestChannelSats = 0;
        this.totalOutbound = 0;
        this.totalInbound = 0;
        this.totalOffline = 0;
        BackendUtils.getChannels()
            .then((data: any) => {
                const channels = data.channels.map(
                    (channel: any) => new Channel(channel)
                );
                channels.forEach((channel: Channel) => {
                    const channelRemoteBalance = new BigNumber(
                        channel.remoteBalance
                    );
                    const channelLocalBalance = new BigNumber(
                        channel.localBalance
                    );
                    const channelTotal =
                        channelRemoteBalance.plus(channelLocalBalance);
                    if (channelTotal.gt(this.largestChannelSats))
                        this.largestChannelSats = channelTotal.toNumber();
                    if (!channel.isActive) {
                        this.totalOffline = new BigNumber(this.totalOffline)
                            .plus(channelTotal)
                            .toNumber();
                    } else {
                        this.totalInbound = new BigNumber(this.totalInbound)
                            .plus(channelRemoteBalance)
                            .toNumber();
                        this.totalOutbound = new BigNumber(this.totalOutbound)
                            .plus(channelLocalBalance)
                            .toNumber();
                    }
                });
                this.channels = channels;
                this.error = false;
            })
            .catch(() => {
                this.getChannelsError();
            });

        if (BackendUtils.supportsPendingChannels()) {
            BackendUtils.getPendingChannels()
                .then((data: any) => {
                    const pendingOpenChannels = data.pending_open_channels.map(
                        (pending: any) => {
                            pending.channel.pendingOpen = true;
                            return new Channel(pending.channel);
                        }
                    );
                    const pendingCloseChannels =
                        data.pending_closing_channels.map((pending: any) => {
                            pending.channel.pendingClose = true;
                            pending.channel.closing_txid = pending.closing_txid;
                            return new Channel(pending.channel);
                        });
                    const forceCloseChannels =
                        data.pending_force_closing_channels.map(
                            (pending: any) => {
                                pending.channel.blocks_til_maturity =
                                    pending.blocks_til_maturity;
                                pending.channel.forceClose = true;
                                pending.channel.closing_txid =
                                    pending.closing_txid;
                                const a = new Channel(pending.channel);
                                console.log('a', a);
                                return a;
                            }
                        );
                    const waitCloseChannels = data.waiting_close_channels.map(
                        (pending: any) => {
                            pending.channel.closing = true;
                            return new Channel(pending.channel);
                        }
                    );
                    this.pendingChannels = pendingOpenChannels
                        .concat(pendingCloseChannels)
                        .concat(forceCloseChannels)
                        .concat(waitCloseChannels);
                    this.error = false;
                })
                .catch(() => {
                    this.getChannelsError();
                });

            BackendUtils.getClosedChannels()
                .then((data: any) => {
                    const closedChannels = data.channels.map(
                        (channel: any) => new ClosedChannel(channel)
                    );
                    this.closedChannels = closedChannels;
                    this.error = false;
                    this.loading = false;
                })
                .catch(() => {
                    this.getChannelsError();
                });
        }
    };

    @action
    public closeChannel = (
        request?: CloseChannelRequest | null,
        channelId?: string | null,
        satPerByte?: string | null,
        forceClose?: boolean | string | null
    ) => {
        this.loading = true;

        let urlParams: Array<any> = [];
        if (channelId) {
            // c-lightning, eclair
            urlParams = [channelId, forceClose];
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

        BackendUtils.closeChannel(urlParams)
            .then((data: any) => {
                const { chan_close } = data;
                this.closeChannelSuccess = chan_close.success;
                this.error = false;
                this.loading = false;
            })
            .catch(() => {
                this.getChannelsError();
            });
    };

    @action
    public connectPeer = async (
        request: OpenChannelRequest,
        perm?: boolean,
        connectPeerOnly?: boolean
    ) => {
        this.channelRequest = undefined;
        this.connectingToPeer = true;

        return await new Promise((resolve, reject) => {
            BackendUtils.connectPeer({
                addr: {
                    pubkey: request.node_pubkey_string,
                    host: request.host
                },
                perm
            })
                .then(() => {
                    this.errorPeerConnect = false;
                    this.connectingToPeer = false;
                    this.errorMsgPeer = null;
                    if (!connectPeerOnly) this.channelRequest = request;
                    this.peerSuccess = true;
                    resolve(true);
                })
                .catch((error: any) => {
                    this.connectingToPeer = false;
                    this.peerSuccess = false;
                    this.channelSuccess = false;
                    // handle error
                    if (
                        error.toString() &&
                        error.toString().includes('already')
                    ) {
                        if (!connectPeerOnly) {
                            this.channelRequest = request;
                        } else {
                            this.errorMsgPeer = error.toString();
                            this.errorPeerConnect = true;
                        }
                        resolve(true);
                    } else {
                        this.errorMsgPeer = error.toString();
                        this.errorPeerConnect = true;
                        reject(this.errorMsgPeer);
                    }
                });
        });
    };

    openChannelLNDCoinControl = (request: OpenChannelRequest) => {
        const { utxos } = request;
        const inputs: any = [];
        const outputs: any = {};
        const sat_per_vbyte = request.sat_per_vbyte;

        if (utxos) {
            utxos.forEach((input) => {
                const [txid_str, output_index] = input.split(':');
                inputs.push({ txid_str, output_index: Number(output_index) });
            });
        }

        delete request.utxos;

        const node_pubkey = Base64Utils.hexToBase64(request.node_pubkey_string);

        delete request.node_pubkey_string;
        delete request.sat_per_vbyte;

        const pending_chan_id = randomBytes(32).toString('base64');

        const openChanRequest = {
            funding_shim: {
                psbt_shim: {
                    no_publish: true,
                    pending_chan_id
                }
            },
            node_pubkey,
            ...request
        };

        BackendUtils.openChannelStream(openChanRequest)
            .then((data: any) => {
                const psbt_fund = data.psbt_fund;
                const { funding_address, funding_amount } = psbt_fund;

                if (funding_address) {
                    outputs[funding_address] = Number(funding_amount);
                }

                const fundPsbtRequest = {
                    raw: {
                        inputs,
                        outputs
                    },
                    sat_per_vbyte: Number(sat_per_vbyte),
                    spend_unconfirmed:
                        openChanRequest.min_confs &&
                        openChanRequest.min_confs === 0
                };

                BackendUtils.fundPsbt(fundPsbtRequest)
                    .then((data: any) => {
                        const funded_psbt = data.funded_psbt;

                        const openChanRequest = {
                            funding_shim: {
                                psbt_shim: {
                                    base_psbt: funded_psbt
                                }
                            },
                            ...request
                        };

                        BackendUtils.openChannel(openChanRequest)
                            .then(() => {
                                // TODO
                            })
                            .catch((error: any) => {
                                this.errorMsgChannel = error.toString();
                                this.output_index = null;
                                this.funding_txid_str = null;
                                this.errorOpenChannel = true;
                                this.openingChannel = false;
                                this.channelRequest = null;
                                this.peerSuccess = false;
                                this.channelSuccess = false;
                            });
                    })
                    .catch((error: any) => {
                        this.errorMsgChannel = error.toString();
                        this.output_index = null;
                        this.funding_txid_str = null;
                        this.errorOpenChannel = true;
                        this.openingChannel = false;
                        this.channelRequest = null;
                        this.peerSuccess = false;
                        this.channelSuccess = false;
                    });
            })
            .catch((error: any) => {
                this.errorMsgChannel = error.toString();
                this.output_index = null;
                this.funding_txid_str = null;
                this.errorOpenChannel = true;
                this.openingChannel = false;
                this.channelRequest = null;
                this.peerSuccess = false;
                this.channelSuccess = false;
            });
    };

    openChannel = (request: OpenChannelRequest) => {
        delete request.host;

        this.peerSuccess = false;
        this.channelSuccess = false;
        this.openingChannel = true;

        if (
            BackendUtils.isLNDBased() &&
            request.utxos &&
            request.utxos.length > 0
        ) {
            return this.openChannelLNDCoinControl(request);
        }

        BackendUtils.openChannel(request)
            .then((data: any) => {
                this.output_index = data.output_index;
                this.funding_txid_str = data.funding_txid_str;
                this.errorOpenChannel = false;
                this.openingChannel = false;
                this.errorMsgChannel = null;
                this.channelRequest = null;
                this.channelSuccess = true;
            })
            .catch((error: any) => {
                this.errorMsgChannel = error.toString();
                this.output_index = null;
                this.funding_txid_str = null;
                this.errorOpenChannel = true;
                this.openingChannel = false;
                this.channelRequest = null;
                this.peerSuccess = false;
                this.channelSuccess = false;
            });
    };

    @action
    public getChannelInfo = (chanId: string) => {
        this.loading = true;
        if (this.chanInfo[chanId]) delete this.chanInfo[chanId];
        BackendUtils.getChannelInfo(chanId)
            .then((data: any) => {
                this.chanInfo[chanId] = new ChannelInfo(data);
                this.loading = false;
            })
            .catch((error: any) => {
                // handle error
                this.errorMsgPeer = error.toString();
                if (this.chanInfo[chanId]) delete this.chanInfo[chanId];
                this.loading = false;
            });
    };

    @action
    public setChannelsType = (type: ChannelsType) => {
        this.channelsType = type;
    };

    @action
    public toggleSearch = () => {
        this.showSearch = !this.showSearch;
    };
}
