import QuickPayUtils from './QuickPayUtils';
import BackendUtils from './BackendUtils';
import AddressUtils from './AddressUtils';

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

const MockedInvoice = require('../models/Invoice');

const mockNavigation = {
    navigate: jest.fn()
} as any;

const mockSettingsStore = {
    settings: {
        payments: {
            quickPayEnabled: true,
            quickPayThreshold: 1000,
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

describe('shouldTryQuickPay', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates to AddressUtils.isValidLightningPaymentRequest', () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);

        const result = QuickPayUtils.shouldTryQuickPay('lnbc1234567890');

        expect(
            AddressUtils.isValidLightningPaymentRequest
        ).toHaveBeenCalledWith('lnbc1234567890');
        expect(result).toBe(true);
    });

    it('returns false when AddressUtils returns false', () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(false);

        const result = QuickPayUtils.shouldTryQuickPay('invalid');

        expect(
            AddressUtils.isValidLightningPaymentRequest
        ).toHaveBeenCalledWith('invalid');
        expect(result).toBe(false);
    });
});

describe('checkQuickPayAndProcess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockedInvoice.mockClear();
    });

    it('processes quick-pay when amount is within threshold and quick-pay is enabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await QuickPayUtils.checkQuickPayAndProcess(
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

    it('does not process quick-pay when amount exceeds threshold', async () => {
        const mockDecodedInvoice = { mockAmount: 1500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await QuickPayUtils.checkQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process quick-pay when quick-pay is disabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const disabledSettingsStore = {
            settings: {
                payments: {
                    quickPayEnabled: false,
                    quickPayThreshold: 1000
                }
            }
        } as any;

        const result = await QuickPayUtils.checkQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            disabledSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('does not process quick-pay when amount is zero', async () => {
        const mockDecodedInvoice = { mockAmount: 0 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await QuickPayUtils.checkQuickPayAndProcess(
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

        const result = await QuickPayUtils.checkQuickPayAndProcess(
            'invalid_invoice',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Quick-pay error:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('handles errors gracefully and returns false', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('Decoding failed')
        );

        const result = await QuickPayUtils.checkQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Quick-pay error:',
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
                    quickPayEnabled: true
                }
            }
        } as any;

        const result = await QuickPayUtils.checkQuickPayAndProcess(
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

        const result = await QuickPayUtils.checkQuickPayAndProcess(
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

        await QuickPayUtils.checkQuickPayAndProcess(
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

        await QuickPayUtils.checkQuickPayAndProcess(
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

describe('checkCashuQuickPayAndProcess', () => {
    const mockCashuStore = {
        payReq: null,
        payLnInvoiceFromEcash: jest.fn()
    } as any;

    beforeEach(() => {
        jest.clearAllMocks();
        MockedInvoice.mockClear();
        mockCashuStore.payReq = { amount: 500 }; // Default to having a pay request
        mockCashuStore.payLnInvoiceFromEcash.mockResolvedValue(undefined);
    });

    it('processes Cashu quick-pay when amount is within threshold and quick-pay is enabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(true);
        expect(MockedInvoice).toHaveBeenCalledWith(mockDecodedInvoice);
        expect(mockCashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({});
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            { enableDonations: false }
        );
    });

    it('does not process Cashu quick-pay when amount exceeds threshold', async () => {
        const mockDecodedInvoice = { mockAmount: 1500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(false);
        expect(mockCashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process Cashu quick-pay when quick-pay is disabled', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const disabledSettingsStore = {
            ...mockSettingsStore,
            settings: {
                ...mockSettingsStore.settings,
                payments: {
                    ...mockSettingsStore.settings.payments,
                    quickPayEnabled: false
                }
            }
        };

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            disabledSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(false);
        expect(mockCashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process Cashu quick-pay when no payReq is available', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        // Remove payReq to simulate no payment request available
        mockCashuStore.payReq = null;

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(false);
        expect(mockCashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('handles errors gracefully and returns false', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('Decode failed')
        );

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(false);
        expect(mockCashuStore.payLnInvoiceFromEcash).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Cashu quick-pay error:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('handles payment errors gracefully and returns false', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );
        mockCashuStore.payLnInvoiceFromEcash.mockRejectedValue(
            new Error('Payment failed')
        );

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            mockSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(false);
        expect(mockCashuStore.payLnInvoiceFromEcash).toHaveBeenCalledWith({});
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Cashu quick-pay error:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('enables donations when configured in settings', async () => {
        const mockDecodedInvoice = { mockAmount: 500 };
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue(
            mockDecodedInvoice
        );

        const donationsEnabledSettingsStore = {
            ...mockSettingsStore,
            settings: {
                ...mockSettingsStore.settings,
                payments: {
                    ...mockSettingsStore.settings.payments,
                    enableDonations: true
                }
            }
        };

        const result = await QuickPayUtils.checkCashuQuickPayAndProcess(
            'lnbc1234567890',
            mockNavigation,
            donationsEnabledSettingsStore,
            mockCashuStore
        );

        expect(result).toBe(true);
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'CashuSendingLightning',
            { enableDonations: true }
        );
    });
});

describe('checkQuickPayAndReturnRoute', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        MockedInvoice.mockClear();
    });

    it('returns PaymentRequest route when not a lightning invoice', async () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(false);

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'not-a-lightning-invoice',
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toEqual(['PaymentRequest', {}]);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('returns SendingLightning route when quick-pay succeeds', async () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            mockAmount: 500
        });

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'lnbc1234567890',
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toEqual([
            'SendingLightning',
            {
                enableDonations: false
            }
        ]);
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

    it('returns PaymentRequest route when amount exceeds threshold', async () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            mockAmount: 15000
        });

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'lnbc1234567890',
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toEqual(['PaymentRequest', {}]);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('returns PaymentRequest route when quick-pay is disabled', async () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            mockAmount: 500
        });

        const disabledSettingsStore = {
            ...mockSettingsStore,
            settings: {
                ...mockSettingsStore.settings,
                payments: {
                    ...mockSettingsStore.settings.payments,
                    quickPayEnabled: false
                }
            }
        };

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'lnbc1234567890',
            disabledSettingsStore,
            mockTransactionsStore
        );

        expect(result).toEqual(['PaymentRequest', {}]);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
    });

    it('returns PaymentRequest route and logs error on failure', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('Decode failed')
        );

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'lnbc1234567890',
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toEqual(['PaymentRequest', {}]);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            'Quick-pay check failed:',
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });

    it('uses pay_req parameter when provided', async () => {
        (
            AddressUtils.isValidLightningPaymentRequest as jest.Mock
        ).mockReturnValue(true);
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            mockAmount: 500,
            features: {
                '30': { is_required: true }
            }
        });

        const mockPayReq = {
            features: {
                '30': { is_required: true }
            }
        };

        const result = await QuickPayUtils.checkQuickPayAndReturnRoute(
            'lnbc1234567890',
            mockSettingsStore,
            mockTransactionsStore,
            mockPayReq
        );

        expect(result).toEqual([
            'SendingLightning',
            {
                enableDonations: false
            }
        ]);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                amp: true
            })
        );
    });
});
