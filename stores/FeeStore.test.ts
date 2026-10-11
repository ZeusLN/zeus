jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('../utils/UrlUtils', () => ({}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        getForwardingHistory: jest.fn(),
        isLNDBased: jest.fn(() => true)
    }
}));

import FeeStore from './FeeStore';
import BackendUtils from '../utils/BackendUtils';

const newStore = () => new FeeStore({} as any, {} as any);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const lndEvent = {
    chan_id_in: '1',
    chan_id_out: '2',
    amt_in: '1001',
    amt_out: '1000',
    fee: '1',
    fee_msat: '1500',
    timestamp: '1700000000'
};

describe('FeeStore.getForwardingHistory', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.mocked(BackendUtils.isLNDBased).mockReturnValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('retries without channel filters when the node rejects them', async () => {
        jest.mocked(BackendUtils.getForwardingHistory)
            .mockRejectedValueOnce(
                new Error(
                    JSON.stringify({
                        code: 3,
                        message:
                            'proto: (line 1:95): unknown field "incoming_chan_ids"'
                    })
                )
            )
            .mockResolvedValueOnce({
                forwarding_events: [lndEvent],
                last_offset_index: 1
            });

        const store = newStore();
        store.getForwardingHistory(24, '1', '2');
        await flush();
        await flush();

        expect(BackendUtils.getForwardingHistory).toHaveBeenCalledTimes(2);
        expect(
            jest.mocked(BackendUtils.getForwardingHistory).mock.calls[0]
        ).toEqual([24, '1', '2']);
        expect(
            jest.mocked(BackendUtils.getForwardingHistory).mock.calls[1]
        ).toEqual([24, undefined, undefined]);
        expect(store.forwardingEvents).toHaveLength(1);
        expect(store.earnedDuringTimeframe.toNumber()).toBe(1.5);
        expect(store.lastOffsetIndex).toBe(1);
        expect(store.forwardingHistoryError).toBe(false);
        expect(store.loading).toBe(false);
    });

    it('does not retry on other errors and clears loading', async () => {
        jest.mocked(BackendUtils.getForwardingHistory).mockRejectedValueOnce(
            new Error('connection refused')
        );

        const store = newStore();
        store.getForwardingHistory(24, '1', '2');
        await flush();

        expect(BackendUtils.getForwardingHistory).toHaveBeenCalledTimes(1);
        expect(store.forwardingHistoryError).toBe(true);
        expect(store.forwardingEvents).toEqual([]);
        expect(store.loading).toBe(false);
    });

    it('does not retry an unknown-field error when no filter was sent', async () => {
        jest.mocked(BackendUtils.getForwardingHistory).mockRejectedValueOnce(
            new Error('unknown field "incoming_chan_ids"')
        );

        const store = newStore();
        store.getForwardingHistory(24);
        await flush();

        expect(BackendUtils.getForwardingHistory).toHaveBeenCalledTimes(1);
        expect(store.forwardingHistoryError).toBe(true);
        expect(store.loading).toBe(false);
    });

    it('keeps the fee total numeric when an event has no fee_msat', async () => {
        const { fee_msat: _omit, ...withoutMsat } = lndEvent;
        jest.mocked(BackendUtils.getForwardingHistory).mockResolvedValueOnce({
            forwarding_events: [
                lndEvent,
                { ...withoutMsat, fee: '2' },
                { chan_id_in: '1', chan_id_out: '2' }
            ]
        });

        const store = newStore();
        store.getForwardingHistory(24);
        await flush();

        expect(store.forwardingEvents).toHaveLength(3);
        expect(store.earnedDuringTimeframe.isNaN()).toBe(false);
        expect(store.earnedDuringTimeframe.toNumber()).toBe(3.5);
        expect(store.loading).toBe(false);
    });

    it('sums CLN fee_msat values for settled forwards', async () => {
        jest.mocked(BackendUtils.isLNDBased).mockReturnValue(false);
        const now = Math.floor(Date.now() / 1000);
        jest.mocked(BackendUtils.getForwardingHistory).mockResolvedValueOnce({
            forwards: [
                {
                    in_channel: '1x1x0',
                    out_channel: '2x2x0',
                    in_msat: 1002000,
                    out_msat: 1000000,
                    fee_msat: 2000,
                    status: 'settled',
                    resolved_time: now
                }
            ]
        });

        const store = newStore();
        store.getForwardingHistory(24);
        await flush();

        expect(store.earnedDuringTimeframe.toNumber()).toBe(2);
    });
});
