jest.mock('./utils', () => ({
    sendCommand: jest.fn()
}));

import { sendCommand } from './utils';
import { bumpFee, bumpForceCloseFee } from './wallet';

describe('wallet', () => {
    const sentOptions = () =>
        (sendCommand as jest.Mock).mock.lastCall[0].options;

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
});
