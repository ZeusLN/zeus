import { action, observable, reaction, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { v4 as uuidv4 } from 'uuid';

import SettingsStore, {
    DEFAULT_LSPS1_PUBKEY_MAINNET,
    DEFAULT_LSPS1_PUBKEY_TESTNET,
    DEFAULT_LSPS1_REST_MAINNET,
    DEFAULT_LSPS1_REST_TESTNET
} from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';

import lndMobile from '../lndmobile/LndMobileInjection';
const { index, channel } = lndMobile;

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

export const LEGACY_LSPS1_ORDERS_KEY = 'orderResponses';
export const LSPS_ORDERS_KEY = 'zeus-lsps1-orders';

const CUSTOM_MESSAGE_TYPE = 37913;
const JSON_RPC_VERSION = '2.0';

export default class LSPStore {
    @observable public info: any = {};
    @observable public zeroConfFee: number | undefined;
    @observable public feeId: string | undefined;
    @observable public pubkey: string;
    @observable public loadingLSPS1: boolean = true;
    @observable public loadingLSPS7: boolean = true;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public flow_error: boolean = false;
    @observable public flow_error_msg: string = '';
    @observable public showLspSettings: boolean = false;
    @observable public channelAcceptor: any;
    @observable public customMessagesSubscriber: any;
    @observable public resolvedCustomMessage: boolean;
    // LSPS1
    @observable public getInfoId: string;
    @observable public createOrderId: string;
    @observable public getOrderId: string;
    @observable public getInfoData: any = {};
    @observable public createOrderResponse: any = {};
    @observable public getOrderResponse: any = {};
    // LSPS7
    @observable public getExtendableOrdersId: string;
    @observable public getExtendableOrdersData: any = [];
    @observable public createExtensionOrderId: string;
    @observable public createExtensionOrderResponse: any = {};
    @observable public getExtensionOrderId: string;
    @observable public getExtensionOrderResponse: any = {};

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

        reaction(
            () => this.channelsStore.channels,
            () => {
                if (
                    this.channelsStore.channels.length !== 0 &&
                    BackendUtils.supportsLSPScustomMessage()
                ) {
                    this.getExtendableChannels();
                }
            }
        );
    }

    @action
    public reset = () => {
        this.info = {};
        this.resetFee();
        this.error = false;
        this.error_msg = '';
        this.flow_error = false;
        this.flow_error_msg = '';
        this.showLspSettings = false;
        this.channelAcceptor = undefined;
        this.customMessagesSubscriber = undefined;
    };

    @action
    public resetFee = () => (this.zeroConfFee = undefined);

    @action
    public resetLSPS1Data = () => {
        this.createOrderResponse = {};
        this.getInfoData = {};
        this.loadingLSPS1 = false;
        this.error = false;
        this.error_msg = '';
    };

    @action
    public resetLSPS7Data = () => {
        this.createExtensionOrderResponse = {};
        this.loadingLSPS7 = false;
        this.error = false;
        this.error_msg = '';
    };

    @action
    public clearLSPS7Order = () => {
        this.createExtensionOrderResponse = {};
    };

    public isOlympus = () => {
        const olympusREST = this.nodeInfoStore!.nodeInfo.isTestNet
            ? DEFAULT_LSPS1_REST_TESTNET
            : DEFAULT_LSPS1_REST_MAINNET;
        const olympusPubkey = this.nodeInfoStore!.nodeInfo.isTestNet
            ? DEFAULT_LSPS1_PUBKEY_TESTNET
            : DEFAULT_LSPS1_PUBKEY_MAINNET;
        if (
            BackendUtils.supportsLSPScustomMessage() &&
            this.getLSPSPubkey() == olympusPubkey
        ) {
            return true;
        } else if (
            BackendUtils.supportsLSPS1rest() &&
            this.getLSPS1Rest() === olympusREST
        ) {
            return true;
        }

        return false;
    };

    private getFlowHost = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lspTestnet
            : this.settingsStore.settings.lspMainnet;

    public getLSPSPubkey = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1PubkeyTestnet
            : this.settingsStore.settings.lsps1PubkeyMainnet;

    public getLSPSHost = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1HostTestnet
            : this.settingsStore.settings.lsps1HostMainnet;

    public getLSPS1Rest = () =>
        this.nodeInfoStore!.nodeInfo.isTestNet
            ? this.settingsStore.settings.lsps1RestTestnet
            : this.settingsStore.settings.lsps1RestMainnet;

    private encodeMessage = (n: any) =>
        Buffer.from(JSON.stringify(n)).toString('hex');

    // Flow 2.0

    public getLSPInfo = () => {
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'get',
                `${this.getFlowHost()}/api/v1/info`,
                { 'Content-Type': 'application/json' }
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
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = errorToUserFriendly(
                                data.message
                            );
                            // handle LSP geoblocking :(
                            if (
                                this.error_msg.includes(
                                    'unavailable in your country'
                                )
                            ) {
                                this.showLspSettings = true;
                            }
                        });
                        reject();
                    }
                })
                .catch(() => {
                    runInAction(() => {
                        this.flow_error = true;
                        this.flow_error_msg = localeString(
                            'stores.LSPStore.connectionError'
                        );
                        this.showLspSettings = true;
                    });
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
                `${this.getFlowHost()}/api/v1/fee`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : { 'Content-Type': 'application/json' },
                JSON.stringify({
                    amount_msat,
                    pubkey: this.nodeInfoStore.nodeInfo.nodeId
                })
            )
                .then((response: any) => {
                    const status = response.info().status;
                    const data = response.json();
                    if (status == 200) {
                        runInAction(() => {
                            this.zeroConfFee =
                                data.fee_amount_msat !== undefined
                                    ? Number.parseInt(
                                          (
                                              Number(data.fee_amount_msat) /
                                              1000
                                          ).toString()
                                      )
                                    : undefined;
                            this.feeId = data.id;
                            this.flow_error = false;
                        });
                        resolve(this.zeroConfFee);
                    } else {
                        this.flow_error = true;
                        reject();
                    }
                })
                .catch(() => {
                    this.flow_error = true;
                    reject();
                });
        });
    };

    private handleChannelAcceptorEvent = async (channelAcceptRequest: any) => {
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
        this.flow_error = false;
        this.flow_error_msg = '';
        this.showLspSettings = false;

        const { settings } = this.settingsStore;

        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'post',
                `${this.getFlowHost()}/api/v1/proposal`,
                settings.lspAccessKey
                    ? {
                          'Content-Type': 'application/json',
                          'x-auth-token': settings.lspAccessKey
                      }
                    : { 'Content-Type': 'application/json' },
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
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = `${localeString(
                                'stores.LSPStore.error'
                            )}: ${data.message}`;
                            if (
                                data.message &&
                                data.message.includes('access key')
                            ) {
                                this.showLspSettings = true;
                            }
                        });
                        reject();
                    }
                })
                .catch(() => {
                    this.flow_error = true;
                    reject();
                });
        });
    };

    // LSPS0

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
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = errorToUserFriendly(error);
                    });
                    reject(error);
                });
        });
    };

    @action
    public handleCustomMessages = (decoded: any) => {
        const peer = Base64Utils.base64ToHex(decoded.peer);
        const data = JSON.parse(Base64Utils.base64ToUtf8(decoded.data));

        console.log('Received custom message', { peer, data });

        if (data.id === this.getInfoId) {
            this.getInfoData = data;
            this.loadingLSPS1 = false;
        } else if (data.id === this.createOrderId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.data?.message
                    ? errorToUserFriendly(data?.error?.data?.message)
                    : '';
            } else {
                this.createOrderResponse = data;
            }
            this.loadingLSPS1 = false;
        } else if (data.id === this.getOrderId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.message
                    ? errorToUserFriendly(data?.error?.message)
                    : '';
            } else {
                this.getOrderResponse = data;
            }
            this.loadingLSPS1 = false;
        } else if (data.id === this.getExtendableOrdersId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.message
                    ? errorToUserFriendly(data?.error?.message)
                    : '';
            } else {
                this.getExtendableOrdersData = data?.result?.extendable_orders;
            }
            this.loadingLSPS7 = false;
        } else if (data.id === this.createExtensionOrderId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.data?.message
                    ? errorToUserFriendly(data?.error?.data?.message)
                    : '';
            } else {
                this.createExtensionOrderResponse = data;
            }
            this.loadingLSPS7 = false;
        } else if (data.id === this.getExtensionOrderId) {
            if (data.error) {
                this.error = true;
                this.error_msg = data?.error?.data?.message
                    ? errorToUserFriendly(data?.error?.data?.message)
                    : '';
            } else {
                this.getExtensionOrderResponse = data;
            }
            this.loadingLSPS7 = false;
        }
    };

    @action
    public subscribeCustomMessages = async () => {
        if (this.customMessagesSubscriber) return;
        this.resolvedCustomMessage = false;
        let timer = 7000;
        const timeoutId = setTimeout(() => {
            if (!this.resolvedCustomMessage) {
                runInAction(() => {
                    this.error = true;
                    this.error_msg = localeString('views.LSPS1.timeoutError');
                    this.loadingLSPS1 = false;
                    this.loadingLSPS7 = false;
                });
            }
        }, timer);

        if (this.settingsStore.implementation === 'embedded-lnd') {
            this.customMessagesSubscriber = LndMobileEventEmitter.addListener(
                'SubscribeCustomMessages',
                async (event: any) => {
                    try {
                        const decoded = index.decodeCustomMessage(event.data);
                        runInAction(() => {
                            this.handleCustomMessages(decoded);
                            this.resolvedCustomMessage = true;
                        });
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
                    runInAction(() => {
                        this.handleCustomMessages(decoded);
                        this.resolvedCustomMessage = true;
                    });
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

    // LSPS1

    public lsps1GetInfoREST = () => {
        this.loadingLSPS1 = true;

        const endpoint = `${this.getLSPS1Rest()}/api/v1/get_info`;

        console.log('Fetching data from:', endpoint);

        return ReactNativeBlobUtil.fetch('GET', endpoint)
            .then((response) => {
                runInAction(() => {
                    if (response.info().status === 200) {
                        const responseData = JSON.parse(response.data);
                        this.getInfoData = responseData;
                        try {
                            const uri = responseData.uris[0];
                            const pubkey = uri.split('@')[0];
                            this.pubkey = pubkey;
                        } catch (e) {}
                        this.loadingLSPS1 = false;
                    } else {
                        this.error = true;
                        this.error_msg = 'Error fetching get_info data';
                        this.loadingLSPS1 = false;
                    }
                });
            })
            .catch(() => {
                runInAction(() => {
                    this.error = true;
                    this.error_msg = 'Error fetching get_info data';
                    this.loadingLSPS1 = false;
                });
            });
    };

    @action
    public lsps1GetInfoCustomMessage = () => {
        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        this.getInfoId = uuidv4();
        const method = 'lsps1.get_info';

        this.sendCustomMessage({
            peer: this.getLSPSPubkey(),
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {},
                id: this.getInfoId
            })
        })
            .then((response) => {
                console.log(
                    `Response for custom message (${method}) received:`,
                    response
                );
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    };

    @action
    public lsps1CreateOrderREST = (state: any) => {
        this.loadingLSPS1 = true;
        const data = JSON.stringify({
            lsp_balance_sat: state.lspBalanceSat.toString(),
            client_balance_sat: state.clientBalanceSat.toString(),
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
        this.error = false;
        this.error_msg = '';
        const endpoint = `${this.getLSPS1Rest()}/api/v1/create_order`;
        console.log('Sending data to:', endpoint);

        return ReactNativeBlobUtil.fetch(
            'POST',
            endpoint,
            { 'Content-Type': 'application/json' },
            data
        )
            .then((response) => {
                const responseData = JSON.parse(response.data);
                runInAction(() => {
                    if (responseData.error) {
                        this.error = true;
                        this.error_msg = errorToUserFriendly(
                            responseData.message
                        );
                        this.loadingLSPS1 = false;
                    } else {
                        this.createOrderResponse = responseData;
                        this.loadingLSPS1 = false;
                        console.log('Response received:', responseData);
                    }
                });
            })
            .catch((error) => {
                console.error(
                    'Error sending (create_order) custom message:',
                    error
                );
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorToUserFriendly(error);
                    this.loadingLSPS1 = false;
                });
            });
    };

    @action
    public lsps1CreateOrderCustomMessage = (state: any) => {
        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        this.createOrderId = uuidv4();
        const method = 'lsps1.create_order';

        this.sendCustomMessage({
            peer: this.getLSPSPubkey(),
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {
                    lsp_balance_sat: state.lspBalanceSat.toString(),
                    client_balance_sat: state.clientBalanceSat.toString(),
                    required_channel_confirmations: parseInt(
                        state.requiredChannelConfirmations
                    ),
                    funding_confirms_within_blocks: parseInt(
                        state.confirmsWithinBlocks
                    ),
                    channel_expiry_blocks: state.channelExpiryBlocks,
                    token: state.token,
                    refund_onchain_address: state.refundOnchainAddress,
                    announce_channel: state.announceChannel
                },
                id: this.createOrderId
            })
        })
            .then((response) => {
                console.log(
                    `Response for custom message (${method}) received:`,
                    response
                );
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    };

    public lsps1GetOrderREST(id: string, RESTHost: string) {
        this.loadingLSPS1 = true;
        const endpoint = `${RESTHost}/api/v1/get_order?order_id=${id}`;

        console.log('Sending data to:', endpoint);

        return ReactNativeBlobUtil.fetch('GET', endpoint, {
            'Content-Type': 'application/json'
        })
            .then((response) => {
                const responseData = JSON.parse(response.data);
                console.log('Response received:', responseData);
                runInAction(() => {
                    if (responseData.error) {
                        this.error = true;
                        this.error_msg = responseData.message;
                    } else {
                        this.getOrderResponse = responseData;
                    }
                    this.loadingLSPS1 = false;
                });
            })
            .catch((error) => {
                console.error('Error sending custom message:', error);
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorToUserFriendly(error);
                    this.loadingLSPS1 = false;
                });
            });
    }

    @action
    public lsps1GetOrderCustomMessage(orderId: string, peer: string) {
        this.loadingLSPS1 = true;

        this.getOrderId = uuidv4();
        const method = 'lsps1.get_order';

        this.sendCustomMessage({
            peer,
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {
                    order_id: orderId
                },
                id: this.getOrderId
            })
        })
            .then((response) => {
                console.log(
                    `Response for custom message (${method}) received:`,
                    response
                );
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    }

    // LSPS7

    @action
    public getExtendableChannels = () => {
        this.error = false;
        this.error_msg = '';

        this.getExtendableOrdersId = uuidv4();
        const method = 'lsps7.get_extendable_channels';

        this.sendCustomMessage({
            peer: this.getLSPSPubkey(),
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {},
                id: this.getExtendableOrdersId
            })
        })
            .then((response) => {
                console.log(`Custom message (${method}) sent:`, response);
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    };

    @action
    public lsps7CreateOrderCustomMessage = (state: any) => {
        this.loadingLSPS7 = true;
        this.error = false;
        this.error_msg = '';

        this.createExtensionOrderId = uuidv4();
        const method = 'lsps7.create_order';

        this.sendCustomMessage({
            peer: this.getLSPSPubkey(),
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {
                    short_channel_id: state.chanId,
                    channel_extension_expiry_blocks:
                        state.channelExtensionBlocks,
                    token: state.token,
                    refund_onchain_address: state.refundOnchainAddress
                },
                id: this.createExtensionOrderId
            })
        })
            .then((response) => {
                console.log(
                    `Response for custom message (${method}) received:`,
                    response
                );
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    };

    @action
    public lsps7GetOrderCustomMessage(orderId: string, peer: string) {
        this.loadingLSPS7 = true;

        this.getExtensionOrderId = uuidv4();
        const method = 'lsps7.get_order';

        this.sendCustomMessage({
            peer,
            type: CUSTOM_MESSAGE_TYPE,
            data: this.encodeMessage({
                jsonrpc: JSON_RPC_VERSION,
                method,
                params: {
                    order_id: orderId
                },
                id: this.getExtensionOrderId
            })
        })
            .then((response) => {
                console.log(
                    `Response for custom message (${method}) received:`,
                    response
                );
            })
            .catch((error) => {
                console.error(
                    `Error sending (${method}) custom message:`,
                    error
                );
            });
    }
}
