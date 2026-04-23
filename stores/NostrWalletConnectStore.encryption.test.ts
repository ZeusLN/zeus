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
            { tags: [['encryption', 'nip44_v2_extra']], label: 'partial match' },
            { tags: [['encryption', 'unsupported']], label: 'unknown scheme' },
            { tags: [['encryption', 123 as unknown as string]], label: 'number' }
        ])('falls back to nip04 for an invalid $label', ({ tags }) => {
            const warnSpy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => undefined);

            expect(
                callStoreEncryptionMethod<'nip04' | 'nip44_v2'>(
                    'getEventEncryptionScheme',
                    tags
                )
            ).toBe('nip04');
            expect(warnSpy).toHaveBeenCalled();
        });
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
                tags: [['encryption', { scheme: 'nip04' } as unknown as string]],
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
        expect(loadClientPrivateKeySpy).toHaveBeenCalledWith('connection-pubkey');
        expect(lud16Spy).toHaveBeenCalledWith(true);
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
