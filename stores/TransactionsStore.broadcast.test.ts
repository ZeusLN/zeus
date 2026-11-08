jest.mock('react-native-randombytes', () => ({
    randomBytes: (size: number) => Buffer.alloc(size, 0)
}));
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
// TransactionsStore imports BackendUtils, which pulls in LND → TorUtils →
// react-native-nitro-tor (ESM). Mock BackendUtils so Jest never loads it.
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));

import ReactNativeBlobUtil from 'react-native-blob-util';
import UrlUtils from '../utils/UrlUtils';
import { alertStore } from './Stores';
import TransactionsStore from './TransactionsStore';

const mockedFetch = jest.mocked(ReactNativeBlobUtil.fetch);
const mockedUrl = jest.mocked(UrlUtils.getMempoolApiUrl);
const mockedAlert = alertStore as jest.Mocked<typeof alertStore>;

const newStore = () => {
    const stub = {
        onReconnect: jest.fn(),
        nodeInfo: {},
        settings: {},
        implementation: 'embedded-lnd'
    };
    return new TransactionsStore(
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any,
        { ...stub, onReconnect: jest.fn() } as any
    );
};

describe('TransactionsStore.broadcastRawTxToMempoolSpace alert wiring', () => {
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
            data: 'txid-abc'
        } as any);
        const store = newStore();

        const result = await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(result).toBe('txid-abc');
        expect(store.broadcast_txid).toBe('txid-abc');
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
    });

    it('raises the alert on a 5xx response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 503 }),
            data: 'Service unavailable'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Service unavailable');
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/tx',
            'HTTP 503'
        );
        expect(mockedAlert.clearMempoolError).not.toHaveBeenCalled();
    });

    it('does not raise the alert on a 4xx response (tx was rejected, server is up)', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 400 }),
            data: 'Invalid tx'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Invalid tx');
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        // 400 means the server is reachable and rejected the tx, so clear the alert
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('does not raise or clear on a 404 response', async () => {
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 404 }),
            data: 'Not found'
        } as any);
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(store.broadcast_err).toBe('Not found');
        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        expect(mockedAlert.clearMempoolError).not.toHaveBeenCalled();
    });

    it('clears a 5xx alert when a later broadcast returns 400', async () => {
        const store = newStore();

        // First: 5xx raises the alert
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 503 }),
            data: 'Service unavailable'
        } as any);
        await store.broadcastRawTxToMempoolSpace('deadbeef');
        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledTimes(1);

        mockedAlert.setMempoolErrorFromUrl.mockClear();
        mockedAlert.clearMempoolError.mockClear();

        // Then: 4xx means the server is up again — clear the prior alert
        mockedFetch.mockResolvedValueOnce({
            info: () => ({ status: 400 }),
            data: 'Invalid tx'
        } as any);
        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(mockedAlert.setMempoolErrorFromUrl).not.toHaveBeenCalled();
        expect(mockedAlert.clearMempoolError).toHaveBeenCalled();
    });

    it('raises the alert on a thrown network error', async () => {
        mockedFetch.mockRejectedValueOnce(new Error('Network error'));
        const store = newStore();

        await store.broadcastRawTxToMempoolSpace('deadbeef');

        expect(mockedAlert.setMempoolErrorFromUrl).toHaveBeenCalledWith(
            'https://mempool.space/api/tx',
            'Network error'
        );
    });
});
