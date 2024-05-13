import { action, observable } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';

import SettingsStore from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';

import lndMobile from '../lndmobile/LndMobileInjection';
const { index, channel } = lndMobile;

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

export default class LSPStore {
    @observable public info: any = {};
    @observable public zeroConfFee: number | undefined;
    @observable public feeId: string | undefined;
    @observable public pubkey: string;
    @observable public getInfoId: string;
    @observable public createOrderId: string;
    @observable public getOrderId: string;
    @observable public loading: boolean = true;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public showLspSettings: boolean = false;
    @observable public channelAcceptor: any;
    @observable public customMessagesSubscriber: any;
    @observable public getInfoData: any = {};
    @observable public createOrderResponse: any = {};
    @observable public getOrderResponse: any = {};

    @observable public resolvedCustomMessage: boolean;

    settingsStore: SettingsStore;
    channelsStore: ChannelsStore;
    nodeInfoStore: NodeInfoStore;

    constructor(
        settingsStore: SettingsStore,
        channelsStore: ChannelsStore,
        nodeInfoStore: NodeInfoStore
    ) {
        this.settingsStore = settingsStore;
        this.channelsStore = channelsStore;
        this.nodeInfoStore = nodeInfoStore;
    }

    @action
    public reset = () => {
        this.info = {};
        this.resetFee();
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;
        this.channelAcceptor = undefined;
        this.customMessagesSubscriber = undefined;
    };

    @action
    public resetFee = () => {
        this.zeroConfFee = undefined;
    };

    @action
    public resetLSPS1Data = () => {
        this.createOrderResponse = {};
        this.getInfoData = {};
        this.loading = true;
        this.error = false;
        this.error_msg = '';
    };

    getLSPHost = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lspTestnet
            : this.settingsStore.settings.lspMainnet;

    getLSPS1Pubkey = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1PubkeyTestnet
            : this.settingsStore.settings.lsps1PubkeyMainnet;

    getLSPS1Host = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1HostTestnet
            : this.settingsStore.settings.lsps1HostMainnet;

    getLSPS1Rest = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1RestTestnet
            : this.settingsStore.settings.lsps1RestMainnet;

    @action
    public getLSPInfo = () => {
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'get',
                `${this.getLSPHost()}/api/v1/info`,
                {
                    'Content-Type': 'application/json'
                }
            )
                .then(async (response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.info = data;
                        resolve(this.info);

                        const method =
                            this.info.connection_methods &&
                            this.info.connection_methods[0];

                        try {
                            await this.channelsStore.connectPeer(
                                {
                                    host: `${method.address}:${method.port}`,
                                    node_pubkey_string: this.info.pubkey,
                                    local_funding_amount: ''
                                },
                                false,
                                true,
                                true
                            );
                        } catch (e) {}
                    } else {
                        this.error = true;
                        this.error_msg = data.message;
                        // handle LSP geoblocking :(
                        if (
                            this.error_msg.includes(
                                'unavailable in your country'
                            )
                        ) {
                            this.showLspSettings = true;
                        }
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    this.error_msg = localeString(
                        'stores.LSPStore.connectionError'
                    );
                    this.showLspSettings = true;
                    reject();
                });
        });
    };

    @action
    public getZeroConfFee = (amount_msat: number) => {
        const { settings } = this.settingsStore;

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/fee`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : {
                          'Content-Type': 'application/json'
                      },
                JSON.stringify({
                    amount_msat,
                    pubkey: this.nodeInfoStore.nodeInfo.nodeId
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        this.zeroConfFee =
                            data.fee_amount_msat !== undefined
                                ? Number.parseInt(
                                      (
                                          Number(data.fee_amount_msat) / 1000
                                      ).toString()
                                  )
                                : undefined;
                        this.feeId = data.id;
                        this.error = false;
                        resolve(this.zeroConfFee);
                    } else {
                        this.error = true;
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    reject();
                });
        });
    };

    handleChannelAcceptorEvent = async (channelAcceptRequest: any) => {
        try {
            const requestPubkey = Base64Utils.bytesToHex(
                channelAcceptRequest.node_pubkey
            );

            // Only allow 0-conf chans from LSP or whitelisted peers
            const isZeroConfAllowed =
                this.info?.pubkey === requestPubkey ||
                (this.settingsStore?.settings?.zeroConfPeers &&
                    this.settingsStore?.settings?.zeroConfPeers.includes(
                        requestPubkey
                    ));

            await channel.channelAcceptorResponse(
                channelAcceptRequest.pending_chan_id,
                !channelAcceptRequest.wants_zero_conf || isZeroConfAllowed,
                isZeroConfAllowed && channelAcceptRequest.wants_zero_conf
            );
        } catch (error: any) {
            console.error('handleChannelAcceptorEvent error:', error.message);
        }
    };

    @action
    public initChannelAcceptor = async () => {
        if (this.channelAcceptor) return;
        if (this.settingsStore.implementation === 'embedded-lnd') {
            this.channelAcceptor = LndMobileEventEmitter.addListener(
                'ChannelAcceptor',
                async (event: any) => {
                    try {
                        const channelAcceptRequest =
                            channel.decodeChannelAcceptRequest(event.data);

                        await this.handleChannelAcceptorEvent(
                            channelAcceptRequest
                        );
                    } catch (error: any) {
                        console.error(
                            'channel acceptance error: ' + error.message
                        );
                    }
                }
            );

            await channel.channelAcceptor();
        } else {
            // Only allow 0-conf chans from LSP or whitelisted peers

            BackendUtils.initChanAcceptor({
                zeroConfPeers: this.settingsStore?.settings?.zeroConfPeers,
                lspPubkey: this.info?.pubkey
            });
        }
    };

    @action
    public getZeroConfInvoice = (bolt11: string) => {
        this.error = false;
        this.error_msg = '';
        this.showLspSettings = false;

        const { settings } = this.settingsStore;

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getLSPHost()}/api/v1/proposal`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : {
                          'Content-Type': 'application/json'
                      },
                JSON.stringify({
                    bolt11,
                    fee_id: this.feeId,
                    simpleTaproot: settings.requestSimpleTaproot
                })
            )
                .then(async (response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200 || status == 201) {
                        resolve(data.jit_bolt11);
                    } else {
                        this.error = true;
                        this.error_msg = `${localeString(
                            'stores.LSPStore.error'
                        )}: ${data.message}`;
                        if (
                            data.message &&
                            data.message.includes('access key')
                        ) {
                            this.showLspSettings = true;
                        }
                        reject();
                    }
                })
                .catch(() => {
                    this.error = true;
                    reject();
                });
        });
    };

    @action
    public sendCustomMessage = ({
        peer,
        type,
        data
    }: {
        peer: string;
        type: number | null;
        data: string;
    }) => {
        return new Promise((resolve, reject) => {
            if (!peer || !type || !data) {
                reject('Invalid parameters for custom message.');
                return;
            }

            BackendUtils.sendCustomMessage({ peer, type, data })
                .then((response: any) => {
                    resolve(response);
                })
                .catch((error: any) => {
                    this.error = true;
                    this.error_msg = errorToUserFriendly(error);
                    reject(error);
                });
        });
    };

    @action
    public handleCustomMessages = (decoded: any) => {
        const peer = Base64Utils.base64ToHex(decoded.peer);
        const data = JSON.parse(Base64Utils.base64ToUtf8(decoded.data));

        console.log('peer', peer);
        console.log('data', data);

        if (data.id === this.getInfoId) {
            this.getInfoData = data;
            this.loading = false;
        } else if (data.id === this.createOrderId) {
            if (data.error) {
                this.error = true;
                this.loading = false;
                this.error_msg = data?.error?.data?.message;
            } else {
                this.createOrderResponse = data;
                this.loading = false;
            }
        } else if (data.id === this.getOrderId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.message;
            } else {
                this.getOrderResponse = data;
            }
        }
    };

    @action
    public subscribeCustomMessages = async () => {
        if (this.customMessagesSubscriber) return;
        this.resolvedCustomMessage = false;
        let timer = 7000;
        const timeoutId = setTimeout(() => {
            if (!this.resolvedCustomMessage) {
                this.error = true;
                this.error_msg = localeString('views.LSPS1.timeoutError');
                this.loading = false;
            }
        }, timer);

        if (this.settingsStore.implementation === 'embedded-lnd') {
            this.customMessagesSubscriber = LndMobileEventEmitter.addListener(
                'SubscribeCustomMessages',
                async (event: any) => {
                    try {
                        const decoded = index.decodeCustomMessage(event.data);
                        this.handleCustomMessages(decoded);
                        this.resolvedCustomMessage = true;
                        clearTimeout(timeoutId);
                    } catch (error: any) {
                        console.error(
                            'sub custom messages error: ' + error.message
                        );
                    }
                }
            );

            await index.subscribeCustomMessages();
        } else {
            BackendUtils.subscribeCustomMessages(
                (response: any) => {
                    const decoded = response.result;
                    this.handleCustomMessages(decoded);
                    this.resolvedCustomMessage = true;
                    clearTimeout(timeoutId);
                },
                (error: any) => {
                    console.error(
                        'sub custom messages error: ' + error.message
                    );
                }
            );
        }
    };

    @action
    public getInfoREST = () => {
        const endpoint = `${this.getLSPS1Rest()}/api/v1/get_info`;

        console.log('Fetching data from:', endpoint);

        return ReactNativeBlobUtil.fetch('GET', endpoint)
            .then((response) => {
                if (response.info().status === 200) {
                    const responseData = JSON.parse(response.data);
                    this.getInfoData = responseData;
                    try {
                        const uri = responseData.uris[0];
                        const pubkey = uri.split('@')[0];
                        this.pubkey = pubkey;
                    } catch (e) {}
                    this.loading = false;
                } else {
                    this.error = true;
                    this.error_msg = 'Error fetching get_info data';
                    this.loading = false;
                }
            })
            .catch(() => {
                this.error = true;
                this.error_msg = 'Error fetching get_info data';
                this.loading = false;
            });
    };

    @action
    public createOrderREST = (state: any) => {
        const data = JSON.stringify({
            lsp_balance_sat: state.lspBalanceSat,
            client_balance_sat: state.clientBalanceSat,
            required_channel_confirmations: parseInt(
                state.requiredChannelConfirmations
            ),
            funding_confirms_within_blocks: parseInt(
                state.confirmsWithinBlocks
            ),
            channel_expiry_blocks: parseInt(state.channelExpiryBlocks),
            token: state.token,
            refund_onchain_address: state.refundOnchainAddress,
            announce_channel: state.announceChannel,
            public_key: this.nodeInfoStore.nodeInfo.nodeId
        });
        this.loading = true;
        this.error = false;
        this.error_msg = '';
        const endpoint = `${this.getLSPS1Rest()}/api/v1/create_order`;
        console.log('Sending data to:', endpoint);

        return ReactNativeBlobUtil.fetch(
            'POST',
            endpoint,
            {
                'Content-Type': 'application/json'
            },
            data
        )
            .then((response) => {
                const responseData = JSON.parse(response.data);
                if (responseData.error) {
                    this.error = true;
                    this.error_msg = responseData.message;
                    this.loading = false;
                } else {
                    this.createOrderResponse = responseData;
                    this.loading = false;
                    console.log('Response received:', responseData);
                }
            })
            .catch((error) => {
                console.error(
                    'Error sending (create_order) custom message:',
                    error
                );
                this.error = true;
                this.error_msg = errorToUserFriendly(error);
                this.loading = false;
            });
    };

    @action
    public getOrderREST(id: string, peerOrEndpoint: any) {
        this.loading = true;
        const endpoint = `${peerOrEndpoint}/api/v1/get_order?order_id=${id}`;

        console.log('Sending data to:', endpoint);

        return ReactNativeBlobUtil.fetch('GET', endpoint, {
            'Content-Type': 'application/json'
        })
            .then((response) => {
                const responseData = JSON.parse(response.data);
                console.log('Response received:', responseData);
                if (responseData.error) {
                    this.error = true;
                    this.error_msg = responseData.message;
                } else {
                    this.getOrderResponse = responseData;
                }
            })
            .catch((error) => {
                console.error('Error sending custom message:', error);
                this.error = true;
                this.error_msg = errorToUserFriendly(error);
                this.loading = false;
            });
    }
}
