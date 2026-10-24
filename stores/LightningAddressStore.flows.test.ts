jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('react-native-notifications', () => ({
    Notifications: { postLocalNotification: jest.fn() }
}));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./CashuStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { signMessage: jest.fn() }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn()
}));

import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { Notifications } from 'react-native-notifications';
import { io } from 'socket.io-client';

import BackendUtils from '../utils/BackendUtils';
import * as LocaleUtils from '../utils/LocaleUtils';
import Storage from '../storage';
import LightningAddressStore, {
    ADDRESS_ACTIVATED_STRING,
    HASHES_STORAGE_STRING
} from './LightningAddressStore';

const HOST = 'https://zeuspay.com';
const MINT = 'https://mint.test';
const NODE_PUBKEY = '03cd';
// The server issues 64 random bytes as lowercase hex
const CHALLENGE = 'c0'.repeat(64);
const FIRST = 'f1'.repeat(64);
const SECOND = '5e'.repeat(64);
const V = 'ab'.repeat(64);
const CANONICAL_PHRASE =
    'DO NOT EVER SIGN THIS TEXT WITH YOUR PRIVATE KEYS! IT IS ONLY USED FOR DERIVATION OF LNURL-AUTH HASHING-KEY, DISCLOSING ITS SIGNATURE WILL COMPROMISE YOUR LNURL-AUTH IDENTITY AND MAY LEAD TO LOSS OF FUNDS!';

const fetchMock = ReactNativeBlobUtil.fetch as jest.Mock;
const signMessage = BackendUtils.signMessage as jest.Mock;
const postLocalNotification = Notifications.postLocalNotification as jest.Mock;
const ioMock = io as jest.Mock;

type Reply = { status?: number; body?: any } | Error;

// Routes ReactNativeBlobUtil.fetch by API path. Paths without a reply
// answer 404 so an unexpected call fails loudly.
let replies: { [path: string]: Reply[] };
const reply = (path: string, ...r: Reply[]) => {
    replies[path] = (replies[path] || []).concat(r);
};
const ok = (body: any = {}) => ({
    status: 200,
    body: { success: true, ...body }
});

const callsTo = (path: string) =>
    fetchMock.mock.calls.filter(([, url]) => url === `${HOST}${path}`);
const bodyOf = (path: string, index = 0) => JSON.parse(callsTo(path)[index][3]);

const newCashuStore = () => ({
    cashuWallets: { [MINT]: { pubkey: '02ab' } } as any,
    initializeWallet: jest.fn(),
    checkInvoicePaid: jest.fn(),
    deriveCashuSecretKey: jest.fn(),
    receiveTokenCDK: jest.fn()
});

let cashuStore: ReturnType<typeof newCashuStore>;
let settingsStore: { settings: any; updateSettings: jest.Mock };

const newStore = () =>
    new LightningAddressStore(
        cashuStore as any,
        { nodeInfo: { identity_pubkey: NODE_PUBKEY } } as any,
        settingsStore as any
    );

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('LightningAddressStore flows', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (Platform as any).OS = 'ios';

        replies = {};
        fetchMock.mockImplementation(async (_m, url: string) => {
            const path = url.replace(HOST, '');
            const next = replies[path]?.shift() ?? {
                status: 404,
                body: { error: `no reply for ${path}` }
            };
            if (next instanceof Error) throw next;
            return {
                info: () => ({ status: next.status ?? 200 }),
                json: () => next.body
            };
        });
        signMessage.mockResolvedValue({ zbase: 'zsig' });
        (Storage.setItem as jest.Mock).mockResolvedValue(true);

        cashuStore = newCashuStore();
        cashuStore.initializeWallet.mockResolvedValue(undefined);
        cashuStore.deriveCashuSecretKey.mockReturnValue('cashu-key');
        cashuStore.receiveTokenCDK.mockResolvedValue(undefined);
        settingsStore = {
            settings: {},
            updateSettings: jest.fn().mockResolvedValue(undefined)
        };
    });

    afterEach(() => jest.restoreAllMocks());

    describe('auth', () => {
        it('signs the server challenge and sends it with the next call', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: CHALLENGE }));
            reply('/api/plus/order', ok());

            await store.createZeusPayPlusOrder();

            expect(bodyOf('/api/lnurl/auth')).toEqual({
                pubkey: NODE_PUBKEY
            });
            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(bodyOf('/api/plus/order')).toEqual({
                pubkey: NODE_PUBKEY,
                message: CHALLENGE,
                signature: 'zsig'
            });
        });

        it('uses the plain signature when the backend returns no zbase', async () => {
            const store = newStore();
            signMessage.mockResolvedValue({ signature: 'hexsig' });
            reply('/api/lnurl/auth', ok({ verification: CHALLENGE }));
            reply('/api/plus/order', ok());

            await store.createZeusPayPlusOrder();

            expect(bodyOf('/api/plus/order').signature).toBe('hexsig');
        });

        it('reuses the signature for 10 minutes, then signs a new challenge', async () => {
            const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
            const store = newStore();
            signMessage
                .mockResolvedValueOnce({ zbase: 'sig-first' })
                .mockResolvedValueOnce({ zbase: 'sig-second' });
            reply(
                '/api/lnurl/auth',
                ok({ verification: FIRST }),
                ok({ verification: SECOND })
            );
            reply('/api/plus/order', ok(), ok(), ok());

            await store.createZeusPayPlusOrder();
            now.mockReturnValue(1_000_000 + 10 * 60 * 1000 - 1);
            await store.createZeusPayPlusOrder();

            expect(callsTo('/api/lnurl/auth')).toHaveLength(1);
            expect(signMessage).toHaveBeenCalledTimes(1);
            expect(bodyOf('/api/plus/order', 1)).toMatchObject({
                message: FIRST,
                signature: 'sig-first'
            });

            now.mockReturnValue(1_000_000 + 10 * 60 * 1000 + 1);
            await store.createZeusPayPlusOrder();

            expect(callsTo('/api/lnurl/auth')).toHaveLength(2);
            expect(signMessage).toHaveBeenCalledTimes(2);
            expect(signMessage).toHaveBeenLastCalledWith(SECOND);
            expect(bodyOf('/api/plus/order', 2)).toMatchObject({
                message: SECOND,
                signature: 'sig-second'
            });
        });

        it('signs a new challenge after reset', async () => {
            const store = newStore();
            reply(
                '/api/lnurl/auth',
                ok({ verification: FIRST }),
                ok({ verification: SECOND })
            );
            reply('/api/plus/order', ok(), ok());

            await store.createZeusPayPlusOrder();
            store.reset();
            await store.createZeusPayPlusOrder();

            expect(callsTo('/api/lnurl/auth')).toHaveLength(2);
            expect(bodyOf('/api/plus/order', 1).message).toBe(SECOND);
        });

        it.each([
            ['the LNURL-auth canonical phrase', CANONICAL_PHRASE],
            ['uppercase hex', CHALLENGE.toUpperCase()],
            ['hex of the wrong length', 'c0'.repeat(32)],
            ['a non-hex string', 'challenge'],
            ['a non-string value', { toString: () => CHALLENGE }],
            ['a missing challenge', undefined]
        ])(
            'refuses to sign %s and does not send it on',
            async (_label, verification) => {
                const store = newStore();
                reply('/api/lnurl/auth', ok({ verification }));
                reply('/api/plus/order', ok());

                await expect(store.createZeusPayPlusOrder()).rejects.toThrow(
                    'Invalid auth challenge'
                );

                expect(signMessage).not.toHaveBeenCalled();
                expect(callsTo('/api/plus/order')).toHaveLength(0);
                expect(store.error).toBe(true);
                expect(store.error_msg).toContain('Invalid auth challenge');
            }
        );

        it('does not cache a refused challenge', async () => {
            const store = newStore();
            reply(
                '/api/lnurl/auth',
                ok({ verification: CANONICAL_PHRASE }),
                ok({ verification: CHALLENGE })
            );
            reply('/api/plus/order', ok());

            await expect(store.createZeusPayPlusOrder()).rejects.toThrow(
                'Invalid auth challenge'
            );
            await store.createZeusPayPlusOrder();

            expect(callsTo('/api/lnurl/auth')).toHaveLength(2);
            expect(signMessage).toHaveBeenCalledTimes(1);
            expect(signMessage).toHaveBeenCalledWith(CHALLENGE);
            expect(bodyOf('/api/plus/order').message).toBe(CHALLENGE);
        });

        it('fails the call without signing when the server refuses the challenge', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', {
                status: 429,
                body: { error: 'rate limited' }
            });

            await expect(store.status()).rejects.toBe('rate limited');

            expect(signMessage).not.toHaveBeenCalled();
            expect(callsTo('/api/lnurl/status')).toHaveLength(0);
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('rate limited');
            expect(store.loading).toBe(false);
        });
        it('sends no account request when signing fails, and signs again on retry', async () => {
            const store = newStore();
            signMessage
                .mockRejectedValueOnce(new Error('node locked'))
                .mockResolvedValueOnce({ zbase: 'sig-retry' });
            reply(
                '/api/lnurl/auth',
                ok({ verification: FIRST }),
                ok({ verification: SECOND })
            );
            reply('/api/lnurl/status', ok({ addressType: 'cashu' }));

            await expect(store.status()).rejects.toThrow('node locked');

            expect(callsTo('/api/lnurl/status')).toHaveLength(0);
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('Error: node locked');
            expect(store.loading).toBe(false);

            await store.status();

            expect(callsTo('/api/lnurl/auth')).toHaveLength(2);
            expect(bodyOf('/api/lnurl/status')).toMatchObject({
                message: SECOND,
                signature: 'sig-retry'
            });
            expect(store.error).toBe(false);
        });
    });

    describe('status', () => {
        const authed = () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            return store;
        };

        it('copies the account fields from the response', async () => {
            const store = authed();
            reply(
                '/api/lnurl/status',
                ok({
                    addressType: 'cashu',
                    paid: [],
                    minimumSats: 10,
                    handle: 'satoshi',
                    domain: 'zeusnuts.com',
                    plusExpiresAt: '2027-01-01',
                    plusAnnualFeeSats: 21000,
                    legacyAccount: true,
                    perks: [{ title: 'Perk' }],
                    deviceToken: 'service-token',
                    image: 'base64img',
                    bio: 'hello',
                    noffer: 'noffer1abc'
                })
            );

            await store.status();

            expect(bodyOf('/api/lnurl/status')).toEqual({
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig'
            });
            expect(store.lightningAddress).toBe('satoshi@zeusnuts.com');
            expect(store.lightningAddressHandle).toBe('satoshi');
            expect(store.lightningAddressDomain).toBe('zeusnuts.com');
            expect(store.minimumSats).toBe(10);
            expect(store.zeusPlusExpiresAt).toBe('2027-01-01');
            expect(store.zeusPlusAnnualFeeSats).toBe(21000);
            expect(store.legacyAccount).toBe(true);
            expect(store.perks).toEqual([{ title: 'Perk' }]);
            expect(store.serviceDeviceToken).toBe('service-token');
            expect(store.image).toBe('base64img');
            expect(store.bio).toBe('hello');
            expect(store.noffer).toBe('noffer1abc');
        });

        it('clears profile fields the server no longer returns', async () => {
            const store = authed();
            store.image = 'old';
            store.bio = 'old';
            store.noffer = 'old';
            reply('/api/lnurl/status', ok({ addressType: 'nwc' }));

            await store.status();

            expect(store.image).toBeNull();
            expect(store.bio).toBeNull();
            expect(store.noffer).toBeNull();
        });

        it('keeps the full address when the response has a handle but no domain', async () => {
            const store = authed();
            store.lightningAddress = 'satoshi@zeuspay.com';
            reply(
                '/api/lnurl/status',
                ok({ addressType: 'cashu', handle: 'satoshi' })
            );

            await store.status();

            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
            expect(store.lightningAddressDomain).toBeUndefined();
        });

        it('clears an earlier error on a normal refresh', async () => {
            const store = authed();
            store.error = true;
            store.error_msg = 'earlier';
            reply('/api/lnurl/status', ok({ addressType: 'cashu' }));

            await store.status();

            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
        });

        it('keeps a redeem error visible when refreshing after a redeem', async () => {
            const store = authed();
            store.error = true;
            store.error_msg = 'redeem failed';
            reply('/api/lnurl/status', ok({ addressType: 'cashu' }));

            await store.status(true);

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('redeem failed');
            expect(store.loading).toBe(false);
        });

        it('treats a 200 reply with success false as a failure', async () => {
            const store = authed();
            reply('/api/lnurl/status', {
                status: 200,
                body: { success: false, error: 'not found' }
            });

            await expect(store.status()).rejects.toBe('not found');

            expect(store.error_msg).toBe('not found');
        });
    });

    describe('redeemCashu', () => {
        const redeemStore = () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined);
            return { store, status };
        };

        it('claims the quote, redeems it with ZEUS Pay and receives the returned token', async () => {
            const { store, status } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok({ token: 'cashuBtoken' }));

            await expect(store.redeemCashu('q1', MINT, 21000)).resolves.toBe(
                true
            );

            expect(cashuStore.checkInvoicePaid).toHaveBeenCalledWith(
                'q1',
                MINT,
                true,
                undefined
            );
            expect(bodyOf('/api/lnurl/nuts/redeem')).toEqual({
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig',
                quoteId: 'q1'
            });
            expect(cashuStore.receiveTokenCDK).toHaveBeenCalledWith(
                'cashuBtoken',
                'cashu-key'
            );
            expect(status).toHaveBeenCalledWith(true);
            expect(store.redeeming).toBe(false);
            expect(store.error).toBe(false);
            expect(postLocalNotification).not.toHaveBeenCalled();
        });

        it('passes skipMintCheck through to the quote check', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000, true, false, true);

            expect(cashuStore.checkInvoicePaid).toHaveBeenCalledWith(
                'q1',
                MINT,
                true,
                true
            );
        });

        it('receives the token without a signing key when none can be derived', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            cashuStore.deriveCashuSecretKey.mockReturnValue(null);
            reply('/api/lnurl/nuts/redeem', ok({ token: 'cashuBtoken' }));

            await store.redeemCashu('q1', MINT, 1000);

            expect(cashuStore.receiveTokenCDK).toHaveBeenCalledWith(
                'cashuBtoken',
                undefined
            );
        });

        it('skips token receipt when the server returns no token', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000);

            expect(cashuStore.receiveTokenCDK).not.toHaveBeenCalled();
            expect(store.error).toBe(false);
        });

        it('redeems an already-issued quote without announcing a new payment', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({
                isPaid: false,
                updatedInvoice: { state: 'ISSUED' }
            });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000, false, true);

            expect(callsTo('/api/lnurl/nuts/redeem')).toHaveLength(1);
            expect(postLocalNotification).not.toHaveBeenCalled();
            expect(store.error).toBe(false);
        });

        it('does not refresh status when skipStatus is set', async () => {
            const { store, status } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000, true);

            expect(status).not.toHaveBeenCalled();
        });

        it('posts a notification with a chime on iOS, grouping thousands', async () => {
            const { store } = redeemStore();
            const locale = jest.spyOn(LocaleUtils, 'localeString');
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1234000, true, true);

            expect(locale).toHaveBeenCalledWith(
                'zeuspay.paymentReceived.body',
                { value: '1,234', unit: 'general.sats' }
            );
            expect(postLocalNotification).toHaveBeenCalledWith({
                title: 'zeuspay.paymentReceived.title',
                body: 'zeuspay.paymentReceived.body',
                sound: 'chime.aiff'
            });
        });

        it('posts a notification without a sound on Android, singular for 1 sat', async () => {
            (Platform as any).OS = 'android';
            const { store } = redeemStore();
            const locale = jest.spyOn(LocaleUtils, 'localeString');
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000, true, true);

            expect(locale).toHaveBeenCalledWith(
                'zeuspay.paymentReceived.body',
                { value: '1', unit: 'sat' }
            );
            expect(postLocalNotification).toHaveBeenCalledWith({
                title: 'zeuspay.paymentReceived.title',
                body: 'zeuspay.paymentReceived.body'
            });
        });

        it('reports an unpaid quote without calling ZEUS Pay', async () => {
            const { store, status } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: false });

            await expect(store.redeemCashu('q1', MINT, 1000)).resolves.toBe(
                true
            );

            expect(callsTo('/api/lnurl/nuts/redeem')).toHaveLength(0);
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quoteNotPaid'
            );
            expect(store.redeeming).toBe(false);
            expect(status).not.toHaveBeenCalled();
        });

        it('reports an unpaid quote when the check returns nothing', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue(undefined);

            await store.redeemCashu('q1', MINT, 1000);

            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quoteNotPaid'
            );
        });

        it('reports a quote check error without calling ZEUS Pay', async () => {
            const { store } = redeemStore();
            cashuStore.checkInvoicePaid.mockRejectedValue(
                new Error('mint unreachable')
            );

            await expect(store.redeemCashu('q1', MINT, 1000)).resolves.toBe(
                true
            );

            expect(callsTo('/api/lnurl/nuts/redeem')).toHaveLength(0);
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quotePaymentErr'
            );
            expect(store.redeeming).toBe(false);
        });

        // Current behavior: the server's reason is set, then overwritten by
        // the outer catch with the generic quote check message. #4842
        // changes this to a redeem-specific message plus the reason.
        it('replaces a ZEUS Pay redeem error with the generic quote check message', async () => {
            const { store, status } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', {
                status: 400,
                body: { success: false, error: 'already redeemed' }
            });

            await expect(
                store.redeemCashu('q1', MINT, 1000, false, true)
            ).resolves.toBe(true);

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quotePaymentErr'
            );
            expect(store.redeeming).toBe(false);
            expect(cashuStore.receiveTokenCDK).not.toHaveBeenCalled();
            expect(postLocalNotification).not.toHaveBeenCalled();
            expect(status).not.toHaveBeenCalled();
        });

        it('reports a failed token receipt with the generic quote check message', async () => {
            const { store, status } = redeemStore();
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            cashuStore.receiveTokenCDK.mockRejectedValue(
                new Error('token spent')
            );
            reply('/api/lnurl/nuts/redeem', ok({ token: 'cashuBtoken' }));

            await store.redeemCashu('q1', MINT, 1000, false, true);

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe(
                'stores.LightningAddressStore.Cashu.quotePaymentErr'
            );
            expect(postLocalNotification).not.toHaveBeenCalled();
            expect(status).not.toHaveBeenCalled();
        });

        it('clears an earlier error when a redeem starts', async () => {
            const { store } = redeemStore();
            store.error = true;
            store.error_msg = 'earlier';
            cashuStore.checkInvoicePaid.mockResolvedValue({ isPaid: true });
            reply('/api/lnurl/nuts/redeem', ok());

            await store.redeemCashu('q1', MINT, 1000);

            expect(store.error).toBe(false);
            expect(store.error_msg).toBe('');
        });
    });

    describe('deletePayment', () => {
        it('marks the quote redeemed with ZEUS Pay and refreshes status', async () => {
            const store = newStore();
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined);
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/nuts/redeem', ok());

            await store.deletePayment('q1');

            expect(bodyOf('/api/lnurl/nuts/redeem').quoteId).toBe('q1');
            expect(cashuStore.checkInvoicePaid).not.toHaveBeenCalled();
            expect(status).toHaveBeenCalledWith(true);
            expect(store.redeeming).toBe(false);
            expect(store.error).toBe(false);
        });

        it('shows the server error and does not refresh status', async () => {
            const store = newStore();
            const status = jest
                .spyOn(store, 'status')
                .mockResolvedValue(undefined);
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/nuts/redeem', {
                status: 404,
                body: { success: false, error: 'quote not found' }
            });

            await expect(store.deletePayment('q1')).resolves.toBeUndefined();

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('quote not found');
            expect(store.redeeming).toBe(false);
            expect(status).not.toHaveBeenCalled();
        });
    });

    describe('push credentials', () => {
        it('waits for the device token, then sends it once', async () => {
            const store = newStore();
            const update = jest
                .spyOn(store, 'update')
                .mockResolvedValue({ success: true });

            await store.updatePushCredentials();
            expect(update).not.toHaveBeenCalled();

            store.setDeviceToken('device-token');
            expect(update).toHaveBeenCalledWith({
                device_token: 'device-token',
                device_platform: 'ios'
            });

            store.setDeviceToken('device-token-2');
            expect(update).toHaveBeenCalledTimes(1);
        });

        it('does not send when the server already has this token', async () => {
            const store = newStore();
            const update = jest
                .spyOn(store, 'update')
                .mockResolvedValue({ success: true });
            store.setDeviceToken('device-token');
            store.serviceDeviceToken = 'device-token';

            await store.updatePushCredentials();

            expect(update).not.toHaveBeenCalled();
        });

        it('sends a changed token with the platform', async () => {
            (Platform as any).OS = 'android';
            const store = newStore();
            const update = jest
                .spyOn(store, 'update')
                .mockResolvedValue({ success: true });
            store.setDeviceToken('new-token');
            store.serviceDeviceToken = 'old-token';

            await store.updatePushCredentials();

            expect(update).toHaveBeenCalledWith({
                device_token: 'new-token',
                device_platform: 'android'
            });
        });

        it('logs a failed deferred send instead of throwing', async () => {
            const store = newStore();
            jest.spyOn(store, 'update').mockRejectedValue(new Error('offline'));

            await store.updatePushCredentials();
            expect(() => store.setDeviceToken('device-token')).not.toThrow();
            await flushPromises();

            expect(console.log).toHaveBeenCalledWith(
                'Failed to update push credentials',
                expect.any(Error)
            );
        });
    });

    describe('automatic Cashu redemption', () => {
        const newSocket = (connected = false) => {
            const handlers: { [event: string]: (data: any) => void } = {};
            const socket: any = {
                connected,
                emit: jest.fn(),
                disconnect: jest.fn(),
                on: jest.fn((event: string, handler: any) => {
                    handlers[event] = handler;
                })
            };
            socket.connect = jest.fn(() => socket);
            return { socket, handlers };
        };

        it('redeems open payments and subscribes to new ones', async () => {
            const store = newStore();
            const { socket, handlers } = newSocket();
            ioMock.mockReturnValue(socket);
            reply('/api/lnurl/auth', ok({ verification: V }));
            const redeemAll = jest
                .spyOn(store, 'redeemAllOpenPaymentsCashu')
                .mockResolvedValue(undefined);
            const redeem = jest
                .spyOn(store, 'redeemCashu')
                .mockResolvedValue(true);

            store.prepareToAutomaticallyAcceptCashu();
            await flushPromises();

            expect(redeemAll).toHaveBeenCalledWith(true);
            expect(ioMock).toHaveBeenCalledWith(HOST, { path: '/stream' });
            expect(socket.emit).toHaveBeenCalledWith('auth', {
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig'
            });
            // MobX wraps the socket in an observable copy
            expect(store.socket.disconnect).toBe(socket.disconnect);

            handlers.paid({
                quote_id: 'q9',
                mint_url: MINT,
                amount_msat: 5000
            });
            expect(redeem).toHaveBeenCalledWith('q9', MINT, 5000, false, true);
        });

        it('does nothing while a socket is connected', () => {
            const store = newStore();
            store.socket = newSocket(true).socket;
            const redeemAll = jest.spyOn(store, 'redeemAllOpenPaymentsCashu');

            store.prepareToAutomaticallyAcceptCashu();

            expect(redeemAll).not.toHaveBeenCalled();
            expect(ioMock).not.toHaveBeenCalled();
        });

        it('logs an auth failure instead of opening a socket', async () => {
            const store = newStore();
            jest.spyOn(store, 'redeemAllOpenPaymentsCashu').mockResolvedValue(
                undefined
            );
            reply('/api/lnurl/auth', new Error('offline'));

            store.prepareToAutomaticallyAcceptCashu();
            await flushPromises();

            expect(ioMock).not.toHaveBeenCalled();
            expect(console.log).toHaveBeenCalledWith(
                'Error subscribing to Lightning address updates',
                expect.any(Error)
            );
        });

        it('disconnects the socket and clears account state on reset', () => {
            const store = newStore();
            const { socket } = newSocket(true);
            Object.assign(store, {
                socket,
                loading: true,
                error: true,
                error_msg: 'x',
                paid: [{ quote_id: 'q1' }],
                lightningAddress: 'satoshi@zeuspay.com',
                lightningAddressHandle: 'satoshi',
                lightningAddressDomain: 'zeuspay.com',
                lightningAddressType: 'cashu',
                zeusPlusExpiresAt: '2027-01-01',
                zeusPlusAnnualFeeSats: 21000,
                legacyAccount: true,
                perks: [{ title: 'Perk' }]
            });

            store.reset();

            expect(socket.disconnect).toHaveBeenCalled();
            expect(store.socket).toBeUndefined();
            expect(store).toMatchObject({
                loading: false,
                error: false,
                error_msg: '',
                paid: [],
                lightningAddress: '',
                lightningAddressHandle: '',
                lightningAddressDomain: '',
                lightningAddressType: '',
                zeusPlusExpiresAt: undefined,
                zeusPlusAnnualFeeSats: undefined,
                legacyAccount: false,
                perks: []
            });
        });
    });

    describe('createNWC', () => {
        it('creates an NWC address and enables it in settings', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply(
                '/api/lnurl/create',
                ok({ handle: 'satoshi', domain: 'zeuspay.com' })
            );

            await expect(
                store.createNWC('nostr+walletconnect://abc')
            ).resolves.toEqual({ success: true });
            await flushPromises();

            expect(bodyOf('/api/lnurl/create')).toEqual({
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig',
                nwc_string: 'nostr+walletconnect://abc',
                address_type: 'nwc'
            });
            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                lightningAddress: {
                    enabled: true,
                    automaticallyAccept: true,
                    allowComments: true
                }
            });
            expect(Storage.setItem).toHaveBeenCalledWith(
                ADDRESS_ACTIVATED_STRING,
                true
            );
            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
            expect(store.loading).toBe(false);
        });

        it('leaves settings alone when the server rejects the address', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/create', {
                status: 400,
                body: { success: false, error: 'handle taken' }
            });

            await expect(store.createNWC('nwc')).rejects.toBe('handle taken');

            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('handle taken');
            expect(store.loading).toBe(false);
        });
    });

    describe('createCashu', () => {
        it('initializes a missing mint wallet and sends its pubkey', async () => {
            const store = newStore();
            const mint = 'https://new-mint.test';
            cashuStore.initializeWallet.mockImplementation(async (url) => {
                cashuStore.cashuWallets[url] = { pubkey: '02ef' };
            });
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply(
                '/api/lnurl/create',
                ok({ handle: 'satoshi', domain: 'zeuspay.com' })
            );

            await store.createCashu(mint);
            await flushPromises();

            expect(cashuStore.initializeWallet).toHaveBeenCalledWith(mint);
            expect(bodyOf('/api/lnurl/create')).toMatchObject({
                cashu_pubkey: '02ef',
                mint_url: mint,
                address_type: 'cashu'
            });
            expect(settingsStore.updateSettings).toHaveBeenCalledWith({
                lightningAddress: {
                    enabled: true,
                    automaticallyAccept: true,
                    allowComments: true,
                    mintUrl: mint
                }
            });
        });

        it('reuses an initialized mint wallet', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/create', ok());

            await store.createCashu(MINT);
            await flushPromises();

            expect(cashuStore.initializeWallet).not.toHaveBeenCalled();
            expect(bodyOf('/api/lnurl/create').cashu_pubkey).toBe('02ab');
        });

        it('leaves settings alone when the server rejects the address', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/create', {
                status: 200,
                body: { success: false, error: 'mint not allowed' }
            });

            await expect(store.createCashu(MINT)).rejects.toBe(
                'mint not allowed'
            );

            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
            expect(Storage.setItem).not.toHaveBeenCalled();
            expect(store.error_msg).toBe('mint not allowed');
            expect(store.loading).toBe(false);
        });

        it('does not call the server when the mint wallet cannot be initialized', async () => {
            const store = newStore();
            cashuStore.initializeWallet.mockRejectedValue(
                new Error('mint offline')
            );
            reply('/api/lnurl/auth', ok({ verification: V }));

            await expect(
                store.createCashu('https://new-mint.test')
            ).rejects.toThrow('mint offline');

            expect(callsTo('/api/lnurl/create')).toHaveLength(0);
            expect(store.error_msg).toBe('Error: mint offline');
            expect(store.loading).toBe(false);
        });
    });

    describe('testNWCConnectionString', () => {
        it('sends only the connection string, unauthenticated', async () => {
            const store = newStore();
            reply('/api/lnurl/nwc/test', ok());

            await expect(store.testNWCConnectionString('nwc')).resolves.toEqual(
                { success: true }
            );

            expect(callsTo('/api/lnurl/auth')).toHaveLength(0);
            expect(bodyOf('/api/lnurl/nwc/test')).toEqual({
                nwc_string: 'nwc'
            });
            expect(store.error).toBe(false);
            expect(store.loading).toBe(false);
        });

        it('shows a warning the server returns with a successful test', async () => {
            const store = newStore();
            reply('/api/lnurl/nwc/test', ok({ error: 'no make_invoice' }));

            await expect(store.testNWCConnectionString('nwc')).resolves.toEqual(
                { success: true }
            );

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('no make_invoice');
        });

        it('rejects with the server error when the test fails', async () => {
            const store = newStore();
            reply('/api/lnurl/nwc/test', {
                status: 200,
                body: { success: false, error: 'relay unreachable' }
            });

            await expect(store.testNWCConnectionString('nwc')).rejects.toBe(
                'relay unreachable'
            );

            expect(store.error_msg).toBe('relay unreachable');
            expect(store.loading).toBe(false);
        });
    });

    describe('update', () => {
        it('defaults the domain to zeuspay.com when the reply has none', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/update', ok({ handle: 'hal' }));

            await store.update({ handle: 'hal' });
            await flushPromises();

            expect(bodyOf('/api/lnurl/update')).toEqual({
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig',
                updates: { handle: 'hal' }
            });
            expect(store.lightningAddress).toBe('hal@zeuspay.com');
            expect(store.loading).toBe(false);
        });
    });

    describe('deleteAddress', () => {
        it('deletes the account, clears local flags and resets the store', async () => {
            const store = newStore();
            store.lightningAddress = 'satoshi@zeuspay.com';
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/delete', ok());

            await expect(store.deleteAddress()).resolves.toBe(true);

            expect(bodyOf('/api/lnurl/delete')).toEqual({
                pubkey: NODE_PUBKEY,
                message: V,
                signature: 'zsig'
            });
            expect(Storage.setItem).toHaveBeenCalledWith(
                ADDRESS_ACTIVATED_STRING,
                false
            );
            expect(Storage.setItem).toHaveBeenCalledWith(
                HASHES_STORAGE_STRING,
                ''
            );
            expect(store.lightningAddress).toBe('');
            expect(store.loading).toBe(false);
        });

        it('keeps local state when the server refuses', async () => {
            const store = newStore();
            store.lightningAddress = 'satoshi@zeuspay.com';
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/delete', {
                status: 403,
                body: { error: 'invalid signature' }
            });

            await expect(store.deleteAddress()).rejects.toBe(
                'invalid signature'
            );

            expect(Storage.setItem).not.toHaveBeenCalled();
            expect(store.lightningAddress).toBe('satoshi@zeuspay.com');
            expect(store.error_msg).toBe('invalid signature');
            expect(store.loading).toBe(false);
        });

        it('falls back to a generic message when the server gives no reason', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/lnurl/delete', { status: 500, body: {} });

            await expect(store.deleteAddress()).rejects.toBeUndefined();

            expect(store.error_msg).toBe('Failed to delete account');
        });
    });

    describe('createZeusPayPlusOrder', () => {
        it('returns the order from the server', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/plus/order', {
                status: 200,
                body: { invoice: 'lnbc1', amount: 21000 }
            });

            await expect(store.createZeusPayPlusOrder()).resolves.toEqual({
                invoice: 'lnbc1',
                amount: 21000
            });
            expect(store.loading).toBe(false);
            expect(store.error).toBe(false);
        });

        it('falls back to a generic message when the server gives no reason', async () => {
            const store = newStore();
            reply('/api/lnurl/auth', ok({ verification: V }));
            reply('/api/plus/order', { status: 500, body: {} });

            await expect(
                store.createZeusPayPlusOrder()
            ).rejects.toBeUndefined();

            expect(store.error).toBe(true);
            expect(store.error_msg).toBe('Failed to create order');
            expect(store.loading).toBe(false);
        });
    });
});
