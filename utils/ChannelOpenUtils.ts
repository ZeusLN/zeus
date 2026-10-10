import { randomBytes } from 'react-native-randombytes';

import { LookupOptions, lookUpWithRetries } from './OnchainSendUtils';

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
