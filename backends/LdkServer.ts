import ReactNativeBlobUtil from 'react-native-blob-util';
import BigNumber from 'bignumber.js';
import { createHmac } from 'crypto';
import Long from 'long';

import { api, events, types } from '../proto/ldkserver';
import { settingsStore } from '../stores/Stores';
import Base64Utils from '../utils/Base64Utils';
import OpenChannelRequest from '../models/OpenChannelRequest';

const SERVICE_PREFIX = '/api.LightningNode/';
const DEFAULT_PORT = '3536';
const REQUEST_TIMEOUT_MS = 30000;

const toPlainObject = (message: any, response: any) =>
    response.toObject(message, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: false
    });

const msatToSat = (msat: any) =>
    new BigNumber(msat || 0)
        .dividedBy(1000)
        .integerValue(BigNumber.ROUND_FLOOR)
        .toString();

const toUInt64 = (value: any) => Long.fromString(String(value), true);

const satsToMsatLong = (sats: any) =>
    Long.fromString(new BigNumber(sats || 0).times(1000).toFixed(0), true);

const headerValue = (headers: any, key: string) => {
    const foundKey = Object.keys(headers || {}).find(
        (header) => header.toLowerCase() === key.toLowerCase()
    );
    return foundKey ? headers[foundKey] : undefined;
};

type EventCallback = (event: any) => void;

export default class LdkServer {
    private eventLoopRunning = false;
    private eventCallbacks: EventCallback[] = [];
    private eventErrorCallbacks: EventCallback[] = [];
    private eventAbortController: any = null;
    private eventStreamingUnavailable = false;

    private encodeGrpcFrame = (message: Uint8Array): Uint8Array => {
        const frame = new Uint8Array(message.length + 5);
        frame[0] = 0;
        frame[1] = (message.length >>> 24) & 0xff;
        frame[2] = (message.length >>> 16) & 0xff;
        frame[3] = (message.length >>> 8) & 0xff;
        frame[4] = message.length & 0xff;
        frame.set(message, 5);
        return frame;
    };

    private decodeGrpcFrame = (body: Uint8Array): Uint8Array => {
        if (body.length < 5) {
            throw new Error('Invalid ldk-server gRPC response');
        }
        const length =
            (body[1] << 24) | (body[2] << 16) | (body[3] << 8) | body[4];
        return body.slice(5, 5 + length);
    };

    private decodeGrpcFrames = (
        buffer: Uint8Array
    ): { messages: Uint8Array[]; remainder: Uint8Array } => {
        const messages: Uint8Array[] = [];
        let offset = 0;

        while (buffer.length - offset >= 5) {
            const compressed = buffer[offset];
            const length =
                (buffer[offset + 1] << 24) |
                (buffer[offset + 2] << 16) |
                (buffer[offset + 3] << 8) |
                buffer[offset + 4];

            if (compressed) {
                throw new Error('Compressed ldk-server events are unsupported');
            }

            if (buffer.length - offset - 5 < length) break;

            messages.push(buffer.slice(offset + 5, offset + 5 + length));
            offset += 5 + length;
        }

        return { messages, remainder: buffer.slice(offset) };
    };

    private appendBytes = (left: Uint8Array, right: Uint8Array): Uint8Array => {
        if (!left.length) return right;
        const combined = new Uint8Array(left.length + right.length);
        combined.set(left);
        combined.set(right, left.length);
        return combined;
    };

    private getBaseUrl = () => {
        const { host, port } = settingsStore;
        const hostPath = host?.includes('://') ? host : `https://${host}`;
        const url = new URL(hostPath);
        if (!url.port) {
            url.port = port || DEFAULT_PORT;
        }
        return url.toString().replace(/\/$/, '');
    };

    private getAuthHeader = (body: Uint8Array): string => {
        const timestamp = Math.floor(Date.now() / 1000);
        const timestampBytes = Buffer.alloc(8);
        timestampBytes.writeUInt32BE(Math.floor(timestamp / 0x100000000), 0);
        timestampBytes.writeUInt32BE(timestamp >>> 0, 4);
        const hmac = createHmac('sha256', settingsStore.accessKey || '');
        hmac.update(timestampBytes);
        hmac.update(Buffer.from(body));
        return `HMAC ${timestamp}:${hmac.digest('hex')}`;
    };

    private responseBytes = async (response: any): Promise<Uint8Array> => {
        if (typeof response.base64 === 'function') {
            const base64 = await response.base64();
            return Base64Utils.base64ToBytes(base64);
        }
        if (response.data && typeof response.data === 'string') {
            return Uint8Array.from(Buffer.from(response.data, 'binary'));
        }
        return new Uint8Array();
    };

    private grpcUnary = async <Req, Res>({
        method,
        request,
        response,
        data
    }: {
        method: string;
        request: { create: (data: Req) => any; encode: (data: any) => any };
        response: { decode: (data: Uint8Array) => Res; toObject: any };
        data: Req;
    }): Promise<any> => {
        const instance = request.create(data);
        const requestBody = this.encodeGrpcFrame(
            request.encode(instance).finish()
        );
        const url = `${this.getBaseUrl()}${SERVICE_PREFIX}${method}`;
        const headers = {
            'Content-Type': 'application/grpc+proto',
            Accept: 'application/grpc+proto',
            'RNFB-Response': 'base64',
            'x-auth': this.getAuthHeader(requestBody),
            te: 'trailers',
            'grpc-timeout': `${REQUEST_TIMEOUT_MS}m`
        };

        const requestBodyPath = `${
            ReactNativeBlobUtil.fs.dirs.CacheDir
        }/ldk-server-${Date.now()}-${Math.random().toString(36).slice(2)}.grpc`;
        try {
            await ReactNativeBlobUtil.fs.writeFile(
                requestBodyPath,
                Base64Utils.bytesToBase64(requestBody),
                'base64'
            );
            const res = await ReactNativeBlobUtil.config({
                trusty: !settingsStore.certVerification,
                binaryContentTypes: ['application/grpc+proto'],
                timeout: REQUEST_TIMEOUT_MS
            } as any).fetch(
                'POST',
                url,
                headers,
                ReactNativeBlobUtil.wrap(requestBodyPath)
            );
            const status = res.info().status;
            const responseHeaders = res.info().headers || {};
            const grpcStatus = headerValue(responseHeaders, 'grpc-status');
            const grpcMessage = headerValue(responseHeaders, 'grpc-message');
            if (status >= 300) {
                throw new Error(
                    res.data || `ldk-server HTTP ${status} calling ${method}`
                );
            }
            if (grpcStatus && grpcStatus !== '0') {
                throw new Error(
                    grpcMessage
                        ? decodeURIComponent(grpcMessage)
                        : `ldk-server gRPC status ${grpcStatus}`
                );
            }
            const bytes = await this.responseBytes(res);
            if (!bytes.length) {
                throw new Error(
                    `Empty ldk-server response from ${method}${
                        grpcStatus ? `, grpc-status ${grpcStatus}` : ''
                    }`
                );
            }
            const message = response.decode(this.decodeGrpcFrame(bytes));
            return toPlainObject(message, response);
        } catch (error: any) {
            throw new Error(
                `ldk-server ${method} failed: ${
                    error?.message || error?.toString() || error
                }`
            );
        } finally {
            ReactNativeBlobUtil.fs.unlink(requestBodyPath).catch(() => {
                // Best-effort cleanup for the temporary gRPC request body.
            });
        }
    };

    private rpc = (method: string, request: any, response: any, data = {}) =>
        this.grpcUnary({ method, request, response, data });

    subscribeToEvents = (callback: EventCallback): (() => void) => {
        this.eventCallbacks.push(callback);

        if (!this.eventLoopRunning && !this.eventStreamingUnavailable) {
            this.startEventLoop();
        }

        return () => {
            const index = this.eventCallbacks.indexOf(callback);
            if (index > -1) this.eventCallbacks.splice(index, 1);
            if (!this.eventCallbacks.length) this.stopEventLoop();
        };
    };

    private onEventStreamError = (callback: EventCallback): (() => void) => {
        this.eventErrorCallbacks.push(callback);
        return () => {
            const index = this.eventErrorCallbacks.indexOf(callback);
            if (index > -1) this.eventErrorCallbacks.splice(index, 1);
        };
    };

    private startEventLoop = async (): Promise<void> => {
        if (this.eventLoopRunning) return;
        this.eventLoopRunning = true;

        while (this.eventLoopRunning && this.eventCallbacks.length) {
            try {
                await this.streamEvents();
            } catch (e) {
                if (!this.eventLoopRunning) break;
                if (this.eventStreamingUnavailable) {
                    this.eventErrorCallbacks.forEach((callback) => callback(e));
                    break;
                }
                console.error('[LDK Server] Error in event stream:', e);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        this.eventLoopRunning = false;
    };

    private stopEventLoop = (): void => {
        this.eventLoopRunning = false;
        if (this.eventAbortController) {
            this.eventAbortController.abort();
            this.eventAbortController = null;
        }
    };

    private streamEvents = async (): Promise<void> => {
        const Fetch = (globalThis as any).fetch;
        const AbortController = (globalThis as any).AbortController;
        if (!Fetch || !AbortController) {
            this.eventStreamingUnavailable = true;
            throw new Error('Streaming fetch is unavailable');
        }

        const instance = api.SubscribeEventsRequest.create({});
        const requestBody = this.encodeGrpcFrame(
            api.SubscribeEventsRequest.encode(instance).finish()
        );
        const headers = {
            'Content-Type': 'application/grpc+proto',
            Accept: 'application/grpc+proto',
            'x-auth': this.getAuthHeader(requestBody),
            te: 'trailers'
        };
        const controller = new AbortController();
        this.eventAbortController = controller;

        const response = await Fetch(
            `${this.getBaseUrl()}${SERVICE_PREFIX}SubscribeEvents`,
            {
                method: 'POST',
                headers,
                body: requestBody,
                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `ldk-server HTTP ${response.status} streaming events`
            );
        }
        if (!response.body || typeof response.body.getReader !== 'function') {
            this.eventStreamingUnavailable = true;
            throw new Error('Streaming response bodies are unavailable');
        }

        const reader = response.body.getReader();
        let pending = new Uint8Array();

        while (this.eventLoopRunning && this.eventCallbacks.length) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;

            pending = this.appendBytes(pending, value);
            const decoded = this.decodeGrpcFrames(pending);
            pending = decoded.remainder;

            for (const messageBytes of decoded.messages) {
                const message = events.EventEnvelope.decode(messageBytes);
                const event = toPlainObject(message, events.EventEnvelope);
                for (const callback of [...this.eventCallbacks]) {
                    try {
                        callback(event);
                    } catch (e) {
                        console.error(
                            '[LDK Server] Error in event callback:',
                            e
                        );
                    }
                }
            }
        }
    };

    private listPayments = async (): Promise<any[]> => {
        const payments: any[] = [];
        let page_token: any;
        do {
            const res = await this.rpc(
                'ListPayments',
                api.ListPaymentsRequest,
                api.ListPaymentsResponse,
                page_token ? { page_token } : {}
            );
            payments.push(...(res.payments || []));
            page_token = res.next_page_token;
        } while (page_token);
        return payments;
    };

    getMyNodeInfo = async (): Promise<any> => {
        const info = await this.rpc(
            'GetNodeInfo',
            api.GetNodeInfoRequest,
            api.GetNodeInfoResponse
        );
        const network = info.network;
        return {
            identity_pubkey: info.node_id,
            alias: info.node_alias || '',
            block_height: info.current_best_block?.height || 0,
            block_hash: info.current_best_block?.block_hash || '',
            synced_to_chain: !!info.latest_onchain_wallet_sync_timestamp,
            synced_to_graph: !!info.latest_rgs_snapshot_timestamp,
            version: 'ldk-server',
            testnet: network === 'TESTNET' || network === 'TESTNET4',
            regtest: network === 'REGTEST',
            signet: network === 'SIGNET',
            uris: info.node_uris || []
        };
    };

    getNetworkInfo = async (): Promise<any> => {
        const [channels, nodes] = await Promise.all([
            this.rpc(
                'GraphListChannels',
                api.GraphListChannelsRequest,
                api.GraphListChannelsResponse
            ),
            this.rpc(
                'GraphListNodes',
                api.GraphListNodesRequest,
                api.GraphListNodesResponse
            )
        ]);
        return {
            num_channels: (channels.short_channel_ids || []).length,
            num_nodes: (nodes.node_ids || []).length
        };
    };

    getNodeInfo = async (urlParams?: Array<string>): Promise<any> => {
        const nodeId = (urlParams && urlParams[0]) || '';
        const res = await this.rpc(
            'GraphGetNode',
            api.GraphGetNodeRequest,
            api.GraphGetNodeResponse,
            { node_id: nodeId }
        );
        const announcement = res.node?.announcement_info || {};

        return {
            node: {
                pub_key: nodeId,
                alias: announcement.alias || '',
                color: announcement.rgb || '',
                addresses: announcement.addresses || []
            },
            num_channels: (res.node?.channels || []).length,
            total_capacity: '0'
        };
    };

    getBlockchainBalance = async (): Promise<any> => {
        const balances = await this.rpc(
            'GetBalances',
            api.GetBalancesRequest,
            api.GetBalancesResponse
        );
        const unconfirmedBalance = BigNumber.maximum(
            new BigNumber(balances.total_onchain_balance_sats || 0)
                .minus(balances.spendable_onchain_balance_sats || 0)
                .minus(balances.total_anchor_channels_reserve_sats || 0),
            0
        );
        return {
            total_balance: balances.total_onchain_balance_sats || '0',
            confirmed_balance: balances.spendable_onchain_balance_sats || '0',
            unconfirmed_balance: unconfirmedBalance.toString()
        };
    };

    getLightningBalance = async (): Promise<any> => {
        const [channelsResponse, balances, info] = await Promise.all([
            this.rpc(
                'ListChannels',
                api.ListChannelsRequest,
                api.ListChannelsResponse
            ),
            this.rpc(
                'GetBalances',
                api.GetBalancesRequest,
                api.GetBalancesResponse
            ),
            this.rpc(
                'GetNodeInfo',
                api.GetNodeInfoRequest,
                api.GetNodeInfoResponse
            )
        ]);
        const currentBlockHeight = Number(info.current_best_block?.height || 0);
        const channels = channelsResponse.channels || [];
        const activeChannelIds = new Set<string>(
            channels.map((channel: any) => channel.channel_id)
        );
        let localBalance = new BigNumber(0);
        let remoteBalance = new BigNumber(0);
        let pendingOpenBalance = new BigNumber(0);
        let pendingCloseBalance = new BigNumber(0);

        for (const channel of channels) {
            if (channel.is_channel_ready) {
                const balances = this.channelBalances(channel);
                const local = balances.localBalanceSats;
                const remote = balances.remoteBalanceSats;
                localBalance = localBalance.plus(local);
                remoteBalance = remoteBalance.plus(remote);
            } else if (channel.is_outbound) {
                const pendingLocalBalance = new BigNumber(
                    channel.channel_value_sats || 0
                ).minus(
                    channel.counterparty_unspendable_punishment_reserve || 0
                );
                pendingOpenBalance = pendingOpenBalance.plus(
                    BigNumber.maximum(pendingLocalBalance, 0)
                );
            }
        }

        for (const balance of balances.lightning_balances || []) {
            const details = this.lightningBalanceDetails(balance);
            if (!details || details.type === 'claimable_on_channel_close') {
                continue;
            }
            if (
                details.balance.channel_id &&
                activeChannelIds.has(details.balance.channel_id)
            ) {
                continue;
            }
            pendingCloseBalance = pendingCloseBalance.plus(
                details.balance.amount_satoshis || 0
            );
        }

        for (const sweep of balances.pending_balances_from_channel_closures ||
            []) {
            const details = this.pendingSweepDetails(sweep);
            if (!details) continue;
            if (
                details.balance.channel_id &&
                activeChannelIds.has(details.balance.channel_id)
            ) {
                continue;
            }
            if (
                details.type === 'awaiting_threshold_confirmations' &&
                details.balance.confirmation_height != null &&
                Number(details.balance.confirmation_height) <=
                    currentBlockHeight
            ) {
                continue;
            }
            pendingCloseBalance = pendingCloseBalance.plus(
                details.balance.amount_satoshis || 0
            );
        }

        const totalPendingBalance =
            pendingOpenBalance.plus(pendingCloseBalance);

        return {
            balance: localBalance.toString(),
            local_balance: {
                sat: localBalance.toString(),
                msat: localBalance.times(1000).toString()
            },
            remote_balance: {
                sat: remoteBalance.toString(),
                msat: remoteBalance.times(1000).toString()
            },
            pending_open_balance: totalPendingBalance.toString(),
            pending_open_local_balance: {
                sat: totalPendingBalance.toString(),
                msat: totalPendingBalance.times(1000).toString()
            }
        };
    };

    getChannels = async (): Promise<any> => {
        const res = await this.rpc(
            'ListChannels',
            api.ListChannelsRequest,
            api.ListChannelsResponse
        );
        return {
            channels: (res.channels || [])
                .filter((channel: any) => channel.is_channel_ready)
                .map(this.formatChannel)
        };
    };

    getPendingChannels = async (): Promise<any> => {
        const [res, balances, info] = await Promise.all([
            this.rpc(
                'ListChannels',
                api.ListChannelsRequest,
                api.ListChannelsResponse
            ),
            this.rpc(
                'GetBalances',
                api.GetBalancesRequest,
                api.GetBalancesResponse
            ),
            this.rpc(
                'GetNodeInfo',
                api.GetNodeInfoRequest,
                api.GetNodeInfoResponse
            )
        ]);
        const channels = res.channels || [];
        const currentBlockHeight = Number(info.current_best_block?.height || 0);
        const activeChannelIds = new Set<string>(
            channels.map((channel: any) => channel.channel_id)
        );
        const reconstructed = this.reconstructClosingChannelsFromBalances(
            balances,
            activeChannelIds,
            currentBlockHeight
        );

        return {
            pending_open_channels: channels
                .filter((channel: any) => !channel.is_channel_ready)
                .map((channel: any) => ({
                    channel: this.formatChannel(channel)
                })),
            pending_closing_channels: reconstructed.pendingClosing,
            pending_force_closing_channels: reconstructed.pendingForceClosing,
            waiting_close_channels: reconstructed.waitingClose
        };
    };

    getClosedChannels = async () => {
        const [channelsResponse, balances, info] = await Promise.all([
            this.rpc(
                'ListChannels',
                api.ListChannelsRequest,
                api.ListChannelsResponse
            ),
            this.rpc(
                'GetBalances',
                api.GetBalancesRequest,
                api.GetBalancesResponse
            ),
            this.rpc(
                'GetNodeInfo',
                api.GetNodeInfoRequest,
                api.GetNodeInfoResponse
            )
        ]);
        const currentBlockHeight = Number(info.current_best_block?.height || 0);
        const activeChannelIds = new Set<string>(
            (channelsResponse.channels || []).map(
                (channel: any) => channel.channel_id
            )
        );
        const reconstructed = this.reconstructClosingChannelsFromBalances(
            balances,
            activeChannelIds,
            currentBlockHeight
        );

        return { channels: reconstructed.closed };
    };

    getNewAddress = async (): Promise<any> => {
        const res = await this.rpc(
            'OnchainReceive',
            api.OnchainReceiveRequest,
            api.OnchainReceiveResponse
        );
        return { address: res.address };
    };

    sendCoins = async (data: any): Promise<any> => {
        const res = await this.rpc(
            'OnchainSend',
            api.OnchainSendRequest,
            api.OnchainSendResponse,
            {
                address: data.addr,
                amount_sats: data.send_all ? undefined : toUInt64(data.amount),
                send_all: data.send_all || undefined,
                fee_rate_sat_per_vb: data.sat_per_vbyte
                    ? toUInt64(data.sat_per_vbyte)
                    : undefined
            }
        );
        return { txid: res.txid };
    };

    createInvoice = async (data: any): Promise<any> => {
        const amount_msat = data.value_msat
            ? toUInt64(data.value_msat)
            : data.value
            ? satsToMsatLong(data.value)
            : undefined;
        const res = await this.rpc(
            'Bolt11Receive',
            api.Bolt11ReceiveRequest,
            api.Bolt11ReceiveResponse,
            {
                amount_msat,
                description: { direct: data.memo || '' },
                expiry_secs: Number(data.expiry_seconds) || 3600
            }
        );
        return {
            payment_request: res.invoice,
            r_hash: res.payment_hash,
            add_index: ''
        };
    };

    getInvoices = async (params?: {
        limit?: number;
        reversed?: boolean;
    }): Promise<any> => {
        const payments = await this.listPayments();
        const limit = Number(params?.limit);
        const invoicePayments = payments.filter(
            (p) => p.direction === 'INBOUND' && p.kind?.kind !== 'onchain'
        );
        const sortedInvoicePayments = params
            ? invoicePayments.sort((a, b) => {
                  if (params?.reversed === false) {
                      return (
                          Number(a.latest_update_timestamp || 0) -
                          Number(b.latest_update_timestamp || 0)
                      );
                  }
                  return (
                      Number(b.latest_update_timestamp || 0) -
                      Number(a.latest_update_timestamp || 0)
                  );
              })
            : invoicePayments;
        const invoices = sortedInvoicePayments
            .slice(0, Number.isFinite(limit) && limit > 0 ? limit : undefined)
            .map(this.formatPaymentAsInvoice);

        return { invoices };
    };

    lookupInvoice = async (data: { r_hash: string }): Promise<any> => {
        const payments = await this.listPayments();
        const payment = data?.r_hash
            ? payments.find((p) => this.paymentHash(p) === data.r_hash)
            : undefined;

        if (payment && payment.direction === 'INBOUND') {
            return this.formatPaymentAsInvoice(payment);
        }

        throw new Error('Invoice not found');
    };

    getPayments = async (): Promise<any> => {
        const payments = await this.listPayments();
        return {
            payments: payments
                .filter(
                    (p) =>
                        p.direction === 'OUTBOUND' && p.kind?.kind !== 'onchain'
                )
                .map(this.formatPayment)
        };
    };

    getTransactions = async (): Promise<any> => {
        const [payments, info] = await Promise.all([
            this.listPayments(),
            this.rpc(
                'GetNodeInfo',
                api.GetNodeInfoRequest,
                api.GetNodeInfoResponse
            )
        ]);
        const bestBlockHeight = Number(info.current_best_block?.height || 0);
        return {
            transactions: payments
                .filter((p) => p.kind?.kind === 'onchain')
                .map((payment) =>
                    this.formatOnchainTransaction(payment, bestBlockHeight)
                )
        };
    };

    payLightningInvoice = async (data: any): Promise<any> => {
        const route_parameters = this.routeParameters(data);
        const res = await this.rpc(
            'Bolt11Send',
            api.Bolt11SendRequest,
            api.Bolt11SendResponse,
            {
                invoice: data.payment_request,
                amount_msat: data.amt ? satsToMsatLong(data.amt) : undefined,
                route_parameters
            }
        );
        const payment = await this.awaitPaymentCompletion(res.payment_id);
        return {
            payment_hash: this.paymentHash(payment) || res.payment_id,
            payment_preimage: this.paymentPreimage(payment),
            payment_route: {},
            status: 'SUCCEEDED'
        };
    };

    sendKeysend = async (data: any): Promise<any> => {
        const res = await this.rpc(
            'SpontaneousSend',
            api.SpontaneousSendRequest,
            api.SpontaneousSendResponse,
            {
                node_id: data.pubkey,
                amount_msat: satsToMsatLong(data.amt),
                route_parameters: this.routeParameters(data)
            }
        );
        const payment = await this.awaitPaymentCompletion(res.payment_id);
        return {
            payment_hash: this.paymentHash(payment) || res.payment_id,
            payment_preimage: this.paymentPreimage(payment),
            payment_route: {},
            status: 'SUCCEEDED'
        };
    };

    decodePaymentRequest = async (urlParams?: Array<string>): Promise<any> => {
        const invoice = (urlParams && urlParams[0]) || '';
        const res = await this.rpc(
            'DecodeInvoice',
            api.DecodeInvoiceRequest,
            api.DecodeInvoiceResponse,
            { invoice }
        );
        return {
            ...res,
            num_satoshis: res.amount_msat ? msatToSat(res.amount_msat) : '0',
            num_msat: res.amount_msat || '0',
            cltv_expiry: res.min_final_cltv_expiry_delta
        };
    };

    openChannelSync = async (data: OpenChannelRequest): Promise<any> => {
        const res = await this.rpc(
            'OpenChannel',
            api.OpenChannelRequest,
            api.OpenChannelResponse,
            {
                node_pubkey: data.node_pubkey_string,
                address: data.host || '',
                channel_amount_sats: toUInt64(data.local_funding_amount),
                push_to_counterparty_msat: data.push_sat
                    ? satsToMsatLong(data.push_sat)
                    : undefined,
                announce_channel: !data.privateChannel
            }
        );
        return await this.awaitChannelOpenEvent(res.user_channel_id);
    };

    closeChannel = async (urlParams?: Array<string>): Promise<any> => {
        const fundingTxid = (urlParams && urlParams[0]) || '';
        const forceClose = !!(urlParams && urlParams[2]);
        const res = await this.rpc(
            'ListChannels',
            api.ListChannelsRequest,
            api.ListChannelsResponse
        );
        const channel = (res.channels || []).find(
            (c: any) => c.funding_txo?.txid === fundingTxid
        );
        if (!channel) throw new Error(`Channel not found: ${fundingTxid}`);

        await this.rpc(
            forceClose ? 'ForceCloseChannel' : 'CloseChannel',
            forceClose ? api.ForceCloseChannelRequest : api.CloseChannelRequest,
            forceClose
                ? api.ForceCloseChannelResponse
                : api.CloseChannelResponse,
            {
                user_channel_id: channel.user_channel_id,
                counterparty_node_id: channel.counterparty_node_id
            }
        );
        return { success: true };
    };

    connectPeer = async (data: any): Promise<any> => {
        await this.rpc(
            'ConnectPeer',
            api.ConnectPeerRequest,
            api.ConnectPeerResponse,
            {
                node_pubkey: data.addr.pubkey,
                address: data.addr.host,
                persist: data.perm !== false
            }
        );
        return {};
    };

    disconnectPeer = async (pubkey: string): Promise<boolean | null> => {
        await this.rpc(
            'DisconnectPeer',
            api.DisconnectPeerRequest,
            api.DisconnectPeerResponse,
            { node_pubkey: pubkey }
        );
        return true;
    };

    listPeers = async (): Promise<any[]> => {
        const res = await this.rpc(
            'ListPeers',
            api.ListPeersRequest,
            api.ListPeersResponse
        );
        return (res.peers || []).map((peer: any) => ({
            pub_key: peer.node_id,
            address: peer.address,
            inbound: false,
            sync_type: peer.is_connected ? 'ACTIVE_SYNC' : 'UNKNOWN_SYNC'
        }));
    };

    signMessage = async (msg: string) => {
        const res = await this.rpc(
            'SignMessage',
            api.SignMessageRequest,
            api.SignMessageResponse,
            { message: Base64Utils.utf8ToBytes(msg) }
        );
        return { signature: res.signature };
    };

    verifyMessage = async (data: {
        msg: string;
        signature: string;
        pubkey: string;
    }) => {
        const res = await this.rpc(
            'VerifySignature',
            api.VerifySignatureRequest,
            api.VerifySignatureResponse,
            {
                message: Base64Utils.utf8ToBytes(data.msg),
                signature: data.signature,
                public_key: data.pubkey
            }
        );
        return { valid: res.valid, pubkey: data.pubkey };
    };

    createOffer = async ({
        description,
        singleUse
    }: {
        description?: string;
        singleUse?: boolean;
    }): Promise<any> => {
        const res = await this.rpc(
            'Bolt12Receive',
            api.Bolt12ReceiveRequest,
            api.Bolt12ReceiveResponse,
            { description: description || '' }
        );
        return {
            bolt12: res.offer,
            offer_id: res.offer_id,
            active: true,
            single_use: singleUse || false,
            used: false
        };
    };

    fetchInvoiceFromOffer = async (
        bolt12: string,
        amountSatoshis: string
    ): Promise<any> => {
        const res = await this.rpc(
            'Bolt12Send',
            api.Bolt12SendRequest,
            api.Bolt12SendResponse,
            {
                offer: bolt12,
                amount_msat: satsToMsatLong(amountSatoshis)
            }
        );
        const payment = await this.awaitPaymentCompletion(res.payment_id);
        return {
            payment_hash: this.paymentHash(payment) || res.payment_id,
            payment_preimage: this.paymentPreimage(payment),
            status: 'SUCCEEDED'
        };
    };

    private awaitPaymentCompletion = async (
        paymentId: string
    ): Promise<any> => {
        let eventPayment: any;
        let paymentFailed = false;
        const unsubscribe = this.subscribeToEvents((event: any) => {
            const failedPayment = event.payment_failed?.payment;
            const successfulPayment = event.payment_successful?.payment;
            if (failedPayment?.id === paymentId) {
                eventPayment = failedPayment;
                paymentFailed = true;
            } else if (successfulPayment?.id === paymentId) {
                eventPayment = successfulPayment;
            }
        });

        try {
            for (let i = 0; i < 60; i++) {
                if (eventPayment?.status === 'SUCCEEDED') return eventPayment;
                if (paymentFailed || eventPayment?.status === 'FAILED') {
                    throw new Error('Payment failed');
                }

                const payment = await this.getPaymentDetails(paymentId);
                if (payment?.status === 'SUCCEEDED') return payment;
                if (payment?.status === 'FAILED')
                    throw new Error('Payment failed');
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        } finally {
            unsubscribe();
        }

        throw new Error('Payment timed out');
    };

    private getPaymentDetails = async (paymentId: string): Promise<any> => {
        const res = await this.rpc(
            'GetPaymentDetails',
            api.GetPaymentDetailsRequest,
            api.GetPaymentDetailsResponse,
            { payment_id: paymentId }
        );
        return res.payment;
    };

    private awaitChannelOpenEvent = async (userChannelId: string) => {
        const fallback = { user_channel_id: userChannelId };

        if (this.eventStreamingUnavailable) return fallback;

        return await new Promise<any>((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timeout);
                unsubscribe();
                unsubscribeStreamError();
            };

            const timeout = setTimeout(() => {
                cleanup();
                resolve(fallback);
            }, 60000);

            const unsubscribeStreamError = this.onEventStreamError(() => {
                cleanup();
                resolve(fallback);
            });

            const unsubscribe = this.subscribeToEvents((event: any) => {
                const channelEvent = event.channel_state_changed;
                if (channelEvent?.user_channel_id !== userChannelId) return;

                if (
                    channelEvent.state === 'CHANNEL_STATE_PENDING' ||
                    channelEvent.state === 'CHANNEL_STATE_READY'
                ) {
                    cleanup();
                    resolve({
                        ...fallback,
                        ...this.fundingTxoResponse(channelEvent.funding_txo)
                    });
                } else if (
                    channelEvent.state === 'CHANNEL_STATE_OPEN_FAILED' ||
                    channelEvent.state === 'CHANNEL_STATE_CLOSED'
                ) {
                    cleanup();
                    reject(
                        new Error(
                            channelEvent.reason?.message ||
                                `Channel open failed: ${userChannelId}`
                        )
                    );
                }
            });
        });
    };

    private fundingTxoResponse = (fundingTxo?: string | null) => {
        if (!fundingTxo) return {};
        const [funding_txid_str, outputIndex] = fundingTxo.split(':');
        return {
            funding_txid_str,
            output_index:
                outputIndex !== undefined ? Number(outputIndex) : undefined
        };
    };

    private routeParameters = (
        data: any
    ): types.IRouteParametersConfig | undefined => {
        if (!data.fee_limit_sat && !data.max_parts) return undefined;
        return {
            max_total_routing_fee_msat: data.fee_limit_sat
                ? satsToMsatLong(data.fee_limit_sat)
                : undefined,
            max_path_count: data.max_parts ? Number(data.max_parts) : undefined
        };
    };

    private paymentHash = (payment: any) =>
        payment?.kind?.bolt11?.hash ||
        payment?.kind?.bolt11_jit?.hash ||
        payment?.kind?.spontaneous?.hash ||
        payment?.kind?.bolt12_offer?.hash ||
        payment?.id ||
        '';

    private paymentPreimage = (payment: any) =>
        payment?.kind?.bolt11?.preimage ||
        payment?.kind?.bolt11_jit?.preimage ||
        payment?.kind?.spontaneous?.preimage ||
        payment?.kind?.bolt12_offer?.preimage ||
        '';

    private channelBalances = (channel: any) => {
        const localReserveSats = channel.unspendable_punishment_reserve || 0;
        const remoteReserveSats =
            channel.counterparty_unspendable_punishment_reserve || 0;
        const outboundSats = new BigNumber(
            channel.outbound_capacity_msat || 0
        ).dividedBy(1000);
        const inboundSats = new BigNumber(
            channel.inbound_capacity_msat || 0
        ).dividedBy(1000);

        let localBalanceSats: BigNumber;
        if (outboundSats.gt(0)) {
            localBalanceSats = outboundSats.plus(localReserveSats);
        } else {
            localBalanceSats = new BigNumber(channel.channel_value_sats || 0)
                .minus(inboundSats)
                .minus(remoteReserveSats)
                .minus(660);
            if (localBalanceSats.lt(0)) localBalanceSats = new BigNumber(0);
        }

        const remoteBalanceSats = new BigNumber(
            channel.channel_value_sats || 0
        ).minus(localBalanceSats);

        return { localBalanceSats, remoteBalanceSats };
    };

    private lightningBalanceDetails = (
        balance: any
    ): { type: string; balance: any } | null => {
        const types = [
            'claimable_on_channel_close',
            'claimable_awaiting_confirmations',
            'contentious_claimable',
            'maybe_timeout_claimable_htlc',
            'maybe_preimage_claimable_htlc',
            'counterparty_revoked_output_claimable'
        ];
        const type = types.find((key) => balance?.[key]);
        return type ? { type, balance: balance[type] } : null;
    };

    private pendingSweepDetails = (
        balance: any
    ): { type: string; balance: any } | null => {
        const types = [
            'pending_broadcast',
            'broadcast_awaiting_confirmation',
            'awaiting_threshold_confirmations'
        ];
        const type = types.find((key) => balance?.[key]);
        return type ? { type, balance: balance[type] } : null;
    };

    private reconstructClosingChannelsFromBalances = (
        balances: any,
        activeChannelIds: Set<string>,
        currentBlockHeight: number
    ) => {
        const lightningByChannel = new Map<string, any[]>();
        const sweepsByChannel = new Map<string, any[]>();
        const confirmedSweepsByChannel = new Map<string, any[]>();

        for (const balance of balances.lightning_balances || []) {
            const details = this.lightningBalanceDetails(balance);
            if (!details || details.type === 'claimable_on_channel_close') {
                continue;
            }
            const channelId = details.balance.channel_id || '';
            if (channelId && activeChannelIds.has(channelId)) continue;
            const key = channelId || `lightning-${lightningByChannel.size}`;
            const list = lightningByChannel.get(key) || [];
            list.push(details);
            lightningByChannel.set(key, list);
        }

        for (const sweep of balances.pending_balances_from_channel_closures ||
            []) {
            const details = this.pendingSweepDetails(sweep);
            if (!details) continue;
            const channelId = details.balance.channel_id || '';
            if (channelId && activeChannelIds.has(channelId)) continue;
            const key =
                channelId ||
                details.balance.latest_spending_txid ||
                `sweep-${sweepsByChannel.size}`;

            if (
                details.type === 'awaiting_threshold_confirmations' &&
                details.balance.confirmation_height != null &&
                Number(details.balance.confirmation_height) <=
                    currentBlockHeight
            ) {
                const list = confirmedSweepsByChannel.get(key) || [];
                list.push(details);
                confirmedSweepsByChannel.set(key, list);
                continue;
            }

            const list = sweepsByChannel.get(key) || [];
            list.push(details);
            sweepsByChannel.set(key, list);
        }

        const pendingClosing: any[] = [];
        const pendingForceClosing: any[] = [];
        const waitingClose: any[] = [];
        const closed: any[] = [];

        lightningByChannel.forEach((entries, channelId) => {
            if (confirmedSweepsByChannel.has(channelId)) return;

            const totalSats = this.sumBalanceEntries(entries);
            const channel = this.reconstructedChannel(entries, totalSats);
            const sweeps = sweepsByChannel.get(channelId) || [];
            const closingTxid = this.latestSweepTxid(sweeps);

            if (entries.every((entry) => this.isCoopCloseBalance(entry))) {
                pendingClosing.push({
                    channel,
                    closing_txid: closingTxid
                });
                return;
            }

            pendingForceClosing.push({
                channel: { ...channel, pendingClose: true },
                blocks_til_maturity: this.maxBlocksTilMaturity(
                    entries,
                    currentBlockHeight
                ),
                closing_txid: closingTxid
            });
        });

        sweepsByChannel.forEach((entries, channelId) => {
            if (lightningByChannel.has(channelId)) return;

            const totalSats = this.sumBalanceEntries(entries);
            const channel = this.reconstructedChannel(entries, totalSats);
            const closingTxid = this.latestSweepTxid(entries);

            if (entries.every((entry) => entry.type === 'pending_broadcast')) {
                waitingClose.push({
                    channel: { ...channel, pendingClose: true }
                });
            } else {
                pendingForceClosing.push({
                    channel: { ...channel, pendingClose: true },
                    blocks_til_maturity: 0,
                    closing_txid: closingTxid
                });
            }
        });

        confirmedSweepsByChannel.forEach((entries, channelId) => {
            if (
                lightningByChannel.has(channelId) ||
                sweepsByChannel.has(channelId)
            ) {
                return;
            }

            const totalSats = this.sumBalanceEntries(entries);
            const closingTxid = this.latestSweepTxid(entries);
            const channel = this.reconstructedChannel(entries, totalSats);

            closed.push({
                ...channel,
                settled_balance: totalSats.toString(),
                close_type: 'FORCE_CLOSE',
                closing_txid: closingTxid,
                closing_tx_hash: closingTxid,
                forceClose: false,
                blocks_til_maturity: 0,
                time_locked_balance: '0'
            });
        });

        return {
            pendingClosing,
            pendingForceClosing,
            waitingClose,
            closed
        };
    };

    private sumBalanceEntries = (entries: any[]): BigNumber =>
        entries.reduce(
            (sum, entry) => sum.plus(entry.balance.amount_satoshis || 0),
            new BigNumber(0)
        );

    private reconstructedChannel = (entries: any[], totalSats: BigNumber) => {
        const counterparty = entries.find(
            (entry) => entry.balance.counterparty_node_id
        )?.balance.counterparty_node_id;
        const channelId = entries.find((entry) => entry.balance.channel_id)
            ?.balance.channel_id;

        return {
            active: false,
            remote_pubkey: counterparty || '',
            channel_point: '',
            chan_id: '',
            channel_id: channelId || '',
            capacity: totalSats.toString(),
            local_balance: totalSats.toString(),
            remote_balance: '0',
            commit_fee: '0',
            commit_weight: '0',
            fee_per_kw: '0',
            unsettled_balance: '0',
            total_satoshis_sent: '0',
            total_satoshis_received: '0',
            num_updates: '0',
            pending_htlcs: []
        };
    };

    private isCoopCloseBalance = (entry: any): boolean =>
        entry.type === 'claimable_awaiting_confirmations' &&
        entry.balance.source === 'COOP_CLOSE';

    private maxBlocksTilMaturity = (
        entries: any[],
        currentBlockHeight: number
    ): number =>
        entries.reduce((max, entry) => {
            const height = Number(entry.balance.confirmation_height || 0);
            if (!height) return max;
            return Math.max(max, height - currentBlockHeight);
        }, 0);

    private latestSweepTxid = (entries: any[]): string =>
        entries.find((entry) => entry.balance.latest_spending_txid)?.balance
            .latest_spending_txid || '';

    private formatChannel = (channel: any): any => {
        const { localBalanceSats, remoteBalanceSats } =
            this.channelBalances(channel);
        return {
            active: channel.is_usable,
            remote_pubkey: channel.counterparty_node_id,
            channel_point: channel.funding_txo
                ? `${channel.funding_txo.txid}:${channel.funding_txo.vout}`
                : '',
            chan_id: channel.short_channel_id || '',
            channel_id: channel.channel_id,
            capacity: channel.channel_value_sats || '0',
            local_balance: localBalanceSats.toString(),
            remote_balance: remoteBalanceSats.toString(),
            commit_fee: '0',
            commit_weight: '0',
            fee_per_kw: channel.feerate_sat_per_1000_weight || '0',
            unsettled_balance: '0',
            total_satoshis_sent: '0',
            total_satoshis_received: '0',
            num_updates: '0',
            pending_htlcs: [],
            csv_delay: channel.force_close_spend_delay || 0,
            private: !channel.is_announced,
            initiator: channel.is_outbound,
            local_chan_reserve_sat: channel.unspendable_punishment_reserve,
            remote_chan_reserve_sat:
                channel.counterparty_unspendable_punishment_reserve,
            user_channel_id: channel.user_channel_id,
            is_channel_ready: channel.is_channel_ready,
            is_usable: channel.is_usable,
            confirmations: channel.confirmations,
            confirmations_required: channel.confirmations_required
        };
    };

    private formatPayment = (payment: any): any => {
        const feeMsat = payment.fee_paid_msat || 0;
        return {
            payment_hash: this.paymentHash(payment),
            value: msatToSat(payment.amount_msat),
            value_sat: msatToSat(payment.amount_msat),
            value_msat: payment.amount_msat || '0',
            creation_date: payment.latest_update_timestamp || '0',
            fee: msatToSat(feeMsat),
            fee_sat: new BigNumber(feeMsat).dividedBy(1000).toFixed(0),
            fee_msat: feeMsat,
            payment_preimage: this.paymentPreimage(payment),
            status:
                payment.status === 'SUCCEEDED'
                    ? 'SUCCEEDED'
                    : payment.status === 'PENDING'
                    ? 'IN_FLIGHT'
                    : 'FAILED',
            failure_reason:
                payment.status === 'FAILED' ? 'FAILURE_REASON_ERROR' : ''
        };
    };

    private formatPaymentAsInvoice = (payment: any): any => {
        const settled = payment.status === 'SUCCEEDED';
        return {
            memo: '',
            r_preimage: this.paymentPreimage(payment),
            r_hash: this.paymentHash(payment),
            value: msatToSat(payment.amount_msat),
            value_msat: payment.amount_msat || '0',
            settled,
            creation_date: payment.latest_update_timestamp || '0',
            settle_date: settled ? payment.latest_update_timestamp || '0' : '0',
            payment_request: '',
            expiry: '3600',
            cltv_expiry: '40',
            private: false,
            add_index: '',
            settle_index: '',
            amt_paid: msatToSat(payment.amount_msat),
            amt_paid_sat: msatToSat(payment.amount_msat),
            amt_paid_msat: payment.amount_msat || '0',
            state: settled
                ? 'SETTLED'
                : payment.status === 'PENDING'
                ? 'OPEN'
                : 'CANCELED'
        };
    };

    private formatOnchainTransaction = (
        payment: any,
        bestBlockHeight: number
    ): any => {
        const kind = payment.kind?.onchain || {};
        const isInbound = payment.direction === 'INBOUND';
        const amount = msatToSat(payment.amount_msat);
        const confirmationHeight = Number(kind.status?.confirmed?.height || 0);
        const numConfirmations =
            confirmationHeight && bestBlockHeight >= confirmationHeight
                ? bestBlockHeight - confirmationHeight + 1
                : 0;
        return {
            tx_hash: kind.txid || payment.id,
            amount: isInbound ? amount : `-${amount}`,
            num_confirmations: numConfirmations,
            block_height: confirmationHeight,
            time_stamp:
                kind.status?.confirmed?.timestamp ||
                payment.latest_update_timestamp ||
                '0',
            dest_addresses: [],
            total_fees: '0',
            status: kind.status?.confirmed ? 'confirmed' : 'pending'
        };
    };

    supportsMessageSigning = () => true;
    supportsMessageVerification = () => true;
    supportsLnurlAuth = () => false;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsCircularRebalancing = () => false;
    supportsForceClose = () => true;
    supportsPendingChannels = () => true;
    supportsClosedChannels = () => true;
    supportsMPP = () => true;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => true;
    supportsAddressTypeSelection = () => false;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => true;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => false;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => false;
    supportsOnchainSendMax = () => true;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => false;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => false;
    supportsLSPS1native = () => false;
    supportsLSPS7native = () => false;
    supportsOffers = () => true;
    supportsListingOffers = () => false;
    supportsBolt12Address = () => false;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsCustomFeeLimit = () => true;
    supportsForwardingHistory = () => false;
    supportsCashuWallet = () => false;
    supportsAddressMessageSigning = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsWatchtowerClient = () => false;
    supportsPeers = () => true;
    supportsNostrWalletConnectService = () => false;
}
