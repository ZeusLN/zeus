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

describe('Channel getConfirmations', () => {
    // LDK Node gives the counts directly (backends/LdkNode.ts formatChannel)
    const ldkPendingOpen = (
        confirmations: number,
        confirmations_required = 6
    ) =>
        new Channel({
            pendingOpen: true,
            confirmations,
            confirmations_required
        });

    it('returns the LDK count below the required depth', () => {
        expect(ldkPendingOpen(3).getConfirmations()).toEqual({
            current: 3,
            total: 6
        });
    });

    it('returns the LDK count at the required depth', () => {
        expect(ldkPendingOpen(6).getConfirmations()).toEqual({
            current: 6,
            total: 6
        });
    });

    it('caps the LDK count at the required depth while the channel is not ready', () => {
        expect(ldkPendingOpen(7).getConfirmations()).toEqual({
            current: 6,
            total: 6
        });
    });

    it('returns null for an LDK zero-conf channel', () => {
        expect(ldkPendingOpen(0, 0).getConfirmations()).toBeNull();
    });

    it('returns null when the channel is not pending open', () => {
        const channel = new Channel({
            confirmations: 7,
            confirmations_required: 6
        });
        expect(channel.getConfirmations()).toBeNull();
    });

    // LND and LNC give the confirmation height and the blocks left instead
    // (stores/ChannelsStore.ts)
    it('counts LND confirmations from the confirmation height', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmation_height: 100,
            confirmations_until_active: 3
        });
        expect(channel.getConfirmations(102)).toEqual({
            current: 3,
            total: 6
        });
    });

    it('returns 0 LND confirmations without the current block height', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmation_height: 100,
            confirmations_until_active: 3
        });
        expect(channel.getConfirmations()).toEqual({
            current: 0,
            total: 3
        });
    });

    it('returns null when LND gives no confirmations_until_active', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmation_height: 100
        });
        expect(channel.getConfirmations(102)).toBeNull();
    });

    it('returns null for an LDK channel without a confirmation count', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmations_required: 6
        });
        expect(channel.getConfirmations(102)).toBeNull();
    });
});

describe('Channel isWaitingForPeer', () => {
    const ldkPendingOpen = (
        confirmations: number,
        confirmations_required = 6
    ) =>
        new Channel({
            pendingOpen: true,
            confirmations,
            confirmations_required
        });

    it('is true for a pending LDK channel at the required depth', () => {
        expect(ldkPendingOpen(6).isWaitingForPeer).toBe(true);
    });

    it('is true for a pending LDK channel past the required depth', () => {
        expect(ldkPendingOpen(9).isWaitingForPeer).toBe(true);
    });

    it('is false below the required depth', () => {
        expect(ldkPendingOpen(5).isWaitingForPeer).toBe(false);
    });

    it('is false for an LDK zero-conf channel', () => {
        expect(ldkPendingOpen(0, 0).isWaitingForPeer).toBe(false);
    });

    it('is false when the channel is not pending open', () => {
        const channel = new Channel({
            confirmations: 9,
            confirmations_required: 6
        });
        expect(channel.isWaitingForPeer).toBe(false);
    });

    it('is false for an LDK channel without a confirmation count', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmations_required: 6
        });
        expect(channel.isWaitingForPeer).toBe(false);
    });

    it('is false for a pending LND channel', () => {
        const channel = new Channel({
            pendingOpen: true,
            confirmation_height: 100,
            confirmations_until_active: 0
        });
        expect(channel.isWaitingForPeer).toBe(false);
    });
});
