import {
    sendCommand,
    sendStreamCommand,
    decodeStreamResult,
    sendBidiStreamCommand,
    writeToStream
} from './utils';
import { lnrpc } from './../proto/lightning';
import Long from 'long';
import * as base64 from 'base64-js';

/**
 * @throws
 */
export const openChannel = async (
    pubkey: string,
    amount: number,
    private_channel: boolean,
    fee_rate_sat?: number
): Promise<lnrpc.ChannelPoint> => {
    const response = await sendCommand<
        lnrpc.IOpenChannelRequest,
        lnrpc.OpenChannelRequest,
        lnrpc.ChannelPoint
    >({
        request: lnrpc.OpenChannelRequest,
        response: lnrpc.ChannelPoint,
        method: 'OpenChannelSync',
        options: {
            node_pubkey_string: pubkey,
            local_funding_amount: Long.fromValue(amount),
            target_conf: fee_rate_sat ? undefined : 2,
            private: private_channel,
            sat_per_byte: fee_rate_sat
                ? Long.fromValue(fee_rate_sat)
                : undefined,
            scid_alias: true
        }
    });
    return response;
};

/**
 * @throws
 */
export const openChannelAll = async (
    pubkey: string,
    private_channel: boolean,
    fee_rate_sat?: number
): Promise<lnrpc.ChannelPoint> => {
    const response = await sendCommand<
        lnrpc.IOpenChannelRequest,
        lnrpc.OpenChannelRequest,
        lnrpc.ChannelPoint
    >({
        request: lnrpc.OpenChannelRequest,
        response: lnrpc.ChannelPoint,
        method: 'OpenChannelSync',
        options: {
            node_pubkey_string: pubkey,
            fund_max: true,
            target_conf: fee_rate_sat ? undefined : 2,
            private: private_channel,
            sat_per_byte: fee_rate_sat
                ? Long.fromValue(fee_rate_sat)
                : undefined,
            scid_alias: true
        }
    });
    return response;
};

/**
 * @throws
 * TODO implement
 */
export const closeChannel = async (
    funding_txid: string,
    output_index: number,
    force: boolean
): Promise<string> => {
    const response = await sendStreamCommand<
        lnrpc.ICloseChannelRequest,
        lnrpc.CloseChannelRequest
    >(
        {
            request: lnrpc.CloseChannelRequest,
            method: 'CloseChannel',
            options: {
                channel_point: {
                    funding_txid_str: funding_txid,
                    output_index
                },
                force
            }
        },
        false
    );
    return response;
};

/**
 * @throws
 * TODO implement
 */
export const abandonChannel = async (
    funding_txid: string,
    output_index: number
): Promise<lnrpc.AbandonChannelResponse> => {
    const response = await sendCommand<
        lnrpc.IAbandonChannelRequest,
        lnrpc.AbandonChannelRequest,
        lnrpc.AbandonChannelResponse
    >({
        request: lnrpc.AbandonChannelRequest,
        response: lnrpc.AbandonChannelResponse,
        method: 'AbandonChannel',
        options: {
            channel_point: {
                funding_txid_str: funding_txid,
                output_index
            }
        }
    });
    return response;
};
/**
 * @throws
 */
export const pendingChannels =
    async (): Promise<lnrpc.PendingChannelsResponse> => {
        const response = await sendCommand<
            lnrpc.IPendingChannelsRequest,
            lnrpc.PendingChannelsRequest,
            lnrpc.PendingChannelsResponse
        >({
            request: lnrpc.PendingChannelsRequest,
            response: lnrpc.PendingChannelsResponse,
            method: 'PendingChannels',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const listChannels = async (): Promise<lnrpc.ListChannelsResponse> => {
    const response = await sendCommand<
        lnrpc.IListChannelsRequest,
        lnrpc.ListChannelsRequest,
        lnrpc.ListChannelsResponse
    >({
        request: lnrpc.ListChannelsRequest,
        response: lnrpc.ListChannelsResponse,
        method: 'ListChannels',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const closedChannels =
    async (): Promise<lnrpc.ClosedChannelsResponse> => {
        const response = await sendCommand<
            lnrpc.IClosedChannelsRequest,
            lnrpc.ClosedChannelsRequest,
            lnrpc.ClosedChannelsResponse
        >({
            request: lnrpc.ClosedChannelsRequest,
            response: lnrpc.ClosedChannelsResponse,
            method: 'ClosedChannels',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const listPrivateChannels =
    async (): Promise<lnrpc.ListChannelsResponse> => {
        const response = await sendCommand<
            lnrpc.IListChannelsRequest,
            lnrpc.ListChannelsRequest,
            lnrpc.ListChannelsResponse
        >({
            request: lnrpc.ListChannelsRequest,
            response: lnrpc.ListChannelsResponse,
            method: 'ListChannels',
            options: {
                private_only: true
            }
        });
        return response;
    };

/**
 * @throws
 */
export const channelBalance =
    async (): Promise<lnrpc.ChannelBalanceResponse> => {
        const response = await sendCommand<
            lnrpc.IChannelBalanceRequest,
            lnrpc.ChannelBalanceRequest,
            lnrpc.ChannelBalanceResponse
        >({
            request: lnrpc.ChannelBalanceRequest,
            response: lnrpc.ChannelBalanceResponse,
            method: 'ChannelBalance',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const subscribeChannelEvents = async (): Promise<string> => {
    const response = await sendStreamCommand<
        lnrpc.IChannelEventSubscription,
        lnrpc.ChannelEventSubscription
    >(
        {
            request: lnrpc.ChannelEventSubscription,
            method: 'SubscribeChannelEvents',
            options: {}
        },
        false
    );
    return response;
};

/**
 * @throws
 */
export const exportAllChannelBackups =
    async (): Promise<lnrpc.ChanBackupSnapshot> => {
        const response = await sendCommand<
            lnrpc.IChanBackupExportRequest,
            lnrpc.ChanBackupExportRequest,
            lnrpc.ChanBackupSnapshot
        >({
            request: lnrpc.ChanBackupExportRequest,
            response: lnrpc.ChanBackupSnapshot,
            method: 'ExportAllChannelBackups',
            options: {}
        });
        return response;
    };

/**
 * @throws
 */
export const verifyChanBackup = async (
    channels_backup_base64: string
): Promise<lnrpc.VerifyChanBackupResponse> => {
    const response = await sendCommand<
        lnrpc.IChanBackupSnapshot,
        lnrpc.ChanBackupSnapshot,
        lnrpc.VerifyChanBackupResponse
    >({
        request: lnrpc.ChanBackupSnapshot,
        response: lnrpc.VerifyChanBackupResponse,
        method: 'VerifyChanBackup',
        options: {
            multi_chan_backup: {
                multi_chan_backup: base64.toByteArray(channels_backup_base64)
            }
        }
    });
    return response;
};

/**
 * @throws
 */
export const getChanInfo = async (
    chan_id: Long
): Promise<lnrpc.ChannelEdge> => {
    const response = await sendCommand<
        lnrpc.IChanInfoRequest,
        lnrpc.ChanInfoRequest,
        lnrpc.ChannelEdge
    >({
        request: lnrpc.ChanInfoRequest,
        response: lnrpc.ChannelEdge,
        method: 'GetChanInfo',
        options: {
            chan_id
        }
    });
    return response;
};

export const channelAcceptor = async () => {
    return await sendBidiStreamCommand('ChannelAcceptor');
};

export const channelAcceptorResponse = async (
    pending_chan_id: Uint8Array,
    accept: boolean,
    zero_conf: boolean = false
) => {
    return await writeToStream({
        method: 'ChannelAcceptor',
        request: lnrpc.ChannelAcceptResponse,
        options: {
            accept,
            pending_chan_id,
            zero_conf
        }
    });
};

export const decodeChannelAcceptRequest = (
    data: string
): lnrpc.ChannelAcceptRequest => {
    return decodeStreamResult<lnrpc.ChannelAcceptRequest>({
        response: lnrpc.ChannelAcceptRequest,
        base64Result: data
    });
};

// TODO error handling
export const decodeChannelEvent = (data: string): lnrpc.ChannelEventUpdate => {
    return decodeStreamResult<lnrpc.ChannelEventUpdate>({
        response: lnrpc.ChannelEventUpdate,
        base64Result: data
    });
};
