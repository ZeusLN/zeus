jest.mock('./Stores', () => ({}));
jest.mock('./SettingsStore', () => ({ DEFAULT_NOSTR_RELAYS: [] }));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    melt: jest.fn(),
    getMintBalance: jest.fn()
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import { Platform } from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import CashuStore from './CashuStore';
import Storage, { getRawItem } from '../storage';
import CashuDevKit from '../cashu-cdk';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';

// BIP-39 zero-entropy test vector, never a real wallet.
const mnemonic = `${'abandon '.repeat(11)}about`;
const words = mnemonic.split(' ');
const newStore = () =>
    new CashuStore(
        { implementation: 'lnd' } as any,
        {} as any,
        {} as any,
        {} as any
    );

describe('CashuStore synchronizable seed recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'ios';
        (getRawItem as jest.Mock).mockReset();
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('aborts on a read failure and recovers the original seed on retry', async () => {
        const store = newStore();
        (getRawItem as jest.Mock)
            .mockRejectedValueOnce(new Error('keychain unavailable'))
            .mockResolvedValueOnce(JSON.stringify(words));

        expect(await store.initializeCDK()).toBe(false);
        expect(store.seedPhrase).toBeUndefined();
        expect(store.cdkInitialized).toBe(false);
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).not.toHaveBeenCalled();

        expect(await store.initializeCDK()).toBe(true);
        expect(getRawItem).toHaveBeenCalledWith(
            'zeus:lnd-cashu-seed-phrase',
            true
        );
        expect(store.seedPhrase).toEqual(words);
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-phrase',
            words
        );
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-version',
            'v2-bip39'
        );
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it.each([
        '',
        'invalid json',
        'null',
        '{}',
        '[]',
        JSON.stringify(mnemonic),
        JSON.stringify([...words.slice(0, 11), 'abandon']),
        JSON.stringify(words.map((word) => [word]))
    ])('does not replace malformed stored seed %p', async (stored) => {
        (getRawItem as jest.Mock).mockResolvedValue(stored);
        const store = newStore();

        expect(await store.initializeCDK()).toBe(false);
        expect(store.seedPhrase).toBeUndefined();
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).not.toHaveBeenCalled();
    });

    it('generates a new seed only after a confirmed miss', async () => {
        (getRawItem as jest.Mock).mockResolvedValue(null);
        const store = newStore();

        expect(await store.initializeCDK()).toBe(true);
        const generated = store.seedPhrase!.join(' ');
        expect(validateMnemonic(generated, BIP39_WORD_LIST)).toBe(true);
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-phrase',
            store.seedPhrase
        );
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-seed-version',
            'v2-bip39'
        );
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            generated,
            'sat'
        );
    });

    it('keeps using the recovered seed if local persistence fails', async () => {
        (getRawItem as jest.Mock).mockResolvedValue(JSON.stringify(words));
        (Storage.setItem as jest.Mock).mockRejectedValue(
            new Error('write unavailable')
        );
        const store = newStore();

        expect(await store.initializeCDK()).toBe(true);
        expect(store.seedPhrase).toEqual(words);
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it('does not consult the sync partition when a local seed is loaded', async () => {
        const store = newStore();
        store.seedPhrase = words;
        store.seedVersion = 'v2-bip39';

        expect(await store.initializeCDK()).toBe(true);
        expect(getRawItem).not.toHaveBeenCalled();
        expect(Storage.setItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledWith(
            mnemonic,
            'sat'
        );
    });

    it('does not read the sync partition on Android', async () => {
        Platform.OS = 'android';

        expect(await newStore().initializeCDK()).toBe(true);
        expect(getRawItem).not.toHaveBeenCalled();
        expect(CashuDevKit.initializeWallet).toHaveBeenCalledTimes(1);
    });
});

describe('CashuStore single-mint melt state', () => {
    const payingStore = () => {
        const store: any = new CashuStore(
            { implementation: 'lnd', settings: {}, lndDir: 'lnd' } as any,
            {} as any,
            {} as any,
            { checkAndTriggerRatingModal: jest.fn() } as any
        );
        // cdkInitialized stays false so syncCDKBalances early-returns
        store.selectedMintUrl = 'https://mint.example.com';
        store.meltQuote = {
            quote: 'quote-1',
            amount: 1000,
            fee_reserve: 10,
            state: 'Unpaid',
            expiry: 9999999999
        };
        store.payReq = {};
        store.paymentRequest = 'lnbc10n1ptestinvoice';
        store.payments = [];
        return store;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // the success path schedules the rating modal, which would otherwise
        // outlive the test and force the worker to exit
        jest.useFakeTimers();
        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(1_000_000);
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // CDK resolves an unsettled melt with a non-Paid state instead of
    // throwing, and the single-mint path used to report that as a paid
    // invoice: payment success with an empty preimage for an invoice the
    // mint had not paid
    it('reports a Pending melt as an error, not a successful payment', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Pending',
            amount: 1000,
            fee_paid: 0
        });

        await store.payLnInvoiceFromEcash({ amount: '1000' });

        expect(store.paymentSuccess).toBe(false);
        expect(store.paymentError).toBe(true);
        expect(store.paymentPreimage).toBe('');
        // nothing is recorded in history for an unpaid invoice
        expect(store.payments).toEqual([]);
        expect(Storage.setItem).not.toHaveBeenCalled();
    });

    it('records a Paid melt as a successful payment', async () => {
        const store = payingStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Paid',
            amount: 1000,
            fee_paid: 2,
            preimage: 'a'.repeat(64)
        });

        await store.payLnInvoiceFromEcash({ amount: '1000' });

        expect(store.paymentError).toBe(false);
        expect(store.paymentSuccess).toBe(true);
        expect(store.paymentPreimage).toBe('a'.repeat(64));
        expect(store.paymentFee).toBe(2);
        expect(store.payments).toHaveLength(1);
    });
});
