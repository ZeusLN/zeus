import * as bitcoin from 'bitcoinjs-lib';

import { randomBytes } from './RandomUtils';
import { LookupOptions, lookUpWithRetries } from './RequestTimeoutUtils';

// Like an on-chain send, an OpenChannelSync request that timed out may
// still have opened the channel: lnd keeps negotiating with the peer and
// broadcasts the funding transaction after the client stops waiting. Each
// open on an LND node carries a unique memo, which lnd stores with the
// channel, so the channel can be found before anyone is offered a retry.

export const OPEN_MEMO_PREFIX = 'ZEUS open ';

export const makeOpenMemo = (): string =>
    `${OPEN_MEMO_PREFIX}${randomBytes(8).toString('hex')}`;

export interface OpenedChannel {
    funding_txid_str: string;
    output_index: number;
}

const fromChannelPoint = (channelPoint?: string): OpenedChannel | undefined => {
    const [txid, index] = (channelPoint || '').split(':');
    if (!txid || index === undefined || index === '') return undefined;
    return { funding_txid_str: txid, output_index: Number(index) };
};

// Looks for the channel with the memo among the pending channels, then
// among the open ones (a zero-conf channel, or one that confirmed while
// the app waited).
export const findChannelByMemo = (
    getPendingChannels: () => Promise<any>,
    getChannels: () => Promise<any>,
    memo: string,
    options?: LookupOptions
): Promise<OpenedChannel | undefined> =>
    lookUpWithRetries(async () => {
        const pending = await getPendingChannels();
        const pendingMatch = (pending?.pending_open_channels || []).find(
            (pendingChannel: any) => pendingChannel?.channel?.memo === memo
        );
        if (pendingMatch) {
            return fromChannelPoint(pendingMatch.channel.channel_point);
        }

        const open = await getChannels();
        const openMatch = (open?.channels || []).find(
            (channel: any) => channel?.memo === memo
        );
        return openMatch
            ? fromChannelPoint(openMatch.channel_point)
            : undefined;
    }, options);

const toPsbtBuffer = (psbt: string | Uint8Array): Buffer =>
    typeof psbt === 'string'
        ? Buffer.from(psbt, /^[0-9a-f]+$/i.test(psbt) ? 'hex' : 'base64')
        : Buffer.from(psbt);

// the output script of a SegWit address on any network: funding outputs
// are P2WSH, or P2TR for taproot channels
const segwitOutputScript = (address: string): Buffer => {
    const { version, data } = bitcoin.address.fromBech32(address);
    return bitcoin.script.compile([
        version === 0
            ? bitcoin.opcodes.OP_0
            : bitcoin.opcodes.OP_1 + version - 1,
        data
    ]);
};

// The funding outpoints of the given channel addresses in a funded PSBT.
// lnd keys a channel that passed psbt_verify by the txid of the PSBT's
// unsigned transaction, which differs from the signed one for a nested
// SegWit input, so that txid is used. Addresses the transaction does not
// pay are skipped.
export const getFundingOutpoints = (
    psbt: string | Uint8Array,
    fundingAddresses: Array<string>
): Array<OpenedChannel> => {
    const tx = bitcoin.Transaction.fromBuffer(
        bitcoin.Psbt.fromBuffer(toPsbtBuffer(psbt)).data.getTransaction()
    );
    const funding_txid_str = tx.getId();
    const outpoints: Array<OpenedChannel> = [];
    fundingAddresses.forEach((address) => {
        const script = segwitOutputScript(address);
        const output_index = tx.outs.findIndex((out) =>
            out.script.equals(script)
        );
        if (output_index !== -1) {
            outpoints.push({ funding_txid_str, output_index });
        }
    });
    return outpoints;
};
