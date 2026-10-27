import { action, observable, reaction, runInAction } from 'mobx';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { v4 as uuidv4 } from 'uuid';

import SettingsStore, { getLspConfigForNetwork } from './SettingsStore';
import ChannelsStore from './ChannelsStore';
import NodeInfoStore from './NodeInfoStore';

import lndMobile from '../lndmobile/LndMobileInjection';
const { index, channel } = lndMobile;

import { LSPOrderState, LSPService } from '../models/LSP';

import BackendUtils from '../utils/BackendUtils';
import Base64Utils from '../utils/Base64Utils';
import { getClientInfo } from '../utils/ClientInfoUtils';
import { LndMobileEventEmitter } from '../utils/LndMobileUtils';
import { localeString } from '../utils/LocaleUtils';
import { verifyWrappedInvoice } from '../utils/LspUtils';
import { errorToUserFriendly } from '../utils/ErrorUtils';

import Storage from '../storage';

export const LEGACY_LSPS1_ORDERS_KEY = 'orderResponses';
export const LSPS_ORDERS_KEY = 'zeus-lsps1-orders';

// One /api/v1/fee answer. The proposal has to send the id of the quote the
// invoice was priced with, so callers keep this rather than reading the
// shared zeroConfFee/feeId, which a newer request or a reset can replace.
export interface ZeroConfFeeQuote {
    feeSats: number | undefined;
    feeId: string | undefined;
}

// The quote an invoice is priced with, with a missing fee counted as 0.
export type PricedZeroConfFeeQuote = ZeroConfFeeQuote & { feeSats: number };

const CUSTOM_MESSAGE_TYPE = 37913;
const JSON_RPC_VERSION = '2.0';

// Upper bound for how long a custom-message get_order round trip may take before
// the caller stops waiting. Resolves early as soon as the response arrives.
const CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS = 7000;

const FREE_ORDER_POLL_INTERVAL_MS = 5000;

// The fields of an lsps7.get_extendable_channels entry that the channel views
// read while rendering. The answer is LSP-controlled, so only keep entries the
// views can draw.
const isBlockCount = (value: any) => value == null || Number.isFinite(value);
const isExtendableChannel = (extendableChannel: any) =>
    typeof extendableChannel?.short_channel_id === 'string' &&
    isBlockCount(extendableChannel.expiration_block) &&
    isBlockCount(extendableChannel.max_channel_extension_expiry_blocks);

export default class LSPStore {
    @observable public info: any = {};
    @observable public zeroConfFee: number | undefined;
    @observable public feeId: string | undefined;
    @observable public pubkey: string;
    @observable public loadingLSPS1: boolean = true;
    @observable public loadingLSPS7: boolean = false;
    @observable public error: boolean = false;
    @observable public error_msg: string = '';
    @observable public flow_error: boolean = false;
    @observable public flow_error_msg: string = '';
    @observable public showLspSettings: boolean = false;
    @observable public channelAcceptor: any;
    @observable public customMessagesSubscriber: any;
    // bumped by reset() and by every Flow info request, so only the latest
    // request for the current connection writes its reply
    private flowInfoGeneration = 0;
    // LSPS1
    @observable public getInfoId: string;
    @observable public createOrderId: string;
    @observable public getOrderId: string;
    @observable public getInfoData: any = {};
    @observable public createOrderResponse: any = {};
    @observable public getOrderResponse: any = {};
    // LSPS7
    @observable public getExtendableChannelsId: string;
    @observable public getExtendableChannelsData: any = [];
    @observable public getExtendableChannelsError: boolean = false;
    @observable public createExtensionOrderId: string;
    @observable public createExtensionOrderResponse: any = {};
    @observable public getExtensionOrderId: string;
    @observable public getExtensionOrderResponse: any = {};

    // Resolve callbacks for in-flight custom-message requests, invoked by
    // handleCustomMessages when the matching response arrives so callers can
    // await the round trip instead of racing a fixed delay. Each request type
    // owns its own resolver/timeout pair so a slow or unanswered request can't
    // be masked by an unrelated request settling first.
    private getInfoResponseResolver: (() => void) | null = null;
    private createOrderResponseResolver: (() => void) | null = null;
    private getOrderResponseResolver: (() => void) | null = null;
    private getExtendableChannelsResponseResolver:
        | ((failed?: boolean) => void)
        | null = null;
    private createExtensionOrderResponseResolver: (() => void) | null = null;
    private getExtensionOrderResponseResolver: (() => void) | null = null;

    // The peer each in-flight custom-message request was sent to, keyed by
    // request id. handleCustomMessages drops a reply whose id matches a
    // request but whose sender does not, so a connected peer that is not
    // the LSP can't answer in the LSP's place. Entries are removed when a
    // reply is consumed and when a reset invalidates the request id.
    private customMessageRequestPeers: { [requestId: string]: string } = {};

    // Free orders have no payment step, so they never pass through the LSPPaymentAwait polling screen.
    // Without this poll the post-creation view would stay on the
    // "opening now…" message forever, even after the channel open fails.
    // Poll get_order until the order reaches a terminal state, then mirror the result
    // into the create-order response so the view reflects the real outcome.
    private freeOrderPollTimer: ReturnType<typeof setTimeout> | null = null;
    private freeOrderPollId: string | null = null;
    // Incremented on every start/stop so an in-flight poll that resumes after an
    // await can tell whether its session is still the active one.
    private freeOrderPollSessionId = 0;
    // Incremented on every native LSPS7 extendable channels call so a call
    // that settles after a newer one can't overwrite its result.
    private getExtendableChannelsNativeRequestId = 0;
    // Set while the custom message subscription can deliver replies.
    private customMessagesReady = false;
    // Incremented by reset(), so a subscription that settles afterwards can
    // tell it belongs to the previous connection.
    private customMessagesGeneration = 0;
    // Incremented on every Flow fee request and fee reset, so an answer to a
    // fee request that is no longer the latest one is dropped instead of
    // replacing the quote an invoice was priced with.
    private feeRequestId = 0;

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
            () => this.fetchLeasesIfLspChannel()
        );
    }

    // Fetches LSPS7 lease data when there is a channel with the LSP. Over
    // custom messages the reply only reaches the app once the subscription
    // is open, and the wallet loads channels before it subscribes, so the
    // fetch waits for onCustomMessagesReady instead of timing out into a
    // fetch error.
    private fetchLeasesIfLspChannel = () => {
        const native = BackendUtils.supportsLSPS7native();
        if (
            (native ||
                (BackendUtils.supportsLSPScustomMessage() &&
                    this.customMessagesReady)) &&
            this.hasLspChannel()
        ) {
            this.getExtendableChannels();
            this.nodeInfoStore.getNodeInfo();
        }
    };

    private hasLspChannel = () => {
        const lspPubkey = this.getLSPSPubkey();
        return (
            !!lspPubkey &&
            this.channelsStore.channels.some(
                (channel: { remotePubkey: string }) =>
                    channel.remotePubkey === lspPubkey
            )
        );
    };

    private onCustomMessagesReady = () => {
        this.customMessagesReady = true;
        this.fetchLeasesIfLspChannel();
    };

    // The subscription failed before it could deliver replies, so no lease
    // fetch will run. Report it like a failed fetch instead of showing
    // nothing for a channel with the LSP.
    private onCustomMessagesFailed = () => {
        this.customMessagesReady = false;
        if (this.hasLspChannel()) {
            runInAction(() => {
                this.getExtendableChannelsError = true;
            });
        }
    };

    @action
    public reset = (errorsOnly = false) => {
        if (!errorsOnly) {
            this.flowInfoGeneration++;
            this.info = {};
            this.resetFee();
            // close before dropping the references: a remote LND socket
            // left open keeps answering for the node it was opened on, and
            // an embedded listener left attached doubles every event once
            // the next connect adds its own
            const { channelAcceptor, customMessagesSubscriber } = this;
            this.channelAcceptor = undefined;
            this.customMessagesSubscriber = undefined;
            this.customMessagesReady = false;
            this.customMessagesGeneration++;
            this.closeSubscription(channelAcceptor);
            this.closeSubscription(customMessagesSubscriber);
            // lease data and fetch errors belong to the previous node, and a
            // reply still in flight must not land on the next one
            this.getExtendableChannelsNativeRequestId++;
            this.getExtendableChannelsResponseResolver?.();
            delete this.customMessageRequestPeers[this.getExtendableChannelsId];
            this.getExtendableChannelsId = '';
            this.getExtendableChannelsData = [];
            this.getExtendableChannelsError = false;
        }
        this.error = false;
        this.error_msg = '';
        this.flow_error = false;
        this.flow_error_msg = '';
        this.showLspSettings = false;
    };

    private closeSubscription = (subscription: any) => {
        try {
            if (typeof subscription?.close === 'function') {
                subscription.close();
            } else if (typeof subscription?.remove === 'function') {
                subscription.remove();
            }
        } catch (error: any) {
            console.log('LSPStore: could not close subscription', error);
        }
    };

    // Also drops the answer to any fee request still in flight.
    @action
    public resetFee = () => {
        this.feeRequestId++;
        this.clearFee();
    };

    // Clears the shown quote and error but lets a fee request in flight
    // finish, for invoices that don't use the LSP: one created in the
    // background (NWC, Cashu) must not stop an LSP invoice that is waiting
    // for its quote.
    @action
    public clearFee = () => {
        this.zeroConfFee = undefined;
        this.feeId = undefined;
        this.flow_error = false;
        this.flow_error_msg = '';
        this.showLspSettings = false;
    };

    @action
    public resetLSPS1Data = () => {
        this.stopFreeOrderStatusPolling();
        this.getInfoResponseResolver?.();
        this.createOrderResponseResolver?.();
        // Invalidate in-flight request ids so a late response or send failure
        // can't write into the next screen's state.
        delete this.customMessageRequestPeers[this.getInfoId];
        delete this.customMessageRequestPeers[this.createOrderId];
        delete this.customMessageRequestPeers[this.getOrderId];
        this.getInfoId = '';
        this.createOrderId = '';
        this.createOrderResponse = {};
        this.getInfoData = {};
        this.loadingLSPS1 = false;
        this.error = false;
        this.error_msg = '';
    };

    @action
    public resetLSPS7Data = () => {
        this.stopFreeOrderStatusPolling();
        this.createExtensionOrderResponseResolver?.();
        delete this.customMessageRequestPeers[this.createExtensionOrderId];
        delete this.customMessageRequestPeers[this.getExtensionOrderId];
        this.createExtensionOrderId = '';
        this.createExtensionOrderResponse = {};
        this.loadingLSPS7 = false;
        this.error = false;
        this.error_msg = '';
    };

    @action
    public clearLSPS7Order = () => {
        this.stopFreeOrderStatusPolling();
        this.createExtensionOrderResponse = {};
    };

    public saveOrderToHistory = async (
        orderResponse: any,
        service: 'LSPS1' | 'LSPS7'
    ): Promise<void> => {
        const result = orderResponse?.result || orderResponse;
        const orderId = result?.order_id;
        if (!orderId) return;

        try {
            const responseArrayString = await Storage.getItem(LSPS_ORDERS_KEY);
            const responseArray: any[] = responseArrayString
                ? JSON.parse(responseArrayString)
                : [];

            const exists = responseArray.some((response: any) => {
                const stored = JSON.parse(response);
                const storedId =
                    stored.order?.order_id || stored.order?.result?.order_id;
                return storedId === orderId;
            });
            if (exists) return;

            const orderData: any = {
                order: orderResponse,
                clientPubkey: this.nodeInfoStore.nodeInfo?.nodeId,
                service
            };

            if (service === 'LSPS1' && BackendUtils.supportsLSPS1native()) {
                orderData.native = true;
            } else if (BackendUtils.supportsLSPScustomMessage()) {
                orderData.peer = this.getLSPSPubkey();
                orderData.uri = `${this.getLSPSPubkey()}@${this.getLSPSHost()}`;
            }
            if (service === 'LSPS1' && BackendUtils.supportsLSPS1rest()) {
                orderData.endpoint = this.getLSPS1Rest();
            }

            responseArray.push(JSON.stringify(orderData));
            await Storage.setItem(LSPS_ORDERS_KEY, responseArray);
        } catch (error) {
            console.error(`Error saving ${service} order:`, error);
        }
    };

    private getLspConfig = () =>
        getLspConfigForNetwork(
            this.settingsStore.settings,
            this.nodeInfoStore!.nodeInfo
        );

    // Each service answers for the transport it actually uses: LSPS7 runs
    // over native or custom messages, both keyed off the LSP pubkey, while
    // LSPS1 picks native, then REST, then custom messages.
    public isOlympus = (service: LSPService = LSPService.LSPS1) => {
        const config = this.getLspConfig();
        const usesDefaultPubkey = this.getLSPSPubkey() === config.defaultPubkey;

        if (service === LSPService.LSPS7) {
            return usesDefaultPubkey;
        }

        if (BackendUtils.supportsLSPS1native()) {
            return usesDefaultPubkey;
        }

        if (BackendUtils.supportsLSPS1rest()) {
            return this.getLSPS1Rest() === config.defaultLsps1Rest;
        }

        if (BackendUtils.supportsLSPScustomMessage()) {
            return usesDefaultPubkey;
        }

        return false;
    };

    private getFlowHost = () => this.getLspConfig().flowHost;

    public getLSPSPubkey = () => this.getLspConfig().lsps1Pubkey;

    public getLSPSHost = () => this.getLspConfig().lsps1Host;

    public getLSPS1Rest = () => this.getLspConfig().lsps1Rest;

    private encodeMessage = (n: any) =>
        Buffer.from(JSON.stringify(n)).toString('hex');

    private getClientInfo = () =>
        getClientInfo(
            this.settingsStore.implementation,
            this.nodeInfoStore?.nodeInfo?.version
        );

    // Flow 2.0

    // Prefer the LSP's own error message, then the raw response body,
    // before settling for a bare HTTP status, so the real rejection
    // reason isn't swallowed.
    private formatFlowError = (response: any, status: number, data?: any) => {
        const prefix = localeString('stores.LSPStore.error');
        const message = data?.message || data?.error;
        if (message) {
            return `${prefix}: ${errorToUserFriendly(message)}`;
        }
        let body = '';
        try {
            body = response.text()?.toString().trim();
        } catch (e) {}
        // require some real content — an empty JSON body like `{}` tells
        // the user nothing more than the status code does
        if (body && body.length <= 200 && /[A-Za-z0-9]/.test(body)) {
            return `${prefix}: ${body}`;
        }
        return `${prefix}: HTTP ${status}`;
    };

    // Rejects without writing anything if reset() ran or a newer request
    // started while the request was in flight. After reset() the reply
    // belongs to the previous connection, and the caller no longer waits for
    // it before the next connect resets the store. Each wallet refresh starts
    // a request without waiting for the last one, so a timeout from an older
    // request could otherwise land after a newer success and set flow_error
    public getLSPInfo = () => {
        const generation = ++this.flowInfoGeneration;
        const isCurrent = () => this.flowInfoGeneration === generation;
        return new Promise((resolve, reject) => {
            ReactNativeBlobUtil.fetch(
                'get',
                `${this.getFlowHost()}/api/v1/info`,
                { 'Content-Type': 'application/json' }
            )
                .then(async (response: any) => {
                    if (!isCurrent()) {
                        reject();
                        return;
                    }
                    const status = response.info().status;
                    let data: any;
                    try {
                        data = response.json();
                    } catch (jsonErr) {
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = this.formatFlowError(
                                response,
                                status
                            );
                        });
                        reject();
                        return;
                    }
                    if (status == 200) {
                        this.info = data;
                        resolve(this.info);

                        const method =
                            this.info.connection_methods &&
                            this.info.connection_methods[0];

                        // an incomplete connection method would produce a
                        // non-empty but undialable host like 'undefined:9735'
                        if (method?.address && method?.port) {
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
                        }
                    } else {
                        const errorMsg = this.formatFlowError(
                            response,
                            status,
                            data
                        );
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = errorMsg;
                            // handle LSP geoblocking :(
                            if (
                                errorMsg.includes('unavailable in your country')
                            ) {
                                this.showLspSettings = true;
                            }
                        });
                        reject();
                    }
                })
                .catch(() => {
                    if (!isCurrent()) {
                        reject();
                        return;
                    }
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

    // Flow LSP setup run by the wallet on every fetch. The LSP info request
    // isn't awaited: a host that drops packets holds it until the 60s
    // HTTP timeout, and the fetch lock and deep link handling would wait
    // on it. The channel acceptor reads the LSP pubkey per request, so it
    // doesn't need the reply first. getLSPInfo rejects when the LSP can't
    // be reached, answers with an error (including the geoblock reply) or
    // returns a non-JSON body, and records the error in flow_error for
    // the UI. Remote LND over Tor skips the request: it goes over
    // clearnet and would send the device IP to the Flow host on every
    // startup (#4372)
    public initFlowLSP = () => {
        if (!BackendUtils.supportsFlowLSP()) return;

        const { implementation, settings, enableTor } = this.settingsStore;
        if (
            settings.enableLSP &&
            (implementation !== 'lnd' ||
                (!enableTor &&
                    !this.nodeInfoStore.flowLspNotConfigured()
                        .flowLspNotConfigured))
        ) {
            this.getLSPInfo().catch(() => {
                // getLSPInfo rejects without a reason; the message is in
                // flow_error_msg
                console.warn(
                    'Failed to fetch Flow LSP info:',
                    this.flow_error_msg
                );
            });
        }
        if (BackendUtils.supportsLSPScustomMessage()) {
            this.subscribeCustomMessages().catch((error: any) =>
                console.error(
                    'Failed to subscribe to custom messages:',
                    error?.message
                )
            );
        }
        this.initChannelAcceptor().catch((error: any) =>
            console.error('Failed to start channel acceptor:', error?.message)
        );
    };

    // isCurrent: an invoice request passes whether it is still the
    // latest one, so a quote or error that arrives after it was superseded
    // is not stored
    @action
    public getZeroConfFee = (
        amount_msat: number,
        isCurrent: () => boolean = () => true
    ) => {
        const { settings } = this.settingsStore;
        const requestId = ++this.feeRequestId;

        return new Promise<ZeroConfFeeQuote>((resolve, reject) => {
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
                    // superseded by a newer fee request, a reset or a newer
                    // invoice request
                    if (requestId !== this.feeRequestId || !isCurrent()) {
                        reject();
                        return;
                    }
                    const status = response.info().status;
                    let data: any;
                    try {
                        data = response.json();
                    } catch (jsonErr) {
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = this.formatFlowError(
                                response,
                                status
                            );
                        });
                        reject();
                        return;
                    }
                    if (status == 200) {
                        const quote: ZeroConfFeeQuote = {
                            feeSats:
                                data.fee_amount_msat !== undefined
                                    ? Number.parseInt(
                                          (
                                              Number(data.fee_amount_msat) /
                                              1000
                                          ).toString()
                                      )
                                    : undefined,
                            feeId: data.id
                        };
                        // not stored, so no screen shows it as the fee
                        if (
                            quote.feeSats !== undefined &&
                            !(quote.feeSats >= 0)
                        ) {
                            runInAction(() => {
                                this.flow_error = true;
                                this.flow_error_msg = localeString(
                                    'stores.LSPStore.getInfoResponseError'
                                );
                            });
                            reject();
                            return;
                        }
                        runInAction(() => {
                            this.zeroConfFee = quote.feeSats;
                            this.feeId = quote.feeId;
                            this.flow_error = false;
                        });
                        resolve(quote);
                    } else {
                        runInAction(() => {
                            this.flow_error = true;
                            this.flow_error_msg = this.formatFlowError(
                                response,
                                status,
                                data
                            );
                        });
                        reject();
                    }
                })
                .catch(() => {
                    if (requestId === this.feeRequestId && isCurrent()) {
                        runInAction(() => {
                            this.flow_error = true;
                        });
                    }
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
                        if (event?.error_code || event?.error_desc) {
                            console.error(
                                'ChannelAcceptor stream error, will retry on next fetch'
                            );
                            this.channelAcceptor?.remove();
                            this.channelAcceptor = null;
                            return;
                        }

                        if (!event?.data) return;

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

            await this.startEmbeddedStream(
                () => channel.channelAcceptor(),
                'channelAcceptor'
            );
        } else {
            // Only allow 0-conf chans from LSP or whitelisted peers
            const ws = BackendUtils.initChanAcceptor({
                getZeroConfPeers: () =>
                    this.settingsStore?.settings?.zeroConfPeers,
                getLspPubkey: () => this.info?.pubkey
            });
            this.keepSocket(ws, 'channelAcceptor');
        }
    };

    // Remote LND opens a WebSocket per subscription. lnd asks every open
    // channel acceptor and rejects the channel if any of them does, and
    // each custom message subscription delivers every message, so keep one
    // of each and open a new one on the next fetch after it closes
    private keepSocket = (
        ws: any,
        key: 'channelAcceptor' | 'customMessagesSubscriber'
    ) => {
        if (!ws?.addEventListener) return;
        this[key] = ws;
        let opened = false;
        ws.addEventListener('open', () => {
            opened = true;
        });
        const release = () => {
            if (this[key] !== ws) return;
            this[key] = null;
            if (key !== 'customMessagesSubscriber') return;
            if (opened) {
                this.customMessagesReady = false;
            } else {
                this.onCustomMessagesFailed();
            }
        };
        ws.addEventListener('error', release);
        ws.addEventListener('close', release);
    };

    // Embedded LND sets the listener before starting the native stream. If
    // the start fails, remove the listener so the guard doesn't block the
    // retry on the next fetch
    private startEmbeddedStream = async (
        start: () => Promise<any>,
        key: 'channelAcceptor' | 'customMessagesSubscriber'
    ) => {
        const listener = this[key];
        try {
            await start();
        } catch (error) {
            listener?.remove();
            if (this[key] === listener) this[key] = null;
            throw error;
        }
    };

    // quote is the one bolt11 was priced with. The caller passes it so a
    // quote that has replaced zeroConfFee/feeId since can't change the
    // fee_id sent or move the verification bound. isCurrent: whether the
    // invoice request is still the latest one; the flow error fields are
    // only written while it is.
    @action
    public getZeroConfInvoice = (
        bolt11: string,
        quote: PricedZeroConfFeeQuote,
        isCurrent: () => boolean = () => true
    ) => {
        if (isCurrent()) {
            this.flow_error = false;
            this.flow_error_msg = '';
            this.showLspSettings = false;
        }
        const setError = (update: () => void) => {
            if (isCurrent()) runInAction(update);
        };

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
                    fee_id: quote.feeId,
                    simpleTaproot:
                        settings.requestSimpleTaproot &&
                        BackendUtils.supportsSimpleTaprootChannels(),
                    client_info: this.getClientInfo()
                })
            )
                .then(async (response: any) => {
                    const status = response.info().status;
                    let data: any;
                    try {
                        data = response.json();
                    } catch (jsonErr) {
                        setError(() => {
                            this.flow_error = true;
                            this.flow_error_msg = this.formatFlowError(
                                response,
                                status
                            );
                        });
                        reject();
                        return;
                    }
                    if (status == 200 || status == 201) {
                        if (
                            !data.jit_bolt11 ||
                            typeof data.jit_bolt11 !== 'string'
                        ) {
                            setError(() => {
                                this.flow_error = true;
                                this.flow_error_msg = localeString(
                                    'stores.LSPStore.missingWrappedInvoice'
                                );
                            });
                            reject();
                            return;
                        }
                        const check = verifyWrappedInvoice(
                            bolt11,
                            data.jit_bolt11,
                            quote.feeSats
                        );
                        if (!check.valid) {
                            setError(() => {
                                this.flow_error = true;
                                this.flow_error_msg = `${localeString(
                                    'stores.LSPStore.wrappedInvoiceVerificationFailed'
                                )} (${check.error})`;
                            });
                            reject();
                            return;
                        }
                        resolve(data.jit_bolt11);
                    } else {
                        setError(() => {
                            this.flow_error = true;
                            this.flow_error_msg = this.formatFlowError(
                                response,
                                status,
                                data
                            );
                            if (
                                data?.message &&
                                data.message.includes('access key')
                            ) {
                                this.showLspSettings = true;
                            }
                        });
                        reject();
                    }
                })
                .catch(() => {
                    setError(() => {
                        this.flow_error = true;
                    });
                    reject();
                });
        });
    };

    // LSPS0

    @action
    public sendCustomMessage = ({
        peer,
        type,
        data,
        isCurrent = () => true
    }: {
        peer: string;
        type: number | null;
        data: string;
        // lets a caller drop the error write for a request that has since been
        // superseded or reset
        isCurrent?: () => boolean;
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
                    if (isCurrent()) {
                        const errorMsg = errorToUserFriendly(error);
                        runInAction(() => {
                            this.error = true;
                            this.error_msg = errorMsg;
                        });
                    }
                    reject(error);
                });
        });
    };

    @action
    public handleCustomMessages = (decoded: any): boolean => {
        if (!decoded?.peer || !decoded?.data) return false;
        let data: any;
        try {
            data = JSON.parse(Base64Utils.base64ToUtf8(decoded.data));
        } catch (parseError: any) {
            console.warn(
                'Custom message data is not valid JSON, skipping:',
                parseError?.message
            );
            return false;
        }
        // request ids are reset to '' and start out undefined
        if (!data?.id) return false;
        const peer = Base64Utils.base64ToHex(decoded.peer);

        console.log('Received custom message', { peer, data });

        // a reply is only accepted from the peer its request was sent to
        if (this.customMessageRequestPeers[data.id] !== peer) return false;
        delete this.customMessageRequestPeers[data.id];

        if (data.id === this.getInfoId) {
            if (data.error) {
                const message =
                    data?.error?.data?.message || data?.error?.message;
                this.error = true;
                this.error_msg = message
                    ? errorToUserFriendly(message)
                    : localeString('stores.LSPStore.getInfoResponseError');
            } else {
                this.getInfoData = data;
            }
            this.loadingLSPS1 = false;
            this.getInfoResponseResolver?.();
            return true;
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
            this.createOrderResponseResolver?.();
            return true;
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
            this.getOrderResponseResolver?.();
            return true;
        } else if (data.id === this.getExtendableChannelsId) {
            if (data.error) {
                console.error(
                    'Error fetching LSPS7 extendable channels:',
                    data.error
                );
                this.getExtendableChannelsError = true;
            } else {
                const extendableChannels = data?.result?.extendable_channels;
                if (Array.isArray(extendableChannels)) {
                    this.getExtendableChannelsError = false;
                    this.getExtendableChannelsData =
                        extendableChannels.filter(isExtendableChannel);
                } else {
                    // an answer without a list has nothing to show, so it
                    // counts as a failed fetch like an error reply and
                    // keeps the previous list
                    console.error(
                        'LSPS7 extendable channels answer is not a list:',
                        extendableChannels
                    );
                    this.getExtendableChannelsError = true;
                }
            }
            this.getExtendableChannelsResponseResolver?.();
            return true;
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
            this.createExtensionOrderResponseResolver?.();
            return true;
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
            this.getExtensionOrderResponseResolver?.();
            return true;
        }
        return false;
    };

    // Establishes the long-lived custom-message listener for the app session.
    // This only wires up delivery of incoming messages; it does not track
    // whether any particular request is still awaited. Each request method
    // (e.g. lsps1GetInfoCustomMessage) arms and clears its own timeout so a
    // non-responding LSP is caught per-request, not just on the first
    // subscription of the session.
    @action
    public subscribeCustomMessages = async () => {
        if (this.customMessagesSubscriber) return;

        if (this.settingsStore.implementation === 'embedded-lnd') {
            this.customMessagesSubscriber = LndMobileEventEmitter.addListener(
                'SubscribeCustomMessages',
                async (event: any) => {
                    if (!event?.data) return;
                    try {
                        const decoded = index.decodeCustomMessage(event.data);
                        runInAction(() => this.handleCustomMessages(decoded));
                    } catch (error: any) {
                        console.error(
                            'sub custom messages error: ' + error.message
                        );
                    }
                }
            );

            const listener = this.customMessagesSubscriber;
            const generation = this.customMessagesGeneration;
            try {
                await this.startEmbeddedStream(
                    () => index.subscribeCustomMessages(),
                    'customMessagesSubscriber'
                );
            } catch (error) {
                // reset() may have run while the stream started
                if (this.customMessagesGeneration === generation) {
                    this.onCustomMessagesFailed();
                }
                throw error;
            }
            // reset() may have dropped this listener while the stream started
            if (this.customMessagesSubscriber === listener) {
                this.onCustomMessagesReady();
            }
        } else {
            const ws = BackendUtils.subscribeCustomMessages(
                (response: any) => {
                    const decoded = response.result;
                    runInAction(() => this.handleCustomMessages(decoded));
                },
                // LND.ts passes a string (the certificate warning) when the
                // socket errors, and the stream's error object when the
                // server sends one.
                (error: any) => {
                    console.error(
                        'sub custom messages error: ' +
                            (typeof error === 'string' ? error : error?.message)
                    );
                }
            );
            if (!ws?.addEventListener) {
                // LNC delivers through its own native listener; there is no
                // socket to wait on. Each LSPS1 screen visit subscribes
                // again, so only the first one starts a lease fetch.
                if (!this.customMessagesReady) this.onCustomMessagesReady();
                return;
            }
            this.keepSocket(ws, 'customMessagesSubscriber');
            if (this.customMessagesSubscriber === ws) {
                ws.addEventListener('open', () => {
                    if (this.customMessagesSubscriber === ws) {
                        this.onCustomMessagesReady();
                    }
                });
            }
        }
    };

    // LSPS1

    public lsps1GetInfoREST = () => {
        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

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
                        let serverMessage;
                        try {
                            const responseData = JSON.parse(response.data);
                            serverMessage =
                                responseData?.message ||
                                responseData?.error?.message;
                        } catch (e) {}

                        this.error = true;
                        this.error_msg =
                            serverMessage ||
                            localeString(
                                'stores.LSPStore.getInfoResponseError'
                            );
                        this.loadingLSPS1 = false;
                    }
                });
            })
            .catch(() => {
                runInAction(() => {
                    this.error = true;
                    this.error_msg = localeString(
                        'stores.LSPStore.getInfoNetworkError'
                    );
                    this.loadingLSPS1 = false;
                });
            });
    };

    @action
    public lsps1GetInfoCustomMessage = (): Promise<void> => {
        // Settle any earlier get_info request still waiting so its timer
        // can't fire a stale timeout after this newer request completes.
        this.getInfoResponseResolver?.();

        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        this.getInfoId = uuidv4();
        const requestId = this.getInfoId;
        this.customMessageRequestPeers[requestId] = this.getLSPSPubkey();
        const method = 'lsps1.get_info';

        return new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (this.getInfoResponseResolver === settle) {
                    this.getInfoResponseResolver = null;
                }
                resolve();
            };
            const timeoutId = setTimeout(() => {
                if (this.getInfoId === requestId) {
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = localeString(
                            'views.LSPS1.timeoutError'
                        );
                        this.loadingLSPS1 = false;
                    });
                }
                settle();
            }, CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS);
            this.getInfoResponseResolver = settle;

            this.sendCustomMessage({
                isCurrent: () => this.getInfoId === requestId,
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
                    if (this.getInfoId === requestId) {
                        runInAction(() => {
                            this.error = true;
                            this.error_msg = errorToUserFriendly(error);
                            this.loadingLSPS1 = false;
                        });
                    }
                    settle();
                });
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
            public_key: this.nodeInfoStore.nodeInfo.nodeId,
            client_info: this.getClientInfo()
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
    public lsps1CreateOrderCustomMessage = (state: any): Promise<void> => {
        // Settle any earlier create_order request still waiting so its timer
        // can't fire a stale timeout after this newer request completes.
        this.createOrderResponseResolver?.();

        this.loadingLSPS1 = true;
        this.error = false;
        this.error_msg = '';

        this.createOrderId = uuidv4();
        const requestId = this.createOrderId;
        this.customMessageRequestPeers[requestId] = this.getLSPSPubkey();
        const method = 'lsps1.create_order';

        return new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (this.createOrderResponseResolver === settle) {
                    this.createOrderResponseResolver = null;
                }
                resolve();
            };
            const timeoutId = setTimeout(() => {
                if (this.createOrderId === requestId) {
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = localeString(
                            'views.LSPS1.timeoutError'
                        );
                        this.loadingLSPS1 = false;
                    });
                }
                settle();
            }, CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS);
            this.createOrderResponseResolver = settle;

            this.sendCustomMessage({
                isCurrent: () => this.createOrderId === requestId,
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
                        announce_channel: state.announceChannel,
                        client_info: this.getClientInfo()
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
                    if (this.createOrderId === requestId) {
                        runInAction(() => {
                            this.error = true;
                            this.error_msg = errorToUserFriendly(error);
                            this.loadingLSPS1 = false;
                        });
                    }
                    settle();
                });
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
    public lsps1GetOrderCustomMessage(
        orderId: string,
        peer: string
    ): Promise<void> {
        this.loadingLSPS1 = true;

        this.getOrderId = uuidv4();
        this.customMessageRequestPeers[this.getOrderId] = peer;
        const method = 'lsps1.get_order';

        return new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                this.getOrderResponseResolver = null;
                resolve();
            };
            const timeoutId = setTimeout(
                settle,
                CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS
            );
            this.getOrderResponseResolver = settle;

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
                    settle();
                });
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

    // Background fetch run when the channel list changes. Failures only set
    // getExtendableChannelsError, which the channel view reads, and neither
    // the shared error nor loadingLSPS7 is touched, so a channel refresh
    // can't replace or clear an error or spinner the LSPS1 or LSPS7 screens
    // are showing.
    @action
    public getExtendableChannels = async () => {
        // Use native LSPS7 method if available (LDK Node backend)
        if (BackendUtils.supportsLSPS7native()) {
            // The channels reaction can start a new call before the last one
            // settles, so only the latest call writes its result
            const requestId = ++this.getExtendableChannelsNativeRequestId;
            const isCurrent = () =>
                requestId === this.getExtendableChannelsNativeRequestId;
            try {
                const channels =
                    await BackendUtils.lsps7GetExtendableChannels();
                if (!isCurrent()) return;
                // Normalize camelCase keys from native module to snake_case
                // to match the JSON-RPC custom message format
                runInAction(() => {
                    this.getExtendableChannelsError = false;
                    this.getExtendableChannelsData = channels.map(
                        (ch: any) => ({
                            short_channel_id: ch.shortChannelId,
                            max_channel_extension_expiry_blocks:
                                ch.maxChannelExtensionExpiryBlocks,
                            expiration_block: ch.expirationBlock,
                            original_order: ch.originalOrder,
                            extension_order_ids: ch.extensionOrderIds
                        })
                    );
                });
                return;
            } catch (error: any) {
                if (!isCurrent()) return;
                console.error(
                    'Error fetching LSPS7 extendable channels:',
                    error
                );
                runInAction(() => {
                    this.getExtendableChannelsError = true;
                });
                return;
            }
        }

        // Fall back to custom message for other backends. Starting a new
        // probe settles the previous one without marking it failed.
        this.getExtendableChannelsResponseResolver?.();

        this.getExtendableChannelsId = uuidv4();
        this.customMessageRequestPeers[this.getExtendableChannelsId] =
            this.getLSPSPubkey();
        const method = 'lsps7.get_extendable_channels';

        await new Promise<void>((resolve) => {
            let settled = false;
            const settle = (failed = false) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (this.getExtendableChannelsResponseResolver === settle) {
                    this.getExtendableChannelsResponseResolver = null;
                    if (failed) {
                        runInAction(() => {
                            this.getExtendableChannelsError = true;
                        });
                    }
                }
                resolve();
            };
            const timeoutId = setTimeout(() => {
                console.error(`Timed out waiting for (${method}) response`);
                settle(true);
            }, CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS);
            this.getExtendableChannelsResponseResolver = settle;

            this.sendCustomMessage({
                peer: this.getLSPSPubkey(),
                type: CUSTOM_MESSAGE_TYPE,
                isCurrent: () => false,
                data: this.encodeMessage({
                    jsonrpc: JSON_RPC_VERSION,
                    method,
                    params: {},
                    id: this.getExtendableChannelsId
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
                    settle(true);
                });
        });
    };

    @action
    public lsps7CreateOrderCustomMessage = async (state: any) => {
        this.loadingLSPS7 = true;
        this.error = false;
        this.error_msg = '';

        // Use native LSPS7 method if available (LDK Node backend)
        if (BackendUtils.supportsLSPS7native()) {
            try {
                const response = await BackendUtils.lsps7CreateOrder({
                    shortChannelId: state.chanId,
                    channelExtensionExpiryBlocks: state.channelExtensionBlocks,
                    token: state.token,
                    refundOnchainAddress: state.refundOnchainAddress
                });
                runInAction(() => {
                    this.createExtensionOrderResponse = { result: response };
                    this.loadingLSPS7 = false;
                });
                return;
            } catch (error: any) {
                runInAction(() => {
                    this.error = true;
                    this.error_msg =
                        error?.message || localeString('error.createOrder');
                    this.loadingLSPS7 = false;
                });
                return;
            }
        }

        // Fall back to custom message for other backends
        // Settle any earlier create_order request still waiting so its timer
        // can't fire a stale timeout after this newer request completes.
        this.createExtensionOrderResponseResolver?.();

        this.createExtensionOrderId = uuidv4();
        const requestId = this.createExtensionOrderId;
        this.customMessageRequestPeers[requestId] = this.getLSPSPubkey();
        const method = 'lsps7.create_order';

        await new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                if (this.createExtensionOrderResponseResolver === settle) {
                    this.createExtensionOrderResponseResolver = null;
                }
                resolve();
            };
            const timeoutId = setTimeout(() => {
                if (this.createExtensionOrderId === requestId) {
                    runInAction(() => {
                        this.error = true;
                        this.error_msg = localeString(
                            'views.LSPS1.timeoutError'
                        );
                        this.loadingLSPS7 = false;
                    });
                }
                settle();
            }, CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS);
            this.createExtensionOrderResponseResolver = settle;

            this.sendCustomMessage({
                isCurrent: () => this.createExtensionOrderId === requestId,
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
                        refund_onchain_address: state.refundOnchainAddress,
                        client_info: this.getClientInfo()
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
                    if (this.createExtensionOrderId === requestId) {
                        runInAction(() => {
                            this.error = true;
                            this.error_msg = errorToUserFriendly(error);
                            this.loadingLSPS7 = false;
                        });
                    }
                    settle();
                });
        });
    };

    @action
    public lsps7GetOrderCustomMessage = async (
        orderId: string,
        peer: string
    ) => {
        this.loadingLSPS7 = true;

        // Use native LSPS7 method if available (LDK Node backend)
        if (BackendUtils.supportsLSPS7native()) {
            try {
                const response = await BackendUtils.lsps7CheckOrderStatus(
                    orderId
                );
                runInAction(() => {
                    this.getExtensionOrderResponse = { result: response };
                    this.loadingLSPS7 = false;
                });
                return;
            } catch (error: any) {
                runInAction(() => {
                    this.error = true;
                    this.error_msg =
                        error?.message || localeString('error.getOrderStatus');
                    this.loadingLSPS7 = false;
                });
                return;
            }
        }

        // Fall back to custom message for other backends
        this.getExtensionOrderId = uuidv4();
        this.customMessageRequestPeers[this.getExtensionOrderId] = peer;
        const method = 'lsps7.get_order';

        await new Promise<void>((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                this.getExtensionOrderResponseResolver = null;
                resolve();
            };
            const timeoutId = setTimeout(
                settle,
                CUSTOM_MESSAGE_RESPONSE_TIMEOUT_MS
            );
            this.getExtensionOrderResponseResolver = settle;

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
                    settle();
                });
        });
    };

    public startFreeOrderStatusPolling = (
        orderId: string,
        service: LSPService
    ) => {
        if (this.freeOrderPollId === orderId) return;
        this.stopFreeOrderStatusPolling();
        this.freeOrderPollId = orderId;
        const sessionId = ++this.freeOrderPollSessionId;
        this.pollFreeOrderStatus(orderId, service, sessionId);
    };

    public stopFreeOrderStatusPolling = () => {
        this.freeOrderPollId = null;
        this.freeOrderPollSessionId++;
        if (this.freeOrderPollTimer) {
            clearTimeout(this.freeOrderPollTimer);
            this.freeOrderPollTimer = null;
        }
    };

    private pollFreeOrderStatus = async (
        orderId: string,
        service: LSPService,
        sessionId: number
    ) => {
        if (this.freeOrderPollSessionId !== sessionId) return;

        try {
            if (service === LSPService.LSPS7) {
                await this.lsps7GetOrderCustomMessage(
                    orderId,
                    this.getLSPSPubkey()
                );
            } else if (BackendUtils.supportsLSPS1rest()) {
                await this.lsps1GetOrderREST(orderId, this.getLSPS1Rest());
            } else if (BackendUtils.supportsLSPScustomMessage()) {
                await this.lsps1GetOrderCustomMessage(
                    orderId,
                    this.getLSPSPubkey()
                );
            } else {
                return;
            }

            if (this.freeOrderPollSessionId !== sessionId) return;

            const response =
                service === LSPService.LSPS7
                    ? this.getExtensionOrderResponse
                    : this.getOrderResponse;
            if (response && Object.keys(response).length > 0) {
                const result = response?.result || response;
                if (
                    result?.order_state === LSPOrderState.COMPLETED ||
                    result?.order_state === LSPOrderState.FAILED
                ) {
                    runInAction(() => {
                        if (service === LSPService.LSPS7) {
                            this.createExtensionOrderResponse = response;
                        } else {
                            this.createOrderResponse = response;
                        }
                    });
                    this.updateOrderInStorage(response);
                    this.stopFreeOrderStatusPolling();
                    return;
                }
            }
        } catch (error) {
            console.error('LSPStore: free order poll error', error);
        }

        if (this.freeOrderPollSessionId !== sessionId) return;
        this.freeOrderPollTimer = setTimeout(
            () => this.pollFreeOrderStatus(orderId, service, sessionId),
            FREE_ORDER_POLL_INTERVAL_MS
        );
    };

    public updateOrderInStorage(order: any) {
        Storage.getItem(LSPS_ORDERS_KEY)
            .then((responseArrayString) => {
                if (!responseArrayString) return;
                const responseArray = JSON.parse(responseArrayString);
                const index = responseArray.findIndex((response: any) => {
                    const decodedResponse = JSON.parse(response);
                    const result =
                        decodedResponse?.order?.result ||
                        decodedResponse?.order;
                    const currentOrderResult = order?.result || order;
                    return result?.order_id === currentOrderResult?.order_id;
                });
                if (index !== -1) {
                    const oldOrder = JSON.parse(responseArray[index]);
                    oldOrder.order = order;
                    responseArray[index] = JSON.stringify(oldOrder);
                    Storage.setItem(LSPS_ORDERS_KEY, responseArray);
                }
            })
            .catch((error) => {
                console.error(
                    'LSPStore: error updating order in storage',
                    error
                );
            });
    }
}
