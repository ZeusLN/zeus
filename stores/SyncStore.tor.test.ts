jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./ConnectivityStore', () => ({}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/EventListenerUtils', () => ({
    LndMobileToolsEventEmitter: {}
}));
jest.mock('../utils/SyncUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => 'https://mempool.test/api' }
}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import SyncStore from './SyncStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const URL = 'https://mempool.test/api/blocks/tip/height';

beforeEach(() => {
    jest.clearAllMocks();
    torFetch.mockResolvedValue({ status: 200, body: '900000' });
    blobFetch.mockResolvedValue({
        info: () => ({ status: 200 }),
        json: () => '900000'
    });
});

describe('SyncStore block tip lookup', () => {
    it.each([true, false])('fetches the tip over Tor %s', async (enableTor) => {
        const store = new SyncStore(
            { enableTor, embeddedLndNetwork: 'Mainnet' } as any,
            { onReconnect: jest.fn() } as any
        );

        await (store as any).getBestBlockHeight();

        if (enableTor) {
            expect(blobFetch).not.toHaveBeenCalled();
            expect(torFetch).toHaveBeenCalledWith(
                URL,
                'GET',
                undefined,
                undefined
            );
        } else {
            expect(torFetch).not.toHaveBeenCalled();
            expect(blobFetch).toHaveBeenCalledWith(
                'get',
                URL,
                undefined,
                undefined
            );
        }
        expect(store.bestBlockHeight).toBe(900000);
    });
});
