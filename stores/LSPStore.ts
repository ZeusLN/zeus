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
                const lspPubkey = this.getLSPSPubkey();
                if (
                    BackendUtils.supportsLSPScustomMessage() &&
                    lspPubkey &&
                    this.channelsStore.channels.some(
                        (channel: { remotePubkey: string }) =>
                            channel.remotePubkey === lspPubkey
                    )
                ) {
                    this.getExtendableChannels();
                }
            }
        );
    }

    @action
    public reset = (errorsOnly = false) => {
        if (!errorsOnly) {
            this.info = {};
            this.resetFee();
            this.showLspSettings = false;
            this.channelAcceptor = undefined;
            this.customMessagesSubscriber = undefined;
        }
        this.error = false;
        this.error_msg = '';
        this.flow_error = false;
        this.flow_error_msg = '';
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
                        const errorMsg = errorToUserFriendly(data.message);
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = errorMsg;
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
                    const errorMsg = errorToUserFriendly(error);
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = errorMsg;
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
                if (responseData.error) {
                    const errorMsg = errorToUserFriendly(responseData.message);
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = errorMsg;
                        this.loadingLSPS1 = false;
                    });
                } else {
                    runInAction(() => {
                        this.createOrderResponse = responseData;
                        this.loadingLSPS1 = false;
                        console.log('Response received:', responseData);
                    });
                }
            })
            .catch((error) => {
                console.error(
                    'Error sending (create_order) custom message:',
                    error
                );
                const errorMsg = errorToUserFriendly(error);
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorMsg;
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
                const errorMsg = errorToUserFriendly(error);
                runInAction(() => {
                    this.error = true;
                    this.error_msg = errorMsg;
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

    // LSPS1 Native (for embedded LDK Node)

    @action
    public lsps1GetInfoNative = () => {
        // For native LSPS1, the LSP is configured at node initialization
        // LDK Node doesn't expose a getInfo method, so we provide sensible defaults
        // that allow the user to configure their channel request
        this.loadingLSPS1 = false;
        this.error = false;
        this.error_msg = '';
        // Provide default options that work with most LSPs
        this.getInfoData = {
            native: true,
            options: {
                // Minimum/maximum LSP balance (channel size from LSP side)
                min_initial_lsp_balance_sat: '100000', // 100k sats minimum
                max_initial_lsp_balance_sat: '100000000', // 1 BTC maximum
                // Minimum/maximum client balance (push amount)
                min_initial_client_balance_sat: '0',
                max_initial_client_balance_sat: '0', // Most LSPs don't allow client balance
                // Channel expiry options
                min_channel_expiry_blocks: 4380, // ~1 month
                max_channel_expiry_blocks: 52560, // ~1 year
                // Confirmation requirements
                min_required_channel_confirmations: 0,
                max_required_channel_confirmations: 6,
                min_funding_confirms_within_blocks: 6,
                max_funding_confirms_within_blocks: 144
            }
        };
    };

    @action
    public lsps1CreateOrderNative = async (state: any) => {
        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        try {
            const response = await BackendUtils.requestLsps1Liquidity({
                amount_sat: parseInt(state.lspBalanceSat),
                client_balance_sat: parseInt(state.clientBalanceSat) || 0,
                expiry_blocks: parseInt(state.channelExpiryBlocks),
                announce_channel: state.announceChannel || false
            });

            runInAction(() => {
                // Transform response to match expected format
                this.createOrderResponse = {
                    result: {
                        order_id: response.order_id,
                        lsp_balance_sat: response.lsp_balance_sat?.toString(),
                        client_balance_sat:
                            response.client_balance_sat?.toString(),
                        funding_confirms_within_blocks:
                            response.funding_confirms_within_blocks,
                        channel_expiry_blocks: response.channel_expiry_blocks,
                        payment: {
                            state: response.payment?.state,
                            fee_total_sat:
                                response.payment?.fee_total_sat?.toString(),
                            order_total_sat:
                                response.payment?.order_total_sat?.toString(),
                            bolt11_invoice: response.payment?.bolt11_invoice,
                            onchain_address: response.payment?.onchain_address,
                            onchain_payment: response.payment?.onchain_address
                                ? {
                                      address: response.payment.onchain_address,
                                      order_total_sat:
                                          response.payment.onchain_total_sat?.toString()
                                  }
                                : undefined
                        },
                        channel: response.channel
                    }
                };
                this.loadingLSPS1 = false;
            });
        } catch (err: any) {
            const errorMessage =
                err?.message || err?.toString() || 'Unknown error';
            runInAction(() => {
                this.error = true;
                this.error_msg = errorToUserFriendly(errorMessage);
                this.loadingLSPS1 = false;
            });
        }
    };

    @action
    public lsps1GetOrderNative = async (orderId: string) => {
        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        try {
            const response = await BackendUtils.checkLsps1OrderStatus(orderId);

            runInAction(() => {
                // Transform response to match expected format
                this.getOrderResponse = {
                    result: {
                        order_id: response.order_id,
                        lsp_balance_sat: response.lsp_balance_sat?.toString(),
                        client_balance_sat:
                            response.client_balance_sat?.toString(),
                        payment: {
                            state: response.payment?.state,
                            fee_total_sat:
                                response.payment?.fee_total_sat?.toString(),
                            order_total_sat:
                                response.payment?.order_total_sat?.toString(),
                            bolt11_invoice: response.payment?.bolt11_invoice,
                            bolt11_state: response.payment?.bolt11_state,
                            onchain_address: response.payment?.onchain_address,
                            onchain_state: response.payment?.onchain_state,
                            onchain_payment: response.payment?.onchain_address
                                ? {
                                      address: response.payment.onchain_address,
                                      state: response.payment.onchain_state
                                  }
                                : undefined
                        },
                        channel: response.channel
                    }
                };
                this.loadingLSPS1 = false;
            });
        } catch (err: any) {
            const errorMessage =
                err?.message || err?.toString() || 'Unknown error';
            runInAction(() => {
                this.error = true;
                this.error_msg = errorToUserFriendly(errorMessage);
                this.loadingLSPS1 = false;
            });
        }
    };

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
