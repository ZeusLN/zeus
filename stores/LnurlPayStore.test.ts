jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true)
}));

import Storage from '../storage';
import LnurlPayStore from './LnurlPayStore';

const successAction: any = { tag: 'message', message: 'thanks' };

describe('LnurlPayStore', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('keep', () => {
        it('stores the transaction and metadata and sets the payment state', async () => {
            const store = new LnurlPayStore({} as any, {} as any);

            await store.keep(
                'hash1',
                'zeuspay.com',
                'lnurl1',
                '[["text/plain","hi"]]',
                'deschash1',
                successAction,
                'satoshi@zeuspay.com'
            );

            expect(Storage.setItem).toHaveBeenCalledWith(
                'lnurlpay:hash1',
                expect.objectContaining({
                    paymentHash: 'hash1',
                    domain: 'zeuspay.com',
                    lnurl: 'lnurl1',
                    successAction,
                    metadata_hash: 'deschash1'
                })
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                'lnurlpay:deschash1',
                expect.objectContaining({ metadata: '[["text/plain","hi"]]' })
            );
            expect(store.paymentHash).toBe('hash1');
            expect(store.domain).toBe('zeuspay.com');
            expect(store.successAction).toBe(successAction);
            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
        });

        it('clears the lightning address of an earlier payment', async () => {
            const store = new LnurlPayStore({} as any, {} as any);

            await store.keep(
                'hash1',
                'zeuspay.com',
                'lnurl1',
                'meta',
                'deschash1',
                successAction,
                'satoshi@zeuspay.com'
            );
            await store.keep(
                'hash2',
                'example.com',
                'lnurl2',
                'meta',
                'deschash2',
                successAction
            );

            expect(store.paymentHash).toBe('hash2');
            expect(store.domain).toBe('example.com');
            expect(store.lightningAddress).toBeUndefined();
        });
    });

    describe('load', () => {
        it('returns the stored transaction with its metadata', async () => {
            (Storage.getItem as jest.Mock)
                .mockResolvedValueOnce(
                    JSON.stringify({
                        paymentHash: 'hash1',
                        metadata_hash: 'deschash1'
                    })
                )
                .mockResolvedValueOnce(JSON.stringify({ metadata: 'meta' }));
            const store = new LnurlPayStore({} as any, {} as any);

            await expect(store.load('hash1')).resolves.toEqual({
                paymentHash: 'hash1',
                metadata_hash: 'deschash1',
                metadata: { metadata: 'meta' }
            });
            expect(Storage.getItem).toHaveBeenNthCalledWith(
                1,
                'lnurlpay:hash1'
            );
            expect(Storage.getItem).toHaveBeenNthCalledWith(
                2,
                'lnurlpay:deschash1'
            );
        });

        it('returns nothing for an unknown payment hash', async () => {
            (Storage.getItem as jest.Mock).mockResolvedValueOnce(null);
            const store = new LnurlPayStore({} as any, {} as any);

            await expect(store.load('missing')).resolves.toBeNull();
            expect(Storage.getItem).toHaveBeenCalledTimes(1);
        });
    });
});
