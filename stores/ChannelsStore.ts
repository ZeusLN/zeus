import { action, observable, reaction } from 'mobx';
import BigNumber from 'bignumber.js';
import _ from 'lodash';
import { randomBytes } from 'react-native-randombytes';

import Channel from '../models/Channel';
import ClosedChannel from '../models/ClosedChannel';
import ChannelInfo from '../models/ChannelInfo';
import FundedPsbt from '../models/FundedPsbt';

import OpenChannelRequest from '../models/OpenChannelRequest';
import CloseChannelRequest from '../models/CloseChannelRequest';

import SettingsStore from './SettingsStore';

import BackendUtils from '../utils/BackendUtils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

interface ChannelInfoIndex {
    [key: string]: ChannelInfo;
}

interface PendingHTLC {
    incoming: boolean;
    amount: number;
    hash_lock: string;
    expiration_height: number;
    htlc_index: number;
    forwarding_channel: number;
    forwarding_htlc_index: number;
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
    @observable public closeChannelErr: string | null;
    @observable public closingChannel = false;
    @observable channelRequest: any;
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
    // external account funding
    @observable public funded_psbt: string = '';
    @observable public pending_chan_ids: Array<string>;
    // pending HTLCs
    @observable public pendingHTLCs: Array<PendingHTLC>;

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
                        this.channels,
                        true
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
    resetOpenChannel = (silent?: boolean) => {
        this.loading = false;
        this.error = false;
        if (!silent) {
            this.errorMsgPeer = null;
            this.errorPeerConnect = false;
            this.connectingToPeer = false;
            this.peerSuccess = false;
        }
        this.errorMsgChannel = null;
        this.output_index = null;
        this.funding_txid_str = null;
        this.openingChannel = false;
        this.errorOpenChannel = false;
        this.channelSuccess = false;
        this.channelRequest = null;
        this.funded_psbt = '';
        this.pending_chan_ids = [];
    };

    @action
    clearCloseChannelErr = () => {
        this.closeChannelErr = null;
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
        this.pendingHTLCs = [];
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
                        ?.toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()) ||
                    channel.channelId
                        ?.toString()
                        ?.toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase())
            )
            ?.filter(
                (channel: Channel) =>
                    (!this.filterOptions?.includes('unannounced') &&
                        !this.filterOptions?.includes('announced')) ||
                    this.filterOptions?.includes(
                        channel.private ? 'unannounced' : 'announced'
                    )
            )
            .filter(
                (channel: Channel) =>
                    (!this.filterOptions?.includes('online') &&
                        !this.filterOptions?.includes('offline')) ||
                    this.filterOptions?.includes(
                        channel.active ? 'online' : 'offline'
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

        return this.sort.dir === 'DESC' ? sorted : sorted?.reverse();
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
    setLoading = (state: boolean) => {
        this.loading = state;
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
    enrichChannels = async (
        channels: Array<Channel>,
        setPendingHtlcs?: boolean
    ) => {
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
                        this.settingsStore.implementation !==
                            'c-lightning-REST' &&
                        this.settingsStore.implementation !== 'cln-rest'
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

        if (setPendingHtlcs) this.pendingHTLCs = [];

        for (const channel of channels) {
            if (channel.alias == null) {
                channel.alias = this.nodes[channel.remotePubkey]?.alias;
            }
            channel.displayName =
                channel.alias ||
                channel.remotePubkey ||
                channel.channelId ||
                localeString('models.Channel.unknownId');

            if (BackendUtils.isLNDBased() && setPendingHtlcs) {
                channel.pending_htlcs?.forEach((htlc: any) => {
                    htlc.channelDisplayName = channel.displayName;
                });

                this.pendingHTLCs.push(...channel.pending_htlcs);
            }
        }

        console.log('Pending HTLCs', this.pendingHTLCs);

        this.loading = false;
        return channels;
    };

    getChannelsError = () => {
        this.channels = [];
        this.error = true;
        this.loading = false;
        this.closingChannel = false;
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

        return Promise.all(loadPromises)
            .then(() => {
                this.loading = false;
                this.error = false;
                return;
            })
            .catch(() => this.getChannelsError());
    };

    @action
    public closeChannel = async (
        channelPoint?: CloseChannelRequest | null,
        channelId?: string | null,
        satPerVbyte?: string | null,
        forceClose?: boolean | string | null,
        deliveryAddress?: string | null
    ) => {
        this.closeChannelErr = null;
        this.closingChannel = true;

        let urlParams: Array<any> = [];
        const implementation = this.settingsStore.implementation;

        if (
            implementation === 'c-lightning-REST' ||
            implementation === 'cln-rest' ||
            implementation === 'eclair' ||
            implementation === 'spark'
        ) {
            // c-lightning, eclair
            urlParams = [channelId, forceClose];
        } else {
            // lnd
            const { funding_txid_str, output_index } = channelPoint;

            urlParams = [
                funding_txid_str,
                output_index,
                forceClose,
                satPerVbyte,
                deliveryAddress
            ];
        }

        if (implementation === 'lightning-node-connect') {
            return BackendUtils.closeChannel(urlParams);
        } else {
            let resolved = false;
            return await Promise.race([
                new Promise((resolve) => {
                    BackendUtils.closeChannel(urlParams)
                        .then(() => {
                            this.handleChannelClose();
                            resolved = true;
                            resolve(true);
                        })
                        .catch((error: Error) => {
                            this.handleChannelCloseError(error);
                            resolved = true;
                            resolve(true);
                        });
                }),
                // LND REST call tends to time out, so let's put a 6 second
                // forced resolution, as true errors will typically throw
                // before that time
                new Promise(async (resolve) => {
                    await new Promise((res) => setTimeout(res, 6000));
                    if (!resolved) this.handleChannelClose();
                    resolve(true);
                })
            ]);
        }
    };

    @action
    public handleChannelClose = () => {
        this.closeChannelErr = null;
        this.error = false;
        this.closingChannel = false;
    };

    @action
    public handleChannelCloseError = (error: Error) => {
        this.closeChannelErr = errorToUserFriendly(error);
        this.getChannelsError();
    };

    @action
    public connectPeer = async (
        request: OpenChannelRequest,
        perm?: boolean,
        connectPeerOnly?: boolean,
        silent?: boolean
    ) => {
        this.resetOpenChannel(silent);
        this.channelRequest = undefined;
        if (!silent) this.connectingToPeer = true;

        if (!request.host) {
            return await new Promise((resolve) => {
                this.channelRequest = request;
                resolve(true);
            });
        }

        // connect to additional channel peers
        if (request.additionalChannels) {
            for (let i = 0; i < request.additionalChannels?.length; i++) {
                const channel = request.additionalChannels[i];
                await BackendUtils.connectPeer({
                    addr: {
                        pubkey: channel.node_pubkey_string,
                        host: channel.host
                    },
                    perm
                }).catch(() => {});
            }
        }

        return await new Promise((resolve, reject) => {
            BackendUtils.connectPeer({
                addr: {
                    pubkey: request.node_pubkey_string,
                    host: request.host
                },
                perm
            })
                .then(async () => {
                    if (!silent) {
                        this.errorPeerConnect = false;
                        this.connectingToPeer = false;
                        this.errorMsgPeer = null;
                        this.peerSuccess = true;
                    }
                    if (!connectPeerOnly) this.channelRequest = request;
                    resolve(true);
                })
                .catch((error: Error) => {
                    if (!silent) {
                        this.connectingToPeer = false;
                        this.peerSuccess = false;
                    }
                    this.channelSuccess = false;
                    // handle error
                    if (
                        error &&
                        error.toString() &&
                        error.toString().includes('already')
                    ) {
                        if (!connectPeerOnly) {
                            this.channelRequest = request;
                        } else {
                            if (!silent) {
                                this.errorMsgPeer = errorToUserFriendly(error);
                                this.errorPeerConnect = true;
                            }
                        }
                        resolve(true);
                    } else {
                        if (!silent) {
                            this.errorMsgPeer = errorToUserFriendly(error);
                            this.errorPeerConnect = true;
                        }
                        reject(this.errorMsgPeer);
                    }
                });
        });
    };

    handleChannelOpen = (request: any, outputs?: any) => {
        const { account, sat_per_vbyte, utxos } = request;

        const inputs: any = [];

        if (utxos) {
            utxos.forEach((input: any) => {
                const [txid_str, output_index] = input.split(':');
                inputs.push({
                    txid_str,
                    output_index: Number(output_index)
                });
            });
        }

        const fundPsbtRequest = {
            raw: {
                outputs,
                inputs
            },
            sat_per_vbyte: Number(sat_per_vbyte),
            spend_unconfirmed: true,
            account
        };

        BackendUtils.fundPsbt(fundPsbtRequest)
            .then(async (data: any) => {
                let funded_psbt: string = new FundedPsbt(
                    data.funded_psbt
                ).getFormatted();

                await BackendUtils.signPsbt({ funded_psbt })
                    .then((data: any) => {
                        if (data.signed_psbt) funded_psbt = data.signed_psbt;
                        return;
                    })
                    .catch((e: any) => {
                        console.log('signPsbt err', e);
                        return;
                    });

                for (let i = 0; i < this.pending_chan_ids.length - 1; i++) {
                    const pending_chan_id = this.pending_chan_ids[i];
                    await BackendUtils.fundingStateStep({
                        psbt_verify: {
                            funded_psbt,
                            pending_chan_id,
                            skip_finalize: true
                        }
                    })
                        .then((data: any) => {
                            console.log(`fundingStateStep - data ${i}`, data);
                            return;
                        })
                        .catch((e: any) => {
                            console.log(`fundingStateStep - err ${i}`, e);
                            return;
                        });
                }

                BackendUtils.fundingStateStep({
                    psbt_verify: {
                        funded_psbt,
                        pending_chan_id:
                            this.pending_chan_ids[
                                this.pending_chan_ids.length - 1
                            ]
                    }
                })
                    .then((data: any) => {
                        if (data.publish_error) {
                            this.errorMsgChannel = errorToUserFriendly(
                                data.publish_error
                            );
                            this.output_index = null;
                            this.funding_txid_str = null;
                            this.errorOpenChannel = true;
                            this.openingChannel = false;
                            this.channelRequest = null;
                            this.peerSuccess = false;
                            this.channelSuccess = false;
                        } else {
                            const formattedPsbt = new FundedPsbt(
                                funded_psbt
                            ).getFormatted();

                            // Attempt finalize here
                            BackendUtils.fundingStateStep({
                                psbt_finalize: {
                                    signed_psbt: formattedPsbt,
                                    pending_chan_id:
                                        this.pending_chan_ids[
                                            this.pending_chan_ids.length - 1
                                        ]
                                }
                            })
                                .then((data: any) => {
                                    if (data.publish_error) {
                                        this.funded_psbt = formattedPsbt;
                                        this.output_index = null;
                                        this.funding_txid_str = null;
                                        this.errorOpenChannel = true;
                                        this.openingChannel = false;
                                        this.channelRequest = null;
                                        this.peerSuccess = false;
                                        this.channelSuccess = false;
                                    } else {
                                        // success case
                                        this.errorOpenChannel = false;
                                        this.openingChannel = false;
                                        this.errorMsgChannel = null;
                                        this.channelRequest = null;
                                        this.channelSuccess = true;
                                    }
                                })
                                .catch(() => {
                                    // handle error
                                    this.funded_psbt = formattedPsbt;
                                    this.output_index = null;
                                    this.funding_txid_str = null;
                                    this.errorOpenChannel = true;
                                    this.openingChannel = false;
                                    this.channelRequest = null;
                                    this.peerSuccess = false;
                                    this.channelSuccess = false;
                                });
                        }
                    })
                    .catch((error: any) => {
                        // handle error
                        this.errorMsgChannel = errorToUserFriendly(error);
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
                // handle error
                this.errorMsgChannel = errorToUserFriendly(error);
                this.output_index = null;
                this.funding_txid_str = null;
                this.errorOpenChannel = true;
                this.openingChannel = false;
                this.channelRequest = null;
                this.peerSuccess = false;
                this.channelSuccess = false;
            });
    };

    handleChannelOpenError = (error: Error) => {
        this.errorMsgChannel = errorToUserFriendly(error);
        this.output_index = null;
        this.funding_txid_str = null;
        this.errorOpenChannel = true;
        this.openingChannel = false;
        this.channelRequest = null;
        this.peerSuccess = false;
        this.channelSuccess = false;
    };

    openChannel = (request: OpenChannelRequest) => {
        const multipleChans =
            request?.additionalChannels &&
            request.additionalChannels?.length > 0;

        delete request.host;
        if (!multipleChans) delete request.additionalChannels;

        this.peerSuccess = false;
        this.channelSuccess = false;
        this.openingChannel = true;

        if (request?.account !== 'default' || multipleChans) {
            const outputs: any = {};
            if (multipleChans) {
                let base_psbt = '';
                request.funding_shim = {
                    psbt_shim: {
                        base_psbt,
                        pending_chan_id: randomBytes(32).toString('base64'),
                        no_publish: true
                    }
                };

                BackendUtils.openChannelStream(request)
                    .then((data: any) => {
                        const { psbt_fund, pending_chan_id } = data.result;
                        this.pending_chan_ids.push(pending_chan_id);
                        outputs[psbt_fund.funding_address] =
                            psbt_fund.funding_amount;

                        base_psbt = psbt_fund.psbt;
                        for (
                            let i = 0;
                            i < (request?.additionalChannels?.length || 0);
                            i++
                        ) {
                            if (
                                request.additionalChannels &&
                                request.additionalChannels.length !== i + 1
                            ) {
                                request.funding_shim = {
                                    psbt_shim: {
                                        base_psbt,
                                        pending_chan_id:
                                            randomBytes(32).toString('base64'),
                                        no_publish: true
                                    }
                                };
                                request.node_pubkey_string =
                                    request.additionalChannels[
                                        i
                                    ].node_pubkey_string;
                                request.local_funding_amount =
                                    request.additionalChannels[
                                        i
                                    ].satAmount.toString();

                                BackendUtils.openChannelStream(request)
                                    .then((data: any) => {
                                        const { psbt_fund, pending_chan_id } =
                                            data.result;
                                        this.pending_chan_ids.push(
                                            pending_chan_id
                                        );
                                        outputs[psbt_fund.funding_address] =
                                            psbt_fund.funding_amount;
                                        base_psbt = psbt_fund.psbt;
                                    })
                                    .catch((error: Error) => {
                                        this.handleChannelOpenError(error);
                                    });
                            } else if (request.additionalChannels) {
                                // final chan
                                request.funding_shim = {
                                    psbt_shim: {
                                        base_psbt,
                                        pending_chan_id:
                                            randomBytes(32).toString('base64'),
                                        no_publish: false
                                    }
                                };
                                request.node_pubkey_string =
                                    request.additionalChannels[
                                        i
                                    ].node_pubkey_string;
                                request.local_funding_amount =
                                    request.additionalChannels[
                                        i
                                    ].satAmount.toString();

                                BackendUtils.openChannelStream(request)
                                    .then((data: any) => {
                                        const { psbt_fund, pending_chan_id } =
                                            data.result;
                                        this.pending_chan_ids.push(
                                            pending_chan_id
                                        );
                                        outputs[psbt_fund.funding_address] =
                                            psbt_fund.funding_amount;
                                        this.handleChannelOpen(
                                            request,
                                            outputs
                                        );
                                    })
                                    .catch((error: Error) => {
                                        this.handleChannelOpenError(error);
                                    });
                            }
                        }
                    })
                    .catch((error: Error) => {
                        this.handleChannelOpenError(error);
                    });
            } else {
                request.funding_shim = {
                    psbt_shim: {
                        base_psbt: '',
                        pending_chan_id: randomBytes(32).toString('base64')
                    }
                };
                BackendUtils.openChannelStream(request)
                    .then((data: any) => {
                        const { pending_chan_id } = data.result;
                        this.pending_chan_ids.push(pending_chan_id);
                        this.handleChannelOpen(request);
                    })
                    .catch((error: Error) => {
                        this.handleChannelOpenError(error);
                    });
            }
        } else {
            BackendUtils.openChannelSync(request)
                .then((data: any) => {
                    this.output_index = data.output_index;
                    this.funding_txid_str = data.funding_txid_str;
                    this.errorOpenChannel = false;
                    this.openingChannel = false;
                    this.errorMsgChannel = null;
                    this.channelRequest = null;
                    this.channelSuccess = true;
                })
                .catch((error: Error) => {
                    this.errorMsgChannel = errorToUserFriendly(error);
                    this.output_index = null;
                    this.funding_txid_str = null;
                    this.errorOpenChannel = true;
                    this.openingChannel = false;
                    this.channelRequest = null;
                    this.peerSuccess = false;
                    this.channelSuccess = false;
                });
        }
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
