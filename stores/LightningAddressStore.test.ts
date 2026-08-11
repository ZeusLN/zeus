jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
// NetworkUtils imports TorUtils, which loads the ESM-only native Tor module
jest.mock('../utils/TorUtils', () => ({
    doTorRequestRaw: jest.fn(),
    RequestMethod: {}
}));
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
});
