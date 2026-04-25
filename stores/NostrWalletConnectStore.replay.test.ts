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
        getFullAccessPermissions: jest.fn(() => [
            'get_info',
            'pay_invoice',
            'make_invoice'
        ]),
        isIgnorableError: jest.fn(() => false)
    }
}));

import NostrWalletConnectStore from './NostrWalletConnectStore';
import Storage from '../storage';

type StoreMethodName =
    | 'savePendingPayments'
    | 'getPendingPayments'
    | 'replayCachedResponse'
    | 'subscribeToConnection'
    | 'saveProcessedReplayEvents'
    | 'handleEventRequest'
    | 'processPendingPaymentsEvents'
    | 'validatingPendingPaymentEvents';

const callStoreMethod = async <T>(
    methodName: StoreMethodName,
    thisArg: unknown,
    ...args: any[]
): Promise<T> => {
    const method = (
        thisArg as Record<
            StoreMethodName,
            (this: unknown, ...args: any[]) => unknown
        >
    )[methodName];

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

    it('does not overwrite locally processed marker failures on restore', async () => {
        const markerFailure = {
            eventId: 'event-1',
            connection: { id: 'conn-1' },
            status: false,
            isProcessed: true,
            errorMessage: 'Failed to persist replay marker'
        };
        mockGetItem.mockResolvedValueOnce(JSON.stringify([markerFailure]));

        const context = createStore();

        await callStoreMethod<void>('savePendingPayments', context, [
            {
                eventId: 'event-1',
                connection: { id: 'conn-1' },
                status: false,
                isProcessed: false
            }
        ]);

        expect(mockSetItem).toHaveBeenCalledWith(
            'zeus-nwc-pending-payments',
            JSON.stringify([markerFailure])
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
        context.hasProcessedReplayEvent = jest.fn(
            async (eventId: string) => eventId === 'event-processed'
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

    it('logs processed replay storage failures without throwing', async () => {
        const context = createStore();
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockSetItem.mockRejectedValueOnce(new Error('disk full'));

        await expect(
            callStoreMethod<boolean>(
                'saveProcessedReplayEvents',
                context,
                new Set(['event-1'])
            )
        ).resolves.toBe(false);

        expect(mockSetItem).toHaveBeenCalledWith(
            'zeus-nwc-processed-replay-events',
            JSON.stringify(['event-1'])
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'failed to save processed replay events',
            expect.any(Error)
        );
    });

    it('replays cached responses for the original event after publish failures', async () => {
        const context = createStore();
        const response = { result: { preimage: 'preimage' } };
        context.replayResponsesCache = new Map([
            [
                'event-1',
                {
                    method: 'pay_invoice',
                    response,
                    encryptionScheme: 'nip04',
                    cachedAt: Date.now()
                }
            ]
        ]);
        context.publishEventToClient = jest.fn().mockResolvedValue(undefined);
        context.removeReplayResponse = jest.fn().mockResolvedValue(undefined);

        const replayResult = await callStoreMethod<any>(
            'replayCachedResponse',
            context,
            { id: 'conn-1', relayUrl: 'wss://relay.example' },
            'event-1',
            1
        );

        expect(context.publishEventToClient).toHaveBeenCalledWith(
            { id: 'conn-1', relayUrl: 'wss://relay.example' },
            'pay_invoice',
            response,
            'event-1',
            'nip04'
        );
        expect(context.removeReplayResponse).toHaveBeenCalledWith('event-1');
        expect(replayResult).toEqual({
            success: true,
            errorMessage: undefined,
            committed: true,
            published: true
        });
    });

    it('does not mark restored events processed when validation fails transiently', async () => {
        const context = createStore();
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.validateAndParsePendingEvent = jest
            .fn()
            .mockRejectedValue(new Error('temporary decrypt failure'));
        context.markProcessedReplayEvent = jest.fn(async () => true);
        const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await callStoreMethod<void>('validatingPendingPaymentEvents', context, [
            '{"id":"event-1"}'
        ]);

        expect(context.validateAndParsePendingEvent).toHaveBeenCalledWith(
            '{"id":"event-1"}'
        );
        expect(context.markProcessedReplayEvent).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'NWC: PROCESS PENDING EVENTS ERROR (transient, will retry)',
            expect.objectContaining({
                eventStr: '{"id":"event-1"}'
            })
        );
    });

    it('does not mark terminal restored errors processed when publish fails', async () => {
        const context = createStore();
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.validateAndParsePendingEvent = jest.fn().mockResolvedValue({
            request: { method: 'pay_invoice', params: {} },
            connection: {
                id: 'conn-1',
                name: 'wallet',
                hasPermission: jest.fn(() => false)
            },
            eventId: 'event-1',
            encryptionScheme: 'nip04'
        });
        context.publishEventToClient = jest
            .fn()
            .mockRejectedValue(new Error('relay down'));
        context.markProcessedReplayEvent = jest.fn(async () => true);
        const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await callStoreMethod<void>('validatingPendingPaymentEvents', context, [
            '{"id":"event-1"}'
        ]);

        expect(context.publishEventToClient).toHaveBeenCalledTimes(1);
        expect(context.markProcessedReplayEvent).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'NWC: PROCESS PENDING EVENTS ERROR (transient, will retry)',
            expect.objectContaining({
                eventStr: '{"id":"event-1"}'
            })
        );
    });

    it('rejects insecure ws relays before connecting', async () => {
        const context = createStore();
        const result = await (context as any).pingRelay('ws://relay.example');

        expect(result).toEqual({
            status: false,
            error: 'stores.NostrWalletConnectStore.error.invalidRelayUrl'
        });
    });

    it('records committed restored full-access requests when marker persistence fails', async () => {
        const context = createStore();
        const connection = {
            id: 'conn-1',
            name: 'wallet',
            hasPermission: jest.fn(() => true)
        };
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.validateAndParsePendingEvent = jest.fn().mockResolvedValue({
            request: { method: 'make_invoice', params: {} },
            connection,
            eventId: 'event-1',
            encryptionScheme: 'nip04'
        });
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.hasCommittedRestoreMarkerFailure = jest.fn(async () => false);
        context.getReplayResponse = jest.fn(async () => undefined);
        context.handleEventRequest = jest.fn(async () => ({
            success: true,
            committed: true,
            published: true
        }));
        context.markProcessedReplayEvent = jest.fn(async () => false);
        context.markCommittedRestoreMarkerFailure = jest.fn(async () => true);
        context.removeReplayResponse = jest.fn().mockResolvedValue(undefined);
        const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await callStoreMethod<void>('validatingPendingPaymentEvents', context, [
            '{"id":"event-1"}'
        ]);

        expect(context.handleEventRequest).toHaveBeenCalledWith(
            connection,
            { method: 'make_invoice', params: {} },
            'event-1',
            true,
            'nip04',
            true
        );
        expect(context.markCommittedRestoreMarkerFailure).toHaveBeenCalledWith(
            'event-1'
        );
        expect(context.removeReplayResponse).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'NWC: PROCESS PENDING EVENTS ERROR (transient, will retry)',
            expect.objectContaining({
                eventStr: '{"id":"event-1"}'
            })
        );
    });

    it('publishes committed responses when replay cache persistence fails', async () => {
        const context = createStore();
        const connection = {
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example',
            pubkey: 'client-pubkey',
            hasPermission: jest.fn(() => true)
        };
        const response = { result: { alias: 'wallet' }, error: undefined };
        context.handleGetInfo = jest.fn(async () => response);
        context.cacheReplayResponse = jest.fn(async () => {
            throw new Error('storage failed');
        });
        context.publishEventToClient = jest.fn().mockResolvedValue(undefined);
        context.removeReplayResponse = jest.fn().mockResolvedValue(undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await callStoreMethod<any>(
            'handleEventRequest',
            context,
            connection,
            { method: 'get_info', params: {} },
            'event-1',
            true,
            'nip04'
        );

        expect(result).toEqual({
            success: true,
            errorMessage: undefined,
            committed: true,
            published: true
        });
        expect(context.publishEventToClient).toHaveBeenCalledWith(
            connection,
            'get_info',
            response,
            'event-1',
            'nip04'
        );
        expect(context.removeReplayResponse).not.toHaveBeenCalled();
    });

    it('keeps responses uncommitted when cache and publish both fail', async () => {
        const context = createStore();
        const connection = {
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example',
            pubkey: 'client-pubkey',
            hasPermission: jest.fn(() => true)
        };
        context.handleGetInfo = jest.fn(async () => ({
            result: { alias: 'wallet' },
            error: undefined
        }));
        context.cacheReplayResponse = jest.fn(async () => {
            throw new Error('storage failed');
        });
        context.publishEventToClient = jest
            .fn()
            .mockRejectedValue(new Error('relay failed'));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);

        const result = await callStoreMethod<any>(
            'handleEventRequest',
            context,
            connection,
            { method: 'get_info', params: {} },
            'event-1',
            true,
            'nip04'
        );

        expect(result).toEqual({
            success: false,
            errorMessage: 'Failed to persist replay marker',
            committed: false,
            published: false
        });
    });

    it('replays cached restored full-access responses before re-executing handlers', async () => {
        const context = createStore();
        const response = { result: { invoice: 'lnbc1...' } };
        const connection = {
            id: 'conn-1',
            name: 'wallet',
            hasPermission: jest.fn(() => true)
        };
        context.replayResponsesCache = new Map([
            [
                'event-1',
                {
                    method: 'make_invoice',
                    response,
                    encryptionScheme: 'nip04',
                    cachedAt: Date.now()
                }
            ]
        ]);
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.validateAndParsePendingEvent = jest.fn().mockResolvedValue({
            request: { method: 'make_invoice', params: {} },
            connection,
            eventId: 'event-1',
            encryptionScheme: 'nip04'
        });
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.hasCommittedRestoreMarkerFailure = jest.fn(async () => true);
        context.handleEventRequest = jest.fn();
        context.publishEventToClient = jest.fn().mockResolvedValue(undefined);
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.removeCommittedRestoreMarkerFailure = jest.fn(async () => true);
        context.removeReplayResponse = jest.fn().mockResolvedValue(undefined);

        await callStoreMethod<void>('validatingPendingPaymentEvents', context, [
            '{"id":"event-1"}'
        ]);

        expect(context.handleEventRequest).not.toHaveBeenCalled();
        expect(context.publishEventToClient).toHaveBeenCalledWith(
            connection,
            'make_invoice',
            response,
            'event-1',
            'nip04'
        );
        expect(context.markProcessedReplayEvent).toHaveBeenCalledWith(
            'event-1'
        );
        expect(
            context.removeCommittedRestoreMarkerFailure
        ).toHaveBeenCalledWith('event-1');
        expect(context.removeReplayResponse).toHaveBeenCalledWith('event-1');
    });

    it('keeps uncommitted pending events retryable when response publication fails', async () => {
        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.handleEventRequest = jest.fn(async () => ({
            success: false,
            errorMessage: 'publish failed',
            committed: false
        }));
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04'
            }
        ] as any);

        expect(context.handleEventRequest).toHaveBeenCalledTimes(1);
        expect(context.updatePendingPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: 'event-1',
                status: false,
                isProcessed: false
            })
        );
        expect(context.markProcessedReplayEvent).not.toHaveBeenCalled();
        expect(context.deletePendingPaymentById).not.toHaveBeenCalled();
    });

    it('blocks payment retry when replay marker persistence fails', async () => {
        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.handleEventRequest = jest.fn(async () => ({
            success: true,
            committed: true
        }));
        context.markProcessedReplayEvent = jest.fn(async () => false);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04'
            }
        ] as any);

        expect(context.markProcessedReplayEvent).toHaveBeenCalledWith(
            'event-1'
        );
        expect(context.updatePendingPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: 'event-1',
                status: false,
                isProcessed: true,
                errorMessage: 'Failed to persist replay marker'
            })
        );
        expect(context.deletePendingPaymentById).not.toHaveBeenCalled();
    });

    it('retries only the replay marker for locally processed marker failures', async () => {
        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.handleEventRequest = jest.fn();
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.deleteAllPendingPayments = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04',
                status: false,
                isProcessed: true,
                errorMessage: 'Failed to persist replay marker'
            }
        ] as any);

        expect(context.handleEventRequest).not.toHaveBeenCalled();
        expect(context.markProcessedReplayEvent).toHaveBeenCalledWith(
            'event-1'
        );
        expect(context.deletePendingPaymentById).toHaveBeenCalledWith(
            'event-1'
        );
    });

    it('uses stored marker failure state when modal retries stale events', async () => {
        mockGetItem.mockResolvedValueOnce(
            JSON.stringify([
                {
                    eventId: 'event-1',
                    amount: 10,
                    connection: { id: 'conn-1', name: 'wallet' },
                    connectionName: 'wallet',
                    request: { method: 'pay_invoice', params: {} },
                    encryptionScheme: 'nip04',
                    status: false,
                    isProcessed: true,
                    errorMessage: 'Failed to persist replay marker'
                }
            ])
        );

        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.handleEventRequest = jest.fn();
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.deleteAllPendingPayments = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04',
                status: false,
                isProcessed: false
            }
        ] as any);

        expect(context.handleEventRequest).not.toHaveBeenCalled();
        expect(context.markProcessedReplayEvent).toHaveBeenCalledWith(
            'event-1'
        );
        expect(context.deletePendingPaymentById).toHaveBeenCalledWith(
            'event-1'
        );
    });

    it('replays cached marker-failure responses before clearing pending items', async () => {
        const context = createStore();
        const response = { result: { preimage: 'preimage' } };
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.replayResponsesCache = new Map([
            [
                'event-1',
                {
                    method: 'pay_invoice',
                    response,
                    encryptionScheme: 'nip04',
                    cachedAt: Date.now()
                }
            ]
        ]);
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example'
        }));
        context.handleEventRequest = jest.fn();
        context.publishEventToClient = jest.fn().mockResolvedValue(undefined);
        context.removeReplayResponse = jest.fn().mockResolvedValue(undefined);
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.deleteAllPendingPayments = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04',
                status: false,
                isProcessed: true,
                errorMessage: 'Failed to persist replay marker'
            }
        ] as any);

        expect(context.handleEventRequest).not.toHaveBeenCalled();
        expect(context.publishEventToClient).toHaveBeenCalledWith(
            {
                id: 'conn-1',
                name: 'wallet',
                relayUrl: 'wss://relay.example'
            },
            'pay_invoice',
            response,
            'event-1',
            'nip04'
        );
        expect(
            context.publishEventToClient.mock.invocationCallOrder[0]
        ).toBeLessThan(
            context.markProcessedReplayEvent.mock.invocationCallOrder[0]
        );
        expect(context.deletePendingPaymentById).toHaveBeenCalledWith(
            'event-1'
        );
    });

    it('marks terminal error responses as processed so they do not replay', async () => {
        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.handleEventRequest = jest.fn(async () => ({
            success: false,
            errorMessage: JSON.stringify({ message: 'invalid amount' }),
            committed: true
        }));
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04'
            }
        ] as any);

        expect(context.markProcessedReplayEvent).toHaveBeenCalledWith(
            'event-1'
        );
        expect(context.updatePendingPayment).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: 'event-1',
                status: false,
                isProcessed: true,
                errorMessage: 'invalid amount'
            })
        );
    });

    it('dedupes repeated pending events in the same restore batch', async () => {
        const context = createStore();
        context.isInNWCPendingPaymentsView = true;
        context.modalStore = {
            toggleNWCPendingPaymentsModal: jest.fn()
        } as any;
        context.getConnection = jest.fn(() => ({
            id: 'conn-1',
            name: 'wallet'
        }));
        context.hasProcessedReplayEvent = jest.fn(async () => false);
        context.handleEventRequest = jest.fn(async () => ({
            success: true,
            committed: true
        }));
        context.markProcessedReplayEvent = jest.fn(async () => true);
        context.updatePendingPayment = jest.fn().mockResolvedValue(undefined);
        context.deletePendingPaymentById = jest.fn().mockResolvedValue(true);
        context.resetPendingPayInvoiceState = jest.fn();
        context.showNotification = jest.fn();

        await callStoreMethod<void>('processPendingPaymentsEvents', context, [
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04'
            },
            {
                eventId: 'event-1',
                amount: 10,
                connection: { id: 'conn-1', name: 'wallet' },
                connectionName: 'wallet',
                request: { method: 'pay_invoice', params: {} },
                encryptionScheme: 'nip04'
            }
        ] as any);

        expect(context.handleEventRequest).toHaveBeenCalledTimes(1);
        expect(context.markProcessedReplayEvent).toHaveBeenCalledTimes(1);
        expect(context.deletePendingPaymentById).toHaveBeenCalledTimes(1);
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
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.unsubscribeFromConnection = jest
            .fn()
            .mockResolvedValue(undefined);
        const connection: any = {
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example',
            pubkey: 'client-pubkey',
            hasPermission: jest.fn(() => false)
        };

        // Default call: an existing subscription is registered, so the
        // store treats this as idempotent and skips re-subscribing.
        const alreadySubscribed = await callStoreMethod<boolean>(
            'subscribeToConnection',
            context,
            connection
        );
        expect(alreadySubscribed).toBe(true);
        expect(subscribe).not.toHaveBeenCalled();
        expect(context.unsubscribeFromConnection).not.toHaveBeenCalled();

        // forceResubscribe (used by the Android reconnect path) tears
        // down the prior handle and creates a fresh subscription.
        const resubscribed = await callStoreMethod<boolean>(
            'subscribeToConnection',
            context,
            connection,
            { forceResubscribe: true }
        );
        expect(resubscribed).toBe(true);
        expect(context.unsubscribeFromConnection).toHaveBeenCalledTimes(1);
        expect(subscribe).toHaveBeenCalledTimes(1);
    });

    it('replaceExisting overwrites the active subscription without tearing it down', async () => {
        const subscribe = jest.fn().mockResolvedValue(jest.fn());
        const context = createStore();
        context.isServiceReady = jest.fn(() => true);
        context.walletServiceKeys = { privateKey: 'service-secret' };
        const previousHandle = jest.fn();
        context.activeSubscriptions = new Map([['conn-1', previousHandle]]);
        context.nwcWalletServices = new Map([
            ['wss://relay.example', { subscribe }]
        ]);
        context.retryWithBackoff = jest.fn(async (fn: () => Promise<any>) =>
            fn()
        );
        context.unsubscribeFromConnection = jest
            .fn()
            .mockResolvedValue(undefined);
        const connection: any = {
            id: 'conn-1',
            name: 'wallet',
            relayUrl: 'wss://relay.example',
            pubkey: 'client-pubkey',
            hasPermission: jest.fn(() => false)
        };

        const result = await callStoreMethod<boolean>(
            'subscribeToConnection',
            context,
            connection,
            { replaceExisting: true }
        );

        expect(result).toBe(true);
        // updateConnection passes replaceExisting: true; the caller is
        // responsible for disposing the old handle later, so the store
        // must NOT call unsubscribeFromConnection itself.
        expect(context.unsubscribeFromConnection).not.toHaveBeenCalled();
        expect(subscribe).toHaveBeenCalledTimes(1);
    });
});
