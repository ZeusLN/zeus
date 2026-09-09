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
        isValidToken: jest.fn()
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

    (CashuDevKit.isValidToken as jest.Mock).mockResolvedValue(true);

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
        expect(store.meltCDK).toHaveBeenCalledWith(MINT_URL, 'lnbc1invoice');
        expect(result).toEqual({ success: true, errorMessage: '' });
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
        expect(store.meltCDK).toHaveBeenCalledWith(MINT_URL, 'lnbc2adjusted');
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
            'stores.CashuStore.selfCustodySweepFailed'
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
