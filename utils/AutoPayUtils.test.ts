import AutoPayUtils from './AutoPayUtils';

jest.mock('./BackendUtils', () => ({
    decodePaymentRequest: jest.fn(),
    isLNDBased: jest.fn(() => true)
}));

jest.mock('./FeeUtils', () => ({
    calculateDefaultRoutingFee: jest.fn(() => 100)
}));

jest.mock('./AddressUtils', () => ({
    isValidLightningPaymentRequest: jest.fn()
}));

jest.mock('../models/Invoice', () => {
    return jest.fn().mockImplementation((data) => ({
        getRequestAmount: data?.mockAmount || 0
    }));
});

jest.mock('../stores/Stores', () => ({}));
jest.mock('./LocaleUtils', () => ({
    localeString: jest.fn((key) => key)
}));

import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';
const MockedInvoice = require('../models/Invoice');

const mockNavigation = {
    navigate: jest.fn()
} as any;

const mockSettingsStore = {
    settings: {
        payments: {
            autoPayEnabled: true,
            autoPayThreshold: 1000,
            enableDonations: false,
            timeoutSeconds: '60',
            defaultFeePercentage: '5.0'
        }
    },
    implementation: 'lnd',
    getSettings: jest.fn().mockResolvedValue({
        payments: {
            timeoutSeconds: '60',
            defaultFeePercentage: '5.0'
        }
    })
} as any;

const mockTransactionsStore = {
    sendPayment: jest.fn()
} as any;

describe('shouldTryAutoPay', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates to AddressUtils.isValidLightningPaymentRequest', () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);

        const result = AutoPayUtils.shouldTryAutoPay('lnbc1234567890');

        expect(
            AddressUtils.isValidLightningPaymentRequest
        ).toHaveBeenCalledWith('lnbc1234567890');
        expect(result).toBe(true);
    });

    it('returns false when AddressUtils returns false', () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(false);

        const result = AutoPayUtils.shouldTryAutoPay('invalid');

        expect(
            AddressUtils.isValidLightningPaymentRequest
        ).toHaveBeenCalledWith('invalid');
        expect(result).toBe(false);
    });
});

describe('checkAutoPayAndProcess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockedInvoice.mockClear();
    });

    it('processes auto-pay when amount is within threshold and auto-pay is enabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(true);
        expect(MockedInvoice).toHaveBeenCalledWith(mockDecodedInvoice);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith({
            payment_request: 'lnbc1234567890',
            max_parts: '16',
            max_shard_amt: '',
            fee_limit_sat: '100',
            max_fee_percent: '5.0',
            outgoing_chan_id: '',
            last_hop_pubkey: '',
            amp: false,
            timeout_seconds: '60'
        });
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            { enableDonations: false }
        );
    });

    it('does not process auto-pay when amount exceeds threshold', async () => {
        const mockDecodedInvoice = { mockAmount: 1500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process auto-pay when auto-pay is disabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const disabledSettingsStore = {
            settings: {
                payments: {
                    autoPayEnabled: false,
                    autoPayThreshold: 1000
                }
            }
        } as any;

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            disabledSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('does not process auto-pay when amount is zero', async () => {
        const mockDecodedInvoice = { mockAmount: 0 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('returns false when invoice decoding fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            null
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'invalid_invoice',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Auto-pay error:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('handles errors gracefully and returns false', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('Decoding failed')
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Auto-pay error:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('uses default threshold when not configured', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const settingsWithoutThreshold = {
            settings: {
                payments: {
                    autoPayEnabled: true
                }
            }
        } as any;

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            settingsWithoutThreshold,
            mockTransactionsStore
        );

        expect(result).toBe(false);
    });

    it('processes payment when amount equals threshold', async () => {
        const mockDecodedInvoice = { mockAmount: 1000 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(true);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalled();
    });

    it('validates exact navigation parameters', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            { enableDonations: false }
        );
    });

    it('validates sendPayment is called with exact parameters', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        await AutoPayUtils.checkAutoPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith({
            payment_request: 'lnbc1234567890',
            max_parts: '16',
            max_shard_amt: '',
            fee_limit_sat: '100',
            max_fee_percent: '5.0',
            outgoing_chan_id: '',
            last_hop_pubkey: '',
            amp: false,
            timeout_seconds: '60'
        });
    });
});
