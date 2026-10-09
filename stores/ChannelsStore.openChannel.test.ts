jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => jest.requireActual('crypto').randomBytes(n)
}));
jest.mock('../utils/BackendUtils', () => ({
    isLNDBased: jest.fn(() => true),
    supportsChannelMemo: jest.fn(() => true),
    openChannelSync: jest.fn(),
    getPendingChannels: jest.fn(),
    getChannels: jest.fn(),
    supportsClosedChannels: () => false,
    supportsPendingChannels: () => false
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));

import ChannelsStore from './ChannelsStore';
import BackendUtils from '../utils/BackendUtils';
import OpenChannelRequest from '../models/OpenChannelRequest';
import { OPEN_MEMO_PREFIX } from '../utils/ChannelOpenUtils';

const isLNDBased = BackendUtils.isLNDBased as jest.Mock;
const supportsChannelMemo = BackendUtils.supportsChannelMemo as jest.Mock;
const openChannelSync = BackendUtils.openChannelSync as jest.Mock;
const getPendingChannels = BackendUtils.getPendingChannels as jest.Mock;
const getChannels = BackendUtils.getChannels as jest.Mock;

// cln-rest skips the node-info enrichment reaction; the open path only
// looks at the implementation to decide whether to keep the host
const makeStore = () =>
    new ChannelsStore(
        { implementation: 'cln-rest' } as any,
        { setPendingCloseBalance: jest.fn() } as any
    );

const open = (store: ChannelsStore) =>
    (store as any).openChannel(
        new OpenChannelRequest({
            node_pubkey_string: '02peer',
            local_funding_amount: '100000',
            sat_per_vbyte: '2',
            account: 'default'
        })
    );

const sentRequest = () => openChannelSync.mock.calls[0][0];

// runs the open, then every lookup and the 5s waits between them
const settle = async () => {
    for (let i = 0; i < 4; i++) await jest.advanceTimersByTimeAsync(5000);
};

describe('ChannelsStore.openChannel through openChannelSync', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        isLNDBased.mockReturnValue(true);
        supportsChannelMemo.mockReturnValue(true);
        getPendingChannels.mockResolvedValue({ pending_open_channels: [] });
        getChannels.mockResolvedValue({ channels: [] });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('attaches a memo on LND nodes that store one', async () => {
        openChannelSync.mockResolvedValue({
            funding_txid_str: 'abc',
            output_index: 0
        });
        open(makeStore());
        await settle();

        expect(sentRequest().memo.startsWith(OPEN_MEMO_PREFIX)).toBe(true);
    });

    it('attaches no memo where the node cannot store one', async () => {
        supportsChannelMemo.mockReturnValue(false);
        openChannelSync.mockResolvedValue({
            funding_txid_str: 'abc',
            output_index: 0
        });
        open(makeStore());
        await settle();

        expect(sentRequest().memo).toBeUndefined();
    });

    it('reports a timed out open that went through as opened', async () => {
        openChannelSync.mockRejectedValue(
            new Error('lnrpc.Lightning.OpenChannelSync timed out after 60000ms')
        );
        getPendingChannels.mockImplementation(async () => ({
            pending_open_channels: [
                {
                    channel: {
                        channel_point: 'funding:1',
                        memo: sentRequest().memo
                    }
                }
            ]
        }));
        const store = makeStore();
        open(store);
        await settle();

        expect(store.channelSuccess).toBe(true);
        expect(store.funding_txid_str).toBe('funding');
        expect(store.output_index).toBe(1);
        expect(store.errorOpenChannel).toBe(false);
        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.openingChannel).toBe(false);
    });

    it('blocks a second open when a timed out one cannot be found', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).toHaveBeenCalledTimes(3);
        expect(store.channelSuccess).toBe(false);
        expect(store.errorOpenChannel).toBe(true);
        expect(store.openOutcomeUnknown).toBe(true);
        expect(store.errorMsgChannel).toBe(
            'stores.ChannelsStore.openOutcomeUnknown'
        );
        expect(store.openingChannel).toBe(false);
    });

    it('treats a timeout as unknown without looking when no memo was sent', async () => {
        supportsChannelMemo.mockReturnValue(false);
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(true);
    });

    it('shows a node error as before, without looking it up', async () => {
        openChannelSync.mockRejectedValue(new Error('peer is not online'));
        const store = makeStore();
        open(store);
        await settle();

        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.errorMsgChannel).toBe('peer is not online');
    });

    it('leaves timeouts on other backends as plain errors', async () => {
        isLNDBased.mockReturnValue(false);
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();

        expect(sentRequest().memo).toBeUndefined();
        expect(getPendingChannels).not.toHaveBeenCalled();
        expect(store.openOutcomeUnknown).toBe(false);
        expect(store.errorMsgChannel).toBe('Request timeout');
    });

    it('clears an unknown outcome when the open screen resets', async () => {
        openChannelSync.mockRejectedValue(new Error('Request timeout'));
        const store = makeStore();
        open(store);
        await settle();
        expect(store.openOutcomeUnknown).toBe(true);

        store.resetOpenChannel();
        expect(store.openOutcomeUnknown).toBe(false);
    });
});
