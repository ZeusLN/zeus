let mockRouterSendPaymentHandler: ((event: any) => void) | undefined;

const mockSendStreamCommand = jest.fn(async (..._args: any[]) => {
    mockRouterSendPaymentHandler?.({ data: 'encoded-payment' });
    return 'stream-started';
});
const mockDecodeStreamResult = jest.fn((..._args: any[]) => ({
    payment_hash: 'hash'
}));
const mockListenerRemove = jest.fn();

jest.mock('react-native', () => ({
    NativeModules: {
        LndMobile: {},
        LndMobileTools: {}
    }
}));
jest.mock('./utils', () => ({
    sendCommand: jest.fn(),
    sendStreamCommand: (...args: any[]) => mockSendStreamCommand(...args),
    sendBidiStreamCommand: jest.fn(),
    decodeStreamResult: (...args: any[]) => mockDecodeStreamResult(...args)
}));
jest.mock('../utils/LndMobileUtils', () => ({
    checkLndStreamErrorResponse: jest.fn(() => null),
    LndMobileEventEmitter: {
        addListener: jest.fn(
            (_eventName: string, handler: (event: any) => void) => {
                mockRouterSendPaymentHandler = handler;
                return { remove: mockListenerRemove };
            }
        )
    }
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../proto/lightning', () => ({
    lnrpc: {
        FeatureBit: {
            TLV_ONION_REQ: 1
        },
        Payment: {}
    },
    routerrpc: {
        SendPaymentRequest: {}
    },
    invoicesrpc: {}
}));

import { sendKeysendPaymentV2, sendPaymentV2Sync } from './index';

describe('sendKeysendPaymentV2', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRouterSendPaymentHandler = undefined;
    });

    it('prefers amt_msat over truncated sat amount for keysend', async () => {
        await sendKeysendPaymentV2({
            dest: '11'.repeat(33),
            amt: 1,
            amt_msat: 1500,
            fee_limit_sat: 10
        });

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'RouterSendPaymentV2',
                options: expect.objectContaining({
                    amt_msat: 1500
                })
            }),
            false
        );
        const options = mockSendStreamCommand.mock.calls[0][0].options;
        expect(options).not.toHaveProperty('amt');
        expect(options).not.toHaveProperty('fee_limit_sat');
    });

    it('forwards fee_limit_msat when provided for keysend', async () => {
        await sendKeysendPaymentV2({
            dest: '11'.repeat(33),
            amt: 2,
            fee_limit_msat: 2500
        });

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    fee_limit_msat: 2500
                })
            }),
            false
        );
        const options = mockSendStreamCommand.mock.calls[0][0].options;
        expect(options).not.toHaveProperty('fee_limit_sat');
    });

    it('keeps whole-sat keysend behavior when amt_msat is absent', async () => {
        await sendKeysendPaymentV2({
            dest: '11'.repeat(33),
            amt: 2,
            fee_limit_sat: 10
        });

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    amt: 2
                })
            }),
            false
        );
        const options = mockSendStreamCommand.mock.calls[0][0].options;
        expect(options).not.toHaveProperty('amt_msat');
        expect(options).not.toHaveProperty('fee_limit_sat');
    });
});

describe('sendPaymentV2Sync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRouterSendPaymentHandler = undefined;
    });

    it('forwards fee_limit_sat when fee_limit_msat is absent', async () => {
        await sendPaymentV2Sync({
            payment_request: 'lnbc1test',
            fee_limit_sat: 10,
            timeout_seconds: 60
        });

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'RouterSendPaymentV2',
                options: expect.objectContaining({
                    fee_limit_sat: 10
                })
            }),
            false
        );

        const options = mockSendStreamCommand.mock.calls[0][0].options;
        expect(options).not.toHaveProperty('fee_limit_msat');
    });

    it('prefers fee_limit_msat over fee_limit_sat when both are provided', async () => {
        await sendPaymentV2Sync({
            payment_request: 'lnbc1test',
            fee_limit_sat: 10,
            fee_limit_msat: 2500,
            timeout_seconds: 60
        });

        expect(mockSendStreamCommand).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'RouterSendPaymentV2',
                options: expect.objectContaining({
                    fee_limit_msat: 2500
                })
            }),
            false
        );

        const options = mockSendStreamCommand.mock.calls[0][0].options;
        expect(options).not.toHaveProperty('fee_limit_sat');
    });
});
