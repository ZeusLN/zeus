jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('nostr-tools', () => ({
    getPublicKey: jest.fn(),
    SimplePool: jest.fn()
}));
jest.mock('./CashuStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({}));
jest.mock('../utils/LocaleUtils', () => ({ localeString: (s: string) => s }));
jest.mock('../storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true)
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import LightningAddressStore from './LightningAddressStore';

const newStore = (settings: any = {}) =>
    new LightningAddressStore(
        {
            cashuWallets: { 'https://mint.test': { pubkey: '02ab' } }
        } as any,
        { nodeInfo: { identity_pubkey: '03cd' } } as any,
        {
            settings,
            updateSettings: jest.fn().mockResolvedValue(undefined)
        } as any
    );

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('LightningAddressStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    describe('redeemAllOpenPaymentsZaplocker', () => {
        const paid = [
            { hash: 'h1', amount_msat: 1000, comment: 'a' },
            { hash: 'h2', amount_msat: 2000, comment: 'b' },
            { hash: 'h3', amount_msat: 3000, comment: 'c' }
        ];

        it('redeems every payment with attestation checks disabled and clears redeemingAll', async () => {
            const store = newStore({
                lightningAddress: { automaticallyAcceptAttestationLevel: 0 }
            });
            store.paid = paid;
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValue(true as any);
            const lookup = jest.spyOn(store, 'lookupAttestations');
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsZaplocker();

            expect(lookup).not.toHaveBeenCalled();
            expect(redeem.mock.calls.map((c) => c[0])).toEqual([
                'h1',
                'h2',
                'h3'
            ]);
            expect(store.redeemingAll).toBe(false);
            expect(status).toHaveBeenCalledWith(true);
        });

        it('keeps going after a failed redeem and still clears redeemingAll', async () => {
            const store = newStore({
                lightningAddress: { automaticallyAcceptAttestationLevel: 0 }
            });
            store.paid = paid;
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValueOnce(true as any)
                .mockRejectedValueOnce(new Error('lookupInvoice failed'))
                .mockResolvedValueOnce(true as any);
            jest.spyOn(store, 'status').mockRejectedValue(
                new Error('server unreachable')
            );

            await store.redeemAllOpenPaymentsZaplocker();
            await flushPromises();

            expect(redeem).toHaveBeenCalledTimes(3);
            expect(store.redeemingAll).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Error redeeming payment',
                expect.any(Error)
            );
            expect(console.log).toHaveBeenCalledWith(
                'Error fetching Lightning address status',
                expect.any(Error)
            );
        });

        it('checks attestations at level 2 when the setting is missing', async () => {
            const store = newStore({ lightningAddress: {} });
            store.paid = paid;
            const lookup = jest
                .spyOn(store, 'lookupAttestations')
                .mockResolvedValueOnce({ status: 'success' } as any)
                .mockResolvedValueOnce({ status: 'error' } as any)
                .mockResolvedValueOnce({ status: 'warning' } as any);
            const redeem = jest
                .spyOn(store, 'lookupPreimageAndRedeemZaplocker')
                .mockResolvedValue(true as any);
            jest.spyOn(store, 'status').mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsZaplocker();

            expect(lookup).toHaveBeenCalledTimes(3);
            expect(redeem.mock.calls.map((c) => c[0])).toEqual(['h1', 'h3']);
            expect(store.redeemingAll).toBe(false);
        });
    });

    describe('createCashu', () => {
        const mockCreateResponse = () =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    handle: 'satoshi',
                    domain: 'zeuspay.com'
                })
            });

        it('resolves and handles a failed push credential update', async () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            mockCreateResponse();
            jest.spyOn(store, 'updatePushCredentials').mockRejectedValue(
                new Error('update failed')
            );

            await expect(
                store.createCashu('https://mint.test')
            ).resolves.toEqual({ success: true });
            await flushPromises();

            expect(store.loading).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Failed to update push credentials',
                expect.any(Error)
            );
        });
    });
});

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
