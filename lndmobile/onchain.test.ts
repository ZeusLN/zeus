jest.mock('./utils', () => ({
    sendCommand: jest.fn()
}));

import { sendCommand } from './utils';
import { sendCoins } from './onchain';

describe('onchain', () => {
    describe('sendCoins', () => {
        const sentOptions = () =>
            (sendCommand as jest.Mock).mock.lastCall[0].options;

        beforeEach(() => (sendCommand as jest.Mock).mockClear());

        // EmbeddedLND.sendCoins passes the string built on VerifyOnChain
        it('sends a whole number of sats given as a string', async () => {
            await sendCoins('bc1qtest', '100000');
            expect(sentOptions().amount.toString()).toBe('100000');
        });

        it('sends a whole number of sats given as a number', async () => {
            await sendCoins('bc1qtest', 100000);
            expect(sentOptions().amount.toString()).toBe('100000');
        });

        // Long.fromValue('100000.001') produced 10000001
        it.each(['100000.001', '1000000.5', '0', '-1', 'abc', ''])(
            'refuses an amount of %p',
            async (amount) => {
                await expect(sendCoins('bc1qtest', amount)).rejects.toThrow(
                    'Amount must be a whole number of satoshis'
                );
                expect(sendCommand).not.toHaveBeenCalled();
            }
        );

        it.each([
            ['2', '2'],
            ['1.5', '1'],
            ['1.00000001', '1']
        ])('sends a fee rate of %p as %p', async (feeRate, expected) => {
            await sendCoins('bc1qtest', '100000', feeRate);
            expect(sentOptions().sat_per_vbyte.toString()).toBe(expected);
        });

        it('needs no amount to send everything', async () => {
            await sendCoins('bc1qtest', '', 2, true, true);
            expect(sentOptions().amount).toBeUndefined();
            expect(sentOptions().send_all).toBe(true);
        });
    });
});
