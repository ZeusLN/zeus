jest.mock('react-native-randombytes', () => ({
    randomBytes: () => Buffer.alloc(32)
}));
jest.mock('../utils/BackendUtils', () => ({
    getChannels: jest.fn(),
    getPendingChannels: jest.fn(),
    getClosedChannels: jest.fn(),
    getNodeInfo: jest.fn(() => Promise.resolve(null)),
    closeChannel: jest.fn(),
    connectPeer: jest.fn(),
    openChannelSync: jest.fn(),
    openChannelStream: jest.fn(),
    fundPsbt: jest.fn(),
    signPsbt: jest.fn(),
    fundingStateStep: jest.fn(),
    supportsClosedChannels: jest.fn(() => false),
    supportsPendingChannels: jest.fn(() => false),
    isLNDBased: () => false
}));
jest.mock('../utils/LocaleUtils');

import { autorun } from 'mobx';

import ChannelsStore from './ChannelsStore';
import BackendUtils from '../utils/BackendUtils';
import ChannelInfo from '../models/ChannelInfo';

const channel = (
    localBalance: number,
    remoteBalance: number,
    active: boolean
) => ({
    active,
    local_balance: String(localBalance),
    remote_balance: String(remoteBalance),
    remote_pubkey: `pubkey-${localBalance}-${remoteBalance}`,
    channel_id: `chan-${localBalance}-${remoteBalance}`
});

// cln-rest short-circuits the node-info enrichment reaction, which would
// otherwise leave its 10s lookup timeout pending after each test. The balance
// accounting under test is implementation independent.
const makeStore = () =>
    new ChannelsStore(
        { implementation: 'cln-rest' } as any,
        { setPendingCloseBalance: jest.fn() } as any
    );

describe('ChannelsStore.getChannels', () => {
    let store: ChannelsStore;

    beforeEach(() => {
        jest.clearAllMocks();
        store = makeStore();
    });

    it('splits local balance by channel activity', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true), channel(4000, 1000, false)]
        } as any);

        await store.getChannels();

        expect(store.hasChannelData).toBe(true);
        expect(store.totalOutbound).toBe(11243);
        expect(store.totalInbound).toBe(5000);
        // the offline channel's local balance is tracked apart from its
        // total capacity, so callers can tell it from an empty wallet
        expect(store.totalOutboundOffline).toBe(4000);
        expect(store.totalOffline).toBe(5000);
    });

    it('reports no capacity, not stale capacity, when every channel is offline', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, false)]
        } as any);

        await store.getChannels();

        expect(store.totalOutbound).toBe(0);
        expect(store.totalOutboundOffline).toBe(11243);
    });

    it('keeps the previous totals visible while a refresh is in flight', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();

        let release: (value: any) => void = () => {};
        jest.mocked(BackendUtils.getChannels).mockReturnValue(
            new Promise((resolve) => {
                release = resolve;
            }) as any
        );

        const refresh = store.getChannels();

        // Observers such as ChoosePaymentMethod read these synchronously while
        // the fetch is outstanding. Zeroing them here is what let a 12,000 sat
        // payment be offered against 11,243 sats of real capacity.
        expect(store.hasChannelData).toBe(true);
        expect(store.totalOutbound).toBe(11243);
        expect(store.channels.length).toBe(1);

        release({ channels: [channel(9000, 5000, true)] });
        await refresh;

        expect(store.totalOutbound).toBe(9000);
    });

    it('never publishes the data flag ahead of the totals', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();

        // an observer of the store sees every intermediate state, the way
        // ChoosePaymentMethod does
        const seen: Array<{ flag: boolean; outbound: number }> = [];
        const dispose = autorun(() =>
            seen.push({
                flag: store.hasChannelData,
                outbound: store.totalOutbound + store.totalOutboundOffline
            })
        );

        await store.getChannels();
        await store.getChannels();
        dispose();

        // the flag reading true against zeroed totals is the state that
        // renders "not enough funds" for a wallet that has the funds
        expect(seen.some((s) => s.flag && s.outbound === 0)).toBe(false);
    });

    it('clears the totals and the data flag when the fetch fails', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();

        jest.mocked(BackendUtils.getChannels).mockRejectedValue(
            new Error('offline')
        );
        await store.getChannels();

        expect(store.hasChannelData).toBe(false);
        expect(store.totalOutbound).toBe(0);
        expect(store.totalOutboundOffline).toBe(0);
        expect(store.totalInbound).toBe(0);
        expect(store.totalOffline).toBe(0);
        expect(store.channels).toEqual([]);
        expect(store.error).toBe(true);
    });
});

describe('ChannelsStore pending close balance', () => {
    afterEach(() => {
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(
            false
        );
    });

    it('hands BalanceStore the force closes a sweep can overlap', async () => {
        const balanceStore = { setPendingCloseBalance: jest.fn() };
        const store = new ChannelsStore(
            { implementation: 'cln-rest' } as any,
            balanceStore as any
        );
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(true);
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: []
        } as any);
        jest.mocked(BackendUtils.getPendingChannels).mockResolvedValue({
            total_limbo_balance: '96860',
            pending_open_channels: [],
            pending_closing_channels: [],
            waiting_close_channels: [],
            pending_force_closing_channels: [
                {
                    channel: channel(96860, 0, false),
                    closing_txid: 'commit',
                    limbo_balance: '96860',
                    blocks_til_maturity: 1,
                    pending_htlcs: []
                }
            ]
        } as any);

        await store.getChannels();

        expect(balanceStore.setPendingCloseBalance).toHaveBeenCalledWith(
            '96860',
            [],
            [{ txids: ['commit'], limboBalance: 96860 }]
        );
    });
});

describe('ChannelsStore.closeChannel', () => {
    let store: ChannelsStore;
    let balanceStore: {
        setPendingCloseBalance: jest.Mock;
        getCombinedBalance: jest.Mock;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        balanceStore = {
            setPendingCloseBalance: jest.fn(),
            getCombinedBalance: jest.fn(() => Promise.resolve())
        };
        store = new ChannelsStore(
            { implementation: 'cln-rest' } as any,
            balanceStore as any
        );
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: []
        } as any);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const expectOneRefresh = () => {
        expect(BackendUtils.getChannels).toHaveBeenCalledTimes(1);
        expect(balanceStore.getCombinedBalance).toHaveBeenCalledTimes(1);
        // resetting would show zero balances until the reload completes
        expect(balanceStore.getCombinedBalance).toHaveBeenCalledWith();
    };

    it('reloads channels and balances when the close request succeeds', async () => {
        jest.mocked(BackendUtils.closeChannel).mockResolvedValue({} as any);

        await store.closeChannel(undefined, 'chan');

        expectOneRefresh();
        expect(store.closeChannelErr).toBeNull();
    });

    it('reloads channels and balances when the close request fails', async () => {
        jest.mocked(BackendUtils.closeChannel).mockRejectedValue(
            new Error('fee proposal exceeds max fee')
        );

        await store.closeChannel(undefined, 'chan');

        expectOneRefresh();
        expect(store.closeChannelErr).toBeTruthy();
    });

    it('clears the channel list when the node is unreachable for both the close and the refresh', async () => {
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();
        jest.clearAllMocks();

        jest.mocked(BackendUtils.closeChannel).mockRejectedValue(
            new Error('offline')
        );
        jest.mocked(BackendUtils.getChannels).mockRejectedValue(
            new Error('offline')
        );

        await store.closeChannel(undefined, 'chan');
        await jest.advanceTimersByTimeAsync(0);

        expectOneRefresh();
        expect(store.closeChannelErr).toBe('offline');
        expect(store.channels).toEqual([]);
        expect(store.hasChannelData).toBe(false);
        expect(store.error).toBe(true);
    });

    it('reloads channels and balances when the close request is still pending after six seconds', async () => {
        jest.mocked(BackendUtils.closeChannel).mockReturnValue(
            new Promise(() => {}) as any
        );

        const close = store.closeChannel(undefined, 'chan');
        await jest.advanceTimersByTimeAsync(6000);
        await close;

        expectOneRefresh();
    });

    it('passes the channel point and close options to the backend on LND', async () => {
        store = new ChannelsStore(
            { implementation: 'lnd' } as any,
            balanceStore as any
        );
        jest.mocked(BackendUtils.closeChannel).mockResolvedValue({} as any);

        await store.closeChannel(
            { funding_txid_str: 'txid', output_index: '1' },
            undefined,
            '10',
            false,
            'bcrt1qdelivery'
        );

        expect(BackendUtils.closeChannel).toHaveBeenCalledWith([
            'txid',
            '1',
            false,
            '10',
            'bcrt1qdelivery'
        ]);
        expectOneRefresh();
    });

    it('ignores a result that arrives after the forced resolution', async () => {
        let reject: (error: Error) => void = () => {};
        jest.mocked(BackendUtils.closeChannel).mockReturnValue(
            new Promise((_, rej) => {
                reject = rej;
            }) as any
        );

        const close = store.closeChannel(undefined, 'chan');
        await jest.advanceTimersByTimeAsync(6000);
        await close;
        // the REST close call stays open until the request times out
        reject(new Error('Request timeout'));
        await jest.advanceTimersByTimeAsync(0);

        expect(store.closeChannelErr).toBeNull();
        expectOneRefresh();
    });

    describe('on LNC', () => {
        const CHANNEL_POINT = { funding_txid_str: 'txid', output_index: '1' };

        beforeEach(() => {
            store = new ChannelsStore(
                { implementation: 'lightning-node-connect' } as any,
                balanceStore as any
            );
        });

        it('reloads channels and balances once the close stream succeeds', async () => {
            jest.mocked(BackendUtils.closeChannel).mockResolvedValue({} as any);

            await store.closeChannel(CHANNEL_POINT);

            expectOneRefresh();
            expect(store.closeChannelErr).toBeNull();
        });

        it('reloads channels and balances when the close stream fails', async () => {
            jest.mocked(BackendUtils.closeChannel).mockRejectedValue(
                new Error('peer is offline')
            );

            await store.closeChannel(CHANNEL_POINT);

            expectOneRefresh();
            expect(store.closeChannelErr).toBe('peer is offline');
        });

        it('waits for the close stream instead of resolving after six seconds', async () => {
            let finishClose: () => void = () => {};
            jest.mocked(BackendUtils.closeChannel).mockReturnValue(
                new Promise((resolve) => {
                    finishClose = () => resolve({});
                }) as any
            );

            const close = store.closeChannel(CHANNEL_POINT);
            await jest.advanceTimersByTimeAsync(60_000);

            expect(store.closingChannel).toBe(true);
            expect(BackendUtils.getChannels).not.toHaveBeenCalled();

            finishClose();
            await close;

            expect(store.closingChannel).toBe(false);
            expectOneRefresh();
        });
    });
});

describe('ChannelsStore.haveAnnouncedChannels', () => {
    const pendingChannels = (pendingOpen: any[]) => ({
        pending_open_channels: pendingOpen,
        pending_closing_channels: [],
        pending_force_closing_channels: [],
        waiting_close_channels: []
    });

    // lets the enrichment reactions of all channel lists run to completion
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    beforeEach(() => {
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(true);
        jest.mocked(BackendUtils.getPendingChannels).mockResolvedValue(
            pendingChannels([])
        );
    });

    afterEach(() => {
        jest.mocked(BackendUtils.supportsPendingChannels).mockReturnValue(
            false
        );
        jest.mocked(BackendUtils.supportsClosedChannels).mockReturnValue(false);
    });

    it('is not cleared by a pending channel', async () => {
        const store = makeStore();
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [
                channel(11243, 5000, true),
                { ...channel(4000, 1000, true), private: true }
            ]
        } as any);
        // an inbound channel open from another node
        jest.mocked(BackendUtils.getPendingChannels).mockResolvedValue(
            pendingChannels([
                {
                    channel: {
                        remote_node_pub: 'stranger',
                        channel_point: 'txid:0',
                        capacity: '20000'
                    }
                }
            ])
        );

        await store.getChannels();
        await settle();

        expect(store.pendingChannels.length).toBe(1);
        expect(store.haveAnnouncedChannels).toBe(true);
    });

    it('ignores unannounced and inactive channels', async () => {
        const store = makeStore();
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [
                channel(11243, 5000, false),
                { ...channel(4000, 1000, true), private: true }
            ]
        } as any);

        await store.getChannels();
        await settle();

        expect(store.haveAnnouncedChannels).toBe(false);
    });

    it('is not cleared by a closed channel', async () => {
        const store = makeStore();
        jest.mocked(BackendUtils.supportsClosedChannels).mockReturnValue(true);
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        jest.mocked(BackendUtils.getClosedChannels).mockResolvedValue({
            channels: [{ ...channel(0, 0, false), close_type: 'REMOTE' }]
        } as any);

        await store.getChannels();
        await settle();

        expect(store.closedChannels.length).toBe(1);
        expect(store.haveAnnouncedChannels).toBe(true);
    });

    it('follows the open channel list across refreshes', async () => {
        const store = makeStore();
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();
        await settle();
        expect(store.haveAnnouncedChannels).toBe(true);

        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [
                channel(11243, 5000, false),
                { ...channel(4000, 1000, true), private: true }
            ]
        } as any);
        await store.getChannels();
        await settle();
        expect(store.haveAnnouncedChannels).toBe(false);
    });

    it('is set before node info lookups finish', async () => {
        jest.useFakeTimers();
        try {
            // lnd looks up node info for each new peer, which can take up
            // to 10s before it times out
            const store = new ChannelsStore(
                { implementation: 'lnd' } as any,
                { setPendingCloseBalance: jest.fn() } as any
            );
            jest.mocked(BackendUtils.getNodeInfo).mockReturnValue(
                new Promise(() => {}) as any
            );
            jest.mocked(BackendUtils.getChannels).mockResolvedValue({
                channels: [channel(11243, 5000, true)]
            } as any);

            await store.getChannels();

            expect(BackendUtils.getNodeInfo).toHaveBeenCalled();
            expect(store.haveAnnouncedChannels).toBe(true);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
            jest.mocked(BackendUtils.getNodeInfo).mockImplementation(() =>
                Promise.resolve(null)
            );
        }
    });

    it('keeps its value when a refresh fails', async () => {
        const store = makeStore();
        jest.mocked(BackendUtils.getChannels).mockResolvedValue({
            channels: [channel(11243, 5000, true)]
        } as any);
        await store.getChannels();
        await settle();

        jest.mocked(BackendUtils.getChannels).mockRejectedValue(
            new Error('offline')
        );
        await store.getChannels();
        await settle();

        expect(store.error).toBe(true);
        expect(store.channels.length).toBe(0);
        expect(store.haveAnnouncedChannels).toBe(true);
    });
});

describe('ChannelsStore.getNodePolicy', () => {
    it('returns undefined for LND-shaped channel info missing CLNRest fields (issue #4591)', () => {
        const store = makeStore();
        // lnd getChanInfo response for a channel where neither side's
        // policy is in the graph yet: policies are null, and none of the
        // CLNRest fields (delay, htlc_minimum_msat, ...) exist
        store.chanInfo['123x456x0'] = new ChannelInfo({
            channel_id: '123x456x0',
            node1_pub: 'node1',
            node2_pub: 'node2',
            node1_policy: null,
            node2_policy: null
        });

        expect(store.getNodePolicy('123x456x0')).toBeUndefined();
    });

    it('returns undefined when channel info is missing entirely', () => {
        const store = makeStore();

        expect(store.getNodePolicy('unknown')).toBeUndefined();
    });

    it('builds a policy from CLNRest-shaped channel info', () => {
        const store = makeStore();
        store.chanInfo['456'] = new ChannelInfo({
            short_channel_id: '456',
            delay: 34,
            htlc_minimum_msat: 1000,
            htlc_maximum_msat: 990000000,
            base_fee_millisatoshi: 1000,
            fee_per_millionth: 10,
            last_update: 1700000000
        });

        expect(store.getNodePolicy('456')).toEqual({
            time_lock_delta: 34,
            min_htlc: '1000',
            fee_base_msat: '1000',
            fee_rate_milli_msat: '10',
            disabled: false,
            max_htlc_msat: '990000000',
            last_update: 1700000000
        });
    });

    it('leaves last_update undefined instead of NaN when absent', () => {
        const store = makeStore();
        store.chanInfo['789'] = new ChannelInfo({
            short_channel_id: '789',
            delay: 34,
            htlc_minimum_msat: 1000,
            htlc_maximum_msat: 990000000,
            base_fee_millisatoshi: 1000,
            fee_per_millionth: 10
        });

        expect(store.getNodePolicy('789')?.last_update).toBeUndefined();
    });
});

describe('ChannelsStore.connectPeer', () => {
    let store: ChannelsStore;

    beforeEach(() => {
        jest.clearAllMocks();
        store = makeStore();
    });

    it('surfaces an error for an empty host instead of hitting the backend when only connecting a peer', async () => {
        await store.connectPeer(
            {
                node_pubkey_string: 'abc',
                host: '',
                local_funding_amount: ''
            } as any,
            false,
            true
        );

        expect(BackendUtils.connectPeer).not.toHaveBeenCalled();
        // the empty-host fallthrough used to queue a channel request here,
        // sending LND an open with an empty funding amount
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
        expect(store.channelRequest).toBeFalsy();
        expect(store.errorPeerConnect).toBe(true);
        expect(store.errorMsgPeer).toBe('views.OpenChannel.hostRequired');
        expect(store.connectingToPeer).toBe(false);
    });

    it('surfaces an error for an empty host instead of opening a channel in the channel flow', async () => {
        await store.connectPeer({
            node_pubkey_string: 'abc',
            host: '',
            local_funding_amount: '100000',
            account: 'default'
        } as any);

        expect(BackendUtils.connectPeer).not.toHaveBeenCalled();
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
        expect(store.channelRequest).toBeFalsy();
        expect(store.errorPeerConnect).toBe(true);
        expect(store.errorMsgPeer).toBe('views.OpenChannel.hostRequired');
        expect(store.connectingToPeer).toBe(false);
    });

    it('leaves the peer error state untouched for an empty host when silent', async () => {
        store.errorMsgPeer = 'previous error';
        store.errorPeerConnect = true;

        await store.connectPeer(
            {
                node_pubkey_string: 'abc',
                host: '',
                local_funding_amount: '100000',
                account: 'default'
            } as any,
            false,
            false,
            true
        );

        expect(BackendUtils.connectPeer).not.toHaveBeenCalled();
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
        expect(store.channelRequest).toBeFalsy();
        expect(store.errorMsgPeer).toBe('previous error');
        expect(store.errorPeerConnect).toBe(true);
        expect(store.connectingToPeer).toBe(false);
    });

    it('queues the channel request for a peer that is already connected', async () => {
        jest.mocked(BackendUtils.connectPeer).mockRejectedValue(
            new Error('already connected to peer')
        );
        // keep the open pending so the queued request stays observable
        jest.mocked(BackendUtils.openChannelSync).mockReturnValue(
            new Promise(() => {})
        );
        const request = {
            node_pubkey_string: 'abc',
            host: 'peer.example.com:9735',
            local_funding_amount: '100000',
            account: 'default'
        };

        await expect(store.connectPeer(request as any)).resolves.toBe(true);

        expect(store.channelRequest).toEqual(request);
        expect(store.errorPeerConnect).toBe(false);
        expect(store.errorMsgPeer).toBeNull();
    });

    it('reports an already connected peer when only connecting a peer', async () => {
        jest.mocked(BackendUtils.connectPeer).mockRejectedValue(
            new Error('already connected to peer')
        );

        await expect(
            store.connectPeer(
                {
                    node_pubkey_string: 'abc',
                    host: 'peer.example.com:9735',
                    local_funding_amount: ''
                } as any,
                false,
                true
            )
        ).resolves.toBe(true);

        expect(store.channelRequest).toBeFalsy();
        expect(store.errorPeerConnect).toBe(true);
        expect(store.errorMsgPeer).toBe('already connected to peer');
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
    });

    it('does not queue a channel request when only connecting a peer with a host', async () => {
        jest.mocked(BackendUtils.connectPeer).mockResolvedValue({} as any);

        await store.connectPeer(
            {
                node_pubkey_string: 'abc',
                host: 'peer.example.com:9735',
                local_funding_amount: ''
            } as any,
            false,
            true
        );

        expect(BackendUtils.connectPeer).toHaveBeenCalledWith({
            addr: { pubkey: 'abc', host: 'peer.example.com:9735' },
            perm: false
        });
        expect(store.peerSuccess).toBe(true);
        expect(store.channelRequest).toBeFalsy();
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
    });

    it('surfaces an error for an additional channel without a host in the channel flow', async () => {
        await store.connectPeer({
            node_pubkey_string: 'abc',
            host: 'peer.example.com:9735',
            local_funding_amount: '100000',
            account: 'default',
            additionalChannels: [
                {
                    node_pubkey_string: 'def',
                    host: '',
                    satAmount: 50000
                }
            ]
        } as any);

        expect(BackendUtils.connectPeer).not.toHaveBeenCalled();
        expect(BackendUtils.openChannelSync).not.toHaveBeenCalled();
        expect(store.channelRequest).toBeFalsy();
        expect(store.errorPeerConnect).toBe(true);
        expect(store.errorMsgPeer).toBe('views.OpenChannel.hostRequired');
        expect(store.connectingToPeer).toBe(false);
    });

    it('ignores additional channels without a host when only connecting a peer', async () => {
        jest.mocked(BackendUtils.connectPeer).mockResolvedValue({} as any);

        await store.connectPeer(
            {
                node_pubkey_string: 'abc',
                host: 'peer.example.com:9735',
                local_funding_amount: '',
                additionalChannels: [
                    {
                        node_pubkey_string: 'def',
                        host: '',
                        satAmount: 50000
                    }
                ]
            } as any,
            false,
            true
        );

        expect(BackendUtils.connectPeer).toHaveBeenCalledWith({
            addr: { pubkey: 'abc', host: 'peer.example.com:9735' },
            perm: false
        });
        expect(store.peerSuccess).toBe(true);
        expect(store.errorPeerConnect).toBe(false);
    });
});

describe('ChannelsStore batch channel open', () => {
    let store: ChannelsStore;

    const PSBT = 'cHNidP8BAFICAAAAAQ==';

    // two channels funded by one transaction: A is opened with no_publish,
    // B last, and B's psbt_finalize is what makes LND publish the batch
    const batchRequest = () =>
        ({
            node_pubkey_string: 'abc',
            host: 'peer-a.example.com:9735',
            local_funding_amount: '500000',
            account: 'default',
            additionalChannels: [
                {
                    node_pubkey_string: 'def',
                    host: 'peer-b.example.com:9735',
                    satAmount: '300000'
                }
            ]
        } as any);

    const fundingSteps = () =>
        jest
            .mocked(BackendUtils.fundingStateStep)
            .mock.calls.map(([step]: any) => step);

    const flushPromises = async () => {
        for (let i = 0; i < 10; i++) {
            await new Promise<void>((resolve) => setImmediate(resolve));
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        store = makeStore();

        jest.mocked(BackendUtils.connectPeer).mockResolvedValue({} as any);
        ['chan-a', 'chan-b'].forEach((pending_chan_id) =>
            jest.mocked(BackendUtils.openChannelStream).mockResolvedValueOnce({
                result: {
                    pending_chan_id,
                    psbt_fund: {
                        funding_address: `bc1q${pending_chan_id}`,
                        funding_amount: 1,
                        psbt: PSBT
                    }
                }
            } as any)
        );
        jest.mocked(BackendUtils.fundPsbt).mockResolvedValue({
            funded_psbt: PSBT
        } as any);
        jest.mocked(BackendUtils.signPsbt).mockResolvedValue({
            signed_psbt: PSBT
        } as any);
    });

    it('finalizes once LND has verified the PSBT for every channel', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockResolvedValue({} as any);

        await store.connectPeer(batchRequest());
        await flushPromises();

        expect(fundingSteps()).toEqual([
            {
                psbt_verify: {
                    funded_psbt: PSBT,
                    pending_chan_id: 'chan-a',
                    skip_finalize: true
                }
            },
            {
                psbt_verify: {
                    funded_psbt: PSBT,
                    pending_chan_id: 'chan-b'
                }
            },
            {
                psbt_finalize: {
                    signed_psbt: PSBT,
                    pending_chan_id: 'chan-b'
                }
            }
        ]);
        expect(store.channelSuccess).toBe(true);
        expect(store.errorOpenChannel).toBe(false);
    });

    it('does not finalize when LND fails to verify the PSBT for one of the channels', async () => {
        jest.mocked(BackendUtils.fundingStateStep).mockImplementation(
            (step: any) =>
                step.psbt_verify?.pending_chan_id === 'chan-a'
                    ? Promise.reject(new Error('Request timeout'))
                    : Promise.resolve({})
        );

        await store.connectPeer(batchRequest());
        await flushPromises();

        // finalizing B would have LND publish a transaction that also pays
        // A's funding output, for which no channel was negotiated
        expect(fundingSteps()).toEqual([
            {
                psbt_verify: {
                    funded_psbt: PSBT,
                    pending_chan_id: 'chan-a',
                    skip_finalize: true
                }
            }
        ]);
        expect(store.channelSuccess).toBe(false);
        expect(store.errorOpenChannel).toBe(true);
        expect(store.errorMsgChannel).toBe('Request timeout');
    });
});
