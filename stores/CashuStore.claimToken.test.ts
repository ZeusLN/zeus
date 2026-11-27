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
        getMintKeysets: jest.fn(),
        getUnspentProofs: jest.fn(),
        getMintBalance: jest.fn(),
        createMeltQuote: jest.fn(),
        melt: jest.fn()
    }
}));

import CashuDevKit from '../cashu-cdk';
import CashuToken from '../models/CashuToken';
import CashuStore from './CashuStore';

const MINT_URL = 'https://mint.example.com';
const ENCODED_TOKEN = 'cashuBo2FteBpodHRwczovL21pbnQ';
const TOKEN_AMT = 1000;

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

const FEE_KEYSET = '00fee0000000000a';

// A mint charging input_fee_ppk = 1000 (1 sat per proof)
const mockFeeMint = (proofAmounts: number[], ppk = 1000) => {
    (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([
        { id: FEE_KEYSET, unit: 'sat', active: true, input_fee_ppk: ppk }
    ]);
    (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue(
        proofAmounts.map((amount, i) => ({
            amount,
            secret: `s${i}`,
            C: `c${i}`,
            keyset_id: FEE_KEYSET,
            y: `y${i}`
        }))
    );
};

// Proofs the wallet holds after receiving 994 sats: 512+256+128+64+32+2
const RECEIVED_994_PROOFS = [512, 256, 128, 64, 32, 2];

const makeStore = () => {
    const invoicesStore = {
        createInvoice: jest.fn()
    };
    const store = new CashuStore(
        {} as any,
        invoicesStore as any,
        { channels: [] } as any,
        {} as any
    );
    store.cdkInitialized = true;
    store.receiveTokenCDK = jest.fn();
    store.createMeltQuoteCDK = jest.fn();
    store.meltCDK = jest.fn();
    store.syncCDKBalances = jest.fn();
    // payment proof has its own tests in CashuStore.test.ts
    (store as any).isOwnInvoicePaid = jest.fn().mockResolvedValue(true);

    (CashuDevKit.isValidToken as jest.Mock).mockResolvedValue(true);
    (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([]);
    (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue([]);

    return { store, invoicesStore };
};

describe('CashuStore.claimToken toSelfCustody', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
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
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: TOKEN_AMT
        });

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
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 0
        });
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(TOKEN_AMT);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).toHaveBeenCalledTimes(1);
        expect(invoicesStore.createInvoice).toHaveBeenCalledTimes(1);
        expect(store.meltCDK).toHaveBeenCalledWith(MINT_URL, 'lnbc1invoice', 0);
        expect(result).toEqual({
            success: true,
            errorMessage: '',
            receivedAmtSat: TOKEN_AMT
        });
    });

    it('sizes the sweep from the actually received amount, not token face value', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice
            .mockResolvedValueOnce({ paymentRequest: 'lnbc1invoice' })
            .mockResolvedValueOnce({ paymentRequest: 'lnbc2adjusted' });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 2
        });
        // Mint charged 10 sats of input fees on the receive swap
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(TOKEN_AMT - 10);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(invoicesStore.createInvoice).toHaveBeenCalledTimes(2);
        expect(invoicesStore.createInvoice.mock.calls[1][0].value).toBe('988');
        expect(store.meltCDK).toHaveBeenCalledWith(
            MINT_URL,
            'lnbc2adjusted',
            2
        );
        expect(result.success).toBe(true);
    });

    it('reports a warning, not a failure, when the sweep fails after the token was received', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 0
        });
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(TOKEN_AMT);
        (store.meltCDK as jest.Mock).mockRejectedValue(
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
            'stores.CashuStore.claimedButNotSwept'
        );
    });

    it('still maps a spent token to the alreadySpent error', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 0
        });
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

describe('CashuStore.claimToken toSelfCustody on a mint with input fees', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('leaves room for the melt input fees when sizing the sweep', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice
            .mockResolvedValueOnce({ paymentRequest: 'lnbc1invoice' })
            .mockResolvedValueOnce({ paymentRequest: 'lnbc2adjusted' });
        const feeReserve = 19;
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: feeReserve
        });
        // The receive swap paid 6 sats of input fees
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(994);
        mockFeeMint(RECEIVED_994_PROOFS);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(CashuDevKit.getMintKeysets).toHaveBeenCalledWith(MINT_URL);
        const sweepAmt = Number(
            invoicesStore.createInvoice.mock.calls[1][0].value
        );
        // Swap fee on the 6 held proofs plus the melt fee on at most 10
        // proofs (bit length of 994) must still fit in the balance.
        // Before the fix the sweep was 975 and CDK returned
        // InsufficientFunds.
        expect(sweepAmt).toBe(994 - feeReserve - 16);
        expect(sweepAmt + feeReserve + 16).toBeLessThanOrEqual(994);
        expect(store.meltCDK).toHaveBeenCalledWith(
            MINT_URL,
            'lnbc2adjusted',
            feeReserve
        );
        expect(result).toEqual({
            success: true,
            errorMessage: '',
            receivedAmtSat: sweepAmt
        });
    });

    it('warns instead of melting when input fees eat the whole received amount', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 2
        });
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(7);
        mockFeeMint([4, 2, 1]);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.meltCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.warningMessage).toBe(
            'stores.CashuStore.claimedButNotSwept'
        );
    });

    it('does not consume the token when input fees exceed its amount', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 0
        });
        // 990 held proofs + 10 melt proofs (bit length of 1000) at 1 sat
        // each leave nothing to sweep
        mockFeeMint(new Array(990).fill(1));

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('stores.CashuStore.feeExceedsAmt');
    });

    it('does not consume the token when the input fee estimate fails', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice.mockResolvedValue({
            paymentRequest: 'lnbc1invoice'
        });
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 0
        });
        (CashuDevKit.getMintKeysets as jest.Mock).mockRejectedValue(
            new Error('keysets unavailable')
        );

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
    });

    it('warns when the fee-adjusted invoice cannot be created after the receive', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice
            .mockResolvedValueOnce({ paymentRequest: 'lnbc1invoice' })
            .mockRejectedValueOnce(new Error('node offline'));
        (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
            fee_reserve: 2
        });
        (store.receiveTokenCDK as jest.Mock).mockResolvedValue(994);
        mockFeeMint(RECEIVED_994_PROOFS);

        const result = await store.claimToken(
            ENCODED_TOKEN,
            makeDecoded(),
            true
        );

        expect(store.receiveTokenCDK).toHaveBeenCalledTimes(1);
        expect(store.meltCDK).not.toHaveBeenCalled();
        expect(result).toEqual({
            success: true,
            errorMessage: '',
            warningMessage: 'stores.CashuStore.claimedButNotSwept'
        });
    });

    it.each([
        ['getMintKeysets', CashuDevKit.getMintKeysets],
        ['getUnspentProofs', CashuDevKit.getUnspentProofs]
    ])(
        'warns when %s fails in the fee estimate after the receive',
        async (_name, method) => {
            const { store, invoicesStore } = makeStore();
            invoicesStore.createInvoice.mockResolvedValue({
                paymentRequest: 'lnbc1invoice'
            });
            (store.createMeltQuoteCDK as jest.Mock).mockResolvedValue({
                fee_reserve: 2
            });
            (store.receiveTokenCDK as jest.Mock).mockResolvedValue(994);
            mockFeeMint(RECEIVED_994_PROOFS);
            // The pre-receive estimate succeeds, the one after fails
            (method as jest.Mock)
                .mockImplementationOnce(
                    (method as jest.Mock).getMockImplementation()!
                )
                .mockRejectedValueOnce(new Error('database locked'));

            const result = await store.claimToken(
                ENCODED_TOKEN,
                makeDecoded(),
                true
            );

            expect(store.receiveTokenCDK).toHaveBeenCalledTimes(1);
            expect(store.meltCDK).not.toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                errorMessage: '',
                warningMessage: 'stores.CashuStore.claimedButNotSwept'
            });
        }
    );
});

describe('CashuStore.estimateMeltInputFee', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rounds the swap and melt fees separately', async () => {
        const { store } = makeStore();
        mockFeeMint([1024], 50);

        // Separate mint requests each charge at least one sat.
        await expect(store.estimateMeltInputFee(MINT_URL, 1024)).resolves.toBe(
            2
        );
    });

    it('ignores active keysets in other currency units', async () => {
        const { store } = makeStore();
        (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([
            { id: FEE_KEYSET, unit: 'sat', active: true, input_fee_ppk: 0 },
            { id: 'usd-keyset', unit: 'usd', active: true, input_fee_ppk: 1000 }
        ]);
        (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue([
            { amount: 1024, keyset_id: FEE_KEYSET }
        ]);

        await expect(store.estimateMeltInputFee(MINT_URL, 1024)).resolves.toBe(
            0
        );
    });

    it('is zero without fetching proofs when no keyset charges fees', async () => {
        const { store } = makeStore();
        (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([
            { id: 'a', unit: 'sat', active: true, input_fee_ppk: 0 },
            { id: 'b', unit: 'sat', active: false }
        ]);

        await expect(store.estimateMeltInputFee(MINT_URL, 994)).resolves.toBe(
            0
        );
        expect(CashuDevKit.getUnspentProofs).not.toHaveBeenCalled();
    });

    it('bounds swap and melt input fees at 1 sat per proof', async () => {
        const { store } = makeStore();
        mockFeeMint(RECEIVED_994_PROOFS);

        // 6 held proofs + 10 melt proofs
        await expect(store.estimateMeltInputFee(MINT_URL, 994)).resolves.toBe(
            16
        );
    });

    it('rounds fractional swap and melt fees up separately', async () => {
        const { store } = makeStore();
        mockFeeMint([64, 32, 1], 100);

        // swap: 3 * 100 = 300 ppk -> 1 sat, melt: 7 * 100 = 700 ppk -> 1
        // sat. Rounding the 1000 ppk sum once gives 1, and a sweep sized
        // on that fails with InsufficientFunds.
        await expect(store.estimateMeltInputFee(MINT_URL, 97)).resolves.toBe(2);
    });

    it('charges proofs from unknown keysets at the active keyset rate', async () => {
        const { store } = makeStore();
        (CashuDevKit.getMintKeysets as jest.Mock).mockResolvedValue([
            { id: 'old', unit: 'sat', active: false, input_fee_ppk: 0 },
            { id: FEE_KEYSET, unit: 'sat', active: true, input_fee_ppk: 1000 }
        ]);
        (CashuDevKit.getUnspentProofs as jest.Mock).mockResolvedValue([
            { amount: 8, keyset_id: 'old' },
            { amount: 4, keyset_id: 'gone' }
        ]);

        // old: 0, gone: 1000, melt: 4 proofs (bit length of 12) * 1000
        await expect(store.estimateMeltInputFee(MINT_URL, 12)).resolves.toBe(5);
    });
});

describe('CashuStore.sweepMint on a mint with input fees', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('sizes the auto-sweep invoice net of fee reserve and input fees', async () => {
        const { store, invoicesStore } = makeStore();
        invoicesStore.createInvoice
            .mockResolvedValueOnce({ paymentRequest: 'lnbc1probe' })
            .mockResolvedValueOnce({ paymentRequest: 'lnbc2final' });
        (CashuDevKit.getMintBalance as jest.Mock).mockResolvedValue(994);
        (CashuDevKit.createMeltQuote as jest.Mock)
            .mockResolvedValueOnce({ id: 'q1', fee_reserve: 19 })
            .mockResolvedValueOnce({ id: 'q2', fee_reserve: 19 });
        (CashuDevKit.melt as jest.Mock).mockResolvedValue({ state: 'Paid' });
        mockFeeMint(RECEIVED_994_PROOFS);

        await expect(store.sweepMint(MINT_URL)).resolves.toBe(true);

        expect(invoicesStore.createInvoice.mock.calls[1][0].value).toBe(
            String(994 - 19 - 16)
        );
        expect(CashuDevKit.melt).toHaveBeenCalledWith(MINT_URL, 'q2');
    });
});
