jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            sendCommand: jest.fn(),
            sendStreamCommand: jest.fn()
        }
    }
}));

import { NativeModules } from 'react-native';
import { getTransactions } from './onchain';
import { lnrpc } from '../proto/lightning';

const LndMobile = NativeModules.LndMobile as unknown as {
    sendCommand: jest.Mock;
};

// decodes the GetTransactionsRequest handed to the native bridge
const sentRequest = () =>
    lnrpc.GetTransactionsRequest.decode(
        Uint8Array.from(
            Buffer.from(LndMobile.sendCommand.mock.calls[0][1], 'base64')
        )
    );

beforeEach(() => {
    jest.clearAllMocks();
    LndMobile.sendCommand.mockResolvedValue({ data: '' });
});

describe('getTransactions', () => {
    it('sends the start height, end height and cap', async () => {
        await getTransactions({
            start_height: -1,
            end_height: 1,
            max_transactions: 20
        });

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('GetTransactions');
        const request = sentRequest();
        expect(request.start_height).toBe(-1);
        expect(request.end_height).toBe(1);
        expect(request.max_transactions).toBe(20);
    });

    it('keeps a cap of 0, which lnd reads as no cap', async () => {
        await getTransactions({
            start_height: -1,
            end_height: -1,
            max_transactions: 0
        });

        const request = sentRequest();
        expect(request.end_height).toBe(-1);
        expect(request.max_transactions).toBe(0);
    });

    it('caps at 500 when no cap is given', async () => {
        await getTransactions();

        const request = sentRequest();
        expect(request.start_height).toBe(0);
        expect(request.end_height).toBe(0);
        expect(request.max_transactions).toBe(500);
    });
});
