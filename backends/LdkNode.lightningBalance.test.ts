const mockListBalances = jest.fn();
const mockListChannels = jest.fn();

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        node: {
            listBalances: (...args: any[]) => mockListBalances(...args),
            status: async () => ({ currentBestBlock_height: 100 })
        },
        channel: {
            listChannels: (...args: any[]) => mockListChannels(...args)
        }
    }
}));

jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

import LdkNode from './LdkNode';

describe('LdkNode channel balance at or below the reserve', () => {
    const CHANNEL_ID = 'aa'.repeat(32);

    // A 5,000,000 sat channel opened by the peer, of which `ours` is on our
    // side and `held` sits in an inbound HTLC that has not been claimed
    const setChannel = ({ ours, held }: { ours: number; held: number }) => {
        mockListChannels.mockResolvedValue([
            {
                channelId: CHANNEL_ID,
                counterpartyNodeId: 'peer',
                channelValueSats: 5_000_000,
                isChannelReady: true,
                isUsable: true,
                isAnnounced: false,
                isOutbound: false,
                outboundCapacityMsat: 0,
                inboundCapacityMsat: (4_949_340 - ours - held) * 1000,
                unspendablePunishmentReserve: 50_000,
                counterpartyUnspendablePunishmentReserve: 50_000
            }
        ]);
        mockListBalances.mockResolvedValue({
            totalOnchainBalanceSats: 0,
            spendableOnchainBalanceSats: 0,
            totalAnchorChannelsReserveSats: 0,
            totalLightningBalanceSats: ours,
            lightningBalances: [
                {
                    type: 'claimableOnChannelClose',
                    channelId: CHANNEL_ID,
                    amountSatoshis: ours
                },
                ...(held
                    ? [
                          {
                              type: 'maybePreimageClaimableHtlc',
                              channelId: CHANNEL_ID,
                              amountSatoshis: held
                          }
                      ]
                    : [])
            ],
            pendingBalancesFromChannelClosures: []
        });
    };

    const balances = async () => {
        const ldk = new LdkNode();
        const { balance } = await ldk.getLightningBalance();
        const { channels } = await ldk.getChannels();
        return [balance, channels[0].local_balance];
    };

    beforeEach(() => jest.clearAllMocks());

    it('reports nothing on our side of a fresh inbound channel', async () => {
        setChannel({ ours: 0, held: 0 });

        expect(await balances()).toEqual(['0', '0']);
    });

    it('reports what is on our side', async () => {
        setChannel({ ours: 20_000, held: 0 });

        expect(await balances()).toEqual(['20000', '20000']);
    });

    it('does not count an inbound HTLC that has not been claimed', async () => {
        setChannel({ ours: 20_000, held: 300_000 });

        expect(await balances()).toEqual(['20000', '20000']);
    });

    it('does not count an unclaimed HTLC on an empty channel', async () => {
        setChannel({ ours: 0, held: 299_998 });

        expect(await balances()).toEqual(['0', '0']);
    });
});
