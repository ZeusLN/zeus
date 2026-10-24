// Every ZEUS Pay request must go over Tor when the node has Tor enabled.
// Mocks only the transports, so the real networkFetch picks one.
jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('react-native-notifications', () => ({ Notifications: {} }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./CashuStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    signMessage: jest.fn(async () => ({ signature: 'sig' }))
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(true),
    removeItem: jest.fn().mockResolvedValue(true)
}));

import ReactNativeBlobUtil from 'react-native-blob-util';

import LightningAddressStore from './LightningAddressStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const AUTH_URL = 'https://zeuspay.com/api/lnurl/auth';
const REPLY = { success: true, verification: 'v' };

const newStore = (enableTor: boolean) =>
    new LightningAddressStore(
        {
            cashuWallets: { 'https://mint.test': { pubkey: '02ab' } }
        } as any,
        { nodeInfo: { identity_pubkey: '03cd' } } as any,
        {
            settings: {},
            enableTor,
            updateSettings: jest.fn().mockResolvedValue(undefined)
        } as any
    );

// testNWCConnectionString is the only call that skips the auth request
const sites: Array<
    [string, (store: LightningAddressStore) => Promise<any>, string]
> = [
    ['getAuthData', (store) => (store as any).getAuthData(), AUTH_URL],
    [
        'createCashu',
        (store) => store.createCashu('https://mint.test'),
        'https://zeuspay.com/api/lnurl/create'
    ],
    [
        'createNWC',
        (store) => store.createNWC('nostr+walletconnect://x'),
        'https://zeuspay.com/api/lnurl/create'
    ],
    [
        'testNWCConnectionString',
        (store) => store.testNWCConnectionString('nostr+walletconnect://x'),
        'https://zeuspay.com/api/lnurl/nwc/test'
    ],
    [
        'update',
        (store) => store.update({ bio: 'hi' }),
        'https://zeuspay.com/api/lnurl/update'
    ],
    [
        'status',
        (store) => store.status(),
        'https://zeuspay.com/api/lnurl/status'
    ],
    [
        'callRedeemEndpoint',
        (store) => (store as any).callRedeemEndpoint('q1'),
        'https://zeuspay.com/api/lnurl/nuts/redeem'
    ],
    [
        'deleteAddress',
        (store) => store.deleteAddress(),
        'https://zeuspay.com/api/lnurl/delete'
    ],
    [
        'createZeusPayPlusOrder',
        (store) => store.createZeusPayPlusOrder(),
        'https://zeuspay.com/api/plus/order'
    ]
];

describe('LightningAddressStore requests and Tor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        torFetch.mockResolvedValue({
            status: 200,
            body: JSON.stringify(REPLY)
        });
        blobFetch.mockResolvedValue({
            info: () => ({ status: 200 }),
            json: () => REPLY,
            text: () => JSON.stringify(REPLY),
            data: JSON.stringify(REPLY)
        });
    });

    afterEach(() => jest.restoreAllMocks());

    it.each(sites)(
        '%s goes over Tor when Tor is enabled',
        async (_name, call, url) => {
            await call(newStore(true));

            const urls = torFetch.mock.calls.map((c) => c[0]);
            expect(urls).toContain(url);
            torFetch.mock.calls.forEach((c) => expect(c[1]).toBe('POST'));
            expect(blobFetch).not.toHaveBeenCalled();
        }
    );

    it.each(sites)(
        '%s goes direct when Tor is disabled',
        async (_name, call, url) => {
            await call(newStore(false));

            const urls = blobFetch.mock.calls.map((c) => c[1]);
            expect(urls).toContain(url);
            blobFetch.mock.calls.forEach((c) => expect(c[0]).toBe('POST'));
            expect(torFetch).not.toHaveBeenCalled();
        }
    );
});
