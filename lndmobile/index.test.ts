jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {
            sendCommand: jest.fn()
        },
        LndMobileTools: {}
    }
}));

jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(),
    LndMobileEventEmitter: { addListener: jest.fn() }
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

import { NativeModules } from 'react-native';
import { listPayments } from './index';
import { lnrpc } from '../proto/lightning';

const LndMobile = NativeModules.LndMobile as unknown as {
    sendCommand: jest.Mock;
};

// Decodes the base64 ListPaymentsRequest handed to the native bridge.
const sentRequest = (): lnrpc.ListPaymentsRequest =>
    lnrpc.ListPaymentsRequest.decode(
        Uint8Array.from(
            Buffer.from(LndMobile.sendCommand.mock.calls[0][1], 'base64')
        )
    );

beforeEach(() => {
    jest.clearAllMocks();
    LndMobile.sendCommand.mockResolvedValue({ data: '' });
});

describe('listPayments', () => {
    it('requests the newest 1000 payments by default', async () => {
        await listPayments();

        expect(LndMobile.sendCommand.mock.calls[0][0]).toBe('ListPayments');
        const req = sentRequest();
        expect(req.reversed).toBe(true);
        expect(req.include_incomplete).toBe(true);
        expect(req.max_payments.toString()).toBe('1000');
    });

    it('requests the newest page when only maxPayments is given', async () => {
        await listPayments({ maxPayments: 50 });

        const req = sentRequest();
        expect(req.reversed).toBe(true);
        expect(req.max_payments.toString()).toBe('50');
    });

    it('requests the newest page when reversed is true', async () => {
        await listPayments({ maxPayments: 5, reversed: true });

        expect(sentRequest().reversed).toBe(true);
    });

    it('pages forward from the oldest payment when reversed is false', async () => {
        await listPayments({ reversed: false });

        expect(sentRequest().reversed).toBe(false);
    });
});
