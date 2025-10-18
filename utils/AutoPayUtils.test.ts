import AutoPayUtils from './AutoPayUtils';

jest.mock('./BackendUtils', () => ({
    decodePaymentRequest: jest.fn()
}));

import BackendUtils from './BackendUtils';

const mockNavigation = {
    navigate: jest.fn()
} as any;

const mockSettingsStore = {
    settings: {
        payments: {
            autoPayEnabled: true,
            autoPayThreshold: 1000
        }
    }
} as any;

const mockTransactionsStore = {
    sendPayment: jest.fn()
} as any;

describe('getAmountFromDecodedInvoice', () => {
    it('extracts amount from num_satoshis field', () => {
        const invoice = { num_satoshis: '500' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(500);
    });

    it('extracts amount from num_msat field and converts to sats', () => {
        const invoice = { num_msat: '5000' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(5);
    });

    it('extracts amount from numSatoshis field', () => {
        const invoice = { numSatoshis: '750' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(750);
    });

    it('extracts amount from numMsat field and converts to sats', () => {
        const invoice = { numMsat: '10000' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(10);
    });

    it('extracts amount from amount_msat field and converts to sats', () => {
        const invoice = { amount_msat: '15000' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(15);
    });

    it('extracts amount from amount field', () => {
        const invoice = { amount: '200' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(200);
    });

    it('extracts amount from value field', () => {
        const invoice = { value: '300' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(300);
    });

    it('extracts amount from valueSat field', () => {
        const invoice = { valueSat: '400' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(400);
    });

    it('extracts amount from valueMsat field and converts to sats', () => {
        const invoice = { valueMsat: '20000' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(20);
    });

    it('returns 0 when no amount fields are present', () => {
        const invoice = { description: 'test invoice' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(0);
    });

    it('prioritizes num_satoshis over other fields', () => {
        const invoice = {
            num_satoshis: '500',
            amount: '1000',
            value: '1500'
        };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(500);
    });

    it('handles invalid number formats gracefully', () => {
        const invoice = { num_satoshis: 'invalid_number' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBeNaN();
    });

    it('handles null and undefined inputs', () => {
        expect(AutoPayUtils.getAmountFromDecodedInvoice(null)).toBe(0);
        expect(AutoPayUtils.getAmountFromDecodedInvoice(undefined)).toBe(0);
    });

    it('handles floating point precision in msat conversions', () => {
        const invoice = { num_msat: '999' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice)).toBe(0);

        const invoice2 = { num_msat: '1001' };
        expect(AutoPayUtils.getAmountFromDecodedInvoice(invoice2)).toBe(1);
    });

    it('handles extremely large numbers', () => {
        const invoice = { num_satoshis: '999999999999999999' };
        const result = AutoPayUtils.getAmountFromDecodedInvoice(invoice);
        expect(typeof result).toBe('number');
        expect(result).toBe(999999999999999999);
    });
});

describe('shouldTryAutoPay', () => {
    it('returns true for valid Lightning invoice (lnbc)', () => {
        expect(AutoPayUtils.shouldTryAutoPay('lnbc1234567890')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('LNBC1234567890')).toBe(true);
    });

    it('returns true for valid testnet invoice (lntb)', () => {
        expect(AutoPayUtils.shouldTryAutoPay('lntb1234567890')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('LNTB1234567890')).toBe(true);
    });

    it('returns true for valid regtest invoice (lnbcrt)', () => {
        expect(AutoPayUtils.shouldTryAutoPay('lnbcrt1234567890')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('LNBCRT1234567890')).toBe(true);
    });

    it('returns false for non-Lightning invoice strings', () => {
        expect(AutoPayUtils.shouldTryAutoPay('bitcoin:1234567890')).toBe(false);
        expect(
            AutoPayUtils.shouldTryAutoPay(
                'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
            )
        ).toBe(false);
        expect(AutoPayUtils.shouldTryAutoPay('test@example.com')).toBe(false);
        expect(AutoPayUtils.shouldTryAutoPay('')).toBe(false);
    });

    it('handles whitespace correctly', () => {
        expect(AutoPayUtils.shouldTryAutoPay('  lnbc1234567890  ')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('\tlntb1234567890\n')).toBe(true);
    });

    it('handles edge cases and invalid inputs', () => {
        expect(AutoPayUtils.shouldTryAutoPay(null as any)).toBe(false);
        expect(AutoPayUtils.shouldTryAutoPay(undefined as any)).toBe(false);
        expect(AutoPayUtils.shouldTryAutoPay('lnbc')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('ln')).toBe(false);
    });

    it('is case insensitive by design', () => {
        expect(AutoPayUtils.shouldTryAutoPay('lnBC1234567890')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('LNbc1234567890')).toBe(true);
        expect(AutoPayUtils.shouldTryAutoPay('LnBcRt1234567890')).toBe(true);
    });
});

describe('checkAutoPayAndProcess', () => {
    const validInvoice = 'lnbc500n1234567890';

    beforeEach(() => {
        jest.clearAllMocks();
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            num_satoshis: '500',
            description: 'Test payment'
        });
    });

    it('processes auto-pay when amount is within threshold and auto-pay is enabled', async () => {
        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(true);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith({
            payment_request: validInvoice
        });
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            {
                enableDonations: false
            }
        );
    });

    it('does not process auto-pay when amount exceeds threshold', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            num_satoshis: '2000',
            description: 'Large payment'
        });

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process auto-pay when auto-pay is disabled', async () => {
        const disabledSettingsStore = {
            settings: {
                payments: {
                    autoPayEnabled: false,
                    autoPayThreshold: 1000
                }
            }
        } as any;

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            disabledSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('does not process auto-pay when amount is zero', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            description: 'Zero amount payment'
        });

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('returns false when invoice decoding fails', async () => {
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
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it('handles errors gracefully and returns false', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockRejectedValue(
            new Error('Decoding failed')
        );

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
            'Error checking auto-pay:',
            expect.any(Error)
        );
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalled();
        expect(mockNavigation.navigate).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('uses default threshold when not configured', async () => {
        const noThresholdSettings = {
            settings: {
                payments: {
                    autoPayEnabled: true
                }
            }
        } as any;

        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            num_satoshis: '1',
            description: 'Small payment'
        });

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            noThresholdSettings,
            mockTransactionsStore
        );

        expect(result).toBe(false);
    });

    it('processes payment when amount equals threshold', async () => {
        (BackendUtils.decodePaymentRequest as jest.Mock).mockResolvedValue({
            num_satoshis: '1000',
            description: 'Threshold payment'
        });

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(true);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith({
            payment_request: validInvoice
        });
    });

    it('validates exact navigation parameters', async () => {
        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(result).toBe(true);
        expect(mockNavigation.navigate).toHaveBeenCalledWith(
            'SendingLightning',
            {
                enableDonations: false
            }
        );
        expect(mockNavigation.navigate).not.toHaveBeenCalledWith(
            'SendingLightning',
            {
                enableDonations: true
            }
        );
    });

    it('validates that null store throws error during access', async () => {
        const invalidSettingsStore = null;

        const result = await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            invalidSettingsStore as any,
            mockTransactionsStore
        );

        expect(result).toBe(false);
    });

    it('validates sendPayment is called with exact parameters', async () => {
        await AutoPayUtils.checkAutoPayAndProcess(
            validInvoice,
            mockNavigation,
            mockSettingsStore,
            mockTransactionsStore
        );

        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledTimes(1);
        expect(mockTransactionsStore.sendPayment).toHaveBeenCalledWith({
            payment_request: validInvoice
        });
        expect(mockTransactionsStore.sendPayment).not.toHaveBeenCalledWith({
            invoice: validInvoice
        });
    });
});
