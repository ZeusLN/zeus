import { action, observable, reaction } from 'mobx';
import BigNumber from 'bignumber.js';

import Channel from './../models/Channel';
import ClosedChannel from './../models/ClosedChannel';
import ChannelInfo from './../models/ChannelInfo';

import OpenChannelRequest from './../models/OpenChannelRequest';
import CloseChannelRequest from './../models/CloseChannelRequest';

import SettingsStore from './SettingsStore';

import BackendUtils from './../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';

import _ from 'lodash';

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
    @observable public filterOptions: Array<string> = [];
    @observable public sort = {
        param: 'channelCapacity',
        dir: 'DESC',
        type: 'numeric'
    };
    @observable public showSearch: boolean = false;
    // aliasMap
    @observable public aliasMap: any = observable.map({});

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
        this.pendingChannels = [];
        this.closedChannels = [];
        this.enrichedChannels = [];
        this.enrichedPendingChannels = [];
        this.enrichedClosedChannels = [];
        this.filteredChannels = [];
        this.filteredPendingChannels = [];
        this.filteredClosedChannels = [];
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
    setFilterOptions = (options: string[]) => {
        this.filterOptions = options;
        this.filterChannels();
        this.filterPendingChannels();
        this.filterClosedChannels();
    };

    @action
    filter = (channels: Array<Channel>) => {
        const query = this.search;
        const filtered = channels
            ?.filter(
                (channel: Channel) =>
                    channel.alias
                        ?.toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()) ||
                    channel.remotePubkey
                        .toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()) ||
                    channel.channelId
                        ?.toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase())
            )
            .filter(
                (channel: Channel) =>
                    this.filterOptions?.length === 0 ||
                    this.filterOptions?.includes(
                        channel.private ? 'unannounced' : 'announced'
                    )
            );
        const sorted = filtered?.sort((a: any, b: any) => {
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
    getNodeInfo = (pubkey: string) => {
        this.loading = true;
        return BackendUtils.getNodeInfo([pubkey])
            .then((data: any) => {
                this.loading = false;
                if (data?.node?.alias)
                    this.aliasMap.set(pubkey, data.node.alias);
                return data.node;
            })
            .catch(() => {
                this.loading = false;
            });
    };

    @action
    enrichChannels = async (channels: Array<Channel>) => {
        if (channels.length === 0) return;

        const channelsWithMissingAliases = channels?.filter(
            (c) => c.channelId != null && this.aliasesById[c.channelId] == null
        );
        const channelsWithMissingNodeInfos = channels?.filter(
            (c) => this.nodes[c.remotePubkey] == null
        );
        const publicKeysOfToBeLoadedNodeInfos = _.chain(
            channelsWithMissingAliases.concat(channelsWithMissingNodeInfos)
        )
            .map((c) => c.remotePubkey)
            .uniq()
            .value();

        this.loading = true;
        await Promise.all(
            publicKeysOfToBeLoadedNodeInfos.map(
                async (remotePubKey: string) => {
                    if (
                        this.settingsStore.implementation !== 'c-lightning-REST'
                    ) {
                        const nodeInfo = await this.getNodeInfo(remotePubKey);
                        if (!nodeInfo) return;
                        this.nodes[remotePubKey] = nodeInfo;
                    }
                }
            )
        );

        for (const channel of channelsWithMissingAliases) {
            const nodeInfo = this.nodes[channel.remotePubkey];
            if (!nodeInfo) continue;
            this.aliasesById[channel.channelId!] = nodeInfo.alias;
        }

        for (const channel of channels) {
            if (channel.alias == null) {
                channel.alias = this.nodes[channel.remotePubkey]?.alias;
            }
            channel.displayName =
                channel.alias ||
                channel.remotePubkey ||
                channel.channelId ||
                localeString('models.Channel.unknownId');
        }

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

        const loadPromises = [
            BackendUtils.getChannels().then((data: any) => {
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
            })
        ];

        if (BackendUtils.supportsPendingChannels()) {
            loadPromises.push(
                BackendUtils.getPendingChannels().then((data: any) => {
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
                                return new Channel(pending.channel);
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
                })
            );

            loadPromises.push(
                BackendUtils.getClosedChannels().then((data: any) => {
                    const closedChannels = data.channels.map(
                        (channel: any) => new ClosedChannel(channel)
                    );
                    this.closedChannels = closedChannels;
                })
            );
        }

        Promise.all(loadPromises)
            .then(() => {
                this.loading = false;
                this.error = false;
                return;
            })
            .catch(() => this.getChannelsError());
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
        this.resetOpenChannel();
        this.channelRequest = undefined;
        this.connectingToPeer = true;

        if (!request.host) {
            return await new Promise((resolve) => {
                this.channelRequest = request;
                resolve(true);
            });
        }

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

    openChannel = (request: OpenChannelRequest) => {
        delete request.host;

        this.peerSuccess = false;
        this.channelSuccess = false;
        this.openingChannel = true;

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
    public loadChannelInfo = (chanId: string, deleteBeforeLoading = false) => {
        this.loading = true;

        if (deleteBeforeLoading) {
            if (this.chanInfo[chanId]) delete this.chanInfo[chanId];
        }

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
