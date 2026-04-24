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
jest.mock('../stores/Stores', () => ({
    settingsStore: {},
    nodeInfoStore: {},
    channelsStore: {},
    balanceStore: {},
    modalStore: {}
}));
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
    default: {
        decodePaymentRequest: jest.fn(),
        lookupInvoice: jest.fn()
    }
}));
jest.mock('../utils/AmountUtils', () => ({
    millisatsToSats: jest.fn((amount: number) => Math.floor(amount / 1000)),
    satsToMillisats: jest.fn((amount: number) => amount * 1000)
}));
jest.mock('../utils/LocaleUtils', () => ({
    localeString: jest.fn((key: string) => key)
}));
jest.mock('../utils/NostrConnectUtils', () => ({
    __esModule: true,
    default: {
        decodeInvoiceTags: jest.fn(),
        convertConnectionActivityToNip47Transaction: jest.fn(
            (activity: any) => activity
        ),
        createNip47Transaction: jest.fn((params: any) => params),
        filterAndPaginateTransactions: jest.fn((transactions: any) => ({
            transactions,
            totalCount: transactions.length
        })),
        getFullAccessPermissions: jest.fn(() => ['get_info', 'pay_invoice']),
        isIgnorableError: jest.fn(() => false)
    }
}));

import NostrConnectUtils from '../utils/NostrConnectUtils';
import BackendUtils from '../utils/BackendUtils';
import NostrWalletConnectStore from './NostrWalletConnectStore';

type StoreMethodName =
    | 'getInvoiceAmount'
    | 'handleMakeInvoice'
    | 'handleListTransactions'
    | 'handleLookupInvoice';

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

const mockedNostrConnectUtils = NostrConnectUtils as jest.Mocked<
    typeof NostrConnectUtils
>;

describe('NostrWalletConnectStore msat plumbing', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('forwards exact millisatoshis when creating lightning invoices', async () => {
        mockedNostrConnectUtils.decodeInvoiceTags.mockResolvedValue({
            paymentHash: 'decoded-payment-hash',
            descriptionHash: 'decoded-description-hash',
            expiryTime: 1700000000
        } as never);

        const connection: any = {
            name: 'Test wallet',
            addActivity: jest.fn()
        };

        const context: any = {
            isCashuConfigured: false,
            invoicesStore: {
                creatingInvoiceError: false,
                error_msg: null,
                createUnifiedInvoice: jest.fn().mockResolvedValue({
                    rHash: 'payment-hash'
                }),
                payment_request: 'lnbc1exactinvoice',
                getInvoices: jest.fn().mockResolvedValue(undefined),
                invoices: [
                    {
                        payment_hash: 'payment-hash',
                        paymentRequest: 'lnbc1exactinvoice'
                    }
                ]
            },
            showInvoiceCreatedNotification: jest.fn(),
            saveConnections: jest.fn().mockResolvedValue(undefined),
            findAndUpdateConnection: jest.fn(),
            handleError: jest.fn((message: string, code: string) => ({
                result: undefined,
                error: { code, message }
            })),
            handleErrorResponse: jest.fn((message: string, code: string) => ({
                result: undefined,
                error: { code, message }
            }))
        };

        const response = await callStoreMethod<{
            result: { amount: number };
            error: undefined;
        }>('handleMakeInvoice', context, connection, {
            amount: 1500,
            description: 'exact msat invoice',
            expiry: 3600
        });

        expect(context.invoicesStore.createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '2',
                value_msat: '1500',
                memo: 'exact msat invoice',
                noLsp: true
            })
        );
        expect(connection.addActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                satAmount: 2,
                msatAmount: 1500
            })
        );
        expect(response.result.amount).toBe(1500);
    });

    it('allows amountless lightning make_invoice requests', async () => {
        mockedNostrConnectUtils.decodeInvoiceTags.mockResolvedValue({
            paymentHash: 'decoded-payment-hash',
            descriptionHash: 'decoded-description-hash',
            expiryTime: 1700000000
        } as never);

        const connection: any = {
            name: 'Test wallet',
            addActivity: jest.fn()
        };

        const context: any = {
            isCashuConfigured: false,
            invoicesStore: {
                creatingInvoiceError: false,
                error_msg: null,
                createUnifiedInvoice: jest.fn().mockResolvedValue({
                    rHash: 'payment-hash'
                }),
                payment_request: 'lnbc1variableinvoice',
                getInvoices: jest.fn().mockResolvedValue(undefined),
                invoices: [
                    {
                        payment_hash: 'payment-hash',
                        paymentRequest: 'lnbc1variableinvoice'
                    }
                ]
            },
            showInvoiceCreatedNotification: jest.fn(),
            saveConnections: jest.fn().mockResolvedValue(undefined),
            findAndUpdateConnection: jest.fn(),
            handleError: jest.fn((message: string, code: string) => ({
                result: undefined,
                error: { code, message }
            }))
        };

        const response = await callStoreMethod<{
            result: { amount: number };
            error: undefined;
        }>('handleMakeInvoice', context, connection, {
            description: 'amountless invoice'
        });

        expect(context.invoicesStore.createUnifiedInvoice).toHaveBeenCalledWith(
            expect.objectContaining({
                value: '0',
                value_msat: '0',
                memo: 'amountless invoice',
                noLsp: true
            })
        );
        expect(connection.addActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                satAmount: 0,
                msatAmount: 0
            })
        );
        expect(response.result.amount).toBe(0);
    });

    it('rounds exact-msat invoice amounts up for display and budgeting', async () => {
        const context: any = {};

        const response = await callStoreMethod<{
            amountMsats: number;
            amountSats: number;
            usedRequestAmount: boolean;
            invalidRequestAmount: boolean;
        }>('getInvoiceAmount', context, 'lnbc1exact', {
            num_satoshis: 1,
            num_msat: 1500
        });

        expect(response.amountMsats).toBe(1500);
        expect(response.amountSats).toBe(2);
        expect(response.usedRequestAmount).toBe(false);
        expect(response.invalidRequestAmount).toBe(false);
    });

    it('falls back to invoice-only lookup on lightning backends', async () => {
        mockedNostrConnectUtils.decodeInvoiceTags.mockResolvedValue({
            paymentHash: 'decoded-payment-hash',
            descriptionHash: 'decoded-description-hash',
            expiryTime: 1700000000
        } as never);

        const lookupInvoiceSpy = jest
            .spyOn(BackendUtils, 'lookupInvoice')
            .mockResolvedValue({
                r_hash: 'decoded-payment-hash',
                payment_request: 'lnbc1invoice',
                settled: false
            } as never);

        const context: any = {
            isCashuConfigured: false,
            handleError: jest.fn((message: string, code: string) => ({
                result: undefined,
                error: { code, message }
            }))
        };

        await callStoreMethod<any>('handleLookupInvoice', context, {
            invoice: 'lnbc1invoice'
        });

        expect(lookupInvoiceSpy).toHaveBeenCalledWith({
            r_hash: 'decoded-payment-hash'
        });
    });

    it('keeps zero-amount invoices in list_transactions when payment permissions are enabled', async () => {
        const context: any = {
            paymentsStore: { getPayments: jest.fn() },
            invoicesStore: { getInvoices: jest.fn() },
            transactionsStore: { getTransactions: jest.fn() },
            cashuStore: {},
            isCashuConfigured: false,
            handleError: jest.fn((message: string, code: string) => ({
                result: undefined,
                error: { code, message }
            }))
        };
        const connection: any = {
            hasPaymentPermissions: jest.fn(() => true),
            activity: [
                {
                    amount: 0,
                    paymentHash: 'a'.repeat(64),
                    created_at: 1700000000
                }
            ]
        };

        mockedNostrConnectUtils.convertConnectionActivityToNip47Transaction.mockImplementation(
            (activity: any) => ({
                ...activity,
                payment_hash: activity.paymentHash
            })
        );

        const response = await callStoreMethod<any>(
            'handleListTransactions',
            context,
            connection,
            { limit: 10 }
        );

        expect(response.result.transactions).toHaveLength(1);
        expect(response.result.transactions[0].amount).toBe(0);
    });
});
