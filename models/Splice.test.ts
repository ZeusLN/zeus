jest.mock('../stores/Stores', () => ({
    notesStore: { notes: { 'note-splice-txid': 'moved to cold storage' } }
}));
jest.mock('../utils/LocaleUtils');

import Splice from './Splice';

const splice = (overrides: any = {}) =>
    new Splice({
        userChannelId: 'user-chan',
        channelId: 'chan',
        txid: 'splice-txid',
        initiator: 'local',
        direction: 'in',
        amountSats: 100000,
        startedAt: 1_700_000_000_123,
        status: 'pending',
        ...overrides
    });

describe('Splice', () => {
    it('is listed as a splice', () => {
        expect(splice().model).toEqual('Splice');
    });

    it('shows the amount we asked to move', () => {
        expect(splice().getAmount).toEqual(100000);
        expect(splice({ direction: 'out', amountSats: 30000 }).getAmount).toBe(
            30000
        );
    });

    it("has no amount for a peer's splice until it locks", () => {
        const peers = splice({
            initiator: 'remote',
            direction: undefined,
            amountSats: undefined,
            capacityBefore: 300000
        });

        expect(peers.getAmount).toEqual(0);
        expect(peers.getDirection).toBeUndefined();
    });

    it("works out a peer's splice from the capacity change", () => {
        const peerIn = splice({
            initiator: 'remote',
            direction: undefined,
            amountSats: undefined,
            status: 'locked',
            capacityBefore: 300000,
            capacityAfter: 400003
        });
        const peerOut = splice({
            initiator: 'remote',
            direction: undefined,
            amountSats: undefined,
            status: 'locked',
            capacityBefore: 400000,
            capacityAfter: 349603
        });

        expect(peerIn.getDirection).toEqual('in');
        expect(peerIn.getAmount).toEqual(100003);
        expect(peerOut.getDirection).toEqual('out');
        expect(peerOut.getAmount).toEqual(50397);
    });

    it('keeps the direction we asked for', () => {
        expect(
            splice({
                direction: 'out',
                capacityBefore: 400000,
                capacityAfter: 500000
            }).getDirection
        ).toEqual('out');
    });

    it('is pending until it locks', () => {
        expect(splice().isPending).toBe(true);
        expect(splice({ status: 'locked' }).isPending).toBe(false);
    });

    it('sorts by when it started, in seconds', () => {
        expect(splice().getTimestamp).toEqual(1_700_000_000);
        expect(splice().getDate.getTime()).toEqual(1_700_000_000_123);
    });

    it('shows the note saved on its transaction', () => {
        expect(splice().getNote).toEqual('moved to cold storage');
        expect(splice({ txid: 'other' }).getNote).toEqual('');
    });
});
