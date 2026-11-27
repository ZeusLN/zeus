// TransactionsStore.sendPayment wired to the real NostrWalletConnect backend
// (only the SDK's NIP-47 client is stubbed), so these cover what the send
// screen sees for each wallet reply, including the lookup_invoice polling
// that follows a payment left in flight
import {
    Nip47PublishTimeoutError,
    Nip47ReplyTimeoutError,
    Nip47WalletError
} from '@getalby/sdk';

const mockSettingsStore: any = { settings: { locale: 'en' } };
jest.mock('../stores/Stores', () => ({
    get settingsStore() {
        return mockSettingsStore;
    }
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('bitcoinjs-lib', () => ({}));
jest.mock('react-native-randombytes', () => ({ randomBytes: jest.fn() }));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
const mockBackend: { current: any } = { current: null };
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        payLightningInvoice: (...args: any[]) =>
            mockBackend.current.payLightningInvoice(...args),
        lookupPayment: (...args: any[]) =>
            mockBackend.current.lookupPayment(...args),
        supportsOffersDirectPay: () => false,
        supportsPaymentLookup: () =>
            mockBackend.current.supportsPaymentLookup(),
        isLNDBased: () => false
    }
}));
jest.mock('../utils/GraphSyncUtils', () => ({
    checkGraphSyncBeforePayment: jest.fn(() => true)
}));
jest.mock('../utils/ErrorUtils', () => ({
    ...jest.requireActual('../utils/ErrorUtils'),
    errorToUserFriendly: (error: any) =>
        typeof error === 'string' ? error : error?.message
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: {}
}));

import Base64Utils from '../utils/Base64Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import { sha256Hex } from '../utils/HashingUtils';
import NostrWalletConnect from '../backends/NostrWalletConnect';
import TransactionsStore, {
    PAYMENT_TRACK_MAX_FAILURES,
    PAYMENT_TRACK_MAX_NOT_FOUND,
    PAYMENT_TRACK_POLL_MS
} from './TransactionsStore';

// BOLT11 spec reference vector; its decoded payment hash is bound below to
// a preimage the tests control
const SPEC_INVOICE =
    'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpquwpc4curk03c9wlrswe78q4eyqc7d8d0xqzpu9qrsgqhtjpauu9ur7fw2thcl4y9vfvh4m9wlfyz2gem29g5ghe2aak2pm3ps8fdhtceqsaagty2vph7utlgj48u0ged6a337aewvraedendscp573dxr';
const PREIMAGE = 'd'.repeat(64);
const PAYMENT_HASH = sha256Hex(Base64Utils.hexToBytes(PREIMAGE));

const WALLET_PUBKEY = 'b'.repeat(64);
const NWC_URL = `nostr+walletconnect://${WALLET_PUBKEY}?relay=${encodeURIComponent(
    'wss://relay.example.com'
)}&secret=${'a'.repeat(64)}`;

const flushPromises = () =>
    new Promise(jest.requireActual('timers').setImmediate);

// runs the payment tracker's polls (one lookup every
// PAYMENT_TRACK_POLL_MS)
const runPolls = async (polls: number) => {
    for (let i = 0; i < polls; i++) {
        jest.advanceTimersByTime(PAYMENT_TRACK_POLL_MS);
        await flushPromises();
    }
};

const setup = async () => {
    mockSettingsStore.nostrWalletConnectUrl = NWC_URL;
    const backend = new NostrWalletConnect();
    await backend.initNWC();
    await backend.connect();
    backend.nwc.client.payInvoice = jest.fn();
    // a wallet with no record of the payment, unless a test says otherwise
    backend.nwc.client.lookupInvoice = jest
        .fn()
        .mockRejectedValue(new Nip47WalletError('not found', 'NOT_FOUND'));
    mockBackend.current = backend;

    const store = new TransactionsStore(
        { implementation: 'nostr-wallet-connect', settings: {} } as any,
        {} as any,
        {} as any,
        {} as any,
        { checkAndTriggerRatingModal: jest.fn() } as any
    );
    return {
        store,
        payInvoice: backend.nwc.client.payInvoice as jest.Mock,
        lookupInvoice: backend.nwc.client.lookupInvoice as jest.Mock
    };
};

describe('TransactionsStore.sendPayment on Nostr Wallet Connect', () => {
    let consoleError: jest.SpyInstance;

    beforeEach(() => {
        jest.useFakeTimers();
        // the SDK logs every failed request with console.error
        consoleError = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const decode = Bolt11Utils.decode;
        jest.spyOn(Bolt11Utils, 'decode').mockImplementation(
            (invoice: string) => ({
                ...decode(invoice),
                payment_hash: PAYMENT_HASH
            })
        );
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        consoleError.mockRestore();
    });

    it('records a payment with a matching preimage as succeeded', async () => {
        const { store, payInvoice } = await setup();
        payInvoice.mockResolvedValue({ preimage: PREIMAGE });

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.error).toBe(false);
        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_preimage).toBe(PREIMAGE);
        expect(store.payment_hash).toBe(PAYMENT_HASH);
        expect(store.isIncomplete).toBe(false);
        // same key Payment.getNoteKey gives the payment in the activity list
        expect(store.noteKey).toBe(`note-${PAYMENT_HASH}`);
    });

    it('records the fee the wallet reports', async () => {
        const { store, payInvoice } = await setup();
        payInvoice.mockResolvedValue({ preimage: PREIMAGE, fees_paid: 3000 });

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.status).toBe('SUCCEEDED');
        expect(store.payment_fee).toBe('3');
    });

    it('sends the amount entered for a zero-amount invoice in msat', async () => {
        const decode = (
            Bolt11Utils.decode as jest.Mock
        ).getMockImplementation()!;
        (Bolt11Utils.decode as jest.Mock).mockImplementation(
            (invoice: string) => ({
                ...decode(invoice),
                num_satoshis: '0',
                num_msat: '0'
            })
        );
        const { store, payInvoice } = await setup();
        payInvoice.mockResolvedValue({ preimage: PREIMAGE });

        store.sendPayment({ payment_request: SPEC_INVOICE, amount: '500' });
        await flushPromises();

        expect(payInvoice).toHaveBeenCalledWith({
            invoice: SPEC_INVOICE,
            amount: 500_000
        });
        expect(store.status).toBe('SUCCEEDED');
    });

    it('records a reply without a preimage as in transit, not complete', async () => {
        const { store, payInvoice } = await setup();
        payInvoice.mockResolvedValue({});

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.error).toBe(false);
        expect(store.status).toBe('IN_FLIGHT');
        // the guard holds while the wallet is asked for the payment
        expect(store.paymentInFlight).toBe(true);
    });

    it.each([
        [
            'reply timeout',
            new Nip47ReplyTimeoutError('reply timeout: event abc', 'INTERNAL')
        ],
        [
            'publish timeout',
            new Nip47PublishTimeoutError('publish timeout: abc', 'INTERNAL')
        ]
    ])('records a wallet %s as in transit, not an error', async (_, error) => {
        const { store, payInvoice } = await setup();
        payInvoice.mockRejectedValue(error);

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.loading).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.paymentInFlight).toBe(true);
    });

    it('surfaces a wallet error as a failed payment', async () => {
        const { store, payInvoice } = await setup();
        payInvoice.mockRejectedValue(
            new Nip47WalletError('no route found', 'PAYMENT_FAILED')
        );

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.error).toBe(true);
        expect(store.error_msg).toBe('no route found');
        expect(store.status).toBeNull();
    });

    it('records a preimage that does not match the invoice as in transit, not an error', async () => {
        const { store, payInvoice } = await setup();
        payInvoice.mockResolvedValue({ preimage: 'c'.repeat(64) });

        store.sendPayment({ payment_request: SPEC_INVOICE });
        await flushPromises();

        expect(store.error).toBe(false);
        expect(store.error_msg).toBeNull();
        expect(store.status).toBe('IN_FLIGHT');
        expect(store.paymentInFlight).toBe(true);
    });

    describe('after a payment is left in flight', () => {
        it('shows the settled record the wallet reports for a reply timeout', async () => {
            const { store, payInvoice, lookupInvoice } = await setup();
            payInvoice.mockRejectedValue(
                new Nip47ReplyTimeoutError(
                    'reply timeout: event abc',
                    'INTERNAL'
                )
            );
            lookupInvoice.mockResolvedValue({
                payment_hash: PAYMENT_HASH,
                state: 'settled',
                preimage: PREIMAGE,
                amount: 250_000_000
            });

            store.sendPayment({ payment_request: SPEC_INVOICE });
            await flushPromises();

            expect(lookupInvoice).toHaveBeenCalledWith({
                payment_hash: PAYMENT_HASH
            });
            expect(store.error).toBe(false);
            expect(store.status).toBe('SUCCEEDED');
            expect(store.payment_preimage).toBe(PREIMAGE);
            expect(store.paymentInFlight).toBe(false);
            // same key Payment.getNoteKey gives the payment in the
            // activity list
            expect(store.noteKey).toBe(`note-${PAYMENT_HASH}`);
        });

        it('does not show a wrong preimage as proof when the wallet reports the payment settled', async () => {
            const wrong = 'c'.repeat(64);
            const { store, payInvoice, lookupInvoice } = await setup();
            payInvoice.mockResolvedValue({ preimage: wrong });
            lookupInvoice.mockResolvedValue({
                payment_hash: PAYMENT_HASH,
                state: 'settled',
                preimage: wrong,
                amount: 250_000_000
            });

            store.sendPayment({ payment_request: SPEC_INVOICE });
            await flushPromises();

            expect(store.error).toBe(false);
            expect(store.status).toBe('SUCCEEDED');
            expect(store.payment_preimage).toBe('');
            expect(store.paymentInFlight).toBe(false);
        });

        // the send screen then shows the payment in transit with the
        // "stopped checking" notice and no Try Again (which needs error)
        it.each([
            [
                'a publish timeout the wallet has no record of',
                PAYMENT_TRACK_MAX_NOT_FOUND,
                () =>
                    Promise.reject(
                        new Nip47PublishTimeoutError(
                            'publish timeout: abc',
                            'INTERNAL'
                        )
                    ),
                () =>
                    Promise.reject(
                        new Nip47WalletError('not found', 'NOT_FOUND')
                    )
            ],
            [
                'a wrong preimage from a wallet without lookup_invoice',
                PAYMENT_TRACK_MAX_FAILURES,
                () => Promise.resolve({ preimage: 'c'.repeat(64) }),
                () =>
                    Promise.reject(
                        new Nip47WalletError('not supported', 'NOT_IMPLEMENTED')
                    )
            ]
        ])(
            'stops checking %s without offering a retry',
            async (_, lookups, pay, lookup) => {
                const { store, payInvoice, lookupInvoice } = await setup();
                payInvoice.mockImplementation(pay);
                lookupInvoice.mockImplementation(lookup);

                store.sendPayment({ payment_request: SPEC_INVOICE });
                await flushPromises();
                await runPolls(lookups);

                expect(lookupInvoice).toHaveBeenCalledTimes(lookups);
                expect(store.paymentInFlight).toBe(false);
                expect(store.paymentOutcomeUnverified).toBe(true);
                expect(store.error).toBe(false);
                expect(store.status).toBe('IN_FLIGHT');
            }
        );
    });
});
