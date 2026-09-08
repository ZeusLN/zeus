jest.mock('react-native-randombytes', () => ({
    randomBytes: () => Buffer.alloc(32)
}));
jest.mock('../utils/BackendUtils', () => ({
    getChannels: jest.fn(),
    getNodeInfo: jest.fn(() => Promise.resolve(null)),
    supportsClosedChannels: () => false,
    supportsPendingChannels: () => false,
    isLNDBased: () => false
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => String(e)
}));

import { autorun } from 'mobx';

import ChannelsStore from './ChannelsStore';
import BackendUtils from '../utils/BackendUtils';

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
