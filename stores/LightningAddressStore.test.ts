jest.mock('../stores/Stores', () => ({}));

jest.mock('../utils/LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {
        signMessage: jest.fn()
    }
}));

jest.mock('react-native-notifications', () => ({
    Notifications: {
        postLocalNotification: jest.fn()
    }
}));

jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));

jest.mock('socket.io-client', () => ({
    io: jest.fn(() => ({ connect: jest.fn(), emit: jest.fn(), on: jest.fn() }))
}));

jest.mock('../storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn(), setItem: jest.fn() }
}));

jest.mock('./CashuStore', () => ({ __esModule: true, default: class {} }));
jest.mock('./NodeInfoStore', () => ({ __esModule: true, default: class {} }));
jest.mock('./SettingsStore', () => ({ __esModule: true, default: class {} }));

import LightningAddressStore from './LightningAddressStore';

const CONFIGURED_MINT = 'https://mint.zeusnuts.com';
const LOCAL_MINT = 'https://mint.minibits.cash/Bitcoin';
const ATTACKER_MINT = 'http://attacker-mint.example:3338';

const makeStore = (configuredMintUrl?: string, localMintUrls?: string[]) => {
    const checkInvoicePaid = jest.fn().mockResolvedValue({ isPaid: false });
    const cashuStore: any = {
        checkInvoicePaid,
        deriveCashuSecretKey: jest.fn(),
        receiveTokenCDK: jest.fn(),
        mintUrls: localMintUrls
    };
    const settingsStore: any = {
        settings: {
            lightningAddress: configuredMintUrl
                ? { mintUrl: configuredMintUrl }
                : {}
        }
    };
    const nodeInfoStore: any = { nodeInfo: {} };
    const store = new LightningAddressStore(
        cashuStore,
        nodeInfoStore,
        settingsStore
    );
    return { store, checkInvoicePaid };
};

describe('LightningAddressStore.redeemCashu mint binding', () => {
    it('refuses to redeem against a mint that is not approved', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT, [
            LOCAL_MINT
        ]);

        const result = await store.redeemCashu(
            'attacker-quote-id',
            ATTACKER_MINT,
            21000,
            false,
            true
        );

        expect(result).toBe(false);
        expect(checkInvoicePaid).not.toHaveBeenCalled();
    });

    it('proceeds when the event mint matches the configured mint', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT);

        await store.redeemCashu(
            'quote-id',
            CONFIGURED_MINT,
            21000,
            false,
            true
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(checkInvoicePaid.mock.calls[0][1]).toBe(CONFIGURED_MINT);
    });

    it('matches on trailing slash or scheme/host case differences and forwards the configured spelling', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT);

        await store.redeemCashu(
            'quote-id',
            `${CONFIGURED_MINT.toUpperCase()}/`,
            21000,
            false,
            true
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(checkInvoicePaid.mock.calls[0][1]).toBe(CONFIGURED_MINT);
    });

    it('treats the URL path as case-sensitive', async () => {
        const { store, checkInvoicePaid } = makeStore(LOCAL_MINT);

        const result = await store.redeemCashu(
            'quote-id',
            'https://mint.minibits.cash/bitcoin',
            21000,
            false,
            true
        );

        expect(result).toBe(false);
        expect(checkInvoicePaid).not.toHaveBeenCalled();
    });

    it('accepts a locally added mint that differs from the configured mint and forwards the local spelling', async () => {
        const { store, checkInvoicePaid } = makeStore(CONFIGURED_MINT, [
            LOCAL_MINT
        ]);

        await store.redeemCashu(
            'quote-id',
            `${LOCAL_MINT}/`,
            21000,
            false,
            true
        );

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(checkInvoicePaid.mock.calls[0][1]).toBe(LOCAL_MINT);
    });

    it('accepts a locally added mint when no mint is configured', async () => {
        const { store, checkInvoicePaid } = makeStore(undefined, [LOCAL_MINT]);

        await store.redeemCashu('quote-id', LOCAL_MINT, 21000, false, true);

        expect(checkInvoicePaid).toHaveBeenCalledTimes(1);
        expect(checkInvoicePaid.mock.calls[0][1]).toBe(LOCAL_MINT);
    });

    it('refuses to redeem when no mint is configured or locally added', async () => {
        const { store, checkInvoicePaid } = makeStore(undefined);

        const result = await store.redeemCashu(
            'quote-id',
            CONFIGURED_MINT,
            21000,
            false,
            true
        );

        expect(result).toBe(false);
        expect(checkInvoicePaid).not.toHaveBeenCalled();
    });

    it('surfaces an error message on a manual redeem of an unapproved mint', async () => {
        const { store } = makeStore(CONFIGURED_MINT);

        const result = await store.redeemCashu(
            'quote-id',
            ATTACKER_MINT,
            21000
        );

        expect(result).toBe(false);
        expect(store.error).toBe(true);
        expect(store.error_msg).toBe(
            'stores.LightningAddressStore.Cashu.mintMismatch'
        );
    });

    it('stays silent on an automatic redeem of an unapproved mint', async () => {
        const { store } = makeStore(CONFIGURED_MINT);

        const result = await store.redeemCashu(
            'quote-id',
            ATTACKER_MINT,
            21000,
            false,
            true // localNotification: automatic socket path
        );

        expect(result).toBe(false);
        expect(store.error).toBe(false);
        expect(store.error_msg).toBe('');
    });
});
