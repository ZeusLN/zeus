jest.mock('../stores/Stores', () => ({ settingsStore: {} }));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));
jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        node: { listBalances: jest.fn(), status: jest.fn() },
        onchain: { listUtxos: jest.fn() },
        payments: { listPayments: jest.fn() }
    }
}));

import LdkNode from './LdkNode';
import LdkNodeInjection from '../ldknode/LdkNodeInjection';

const mockBalances = (balances: {
    totalOnchainBalanceSats: number;
    spendableOnchainBalanceSats: number;
    totalAnchorChannelsReserveSats: number;
}) =>
    (LdkNodeInjection.node.listBalances as jest.Mock).mockResolvedValue({
        totalLightningBalanceSats: 0,
        lightningBalances: [],
        pendingBalancesFromChannelClosures: [],
        ...balances
    });

describe('LdkNode.getBlockchainBalance', () => {
    beforeEach(() => jest.clearAllMocks());

    it('reports the anchor channel reserve alongside the balances', async () => {
        mockBalances({
            totalOnchainBalanceSats: 130000,
            spendableOnchainBalanceSats: 75000,
            totalAnchorChannelsReserveSats: 25000
        });

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '130000',
            confirmed_balance: '100000',
            unconfirmed_balance: '30000',
            reserved_balance_anchor_chan: '25000'
        });
    });

    it('reports a zero reserve without anchor channels', async () => {
        mockBalances({
            totalOnchainBalanceSats: 50000,
            spendableOnchainBalanceSats: 50000,
            totalAnchorChannelsReserveSats: 0
        });

        const balance = await new LdkNode().getBlockchainBalance();
        expect(balance.confirmed_balance).toEqual('50000');
        expect(balance.reserved_balance_anchor_chan).toEqual('0');
    });

    it('still reports the reserve once it exceeds the spendable balance', async () => {
        mockBalances({
            totalOnchainBalanceSats: 20000,
            spendableOnchainBalanceSats: 0,
            totalAnchorChannelsReserveSats: 25000
        });
        (LdkNodeInjection.onchain.listUtxos as jest.Mock).mockResolvedValue([
            { txid: 'aa', vout: 0, value_sats: 20000, is_spent: false }
        ]);
        (LdkNodeInjection.payments.listPayments as jest.Mock).mockResolvedValue(
            [{ kind: { type: 'onchain', txid: 'aa', confirmationHeight: 100 } }]
        );
        (LdkNodeInjection.node.status as jest.Mock).mockResolvedValue({
            currentBestBlock_height: 105
        });

        const balance = await new LdkNode().getBlockchainBalance();
        expect(balance.confirmed_balance).toEqual('20000');
        expect(balance.reserved_balance_anchor_chan).toEqual('25000');
    });
});
