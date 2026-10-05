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

    describe('redeemCashu', () => {
        const QUOTE = 'quote-1';
        const MINT = 'https://mint.test';
        const transportError = {
            type: 'Network',
            message:
                'Http transport error None: error sending request for url (https://mint.test/v1/keysets)'
        };

        const setup = (cashuStore: any) => {
            const store = new LightningAddressStore(
                cashuStore,
                { nodeInfo: { identity_pubkey: '03cd' } } as any,
                { settings: {} } as any
            );
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            jest.spyOn(store, 'status').mockResolvedValue(undefined as any);
            return store;
        };

        const mockRedeemResponse = (status: number, body: any) =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status }),
                json: () => body
            });

        const redeem = (store: LightningAddressStore) =>
            store.redeemCashu(QUOTE, MINT, 21000, true);

        it('says the mint is unreachable and keeps the cause when the claim step has no connectivity', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockRejectedValue(transportError)
            });

            await expect(redeem(store)).resolves.toBe(true);

            expect(store.error).toBe(true);
            expect(store.redeeming).toBe(false);
            expect(store.error_msg).toBe(
                `stores.LightningAddressStore.Cashu.mintUnreachable: ${transportError.message}`
            );
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });

        it('appends the cause to the generic message for non-network claim failures', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockRejectedValue({
                    type: 'Generic',
                    message: 'Signature verification failed'
                })
            });

            await redeem(store);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quotePaymentErr: Signature verification failed'
            );
        });

        it('extracts the mint detail from a raw FFI error string', async () => {
            const store = setup({
                checkInvoicePaid: jest
                    .fn()
                    .mockRejectedValue(
                        new Error(
                            'CashuDevKit.FfiError.Cdk(code: 20001, errorMessage: "code: 20001, detail: quote not paid")'
                        )
                    )
            });

            await redeem(store);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quotePaymentErr: Quote not paid'
            );
        });

        it('keeps the ZEUS Pay /redeem error instead of overwriting it with the generic message', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true })
            });
            mockRedeemResponse(400, {
                success: false,
                error: 'Invoice is not paid'
            });

            await expect(redeem(store)).resolves.toBe(true);

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.redeemErr: Invoice is not paid'
            );
        });

        it('does not call a /redeem connectivity failure a mint outage', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true })
            });
            (ReactNativeBlobUtil.fetch as jest.Mock).mockRejectedValue(
                new Error('Unable to resolve host "zeuspay.com"')
            );

            await redeem(store);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.redeemErr: Unable to resolve host "zeuspay.com"'
            );
        });

        it('falls back to the bare prefix when /redeem fails without an error field', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true })
            });
            mockRedeemResponse(500, { success: false });

            await redeem(store);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.redeemErr'
            );
        });

        it('does not promise a retry when receiving a server token fails after /redeem', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true }),
                deriveCashuSecretKey: jest.fn().mockReturnValue(null),
                receiveTokenCDK: jest.fn().mockRejectedValue(transportError)
            });
            mockRedeemResponse(200, { success: true, token: 'cashuB...' });

            await redeem(store);

            expect(store.error_msg).toBe(
                `stores.LightningAddressStore.Cashu.quotePaymentErr: ${transportError.message}`
            );
        });

        it('clears the error state on success', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true })
            });
            mockRedeemResponse(200, { success: true });

            await expect(redeem(store)).resolves.toBe(true);

            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
            expect(store.redeeming).toBe(false);
        });

        it('reports an unpaid quote without a cause suffix', async () => {
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: false })
            });

            await redeem(store);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quoteNotPaid'
            );
            expect(ReactNativeBlobUtil.fetch).not.toHaveBeenCalled();
        });
    });
});
