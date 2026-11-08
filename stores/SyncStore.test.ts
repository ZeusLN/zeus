jest.mock('react-native-blob-util', () => ({ fetch: jest.fn() }));
jest.mock('../utils/UrlUtils', () => ({ getMempoolApiUrl: jest.fn() }));
jest.mock('../utils/ErrorUtils', () => ({
    errorToUserFriendly: (e: any) => e?.message ?? String(e)
}));
jest.mock('../stores/Stores', () => ({
    alertStore: {
        setMempoolErrorFromUrl: jest.fn(),
        clearMempoolError: jest.fn()
    }
}));
// SyncStore imports BackendUtils, which pulls in LND → TorUtils →
// react-native-nitro-tor (ESM). Mock BackendUtils so Jest never loads it.
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: {}
}));
// Silence the NativeEventEmitter warnings from EventListenerUtils.
jest.mock('../utils/EventListenerUtils', () => ({
    LndMobileEventEmitter: { addListener: jest.fn() },
    LndMobileToolsEventEmitter: { addListener: jest.fn() },
    LdkNodeEventEmitter: { addListener: jest.fn() }
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import UrlUtils from '../utils/UrlUtils';
import { alertStore } from './Stores';
import SyncStore from './SyncStore';

const mockedFetch = jest.mocked(ReactNativeBlobUtil.fetch);
const mockedUrl = jest.mocked(UrlUtils.getMempoolApiUrl);
const mockedAlert = alertStore as jest.Mocked<typeof alertStore>;

const makeStore = (network: 'Mainnet' | 'Testnet' = 'Mainnet') => {
    const stub = {
        onReconnect: jest.fn(),
        embeddedLndNetwork: network,
        implementation: 'embedded-lnd'
    };
    return new SyncStore(
        stub as any,
        { ...stub, onReconnect: jest.fn() } as any
    );
};

describe('SyncStore.getBestBlockHeight', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedUrl.mockReturnValue('https://mempool.space/api');
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('clears the alert on a 200 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => '800000'
        } as any);
        const store = makeStore();

        await (store as any).getBestBlockHeight();

        expect(store.bestBlockHeight).toBe(800000);
        expect(store.error).toBe(false);
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('sets the alert on a non-200 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => '0'
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(store.error).toBe(true);
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'HTTP 500'
        );
    });

    it('sets the alert on a thrown network error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(store.error).toBe(true);
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Network error'
        );
    });

    it('names the Testnet host on the alert', async () => {
        mockedUrl.mockImplementation((info: any) =>
            info.isTestNet
                ? 'https://mempool.space/testnet/api'
                : 'https://mempool.space/api'
        );
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 500 }),
            json: () => '0'
        } as any);
        const store = makeStore('Testnet');

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/testnet/api/blocks/tip/height',
            'HTTP 500'
        );
    });

    it('raises the alert on a 404 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 404 }),
            json: () => '0'
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'HTTP 404'
        );
    });

    it('raises the alert with "Invalid response" on a non-numeric body', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => 'Not a number'
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Invalid response'
        );
    });

    it('raises "Invalid response" when json() throws', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 200 }),
            json: () => {
                throw new SyntaxError('Unexpected token <');
            }
        } as any);
        const store = makeStore();

        await expect(
            (store as any).getBestBlockHeight()
        ).rejects.toBeUndefined();

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/blocks/tip/height',
            'Invalid response'
        );
    });
});
