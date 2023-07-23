import { NativeModules } from 'react-native';
import { sendCommand, sendStreamCommand, decodeStreamResult } from './utils';
import { lnrpc, routerrpc, invoicesrpc } from './../proto/lightning';
import Long from 'long';
import sha from 'sha.js';
import Base64Utils from '../utils/Base64Utils';
import {
    checkLndStreamErrorResponse,
    LndMobileEventEmitter
} from '../utils/LndMobileUtils';
import { getChanInfo, listPrivateChannels } from './channel';
const { LndMobile, LndMobileTools } = NativeModules;

// const TLV_KEYSEND = 5482373484;
const TLV_RECORD_NAME = 128101;
// const TLV_WHATSAT_MESSAGE = 34349334;

/**
 * @throws
 */
export const initialize = async (): Promise<{ data: string } | number> => {
    return await LndMobile.initialize();
};

export enum ELndMobileStatusCodes {
    STATUS_SERVICE_BOUND = 1,
    STATUS_PROCESS_STARTED = 2,
    STATUS_WALLET_UNLOCKED = 4
}

export const checkStatus = async (): Promise<ELndMobileStatusCodes> => {
    return await LndMobile.checkStatus();
};

/**
 * @throws
 * @return string
 */
export const writeConfig = async (data: string) => {
    return await LndMobileTools.writeConfig(data);
};

export const subscribeState = async () => {
    const response = await sendStreamCommand<
        lnrpc.ISubscribeStateRequest,
        lnrpc.SubscribeStateRequest
    >(
        {
            request: lnrpc.SubscribeStateRequest,
            method: 'SubscribeState',
            options: {}
        },
        false
    );
    return response;
};

export const decodeState = (data: string): lnrpc.SubscribeStateResponse => {
    return decodeStreamResult<lnrpc.SubscribeStateResponse>({
        response: lnrpc.SubscribeStateResponse,
        base64Result: data
    });
};

/**
 * @throws
 */
export const startLnd = async (args?: string): Promise<{ data: string }> => {
    return await LndMobile.startLnd(args || '');
};

/**
 * @throws
 */
export const gossipSync = async (
    networkType: string
): Promise<{ data: string }> => {
    return await LndMobile.gossipSync(networkType);
};

export const checkICloudEnabled = async (): Promise<boolean> => {
    return await LndMobileTools.checkICloudEnabled();
};

/**
 * @throws
 */
export const checkApplicationSupportExists = async () => {
    return await LndMobileTools.checkApplicationSupportExists();
};

/**
 * @throws
 */
export const checkLndFolderExists = async () => {
    return await LndMobileTools.checkLndFolderExists();
};

/**
 * @throws
 */
export const createIOSApplicationSupportAndLndDirectories = async () => {
    return await LndMobileTools.createIOSApplicationSupportAndLndDirectories();
};

/**
 * @throws
 */
export const TEMP_moveLndToApplicationSupport = async () => {
    return await LndMobileTools.TEMP_moveLndToApplicationSupport();
};

/**
 * @throws
 */
export const excludeLndICloudBackup = async () => {
    return await LndMobileTools.excludeLndICloudBackup();
};

/**
 * @throws
 */
export const connectPeer = async (
    pubkey: string,
    host: string
): Promise<lnrpc.ConnectPeerResponse> => {
    return await sendCommand<
        lnrpc.IConnectPeerRequest,
        lnrpc.ConnectPeerRequest,
        lnrpc.ConnectPeerResponse
    >({
        request: lnrpc.ConnectPeerRequest,
        response: lnrpc.ConnectPeerResponse,
        method: 'ConnectPeer',
        options: {
            addr: lnrpc.LightningAddress.create({
                host,
                pubkey
            })
        }
    });
};

/**
 * @throws
 */
export const disconnectPeer = async (
    pub_key: string
): Promise<lnrpc.DisconnectPeerResponse> => {
    const response = await sendCommand<
        lnrpc.IDisconnectPeerRequest,
        lnrpc.DisconnectPeerRequest,
        lnrpc.DisconnectPeerResponse
    >({
        request: lnrpc.DisconnectPeerRequest,
        response: lnrpc.DisconnectPeerResponse,
        method: 'DisconnectPeer',
        options: {
            pub_key
        }
    });
    return response;
};

/**
 * @throws
 */
export const getNodeInfo = async (
    pub_key: string,
    include_channels: boolean = false
): Promise<lnrpc.NodeInfo> => {
    const response = await sendCommand<
        lnrpc.INodeInfoRequest,
        lnrpc.NodeInfoRequest,
        lnrpc.NodeInfo
    >({
        request: lnrpc.NodeInfoRequest,
        response: lnrpc.NodeInfo,
        method: 'GetNodeInfo',
        options: {
            pub_key,
            include_channels
        }
    });
    return response;
};

/**
 * @throws
 */
export const getInfo = async (): Promise<lnrpc.GetInfoResponse> => {
    const response = await sendCommand<
        lnrpc.IGetInfoRequest,
        lnrpc.GetInfoRequest,
        lnrpc.GetInfoResponse
    >({
        request: lnrpc.GetInfoRequest,
        response: lnrpc.GetInfoResponse,
        method: 'GetInfo',
        options: {}
    });
    return response;
};

/**
 *
 * @throws
 * @param paymentRequest BOLT11-encoded payment request
 * @params name TLV record for sender name
 *
 */
export const sendPaymentSync = async (
    payment_request: string,
    amount?: Long,
    tlv_record_name?: string | null
): Promise<lnrpc.SendResponse> => {
    const options: lnrpc.ISendRequest = {
        payment_request
    };
    if (tlv_record_name && tlv_record_name.length > 0) {
        options.dest_custom_records = {
            [TLV_RECORD_NAME]:
                Base64Utils.unicodeStringToUint8Array(tlv_record_name)
        };
    }
    if (amount) {
        options.amt = amount;
    }

    const response = await sendCommand<
        lnrpc.ISendRequest,
        lnrpc.SendRequest,
        lnrpc.SendResponse
    >({
        request: lnrpc.SendRequest,
        response: lnrpc.SendResponse,
        method: 'SendPaymentSync',
        options
    });
    return response;
};

export const sendPaymentV2Sync = (
    payment_request: string,
    amount?: Long,
    pay_amount?: Long,
    tlv_record_name?: string | null,
    multi_path?: boolean,
    max_ln_fee_percentage: number = 2
): Promise<lnrpc.Payment> => {
    const maxFeeRatio = (max_ln_fee_percentage ?? 2) / 100;

    const options: routerrpc.ISendPaymentRequest = {
        payment_request,
        no_inflight_updates: true,
        timeout_seconds: 60,
        max_parts: multi_path ? 16 : 1,
        fee_limit_sat: Long.fromValue(
            Math.max(10, (pay_amount?.toNumber() || 0) * maxFeeRatio)
        ),
        cltv_limit: 0
    };
    if (amount) {
        options.amt = amount;
    }
    if (tlv_record_name && tlv_record_name.length > 0) {
        options.dest_custom_records = {
            [TLV_RECORD_NAME]:
                Base64Utils.unicodeStringToUint8Array(tlv_record_name)
        };
    }

    return new Promise(async (resolve, reject) => {
        const listener = LndMobileEventEmitter.addListener(
            'RouterSendPaymentV2',
            (e) => {
                try {
                    listener.remove();
                    const error = checkLndStreamErrorResponse(
                        'RouterSendPaymentV2',
                        e
                    );
                    if (error === 'EOF') {
                        return;
                    } else if (error) {
                        console.log('Got error from RouterSendPaymentV2', [
                            error
                        ]);
                        return reject(error);
                    }

                    const response = decodeSendPaymentV2Result(e.data);
                    resolve(response);
                } catch (error) {
                    reject(error.message);
                }
            }
        );

        const response = await sendStreamCommand<
            routerrpc.ISendPaymentRequest,
            routerrpc.SendPaymentRequest
        >(
            {
                request: routerrpc.SendPaymentRequest,
                method: 'RouterSendPaymentV2',
                options
            },
            false
        );

        return response;
    });
};

// TODO error handling
export const decodeSendPaymentV2Result = (data: string): lnrpc.Payment => {
    return decodeStreamResult<lnrpc.Payment>({
        response: lnrpc.Payment,
        base64Result: data
    });
};

export const sendKeysendPaymentV2 = (
    destination_pub_key: string,
    sat: Long,
    dest_custom_records: any,
    payment_hash: string,
    route_hints: lnrpc.IRouteHint[]
    // max_ln_fee_percentage: number = 3
): Promise<lnrpc.Payment> => {
    // const maxFeeRatio = (max_ln_fee_percentage ?? 2) / 100;

    const options: routerrpc.ISendPaymentRequest = {
        dest: Base64Utils.hexToUint8Array(destination_pub_key),
        amt: sat,
        route_hints,
        payment_hash,
        dest_features: [lnrpc.FeatureBit.TLV_ONION_REQ],
        no_inflight_updates: true,
        timeout_seconds: 60,
        max_parts: 2,
        // fee_limit_sat: new Long(Number((sat?.toNumber() || 0) * maxFeeRatio)),
        cltv_limit: 0
    };

    if (dest_custom_records) {
        options.dest_custom_records = dest_custom_records;
    }

    return new Promise(async (resolve, reject) => {
        const listener = LndMobileEventEmitter.addListener(
            'RouterSendPaymentV2',
            (e) => {
                console.log(e);
                const error = checkLndStreamErrorResponse(
                    'RouterSendPaymentV2',
                    e
                );
                if (error === 'EOF') {
                    return;
                } else if (error) {
                    console.log('Got error from RouterSendPaymentV2', [error]);
                    return reject(error);
                }

                const response = decodeSendPaymentV2Result(e.data);
                console.log(response);

                resolve(response);
                listener.remove();
            }
        );

        const response = await sendStreamCommand<
            routerrpc.ISendPaymentRequest,
            routerrpc.SendPaymentRequest
        >(
            {
                request: routerrpc.SendPaymentRequest,
                method: 'RouterSendPaymentV2',
                options
            },
            false
        );
        console.log(response);
    });
};

export const sendKeysendPayment = async (
    destination_pub_key: string,
    sat: Long,
    pre_image: Uint8Array,
    route_hints: lnrpc.IRouteHint[],
    tlv_record_name_str: string
): Promise<lnrpc.SendResponse> => {
    try {
        const responseQueryRoutes = await sendCommand<
            lnrpc.IQueryRoutesRequest,
            lnrpc.QueryRoutesRequest,
            lnrpc.QueryRoutesResponse
        >({
            request: lnrpc.QueryRoutesRequest,
            response: lnrpc.QueryRoutesResponse,
            method: 'QueryRoutes',
            options: {
                pub_key: destination_pub_key,
                amt: sat,
                route_hints,
                dest_custom_records: {
                    // Custom records are injected in a hacky way below
                    // because of a bug in protobufjs
                    // [TLV_RECORD_NAME]: Base64Utils.stringToUint8Array(tlv_record_name_str),
                    // 5482373484 is the record for lnd
                    // keysend payments as described in
                    // https://github.com/lightningnetwork/lnd/releases/tag/v0.9.0-beta
                    // "5482373484": preImage,
                },
                dest_features: [lnrpc.FeatureBit.TLV_ONION_REQ]
            }
        });

        console.log('responseQueryRoutes', responseQueryRoutes);

        for (const route of responseQueryRoutes.routes) {
            try {
                const lastHop = route.hops!.length - 1;

                route.hops![lastHop].custom_records!['5482373484'] = pre_image;
                if (tlv_record_name_str && tlv_record_name_str.length > 0) {
                    route.hops![lastHop].custom_records![TLV_RECORD_NAME] =
                        Base64Utils.stringToUint8Array(tlv_record_name_str);
                }

                const response = await sendCommand<
                    lnrpc.ISendToRouteRequest,
                    lnrpc.SendToRouteRequest,
                    lnrpc.SendResponse
                >({
                    request: lnrpc.SendToRouteRequest,
                    response: lnrpc.SendResponse,
                    method: 'SendToRouteSync',
                    options: {
                        payment_hash: sha('sha256').update(pre_image).digest(),
                        route
                    }
                });
                return response;
            } catch (e) {
                console.log(e);
            }
        }
    } catch (e) {
        console.log('QueryRoutes Error', e.message);
    }
    return null;
};

// TODO error handling
export const decodePaymentStatus = (data: string): routerrpc.PaymentStatus => {
    return decodeStreamResult<routerrpc.PaymentStatus>({
        response: routerrpc.PaymentStatus,
        base64Result: data
    });
};

/**
 * @throws
 */
export const addInvoice = async (
    amount: number,
    memo: string,
    expiry: number = 3600
): Promise<lnrpc.AddInvoiceResponse> => {
    const response = await sendCommand<
        lnrpc.IInvoice,
        lnrpc.Invoice,
        lnrpc.AddInvoiceResponse
    >({
        request: lnrpc.Invoice,
        response: lnrpc.AddInvoiceResponse,
        method: 'AddInvoice',
        options: {
            value: Long.fromValue(amount),
            memo,
            expiry: Long.fromValue(expiry),
            private: true,
            min_hop_hints: 6
        }
    });
    return response;
};

export const getRouteHints = async (): Promise<lnrpc.IRouteHint[]> => {
    const routeHints: lnrpc.IRouteHint[] = [];
    const channels = await listPrivateChannels();

    // Follows the code in `addInvoice()` of the lnd project
    for (const channel of channels.channels) {
        const chanInfo = await getChanInfo(channel.chan_id!);
        const remotePubkey = channel.remote_pubkey;

        // TODO check if node is publicly
        // advertised in the network graph
        // https://github.com/lightningnetwork/lnd/blob/38b521d87d3fd9cff628e5dc09b764aeabaf011a/channeldb/graph.go#L2141

        let policy: lnrpc.IRoutingPolicy;
        if (remotePubkey === chanInfo.node1_pub) {
            policy = chanInfo.node1_policy!;
        } else {
            policy = chanInfo.node2_policy!;
        }

        if (!policy) {
            continue;
        }

        let channelId = chanInfo.channel_id;
        if (channel.peer_scid_alias) {
            channelId = channel.peer_scid_alias;
        }

        routeHints.push(
            lnrpc.RouteHint.create({
                hop_hints: [
                    {
                        node_id: remotePubkey,
                        chan_id: channelId,
                        fee_base_msat: policy.fee_base_msat
                            ? policy.fee_base_msat.toNumber()
                            : 0,
                        fee_proportional_millionths: policy.fee_rate_milli_msat
                            ? policy.fee_rate_milli_msat.toNumber()
                            : 0,
                        cltv_expiry_delta: policy.time_lock_delta
                    }
                ]
            })
        );
    }

    console.log('our hints', routeHints);
    return routeHints;
};

/**
 * @throws
 */
export const cancelInvoice = async (
    paymentHash: string
): Promise<invoicesrpc.CancelInvoiceResp> => {
    const response = await sendCommand<
        invoicesrpc.ICancelInvoiceMsg,
        invoicesrpc.CancelInvoiceMsg,
        invoicesrpc.CancelInvoiceResp
    >({
        request: invoicesrpc.CancelInvoiceMsg,
        response: invoicesrpc.CancelInvoiceResp,
        method: 'InvoicesCancelInvoice',
        options: {
            payment_hash: Base64Utils.hexToUint8Array(paymentHash)
        }
    });
    return response;
};

/**
 * @throws
 */
export const lookupInvoice = async (rHash: string): Promise<lnrpc.Invoice> => {
    const response = await sendCommand<
        lnrpc.IPaymentHash,
        lnrpc.PaymentHash,
        lnrpc.Invoice
    >({
        request: lnrpc.PaymentHash,
        response: lnrpc.Invoice,
        method: 'LookupInvoice',
        options: {
            r_hash_str: rHash
        }
    });
    return response;
};

/**
 * @throws
 */
export const listPeers = async (): Promise<lnrpc.ListPeersResponse> => {
    const response = await sendCommand<
        lnrpc.IListPeersRequest,
        lnrpc.ListPeersRequest,
        lnrpc.ListPeersResponse
    >({
        request: lnrpc.ListPeersRequest,
        response: lnrpc.ListPeersResponse,
        method: 'ListPeers',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const listPayments = async (): Promise<lnrpc.ListPaymentsResponse> => {
    const response = await sendCommand<
        lnrpc.IListPaymentsRequest,
        lnrpc.ListPaymentsRequest,
        lnrpc.ListPaymentsResponse
    >({
        request: lnrpc.ListPaymentsRequest,
        response: lnrpc.ListPaymentsResponse,
        method: 'ListPayments',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const queryRoutes = async (
    pub_key: string,
    amount?: Long,
    route_hints?: lnrpc.IRouteHint[]
): Promise<lnrpc.QueryRoutesResponse> => {
    const response = await sendCommand<
        lnrpc.IQueryRoutesRequest,
        lnrpc.IQueryRoutesRequest,
        lnrpc.QueryRoutesResponse
    >({
        request: lnrpc.QueryRoutesRequest,
        response: lnrpc.QueryRoutesResponse,
        method: 'QueryRoutes',
        options: {
            pub_key,
            amt: amount,
            route_hints
        }
    });
    return response;
};

/**
 * @throws
 */
export const decodePayReq = async (bolt11: string): Promise<lnrpc.PayReq> => {
    const response = await sendCommand<
        lnrpc.IPayReqString,
        lnrpc.PayReqString,
        lnrpc.PayReq
    >({
        request: lnrpc.PayReqString,
        response: lnrpc.PayReq,
        method: 'DecodePayReq',
        options: {
            pay_req: bolt11
        }
    });
    return response;
};

/**
 * @throws
 */
export const describeGraph = async (): Promise<lnrpc.ChannelGraph> => {
    const response = await sendCommand<
        lnrpc.IChannelGraphRequest,
        lnrpc.ChannelGraphRequest,
        lnrpc.ChannelGraph
    >({
        request: lnrpc.ChannelGraphRequest,
        response: lnrpc.ChannelGraph,
        method: 'DescribeGraph',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const getRecoveryInfo =
    async (): Promise<lnrpc.GetRecoveryInfoResponse> => {
        const response = await sendCommand<
            lnrpc.IGetRecoveryInfoRequest,
            lnrpc.GetRecoveryInfoRequest,
            lnrpc.GetRecoveryInfoResponse
        >({
            request: lnrpc.GetRecoveryInfoRequest,
            response: lnrpc.GetRecoveryInfoResponse,
            method: 'GetRecoveryInfo',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const listUnspent = async (): Promise<lnrpc.ListUnspentResponse> => {
    const response = await sendCommand<
        lnrpc.IListUnspentRequest,
        lnrpc.ListUnspentRequest,
        lnrpc.ListUnspentResponse
    >({
        request: lnrpc.ListUnspentRequest,
        response: lnrpc.ListUnspentResponse,
        method: 'WalletKitListUnspent',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const resetMissionControl =
    async (): Promise<routerrpc.ResetMissionControlResponse> => {
        const response = await sendCommand<
            routerrpc.IResetMissionControlRequest,
            routerrpc.ResetMissionControlRequest,
            routerrpc.ResetMissionControlResponse
        >({
            request: routerrpc.ResetMissionControlRequest,
            response: routerrpc.ResetMissionControlResponse,
            method: 'RouterResetMissionControl',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const getNetworkInfo = async (): Promise<lnrpc.NetworkInfo> => {
    const response = await sendCommand<
        lnrpc.INetworkInfoRequest,
        lnrpc.NetworkInfoRequest,
        lnrpc.NetworkInfo
    >({
        request: lnrpc.NetworkInfoRequest,
        response: lnrpc.NetworkInfo,
        method: 'GetNetworkInfo',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const listInvoices = async (): Promise<lnrpc.ListInvoiceResponse> => {
    const response = await sendCommand<
        lnrpc.IListInvoiceRequest,
        lnrpc.ListInvoiceRequest,
        lnrpc.ListInvoiceResponse
    >({
        request: lnrpc.ListInvoiceRequest,
        response: lnrpc.ListInvoiceResponse,
        method: 'ListInvoices',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const subscribeChannelGraph = async (): Promise<string> => {
    const response = await sendStreamCommand<
        lnrpc.IGraphTopologySubscription,
        lnrpc.GraphTopologySubscription
    >(
        {
            request: lnrpc.GraphTopologySubscription,
            method: 'SubscribeChannelGraph',
            options: {}
        },
        false
    );
    return response;
};

export type IReadLndLogResponse = string[];
/**
 * @throws
 * TODO remove
 */
export const readLndLog = async (): Promise<IReadLndLogResponse> => {
    return [''];
};
