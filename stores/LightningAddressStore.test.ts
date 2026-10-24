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
jest.mock('../utils/LocaleUtils');
jest.mock('../storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true)
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import Storage from '../storage';
import LightningAddressStore, {
    HASHES_STORAGE_STRING
} from './LightningAddressStore';

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

    describe('status', () => {
        const mockStatusResponse = (data: any) =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 200 }),
                json: () => ({
                    success: true,
                    handle: 'satoshi',
                    domain: 'zeuspay.com',
                    minimumSats: 1,
                    ...data
                })
            });

        const statusStore = () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            return store;
        };

        it('keeps open payments for a Cashu address', async () => {
            const store = statusStore();
            const paid = [
                {
                    quote_id: 'q1',
                    mint_url: 'https://mint.test',
                    amount_msat: 1000
                }
            ];
            mockStatusResponse({ addressType: 'cashu', paid });

            await store.status();

            expect(store.paid).toEqual(paid);
            expect(store.lightningAddressType).toBe('cashu');
            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
            expect(store.minimumSats).toBe(1);
            expect(store.loading).toBe(false);
        });

        it('drops held payments for a retired Zaplocker address and submits no hashes', async () => {
            const store = statusStore();
            mockStatusResponse({
                addressType: 'zaplocker',
                results: 0,
                paid: [{ hash: 'h1', amount_msat: 1000, hodl: 'lnbc1' }]
            });

            await store.status();

            expect(store.paid).toEqual([]);
            expect(store.lightningAddressType).toBe('zaplocker');
            expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledTimes(1);
            expect(
                (ReactNativeBlobUtil.fetch as jest.Mock).mock.calls[0][1]
            ).toBe('https://zeuspay.com/api/lnurl/status');
        });

        it('sets no open payments for an NWC address without a paid list', async () => {
            const store = statusStore();
            mockStatusResponse({ addressType: 'nwc' });

            await store.status();

            expect(store.paid).toEqual([]);
            expect(store.lightningAddressType).toBe('nwc');
        });

        it('records the error and rethrows when the server rejects the call', async () => {
            const store = statusStore();
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status: 400 }),
                json: () => ({ success: false, error: 'invalid signature' })
            });

            await expect(store.status()).rejects.toBe('invalid signature');

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('invalid signature');
            expect(store.loading).toBe(false);
        });
    });

    describe('redeemAllOpenPaymentsCashu', () => {
        it('redeems oldest first and only checks the mint on the last payment', async () => {
            const store = newStore();
            store.paid = [
                {
                    quote_id: 'q3',
                    mint_url: 'https://mint.test',
                    amount_msat: 3000
                },
                {
                    quote_id: 'q2',
                    mint_url: 'https://mint.test',
                    amount_msat: 2000
                },
                {
                    quote_id: 'q1',
                    mint_url: 'https://mint.test',
                    amount_msat: 1000
                }
            ];
            const redeem = jest
                .spyOn(store, 'redeemCashu')
                .mockResolvedValue(true);
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined as any);

            await store.redeemAllOpenPaymentsCashu(true);

            expect(redeem.mock.calls).toEqual([
                ['q1', 'https://mint.test', 1000, true, true, true],
                ['q2', 'https://mint.test', 2000, true, true, true],
                ['q3', 'https://mint.test', 3000, true, true, false]
            ]);
            expect(status).toHaveBeenCalledWith(true);
            expect(store.redeemingAll).toBe(false);
        });
    });

    describe('update', () => {
        const updateStore = () => {
            const store = newStore();
            jest.spyOn(store as any, 'getAuthData').mockResolvedValue({
                verification: 'v',
                signature: 's'
            });
            return store;
        };

        const mockUpdateResponse = (status: number, data: any) =>
            (ReactNativeBlobUtil.fetch as jest.Mock).mockResolvedValue({
                info: () => ({ status }),
                json: () => data
            });

        it('clears local hashes after switching address type', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true });

            await expect(
                store.update({ address_type: 'cashu' })
            ).resolves.toEqual({ success: true });

            expect(Storage.setItem).toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                ''
            );
        });

        it('still resolves if clearing local hashes fails', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true });
            (Storage.setItem as jest.Mock).mockRejectedValueOnce(
                new Error('keychain error')
            );

            await expect(
                store.update({ address_type: 'nwc' })
            ).resolves.toEqual({ success: true });
            expect(store.error).toBe(false);
        });

        it('keeps local hashes when the address type is unchanged', async () => {
            const store = updateStore();
            mockUpdateResponse(200, { success: true, handle: 'satoshi' });

            await store.update({ handle: 'satoshi' });

            expect(Storage.setItem).not.toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                expect.anything()
            );
        });

        it('keeps local hashes when the server rejects the switch', async () => {
            const store = updateStore();
            mockUpdateResponse(400, { success: false, error: 'rejected' });

            await expect(
                store.update({ address_type: 'cashu' })
            ).rejects.toEqual('rejected');

            expect(Storage.setItem).not.toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                expect.anything()
            );
            expect(store.error).toBe(true);
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

        it('does not report a redeem failure when the notification throws after /redeem succeeds', async () => {
            // the Notifications mock has no postLocalNotification, so posting throws
            const store = setup({
                checkInvoicePaid: jest.fn().mockResolvedValue({ isPaid: true })
            });
            mockRedeemResponse(200, { success: true });

            await expect(
                store.redeemCashu(QUOTE, MINT, 21000, false, true)
            ).resolves.toBe(true);

            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
            expect(store.redeeming).toBe(false);
            expect(console.log).toHaveBeenCalledWith(
                'Error posting payment notification',
                expect.any(TypeError)
            );
            expect(store.status).toHaveBeenCalledWith(true);
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
