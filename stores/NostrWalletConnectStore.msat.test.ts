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
    default: { decodePaymentRequest: jest.fn() }
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
        createNip47Transaction: jest.fn((params: any) => params),
        getFullAccessPermissions: jest.fn(() => ['get_info', 'pay_invoice']),
        isIgnorableError: jest.fn(() => false)
    }
}));

import NostrConnectUtils from '../utils/NostrConnectUtils';
import NostrWalletConnectStore from './NostrWalletConnectStore';

type StoreMethodName = 'handleMakeInvoice';

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
                value: '1',
                value_msat: '1500',
                memo: 'exact msat invoice',
                noLsp: true
            })
        );
        expect(connection.addActivity).toHaveBeenCalledWith(
            expect.objectContaining({
                satAmount: 1,
                msatAmount: 1500
            })
        );
        expect(response.result.amount).toBe(1500);
    });
});
