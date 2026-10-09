jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));

import {
    OPEN_MEMO_PREFIX,
    findChannelByMemo,
    makeOpenMemo
} from './ChannelOpenUtils';

describe('makeOpenMemo', () => {
    it('is the prefix plus 16 hex characters', () => {
        const memo = makeOpenMemo();
        expect(memo.startsWith(OPEN_MEMO_PREFIX)).toBe(true);
        expect(memo.slice(OPEN_MEMO_PREFIX.length)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('differs between opens', () => {
        expect(makeOpenMemo()).not.toEqual(makeOpenMemo());
    });
});

describe('findChannelByMemo', () => {
    const memo = 'ZEUS open 0011223344556677';
    const options = { attempts: 3, delayMs: 0 };
    const noChannels = async () => ({ channels: [] });
    const noPending = async () => ({ pending_open_channels: [] });

    it('finds the channel among the pending opens', async () => {
        const getChannels = jest.fn(noChannels);
        const found = await findChannelByMemo(
            async () => ({
                pending_open_channels: [
                    { channel: { channel_point: 'aa:0', memo: '' } },
                    { channel: { channel_point: 'bb:1', memo } }
                ]
            }),
            getChannels,
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'bb', output_index: 1 });
        expect(getChannels).not.toHaveBeenCalled();
    });

    it('finds a channel that is already open', async () => {
        const found = await findChannelByMemo(
            noPending,
            async () => ({
                channels: [{ channel_point: 'cc:2', memo }]
            }),
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'cc', output_index: 2 });
    });

    it('keeps looking after a failed lookup', async () => {
        const getPendingChannels = jest
            .fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce({
                pending_open_channels: [
                    { channel: { channel_point: 'dd:0', memo } }
                ]
            });

        const found = await findChannelByMemo(
            getPendingChannels,
            noChannels,
            memo,
            options
        );

        expect(found).toEqual({ funding_txid_str: 'dd', output_index: 0 });
        expect(getPendingChannels).toHaveBeenCalledTimes(2);
    });

    it('resolves undefined when no channel has the memo', async () => {
        const getPendingChannels = jest.fn(async () => ({
            pending_open_channels: [
                {
                    channel: {
                        channel_point: 'ee:0',
                        memo: 'ZEUS open ffff'
                    }
                }
            ]
        }));

        const found = await findChannelByMemo(
            getPendingChannels,
            noChannels,
            memo,
            options
        );

        expect(found).toBeUndefined();
        expect(getPendingChannels).toHaveBeenCalledTimes(3);
    });

    it('does not report a match without a usable channel point', async () => {
        const found = await findChannelByMemo(
            async () => ({
                pending_open_channels: [{ channel: { memo } }]
            }),
            noChannels,
            memo,
            options
        );

        expect(found).toBeUndefined();
    });

    it('tolerates responses without channel lists', async () => {
        const found = await findChannelByMemo(
            async () => ({}),
            async () => ({}),
            memo,
            options
        );

        expect(found).toBeUndefined();
    });
});
