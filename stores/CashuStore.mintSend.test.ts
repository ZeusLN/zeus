const mockConnectivity = { isOffline: false };
const mockActivityStore = { getSortedActivity: jest.fn() };
jest.mock('./Stores', () => ({
    get activityStore() {
        return mockActivityStore;
    },
    get connectivityStore() {
        return mockConnectivity;
    }
}));
jest.mock('./SettingsStore', () => ({
    DEFAULT_NOSTR_RELAYS: ['wss://relay.one']
}));
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
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
jest.mock('../utils/Bolt11Utils', () => ({
    __esModule: true,
    default: { decode: jest.fn() }
}));
jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isAvailable: jest.fn(() => true),
        addMint: jest.fn(),
        getBalances: jest.fn(),
        getTotalBalance: jest.fn(),
        getMintBalance: jest.fn(),
        listTransactions: jest.fn(),
        createMintQuote: jest.fn(),
        checkMintQuote: jest.fn(),
        mint: jest.fn(),
        checkExternalMintQuote: jest.fn(),
        addExternalMintQuote: jest.fn(),
        mintExternal: jest.fn(),
        restore: jest.fn(),
        send: jest.fn()
    }
}));
jest.mock('../storage', () => ({
    __esModule: true,
    default: { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() },
    getRawItem: jest.fn(),
    removeRawItem: jest.fn(),
    KEY_PREFIX: 'zeus:'
}));

import { Alert } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import CashuStore from './CashuStore';
import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';
import Bolt11Utils from '../utils/Bolt11Utils';
import CashuInvoice from '../models/CashuInvoice';
import * as LocaleUtils from '../utils/LocaleUtils';

const cdk = CashuDevKit as unknown as Record<string, jest.Mock>;
const storage = Storage as unknown as Record<string, jest.Mock>;
const decode = Bolt11Utils.decode as jest.Mock;
const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;

const A = 'https://a.mint';
const B = 'https://b.mint';
const C = 'https://c.mint';
const REQUEST = 'lnbc10u1mintquote';
const PUBKEY = `02${'11'.repeat(32)}`;
// BIP-39 zero-entropy test vector, never a real wallet
const MNEMONIC = `${'abandon '.repeat(11)}about`.split(' ');

const newStore = (mints: string[] = [A, B]) => {
    const store = new CashuStore(
        { implementation: 'lnd', lndDir: 'node1', settings: {} } as any,
        {} as any,
        {} as any,
        {} as any
    );
    store.cdkInitialized = true;
    store.mintUrls = mints;
    store.selectedMintUrl = mints[0];
    store.cashuWallets = Object.fromEntries(
        mints.map((m) => [
            m,
            { walletId: m, pubkey: '', errorConnecting: false }
        ])
    );
    store.invoices = [];
    store.sentTokens = [];
    return store;
};

const mintQuote = (state: string, extra: Record<string, any> = {}) => ({
    id: 'quote-1',
    amount: 1000,
    unit: 'sat',
    request: REQUEST,
    state,
    expiry: 9999999999,
    ...extra
});

const cdkToken = (value = 1000) => ({
    encoded: 'cashuBtoken',
    value,
    mint_url: A,
    memo: 'lunch',
    unit: 'sat',
    proofs: [{ amount: value, secret: 's', c: 'c', keyset_id: 'k' }]
});

let localeString: jest.SpyInstance;

beforeEach(() => {
    // resetAllMocks, not clearAllMocks: tests set rejections on these
    // mocks, and clearing keeps implementations, so a failure set in one
    // test would leak into the next. Every default is set again below.
    jest.resetAllMocks();
    mockConnectivity.isOffline = false;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    localeString = jest.spyOn(LocaleUtils, 'localeString');
    cdk.addMint.mockResolvedValue(undefined);
    cdk.getBalances.mockResolvedValue({ [A]: 5000 });
    cdk.getTotalBalance.mockResolvedValue(5000);
    cdk.getMintBalance.mockResolvedValue(5000);
    cdk.listTransactions.mockResolvedValue([]);
    cdk.createMintQuote.mockResolvedValue(mintQuote('Unpaid'));
    cdk.mint.mockResolvedValue(undefined);
    cdk.send.mockResolvedValue(cdkToken());
    cdk.isAvailable.mockReturnValue(true);
    cdk.checkMintQuote.mockResolvedValue(mintQuote('Unpaid'));
    cdk.checkExternalMintQuote.mockResolvedValue({ state: 'UNPAID' });
    cdk.addExternalMintQuote.mockResolvedValue(undefined);
    cdk.mintExternal.mockResolvedValue(undefined);
    cdk.restore.mockResolvedValue(0);
    blobFetch.mockResolvedValue({ json: () => ({ status: 'OK' }) });
    storage.setItem.mockResolvedValue(true);
    storage.getItem.mockResolvedValue(null);
    storage.removeItem.mockResolvedValue(true);
    decode.mockReturnValue({ satoshis: 1000, timestamp: 1700000000 });
});

afterEach(() => jest.restoreAllMocks());

describe('CashuStore.createInvoice', () => {
    it('creates a mint quote on the receive mint and records the invoice', async () => {
        const store = newStore();

        const result = await store.createInvoice({
            memo: 'coffee',
            value: '1000'
        });

        expect(cdk.addMint).toHaveBeenCalledWith(A);
        expect(cdk.createMintQuote).toHaveBeenCalledWith(A, 1000, 'coffee');
        expect(result).toEqual({ paymentRequest: REQUEST });
        expect(store.invoice).toBe(REQUEST);
        expect(store.quoteId).toBe('quote-1');
        expect(store.lastInvoiceMintUrl).toBe(A);
        expect(store.creatingInvoice).toBe(false);
        expect(store.creatingInvoiceError).toBe(false);
        expect(store.invoices).toHaveLength(1);
        expect(store.invoices![0]).toBeInstanceOf(CashuInvoice);
        expect(store.invoices![0]).toMatchObject({
            quote: 'quote-1',
            request: REQUEST,
            mintUrl: A
        });
        expect(store.invoices![0].getAmount).toBe(1000);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-invoices',
            store.invoices
        );
    });

    it('asks for an amountless quote when no value is given', async () => {
        const store = newStore();

        await store.createInvoice({ memo: '', value: '' });

        expect(cdk.createMintQuote).toHaveBeenCalledWith(A, 0, '');
    });

    it('picks a reachable mint at random when randomized selection is on', async () => {
        const store = newStore([A, B, C]);
        store.randomizeMintSelection = true;
        store.cashuWallets[B].errorConnecting = true;
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        await store.createInvoice({ memo: '', value: '10' });

        // B is skipped, so 0.5 picks C from [A, C] (it would pick B from all three)
        expect(cdk.createMintQuote).toHaveBeenCalledWith(C, 10, '');
        expect(store.lastInvoiceMintUrl).toBe(C);
        expect(store.invoices![0].mintUrl).toBe(C);
    });

    it('reports a quote failure without recording an invoice', async () => {
        const store = newStore();
        store.invoice = 'lnbc-previous';
        cdk.createMintQuote.mockRejectedValue(new Error('mint offline'));

        const result = await store.createInvoice({ memo: '', value: '10' });

        expect(result).toBeUndefined();
        expect(store.invoice).toBeUndefined();
        expect(store.creatingInvoice).toBe(false);
        expect(store.creatingInvoiceError).toBe(true);
        expect(store.error_msg).toBe(
            'stores.InvoicesStore.errorCreatingInvoice: mint offline'
        );
        expect(store.invoices).toEqual([]);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('marks the mint unreachable when it cannot be added', async () => {
        const store = newStore();
        cdk.addMint.mockRejectedValue(new Error('connection refused'));

        await store.createInvoice({ memo: '', value: '10' });

        expect(cdk.createMintQuote).not.toHaveBeenCalled();
        expect(store.cashuWallets[A].errorConnecting).toBe(true);
        expect(store.creatingInvoiceError).toBe(true);
        expect(store.error_msg).toBe(
            'stores.InvoicesStore.errorCreatingInvoice: connection refused'
        );
    });

    it('refuses to create an invoice with no mint configured', async () => {
        const store = newStore([]);

        await store.createInvoice({ memo: '', value: '10' });

        expect(cdk.createMintQuote).not.toHaveBeenCalled();
        expect(store.creatingInvoiceError).toBe(true);
        expect(store.error_msg).toBe(
            'stores.InvoicesStore.errorCreatingInvoice: stores.CashuStore.notProperlyConfigured'
        );
    });

    describe('LNURL withdraw', () => {
        const lnurl = {
            callback: 'https://service.example/withdraw?session=abc',
            k1: 'k1value',
            domain: 'service.example'
        } as any;

        it('sends the invoice and k1 to the callback, keeping its query', async () => {
            const store = newStore();
            blobFetch.mockResolvedValue({ json: () => ({ status: 'OK' }) });
            const alert = jest.spyOn(Alert, 'alert');

            await store.createInvoice({ memo: '', value: '10', lnurl });
            await new Promise((resolve) => setImmediate(resolve));

            expect(blobFetch).toHaveBeenCalledTimes(1);
            const [method, requested] = blobFetch.mock.calls[0];
            expect(method).toBe('get');
            const query = new URL(requested).searchParams;
            expect(
                requested.startsWith('https://service.example/withdraw?')
            ).toBe(true);
            expect(query.get('session')).toBe('abc');
            expect(query.get('k1')).toBe('k1value');
            expect(query.get('pr')).toBe(REQUEST);
            expect(alert).not.toHaveBeenCalled();
        });

        it('shows the reason the service gives for an error', async () => {
            const store = newStore();
            blobFetch.mockResolvedValue({
                json: () => ({ status: 'ERROR', reason: 'already claimed' })
            });
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});

            await store.createInvoice({ memo: '', value: '10', lnurl });
            await new Promise((resolve) => setImmediate(resolve));

            expect(alert).toHaveBeenCalledWith(
                '[error] service.example says:',
                'already claimed',
                expect.any(Array),
                { cancelable: false }
            );
        });

        it('shows the network error when the callback cannot be reached', async () => {
            const store = newStore();
            blobFetch.mockRejectedValue(new Error('timeout'));
            const alert = jest
                .spyOn(Alert, 'alert')
                .mockImplementation(() => {});

            await store.createInvoice({ memo: '', value: '10', lnurl });
            await new Promise((resolve) => setImmediate(resolve));

            expect(alert).toHaveBeenCalledWith(
                '[error] service.example says:',
                'timeout',
                expect.any(Array),
                { cancelable: false }
            );
            // the invoice itself was still created
            expect(store.invoice).toBe(REQUEST);
        });
    });
});

describe('CashuStore.checkInvoicePaid', () => {
    const storeWithInvoice = async () => {
        const store = newStore();
        await store.createInvoice({ memo: '', value: '1000' });
        storage.setItem.mockClear();
        cdk.addMint.mockClear();
        return store;
    };

    it('mints a paid quote and replaces the recorded invoice with a paid one', async () => {
        const store = await storeWithInvoice();
        const sweep = jest
            .spyOn(store, 'checkAndSweepMints')
            .mockResolvedValue(undefined);
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Paid'));

        const result = await store.checkInvoicePaid('quote-1', A);

        expect(cdk.checkMintQuote).toHaveBeenCalledWith(A, 'quote-1');
        expect(cdk.mint).toHaveBeenCalledWith(A, 'quote-1');
        expect(result).toEqual({
            isPaid: true,
            amtSat: 1000,
            paymentRequest: REQUEST,
            updatedInvoice: store.invoices![0]
        });
        expect(store.invoices).toHaveLength(1);
        expect(store.invoices![0].isPaid).toBe(true);
        expect(store.invoices![0].mintUrl).toBe(A);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-invoices',
            store.invoices
        );
        // balances and activity are refreshed
        expect(store.mintBalances).toEqual({ [A]: 5000 });
        expect(cdk.listTransactions).toHaveBeenCalled();
        expect(mockActivityStore.getSortedActivity).toHaveBeenCalled();
        expect(sweep).toHaveBeenCalledWith(A);
    });

    it('adds a paid invoice it has no record of, and can skip the sweep', async () => {
        const store = newStore();
        const sweep = jest
            .spyOn(store, 'checkAndSweepMints')
            .mockResolvedValue(undefined);
        cdk.checkMintQuote.mockResolvedValue(
            mintQuote('Paid', { id: 'quote-9' })
        );

        await store.checkInvoicePaid('quote-9', B, undefined, true);

        expect(cdk.mint).toHaveBeenCalledWith(B, 'quote-9');
        expect(store.invoices!.map((i) => [i.quote, i.mintUrl])).toEqual([
            ['quote-9', B]
        ]);
        expect(sweep).not.toHaveBeenCalled();
    });

    it('falls back to the last quote and the receive mint', async () => {
        const store = await storeWithInvoice();
        store.selectedMintUrl = B;
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Unpaid'));

        await store.checkInvoicePaid();

        expect(cdk.checkMintQuote).toHaveBeenCalledWith(B, 'quote-1');
    });

    it('treats an issued quote as paid without minting again', async () => {
        const store = await storeWithInvoice();
        jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(undefined);
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Issued'));

        const result = await store.checkInvoicePaid('quote-1', A);

        expect(cdk.mint).not.toHaveBeenCalled();
        expect(result.isPaid).toBe(true);
        expect(store.invoices![0].isPaid).toBe(true);
    });

    it('mints a pending quote when the mint allows it', async () => {
        const store = await storeWithInvoice();
        jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(undefined);
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Pending'));

        const result = await store.checkInvoicePaid('quote-1', A);

        expect(cdk.mint).toHaveBeenCalledWith(A, 'quote-1');
        expect(result.isPaid).toBe(true);
    });

    it('reports a pending quote the mint will not mint yet as unpaid', async () => {
        const store = await storeWithInvoice();
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Pending'));
        cdk.mint.mockRejectedValue(new Error('quote pending'));

        const result = await store.checkInvoicePaid('quote-1', A);

        expect(result).toEqual({
            isPaid: false,
            quoteState: 'Pending',
            isLegacy: undefined
        });
        expect(store.invoices![0].isPaid).toBe(false);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('leaves an unpaid quote alone', async () => {
        const store = await storeWithInvoice();
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Unpaid'));

        const result = await store.checkInvoicePaid('quote-1', A);

        expect(cdk.mint).not.toHaveBeenCalled();
        expect(result).toEqual({
            isPaid: false,
            quoteState: 'Unpaid',
            isLegacy: undefined
        });
        expect(store.invoices![0].isPaid).toBe(false);
        expect(mockActivityStore.getSortedActivity).not.toHaveBeenCalled();
    });

    it('rejects when minting a paid quote fails', async () => {
        const store = await storeWithInvoice();
        cdk.checkMintQuote.mockResolvedValue(mintQuote('Paid'));
        cdk.mint.mockRejectedValue(new Error('outputs already signed'));

        await expect(store.checkInvoicePaid('quote-1', A)).rejects.toThrow(
            'outputs already signed'
        );
        expect(store.invoices![0].isPaid).toBe(false);
    });

    it('refuses to check with no mint configured', async () => {
        const store = newStore([]);

        await expect(store.checkInvoicePaid('quote-1', A)).rejects.toThrow(
            'stores.CashuStore.notProperlyConfigured'
        );
        expect(cdk.checkMintQuote).not.toHaveBeenCalled();
    });

    describe('quotes CDK has no record of', () => {
        beforeEach(() => {
            cdk.checkMintQuote.mockRejectedValue(
                new Error('Unknown quote: quote-x')
            );
        });

        it('imports and mints a paid external quote with the P2PK key', async () => {
            const store = newStore();
            store.seedPhrase = MNEMONIC;
            jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(
                undefined
            );
            cdk.checkExternalMintQuote.mockResolvedValue({
                state: 'paid',
                amount: 2100,
                request: REQUEST,
                expiry: 1234
            });

            const result = await store.checkInvoicePaid('quote-x', A);

            const secretKey = store.deriveCashuSecretKey();
            expect(secretKey).toMatch(/^[0-9a-f]{64}$/);
            expect(cdk.addExternalMintQuote).toHaveBeenCalledWith(
                A,
                'quote-x',
                2100,
                REQUEST,
                'paid',
                1234,
                secretKey
            );
            expect(cdk.mintExternal).toHaveBeenCalledWith(A, 'quote-x', 2100);
            expect(result).toMatchObject({ isPaid: true, amtSat: 2100 });
            // no CDK quote, so no invoice record is written
            expect(result.updatedInvoice).toBeUndefined();
            expect(store.invoices).toEqual([]);
        });

        it('takes the amount from the invoice when the mint omits it', async () => {
            const store = newStore();
            jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(
                undefined
            );
            cdk.checkExternalMintQuote.mockResolvedValue({
                state: 'PAID',
                request: REQUEST
            });
            decode.mockReturnValue({ satoshis: 777 });

            const result = await store.checkInvoicePaid('quote-x', A);

            expect(decode).toHaveBeenCalledWith(REQUEST);
            // no seed, so the quote is imported without a key
            expect(cdk.addExternalMintQuote).toHaveBeenCalledWith(
                A,
                'quote-x',
                777,
                REQUEST,
                'PAID',
                0,
                undefined
            );
            expect(cdk.mintExternal).toHaveBeenCalledWith(A, 'quote-x', 777);
            expect(result.amtSat).toBe(777);
        });

        it('reports a legacy quote when minting the external quote fails', async () => {
            const store = newStore();
            cdk.checkExternalMintQuote.mockResolvedValue({
                state: 'PAID',
                amount: 2100,
                request: REQUEST
            });
            cdk.mintExternal.mockRejectedValue(new Error('witness invalid'));

            const result = await store.checkInvoicePaid('quote-x', A);

            expect(result).toEqual({
                isPaid: false,
                quoteState: undefined,
                isLegacy: true
            });
        });

        it('restores proofs for an issued external quote', async () => {
            const store = newStore();
            jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(
                undefined
            );
            cdk.checkExternalMintQuote.mockResolvedValue({
                state: 'ISSUED',
                amount: 2100
            });
            cdk.restore.mockResolvedValue(1500);

            const result = await store.checkInvoicePaid('quote-x', A);

            expect(cdk.restore).toHaveBeenCalledWith(A);
            expect(cdk.mintExternal).not.toHaveBeenCalled();
            // the restored amount is reported, not the quote amount
            expect(result).toMatchObject({ isPaid: true, amtSat: 1500 });
        });

        it('reports an issued external quote as paid even when restore finds nothing', async () => {
            const store = newStore();
            jest.spyOn(store, 'checkAndSweepMints').mockResolvedValue(
                undefined
            );
            cdk.checkExternalMintQuote.mockResolvedValue({
                state: 'ISSUED',
                amount: 2100
            });
            cdk.restore.mockResolvedValue(0);

            const result = await store.checkInvoicePaid('quote-x', A);

            // the proofs may already be in this wallet, or in another one
            expect(result).toMatchObject({ isPaid: true, amtSat: 2100 });
        });

        it('leaves an unpaid external quote alone', async () => {
            const store = newStore();
            cdk.checkExternalMintQuote.mockResolvedValue({ state: 'UNPAID' });

            const result = await store.checkInvoicePaid('quote-x', A);

            expect(cdk.addExternalMintQuote).not.toHaveBeenCalled();
            expect(result.isPaid).toBe(false);
        });

        it('reports a legacy quote when the mint does not know it either', async () => {
            const store = newStore();
            cdk.checkExternalMintQuote.mockRejectedValue(new Error('404'));

            const result = await store.checkInvoicePaid('quote-x', A);

            expect(result).toEqual({
                isPaid: false,
                quoteState: undefined,
                isLegacy: true
            });
        });
    });

    it('rejects on other quote lookup errors', async () => {
        const store = newStore();
        cdk.checkMintQuote.mockRejectedValue(new Error('database locked'));

        await expect(store.checkInvoicePaid('quote-1', A)).rejects.toThrow(
            'database locked'
        );
        expect(cdk.checkExternalMintQuote).not.toHaveBeenCalled();
    });
});

describe('CashuStore.sendTokenCDK online', () => {
    it('sends an exact unlocked token by default and syncs balances', async () => {
        const store = newStore();

        const token = await store.sendTokenCDK(A, 1000, 'lunch');

        expect(cdk.send).toHaveBeenCalledWith(
            A,
            1000,
            'lunch',
            undefined,
            'OnlineExact',
            undefined
        );
        expect(token).toEqual(cdkToken());
        expect(store.mintBalances).toEqual({ [A]: 5000 });
        expect(store.totalBalanceSats).toBe(5000);
    });

    it('passes the send kind and tolerance through', async () => {
        const store = newStore();

        await store.sendTokenCDK(
            A,
            1000,
            undefined,
            undefined,
            undefined,
            'OnlineTolerance' as any,
            5
        );

        expect(cdk.send).toHaveBeenCalledWith(
            A,
            1000,
            undefined,
            undefined,
            'OnlineTolerance',
            5
        );
    });

    it('locks to a trimmed pubkey and forwards a set locktime', async () => {
        const store = newStore();

        await store.sendTokenCDK(A, 1000, '', `  ${PUBKEY} `, 1900000000);

        expect(cdk.send.mock.calls[0][3]).toEqual({
            kind: 'P2PK',
            data: { pubkey: PUBKEY, locktime: 1900000000 }
        });
    });

    it.each([0, undefined])('leaves out a locktime of %s', async (locktime) => {
        const store = newStore();

        await store.sendTokenCDK(A, 1000, '', PUBKEY, locktime);

        expect(cdk.send.mock.calls[0][3]).toEqual({
            kind: 'P2PK',
            data: { pubkey: PUBKEY }
        });
    });

    it('sends unlocked when the pubkey is blank', async () => {
        const store = newStore();

        await store.sendTokenCDK(A, 1000, '', '   ', 1900000000);

        expect(cdk.send.mock.calls[0][3]).toBeUndefined();
    });

    it('refuses a locked send while offline', async () => {
        const store = newStore();
        mockConnectivity.isOffline = true;

        await expect(store.sendTokenCDK(A, 1000, '', PUBKEY)).rejects.toThrow(
            'cashu.offlineSend.p2pkNotSupported'
        );
        expect(cdk.send).not.toHaveBeenCalled();
    });

    it('propagates a send failure without syncing', async () => {
        const store = newStore();
        cdk.send.mockRejectedValue(new Error('insufficient funds'));

        await expect(store.sendTokenCDK(A, 1000)).rejects.toThrow(
            'insufficient funds'
        );
        expect(cdk.getBalances).not.toHaveBeenCalled();
    });

    it('refuses to send before CDK is initialized', async () => {
        const store = newStore();
        store.cdkInitialized = false;

        await expect(store.sendTokenCDK(A, 1000)).rejects.toThrow(
            'CDK not initialized'
        );
        expect(cdk.send).not.toHaveBeenCalled();
    });
});

describe('CashuStore.mintToken online', () => {
    it('sends from the receive mint and records the sent token', async () => {
        const store = newStore();
        store.selectedMintUrl = B;
        jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

        const result = await store.mintToken({
            memo: 'lunch',
            value: '1000',
            pubkey: PUBKEY,
            lockTime: 1900000000
        });

        expect(cdk.getMintBalance).toHaveBeenCalledWith(B);
        expect(cdk.send).toHaveBeenCalledWith(
            B,
            1000,
            'lunch',
            { kind: 'P2PK', data: { pubkey: PUBKEY, locktime: 1900000000 } },
            'OnlineExact',
            undefined
        );
        expect(result!.token).toBe('cashuBtoken');
        expect(result!.decoded).toMatchObject({
            mint: B,
            memo: 'lunch',
            unit: 'sat',
            sent: true,
            spent: false,
            value: 1000,
            encodedToken: 'cashuBtoken',
            created_at: 1700000000
        });
        expect(store.sentTokens).toEqual([result!.decoded]);
        expect(storage.setItem).toHaveBeenCalledWith(
            'node1-cashu-sent-tokens',
            store.sentTokens
        );
        expect(store.mintingToken).toBe(false);
        expect(store.mintingTokenError).toBe(false);
    });

    it('records the value CDK sent, not the value asked for', async () => {
        const store = newStore();
        cdk.send.mockResolvedValue(cdkToken(1002));

        const result = await store.mintToken({ memo: '', value: '1000' });

        expect(result!.decoded.value).toBe(1002);
    });

    it('refuses an amount above the mint balance', async () => {
        const store = newStore();
        cdk.getMintBalance.mockResolvedValue(999);

        const result = await store.mintToken({ memo: '', value: '1000' });

        expect(result).toBeUndefined();
        expect(cdk.send).not.toHaveBeenCalled();
        expect(store.mintingTokenError).toBe(true);
        expect(store.mintingToken).toBe(false);
        expect(store.error_msg).toBe('stores.CashuStore.insufficientBalance');
        expect(store.sentTokens).toEqual([]);
    });

    it('shows the send error and records nothing', async () => {
        const store = newStore();
        cdk.send.mockRejectedValue(new Error('keyset inactive'));

        const result = await store.mintToken({ memo: '', value: '1000' });

        expect(result).toBeUndefined();
        expect(store.mintingTokenError).toBe(true);
        expect(store.mintingToken).toBe(false);
        expect(store.error_msg).toBe('keyset inactive');
        expect(store.sentTokens).toEqual([]);
        expect(storage.setItem).not.toHaveBeenCalled();
    });

    it('falls back to a generic message when the rejection carries nothing', async () => {
        const store = newStore();
        cdk.send.mockRejectedValue(undefined);

        await store.mintToken({ memo: '', value: '1000' });

        expect(store.error_msg).toBe('stores.CashuStore.errorMintingToken');
        expect(localeString).toHaveBeenCalledWith(
            'stores.CashuStore.errorMintingToken'
        );
    });

    it('currently drops the token when saving it fails after CDK sent it', async () => {
        const store = newStore();
        storage.setItem.mockRejectedValue(new Error('keychain full'));

        const result = await store.mintToken({ memo: '', value: '1000' });

        // CDK has already taken the proofs for this token, but the caller
        // gets no token string to share and an error instead
        expect(cdk.send).toHaveBeenCalledTimes(1);
        expect(result).toBeUndefined();
        expect(store.mintingTokenError).toBe(true);
        expect(store.error_msg).toBe('keychain full');
        // the token is still in memory until the next restart
        expect(store.sentTokens!.map((t) => t.encodedToken)).toEqual([
            'cashuBtoken'
        ]);
    });
});

describe('CashuStore.loadTransactions', () => {
    const tx = (amount: number, direction: string, state?: string) => ({
        id: `tx-${amount}`,
        direction,
        amount,
        fee: 0,
        mint_url: A,
        timestamp: 1700000000,
        ...(state ? { state } : {})
    });

    it('keeps the CDK status of incoming transactions', async () => {
        const store = newStore();
        cdk.listTransactions.mockResolvedValue([
            tx(100, 'incoming', 'Completed'),
            tx(200, 'incoming', 'Pending'),
            tx(300, 'incoming', 'Failed'),
            tx(400, 'incoming'),
            tx(500, 'outgoing', 'Failed')
        ]);

        await store.loadTransactions();

        expect(
            store.cdkInvoices.map((i) => [
                i.getAmount,
                i.state,
                i.isPaid,
                i.isExpired
            ])
        ).toEqual([
            [100, 'PAID', true, false],
            [200, 'UNPAID', false, false],
            [300, 'FAILED', false, true],
            // bridges built before the status was passed through
            [400, 'PAID', true, false]
        ]);
    });
});
