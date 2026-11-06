jest.mock('../stores/Stores', () => ({}));
jest.mock('react-native-blob-util', () => ({
    fetch: jest.fn()
}));
jest.mock('../utils/UrlUtils', () => ({
    getMempoolApiUrl: jest.fn(() => 'https://mempool.space/api')
}));
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

import ReactNativeBlobUtil from 'react-native-blob-util';
import FeeStore from './FeeStore';
import BackendUtils from '../utils/BackendUtils';
import UrlUtils from '../utils/UrlUtils';

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

const unknownFieldError = (field: string) =>
    new Error(
        JSON.stringify({
            code: 3,
            message: `proto: (line 1:95): unknown field "${field}"`
        })
    );

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
            .mockRejectedValueOnce(unknownFieldError('incoming_chan_ids'))
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

    it('filters events client-side after the unfiltered retry', async () => {
        jest.mocked(BackendUtils.getForwardingHistory)
            .mockRejectedValueOnce(unknownFieldError('incoming_chan_ids'))
            .mockResolvedValueOnce({
                forwarding_events: [
                    lndEvent,
                    { ...lndEvent, chan_id_in: '3', fee_msat: '4000' },
                    { ...lndEvent, chan_id_out: '4', fee_msat: '8000' }
                ]
            });

        const store = newStore();
        store.getForwardingHistory(24, '1', '2');
        await flush();
        await flush();

        expect(store.forwardingEvents).toHaveLength(1);
        expect(store.forwardingEvents[0].inChannelId).toBe('1');
        expect(store.forwardingEvents[0].outChannelId).toBe('2');
        expect(store.earnedDuringTimeframe.toNumber()).toBe(1.5);
    });

    it('retries when only an outgoing filter is rejected', async () => {
        jest.mocked(BackendUtils.getForwardingHistory)
            .mockRejectedValueOnce(unknownFieldError('outgoing_chan_ids'))
            .mockResolvedValueOnce({
                forwarding_events: [
                    lndEvent,
                    { ...lndEvent, chan_id_in: '3', fee_msat: '4000' },
                    { ...lndEvent, chan_id_out: '4', fee_msat: '8000' }
                ]
            });

        const store = newStore();
        store.getForwardingHistory(24, undefined, '2');
        await flush();
        await flush();

        expect(BackendUtils.getForwardingHistory).toHaveBeenCalledTimes(2);
        expect(
            jest.mocked(BackendUtils.getForwardingHistory).mock.calls[0]
        ).toEqual([24, undefined, '2']);
        expect(
            jest.mocked(BackendUtils.getForwardingHistory).mock.calls[1]
        ).toEqual([24, undefined, undefined]);
        expect(store.forwardingEvents).toHaveLength(2);
        expect(store.earnedDuringTimeframe.toNumber()).toBe(5.5);
        expect(store.loading).toBe(false);
    });

    it.each([
        ['a generic error', new Error('connection refused')],
        ['the same unknown-field error', unknownFieldError('incoming_chan_ids')]
    ])(
        'sets the error state when the retry fails with %s',
        async (_label, retryError) => {
            jest.mocked(BackendUtils.getForwardingHistory)
                .mockRejectedValueOnce(unknownFieldError('incoming_chan_ids'))
                .mockRejectedValueOnce(retryError)
                // a third call means the retry looped
                .mockResolvedValue({ forwarding_events: [] });

            const store = newStore();
            store.getForwardingHistory(24, '1', '2');
            await flush();
            await flush();
            await flush();

            expect(BackendUtils.getForwardingHistory).toHaveBeenCalledTimes(2);
            expect(store.forwardingHistoryError).toBe(true);
            expect(store.forwardingEvents).toEqual([]);
            expect(store.loading).toBe(false);
        }
    );

    it('sets the error state when the backend resolves undefined', async () => {
        jest.mocked(BackendUtils.getForwardingHistory).mockResolvedValueOnce(
            undefined
        );

        const store = newStore();
        store.getForwardingHistory(24);
        await flush();

        expect(store.forwardingHistoryError).toBe(true);
        expect(store.forwardingEvents).toEqual([]);
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

    it('drops CLN forwards resolved before the timeframe', async () => {
        jest.mocked(BackendUtils.isLNDBased).mockReturnValue(false);
        const now = Math.floor(Date.now() / 1000);
        const forward = {
            in_channel: '1x1x0',
            out_channel: '2x2x0',
            in_msat: 1002000,
            out_msat: 1000000,
            status: 'settled'
        };
        jest.mocked(BackendUtils.getForwardingHistory).mockResolvedValueOnce({
            forwards: [
                { ...forward, fee_msat: 2000, resolved_time: now },
                {
                    ...forward,
                    fee_msat: 5000,
                    resolved_time: now - 25 * 3600
                }
            ]
        });

        const store = newStore();
        store.getForwardingHistory(24);
        await flush();

        expect(store.forwardingEvents).toHaveLength(1);
        expect(store.forwardingEvents[0].feeSat).toBe(2);
        expect(store.earnedDuringTimeframe.toNumber()).toBe(2);
    });
});

describe('FeeStore.getOnchainFeesviaMempool', () => {
    const mockedFetch = jest.mocked(ReactNativeBlobUtil.fetch);

    beforeEach(() => {
        mockedFetch.mockReset();
        jest.mocked(UrlUtils.getMempoolApiUrl).mockReturnValue(
            'https://mempool.space/api'
        );
        // Keep test output clean
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('resolves undefined and sets error on a non-200 response', async () => {
        const store = newStore();
        store.recommendedFees = { fastestFee: 3 }; // Seed stale rates
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => ({})
        } as any);

        const result = await store.getOnchainFeesviaMempool();

        expect(result).toBeUndefined();
        expect(store.error).toBe(true);
        expect(store.recommendedFees).toEqual({}); // no stale rates left behind
        expect(store.loading).toBe(false);
    });

    it('resolves undefined and sets error on a thrown network error', async () => {
        const store = newStore();
        store.recommendedFees = { fastestFee: 3 }; // Seed stale rates
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await store.getOnchainFeesviaMempool();

        expect(result).toBeUndefined();
        expect(store.error).toBe(true);
        expect(store.recommendedFees).toEqual({});
        expect(store.loading).toBe(false);
    });

    it.each([
        [{ fastestFee: 50000, halfHourFee: 40000 }],
        [{ fastestFee: 10, hourFee: 50000 }]
    ])(
        'resolves undefined and sets error on an implausible payload (%j)',
        async (payload) => {
            const store = newStore();
            store.recommendedFees = { fastestFee: 3 }; // Seed stale rates
            mockedFetch.mockResolvedValueOnce({
                info: () => ({ status: 200 }),
                json: () => payload
            } as any);

            const result = await store.getOnchainFeesviaMempool();

            expect(result).toBeUndefined();
            expect(store.error).toBe(true);
            expect(store.recommendedFees).toEqual({}); // no stale rates left behind
            expect(store.loading).toBe(false);
        }
    );

    it('resolves undefined when response.json() throws', async () => {
        const store = newStore();
        store.recommendedFees = { fastestFee: 3 }; // Seed stale rates
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => {
                throw new SyntaxError('Unexpected token <');
            }
        } as any);

        const result = await store.getOnchainFeesviaMempool();

        expect(result).toBeUndefined();
        expect(store.error).toBe(true);
        expect(store.recommendedFees).toEqual({});
        expect(store.loading).toBe(false);
    });

    it('resolves undefined when fastestFee is missing', async () => {
        const store = newStore();
        store.recommendedFees = { fastestFee: 3 }; // Seed stale rates
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => ({ halfHourFee: 8, hourFee: 5 })
        } as any);

        const result = await store.getOnchainFeesviaMempool();

        expect(result).toBeUndefined();
        expect(store.error).toBe(true);
        expect(store.recommendedFees).toEqual({});
    });

    it.each([[null], [[]]])(
        'resolves undefined on a non-object body (%j)',
        async (body) => {
            const store = newStore();
            store.recommendedFees = { fastestFee: 3 };
            mockedFetch.mockResolvedValueOnce({
                info: () => ({ status: 200 }),
                json: () => body
            } as any);

            const result = await store.getOnchainFeesviaMempool();

            expect(result).toBeUndefined();
            expect(store.error).toBe(true);
            expect(store.recommendedFees).toEqual({});
        }
    );

    it('raises sub-1 rates to 1', async () => {
        const store = newStore();
        const fees = { fastestFee: 0.5, halfHourFee: 8, hourFee: 5 };
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => fees
        } as any);

        const result = await store.getOnchainFeesviaMempool();
        expect(result).toEqual({ fastestFee: 1, halfHourFee: 8, hourFee: 5 });
        expect(store.error).toBe(false);
        expect(store.recommendedFees).toEqual({
            fastestFee: 1,
            halfHourFee: 8,
            hourFee: 5
        });
    });

    it('sets loading, resets error, and stores rates on success', async () => {
        const store = newStore();
        store.error = true;
        store.recommendedFees = { fastestFee: 3 };
        const fees = { fastestFee: 10, halfHourFee: 8, hourFee: 5 };
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => fees
        } as any);

        const promise = store.getOnchainFeesviaMempool();

        // Check in-flight state before resolving
        expect(store.loading).toBe(true);
        expect(store.error).toBe(false);
        expect(store.recommendedFees).toEqual({});

        const result = await promise;

        // Check final state
        expect(result).toEqual(fees);
        expect(store.recommendedFees).toEqual(fees);
        expect(store.loading).toBe(false);
        expect(mockedFetch).toHaveBeenCalledWith(
            'get',
            'https://mempool.space/api/v1/fees/recommended'
        );
    });
});
