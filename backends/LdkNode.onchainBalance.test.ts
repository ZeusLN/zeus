const mockListBalances = jest.fn();
const mockStatus = jest.fn();
const mockListUtxos = jest.fn();
const mockListPayments = jest.fn();

jest.mock('../ldknode/LdkNodeInjection', () => ({
    __esModule: true,
    default: {
        node: {
            listBalances: (...args: any[]) => mockListBalances(...args),
            status: (...args: any[]) => mockStatus(...args)
        },
        onchain: {
            listUtxos: (...args: any[]) => mockListUtxos(...args)
        },
        payments: {
            listPayments: (...args: any[]) => mockListPayments(...args)
        }
    }
}));

jest.mock('../stores/Stores');

jest.mock('../utils/LocaleUtils');

import LdkNode from './LdkNode';

describe('LdkNode.getBlockchainBalance', () => {
    const onchainPayment = (txid: string, confirmationHeight?: number) => ({
        id: txid,
        kind: { type: 'onchain', txid, confirmationHeight }
    });
    const utxo = (txid: string, value_sats: number) => ({
        txid,
        vout: 0,
        value_sats,
        address: 'bcrt1q',
        is_spent: false
    });
    const mockBalances = (balances: {
        totalOnchainBalanceSats: number;
        spendableOnchainBalanceSats: number;
        totalAnchorChannelsReserveSats: number;
    }) =>
        mockListBalances.mockResolvedValue({
            totalLightningBalanceSats: 0,
            lightningBalances: [],
            pendingBalancesFromChannelClosures: [],
            ...balances
        });

    beforeEach(() => {
        jest.clearAllMocks();
        mockStatus.mockResolvedValue({ currentBestBlock_height: 108 });
    });

    it('does not count an unconfirmed deposit to a change address as confirmed', async () => {
        // LDK treats an unconfirmed output on a change address as trusted,
        // so it is already part of the spendable balance
        mockBalances({
            totalOnchainBalanceSats: 9_899_857,
            spendableOnchainBalanceSats: 9_899_857,
            totalAnchorChannelsReserveSats: 0
        });
        mockListUtxos.mockResolvedValue([
            utxo('change', 8_999_857),
            utxo('deposit', 900_000)
        ]);
        mockListPayments.mockResolvedValue([
            onchainPayment('change', 102),
            onchainPayment('deposit')
        ]);

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '9899857',
            confirmed_balance: '8999857',
            unconfirmed_balance: '900000'
        });
    });

    it('counts the anchor channel reserve as confirmed', async () => {
        mockBalances({
            totalOnchainBalanceSats: 100_000,
            spendableOnchainBalanceSats: 75_000,
            totalAnchorChannelsReserveSats: 25_000
        });
        mockListUtxos.mockResolvedValue([utxo('deposit', 100_000)]);
        mockListPayments.mockResolvedValue([onchainPayment('deposit', 100)]);

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '100000',
            confirmed_balance: '100000',
            unconfirmed_balance: '0'
        });
    });

    it('recovers the confirmed balance when spendable is 0', async () => {
        mockBalances({
            totalOnchainBalanceSats: 20_000,
            spendableOnchainBalanceSats: 0,
            totalAnchorChannelsReserveSats: 25_000
        });
        mockListUtxos.mockResolvedValue([
            utxo('change', 15_000),
            utxo('deposit', 5_000)
        ]);
        mockListPayments.mockResolvedValue([
            onchainPayment('change', 100),
            onchainPayment('deposit')
        ]);

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '20000',
            confirmed_balance: '15000',
            unconfirmed_balance: '5000'
        });
    });

    it('never reports more confirmed than the total', async () => {
        mockBalances({
            totalOnchainBalanceSats: 10_000,
            spendableOnchainBalanceSats: 10_000,
            totalAnchorChannelsReserveSats: 0
        });
        mockListUtxos.mockResolvedValue([utxo('a', 12_000)]);
        mockListPayments.mockResolvedValue([onchainPayment('a', 100)]);

        const balance = await new LdkNode().getBlockchainBalance();
        expect(balance.confirmed_balance).toEqual('10000');
        expect(balance.unconfirmed_balance).toEqual('0');
    });

    it('skips the UTXO lookup for an empty wallet', async () => {
        mockBalances({
            totalOnchainBalanceSats: 0,
            spendableOnchainBalanceSats: 0,
            totalAnchorChannelsReserveSats: 0
        });

        expect(await new LdkNode().getBlockchainBalance()).toEqual({
            total_balance: '0',
            confirmed_balance: '0',
            unconfirmed_balance: '0'
        });
        expect(mockListUtxos).not.toHaveBeenCalled();
    });
});
