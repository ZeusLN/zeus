jest.mock('./BackendUtils', () => ({
    getChannels: jest.fn(),
    getChannelInfo: jest.fn(),
    updateChannelPolicy: jest.fn()
}));

import BackendUtils from './BackendUtils';
import {
    repairMissingChannelEdges,
    resetChannelEdgeRepairState
} from './ChannelEdgeRepairUtils';

const getChannels = jest.mocked(BackendUtils.getChannels);
const getChannelInfo = jest.mocked(BackendUtils.getChannelInfo);
const updateChannelPolicy = jest.mocked(BackendUtils.updateChannelPolicy);

const TXID_A = 'a'.repeat(64);
const TXID_B = 'b'.repeat(64);
const TXID_C = 'c'.repeat(64);

const channel = (
    chanId: string,
    txid: string,
    outputIndex: number,
    maxPendingAmtMsat?: string
) => ({
    chan_id: chanId,
    channel_point: `${txid}:${outputIndex}`,
    local_constraints:
        maxPendingAmtMsat !== undefined
            ? { max_pending_amt_msat: maxPendingAmtMsat }
            : undefined
});

const edgeNotFound = () =>
    Promise.reject(
        new Error('rpc error: code = Unknown desc = edge not found')
    );

describe('repairMissingChannelEdges', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetChannelEdgeRepairState();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        updateChannelPolicy.mockResolvedValue({ failed_updates: [] });
    });

    it('does not update policies when all edges are present', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0), channel('2', TXID_B, 1)]
        });
        getChannelInfo.mockResolvedValue({ channel_id: '1' });

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo).toHaveBeenCalledTimes(2);
        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result).toEqual({ checked: 2, repaired: [], failed: [] });
    });

    it('recreates only the channel whose edge is missing', async () => {
        getChannels.mockResolvedValue({
            channels: [
                channel('1', TXID_A, 0, '99000000'),
                channel('2', TXID_B, 3, '198000000'),
                channel('3', TXID_C, 1, '50000000')
            ]
        });
        getChannelInfo.mockImplementation((chanId: string) =>
            chanId === '2' ? edgeNotFound() : Promise.resolve({})
        );

        const result = await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).toHaveBeenCalledTimes(1);
        expect(updateChannelPolicy).toHaveBeenCalledWith({
            base_fee_msat: '1000',
            fee_rate_ppm: 1,
            time_lock_delta: 80,
            create_missing_edge: true,
            max_htlc_msat: '198000000',
            chan_point: { funding_txid_str: TXID_B, output_index: 3 }
        });
        expect(result).toEqual({
            checked: 3,
            repaired: [`${TXID_B}:3`],
            failed: []
        });
    });

    it('never sends a global policy update', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0, '1000')]
        });
        getChannelInfo.mockImplementation(edgeNotFound);

        await repairMissingChannelEdges('lnd');

        const data = updateChannelPolicy.mock.calls[0][0];
        expect(data.global).toBeUndefined();
        expect(data.chan_point).toBeDefined();
    });

    it('does not repair on errors other than edge not found', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0), channel('2', TXID_B, 0)]
        });
        getChannelInfo
            .mockRejectedValueOnce(new Error('context deadline exceeded'))
            .mockRejectedValueOnce(new Error('edge policy not found'));

        const result = await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result).toEqual({ checked: 2, repaired: [], failed: [] });
    });

    it('matches string rejections', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0)]
        });
        getChannelInfo.mockImplementation(() =>
            Promise.reject('Edge Not Found')
        );

        const result = await repairMissingChannelEdges('lnd');

        expect(result?.repaired).toEqual([`${TXID_A}:0`]);
    });

    it('omits max_htlc_msat when the channel has no max pending amount', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0), channel('2', TXID_B, 0, '0')]
        });
        getChannelInfo.mockImplementation(edgeNotFound);

        await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).toHaveBeenCalledTimes(2);
        for (const [data] of updateChannelPolicy.mock.calls) {
            expect(data).not.toHaveProperty('max_htlc_msat');
        }
    });

    it('stringifies Long-like max pending amounts', async () => {
        getChannels.mockResolvedValue({
            channels: [
                {
                    ...channel('1', TXID_A, 0),
                    local_constraints: {
                        max_pending_amt_msat: { toString: () => '12345000' }
                    }
                }
            ]
        });
        getChannelInfo.mockImplementation(edgeNotFound);

        await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy.mock.calls[0][0].max_htlc_msat).toBe(
            '12345000'
        );
    });

    it('reports failed_updates and keeps processing later channels', async () => {
        getChannels.mockResolvedValue({
            channels: [
                channel('1', TXID_A, 0, '1000'),
                channel('2', TXID_B, 0, '1000')
            ]
        });
        getChannelInfo.mockImplementation(edgeNotFound);
        updateChannelPolicy
            .mockResolvedValueOnce({
                failed_updates: [{ update_error: 'not yet confirmed' }]
            })
            .mockResolvedValueOnce({ failed_updates: [] });

        const result = await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            checked: 2,
            repaired: [`${TXID_B}:0`],
            failed: [`${TXID_A}:0`]
        });
    });

    it('catches updateChannelPolicy errors and keeps processing', async () => {
        getChannels.mockResolvedValue({
            channels: [
                channel('1', TXID_A, 0, '1000'),
                channel('2', TXID_B, 0, '1000')
            ]
        });
        getChannelInfo.mockImplementation(edgeNotFound);
        updateChannelPolicy
            .mockRejectedValueOnce(new Error('boom'))
            .mockResolvedValueOnce({});

        const result = await repairMissingChannelEdges('lnd');

        expect(result).toEqual({
            checked: 2,
            repaired: [`${TXID_B}:0`],
            failed: [`${TXID_A}:0`]
        });
    });

    it('skips channels without a channel point or chan id', async () => {
        getChannels.mockResolvedValue({
            channels: [
                { chan_id: '1' },
                { channel_point: `${TXID_A}:0` },
                channel('3', TXID_B, 0)
            ]
        });
        getChannelInfo.mockResolvedValue({});

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo).toHaveBeenCalledTimes(1);
        expect(getChannelInfo).toHaveBeenCalledWith('3');
        expect(result?.checked).toBe(1);
    });

    it('makes no calls when there are no channels', async () => {
        getChannels.mockResolvedValue({ channels: [] });

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo).not.toHaveBeenCalled();
        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result).toEqual({ checked: 0, repaired: [], failed: [] });
    });

    it('runs once per node per session', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0)]
        });
        getChannelInfo.mockResolvedValue({});

        await repairMissingChannelEdges('lnd');
        const second = await repairMissingChannelEdges('lnd');
        expect(second).toBeUndefined();
        expect(getChannels).toHaveBeenCalledTimes(1);

        await repairMissingChannelEdges('lnd2');
        expect(getChannels).toHaveBeenCalledTimes(2);
    });

    it('shares one in-flight run between concurrent calls', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0)]
        });
        getChannelInfo.mockResolvedValue({});

        const [first, second] = await Promise.all([
            repairMissingChannelEdges('lnd'),
            repairMissingChannelEdges('lnd')
        ]);

        expect(getChannels).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
    });

    it('retries on the next call if listing channels fails', async () => {
        getChannels
            .mockRejectedValueOnce(new Error('rpc not ready'))
            .mockResolvedValueOnce({ channels: [] });

        await expect(repairMissingChannelEdges('lnd')).rejects.toThrow(
            'rpc not ready'
        );
        const result = await repairMissingChannelEdges('lnd');

        expect(getChannels).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ checked: 0, repaired: [], failed: [] });
    });
});
