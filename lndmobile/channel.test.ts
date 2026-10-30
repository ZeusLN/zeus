jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            sendCommand: jest.fn(),
            sendStreamCommand: jest.fn(),
            sendBidiStreamCommand: jest.fn(),
            writeToStream: jest.fn()
        }
    }
}));

import { NativeModules } from 'react-native';
import Long from 'long';
import {
    abandonChannel,
    channelAcceptor,
    channelAcceptorResponse,
    channelBalance,
    closeChannel,
    closedChannels,
    decodeChannelAcceptRequest,
    decodeChannelEvent,
    decodeOpenStatusUpdate,
    exportAllChannelBackups,
    getChanInfo,
    listChannels,
    listPrivateChannels,
    openChannel,
    openChannelAll,
    openChannelSync,
    pendingChannels,
    restoreChannelBackups,
    subscribeChannelEvents,
    updateChannelPolicy,
    verifyChanBackup
} from './channel';
import { lnrpc } from '../proto/lightning';

const LndMobile = NativeModules.LndMobile as unknown as {
    sendCommand: jest.Mock;
    sendStreamCommand: jest.Mock;
    sendBidiStreamCommand: jest.Mock;
    writeToStream: jest.Mock;
};

interface Decoder<T> {
    decode: (bytes: Uint8Array) => T;
}
interface Encoder<T> {
    encode: (message: T) => { finish: () => Uint8Array };
    create: (properties: any) => T;
}

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const fromBase64 = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));
const hex = (bytes?: Uint8Array | null) =>
    Buffer.from(bytes ?? new Uint8Array()).toString('hex');
// Long values print as exact decimal strings.
const str = (value: unknown) => String(value);
const bytesOf = (h: string) => Uint8Array.from(Buffer.from(h, 'hex'));

const encodeB64 = <T>(cls: Encoder<T>, properties: any) =>
    toBase64(cls.encode(cls.create(properties)).finish());

// Makes the native bridge return a real encoded protobuf response.
const respondWith = <T>(cls: Encoder<T>, properties: any) =>
    LndMobile.sendCommand.mockResolvedValueOnce({
        data: encodeB64(cls, properties)
    });

// Decodes the base64 request the module handed to the native bridge.
const sentRequest = <T>(mock: jest.Mock, cls: Decoder<T>, call = 0): T =>
    cls.decode(fromBase64(mock.mock.calls[call][1]));

const PUBKEY =
    '02eec7245d6b7d2ccb30380bfbe2a3648cd7a942653f5aa340edcea1f283686619';
const TXID = 'a3f1c2d4e5b6978812345678901234567890abcdefabcdefabcdefabcdef0102';
const UTXO_TXID =
    'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
// Larger than 2^53, so any number conversion would lose precision.
const BIG_CHAN_ID = '871026210119991297';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('openChannelSync', () => {
    it('encodes a non-taproot request and decodes the ChannelPoint', async () => {
        const txidBytes = bytesOf(TXID);
        respondWith(lnrpc.ChannelPoint, {
            funding_txid_bytes: txidBytes,
            output_index: 3
        });

        const result = await openChannelSync(
            PUBKEY,
            100000,
            true,
            5,
            true,
            0,
            true,
            false,
            false,
            [`${UTXO_TXID}:1`, `${TXID}:7`],
            'bc1qcloseaddress'
        );

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('OpenChannelSync');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.node_pubkey_string).toBe(PUBKEY);
        expect(req.node_pubkey).toHaveLength(0);
        expect(str(req.local_funding_amount)).toBe('100000');
        expect(str(req.sat_per_vbyte)).toBe('5');
        // A fee rate replaces the default confirmation target.
        expect(req.target_conf).toBe(0);
        expect(req.private).toBe(true);
        expect(req.scid_alias).toBe(true);
        expect(req.min_confs).toBe(0);
        expect(req.spend_unconfirmed).toBe(true);
        expect(req.fund_max).toBe(false);
        expect(req.close_address).toBe('bc1qcloseaddress');
        expect(req.commitment_type).toBe(
            lnrpc.CommitmentType.UNKNOWN_COMMITMENT_TYPE
        );
        expect(req.outpoints.map((o) => [o.txid_str, o.output_index])).toEqual([
            [UTXO_TXID, 1],
            [TXID, 7]
        ]);

        expect(result).toBeInstanceOf(lnrpc.ChannelPoint);
        expect(result.funding_txid).toBe('funding_txid_bytes');
        // Bytes come back in wire order; reversing to display order is the
        // caller's job.
        expect(hex(result.funding_txid_bytes)).toBe(TXID);
        expect(result.output_index).toBe(3);
    });

    it('sets the taproot commitment type and target_conf 2 without a fee rate', async () => {
        respondWith(lnrpc.ChannelPoint, {
            funding_txid_str: TXID,
            output_index: 0
        });

        const result = await openChannelSync(
            PUBKEY,
            250000,
            false,
            undefined,
            false,
            1,
            false,
            true,
            false,
            [`${UTXO_TXID}:0`, `${TXID}:9`],
            'bc1ptaprootclose'
        );

        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.commitment_type).toBe(lnrpc.CommitmentType.SIMPLE_TAPROOT);
        expect(req.target_conf).toBe(2);
        expect(req.sat_per_vbyte.isZero()).toBe(true);
        expect(str(req.local_funding_amount)).toBe('250000');
        expect(req.private).toBe(false);
        expect(req.min_confs).toBe(1);
        expect(req.fund_max).toBe(false);
        // Taproot builds its outpoints with a separate mapping.
        expect(req.outpoints.map((o) => [o.txid_str, o.output_index])).toEqual([
            [UTXO_TXID, 0],
            [TXID, 9]
        ]);
        expect(req.close_address).toBe('bc1ptaprootclose');

        expect(result.funding_txid).toBe('funding_txid_str');
        expect(result.funding_txid_str).toBe(TXID);
        expect(result.output_index).toBe(0);
    });

    it.each([
        [false, lnrpc.CommitmentType.UNKNOWN_COMMITMENT_TYPE],
        [true, lnrpc.CommitmentType.SIMPLE_TAPROOT]
    ])(
        'omits the funding amount when fund_max is set (taproot: %s)',
        async (simpleTaprootChannel, commitmentType) => {
            respondWith(lnrpc.ChannelPoint, {});

            await openChannelSync(
                PUBKEY,
                100000,
                false,
                undefined,
                undefined,
                undefined,
                undefined,
                simpleTaprootChannel,
                true
            );

            const req = sentRequest(
                LndMobile.sendCommand,
                lnrpc.OpenChannelRequest
            );
            expect(req.commitment_type).toBe(commitmentType);
            expect(req.fund_max).toBe(true);
            expect(req.local_funding_amount.isZero()).toBe(true);
            expect(req.outpoints).toEqual([]);
        }
    );

    it('decodes an empty native response to a default ChannelPoint', async () => {
        LndMobile.sendCommand.mockResolvedValueOnce({});

        const result = await openChannelSync(PUBKEY, 1000, false);

        expect(result).toBeInstanceOf(lnrpc.ChannelPoint);
        expect(result.output_index).toBe(0);
        expect(result.funding_txid).toBeUndefined();
    });

    it('propagates native errors', async () => {
        LndMobile.sendCommand.mockRejectedValueOnce(new Error('peer offline'));

        await expect(openChannelSync(PUBKEY, 1000, false)).rejects.toThrow(
            'peer offline'
        );
    });
});

describe('openChannelAll', () => {
    it('requests fund_max with scid_alias and decodes the ChannelPoint', async () => {
        respondWith(lnrpc.ChannelPoint, {
            funding_txid_str: TXID,
            output_index: 2
        });

        const result = await openChannelAll(PUBKEY, true, 12);

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('OpenChannelSync');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.node_pubkey_string).toBe(PUBKEY);
        expect(req.fund_max).toBe(true);
        expect(req.local_funding_amount.isZero()).toBe(true);
        expect(str(req.sat_per_vbyte)).toBe('12');
        expect(req.target_conf).toBe(0);
        expect(req.private).toBe(true);
        expect(req.scid_alias).toBe(true);

        expect(result.funding_txid_str).toBe(TXID);
        expect(result.output_index).toBe(2);
    });

    it('uses target_conf 2 when no fee rate is given', async () => {
        respondWith(lnrpc.ChannelPoint, {});

        await openChannelAll(PUBKEY, false);

        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.target_conf).toBe(2);
        expect(req.sat_per_vbyte.isZero()).toBe(true);
        expect(req.private).toBe(false);
    });
});

describe('openChannel', () => {
    it('encodes the pubkey as bytes and returns the stream response', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('stream-started');

        const result = await openChannel(
            PUBKEY,
            500000,
            true,
            3,
            true,
            0,
            true,
            false,
            false,
            [`${UTXO_TXID}:4`]
        );

        expect(result).toBe('stream-started');
        const [method, , streamOnlyOnce] =
            LndMobile.sendStreamCommand.mock.calls[0];
        expect(method).toBe('OpenChannel');
        expect(streamOnlyOnce).toBe(false);

        const req = sentRequest(
            LndMobile.sendStreamCommand,
            lnrpc.OpenChannelRequest
        );
        expect(hex(req.node_pubkey)).toBe(PUBKEY);
        expect(req.node_pubkey_string).toBe('');
        expect(str(req.local_funding_amount)).toBe('500000');
        expect(str(req.sat_per_vbyte)).toBe('3');
        expect(req.private).toBe(true);
        expect(req.scid_alias).toBe(true);
        expect(req.spend_unconfirmed).toBe(true);
        expect(req.commitment_type).toBe(
            lnrpc.CommitmentType.UNKNOWN_COMMITMENT_TYPE
        );
        expect(req.outpoints.map((o) => [o.txid_str, o.output_index])).toEqual([
            [UTXO_TXID, 4]
        ]);
        expect(req.funding_shim).toBeNull();
    });

    it('encodes a PSBT funding shim with a base64 pending_chan_id', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('');
        const pendingChanId = bytesOf('11'.repeat(16) + '22'.repeat(16));

        await openChannel(
            PUBKEY,
            100000,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
            false,
            undefined,
            {
                psbt_shim: {
                    base_psbt: '',
                    pending_chan_id: toBase64(pendingChanId),
                    no_publish: true
                }
            }
        );

        const req = sentRequest(
            LndMobile.sendStreamCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.commitment_type).toBe(lnrpc.CommitmentType.SIMPLE_TAPROOT);
        expect(req.funding_shim?.shim).toBe('psbt_shim');
        const shim = req.funding_shim?.psbt_shim as lnrpc.PsbtShim;
        expect(hex(shim.pending_chan_id)).toBe(hex(pendingChanId));
        expect(shim.base_psbt).toHaveLength(0);
        expect(shim.no_publish).toBe(true);
    });

    it('puts the close address in the request', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('');

        await openChannel(
            PUBKEY,
            100000,
            false,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            false,
            undefined,
            { psbt_shim: { base_psbt: '', pending_chan_id: '' } },
            'bc1qclose'
        );

        const req = sentRequest(
            LndMobile.sendStreamCommand,
            lnrpc.OpenChannelRequest
        );
        expect(req.close_address).toBe('bc1qclose');
    });
});

describe('closeChannel', () => {
    it('encodes the channel point, fee rate and delivery address', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('closing');

        const result = await closeChannel(
            TXID,
            1,
            false,
            7,
            'bc1qdeliveryaddress'
        );

        expect(result).toBe('closing');
        const [method, , streamOnlyOnce] =
            LndMobile.sendStreamCommand.mock.calls[0];
        expect(method).toBe('CloseChannel');
        expect(streamOnlyOnce).toBe(false);

        const req = sentRequest(
            LndMobile.sendStreamCommand,
            lnrpc.CloseChannelRequest
        );
        expect(req.channel_point?.funding_txid).toBe('funding_txid_str');
        expect(req.channel_point?.funding_txid_str).toBe(TXID);
        expect(req.channel_point?.output_index).toBe(1);
        expect(str(req.sat_per_vbyte)).toBe('7');
        expect(req.delivery_address).toBe('bc1qdeliveryaddress');
        expect(req.force).toBe(false);
    });

    it('encodes a force close without a fee rate', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('');

        await closeChannel(TXID, 0, true);

        const req = sentRequest(
            LndMobile.sendStreamCommand,
            lnrpc.CloseChannelRequest
        );
        expect(req.force).toBe(true);
        expect(req.sat_per_vbyte.isZero()).toBe(true);
        expect(req.delivery_address).toBe('');
        expect(req.channel_point?.output_index).toBe(0);
    });
});

describe('abandonChannel', () => {
    it('encodes the channel point and flags and decodes the status', async () => {
        respondWith(lnrpc.AbandonChannelResponse, { status: 'abandoned' });

        const result = await abandonChannel(TXID, 2, true, true);

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('AbandonChannel');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.AbandonChannelRequest
        );
        expect(req.channel_point?.funding_txid_str).toBe(TXID);
        expect(req.channel_point?.output_index).toBe(2);
        expect(req.pending_funding_shim_only).toBe(true);
        expect(req.i_know_what_i_am_doing).toBe(true);

        expect(result).toBeInstanceOf(lnrpc.AbandonChannelResponse);
        expect(result.status).toBe('abandoned');
    });

    it('leaves unset flags at their false defaults', async () => {
        respondWith(lnrpc.AbandonChannelResponse, {});

        await abandonChannel(TXID, 0);

        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.AbandonChannelRequest
        );
        expect(req.pending_funding_shim_only).toBe(false);
        expect(req.i_know_what_i_am_doing).toBe(false);
    });
});

describe('updateChannelPolicy', () => {
    it('encodes a per-channel policy and decodes failed updates', async () => {
        respondWith(lnrpc.PolicyUpdateResponse, {
            failed_updates: [
                {
                    outpoint: { txid_str: TXID, output_index: 1 },
                    reason: lnrpc.UpdateFailure.UPDATE_FAILURE_NOT_FOUND,
                    update_error: 'unable to find channel'
                }
            ]
        });

        const result = await updateChannelPolicy({
            base_fee_msat: '1000',
            fee_rate_ppm: 250,
            time_lock_delta: 80,
            min_htlc_msat: '1',
            min_htlc_msat_specified: true,
            // Above 2^53, so a lossy number conversion would show up.
            max_htlc_msat: '9007199254740993',
            chan_point: { funding_txid_str: TXID, output_index: 1 },
            create_missing_edge: true
        });

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe(
            'UpdateChannelPolicy'
        );
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.PolicyUpdateRequest
        );
        expect(req.scope).toBe('chan_point');
        expect(req.chan_point?.funding_txid_str).toBe(TXID);
        expect(req.chan_point?.output_index).toBe(1);
        expect(str(req.base_fee_msat)).toBe('1000');
        expect(req.fee_rate_ppm).toBe(250);
        expect(req.fee_rate).toBe(0);
        expect(req.time_lock_delta).toBe(80);
        expect(str(req.min_htlc_msat)).toBe('1');
        expect(req.min_htlc_msat_specified).toBe(true);
        expect(str(req.max_htlc_msat)).toBe('9007199254740993');
        expect(req.create_missing_edge).toBe(true);

        expect(result.failed_updates).toHaveLength(1);
        const failed = result.failed_updates[0];
        expect(failed.outpoint?.txid_str).toBe(TXID);
        expect(failed.outpoint?.output_index).toBe(1);
        expect(failed.reason).toBe(
            lnrpc.UpdateFailure.UPDATE_FAILURE_NOT_FOUND
        );
        expect(failed.update_error).toBe('unable to find channel');
    });

    it('prefers the global scope over a channel point', async () => {
        respondWith(lnrpc.PolicyUpdateResponse, {});

        const result = await updateChannelPolicy({
            fee_rate_ppm: 1,
            global: true,
            chan_point: { funding_txid_str: TXID, output_index: 0 }
        });

        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.PolicyUpdateRequest
        );
        expect(req.scope).toBe('global');
        expect(req.global).toBe(true);
        expect(req.chan_point).toBeNull();
        expect(req.base_fee_msat.isZero()).toBe(true);
        expect(req.max_htlc_msat.isZero()).toBe(true);
        expect(req.min_htlc_msat_specified).toBe(false);

        expect(result.failed_updates).toEqual([]);
    });
});

describe('pendingChannels', () => {
    it('sends an empty request and decodes pending opens', async () => {
        respondWith(lnrpc.PendingChannelsResponse, {
            total_limbo_balance: Long.fromValue(42000),
            pending_open_channels: [
                {
                    channel: {
                        remote_node_pub: PUBKEY,
                        channel_point: `${TXID}:0`,
                        capacity: Long.fromValue(1000000),
                        local_balance: Long.fromValue(990000),
                        private: true
                    },
                    commit_fee: Long.fromValue(9050)
                }
            ]
        });

        const result = await pendingChannels();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('PendingChannels');
        expect(LndMobile.sendCommand.mock.calls[0][1]).toBe('');

        expect(str(result.total_limbo_balance)).toBe('42000');
        expect(result.pending_open_channels).toHaveLength(1);
        const open = result.pending_open_channels[0];
        expect(open.channel?.remote_node_pub).toBe(PUBKEY);
        expect(open.channel?.channel_point).toBe(`${TXID}:0`);
        expect(str(open.channel?.capacity)).toBe('1000000');
        expect(str(open.channel?.local_balance)).toBe('990000');
        expect(open.channel?.private).toBe(true);
        expect(str(open.commit_fee)).toBe('9050');
        expect(result.waiting_close_channels).toEqual([]);
    });
});

describe('listChannels', () => {
    it('does not filter to private channels and decodes 64-bit ids', async () => {
        respondWith(lnrpc.ListChannelsResponse, {
            channels: [
                {
                    remote_pubkey: PUBKEY,
                    channel_point: `${TXID}:1`,
                    chan_id: BIG_CHAN_ID,
                    capacity: Long.fromValue(2000000),
                    local_balance: Long.fromValue(1500000),
                    remote_balance: Long.fromValue(496530),
                    active: true
                }
            ]
        });

        const result = await listChannels();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('ListChannels');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.ListChannelsRequest
        );
        expect(req.private_only).toBe(false);

        expect(result.channels).toHaveLength(1);
        const chan = result.channels[0];
        expect(chan.remote_pubkey).toBe(PUBKEY);
        expect(chan.channel_point).toBe(`${TXID}:1`);
        expect(str(chan.chan_id)).toBe(BIG_CHAN_ID);
        expect(str(chan.capacity)).toBe('2000000');
        expect(str(chan.local_balance)).toBe('1500000');
        expect(str(chan.remote_balance)).toBe('496530');
        expect(chan.active).toBe(true);
    });
});

describe('listPrivateChannels', () => {
    it('sets private_only and decodes the channel list', async () => {
        respondWith(lnrpc.ListChannelsResponse, {
            channels: [{ remote_pubkey: PUBKEY, private: true }]
        });

        const result = await listPrivateChannels();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('ListChannels');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.ListChannelsRequest
        );
        expect(req.private_only).toBe(true);
        expect(req.public_only).toBe(false);

        expect(result.channels.map((c) => c.private)).toEqual([true]);
    });
});

describe('closedChannels', () => {
    it('decodes close summaries', async () => {
        respondWith(lnrpc.ClosedChannelsResponse, {
            channels: [
                {
                    channel_point: `${TXID}:0`,
                    chan_id: BIG_CHAN_ID,
                    closing_tx_hash: UTXO_TXID,
                    settled_balance: Long.fromValue(123456),
                    close_type:
                        lnrpc.ChannelCloseSummary.ClosureType.REMOTE_FORCE_CLOSE
                }
            ]
        });

        const result = await closedChannels();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('ClosedChannels');
        expect(LndMobile.sendCommand.mock.calls[0][1]).toBe('');

        const summary = result.channels[0];
        expect(summary.channel_point).toBe(`${TXID}:0`);
        expect(str(summary.chan_id)).toBe(BIG_CHAN_ID);
        expect(summary.closing_tx_hash).toBe(UTXO_TXID);
        expect(str(summary.settled_balance)).toBe('123456');
        expect(summary.close_type).toBe(
            lnrpc.ChannelCloseSummary.ClosureType.REMOTE_FORCE_CLOSE
        );
    });
});

describe('channelBalance', () => {
    it('decodes sat and msat amounts', async () => {
        respondWith(lnrpc.ChannelBalanceResponse, {
            balance: Long.fromValue(150000),
            local_balance: {
                sat: Long.fromValue(150000),
                msat: Long.fromValue(150000123)
            },
            remote_balance: {
                sat: Long.fromValue(50000),
                msat: Long.fromValue(50000000)
            },
            pending_open_local_balance: {
                sat: Long.fromValue(1000),
                msat: Long.fromValue(1000000)
            }
        });

        const result = await channelBalance();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('ChannelBalance');
        expect(str(result.balance)).toBe('150000');
        expect(str(result.local_balance?.sat)).toBe('150000');
        expect(str(result.local_balance?.msat)).toBe('150000123');
        expect(str(result.remote_balance?.sat)).toBe('50000');
        expect(str(result.remote_balance?.msat)).toBe('50000000');
        expect(str(result.pending_open_local_balance?.sat)).toBe('1000');
        expect(result.unsettled_local_balance).toBeNull();
    });
});

describe('subscribeChannelEvents', () => {
    it('opens a persistent SubscribeChannelEvents stream', async () => {
        LndMobile.sendStreamCommand.mockResolvedValueOnce('subscribed');

        const result = await subscribeChannelEvents();

        expect(result).toBe('subscribed');
        expect(LndMobile.sendStreamCommand).toHaveBeenCalledWith(
            'SubscribeChannelEvents',
            '',
            false
        );
    });
});

describe('exportAllChannelBackups', () => {
    it('decodes the multi-channel backup bytes and channel points', async () => {
        const blob = bytesOf('deadbeef00ff');
        respondWith(lnrpc.ChanBackupSnapshot, {
            multi_chan_backup: {
                chan_points: [{ funding_txid_bytes: bytesOf(TXID) }],
                multi_chan_backup: blob
            }
        });

        const result = await exportAllChannelBackups();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe(
            'ExportAllChannelBackups'
        );
        expect(LndMobile.sendCommand.mock.calls[0][1]).toBe('');

        expect(hex(result.multi_chan_backup!.multi_chan_backup)).toBe(
            'deadbeef00ff'
        );
        const points = result.multi_chan_backup!.chan_points ?? [];
        expect(points).toHaveLength(1);
        expect(hex(points[0].funding_txid_bytes)).toBe(TXID);
        expect(result.single_chan_backups).toBeNull();
    });
});

describe('restoreChannelBackups', () => {
    it('sends the decoded backup bytes and decodes num_restored', async () => {
        const blob = bytesOf('0102030405fffe');
        respondWith(lnrpc.RestoreBackupResponse, { num_restored: 3 });

        const result = await restoreChannelBackups(toBase64(blob));

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe(
            'RestoreChannelBackups'
        );
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.RestoreChanBackupRequest
        );
        expect(req.backup).toBe('multi_chan_backup');
        expect(hex(req.multi_chan_backup)).toBe('0102030405fffe');

        expect(result).toBeInstanceOf(lnrpc.RestoreBackupResponse);
        expect(result.num_restored).toBe(3);
    });
});

describe('verifyChanBackup', () => {
    it('wraps the backup bytes in a snapshot and decodes chan_points', async () => {
        const blob = bytesOf('cafebabe');
        respondWith(lnrpc.VerifyChanBackupResponse, {
            chan_points: [`${TXID}:0`, `${UTXO_TXID}:1`]
        });

        const result = await verifyChanBackup(toBase64(blob));

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('VerifyChanBackup');
        const req = sentRequest(
            LndMobile.sendCommand,
            lnrpc.ChanBackupSnapshot
        );
        expect(hex(req.multi_chan_backup!.multi_chan_backup)).toBe('cafebabe');
        expect(req.multi_chan_backup!.chan_points).toEqual([]);
        expect(req.single_chan_backups).toBeNull();

        expect(result.chan_points).toEqual([`${TXID}:0`, `${UTXO_TXID}:1`]);
    });
});

describe('getChanInfo', () => {
    const edge = {
        channel_id: BIG_CHAN_ID,
        chan_point: `${TXID}:0`,
        node1_pub: PUBKEY,
        capacity: Long.fromValue(5000000),
        node1_policy: {
            time_lock_delta: 80,
            fee_base_msat: Long.fromValue(1000),
            fee_rate_milli_msat: Long.fromValue(1),
            max_htlc_msat: Long.fromString('4950000000', true)
        }
    };

    it('encodes a Long chan_id without precision loss and decodes the edge', async () => {
        respondWith(lnrpc.ChannelEdge, edge);

        const result = await getChanInfo(Long.fromString(BIG_CHAN_ID, true));

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('GetChanInfo');
        const req = sentRequest(LndMobile.sendCommand, lnrpc.ChanInfoRequest);
        expect(str(req.chan_id)).toBe(BIG_CHAN_ID);

        expect(str(result.channel_id)).toBe(BIG_CHAN_ID);
        expect(result.chan_point).toBe(`${TXID}:0`);
        expect(result.node1_pub).toBe(PUBKEY);
        expect(str(result.capacity)).toBe('5000000');
        expect(result.node1_policy?.time_lock_delta).toBe(80);
        expect(str(result.node1_policy?.fee_base_msat)).toBe('1000');
        expect(str(result.node1_policy?.fee_rate_milli_msat)).toBe('1');
        expect(str(result.node1_policy?.max_htlc_msat)).toBe('4950000000');
        expect(result.node2_policy).toBeNull();
    });

    it('accepts the string chan_id that EmbeddedLND passes', async () => {
        respondWith(lnrpc.ChannelEdge, edge);

        await getChanInfo(BIG_CHAN_ID as unknown as Long);

        const req = sentRequest(LndMobile.sendCommand, lnrpc.ChanInfoRequest);
        expect(str(req.chan_id)).toBe(BIG_CHAN_ID);
    });
});

describe('channelAcceptor', () => {
    it('opens a persistent ChannelAcceptor bidi stream', async () => {
        LndMobile.sendBidiStreamCommand.mockResolvedValueOnce('acceptor');

        const result = await channelAcceptor();

        expect(result).toBe('acceptor');
        expect(LndMobile.sendBidiStreamCommand).toHaveBeenCalledWith(
            'ChannelAcceptor',
            false
        );
    });
});

describe('channelAcceptorResponse', () => {
    const pendingChanId = bytesOf('ab'.repeat(32));

    it('writes an accept with zero_conf to the ChannelAcceptor stream', async () => {
        await channelAcceptorResponse(pendingChanId, true, true);

        expect(LndMobile.writeToStream.mock.calls[0][0]).toBe(
            'ChannelAcceptor'
        );
        const req = sentRequest(
            LndMobile.writeToStream,
            lnrpc.ChannelAcceptResponse
        );
        expect(req.accept).toBe(true);
        expect(hex(req.pending_chan_id)).toBe('ab'.repeat(32));
        expect(req.zero_conf).toBe(true);
        expect(req.error).toBe('');
    });

    it('defaults zero_conf to false', async () => {
        await channelAcceptorResponse(pendingChanId, false);

        const req = sentRequest(
            LndMobile.writeToStream,
            lnrpc.ChannelAcceptResponse
        );
        expect(req.accept).toBe(false);
        expect(req.zero_conf).toBe(false);
    });
});

describe('decodeChannelAcceptRequest', () => {
    it('decodes pubkey bytes, amounts and flags', () => {
        const data = encodeB64(lnrpc.ChannelAcceptRequest, {
            node_pubkey: bytesOf(PUBKEY),
            pending_chan_id: bytesOf('cd'.repeat(32)),
            funding_amt: Long.fromString('100000', true),
            push_amt: Long.fromString('0', true),
            commitment_type: lnrpc.CommitmentType.ANCHORS,
            wants_zero_conf: true,
            wants_scid_alias: true
        });

        const result = decodeChannelAcceptRequest(data);

        expect(result).toBeInstanceOf(lnrpc.ChannelAcceptRequest);
        expect(hex(result.node_pubkey)).toBe(PUBKEY);
        expect(hex(result.pending_chan_id)).toBe('cd'.repeat(32));
        expect(str(result.funding_amt)).toBe('100000');
        expect(result.push_amt.isZero()).toBe(true);
        expect(result.commitment_type).toBe(lnrpc.CommitmentType.ANCHORS);
        expect(result.wants_zero_conf).toBe(true);
        expect(result.wants_scid_alias).toBe(true);
    });
});

describe('decodeChannelEvent', () => {
    it('decodes an open channel event', () => {
        const data = encodeB64(lnrpc.ChannelEventUpdate, {
            type: lnrpc.ChannelEventUpdate.UpdateType.OPEN_CHANNEL,
            open_channel: {
                remote_pubkey: PUBKEY,
                chan_id: BIG_CHAN_ID,
                capacity: Long.fromValue(1000000)
            }
        });

        const result = decodeChannelEvent(data);

        expect(result.type).toBe(
            lnrpc.ChannelEventUpdate.UpdateType.OPEN_CHANNEL
        );
        expect(result.channel).toBe('open_channel');
        expect(result.open_channel?.remote_pubkey).toBe(PUBKEY);
        expect(str(result.open_channel?.chan_id)).toBe(BIG_CHAN_ID);
        expect(str(result.open_channel?.capacity)).toBe('1000000');
    });

    it('decodes an inactive channel event with a txid-bytes channel point', () => {
        const data = encodeB64(lnrpc.ChannelEventUpdate, {
            type: lnrpc.ChannelEventUpdate.UpdateType.INACTIVE_CHANNEL,
            inactive_channel: {
                funding_txid_bytes: bytesOf(TXID),
                output_index: 5
            }
        });

        const result = decodeChannelEvent(data);

        expect(result.channel).toBe('inactive_channel');
        expect(hex(result.inactive_channel?.funding_txid_bytes)).toBe(TXID);
        expect(result.inactive_channel?.output_index).toBe(5);
        expect(result.open_channel).toBeNull();
    });
});

describe('decodeOpenStatusUpdate', () => {
    it('decodes a chan_pending update with txid bytes in wire order', () => {
        const data = encodeB64(lnrpc.OpenStatusUpdate, {
            chan_pending: { txid: bytesOf(TXID), output_index: 1 },
            pending_chan_id: bytesOf('ef'.repeat(32))
        });

        const result = decodeOpenStatusUpdate(data);

        expect(result.update).toBe('chan_pending');
        expect(hex(result.chan_pending!.txid)).toBe(TXID);
        expect(result.chan_pending!.output_index).toBe(1);
        expect(hex(result.pending_chan_id)).toBe('ef'.repeat(32));
    });

    it('decodes a psbt_fund update', () => {
        const data = encodeB64(lnrpc.OpenStatusUpdate, {
            psbt_fund: {
                funding_address: 'bcrt1qfundingaddress',
                funding_amount: Long.fromValue(200000),
                psbt: bytesOf('70736274ff')
            }
        });

        const result = decodeOpenStatusUpdate(data);

        expect(result.update).toBe('psbt_fund');
        expect(result.psbt_fund?.funding_address).toBe('bcrt1qfundingaddress');
        expect(str(result.psbt_fund?.funding_amount)).toBe('200000');
        expect(hex(result.psbt_fund!.psbt)).toBe('70736274ff');
        expect(result.chan_pending).toBeNull();
    });
});
