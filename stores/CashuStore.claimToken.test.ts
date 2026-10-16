jest.mock('../stores/Stores', () => ({
    activityStore: {},
    connectivityStore: {
        isOffline: false,
        start: jest.fn(),
        onReconnect: jest.fn()
    }
}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('../utils/MigrationUtils', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('../utils/NostrMintBackup', () => ({
    deriveMintBackupKeypair: jest.fn(),
    backupMintsToNostr: jest.fn(),
    restoreMintsFromNostr: jest.fn()
}));

jest.mock('../utils/NostrUtils', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('@nostr-dev-kit/ndk', () => ({
    __esModule: true,
    default: class NDK {},
    NDKEvent: class NDKEvent {},
    NDKKind: {}
}));

jest.mock('react-native-blob-util', () => ({}));

jest.mock('../NavigationService', () => ({
    __esModule: true,
    default: {}
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
    }
}));

jest.mock('./SettingsStore', () => ({
    __esModule: true,
    default: class SettingsStore {},
    DEFAULT_NOSTR_RELAYS: []
}));

jest.mock('../cashu-cdk', () => ({
    __esModule: true,
    default: {
        isValidToken: jest.fn(),
        melt: jest.fn(),
        getMintKeysets: jest.fn(),
        getUnspentProofs: jest.fn(),
        getMintBalance: jest.fn(),
        removeMint: jest.fn(),
        listTransactions: jest.fn()
    }
}));

import CashuDevKit from '../cashu-cdk';
import Storage from '../storage';
import CashuToken from '../models/CashuToken';
import CashuStore from './CashuStore';

const MINT_URL = 'https://mint.example.com';
const DEST_MINT_URL = 'https://dest.example.com';
const ENCODED_TOKEN = 'cashuBo2FteBpodHRwczovL21pbnQ';
const TOKEN_AMT = 1000;
const SECRET_KEY = 'aa'.repeat(32);

const makeDecoded = () =>
    new CashuToken({
        mint: MINT_URL,
        unit: 'sat',
        proofs: [
            {
                amount: TOKEN_AMT,
                secret: 'plain-secret',
                id: '009a1f293253e41e'
            }
        ]
    });

// Invoices and mint quotes encode their amount so melt quotes can echo it
const amountOf = (bolt11: string) => Number(bolt11.split('-').pop());

const makeStore = ({ knownMints = [DEST_MINT_URL] } = {}) => {
    const invoicesStore = {
        createInvoice: jest.fn(async ({ value }: { value: string }) => ({
            paymentRequest: `lnbc-${value}`
        }))
    };
    const store = new CashuStore(
        {} as any,
        invoicesStore as any,
        { channels: [] } as any,
        {} as any
    );
    store.cdkInitialized = true;
    store.mintUrls = [...knownMints];
    store.invoices = [];
    store.getNodeDir = () => 'lnd';
    store.receiveTokenCDK = jest.fn().mockResolvedValue(TOKEN_AMT);
    store.createMeltQuoteCDK = jest.fn(async (_mintUrl, bolt11) => ({
        id: `melt-${bolt11}`,
        amount: amountOf(bolt11),
        fee_reserve: 0
    })) as any;
    store.createMintQuoteCDK = jest.fn(async (_mintUrl, amount) => ({
        id: `mint-quote-${amount}`,
        request: `lnbc-${amount}`,
        state: 'Unpaid',
        expiry: 0
    })) as any;
    store.checkInvoicePaid = jest.fn().mockResolvedValue({ isPaid: true });
    store.syncCDKBalances = jest.fn();
    store.addMint = jest.fn();
    store.deriveCashuSecretKey = jest.fn(() => SECRET_KEY);

    (CashuDevKit.isValidToken as jest.Mock).mockResolvedValue(true);
    (CashuDevKit.melt as jest.Mock).mockResolvedValue({ state: 'Paid' });
    (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([]);
    (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue([]);
    (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(0);

    return { store, invoicesStore };
};

const withFeeReserve = (store: CashuStore, ...fees: number[]) => {
    const quote = store.createMeltQuoteCDK as jest.Mock;
    const impl = quote.getMockImplementation()!;
    fees.forEach((fee) =>
        quote.mockImplementationOnce(async (...args: any[]) => ({
            ...(await impl(...args)),
            fee_reserve: fee
        }))
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    CashuStore.TOKEN_SWAP_POLL_MS = 0;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('CashuStore.claimToken toSelfCustody', () => {
    it('does not consume the token when invoice creation fails', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockRejectedValue(
            new Error('error creating invoice')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.warningMessage).toBeUndefined();
    });

    it('does not consume the token when the melt fee probe fails', async () => {
        const { store } = makeStore();
        (store.createMeltQuoteCDK as jest.Mock).mockRejectedValue(
            new Error('mint unreachable')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('mint unreachable');
    });

    it('does not consume the token when fees exceed its amount', async () => {
        const { store } = makeStore();
        withFeeReserve(store, TOKEN_AMT);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('stores.CashuStore.feeExceedsAmt');
    });

    it('receives then melts the full amount when there is no fee reserve', async () => {
        const { store, invoicesStore } = makeStore();

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).toHaveBeenCalledTimes(1);
        // The probe invoice is reused when the amount does not change
        expect(invoicesStore.createInvoice).toHaveBeenCalledTimes(1);
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            MINT_URL,
            `melt-lnbc-${TOKEN_AMT}`
        );
        expect(result).toEqual({ success: true, errorMessage: '' });
    });

    it('sizes the sweep from the actually received amount, not token face value', async () => {
        const { store, invoicesStore } = makeStore();
        withFeeReserve(store, 2, 2);
        // Mint charged 10 sats of input fees on the receive swap
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(TOKEN_AMT - 10);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(invoicesStore.createInvoice).toHaveBeenCalledTimes(2);
        expect(invoicesStore.createInvoice.mock.calls[1][0].value).toBe('988');
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            MINT_URL,
            'melt-lnbc-988'
        );
        expect(result.success).toBe(true);
    });

    it('reports a warning, not a failure, when the sweep fails at a known mint', async () => {
        const { store } = makeStore({ knownMints: [MINT_URL] });
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('Payment failed')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        // The receive succeeded, so the value is in the wallet's mint
        // balance; surfacing this as an error invites a retry that can
        // only fail with "token already spent"
        expect(result.success).toBe(true);
        expect(result.errorMessage).toBe('');
        expect(result.warningMessage).toBe(
            'stores.CashuStore.selfCustodySweepFailed'
        );
        expect(store.addMint).not.toHaveBeenCalled();
    });

    it('adds an unknown mint when the sweep fails, so the balance is not stranded', async () => {
        const { store } = makeStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('Payment failed')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.addMint).toHaveBeenCalledWith(MINT_URL);
        expect(result.success).toBe(true);
        expect(result.warningMessage).toBe(
            'stores.CashuStore.transitFailedMintAdded'
        );
    });

    it('still maps a spent token to the alreadySpent error', async () => {
        const { store } = makeStore();
        (store.receiveTokenCDK as jest.Mock).mockRejectedValue(
            new Error('Token already spent')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('stores.CashuStore.alreadySpent');
    });
});

describe('CashuStore token swap to another mint', () => {
    it('quotes without touching the token and rejects fees over the amount', async () => {
        const { store } = makeStore();
        withFeeReserve(store, TOKEN_AMT);

        await expect(
            store.quoteTokenSwap(makeDecoded(), DEST_MINT_URL)
        ).rejects.toThrow('stores.CashuStore.feeExceedsAmt');
        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
    });

    it('returns the fee reserve and estimated amount from the quote', async () => {
        const { store } = makeStore();
        withFeeReserve(store, 4);

        const quote = await store.quoteTokenSwap(makeDecoded(), DEST_MINT_URL);

        expect(store.createMintQuoteCDK).toHaveBeenCalledWith(
            DEST_MINT_URL,
            TOKEN_AMT
        );
        expect(store.createMeltQuoteCDK).toHaveBeenCalledWith(
            MINT_URL,
            `lnbc-${TOKEN_AMT}`
        );
        expect(quote).toEqual({ feeReserve: 4, estimatedReceive: 996 });
    });

    it('receives, melts into a saved destination quote, then mints', async () => {
        const { store } = makeStore();
        withFeeReserve(store, 2);

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            2
        );

        expect(store.receiveTokenCDK).toHaveBeenCalledWith(
            ENCODED_TOKEN,
            SECRET_KEY,
            MINT_URL
        );
        expect(store.createMintQuoteCDK).toHaveBeenCalledWith(
            DEST_MINT_URL,
            998,
            'views.Cashu.CashuToken.tokenSwap'
        );
        expect(store.invoices?.map((i) => i.quote)).toEqual(['mint-quote-998']);
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            MINT_URL,
            'melt-lnbc-998'
        );
        expect(store.checkInvoicePaid).toHaveBeenCalledWith(
            'mint-quote-998',
            DEST_MINT_URL
        );
        expect(CashuDevKit.removeMint).toHaveBeenCalledWith(MINT_URL);
        expect(result).toEqual({
            success: true,
            errorMessage: '',
            warningMessage: undefined,
            leftoverSats: undefined
        });
    });

    it('lowers the amount once when the final quote reserves more', async () => {
        const { store } = makeStore();
        withFeeReserve(store, 5, 5);

        await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            2
        );

        expect(
            (store.createMintQuoteCDK as jest.Mock).mock.calls.map((c) => c[1])
        ).toEqual([998, 995]);
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            MINT_URL,
            'melt-lnbc-995'
        );
    });

    it('subtracts the input fee for spending the received proofs', async () => {
        const { store } = makeStore();
        (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([
            { id: 'ks', unit: 'sat', active: true, input_fee_ppk: 100 }
        ]);
        (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue(
            Array.from({ length: 12 }, () => ({ keyset_id: 'ks' }))
        );

        await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        // 12 proofs x 100 ppk = 1.2 sats, rounded up to 2
        expect(CashuDevKit.melt).toHaveBeenCalledWith(
            MINT_URL,
            'melt-lnbc-998'
        );
    });

    it('adds the token mint and warns when the melt fails after receive', async () => {
        const { store } = makeStore();
        (CashuDevKit.melt as jest.Mock).mockRejectedValue(
            new Error('no route')
        );

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        expect(store.addMint).toHaveBeenCalledWith(MINT_URL);
        expect(store.checkInvoicePaid).not.toHaveBeenCalled();
        expect(CashuDevKit.removeMint).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.warningMessage).toBe(
            'stores.CashuStore.transitFailedMintAdded'
        );
    });

    it('keeps the token mint when the melt is still pending', async () => {
        const { store } = makeStore();
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({
            state: 'Pending'
        });

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        expect(store.addMint).toHaveBeenCalledWith(MINT_URL);
        expect(result.warningMessage).toBe('stores.CashuStore.transitPending');
    });

    it('leaves the saved quote for later when the destination has not issued yet', async () => {
        const { store } = makeStore();
        (store.checkInvoicePaid as jest.Mock).mockResolvedValue({
            isPaid: false
        });

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        expect(store.checkInvoicePaid).toHaveBeenCalledTimes(
            CashuStore.TOKEN_SWAP_POLL_ATTEMPTS
        );
        expect(store.invoices).toHaveLength(1);
        expect(result.success).toBe(true);
        expect(result.warningMessage).toBe('stores.CashuStore.swapProcessing');
    });

    it('reports sats left at the token mint by an unused fee reserve', async () => {
        const { store } = makeStore();
        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(3);

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        expect(result.leftoverSats).toBe(3);
        expect(CashuDevKit.removeMint).toHaveBeenCalledWith(MINT_URL);
    });

    it('does not touch the token when it is already spent', async () => {
        const { store } = makeStore();
        (store.receiveTokenCDK as jest.Mock).mockRejectedValue(
            new Error('Token already spent')
        );

        const result = await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );

        expect(CashuDevKit.melt).not.toHaveBeenCalled();
        expect(store.addMint).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('stores.CashuStore.alreadySpent');
    });

    it('hides incoming activity at a transit mint until the user adds it', async () => {
        const { store } = makeStore();
        await store.swapTokenToMint(
            ENCODED_TOKEN,
            makeDecoded(),
            DEST_MINT_URL,
            0
        );
        expect(Storage.setItem).toHaveBeenCalledWith(
            'lnd-cashu-transitMints',
            JSON.stringify([MINT_URL])
        );

        (CashuDevKit.listTransactions as jest.Mock).mockResolvedValue([
            { id: 'a', direction: 'incoming', mint_url: `${MINT_URL}/` },
            { id: 'b', direction: 'incoming', mint_url: DEST_MINT_URL }
        ]);
        await store.loadTransactions();
        expect(store.cdkInvoices.map((i) => i.quote)).toEqual(['b']);

        store.mintUrls = [DEST_MINT_URL, MINT_URL];
        await store.loadTransactions();
        expect(store.cdkInvoices.map((i) => i.quote)).toEqual(['a', 'b']);
    });

    it('discards a quoted mint only when it is unknown and empty', async () => {
        const { store } = makeStore();

        await store.discardTransitMint(DEST_MINT_URL);
        expect(CashuDevKit.removeMint).not.toHaveBeenCalled();

        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValueOnce(5);
        await store.discardTransitMint(MINT_URL);
        expect(CashuDevKit.removeMint).not.toHaveBeenCalled();

        await store.discardTransitMint(MINT_URL);
        expect(CashuDevKit.removeMint).toHaveBeenCalledWith(MINT_URL);
    });
});
