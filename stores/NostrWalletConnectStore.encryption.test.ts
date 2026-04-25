const mockNip04Encrypt = jest.fn();
const mockNip04Decrypt = jest.fn();
const mockNip44Encrypt = jest.fn();
const mockNip44Decrypt = jest.fn();
const mockNip44GetConversationKey = jest.fn();

jest.mock('@getalby/sdk', () => ({
    nwc: {
        NWCWalletService: class {
            connected = false;
            opts: any;
            constructor(opts: any) {
                this.opts = opts;
            }
        }
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
jest.mock('@nostr/tools/nip04', () => ({
    __esModule: true,
    default: {
        encrypt: mockNip04Encrypt,
        decrypt: mockNip04Decrypt
    },
    encrypt: mockNip04Encrypt,
    decrypt: mockNip04Decrypt
}));
jest.mock('@nostr/tools/nip44', () => ({
    __esModule: true,
    default: {
        encrypt: mockNip44Encrypt,
        decrypt: mockNip44Decrypt,
        getConversationKey: mockNip44GetConversationKey
    },
    encrypt: mockNip44Encrypt,
    decrypt: mockNip44Decrypt,
    getConversationKey: mockNip44GetConversationKey
}));
jest.mock('@noble/hashes/utils', () => ({ hexToBytes: jest.fn() }));
jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(async () => null),
        setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined)
    }
}));
jest.mock('../models/NWCConnection', () => ({
    __esModule: true,
    default: class NWCConnection {
        constructor(props: any) {
            Object.assign(this, props);
        }
    },
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

import NostrWalletConnectStore from './NostrWalletConnectStore';

type EncryptionMethodName =
    | 'getEventEncryptionScheme'
    | 'isSupportedEncryptionScheme';

const storePrototype = NostrWalletConnectStore.prototype as unknown as Record<
    EncryptionMethodName,
    (this: unknown, tags: string[][]) => unknown
>;

const callStoreEncryptionMethod = <T>(
    methodName: EncryptionMethodName,
    tags: string[][]
): T => {
    const method = storePrototype[methodName];

    if (typeof method !== 'function') {
        throw new Error(
            `Expected NostrWalletConnectStore.prototype.${methodName} to exist`
        );
    }

    return method.call({}, tags) as T;
};

describe('NostrWalletConnectStore encryption helpers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getEventEncryptionScheme', () => {
        it.each([
            {
                description: 'defaults to nip04 when the tag is missing',
                tags: [['p', 'pubkey']],
                expected: 'nip04'
            },
            {
                description: 'defaults to nip04 when the tag is blank',
                tags: [['encryption', '']],
                expected: 'nip04'
            },
            {
                description: 'returns nip04 for exact nip04 matches',
                tags: [['encryption', 'nip04']],
                expected: 'nip04'
            },
            {
                description: 'returns nip44_v2 for exact nip44_v2 matches',
                tags: [['encryption', 'nip44_v2']],
                expected: 'nip44_v2'
            },
            {
                description: 'normalizes uppercase supported values',
                tags: [['encryption', 'NIP44_V2']],
                expected: 'nip44_v2'
            }
        ])('$description', ({ tags, expected }) => {
            expect(
                callStoreEncryptionMethod<'nip04' | 'nip44_v2'>(
                    'getEventEncryptionScheme',
                    tags
                )
            ).toBe(expected);
        });

        it.each([
            {
                tags: [['encryption', 'nip44_v2_extra']],
                label: 'partial match'
            },
            { tags: [['encryption', 'unsupported']], label: 'unknown scheme' },
            {
                tags: [['encryption', 123 as unknown as string]],
                label: 'number'
            }
        ])(
            'throws for an invalid $label instead of silently downgrading to nip04',
            ({ tags }) => {
                expect(() =>
                    callStoreEncryptionMethod<'nip04' | 'nip44_v2'>(
                        'getEventEncryptionScheme',
                        tags
                    )
                ).toThrow();
            }
        );
    });

    describe('isSupportedEncryptionScheme', () => {
        it.each([
            { tags: [['p', 'pubkey']], expected: true },
            { tags: [['encryption', '']], expected: true },
            { tags: [['encryption', 'nip04']], expected: true },
            { tags: [['encryption', 'NIP04']], expected: true },
            { tags: [['encryption', 'nip44_v2']], expected: true },
            { tags: [['encryption', 'prefix_nip44_v2']], expected: false },
            { tags: [['encryption', 'unsupported']], expected: false },
            {
                tags: [
                    ['encryption', { scheme: 'nip04' } as unknown as string]
                ],
                expected: false
            }
        ])('returns $expected for %j', ({ tags, expected }) => {
            if (!expected) {
                jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            }

            expect(
                callStoreEncryptionMethod<boolean>(
                    'isSupportedEncryptionScheme',
                    tags
                )
            ).toBe(expected);
        });
    });

    it('falls back to nip04 responses when nip44 encryption fails', async () => {
        mockNip04Encrypt.mockReset();
        mockNip44Encrypt.mockReset();
        mockNip44GetConversationKey.mockReset();
        const store = new NostrWalletConnectStore(
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
        );
        const relay = {
            connect: jest.fn().mockResolvedValue(undefined),
            publish: jest.fn().mockResolvedValue(undefined),
            close: jest.fn()
        };
        const relayInit = jest.requireMock('nostr-tools')
            .relayInit as jest.Mock;
        const nip04Module = jest.requireMock('@nostr/tools/nip04') as {
            encrypt: jest.Mock;
            decrypt: jest.Mock;
        };
        const nip44Module = jest.requireMock('@nostr/tools/nip44') as {
            encrypt: jest.Mock;
            decrypt: jest.Mock;
            getConversationKey: jest.Mock;
        };
        relayInit.mockReturnValue(relay);
        nip04Module.encrypt = mockNip04Encrypt;
        nip04Module.decrypt = mockNip04Decrypt;
        nip44Module.encrypt = mockNip44Encrypt;
        nip44Module.decrypt = mockNip44Decrypt;
        nip44Module.getConversationKey = mockNip44GetConversationKey;
        mockNip44GetConversationKey.mockReturnValue('conversation-key');
        // NIP-44 encryption fails
        mockNip44Encrypt.mockImplementation(() => {
            throw new Error('nip44 failed');
        });
        mockNip04Encrypt.mockReturnValue('fallback-content');
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        (store as any).retryWithBackoff = jest
            .fn(async (fn: () => Promise<void>) => fn())
            .mockName('retryWithBackoff');

        await (store as any).publishEventToClient(
            { relayUrl: 'wss://relay.example', pubkey: 'client-pubkey' },
            'pay_invoice',
            { result: { preimage: 'preimage' } },
            'event-1',
            'nip44_v2'
        );

        expect(mockNip04Encrypt).toHaveBeenCalledWith(
            'service-secret',
            'client-pubkey',
            JSON.stringify({
                result_type: 'pay_invoice',
                result: { preimage: 'preimage' }
            })
        );

        expect(relay.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 23195,
                content: 'fallback-content',
                tags: expect.arrayContaining([
                    ['e', 'event-1'],
                    ['encryption', 'nip04'],
                    ['p', 'client-pubkey']
                ])
            })
        );
    });

    it('publishes payment_sent notifications as NIP-47 notification events', async () => {
        mockNip04Encrypt.mockReset();
        mockNip44Encrypt.mockReset();
        mockNip44GetConversationKey.mockReset();
        const store = new NostrWalletConnectStore(
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
        );
        const relay = {
            connect: jest.fn().mockResolvedValue(undefined),
            publish: jest.fn().mockResolvedValue(undefined),
            close: jest.fn()
        };
        const relayInit = jest.requireMock('nostr-tools')
            .relayInit as jest.Mock;
        relayInit.mockReturnValue(relay);
        mockNip44GetConversationKey.mockReturnValue('conversation-key');
        mockNip44Encrypt.mockReturnValue('nip44-notification-content');
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        (store as any).retryWithBackoff = jest
            .fn(async (fn: () => Promise<void>) => fn())
            .mockName('retryWithBackoff');

        await (store as any).publishNip47Notification(
            {
                id: 'connection-1',
                relayUrl: 'wss://relay.example',
                pubkey: 'client-pubkey'
            },
            'payment_sent',
            {
                type: 'outgoing',
                state: 'settled',
                invoice: 'lnbc1...',
                description: '',
                description_hash: '',
                preimage: 'preimage',
                payment_hash: 'payment-hash',
                amount: 1000,
                fees_paid: 0,
                settled_at: 123,
                created_at: 123,
                expires_at: 0
            }
        );

        expect(relay.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                kind: 23197,
                content: 'nip44-notification-content',
                tags: expect.arrayContaining([
                    ['p', 'client-pubkey'],
                    ['encryption', 'nip44_v2'],
                    ['notification_type', 'payment_sent']
                ])
            })
        );
    });

    it('publishes unsupported-encryption responses with the original method', async () => {
        const store = new NostrWalletConnectStore(
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
        );
        const publishSpy = jest
            .spyOn(store as any, 'publishEventToClient')
            .mockResolvedValue(undefined);

        await (store as any).publishUnsupportedEncryptionResponse(
            { relayUrl: 'wss://relay.example', pubkey: 'client-pubkey' },
            'pay_invoice',
            'event-unsupported',
            'nip44_v2'
        );

        expect(publishSpy).toHaveBeenCalledWith(
            { relayUrl: 'wss://relay.example', pubkey: 'client-pubkey' },
            'pay_invoice',
            expect.any(Object),
            'event-unsupported',
            'nip04'
        );
    });
});

describe('NostrWalletConnectStore updateConnection validation order', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not perform side effects when regenerated LUD-16 is invalid', async () => {
        const store = new NostrWalletConnectStore(
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
        );
        const connection = {
            id: 'conn-1',
            pubkey: 'connection-pubkey',
            relayUrl: 'wss://old.relay',
            includeLightningAddress: false,
            permissions: [],
            totalSpendSats: 0,
            maxAmountSats: 0,
            budgetRenewal: 'never',
            activity: []
        };
        store.connections = [connection as any];
        (store as any).walletServiceKeys = {
            publicKey: 'wallet-service-pubkey'
        };
        (store as any).nwcWalletServices = new Map();
        (store as any).validateRelayUrl = jest.fn(() => true);
        const loadClientPrivateKeySpy = jest
            .spyOn(store as any, 'loadClientPrivateKey')
            .mockResolvedValue('client-secret');
        const unsubscribeSpy = jest
            .spyOn(store as any, 'unsubscribeFromConnection')
            .mockResolvedValue(undefined);
        const initializeSpy = jest
            .spyOn(store as any, 'initializeNWCWalletServices')
            .mockResolvedValue(undefined);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);
        const subscribeSpy = jest
            .spyOn(store as any, 'subscribeToConnection')
            .mockResolvedValue(undefined);
        const lud16Spy = jest
            .spyOn(store as any, 'getConnectionLud16')
            .mockReturnValue('invalid..name@example.com');
        const localizedErrorSpy = jest
            .spyOn(store as any, 'localizeConnectionUrlBuildError')
            .mockImplementation((error: unknown) => error as Error);
        const consoleErrorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await store.updateConnection('conn-1', {
            relayUrl: 'wss://new.relay',
            includeLightningAddress: true
        });

        expect(result).toEqual({ success: false });
        expect((store as any).validateRelayUrl).toHaveBeenCalledWith(
            'wss://new.relay'
        );
        expect(lud16Spy).toHaveBeenCalledWith(true);
        expect(loadClientPrivateKeySpy).not.toHaveBeenCalled();
        expect(unsubscribeSpy).not.toHaveBeenCalled();
        expect(initializeSpy).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();
        expect(subscribeSpy).not.toHaveBeenCalled();
        expect(localizedErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect((store as any).errorMessage).toBe('INVALID_LIGHTNING_ADDRESS');
        expect(connection.relayUrl).toBe('wss://old.relay');
    });
});

describe('NostrWalletConnectStore pay_invoice mutex', () => {
    it('serializes concurrent pay_invoice work through the shared mutex', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const started: string[] = [];
        let releaseFirst!: () => void;
        const firstFinished = new Promise<void>((resolve) => {
            releaseFirst = resolve;
        });
        const first = (store as any).runPayInvoiceSerialized(async () => {
            started.push('first-start');
            await firstFinished;
            started.push('first-end');
        });
        const second = (store as any).runPayInvoiceSerialized(async () => {
            started.push('second-start');
            started.push('second-end');
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(started).toEqual(['first-start']);

        releaseFirst();
        await Promise.all([first, second]);

        expect(started).toEqual([
            'first-start',
            'first-end',
            'second-start',
            'second-end'
        ]);
    });

    it('keeps the pay_invoice mutex alive longer than payment completion waits', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const withMutexSpy = jest
            .spyOn(store as any, 'withMutex')
            .mockResolvedValue('ok');

        await (store as any).runPayInvoiceSerialized(async () => 'ok');

        expect(withMutexSpy).toHaveBeenCalledWith(
            'pay_invoice',
            expect.any(Function),
            150000
        );
    });
});

describe('NWCConnection replacement flow', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('allows regenerating a connection with the same name when replaceConnectionId is set', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const existingConnection = {
            id: 'conn-1',
            name: 'Shared Name',
            pubkey: 'old-pubkey',
            relayUrl: 'wss://old.relay',
            permissions: [],
            createdAt: new Date(),
            totalSpendSats: 0,
            nodePubkey: 'node-pubkey',
            implementation: 'cln-rest',
            includeLightningAddress: false,
            activity: []
        };
        store.connections = [existingConnection as any];
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        (store as any).nwcWalletServices = new Map([
            ['wss://new.relay', {} as any]
        ]);
        (store as any).publishedRelays = new Set(['wss://new.relay']);
        const generateSecretSpy = jest
            .spyOn(store as any, 'generateConnectionSecret')
            .mockReturnValue({
                connectionUrl:
                    'nostr+walletconnect://service-pubkey?relay=wss%3A%2F%2Fnew.relay&secret=new-secret',
                connectionPrivateKey: 'new-secret',
                connectionPublicKey: 'new-pubkey'
            });
        const storeClientKeysSpy = jest
            .spyOn(store as any, 'storeClientKeys')
            .mockResolvedValue(undefined);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);
        const subscribeSpy = jest
            .spyOn(store as any, 'subscribeToConnection')
            .mockResolvedValue(true);
        const handoffSpy = jest
            .spyOn(store as any, 'sendHandoffRequest')
            .mockResolvedValue(undefined);

        const url = await store.createConnection({
            name: 'Shared Name',
            relayUrl: 'wss://new.relay',
            replaceConnectionId: 'conn-1'
        });

        expect(url).toContain('nostr+walletconnect://service-pubkey');
        expect(generateSecretSpy).toHaveBeenCalled();
        expect(storeClientKeysSpy).toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();
        expect(subscribeSpy).toHaveBeenCalled();
        expect(handoffSpy).toHaveBeenCalled();
        expect(store.connections).toHaveLength(2);
    });

    it('creates a relay service for a new relay before resubscribing', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const existingConnection = {
            id: 'conn-new-relay',
            name: 'Relay Update',
            pubkey: 'old-pubkey',
            relayUrl: 'wss://old.relay',
            permissions: [],
            createdAt: new Date(),
            totalSpendSats: 0,
            nodePubkey: 'node-pubkey',
            implementation: 'cln-rest',
            includeLightningAddress: false,
            activity: []
        };
        store.connections = [existingConnection as any];
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        (store as any).nwcWalletServices = new Map();
        const loadClientPrivateKeySpy = jest
            .spyOn(store as any, 'loadClientPrivateKey')
            .mockResolvedValue('client-secret');
        const initializeSpy = jest
            .spyOn(store as any, 'initializeNWCWalletServices')
            .mockResolvedValue(undefined);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);
        jest.spyOn(store as any, 'subscribeToConnection').mockResolvedValue(
            true
        );

        const result = await store.updateConnection('conn-new-relay', {
            relayUrl: 'wss://new.relay'
        });

        expect(result).toEqual({ success: true, nostrUrl: expect.any(String) });
        expect(loadClientPrivateKeySpy).toHaveBeenCalledWith('old-pubkey');
        expect(initializeSpy).not.toHaveBeenCalled();
        expect(saveSpy).toHaveBeenCalled();
        expect((store as any).nwcWalletServices.has('wss://new.relay')).toBe(
            true
        );
    });

    it('rejects invalid Lightning Addresses before wallet-service side effects', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: true,
                lightningAddress: 'invalid..name@example.com'
            } as any,
            {} as any,
            {} as any
        );
        const loadWalletServiceKeysSpy = jest
            .spyOn(store as any, 'loadWalletServiceKeys')
            .mockResolvedValue(undefined);
        const storeClientKeysSpy = jest
            .spyOn(store as any, 'storeClientKeys')
            .mockResolvedValue(undefined);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);
        const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        await expect(
            store.createConnection({
                name: 'Lightning Address Test',
                relayUrl: 'wss://new.relay',
                includeLightningAddress: true
            })
        ).rejects.toThrow(
            'stores.NostrWalletConnectStore.error.invalidLightningAddress'
        );

        expect(loadWalletServiceKeysSpy).not.toHaveBeenCalled();
        expect(storeClientKeysSpy).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('rejects includeLightningAddress when no lightning address is active', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false,
                lightningAddress: 'user@example.com'
            } as any,
            {} as any,
            {} as any
        );
        const loadWalletServiceKeysSpy = jest
            .spyOn(store as any, 'loadWalletServiceKeys')
            .mockResolvedValue(undefined);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);

        await expect(
            store.createConnection({
                name: 'Lightning Address Test',
                relayUrl: 'wss://new.relay',
                includeLightningAddress: true
            })
        ).rejects.toThrow(
            'stores.NostrWalletConnectStore.error.invalidLightningAddress'
        );

        expect(loadWalletServiceKeysSpy).not.toHaveBeenCalled();
        expect(saveSpy).not.toHaveBeenCalled();
        expect(store.connections).toHaveLength(0);
    });

    it('publishes an unsupported-encryption response for pending events', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        store.connections = [
            {
                id: 'conn-unsupported',
                pubkey: 'connection-pubkey',
                relayUrl: 'wss://relay.example',
                nodePubkey: 'node-pubkey',
                implementation: 'cln-rest',
                isActive: true,
                permissions: [],
                activity: []
            } as any
        ];
        const unsupportedSpy = jest
            .spyOn(store as any, 'publishUnsupportedEncryptionResponse')
            .mockResolvedValue(undefined);
        const mockedNostrTools = jest.requireMock('nostr-tools') as {
            validateEvent: jest.Mock;
            verifySignature: jest.Mock;
            getEventHash: jest.Mock;
        };
        mockedNostrTools.validateEvent.mockReturnValue(true);
        mockedNostrTools.verifySignature.mockReturnValue(true);
        mockedNostrTools.getEventHash.mockReturnValue('event-1');

        await (store as any).validatingPendingPaymentEvents([
            JSON.stringify({
                kind: 23194,
                content: 'ciphertext',
                created_at: 1,
                pubkey: 'connection-pubkey',
                id: 'event-1',
                sig: 'sig',
                tags: [['encryption', 'unsupported']]
            })
        ]);

        expect(unsupportedSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'conn-unsupported' }),
            'unsupported_encryption',
            'event-1',
            'unsupported'
        );
        mockedNostrTools.validateEvent.mockReset();
        mockedNostrTools.verifySignature.mockReset();
        mockedNostrTools.getEventHash.mockReset();
    });

    it('restores the original connection when a relay resubscribe fails', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const connection = {
            id: 'conn-2',
            name: 'Relay Update',
            pubkey: 'old-pubkey',
            relayUrl: 'wss://old.relay',
            permissions: [],
            createdAt: new Date(),
            totalSpendSats: 25,
            maxAmountSats: 100,
            budgetRenewal: 'weekly',
            lastBudgetReset: new Date('2026-01-01T00:00:00Z'),
            nodePubkey: 'node-pubkey',
            implementation: 'cln-rest',
            includeLightningAddress: false,
            hasBudgetLimit: true,
            resetBudget: jest.fn(function (this: any) {
                this.totalSpendSats = 0;
                this.lastBudgetReset = undefined;
            }),
            hasPermission: jest.fn(() => false),
            activity: []
        };
        store.connections = [connection as any];
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        (store as any).nwcWalletServices = new Map([
            ['wss://new.relay', {} as any]
        ]);
        const loadClientPrivateKeySpy = jest
            .spyOn(store as any, 'loadClientPrivateKey')
            .mockResolvedValue('client-secret');
        jest.spyOn(
            NostrWalletConnectStore.prototype as any,
            'subscribeToConnection'
        ).mockResolvedValue(false);
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            return undefined;
        });

        const result = await store.updateConnection('conn-2', {
            relayUrl: 'wss://new.relay'
        } as any);

        expect(result).toEqual({ success: false });
        expect(loadClientPrivateKeySpy).toHaveBeenCalledWith('old-pubkey');
        expect(saveSpy).not.toHaveBeenCalled();
        expect(connection.relayUrl).toBe('wss://old.relay');
        expect(connection.totalSpendSats).toBe(25);
        expect(connection.maxAmountSats).toBe(100);
        expect(connection.budgetRenewal).toBe('weekly');
        expect(errorSpy).toHaveBeenCalled();
    });

    it('clears spend when the budget limit is removed', async () => {
        const store = new NostrWalletConnectStore(
            {
                implementation: 'cln-rest'
            } as any,
            {} as any,
            {
                nodeInfo: { nodeId: 'node-pubkey' }
            } as any,
            {} as any,
            {} as any,
            {} as any,
            {} as any,
            {
                lightningAddressActivated: false
            } as any,
            {} as any,
            {} as any
        );
        const connection = {
            id: 'conn-3',
            name: 'Budget Reset',
            pubkey: 'pubkey-3',
            relayUrl: 'wss://relay.example',
            permissions: [],
            createdAt: new Date(),
            totalSpendSats: 77,
            maxAmountSats: 100,
            budgetRenewal: 'never',
            lastBudgetReset: new Date('2026-01-01T00:00:00Z'),
            nodePubkey: 'node-pubkey',
            implementation: 'cln-rest',
            includeLightningAddress: false,
            hasBudgetLimit: true,
            resetBudget: jest.fn(function (this: any) {
                this.totalSpendSats = 0;
                this.lastBudgetReset = undefined;
            }),
            activity: []
        };
        store.connections = [connection as any];
        (store as any).walletServiceKeys = {
            privateKey: 'service-secret',
            publicKey: 'service-pubkey'
        };
        const saveSpy = jest
            .spyOn(store as any, 'saveConnections')
            .mockResolvedValue(undefined);

        const result = await store.updateConnection('conn-3', {} as any);

        expect(result).toEqual({ success: true });
        expect(saveSpy).toHaveBeenCalled();
        expect((store.connections[0] as any).totalSpendSats).toBe(0);
        expect((store.connections[0] as any).lastBudgetReset).toBeUndefined();
    });
});
