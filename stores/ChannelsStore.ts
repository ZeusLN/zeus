import { action, observable, reaction, runInAction } from 'mobx';
import BigNumber from 'bignumber.js';
// leave as is, do not do tree-shaking
import { chain } from 'lodash';
import { randomBytes } from 'react-native-randombytes';

import Channel from '../models/Channel';
import ClosedChannel from '../models/ClosedChannel';
import ChannelInfo, { RoutingPolicy } from '../models/ChannelInfo';
import FundedPsbt from '../models/FundedPsbt';
import Peer from '../models/Peer';

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
    amount: number | string;
    hash_lock: string;
    expiration_height: number;
    htlc_index?: number;
    forwarding_channel?: number;
    forwarding_htlc_index?: number;
}

export enum ChannelsType {
    Open = 0,
    Pending = 1,
    Closed = 2
}

export enum ChannelsView {
    Channels = 'channels',
    Peers = 'peers'
}

interface aliases {
    [index: string]: string;
}

const fixedAliases: aliases = {
    '031b301307574bbe9b9ac7b79cbe1700e31e544513eae0b5d7497483083f99e581':
        'Olympus by ZEUS'
};
ChannelsView;

export default class ChannelsStore {
    @observable public loading = false;
    @observable public error = false;
    @observable public errorPeerConnect = false;
    @observable public errorMsgChannel: string | null;
    @observable public errorMsgPeer: string | null;
    @observable public errorListPeers: string | null;
    @observable public errorDisconnectPeer: string | null;
    @observable public nodes: any = {};
    @observable public aliasesByChannelId: aliases = {};
    @observable public aliasesByPubkey: aliases = { ...fixedAliases };
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
    @observable public peers: Array<Peer> = [];
    // redesign
    @observable public largestChannelSats = 0;
    @observable public totalOutbound = 0;
    @observable public totalInbound = 0;
    @observable public totalOffline = 0;
    @observable public chanInfo: ChannelInfoIndex = {};
    @observable public channelsType = ChannelsType.Open;
    @observable public channelsView: ChannelsView = ChannelsView.Channels;
    // enriched
    @observable public enrichedChannels: Array<Channel> = [];
    @observable public enrichedPendingChannels: Array<Channel> = [];
    @observable public enrichedClosedChannels: Array<Channel> = [];
    // search and sort
    @observable public search: string = '';
    @observable public filteredChannels: Array<Channel> = [];
    @observable public filteredPendingChannels: Array<Channel> = [];
    @observable public filteredClosedChannels: Array<Channel> = [];
    @observable public filteredPeers: Array<Peer> = [];
    @observable public filterOptions: Array<string> = [];
    @observable public sort = {
        param: 'channelCapacity',
        dir: 'DESC',
        type: 'numeric'
    };
    @observable public showChannelsSearch: boolean = false;
    @observable public showPeersSearch: boolean = false;
    // aliasMap
    @observable public aliasMap = observable.map({});
    // external account funding
    @observable public funded_psbt: string = '';
    @observable public pending_chan_ids: Array<string>;
    // pending HTLCs
    @observable public pendingHTLCs: Array<PendingHTLC>;
    @observable public haveAnnouncedChannels = false;

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
    public resetOpenChannel = (silent?: boolean) => {
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

    public clearCloseChannelErr = () => {
        this.closeChannelErr = null;
    };

    @action
    public reset = () => {
        this.resetOpenChannel();
        this.haveAnnouncedChannels = false;
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
        this.filteredPeers = [];
        this.largestChannelSats = 0;
        this.totalOutbound = 0;
        this.totalInbound = 0;
        this.totalOffline = 0;
        this.channelsType = ChannelsType.Open;
        this.pendingHTLCs = [];
        this.peers = [];
    };

    @action
    public setSearch = (query: string) => {
        this.search = query;
        this.filterChannels();
        this.filterPendingChannels();
        this.filterClosedChannels();
        this.filterPeers();
    };

    @action
    public setSort = (value: any) => {
        this.sort = value;
        if (this.channelsView === ChannelsView.Channels) {
            this.filterChannels();
            this.filterPendingChannels();
            this.filterClosedChannels();
        } else {
            this.filterPeers();
        }
    };

    @action
    public setFilterOptions = (options: string[]) => {
        this.filterOptions = options;
        this.filterChannels();
        this.filterPendingChannels();
        this.filterClosedChannels();
    };

    private filter = (
        items: Array<Channel | Peer>,
        type: 'channel' | 'peer'
    ) => {
        const query = this.search.toLocaleLowerCase();

        let filtered = items;

        if (type === 'channel') {
            filtered = (items as Channel[])
                .filter(
                    (channel) =>
                        channel.alias?.toLowerCase().includes(query) ||
                        channel.remotePubkey?.toLowerCase().includes(query) ||
                        channel.channelId
                            ?.toString()
                            ?.toLowerCase()
                            .includes(query)
                )
                .filter(
                    (channel) =>
                        (!this.filterOptions?.includes('unannounced') &&
                            !this.filterOptions?.includes('announced')) ||
                        this.filterOptions?.includes(
                            channel.private ? 'unannounced' : 'announced'
                        )
                )
                .filter(
                    (channel) =>
                        (!this.filterOptions?.includes('online') &&
                            !this.filterOptions?.includes('offline')) ||
                        this.filterOptions?.includes(
                            channel.active ? 'online' : 'offline'
                        )
                );
        }

        if (type === 'peer') {
            filtered = (items as Peer[]).filter(
                (peer) =>
                    this.nodes[peer.pubkey]?.alias
                        ?.toLowerCase()
                        .includes(query) ||
                    peer.alias?.toLowerCase().includes(query) ||
                    peer.pubkey?.toLowerCase().includes(query)
            );
        }

        const sorted = filtered.sort((a: any, b: any) => {
            const param = this.sort?.param;
            const dir = this.sort?.dir;
            const sortType = this.sort?.type;
            const isPeerType = type === 'peer';

            if (!param || !dir || !sortType) return 0;

            const getSortValue = (item: any) => {
                if (isPeerType && param === 'alias') {
                    return (
                        this.nodes[item.pubkey]?.alias ||
                        item.alias ||
                        item.pubkey ||
                        ''
                    )
                        .toString()
                        .toLowerCase();
                }

                return item[param]?.toString().toLowerCase() || '';
            };

            const aVal = getSortValue(a);
            const bVal = getSortValue(b);

            if (sortType === 'numeric') {
                const aNum = Number(aVal) || 0;
                const bNum = Number(bVal) || 0;
                return dir === 'DESC' ? bNum - aNum : aNum - bNum;
            } else {
                if (!aVal && !bVal) return 0;
                if (!aVal) return dir === 'DESC' ? -1 : 1;
                if (!bVal) return dir === 'DESC' ? 1 : -1;
                return dir === 'DESC'
                    ? bVal.localeCompare(aVal)
                    : aVal.localeCompare(bVal);
            }
        });

        return sorted;
    };

    private filterChannels = () => {
        this.filteredChannels = this.filter(
            this.enrichedChannels,
            'channel'
        ) as Channel[];
    };

    private filterPendingChannels = () => {
        this.filteredPendingChannels = this.filter(
            this.enrichedPendingChannels,
            'channel'
        ) as Channel[];
    };

    private filterClosedChannels = () => {
        this.filteredClosedChannels = this.filter(
            this.enrichedClosedChannels,
            'channel'
        ) as Channel[];
    };

    private filterPeers = () => {
        this.filteredPeers = this.filter(this.peers, 'peer') as Peer[];
    };

    public getNodeInfo = (pubkey: string) => {
        this.loading = true;

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 10000);
        });

        return Promise.race([
            timeoutPromise,
            BackendUtils.getNodeInfo([pubkey])
        ])
            .then((data: any) => {
                runInAction(() => {
                    this.loading = false;
                    if (data?.node?.alias)
                        this.aliasMap.set(pubkey, data.node.alias);
                });
                return data.node;
            })
            .catch(() => {
                this.loading = false;
                this.aliasMap.set(pubkey, localeString('general.unknown'));
            });
    };

    private enrichChannels = async (
        channels: Array<Channel>,
        setPendingHtlcs?: boolean
    ): Promise<Channel[]> => {
        if (channels.length === 0) return [];

        const channelsWithMissingAliases = channels?.filter(
            (c) =>
                c.channelId != null &&
                this.aliasesByChannelId[c.channelId] == null
        );
        const channelsWithMissingNodeInfos = channels?.filter(
            (c) => this.nodes[c.remotePubkey] == null
        );
        const publicKeysOfToBeLoadedNodeInfos = chain(
            channelsWithMissingAliases.concat(channelsWithMissingNodeInfos)
        )
            .map((c) => c.remotePubkey)
            .uniq()
            .value();

        this.loading = true;
        await Promise.all(
            publicKeysOfToBeLoadedNodeInfos.map(
                async (remotePubKey: string) => {
                    if (this.settingsStore.implementation !== 'cln-rest') {
                        const nodeInfo = await this.getNodeInfo(remotePubKey);
                        if (!nodeInfo) return;
                        this.nodes[remotePubKey] = nodeInfo;
                    }
                }
            )
        );

        runInAction(() => {
            for (const channel of channelsWithMissingAliases) {
                const nodeInfo = this.nodes[channel.remotePubkey];
                const alias =
                    nodeInfo?.alias || fixedAliases[channel.remotePubkey];
                if (alias) {
                    this.aliasesByChannelId[channel.channelId!] = alias;
                    this.aliasesByPubkey[channel.remotePubkey] = alias;
                }
            }

            if (setPendingHtlcs) this.pendingHTLCs = [];

            let haveAnnouncedChannels = false;
            for (const channel of channels) {
                if (
                    !haveAnnouncedChannels &&
                    !channel.private &&
                    channel.isActive
                ) {
                    haveAnnouncedChannels = true;
                }
                if (channel.alias == null) {
                    channel.alias =
                        this.nodes[channel.remotePubkey]?.alias ||
                        this.aliasesByChannelId[channel.channelId!];
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
            this.haveAnnouncedChannels = haveAnnouncedChannels;

            if (this.pendingHTLCs.length > 0) {
                console.log('Pending HTLCs', this.pendingHTLCs);
            }

            this.loading = false;
        });
        return channels;
    };

    @action
    private getChannelsError = () => {
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
                        channel.receivingCapacity
                    );
                    const channelLocalBalance = new BigNumber(
                        channel.sendingCapacity
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

        if (BackendUtils.supportsClosedChannels()) {
            loadPromises.push(
                BackendUtils.getClosedChannels().then((data: any) => {
                    const closedChannels = data.channels.map(
                        (channel: any) => new ClosedChannel(channel)
                    );
                    this.closedChannels = closedChannels;
                })
            );
        }

        if (BackendUtils.supportsPendingChannels()) {
            loadPromises.push(
                BackendUtils.getPendingChannels().then((data: any) => {
                    const pendingOpenChannels = data.pending_open_channels.map(
                        (pending: any) => {
                            pending.channel.pendingOpen = true;
                            pending.channel.confirmations_until_active =
                                pending.confirmations_until_active;
                            pending.channel.confirmation_height =
                                pending.confirmation_height;
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
        }

        return Promise.all(loadPromises)
            .then(() => {
                runInAction(() => {
                    this.loading = false;
                    this.error = false;
                });
                return;
            })
            .catch(() => this.getChannelsError());
    };

    // For embedded LND: polls getChannels until at least one channel is online
    // This is useful because channels may take time to come online after node startup
    @action
    public getChannelsWithPolling = async (
        pollingIntervalMs: number = 3000,
        maxAttempts: number = 20
    ): Promise<void> => {
        let attempts = 0;

        const pollChannels = async (): Promise<void> => {
            attempts++;
            await this.getChannels();

            // If no open channels, no need to poll
            if (this.channels.length === 0) {
                return;
            }

            // Check if at least one channel is active (online)
            const hasActiveChannel = this.channels.some(
                (channel) => channel.isActive
            );

            if (hasActiveChannel) {
                return;
            }

            // If we've exceeded max attempts, stop polling
            if (attempts >= maxAttempts) {
                console.log(
                    'ChannelsStore: Max polling attempts reached, stopping poll'
                );
                return;
            }

            // Wait and try again
            await new Promise((resolve) =>
                setTimeout(resolve, pollingIntervalMs)
            );
            return pollChannels();
        };

        return pollChannels();
    };

    @action
    public closeChannel = async (
        channelPoint?: CloseChannelRequest,
        channelId?: string,
        satPerVbyte?: string,
        forceClose?: boolean | string,
        deliveryAddress?: string
    ) => {
        this.closeChannelErr = null;
        this.closingChannel = true;

        let urlParams: Array<any> = [];
        const implementation = this.settingsStore.implementation;

        if (implementation === 'cln-rest') {
            // Core Lightning
            urlParams = [channelId, forceClose];
        } else if (channelPoint) {
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
                    runInAction(() => {
                        if (!silent) {
                            this.errorPeerConnect = false;
                            this.connectingToPeer = false;
                            this.errorMsgPeer = null;
                            this.peerSuccess = true;
                        }
                        if (!connectPeerOnly) this.channelRequest = request;
                    });
                    resolve(true);
                })
                .catch((error: Error) => {
                    runInAction(() => {
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
                                    this.errorMsgPeer =
                                        errorToUserFriendly(error);
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
        });
    };

    @action
    public getPeers = async () => {
        this.loading = true;
        this.error = false;
        this.errorListPeers = null;

        try {
            const response = await BackendUtils.listPeers();
            runInAction(() => {
                this.peers = response.map((peerData: any) => {
                    return new Peer(peerData);
                });
                this.filterPeers();
                this.loading = false;
            });
        } catch (error: any) {
            runInAction(() => {
                this.error = true;
                this.errorListPeers =
                    error.message ??
                    localeString('views.ChannelsPane.peersFetchFailed');
                this.loading = false;
            });
        }
    };

    @action
    public disconnectPeer = async (pubkey: string) => {
        this.loading = true;
        this.error = false;
        this.errorDisconnectPeer = null;

        try {
            const isPeer = this.peers.find(
                (peer: Peer) => peer.pubkey === pubkey
            );

            if (!isPeer) {
                throw new Error(
                    localeString('views.ChannelsPane.peerNotFound')
                );
            }
            const res = await BackendUtils.disconnectPeer(pubkey);

            if (!res) {
                throw new Error(
                    localeString('views.ChannelsPane.peerNotConnected')
                );
            }

            runInAction(() => {
                this.peers = this.peers.filter(
                    (peer: Peer) => peer.pubkey !== pubkey
                );
                this.filterPeers();
                this.loading = false;
            });

            return true;
        } catch (error: any) {
            this.error = true;
            this.errorDisconnectPeer =
                error?.message?.message ||
                error?.message ||
                localeString('views.ChannelsPane.disconnectPeerFailed');
            this.loading = false;

            return false;
        }
    };

    private handleChannelOpen = (request: any, outputs?: any) => {
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
                            const errorMsg = errorToUserFriendly(
                                data.publish_error
                            );
                            runInAction(() => {
                                this.errorMsgChannel = errorMsg;
                                this.output_index = null;
                                this.funding_txid_str = null;
                                this.errorOpenChannel = true;
                                this.openingChannel = false;
                                this.channelRequest = null;
                                this.peerSuccess = false;
                                this.channelSuccess = false;
                            });
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
                                    runInAction(() => {
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
                                    });
                                })
                                .catch(() =>
                                    runInAction(() => {
                                        this.funded_psbt = formattedPsbt;
                                        this.output_index = null;
                                        this.funding_txid_str = null;
                                        this.errorOpenChannel = true;
                                        this.openingChannel = false;
                                        this.channelRequest = null;
                                        this.peerSuccess = false;
                                        this.channelSuccess = false;
                                    })
                                );
                        }
                    })
                    .catch((error: any) => {
                        const errorMsg = errorToUserFriendly(error);
                        runInAction(() => {
                            this.errorMsgChannel = errorMsg;
                            this.output_index = null;
                            this.funding_txid_str = null;
                            this.errorOpenChannel = true;
                            this.openingChannel = false;
                            this.channelRequest = null;
                            this.peerSuccess = false;
                            this.channelSuccess = false;
                        });
                    });
            })
            .catch((error: any) => {
                const errorMsg = errorToUserFriendly(error);
                runInAction(() => {
                    this.errorMsgChannel = errorMsg;
                    this.output_index = null;
                    this.funding_txid_str = null;
                    this.errorOpenChannel = true;
                    this.openingChannel = false;
                    this.channelRequest = null;
                    this.peerSuccess = false;
                    this.channelSuccess = false;
                });
            });
    };

    @action
    private handleChannelOpenError = (error: Error) => {
        this.errorMsgChannel = errorToUserFriendly(error);
        this.output_index = null;
        this.funding_txid_str = null;
        this.errorOpenChannel = true;
        this.openingChannel = false;
        this.channelRequest = null;
        this.peerSuccess = false;
        this.channelSuccess = false;
        this.connectingToPeer = false;
    };

    @action
    private openChannel = (request: OpenChannelRequest) => {
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
                        const { psbt_fund, pending_chan_id } = data.result;
                        this.pending_chan_ids.push(pending_chan_id);
                        if (psbt_fund?.funding_address) {
                            outputs[psbt_fund.funding_address] =
                                psbt_fund.funding_amount;
                        }
                        this.handleChannelOpen(request, outputs);
                    })
                    .catch((error: Error) => {
                        this.handleChannelOpenError(error);
                    });
            }
        } else {
            BackendUtils.openChannelSync(request)
                .then((data: any) =>
                    runInAction(() => {
                        this.output_index = data.output_index;
                        this.funding_txid_str = data.funding_txid_str;
                        this.errorOpenChannel = false;
                        this.openingChannel = false;
                        this.errorMsgChannel = null;
                        this.channelRequest = null;
                        this.channelSuccess = true;
                        this.connectingToPeer = false;
                    })
                )
                .catch((error: Error) => {
                    const errorMsg = errorToUserFriendly(error);
                    runInAction(() => {
                        this.errorMsgChannel = errorMsg;
                        this.output_index = null;
                        this.funding_txid_str = null;
                        this.errorOpenChannel = true;
                        this.openingChannel = false;
                        this.connectingToPeer = false;
                        this.channelRequest = null;
                        this.peerSuccess = false;
                        this.channelSuccess = false;
                    });
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
                const rawChannels = data.channels || data;
                const channels = BackendUtils.isLNDBased()
                    ? rawChannels
                    : rawChannels[0];
                runInAction(() => {
                    this.chanInfo[chanId] = new ChannelInfo(channels);
                    this.loading = false;
                });
            })
            .catch((error: any) => {
                runInAction(() => {
                    this.errorMsgPeer = error.toString();
                    if (this.chanInfo[chanId]) delete this.chanInfo[chanId];
                    this.loading = false;
                });
            });
    };

    // for CLNRest nodes, because the backend does not return the node policy.
    public getNodePolicy = (chanId: string): RoutingPolicy => {
        return {
            time_lock_delta: this.chanInfo[chanId].delay,
            min_htlc: this.chanInfo[chanId].htlc_minimum_msat.toString(),
            fee_base_msat:
                this.chanInfo[chanId].base_fee_millisatoshi.toString(),
            fee_rate_milli_msat:
                this.chanInfo[chanId].fee_per_millionth.toString(),
            disabled: false,
            max_htlc_msat: this.chanInfo[chanId].htlc_maximum_msat.toString(),
            last_update: Number(this.chanInfo[chanId].last_update?.toString())
        };
    };

    public setChannelsType = (type: ChannelsType) => {
        this.channelsType = type;
    };

    public setChannelsView = (view: ChannelsView) => {
        this.channelsView = view;
    };

    public toggleSearch = (type: ChannelsView) => {
        if (type === ChannelsView.Channels) {
            this.showChannelsSearch = !this.showChannelsSearch;
        } else {
            this.showPeersSearch = !this.showPeersSearch;
        }
    };
}
