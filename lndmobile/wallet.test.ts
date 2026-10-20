jest.mock('./utils', () => ({
    sendCommand: jest.fn()
}));

import { sendCommand } from './utils';
import { bumpFee, bumpForceCloseFee, fundPsbt } from './wallet';

describe('wallet', () => {
    const sentOptions = () =>
        (sendCommand as jest.Mock).mock.lastCall[0].options;

    beforeEach(() => (sendCommand as jest.Mock).mockClear());

    // the BumpFee view passes the fee rate and budget as typed
    it.each([
        ['2', '50000', '2', '50000'],
        ['1.00000001', '1000000.5', '1', '1000000']
    ])(
        'sends a fee rate of %p and a budget of %p as %p and %p',
        async (feeRate, budget, expectedFeeRate, expectedBudget) => {
            await bumpFee({
                outpoint: {} as any,
                sat_per_vbyte: feeRate as any,
                budget: budget as any
            });
            expect(sentOptions().sat_per_vbyte.toString()).toBe(
                expectedFeeRate
            );
            expect(sentOptions().budget.toString()).toBe(expectedBudget);

            await bumpForceCloseFee({
                chan_point: {} as any,
                starting_feerate: feeRate as any,
                budget: budget as any
            });
            expect(sentOptions().starting_feerate.toString()).toBe(
                expectedFeeRate
            );
            expect(sentOptions().budget.toString()).toBe(expectedBudget);
        }
    );

    // Number() makes these NaN or below 1, which Long.fromNumber sent as
    // 0, so LND chose its own value instead of the one typed
    describe.each(['0.5', 'abc', '1,5', '-2', 'Infinity'])(
        'given %p',
        (value) => {
            it('refuses it as a fee rate', async () => {
                await expect(
                    bumpFee({
                        outpoint: {} as any,
                        sat_per_vbyte: value as any
                    })
                ).rejects.toThrow('Fee rate must be at least 1 sat/vB');
                await expect(
                    bumpForceCloseFee({
                        chan_point: {} as any,
                        starting_feerate: value as any
                    })
                ).rejects.toThrow('Fee rate must be at least 1 sat/vB');
                expect(sendCommand).not.toHaveBeenCalled();
            });

            it('refuses it as a budget', async () => {
                await expect(
                    bumpFee({
                        outpoint: {} as any,
                        sat_per_vbyte: '2' as any,
                        budget: value as any
                    })
                ).rejects.toThrow('Budget must be at least 1 sat');
                await expect(
                    bumpForceCloseFee({
                        chan_point: {} as any,
                        starting_feerate: '2' as any,
                        budget: value as any
                    })
                ).rejects.toThrow('Budget must be at least 1 sat');
                expect(sendCommand).not.toHaveBeenCalled();
            });
        }
    );

    it('leaves the fee rate and budget to LND when not given', async () => {
        await bumpFee({ outpoint: {} as any, target_conf: 6 });
        expect(sentOptions().sat_per_vbyte).toBeUndefined();
        expect(sentOptions().budget).toBeUndefined();

        await bumpForceCloseFee({ chan_point: {} as any, immediate: true });
        expect(sentOptions().starting_feerate).toBeUndefined();
        expect(sentOptions().budget).toBeUndefined();
    });

    describe('fundPsbt', () => {
        // sendCoinsLNDCoinControl passes Number(fee rate)
        it.each([
            [2, '2'],
            [1.5, '1'],
            ['1.00000001', '1']
        ])('sends a fee rate of %p as %p', async (feeRate, expected) => {
            await fundPsbt({ sat_per_vbyte: feeRate as any });
            expect(sentOptions().sat_per_vbyte.toString()).toBe(expected);
        });

        // Long.fromValue sent 0.5 as 0, so LND chose its own fee
        it.each([0.5, -2, Infinity])(
            'refuses a fee rate of %p',
            async (feeRate) => {
                await expect(
                    fundPsbt({ sat_per_vbyte: feeRate as any })
                ).rejects.toThrow('Fee rate must be at least 1 sat/vB');
                expect(sendCommand).not.toHaveBeenCalled();
            }
        );

        it.each([undefined, NaN])(
            'leaves a fee rate of %p to LND',
            async (feeRate) => {
                await fundPsbt({ sat_per_vbyte: feeRate as any });
                expect(sentOptions().sat_per_vbyte).toBeUndefined();
            }
        );
    });
});
