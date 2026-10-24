jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: jest.fn(),
    decodeStreamResult: jest.fn()
}));

import { sendCommand } from './utils';
import { getTransactions, sendCoins } from './onchain';

const options = () => (sendCommand as jest.Mock).mock.calls[0][0].options;

describe('onchain', () => {
    beforeEach(() => {
        (sendCommand as jest.Mock).mockReset();
    });

    describe('sendCoins', () => {
        it('passes the label to SendCoins', async () => {
            await sendCoins(
                'bcrt1qrecipient',
                100000,
                2,
                undefined,
                undefined,
                undefined,
                'ZEUS send 0123456789abcdef'
            );
            expect(options()).toMatchObject({
                addr: 'bcrt1qrecipient',
                label: 'ZEUS send 0123456789abcdef'
            });
        });

        it('sends no label when none is given', async () => {
            await sendCoins('bcrt1qrecipient', 100000, 2);
            expect(options().label).toBeUndefined();
        });
    });

    describe('getTransactions', () => {
        it('passes the start height to GetTransactions', async () => {
            await getTransactions({ start_height: 799994 });
            expect(options()).toEqual({
                max_transactions: 500,
                start_height: 799994
            });
        });

        it('reads from the first block when no start height is given', async () => {
            await getTransactions();
            expect(options().start_height).toBeUndefined();
        });
    });
});
