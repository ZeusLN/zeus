jest.mock('react-native', () => ({
    NativeModules: {
        LncModule: {
            buildRefundTransaction: jest.fn(),
            buildReverseClaimTransaction: jest.fn()
        }
    }
}));

import { NativeModules } from 'react-native';
import { buildRefundTransaction, buildReverseClaimTransaction } from './swaps';

const LncModule = NativeModules.LncModule as jest.Mocked<any>;

const refundArgs = {
    endpoint: 'https://api.boltz.exchange',
    swapId: 'swap-id',
    claimLeaf: 'claim-leaf',
    refundLeaf: 'refund-leaf',
    transactionHex: 'lockup-hex',
    privateKey: 'private-key',
    servicePubKey: 'service-pubkey',
    feeRate: 3,
    timeoutBlockHeight: 900000,
    destinationAddress: 'bc1qdestination',
    lockupAddress: 'bc1plockup',
    network: 'bitcoin'
};

describe('buildRefundTransaction', () => {
    beforeEach(() => {
        LncModule.buildRefundTransaction.mockReset();
        LncModule.buildRefundTransaction.mockResolvedValue('refund-hex');
    });

    it('passes the miner fee between the fee rate and the timeout height', async () => {
        await expect(
            buildRefundTransaction({
                ...refundArgs,
                minerFee: 450,
                cooperative: true
            })
        ).resolves.toBe('refund-hex');

        expect(LncModule.buildRefundTransaction).toHaveBeenCalledWith(
            'https://api.boltz.exchange',
            'swap-id',
            'claim-leaf',
            'refund-leaf',
            'lockup-hex',
            'private-key',
            'service-pubkey',
            3,
            450,
            900000,
            'bc1qdestination',
            'bc1plockup',
            true,
            'bitcoin'
        );
    });

    it('passes a miner fee of 0 so the fee rate applies when none is given', async () => {
        await buildRefundTransaction(refundArgs);

        const args = LncModule.buildRefundTransaction.mock.calls[0];
        expect(args).toHaveLength(14);
        expect(args[7]).toBe(3);
        expect(args[8]).toBe(0);
        expect(args[9]).toBe(900000);
        expect(args[12]).toBe(false);
    });

    it('rejects with the native error', async () => {
        LncModule.buildRefundTransaction.mockRejectedValue(
            new Error('output of 120 sats is below the dust limit')
        );

        await expect(
            buildRefundTransaction({ ...refundArgs, minerFee: 9000 })
        ).rejects.toThrow('below the dust limit');
    });
});

describe('buildReverseClaimTransaction', () => {
    it('passes the miner fee after the fee rate', async () => {
        LncModule.buildReverseClaimTransaction.mockResolvedValue('claim-hex');

        await expect(
            buildReverseClaimTransaction({
                endpoint: 'https://api.boltz.exchange',
                swapId: 'swap-id',
                claimLeaf: 'claim-leaf',
                refundLeaf: 'refund-leaf',
                privateKey: 'private-key',
                servicePubKey: 'service-pubkey',
                preimageHex: 'preimage',
                transactionHex: 'lockup-hex',
                lockupAddress: 'bc1plockup',
                destinationAddress: 'bc1qdestination',
                feeRate: 2,
                minerFee: 300,
                network: 'testnet'
            })
        ).resolves.toBe('claim-hex');

        expect(LncModule.buildReverseClaimTransaction).toHaveBeenCalledWith(
            'https://api.boltz.exchange',
            'swap-id',
            'claim-leaf',
            'refund-leaf',
            'private-key',
            'service-pubkey',
            'preimage',
            'lockup-hex',
            'bc1plockup',
            'bc1qdestination',
            2,
            300,
            'testnet'
        );
    });
});
