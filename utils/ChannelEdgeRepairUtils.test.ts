jest.mock('./BackendUtils', () => ({
    getChannels: jest.fn(),
    getChannelInfo: jest.fn(),
    updateChannelPolicy: jest.fn(),
    listPeers: jest.fn(),
    disconnectPeer: jest.fn(),
    connectPeer: jest.fn()
}));
jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../stores/Stores', () => ({
    settingsStore: { implementation: 'embedded-lnd', lndDir: 'lnd' }
}));

import BackendUtils from './BackendUtils';
import { sleep } from './SleepUtils';
import { settingsStore } from '../stores/Stores';
import {
    MAX_RECONNECT_TRIES,
    MAX_REPAIR_ATTEMPTS,
    RECONNECT_DELAY_MS,
    repairMissingChannelEdges,
    resetChannelEdgeRepairState
} from './ChannelEdgeRepairUtils';

const getChannels = jest.mocked(BackendUtils.getChannels);
const getChannelInfo = jest.mocked(BackendUtils.getChannelInfo);
const updateChannelPolicy = jest.mocked(BackendUtils.updateChannelPolicy);
const listPeers = jest.mocked(BackendUtils.listPeers);
const disconnectPeer = jest.mocked(BackendUtils.disconnectPeer);
const connectPeer = jest.mocked(BackendUtils.connectPeer);
const mockedSleep = jest.mocked(sleep);

const selectWallet = (implementation: string, lndDir?: string) => {
    (settingsStore as any).implementation = implementation;
    (settingsStore as any).lndDir = lndDir;
};

const TXID_A = 'a'.repeat(64);
const TXID_B = 'b'.repeat(64);
const TXID_C = 'c'.repeat(64);

const PEER_A = '02' + 'a'.repeat(64);
const PEER_B = '03' + 'b'.repeat(64);
const OUR_PUBKEY = '02' + 'f'.repeat(64);

// getChanInfo response for our channel with peer, with or without the
// peer's policy
const edge = (peer: string, withPeerPolicy: boolean) => ({
    node1_pub: OUR_PUBKEY,
    node1_policy: { fee_base_msat: '1000' },
    node2_pub: peer,
    node2_policy: withPeerPolicy ? { fee_base_msat: '1000' } : null
});

const channel = (
    chanId: string,
    txid: string,
    outputIndex: number,
    maxPendingAmtMsat?: string,
    remotePubkey: string = PEER_A
) => ({
    chan_id: chanId,
    channel_point: `${txid}:${outputIndex}`,
    remote_pubkey: remotePubkey,
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
        selectWallet('embedded-lnd', 'lnd');
        mockedSleep.mockResolvedValue(undefined);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        updateChannelPolicy.mockResolvedValue({ failed_updates: [] });
        listPeers.mockResolvedValue([
            { pub_key: PEER_A, address: '10.0.0.1:9735', inbound: false },
            { pub_key: PEER_B, address: '10.0.0.2:9735', inbound: false }
        ]);
        disconnectPeer.mockResolvedValue(true);
        connectPeer.mockResolvedValue({});
    });

    it('does not update policies when all edges are present', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0), channel('2', TXID_B, 1)]
        });
        getChannelInfo.mockResolvedValue({ channel_id: '1' });

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo).toHaveBeenCalledTimes(2);
        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result).toEqual({
            checked: 2,
            repaired: [],
            failed: [],
            skipped: [],
            pendingPeers: []
        });
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
            failed: [],
            skipped: [],
            pendingPeers: []
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

    it('skips instead of repairing on errors other than edge not found', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0), channel('2', TXID_B, 0)]
        });
        getChannelInfo
            .mockRejectedValueOnce(new Error('context deadline exceeded'))
            .mockRejectedValueOnce(new Error('edge policy not found'));

        const result = await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result).toEqual({
            checked: 2,
            repaired: [],
            failed: [],
            skipped: [`${TXID_A}:0`, `${TXID_B}:0`],
            pendingPeers: []
        });
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
            failed: [`${TXID_A}:0`],
            skipped: [],
            pendingPeers: []
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
            failed: [`${TXID_A}:0`],
            skipped: [],
            pendingPeers: []
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
        expect(result).toEqual({
            checked: 0,
            repaired: [],
            failed: [],
            skipped: [],
            pendingPeers: []
        });
    });

    it('treats the edge as present if it is found under the confirmed scid', async () => {
        getChannels.mockResolvedValue({
            channels: [
                {
                    ...channel('100', TXID_A, 0, '1000'),
                    zero_conf_confirmed_scid: '200',
                    alias_scids: [{ toString: () => '300' }]
                }
            ]
        });
        getChannelInfo.mockImplementation((scid: string) =>
            scid === '200' ? Promise.resolve({}) : edgeNotFound()
        );

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo.mock.calls.map(([scid]) => scid)).toEqual([
            '100',
            '200'
        ]);
        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result?.repaired).toEqual([]);
    });

    it('treats the edge as present if it is found under an alias scid', async () => {
        getChannels.mockResolvedValue({
            channels: [
                {
                    ...channel('100', TXID_A, 0, '1000'),
                    zero_conf_confirmed_scid: '0',
                    alias_scids: [
                        { toString: () => '100' },
                        { toString: () => '300' }
                    ]
                }
            ]
        });
        getChannelInfo.mockImplementation((scid: string) =>
            scid === '300' ? Promise.resolve({}) : edgeNotFound()
        );

        await repairMissingChannelEdges('lnd');

        // '0' and the duplicate of chan_id are not looked up
        expect(getChannelInfo.mock.calls.map(([scid]) => scid)).toEqual([
            '100',
            '300'
        ]);
        expect(updateChannelPolicy).not.toHaveBeenCalled();
    });

    it('repairs only when every scid reports edge not found', async () => {
        getChannels.mockResolvedValue({
            channels: [
                {
                    ...channel('100', TXID_A, 0, '1000'),
                    zero_conf_confirmed_scid: '200',
                    alias_scids: ['300']
                }
            ]
        });
        getChannelInfo.mockImplementation(edgeNotFound);

        const result = await repairMissingChannelEdges('lnd');

        expect(getChannelInfo).toHaveBeenCalledTimes(3);
        expect(result?.repaired).toEqual([`${TXID_A}:0`]);
    });

    it('skips the channel if a later scid lookup errors', async () => {
        getChannels.mockResolvedValue({
            channels: [
                {
                    ...channel('100', TXID_A, 0, '1000'),
                    zero_conf_confirmed_scid: '200'
                }
            ]
        });
        getChannelInfo
            .mockImplementationOnce(edgeNotFound)
            .mockRejectedValueOnce(new Error('context deadline exceeded'));

        const result = await repairMissingChannelEdges('lnd');

        expect(updateChannelPolicy).not.toHaveBeenCalled();
        expect(result?.skipped).toEqual([`${TXID_A}:0`]);
    });

    it('does not hand a run for one node to a call for another', async () => {
        let releaseFirst: (value: any) => void = () => {};
        getChannels
            .mockImplementationOnce(
                () => new Promise((resolve) => (releaseFirst = resolve))
            )
            .mockResolvedValue({ channels: [channel('1', TXID_A, 0)] });
        getChannelInfo.mockResolvedValue({});

        const first = repairMissingChannelEdges('lnd');
        selectWallet('embedded-lnd', 'lnd2');
        const second = repairMissingChannelEdges('lnd2');
        expect(second).not.toBe(first);

        releaseFirst({ channels: [channel('1', TXID_A, 0)] });
        expect(await first).toBeUndefined();
        expect((await second)?.checked).toBe(1);
        expect(getChannels).toHaveBeenCalledTimes(2);
    });

    it('retries the node on the next call after a skipped channel', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0, '1000')]
        });
        getChannelInfo
            .mockRejectedValueOnce(new Error('context deadline exceeded'))
            .mockImplementationOnce(edgeNotFound);

        const first = await repairMissingChannelEdges('lnd');
        expect(first?.skipped).toEqual([`${TXID_A}:0`]);

        const second = await repairMissingChannelEdges('lnd');
        expect(second?.repaired).toEqual([`${TXID_A}:0`]);
        const calls = getChannels.mock.calls.length;

        // The second pass was clean, so the node is done
        expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        expect(getChannels).toHaveBeenCalledTimes(calls);
    });

    it('retries failed repairs at most MAX_REPAIR_ATTEMPTS times', async () => {
        getChannels.mockResolvedValue({
            channels: [channel('1', TXID_A, 0, '1000')]
        });
        getChannelInfo.mockImplementation(edgeNotFound);
        updateChannelPolicy.mockResolvedValue({
            failed_updates: [{ update_error: 'could not add edge' }]
        });

        for (let i = 0; i < MAX_REPAIR_ATTEMPTS; i++) {
            const result = await repairMissingChannelEdges('lnd');
            expect(result?.failed).toEqual([`${TXID_A}:0`]);
        }
        expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        expect(updateChannelPolicy).toHaveBeenCalledTimes(MAX_REPAIR_ATTEMPTS);

        // The cap is per node
        selectWallet('embedded-lnd', 'lnd2');
        await repairMissingChannelEdges('lnd2');
        expect(updateChannelPolicy).toHaveBeenCalledTimes(
            MAX_REPAIR_ATTEMPTS + 1
        );
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

        selectWallet('embedded-lnd', 'lnd2');
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
        expect(result).toEqual({
            checked: 0,
            repaired: [],
            failed: [],
            skipped: [],
            pendingPeers: []
        });
    });

    describe('peer reconnect', () => {
        it('reconnects the peer of a repaired channel', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).toHaveBeenCalledTimes(1);
            expect(disconnectPeer).toHaveBeenCalledWith(PEER_A);
            expect(sleep).toHaveBeenCalledWith(RECONNECT_DELAY_MS);
            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(connectPeer).toHaveBeenCalledWith({
                addr: { pubkey: PEER_A, host: '10.0.0.1:9735' },
                perm: true
            });
            expect(disconnectPeer.mock.invocationCallOrder[0]).toBeLessThan(
                connectPeer.mock.invocationCallOrder[0]
            );
        });

        it('reconnects each peer once after all repairs finish', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_A),
                    channel('3', TXID_C, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo.mockImplementation(edgeNotFound);

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer.mock.calls).toEqual([[PEER_A], [PEER_B]]);
            expect(connectPeer).toHaveBeenCalledTimes(2);
            const lastRepair = Math.max(
                ...updateChannelPolicy.mock.invocationCallOrder
            );
            expect(disconnectPeer.mock.invocationCallOrder[0]).toBeGreaterThan(
                lastRepair
            );
        });

        it('only reconnects peers whose channels were repaired', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo.mockImplementation((chanId: string) =>
                chanId === '2' ? edgeNotFound() : Promise.resolve({})
            );

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer.mock.calls).toEqual([[PEER_B]]);
        });

        it('does not touch peers when nothing was repaired', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockResolvedValue({});

            await repairMissingChannelEdges('lnd');

            expect(listPeers).not.toHaveBeenCalled();
            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(connectPeer).not.toHaveBeenCalled();
        });

        it('does not reconnect the peer of a failed repair', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            updateChannelPolicy.mockResolvedValue({
                failed_updates: [{ update_error: 'could not add edge' }]
            });

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('skips inbound and unlisted peers', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            listPeers.mockResolvedValue([
                { pub_key: PEER_A, address: '10.0.0.1:51234', inbound: true }
            ]);

            const result = await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(connectPeer).not.toHaveBeenCalled();
            expect(result?.repaired).toHaveLength(2);
        });

        it('skips a peer listed without an address', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            listPeers.mockResolvedValue([
                { pub_key: PEER_A, address: '', inbound: false }
            ]);

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('does not connect if the disconnect failed', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            disconnectPeer.mockResolvedValue(null);

            await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).toHaveBeenCalledTimes(1);
            expect(connectPeer).not.toHaveBeenCalled();
        });

        it('retries the connect while lnd still reports already connected', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            connectPeer
                .mockRejectedValueOnce(
                    new Error('already connected to peer: 02aa@10.0.0.1:9735')
                )
                .mockResolvedValueOnce({});

            await repairMissingChannelEdges('lnd');

            expect(connectPeer).toHaveBeenCalledTimes(2);
            expect(sleep).toHaveBeenCalledTimes(2);
        });

        it('stops retrying after MAX_RECONNECT_TRIES', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            connectPeer.mockRejectedValue(new Error('already connected'));

            const result = await repairMissingChannelEdges('lnd');

            expect(connectPeer).toHaveBeenCalledTimes(MAX_RECONNECT_TRIES);
            expect(result?.repaired).toEqual([`${TXID_A}:0`]);
        });

        it('does not retry other connect errors and moves to the next peer', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            connectPeer
                .mockRejectedValueOnce(
                    new Error('dial tcp: connection refused')
                )
                .mockResolvedValueOnce({});

            await repairMissingChannelEdges('lnd');

            expect(connectPeer.mock.calls.map(([d]) => d.addr.pubkey)).toEqual([
                PEER_A,
                PEER_B
            ]);
        });

        it('keeps the repair result if listing peers fails', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            listPeers.mockRejectedValue(new Error('rpc not ready'));

            const result = await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(result?.repaired).toEqual([`${TXID_A}:0`]);
            expect(result?.pendingPeers).toEqual([PEER_A]);
        });

        it('skips a repaired channel without a remote pubkey', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    { ...channel('1', TXID_A, 0, '1000'), remote_pubkey: '' }
                ]
            });
            getChannelInfo.mockImplementation(edgeNotFound);

            await repairMissingChannelEdges('lnd');

            expect(listPeers).not.toHaveBeenCalled();
        });
    });

    describe('pending peer recovery', () => {
        // First run: the edge is missing and gets repaired. Later runs: the
        // edge is present, with or without the peer's policy.
        const repairThen = (withPeerPolicy: boolean) => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockResolvedValue(edge(PEER_A, withPeerPolicy));
        };

        it('retries the reconnect after listing peers failed', async () => {
            repairThen(false);
            listPeers
                .mockRejectedValueOnce(new Error('rpc not ready'))
                .mockResolvedValue([
                    { pub_key: PEER_A, address: '10.0.0.1:9735' }
                ]);

            const first = await repairMissingChannelEdges('lnd');
            expect(first?.pendingPeers).toEqual([PEER_A]);
            expect(disconnectPeer).not.toHaveBeenCalled();

            const second = await repairMissingChannelEdges('lnd');
            expect(second?.repaired).toEqual([]);
            expect(second?.pendingPeers).toEqual([]);
            expect(disconnectPeer).toHaveBeenCalledWith(PEER_A);
            expect(connectPeer).toHaveBeenCalledTimes(1);

            // Recovered, so the node is done
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });

        it('retries the reconnect after the disconnect failed', async () => {
            repairThen(false);
            disconnectPeer.mockResolvedValueOnce(null);

            const first = await repairMissingChannelEdges('lnd');
            expect(first?.pendingPeers).toEqual([PEER_A]);
            expect(connectPeer).not.toHaveBeenCalled();

            const second = await repairMissingChannelEdges('lnd');
            expect(second?.pendingPeers).toEqual([]);
            expect(disconnectPeer).toHaveBeenCalledTimes(2);
            expect(connectPeer).toHaveBeenCalledTimes(1);
        });

        it('retries the reconnect after the connect attempts ran out', async () => {
            repairThen(false);
            for (let i = 0; i < MAX_RECONNECT_TRIES; i++) {
                connectPeer.mockRejectedValueOnce(
                    new Error('already connected to peer')
                );
            }

            const first = await repairMissingChannelEdges('lnd');
            expect(first?.pendingPeers).toEqual([PEER_A]);

            const second = await repairMissingChannelEdges('lnd');
            expect(second?.pendingPeers).toEqual([]);
            expect(connectPeer).toHaveBeenCalledTimes(MAX_RECONNECT_TRIES + 1);
        });

        it('drops a pending peer whose policy arrived in the meantime', async () => {
            repairThen(true);
            listPeers.mockRejectedValueOnce(new Error('rpc not ready'));

            await repairMissingChannelEdges('lnd');
            const second = await repairMissingChannelEdges('lnd');

            expect(second?.pendingPeers).toEqual([]);
            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });

        it('drops a pending peer whose channel is gone', async () => {
            repairThen(false);
            listPeers.mockRejectedValueOnce(new Error('rpc not ready'));

            await repairMissingChannelEdges('lnd');
            getChannels.mockResolvedValue({ channels: [] });
            const second = await repairMissingChannelEdges('lnd');

            expect(second?.pendingPeers).toEqual([]);
            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('does not reconnect peers of healthy edges without a policy', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockResolvedValue(edge(PEER_A, false));

            await repairMissingChannelEdges('lnd');

            expect(listPeers).not.toHaveBeenCalled();
            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('does not keep inbound peers pending', async () => {
            repairThen(false);
            listPeers.mockResolvedValue([
                { pub_key: PEER_A, address: '10.0.0.1:51234', inbound: true }
            ]);

            const result = await repairMissingChannelEdges('lnd');

            expect(result?.pendingPeers).toEqual([]);
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });

        it('stops retrying pending peers after MAX_REPAIR_ATTEMPTS runs', async () => {
            repairThen(false);
            disconnectPeer.mockResolvedValue(null);

            for (let i = 0; i < MAX_REPAIR_ATTEMPTS; i++) {
                const result = await repairMissingChannelEdges('lnd');
                expect(result?.pendingPeers).toEqual([PEER_A]);
            }
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(disconnectPeer).toHaveBeenCalledTimes(MAX_REPAIR_ATTEMPTS);
        });
    });

    describe('in-flight HTLCs', () => {
        const withHtlc = (ch: any) => ({
            ...ch,
            pending_htlcs: [{ incoming: false, amount: '1000' }]
        });

        it('does not disconnect a peer with HTLCs on the repaired channel', async () => {
            getChannels.mockResolvedValue({
                channels: [withHtlc(channel('1', TXID_A, 0, '1000'))]
            });
            getChannelInfo.mockImplementation(edgeNotFound);

            const result = await repairMissingChannelEdges('lnd');

            expect(result?.repaired).toEqual([`${TXID_A}:0`]);
            expect(result?.pendingPeers).toEqual([PEER_A]);
            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(connectPeer).not.toHaveBeenCalled();
        });

        it('does not disconnect a peer with HTLCs on its other channel', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    withHtlc(channel('2', TXID_B, 0, '1000', PEER_A))
                ]
            });
            getChannelInfo.mockImplementation((chanId: string) =>
                chanId === '1'
                    ? edgeNotFound()
                    : Promise.resolve(edge(PEER_A, true))
            );

            const result = await repairMissingChannelEdges('lnd');

            expect(result?.pendingPeers).toEqual([PEER_A]);
            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('reconnects on a later run once the HTLCs are resolved', async () => {
            getChannels.mockResolvedValue({
                channels: [withHtlc(channel('1', TXID_A, 0, '1000'))]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockResolvedValue(edge(PEER_A, false));

            await repairMissingChannelEdges('lnd');
            expect(disconnectPeer).not.toHaveBeenCalled();

            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            const second = await repairMissingChannelEdges('lnd');

            expect(second?.pendingPeers).toEqual([]);
            expect(disconnectPeer).toHaveBeenCalledWith(PEER_A);
            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });

        it('still reconnects peers without HTLCs', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    withHtlc(channel('1', TXID_A, 0, '1000', PEER_A)),
                    channel('2', TXID_B, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo.mockImplementation(edgeNotFound);

            const result = await repairMissingChannelEdges('lnd');

            expect(disconnectPeer.mock.calls).toEqual([[PEER_B]]);
            expect(result?.pendingPeers).toEqual([PEER_A]);
        });

        it('checks for HTLCs right before each disconnect', async () => {
            const channels = [
                channel('1', TXID_A, 0, '1000', PEER_A),
                channel('2', TXID_B, 0, '1000', PEER_B)
            ];
            getChannels
                // Listing channels for the run, then the check for PEER_A
                .mockResolvedValueOnce({ channels })
                .mockResolvedValueOnce({ channels })
                // A payment to PEER_B started during PEER_A's reconnect
                .mockResolvedValue({
                    channels: [channels[0], withHtlc(channels[1])]
                });
            getChannelInfo.mockImplementation(edgeNotFound);

            const result = await repairMissingChannelEdges('lnd');

            expect(disconnectPeer.mock.calls).toEqual([[PEER_A]]);
            expect(result?.pendingPeers).toEqual([PEER_B]);
        });

        it('does not disconnect if the HTLC check fails', async () => {
            getChannels
                .mockResolvedValueOnce({
                    channels: [channel('1', TXID_A, 0, '1000')]
                })
                .mockRejectedValue(new Error('rpc not ready'));
            getChannelInfo.mockImplementation(edgeNotFound);

            const result = await repairMissingChannelEdges('lnd');

            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(result?.pendingPeers).toEqual([PEER_A]);
        });

        it('does not disconnect if the wallet changed during the HTLC check', async () => {
            getChannels
                .mockResolvedValueOnce({
                    channels: [channel('1', TXID_A, 0, '1000')]
                })
                .mockImplementation(async () => {
                    selectWallet('embedded-lnd', 'other');
                    return { channels: [] };
                });
            getChannelInfo.mockImplementation(edgeNotFound);

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(disconnectPeer).not.toHaveBeenCalled();
        });
    });

    describe('wallet switches', () => {
        it('does nothing if another wallet is selected when it starts', async () => {
            // The user switched wallets while channels were polling
            selectWallet('embedded-lnd', 'other');

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(getChannels).not.toHaveBeenCalled();
        });

        it('does nothing for a remote node with the same lndDir', async () => {
            selectWallet('lnd', 'lnd');

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(getChannels).not.toHaveBeenCalled();
        });

        it('treats a missing lndDir in settings as the default lnd', async () => {
            selectWallet('embedded-lnd', undefined);
            getChannels.mockResolvedValue({ channels: [] });

            expect(await repairMissingChannelEdges('lnd')).toBeDefined();
        });

        it('stops after listing channels if the wallet changed', async () => {
            getChannels.mockImplementation(async () => {
                selectWallet('lnd', 'lnd');
                return { channels: [channel('1', TXID_A, 0, '1000')] };
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(getChannelInfo).not.toHaveBeenCalled();
        });

        it('does not update a policy if the wallet changed during the edge lookup', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(() => {
                selectWallet('embedded-lnd', 'other');
                return edgeNotFound();
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(updateChannelPolicy).not.toHaveBeenCalled();
        });

        it('does not touch peers if the wallet changed during the repair', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            updateChannelPolicy.mockImplementation(async () => {
                selectWallet('embedded-lnd', 'other');
                return { failed_updates: [] };
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(listPeers).not.toHaveBeenCalled();
            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('does not connect if the wallet changed during the reconnect delay', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            mockedSleep.mockImplementation(async () => {
                selectWallet('embedded-lnd', 'other');
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(disconnectPeer).toHaveBeenCalledTimes(1);
            expect(connectPeer).not.toHaveBeenCalled();
        });

        it('runs again when the user returns to the wallet', async () => {
            getChannels.mockImplementationOnce(async () => {
                selectWallet('embedded-lnd', 'other');
                return { channels: [] };
            });
            getChannels.mockResolvedValue({ channels: [] });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();

            selectWallet('embedded-lnd', 'lnd');
            expect(await repairMissingChannelEdges('lnd')).toBeDefined();
            expect(getChannels).toHaveBeenCalledTimes(2);
        });

        it('does not count a stopped run toward MAX_REPAIR_ATTEMPTS', async () => {
            let switchAway = true;
            getChannels.mockImplementation(async () => {
                if (switchAway) selectWallet('embedded-lnd', 'other');
                return { channels: [channel('1', TXID_A, 0, '1000')] };
            });
            getChannelInfo.mockImplementation(edgeNotFound);
            updateChannelPolicy.mockResolvedValue({
                failed_updates: [{ update_error: 'could not add edge' }]
            });

            for (let i = 0; i < MAX_REPAIR_ATTEMPTS + 1; i++) {
                selectWallet('embedded-lnd', 'lnd');
                expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            }

            switchAway = false;
            selectWallet('embedded-lnd', 'lnd');
            for (let i = 0; i < MAX_REPAIR_ATTEMPTS; i++) {
                const result = await repairMissingChannelEdges('lnd');
                expect(result?.failed).toEqual([`${TXID_A}:0`]);
            }
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });
    });

    describe('pending peer state across runs', () => {
        const timeout = () =>
            Promise.reject(new Error('context deadline exceeded'));

        it('keeps a pending peer when its channel cannot be checked', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockImplementationOnce(timeout)
                .mockResolvedValue(edge(PEER_A, false));
            listPeers.mockRejectedValueOnce(new Error('rpc not ready'));

            // Run 1: repaired, but listing peers fails
            const first = await repairMissingChannelEdges('lnd');
            expect(first?.pendingPeers).toEqual([PEER_A]);

            // Run 2: the edge lookup times out
            const second = await repairMissingChannelEdges('lnd');
            expect(second?.skipped).toEqual([`${TXID_A}:0`]);
            expect(second?.pendingPeers).toEqual([PEER_A]);
            expect(disconnectPeer).not.toHaveBeenCalled();

            // Run 3: the edge has no peer policy, so reconnect
            const third = await repairMissingChannelEdges('lnd');
            expect(disconnectPeer).toHaveBeenCalledWith(PEER_A);
            expect(connectPeer).toHaveBeenCalledTimes(1);
            expect(third?.pendingPeers).toEqual([]);
        });

        it('keeps a peer pending while any of its channels cannot be checked', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_A)
                ]
            });
            listPeers.mockRejectedValueOnce(new Error('rpc not ready'));
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockImplementationOnce(edgeNotFound);

            await repairMissingChannelEdges('lnd');

            getChannelInfo
                .mockImplementationOnce(timeout)
                .mockResolvedValueOnce(edge(PEER_A, true));
            const second = await repairMissingChannelEdges('lnd');

            expect(second?.pendingPeers).toEqual([PEER_A]);
            expect(disconnectPeer).not.toHaveBeenCalled();
        });

        it('keeps newly repaired peers when a wallet switch stops the run', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockResolvedValue(edge(PEER_A, false));
            updateChannelPolicy.mockImplementationOnce(async () => {
                selectWallet('embedded-lnd', 'other');
                return { failed_updates: [] };
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(disconnectPeer).not.toHaveBeenCalled();

            // Back on the wallet, the edge exists but the peer has not
            // resent its policy
            selectWallet('embedded-lnd', 'lnd');
            const result = await repairMissingChannelEdges('lnd');

            expect(result?.repaired).toEqual([]);
            expect(disconnectPeer).toHaveBeenCalledWith(PEER_A);
            expect(result?.pendingPeers).toEqual([]);
        });

        it('drops a peer kept by a stopped run once its policy is back', async () => {
            getChannels.mockResolvedValue({
                channels: [channel('1', TXID_A, 0, '1000')]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockResolvedValue(edge(PEER_A, true));
            listPeers.mockImplementationOnce(async () => {
                selectWallet('embedded-lnd', 'other');
                return [];
            });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();

            // Switching back restarted the node, so the peer reconnected
            // and resent its policy
            selectWallet('embedded-lnd', 'lnd');
            const result = await repairMissingChannelEdges('lnd');

            expect(result?.pendingPeers).toEqual([]);
            expect(disconnectPeer).not.toHaveBeenCalled();
            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
        });

        it('does not reconnect a peer again after a stop later in the run', async () => {
            getChannels.mockResolvedValue({
                channels: [
                    channel('1', TXID_A, 0, '1000', PEER_A),
                    channel('2', TXID_B, 0, '1000', PEER_B)
                ]
            });
            getChannelInfo
                .mockImplementationOnce(edgeNotFound)
                .mockImplementationOnce(edgeNotFound)
                .mockResolvedValue(edge(PEER_B, false));
            // Stop during the second peer's reconnect delay
            mockedSleep
                .mockResolvedValueOnce(undefined)
                .mockImplementationOnce(async () => {
                    selectWallet('embedded-lnd', 'other');
                });

            expect(await repairMissingChannelEdges('lnd')).toBeUndefined();
            expect(connectPeer.mock.calls.map(([d]) => d.addr.pubkey)).toEqual([
                PEER_A
            ]);

            selectWallet('embedded-lnd', 'lnd');
            getChannelInfo.mockImplementation(async (chanId: string) =>
                chanId === '1' ? edge(PEER_A, false) : edge(PEER_B, false)
            );
            await repairMissingChannelEdges('lnd');

            // Only the peer the stopped run did not reach is retried
            expect(disconnectPeer.mock.calls).toEqual([
                [PEER_A],
                [PEER_B],
                [PEER_B]
            ]);
        });
    });
});
