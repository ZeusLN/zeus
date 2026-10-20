// Both mempool.space broadcast paths go over Tor when it is enabled
jest.mock('../stores/Stores');
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('bitcoinjs-lib', () => ({
    Transaction: { fromHex: () => ({ getId: () => 'txid' }) }
}));
jest.mock('react-native-randombytes', () => ({
    randomBytes: (n: number) => require('crypto').randomBytes(n)
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('./ChannelsStore', () => ({}));
jest.mock('./BalanceStore', () => ({}));
jest.mock('./ModalStore', () => ({}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
// no publishTransaction, so broadcast takes the mempool.space fallback
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { getClass: jest.fn(() => ({})) }
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));
jest.mock('../utils/RatingUtils', () => ({
    RATING_MODAL_TRIGGER_DELAY: 1000
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import TransactionsStore from './TransactionsStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const RAW_TX = 'deadbeef';
const URL = 'https://mempool.test/api/tx';

const newStore = (enableTor: boolean) =>
    new TransactionsStore(
        { implementation: 'cln-rest', enableTor, settings: {} } as any,
        { nodeInfo: {} } as any,
        { resetOpenChannel: jest.fn() } as any,
        {} as any,
        {} as any
    );

const expectTransport = (enableTor: boolean) => {
    if (enableTor) {
        expect(blobFetch).not.toHaveBeenCalled();
        expect(torFetch).toHaveBeenCalledTimes(1);
        const [url, method, body] = torFetch.mock.calls[0];
        expect(url).toBe(URL);
        expect(method).toBe('POST');
        expect(body).toBe(RAW_TX);
    } else {
        expect(torFetch).not.toHaveBeenCalled();
        expect(blobFetch).toHaveBeenCalledTimes(1);
        const [method, url, , body] = blobFetch.mock.calls[0];
        expect(method).toBe('post');
        expect(url).toBe(URL);
        expect(body).toBe(RAW_TX);
    }
};

beforeEach(() => {
    jest.clearAllMocks();
    torFetch.mockResolvedValue({ status: 200, body: 'txid' });
    blobFetch.mockResolvedValue({
        info: () => ({ status: 200 }),
        data: 'txid'
    });
});

describe('TransactionsStore mempool.space broadcasts over Tor', () => {
    it.each([true, false])('broadcast fallback (Tor %s)', async (enableTor) => {
        const store = newStore(enableTor);

        await store.broadcast(RAW_TX);

        expectTransport(enableTor);
        expect(store.txid).toBe('txid');
    });

    it.each([true, false])(
        'broadcastRawTxToMempoolSpace (Tor %s)',
        async (enableTor) => {
            const store = newStore(enableTor);

            await store.broadcastRawTxToMempoolSpace(RAW_TX);

            expectTransport(enableTor);
            expect(store.broadcast_txid).toBe('txid');
        }
    );
});
