jest.mock('@getalby/sdk', () => ({ nwc: {} }));
jest.mock('nostr-tools', () => ({
    getPublicKey: jest.fn(),
    generatePrivateKey: jest.fn(),
    relayInit: jest.fn(),
    getEventHash: jest.fn(),
    getSignature: jest.fn(),
    validateEvent: jest.fn(),
    verifySignature: jest.fn()
}));
jest.mock('@nostr/tools/nip04', () => ({}));
jest.mock('@nostr/tools/nip44', () => ({}));
jest.mock('@noble/hashes/utils', () => ({ hexToBytes: jest.fn() }));
jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../storage', () => ({}));
jest.mock('../models/NWCConnection', () => ({
    __esModule: true,
    default: class NWCConnection {},
    BudgetRenewalType: {},
    ConnectionActivityType: {},
    ConnectionPaymentSourceType: {},
    ConnectionWarningType: {},
    TimeUnit: {}
}));
jest.mock('../models/Invoice', () => ({
    __esModule: true,
    default: class Invoice {}
}));
jest.mock('../models/CashuInvoice', () => ({
    __esModule: true,
    default: class CashuInvoice {}
}));
jest.mock('../models/Payment', () => ({
    __esModule: true,
    default: class Payment {}
}));
jest.mock('../models/CashuPayment', () => ({
    __esModule: true,
    default: class CashuPayment {}
}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { decodePaymentRequest: jest.fn() }
}));
jest.mock('../utils/AmountUtils', () => ({
    millisatsToSats: jest.fn((amount: number) => Math.floor(amount / 1000)),
    satsToMillisats: jest.fn((amount: number) => amount * 1000)
}));
jest.mock('../utils/UnitsUtils', () => ({
    numberWithCommas: jest.fn((value: string | number) => String(value))
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        decodeInvoiceTags: jest.fn(),
        getFullAccessPermissions: jest.fn(() => ['get_info', 'pay_invoice']),
        isIgnorableError: jest.fn(() => false)
    }
}));

import BackendUtils from '../utils/BackendUtils';
import NostrConnectUtils from '../utils/NostrConnectUtils';
import NostrWalletConnectStore from './NostrWalletConnectStore';

type StoreMethodName = 'getInvoiceAmount' | 'handleLightningPayInvoice';

const storePrototype = NostrWalletConnectStore.prototype as unknown as Record<
    StoreMethodName,
    (this: unknown, ...args: any[]) => unknown
>;

const callStoreMethod = async <T>(
    methodName: StoreMethodName,
    thisArg: unknown,
    ...args: any[]
): Promise<T> => {
    const method = storePrototype[methodName];

    if (typeof method !== 'function') {
        throw new Error(
            `Expected NostrWalletConnectStore.prototype.${methodName} to exist`
        );
    }

    return (await method.call(thisArg, ...args)) as T;
};

const mockedBackendUtils = BackendUtils as jest.Mocked<typeof BackendUtils>;
const mockedNostrConnectUtils = NostrConnectUtils as jest.Mocked<
    typeof NostrConnectUtils
>;

const createLightningPayStoreContext = () => {
    const context: Record<string, any> = {
        balanceStore: {
            getLightningBalance: jest
                .fn()
                .mockResolvedValue({ lightningBalance: 5000 })
        },
        transactionsStore: {
            reset: jest.fn(),
            sendPayment: jest.fn(),
            payment_preimage: 'test-preimage',
            payment_fee: 2,
            status: 'SUCCEEDED'
        },
        paymentsStore: {
            getPayments: jest.fn().mockResolvedValue(undefined),
            payments: [{ getPaymentRequest: 'lnbc1testinvoice' }]
        },
        validateBudgetBeforePayment: jest.fn(() => ({
            success: true
        })),
        waitForPaymentCompletion: jest.fn().mockResolvedValue(undefined),
        checkPaymentErrors: jest.fn().mockReturnValue(undefined),
        finalizePayment: jest.fn().mockResolvedValue(undefined),
        chargeBudgetOnSuccess: jest.fn(),
        recordMinimalSuccessActivity: jest.fn().mockResolvedValue(undefined),
        showPaymentSentNotification: jest.fn(),
        handleError: jest.fn((message: string, code: string) => ({
            result: undefined,
            error: { code, message }
        }))
    };

    context.getInvoiceAmount = (...args: any[]) =>
        callStoreMethod('getInvoiceAmount', context, ...args);

    return context;
};

describe('NostrWalletConnectStore sub-satoshi rounding', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedBackendUtils.decodePaymentRequest.mockResolvedValue({});
        mockedNostrConnectUtils.decodeInvoiceTags.mockResolvedValue({
            amount: 0
        } as never);
        mockedNostrConnectUtils.isIgnorableError.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getInvoiceAmount', () => {
        it('preserves positive sub-satoshi request amounts', async () => {
            const result = await callStoreMethod<{
                amountMsats: number;
                amountSats: number;
                usedRequestAmount: boolean;
                invalidRequestAmount: boolean;
            }>('getInvoiceAmount', {}, 'lnbc1testinvoice', {}, 1500);

            expect(result).toEqual({
                amountMsats: 1500,
                amountSats: 2,
                usedRequestAmount: true,
                invalidRequestAmount: false
            });
        });

        it('marks fractional millisatoshi request amounts as invalid', async () => {
            const result = await callStoreMethod<{
                amountMsats: number;
                amountSats: number;
                usedRequestAmount: boolean;
                invalidRequestAmount: boolean;
            }>('getInvoiceAmount', {}, 'lnbc1testinvoice', {}, 1.5);

            expect(result).toEqual({
                amountMsats: 0,
                amountSats: 0,
                usedRequestAmount: false,
                invalidRequestAmount: true
            });
        });

        it('preserves CLN-style msat strings from decoded invoices', async () => {
            mockedNostrConnectUtils.decodeInvoiceTags.mockResolvedValue({
                amount: 1
            } as never);

            const result = await callStoreMethod<{
                amountMsats: number;
                amountSats: number;
                usedRequestAmount: boolean;
                invalidRequestAmount: boolean;
            }>('getInvoiceAmount', {}, 'lnbc1testinvoice', {
                num_msat: '1500msat'
            });

            expect(result).toEqual({
                amountMsats: 1500,
                amountSats: 2,
                usedRequestAmount: false,
                invalidRequestAmount: false
            });
            expect(
                mockedNostrConnectUtils.decodeInvoiceTags
            ).not.toHaveBeenCalled();
        });
    });

    describe('handleLightningPayInvoice', () => {
        it('preserves explicit zero fee limits end-to-end', async () => {
            const context = createLightningPayStoreContext();
            const response = await callStoreMethod<{
                result: { preimage: string; fees_paid: number };
                error: undefined;
            }>('handleLightningPayInvoice', context, {} as never, {
                invoice: 'lnbc1testinvoice',
                amount: 1000,
                fee_limit_msat: 0,
                fee_limit_sat: 0
            });

            expect(context.transactionsStore.sendPayment).toHaveBeenCalledWith({
                payment_request: 'lnbc1testinvoice',
                fee_limit_sat: '0',
                fee_limit_msat: '0',
                timeout_seconds: '120',
                amount: '1',
                amount_msat: '1000'
            });
            expect(response).toEqual({
                result: {
                    preimage: 'test-preimage',
                    fees_paid: 2000
                },
                error: undefined
            });
        });

        it('rejects non-finite fee_limit_msat values', async () => {
            const context = createLightningPayStoreContext();

            const result = await callStoreMethod<{
                result: undefined;
                error: {
                    code: string;
                    message: string;
                };
            }>('handleLightningPayInvoice', context, {} as never, {
                invoice: 'lnbc1testinvoice',
                amount: 2000,
                fee_limit_msat: Number.POSITIVE_INFINITY,
                fee_limit_sat: 7
            });

            // Non-finite msat should fail validation
            expect(result.error).toBeDefined();
            expect(result.error.code).toBe('INVALID_PARAMS');

            // sendPayment should NOT be called
            expect(context.transactionsStore.sendPayment).not.toHaveBeenCalled();
        });

        it('charges a minimum of 1 sat for positive sub-satoshi request amounts', async () => {
            const testCases = [1, 100, 500, 999];

            for (const msat of testCases) {
                const context = createLightningPayStoreContext();
                const result = await callStoreMethod(
                    'handleLightningPayInvoice',
                    context,
                    {} as never,
                    {
                        invoice: 'lnbc1testinvoice',
                        amount: msat,
                        fee_limit_msat: 2000,
                        fee_limit_sat: 2
                    }
                );

                expect(result).toEqual({
                    result: {
                        preimage: 'test-preimage',
                        fees_paid: 2000
                    },
                    error: undefined
                });
                expect(
                    context.validateBudgetBeforePayment
                ).toHaveBeenCalledWith({}, 1, 'INSUFFICIENT_BALANCE');
                expect(
                    context.transactionsStore.sendPayment
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        amount: '1',
                        amount_msat: String(msat),
                        fee_limit_sat: '2',
                        fee_limit_msat: '2000'
                    })
                );
            }
        });

        it('accepts request amounts exactly at 1000 msat boundary', async () => {
            const result = await callStoreMethod<{
                amountMsats: number;
                amountSats: number;
                usedRequestAmount: boolean;
                invalidRequestAmount: boolean;
            }>('getInvoiceAmount', {}, 'lnbc1testinvoice', {}, 1000);

            expect(result).toEqual({
                amountMsats: 1000,
                amountSats: 1,
                usedRequestAmount: true,
                invalidRequestAmount: false
            });
        });

        it('rounds positive sub-satoshi request amounts up for payment processing', async () => {
            const context = createLightningPayStoreContext();

            const result = await callStoreMethod(
                'handleLightningPayInvoice',
                context,
                {} as never,
                {
                    invoice: 'lnbc1testinvoice',
                    amount: 1500,
                    fee_limit_msat: 2000,
                    fee_limit_sat: 2
                }
            );

            expect(result).toEqual({
                result: {
                    preimage: 'test-preimage',
                    fees_paid: 2000
                },
                error: undefined
            });
            // Budget must be charged ceil(msat/1000) so that fractional
            // sub-sat amounts can never bypass maxAmountSats. 1500 msat
            // → 2 sat budget charge.
            expect(context.validateBudgetBeforePayment).toHaveBeenCalledWith(
                {},
                2,
                'INSUFFICIENT_BALANCE'
            );
            expect(context.transactionsStore.sendPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    // sat-denominated amount mirrors paymentChargeAmountSats
                    // (ceil of msat/1000); amount_msat preserves exact value.
                    amount: '2',
                    amount_msat: '1500',
                    fee_limit_sat: '2',
                    fee_limit_msat: '2000'
                })
            );
        });

        it('accepts exact millisatoshi fee limits', async () => {
            const context = createLightningPayStoreContext();

            const result = await callStoreMethod(
                'handleLightningPayInvoice',
                context,
                {} as never,
                {
                    invoice: 'lnbc1testinvoice',
                    amount: 1000,
                    fee_limit_msat: 1500,
                    fee_limit_sat: 2
                }
            );

            expect(result).toEqual({
                result: {
                    preimage: 'test-preimage',
                    fees_paid: 2000
                },
                error: undefined
            });
            expect(context.transactionsStore.sendPayment).toHaveBeenCalledWith(
                expect.objectContaining({
                    amount: '1',
                    amount_msat: '1000',
                    fee_limit_sat: '1',
                    fee_limit_msat: '1500'
                })
            );
            expect(context.validateBudgetBeforePayment).toHaveBeenCalledWith(
                {},
                1,
                'INSUFFICIENT_BALANCE'
            );
        });
    });
});
