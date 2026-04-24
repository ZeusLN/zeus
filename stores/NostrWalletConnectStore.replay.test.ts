const mockSetItem = jest.fn();
const mockGetItem = jest.fn();

jest.mock('@getalby/sdk', () => ({
    nwc: {
        NWCWalletServiceKeyPair: jest.fn()
    }
}));
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
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: mockGetItem,
        setItem: mockSetItem
    }
}));
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

import NostrWalletConnectStore from './NostrWalletConnectStore';
import Storage from '../storage';

type StoreMethodName =
    | 'savePendingPayments'
    | 'getPendingPayments'
    | 'subscribeToConnection';

const callStoreMethod = async <T>(
    methodName: StoreMethodName,
    thisArg: unknown,
    ...args: any[]
): Promise<T> => {
    const method = (thisArg as Record<
        StoreMethodName,
        (this: unknown, ...args: any[]) => unknown
    >)[methodName];

    if (typeof method !== 'function') {
        throw new Error(
            `Expected NostrWalletConnectStore.prototype.${methodName} to exist`
        );
    }

    return (await method.call(thisArg, ...args)) as T;
};

const createStore = () =>
    new NostrWalletConnectStore(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
    ) as any;

describe('NostrWalletConnectStore replay guards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.assign(Storage as any, {
            getItem: mockGetItem,
            setItem: mockSetItem
        });
        jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any) => {
            fn();
            return 0 as any;
        }) as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('dedupes pending payments before persisting them', async () => {
        mockGetItem.mockResolvedValueOnce(
            JSON.stringify([
                {
                    eventId: 'event-1',
                    connection: { id: 'conn-1' }
                }
            ])
        );

        const context = createStore();

        await callStoreMethod<void>('savePendingPayments', context, [
            {
                eventId: 'event-1',
                connection: { id: 'conn-1' }
            },
            {
                eventId: 'event-1',
                connection: { id: 'conn-1', name: 'updated' }
            },
            {
                eventId: 'event-2',
                connection: { id: 'conn-2' }
            }
        ]);

        expect(mockSetItem).toHaveBeenCalledWith(
            'zeus-nwc-pending-payments',
            JSON.stringify([
                {
                    eventId: 'event-1',
                    connection: { id: 'conn-1', name: 'updated' }
                },
                {
                    eventId: 'event-2',
                    connection: { id: 'conn-2' }
                }
            ])
        );
    });

    it('drops already processed replay events when restoring pending payments', async () => {
        mockGetItem.mockResolvedValueOnce(
            JSON.stringify([
                {
                    eventId: 'event-1',
                    connection: { id: 'conn-1' }
                },
                {
                    eventId: 'event-1',
                    connection: { id: 'conn-1' }
                },
                {
                    eventId: 'event-processed',
                    connection: { id: 'conn-2' }
                },
                {
                    eventId: 'event-missing',
                    connection: { id: 'conn-missing' }
                }
            ])
        );

        const context = createStore();
        context.getConnection = jest.fn((connectionId: string) =>
                connectionId === 'conn-1'
                    ? { id: 'conn-1', name: 'wallet' }
                    : undefined
            );
        context.hasProcessedReplayEvent = jest.fn(async (eventId: string) =>
                eventId === 'event-processed'
            );
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);

        const pendingPayments = await callStoreMethod<any[]>(
            'getPendingPayments',
            context
        );

        expect(context.hasProcessedReplayEvent).toHaveBeenCalledWith('event-1');
        expect(context.hasProcessedReplayEvent).toHaveBeenCalledWith(
            'event-processed'
        );
        expect(context.deletePendingPaymentById).toHaveBeenCalledWith(
            'event-processed'
        );
        expect(context.deletePendingPaymentById).toHaveBeenCalledWith(
            'event-missing'
        );
        expect(pendingPayments).toEqual([
            {
                eventId: 'event-1',
                connection: { id: 'conn-1', name: 'wallet' }
            }
        ]);
    });

    it('skips duplicate subscriptions unless replacing the existing one', async () => {
        const subscribe = jest.fn().mockResolvedValue(jest.fn());
        const context = createStore();
        context.isServiceReady = jest.fn(() => true);
        context.walletServiceKeys = { privateKey: 'service-secret' };
        context.activeSubscriptions = new Map([['conn-1', jest.fn()]]);
        context.nwcWalletServices = new Map([
            ['wss://relay.example', { subscribe }]
        ]);
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) => fn());
        context.unsubscribeFromConnection = jest.fn().mockResolvedValue(undefined);
        const connection: any = {
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example',
            pubkey: 'client-pubkey',
            hasPermission: jest.fn(() => false)
        };

        const alreadySubscribed = await callStoreMethod<boolean>(
            'subscribeToConnection',
            context,
            connection
        );
        expect(alreadySubscribed).toBe(true);
        expect(subscribe).not.toHaveBeenCalled();
        expect(context.unsubscribeFromConnection).not.toHaveBeenCalled();

        const resubscribed = await callStoreMethod<boolean>(
            'subscribeToConnection',
            context,
            connection,
            { unsubscribeExisting: false }
        );
        expect(resubscribed).toBe(true);
        expect(subscribe).toHaveBeenCalledTimes(1);
    });
});
