import Long from 'long';

import Channel from './Channel';

// 792991x9230995x16385 and 16000x0x1 (see utils/ScidUtils.test.ts)
const CHAN_ID = '871903430184222721';
const ALIAS_SCID = '17592186044416001';

describe('Channel short channel ids', () => {
    describe('shortChannelId', () => {
        it('formats an LND chan_id', () => {
            const channel = new Channel({ chan_id: CHAN_ID });
            expect(channel.shortChannelId).toBe('792991x9230995x16385');
        });

        it('formats a chan_id decoded as a protobuf Long (embedded LND)', () => {
            const channel = new Channel({
                chan_id: Long.fromString(CHAN_ID, true)
            });
            expect(channel.shortChannelId).toBe('792991x9230995x16385');
        });

        it('prefers the CLN short_channel_id', () => {
            const channel = new Channel({
                short_channel_id: '100x2x3',
                chan_id: CHAN_ID
            });
            expect(channel.shortChannelId).toBe('100x2x3');
        });

        it('returns undefined for a pending channel', () => {
            expect(new Channel({}).shortChannelId).toBeUndefined();
        });

        it('returns undefined for a malformed chan_id', () => {
            const channel = new Channel({ chan_id: 'not-a-number' });
            expect(channel.shortChannelId).toBeUndefined();
        });
    });

    describe('aliasScids', () => {
        it('formats alias scids and drops zero', () => {
            const channel = new Channel({
                alias_scids: [ALIAS_SCID, '0']
            });
            expect(channel.aliasScids).toEqual(['16000x0x1']);
        });

        // BaseModel converts top-level Longs to strings but not Longs inside
        // arrays, so embedded LND passes these through as Long objects
        it('formats alias scids decoded as protobuf Longs (embedded LND)', () => {
            const channel = new Channel({
                alias_scids: [
                    Long.fromString(ALIAS_SCID, true),
                    Long.fromString(CHAN_ID, true)
                ]
            });
            expect(channel.aliasScids).toEqual([
                '16000x0x1',
                '792991x9230995x16385'
            ]);
        });

        it('skips malformed entries', () => {
            const channel = new Channel({
                alias_scids: ['abc', ALIAS_SCID]
            });
            expect(channel.aliasScids).toEqual(['16000x0x1']);
        });

        it('returns an empty list when there are no alias scids', () => {
            expect(new Channel({}).aliasScids).toEqual([]);
        });
    });

    describe('peerScidAlias', () => {
        it('formats the peer scid alias', () => {
            const channel = new Channel({ peer_scid_alias: ALIAS_SCID });
            expect(channel.peerScidAlias).toBe('16000x0x1');
        });

        it('returns undefined for zero', () => {
            const channel = new Channel({ peer_scid_alias: '0' });
            expect(channel.peerScidAlias).toBeUndefined();
        });

        it('returns undefined instead of throwing for a malformed value', () => {
            const channel = new Channel({ peer_scid_alias: 'abc' });
            expect(channel.peerScidAlias).toBeUndefined();
        });
    });

    describe('zeroConfConfirmedScid', () => {
        it('formats the confirmed scid', () => {
            const channel = new Channel({
                zero_conf_confirmed_scid: CHAN_ID
            });
            expect(channel.zeroConfConfirmedScid).toBe('792991x9230995x16385');
        });

        it('returns undefined for zero', () => {
            const channel = new Channel({ zero_conf_confirmed_scid: '0' });
            expect(channel.zeroConfConfirmedScid).toBeUndefined();
        });

        it('returns undefined when unset', () => {
            expect(new Channel({}).zeroConfConfirmedScid).toBeUndefined();
        });
    });
});
