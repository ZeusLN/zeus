jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(true)
}));
// The keychain-path tests run with no database; the database tests below
// supply a real one
jest.mock('../storage/Database', () => ({
    getDatabase: jest.fn().mockResolvedValue(null)
}));

import Storage from '../storage';
import { getDatabase } from '../storage/Database';
import { makeNodeSqliteDb } from '../storage/testing/nodeSqliteDb';
import { getLnurlMetadataHash } from '../utils/LnurlPayUtils';
import LnurlPayStore from './LnurlPayStore';

const successAction: any = { tag: 'message', message: 'thanks' };

describe('LnurlPayStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Storage.getItem as jest.Mock).mockReset();
        (Storage.setItem as jest.Mock).mockReset().mockResolvedValue(true);
    });

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

        it('keeps the metadata of invoices without a description hash apart', async () => {
            const stored: Record<string, any> = {};
            (Storage.setItem as jest.Mock).mockImplementation(
                async (key: string, value: any) => {
                    stored[key] = JSON.stringify(value);
                    return true;
                }
            );
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) => stored[key] ?? null
            );
            const store = new LnurlPayStore({} as any, {} as any);
            const bobMetadata = '[["text/plain","Coffee at Bob\'s"]]';
            const otherMetadata = '[["text/plain","Claim your refund"]]';

            await store.keep(
                'bobhash',
                'shops.example',
                'lnurl1',
                bobMetadata,
                '',
                successAction
            );
            // a later request that is confirmed but never paid
            await store.keep(
                'otherhash',
                'other.example',
                'lnurl2',
                otherMetadata,
                '',
                successAction
            );

            const bob = await store.load('bobhash');
            expect(bob.metadata_hash).toBe(getLnurlMetadataHash(bobMetadata));
            expect(bob.metadata?.metadata).toBe(bobMetadata);
            expect((await store.load('otherhash')).metadata?.metadata).toBe(
                otherMetadata
            );
            expect(stored).not.toHaveProperty(['lnurlpay:']);
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

        it('does not read the bare key for a record without a metadata hash', async () => {
            (Storage.getItem as jest.Mock).mockResolvedValueOnce(
                JSON.stringify({ paymentHash: 'hash1', metadata_hash: '' })
            );
            const store = new LnurlPayStore({} as any, {} as any);

            await expect(store.load('hash1')).resolves.toEqual({
                paymentHash: 'hash1',
                metadata_hash: ''
            });
            expect(Storage.getItem).toHaveBeenCalledTimes(1);
        });

        it('returns nothing for an unknown payment hash', async () => {
            (Storage.getItem as jest.Mock).mockResolvedValueOnce(null);
            const store = new LnurlPayStore({} as any, {} as any);

            await expect(store.load('missing')).resolves.toBeNull();
            expect(Storage.getItem).toHaveBeenCalledTimes(1);
        });
    });

    describe('with the database', () => {
        let db: any;

        beforeEach(async () => {
            db = makeNodeSqliteDb();
            const { migrate } = jest.requireActual('../storage/Database');
            await migrate(db);
            (getDatabase as jest.Mock).mockResolvedValue(db);
        });

        afterEach(() => {
            (getDatabase as jest.Mock).mockResolvedValue(null);
        });

        it('keeps a payment in the database and not the keychain', async () => {
            const store = new LnurlPayStore({} as any, {} as any);

            await store.keep(
                'hash1',
                'zeuspay.com',
                'lnurl1',
                '[["text/plain","hi"]]',
                'deschash1',
                successAction
            );

            expect(Storage.setItem).not.toHaveBeenCalled();
            const tx = await db.execute('SELECT * FROM lnurlpay_tx');
            expect(tx.rows).toEqual([
                expect.objectContaining({
                    payment_hash: 'hash1',
                    domain: 'zeuspay.com',
                    lnurl: 'lnurl1',
                    metadata_hash: 'deschash1',
                    success_action: JSON.stringify(successAction)
                })
            ]);
            const metadata = await db.execute(
                'SELECT * FROM lnurlpay_metadata'
            );
            expect(metadata.rows).toEqual([
                expect.objectContaining({
                    metadata_hash: 'deschash1',
                    metadata: '[["text/plain","hi"]]'
                })
            ]);
        });

        it('loads what it kept without reading the keychain', async () => {
            const store = new LnurlPayStore({} as any, {} as any);
            await store.keep(
                'hash1',
                'zeuspay.com',
                'lnurl1',
                'meta',
                'deschash1',
                successAction
            );

            const loaded = await store.load('hash1');

            expect(loaded).toEqual(
                expect.objectContaining({
                    paymentHash: 'hash1',
                    domain: 'zeuspay.com',
                    lnurl: 'lnurl1',
                    metadata_hash: 'deschash1',
                    successAction,
                    metadata: expect.objectContaining({ metadata: 'meta' })
                })
            );
            expect(Storage.getItem).not.toHaveBeenCalled();
        });

        it('falls back to the keychain and copies the record in', async () => {
            const keychainTx = {
                paymentHash: 'old1',
                domain: 'old.example',
                lnurl: 'lnurl-old',
                metadata_hash: 'oldmeta',
                successAction,
                time: 1000
            };
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) =>
                    key === 'lnurlpay:old1'
                        ? JSON.stringify(keychainTx)
                        : key === 'lnurlpay:oldmeta'
                        ? JSON.stringify({ metadata: 'm', last_stored: 1000 })
                        : false
            );
            const store = new LnurlPayStore({} as any, {} as any);

            const loaded = await store.load('old1');

            expect(loaded).toEqual({
                ...keychainTx,
                metadata: { metadata: 'm', last_stored: 1000 }
            });
            expect(
                (await db.execute('SELECT payment_hash, time FROM lnurlpay_tx'))
                    .rows
            ).toEqual([{ payment_hash: 'old1', time: 1000 }]);
            expect(
                (await db.execute('SELECT * FROM lnurlpay_metadata')).rows
            ).toEqual([
                { metadata_hash: 'oldmeta', metadata: 'm', last_stored: 1000 }
            ]);

            // the next load is served from the database
            (Storage.getItem as jest.Mock).mockClear();
            expect(await store.load('old1')).toEqual(loaded);
            expect(Storage.getItem).not.toHaveBeenCalled();
        });

        it('does not overwrite a database row with an older keychain copy', async () => {
            await db.execute(
                "INSERT INTO lnurlpay_metadata VALUES ('shared', 'newer', 2000)"
            );
            (Storage.getItem as jest.Mock).mockImplementation(
                async (key: string) =>
                    key === 'lnurlpay:old2'
                        ? JSON.stringify({
                              paymentHash: 'old2',
                              metadata_hash: 'shared',
                              time: 1000
                          })
                        : key === 'lnurlpay:shared'
                        ? JSON.stringify({ metadata: 'older', last_stored: 1 })
                        : false
            );
            const store = new LnurlPayStore({} as any, {} as any);

            await store.load('old2');

            expect(
                (await db.execute('SELECT metadata FROM lnurlpay_metadata'))
                    .rows
            ).toEqual([{ metadata: 'newer' }]);
        });

        it('keeps the payment in the keychain when the database write fails', async () => {
            const failing = {
                ...db,
                transaction: jest.fn().mockRejectedValue(new Error('full'))
            };
            (getDatabase as jest.Mock).mockResolvedValue(failing);
            jest.spyOn(console, 'warn').mockImplementationOnce(() => {});
            const store = new LnurlPayStore({} as any, {} as any);

            await store.keep(
                'hash1',
                'zeuspay.com',
                'lnurl1',
                'meta',
                'deschash1',
                successAction
            );

            expect(Storage.setItem).toHaveBeenCalledWith(
                'lnurlpay:hash1',
                expect.objectContaining({ paymentHash: 'hash1' })
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                'lnurlpay:deschash1',
                expect.objectContaining({ metadata: 'meta' })
            );
        });

        it('returns nothing for a hash in neither store', async () => {
            (Storage.getItem as jest.Mock).mockResolvedValue(false);
            const store = new LnurlPayStore({} as any, {} as any);

            await expect(store.load('missing')).resolves.toBeFalsy();
            expect(
                (await db.execute('SELECT count(*) AS n FROM lnurlpay_tx'))
                    .rows[0].n
            ).toBe(0);
        });
    });
});
