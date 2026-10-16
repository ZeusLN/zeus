jest.mock('./Stores', () => ({}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one', 'wss://relay.two']
}));
jest.mock('react-native-blob-util', () => ({}));
jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: jest.fn()
}));
jest.mock('../utils/NostrUtils', () => ({}));
jest.mock('../utils/NostrMintBackup', () => ({}));
jest.mock('../utils/MigrationUtils', () => ({}));
jest.mock('../utils/ThemeUtils', () => ({}));
jest.mock('../utils/LocaleUtils');
jest.mock('../NavigationService', () => ({}));
jest.mock('../cashu-cdk', () => ({
    isAvailable: jest.fn(() => true),
    initializeWallet: jest.fn().mockResolvedValue(undefined),
    isValidToken: jest.fn(),
    getMintBalance: jest.fn(),
    createMeltQuote: jest.fn(),
    melt: jest.fn()
}));
jest.mock('../storage', () => ({
    setItem: jest.fn().mockResolvedValue(true),
    getRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import { Platform } from 'react-native';
import { validateMnemonic } from '@scure/bip39';
import NDK from '@nostr-dev-kit/ndk';
import CashuStore from './CashuStore';
import Storage, { getRawItem } from '../storage';
import CashuDevKit from '../cashu-cdk';
import { BIP39_WORD_LIST } from '../utils/Bip39Utils';
import Bolt11Utils from '../utils/Bolt11Utils';
import * as SchedulingUtils from '../utils/SchedulingUtils';

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

describe('CashuStore pending item checks before init', () => {
    // Activity and Activity Export call checkPendingItems before Cashu has
    // initialized, e.g. with no node running
    afterEach(() => jest.restoreAllMocks());

    it('starts with no mints', () => {
        expect(newStore().mintUrls).toEqual([]);
    });

    it('checkPendingItems runs its sweep on a fresh store', async () => {
        let task: (() => unknown) | undefined;
        jest.spyOn(SchedulingUtils, 'runWhenIdle').mockImplementation((t) => {
            task = t;
            return () => {};
        });
        const store = newStore();
        const checkInvoicePaid = jest.spyOn(store, 'checkInvoicePaid');
        const checkTokenSpent = jest.spyOn(store, 'checkTokenSpent');

        await store.checkPendingItems();
        await expect(task!()).resolves.toBeUndefined();

        expect(checkInvoicePaid).not.toHaveBeenCalled();
        expect(checkTokenSpent).not.toHaveBeenCalled();
    });

    it('checkSentTokensSpentStatus reports no updates on a fresh store', async () => {
        const store = newStore();
        store.sentTokens = [
            { spent: false, mint: 'https://mint.example.com' }
        ] as any;
        const checkTokenSpent = jest.spyOn(store, 'checkTokenSpent');

        await expect(store.checkSentTokensSpentStatus()).resolves.toBe(false);
        // No mints are configured yet, so the token's mint is not polled
        expect(checkTokenSpent).not.toHaveBeenCalled();
    });
});

describe('CashuStore checkAndSweepMints', () => {
    const storeWith = (settings: any) => {
        const store = new CashuStore(
            { settings } as any,
            {} as any,
            { channels: [{}] } as any,
            {} as any
        );
        store.mintUrls = ['https://mint.example.com'];
        store.mintBalances = { 'https://mint.example.com': 50000 };
        const sweepMint = jest
            .spyOn(store, 'sweepMint')
            .mockResolvedValue(undefined as any);
        return { store, sweepMint };
    };

    afterEach(() => jest.restoreAllMocks());

    it('does nothing when settings have no ecash key', async () => {
        const { store, sweepMint } = storeWith({});
        await expect(store.checkAndSweepMints()).resolves.toBeUndefined();
        expect(sweepMint).not.toHaveBeenCalled();
    });

    it('does nothing when automatic sweep is off', async () => {
        const { store, sweepMint } = storeWith({
            ecash: { automaticallySweep: false, sweepThresholdSats: 10000 }
        });
        await store.checkAndSweepMints();
        expect(sweepMint).not.toHaveBeenCalled();
    });

    it('sweeps a mint whose balance exceeds the threshold', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        const { store, sweepMint } = storeWith({
            ecash: { automaticallySweep: true, sweepThresholdSats: 10000 }
        });
        await store.checkAndSweepMints();
        expect(sweepMint).toHaveBeenCalledWith('https://mint.example.com');
    });
});

describe('CashuStore melting into our own invoice', () => {
    const mintUrl = 'https://mint.example.com';
    const preimage = '11'.repeat(32);
    // sha256(preimage)
    const paymentHash =
        '02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc';
    const token = { mint: mintUrl, getAmount: 1000, proofs: [] } as any;

    const storeWith = (nodeSaysPaid: boolean) => {
        const isInvoicePaid = jest.fn().mockResolvedValue(nodeSaysPaid);
        const store = new CashuStore(
            {} as any,
            {
                createInvoice: jest
                    .fn()
                    .mockResolvedValue({ paymentRequest: 'lnbc1invoice' }),
                isInvoicePaid
            } as any,
            {} as any,
            {} as any
        );
        store.cdkInitialized = true;
        jest.spyOn(store, 'isOffline', 'get').mockReturnValue(false);
        jest.spyOn(store, 'receiveTokenCDK').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'syncCDKBalances').mockResolvedValue(
            undefined as any
        );
        jest.spyOn(store, 'createMeltQuoteCDK').mockResolvedValue({
            fee_reserve: 0
        } as any);
        return { store, isInvoicePaid };
    };

    const claimWithMeltPreimage = async (
        meltPreimage: string | undefined,
        nodeSaysPaid: boolean
    ) => {
        const { store, isInvoicePaid } = storeWith(nodeSaysPaid);
        jest.spyOn(store, 'meltCDK').mockResolvedValue({
            state: 'Paid',
            amount: 1000,
            fee_paid: 0,
            preimage: meltPreimage
        } as any);
        const result = await store.claimToken('cashuB...', token, true);
        return { store, result, isInvoicePaid };
    };

    beforeEach(() => {
        jest.spyOn(Bolt11Utils, 'decode').mockReturnValue({
            payment_hash: paymentHash
        } as any);
        (CashuDevKit.isValidToken as jest.Mock).mockResolvedValue(true);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it('reports a self-custody claim as received when the preimage matches the invoice', async () => {
        const { result, isInvoicePaid } = await claimWithMeltPreimage(
            preimage,
            false
        );

        expect(result).toEqual({ success: true, errorMessage: '' });
        expect(isInvoicePaid).not.toHaveBeenCalled();
    });

    it('fails a self-custody claim when the preimage does not match and the node has no payment', async () => {
        const { store, result, isInvoicePaid } = await claimWithMeltPreimage(
            '00'.repeat(32),
            false
        );

        expect(result).toEqual({
            success: false,
            errorMessage: 'stores.CashuStore.invoiceNotPaid'
        });
        expect(isInvoicePaid).toHaveBeenCalledWith(paymentHash);
        expect(store.loading).toBe(false);
    });

    it('fails a self-custody claim when the mint returns no preimage and the node has no payment', async () => {
        const { result } = await claimWithMeltPreimage(undefined, false);

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('stores.CashuStore.invoiceNotPaid');
    });

    it('asks the node when the mint returns no preimage', async () => {
        const { result, isInvoicePaid } = await claimWithMeltPreimage(
            undefined,
            true
        );

        expect(result).toEqual({ success: true, errorMessage: '' });
        expect(isInvoicePaid).toHaveBeenCalledWith(paymentHash);
    });

    it('ignores a preimage that is not 32 bytes of hex', async () => {
        const { result } = await claimWithMeltPreimage('not-a-preimage', false);

        expect(result.success).toBe(false);
    });

    const sweepWithMeltPreimage = async (
        meltPreimage: string | undefined,
        nodeSaysPaid: boolean
    ) => {
        const { store } = storeWith(nodeSaysPaid);
        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(1000);
        (CashuDevKit.createMeltQuote as jest.Mock).mockResolvedValue({
            id: 'quote-1',
            fee_reserve: 10
        });
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Paid',
            amount: 990,
            fee_paid: 0,
            preimage: meltPreimage
        });
        const swept = await store.sweepMint(mintUrl);
        return { store, swept };
    };

    it('reports a sweep as done when the preimage matches the invoice', async () => {
        const { store, swept } = await sweepWithMeltPreimage(preimage, false);

        expect(swept).toBe(true);
        expect(store.error).toBeFalsy();
    });

    it('fails a sweep when the preimage does not match and the node has no payment', async () => {
        const { store, swept } = await sweepWithMeltPreimage(
            '00'.repeat(32),
            false
        );

        expect(swept).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toContain('stores.CashuStore.invoiceNotPaid');
    });
});

describe('CashuStore NDK instance', () => {
    const MockNDK = NDK as unknown as jest.Mock;
    let connect: jest.Mock;

    beforeEach(() => {
        connect = jest.fn().mockResolvedValue(undefined);
        MockNDK.mockReset().mockImplementation(() => ({
            connect,
            // Emit EOSE right away so subscribeAndCollectEvents resolves
            // without waiting out its 10s timeout.
            subscribe: jest.fn(() => ({
                on: (event: string, cb: () => void) => {
                    if (event === 'eose') cb();
                },
                stop: jest.fn()
            })),
            fetchEvents: jest.fn().mockResolvedValue(new Set())
        }));
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('opts out of the outbox model and connects with a timeout', async () => {
        await newStore().fetchMints();

        expect(MockNDK).toHaveBeenCalledWith({
            explicitRelayUrls: ['wss://relay.one', 'wss://relay.two'],
            enableOutboxModel: false
        });
        expect(connect).toHaveBeenCalledWith(2000);
    });

    it('reuses one instance across repeated Discover Mints loads', async () => {
        const store = newStore();

        await store.fetchMints();
        await store.fetchMints();

        expect(MockNDK).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledTimes(1);
        expect(store.error).toBe(false);
    });

    it('makes concurrent callers wait on a single connect', async () => {
        let finishConnect!: () => void;
        connect.mockReturnValue(
            new Promise<void>((resolve) => (finishConnect = resolve))
        );
        const store = newStore() as any;

        let settled = 0;
        const calls = [store.getNdk(), store.getNdk()].map((p) =>
            p.then((ndk: any) => {
                settled++;
                return ndk;
            })
        );
        await Promise.resolve();
        expect(settled).toBe(0);

        finishConnect();
        const [first, second] = await Promise.all(calls);

        expect(first).toBe(second);
        expect(MockNDK).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it('starts over after a failed connect', async () => {
        connect.mockRejectedValueOnce(new Error('connect failed'));
        const store = newStore() as any;

        await expect(store.getNdk()).rejects.toThrow('connect failed');
        await expect(store.getNdk()).resolves.toBeDefined();

        expect(MockNDK).toHaveBeenCalledTimes(2);
        expect(connect).toHaveBeenCalledTimes(2);
    });
});
