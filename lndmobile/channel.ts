import {
    sendCommand,
    sendStreamCommand,
    decodeStreamResult,
    sendBidiStreamCommand,
    writeToStream
} from './utils';
import { lnrpc } from './../proto/lightning';
import Long from 'long';
import Base64Utils from '../utils/Base64Utils';

/**
 * @throws
 */
export const openChannelSync = async (
    pubkey: string,
    amount: number,
    private_channel: boolean,
    fee_rate_sat?: number,
    scidAlias?: boolean,
    min_confs?: number,
    spend_unconfirmed?: boolean,
    simpleTaprootChannel?: boolean,
    fund_max?: boolean,
    utxos?: Array<string>
): Promise<lnrpc.ChannelPoint> => {
    const response = await sendCommand<
        lnrpc.IOpenChannelRequest,
        lnrpc.OpenChannelRequest,
        lnrpc.ChannelPoint
    >({
        request: lnrpc.OpenChannelRequest,
        response: lnrpc.ChannelPoint,
        method: 'OpenChannelSync',
        options: simpleTaprootChannel
            ? {
                  node_pubkey_string: pubkey,
                  local_funding_amount: amount
                      ? Long.fromValue(amount)
                      : undefined,
                  target_conf: fee_rate_sat ? undefined : 2,
                  private: private_channel,
                  sat_per_vbyte: fee_rate_sat
                      ? Long.fromValue(fee_rate_sat)
                      : undefined,
                  scid_alias: scidAlias,
                  min_confs,
                  spend_unconfirmed,
                  fund_max,
                  outpoints: utxos
                      ? utxos.map((utxo: string) => {
                            const [txid_str, output_index] = utxo.split(':');
                            return {
                                txid_str,
                                output_index: Number(output_index)
                            };
                        })
                      : undefined,
                  commitment_type: lnrpc.CommitmentType.SIMPLE_TAPROOT
              }
            : {
                  node_pubkey_string: pubkey,
                  local_funding_amount: amount
                      ? Long.fromValue(amount)
                      : undefined,
                  target_conf: fee_rate_sat ? undefined : 2,
                  private: private_channel,
                  sat_per_vbyte: fee_rate_sat
                      ? Long.fromValue(fee_rate_sat)
                      : undefined,
                  scid_alias: scidAlias,
                  min_confs,
                  spend_unconfirmed,
                  outpoints: utxos
                      ? utxos.map((utxo: string) => {
                            const [txid_str, output_index] = utxo.split(':');
                            return {
                                txid_str,
                                output_index: Number(output_index)
                            };
                        })
                      : undefined,
                  fund_max
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
            sat_per_vbyte: fee_rate_sat
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
export const openChannel = async (
    pubkey: string,
    amount: number,
    private_channel: boolean,
    fee_rate_sat?: number,
    scidAlias?: boolean,
    min_confs?: number,
    spend_unconfirmed?: boolean,
    simpleTaprootChannel?: boolean,
    fund_max?: boolean,
    utxos?: Array<string>,
    funding_shim?: any
): Promise<string> => {
    let options: any = {
        node_pubkey: Base64Utils.hexToBase64(pubkey),
        local_funding_amount: amount ? Long.fromValue(amount) : undefined,
        private: private_channel,
        sat_per_vbyte: fee_rate_sat ? Long.fromValue(fee_rate_sat) : undefined,
        scid_alias: scidAlias,
        min_confs,
        spend_unconfirmed,
        fund_max,
        outpoints: utxos
            ? utxos.map((utxo: string) => {
                  const [txid_str, output_index] = utxo.split(':');
                  return {
                      txid_str,
                      output_index: Number(output_index)
                  };
              })
            : undefined,
        funding_shim
    };

    if (simpleTaprootChannel)
        options.commitment_type = lnrpc.CommitmentType.SIMPLE_TAPROOT;
    const response = await sendStreamCommand<
        lnrpc.IOpenChannelRequest,
        lnrpc.OpenChannelRequest
    >({
        request: lnrpc.OpenChannelRequest,
        method: 'OpenChannel',
        options
    });
    return response;
};

/**
 * @throws
 */
export const closeChannel = async (
    funding_txid: string,
    output_index: number,
    force?: boolean,
    sat_per_vbyte?: number,
    delivery_address?: string
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
                sat_per_vbyte: sat_per_vbyte
                    ? Long.fromValue(sat_per_vbyte)
                    : undefined,
                delivery_address,
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
export const exportAllChannelBackups = (): Promise<lnrpc.ChanBackupSnapshot> =>
    sendCommand<
        lnrpc.IChanBackupExportRequest,
        lnrpc.ChanBackupExportRequest,
        lnrpc.ChanBackupSnapshot
    >({
        request: lnrpc.ChanBackupExportRequest,
        response: lnrpc.ChanBackupSnapshot,
        method: 'ExportAllChannelBackups',
        options: {}
    });

/**
 * @throws
 */
export const restoreChannelBackups = async (
    channels_backup_base64: string
): Promise<lnrpc.RestoreBackupResponse> => {
    const response = await sendCommand<
        lnrpc.IRestoreChanBackupRequest,
        lnrpc.RestoreChanBackupRequest,
        lnrpc.RestoreBackupResponse
    >({
        request: lnrpc.RestoreChanBackupRequest,
        response: lnrpc.RestoreBackupResponse,
        method: 'RestoreChannelBackups',
        options: {
            multi_chan_backup: Base64Utils.base64ToBytes(channels_backup_base64)
        }
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
                multi_chan_backup: Base64Utils.base64ToBytes(
                    channels_backup_base64
                )
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

export const decodeChannelEvent = (data: string): lnrpc.ChannelEventUpdate => {
    return decodeStreamResult<lnrpc.ChannelEventUpdate>({
        response: lnrpc.ChannelEventUpdate,
        base64Result: data
    });
};

export const decodeOpenStatusUpdate = (
    data: string
): lnrpc.OpenStatusUpdate => {
    return decodeStreamResult<lnrpc.OpenStatusUpdate>({
        response: lnrpc.OpenStatusUpdate,
        base64Result: data
    });
};
