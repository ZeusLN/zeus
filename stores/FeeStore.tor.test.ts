jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: { fetch: jest.fn() }
}));
jest.mock('./Stores', () => ({}));
jest.mock('./SettingsStore', () => ({}));
jest.mock('./NodeInfoStore', () => ({}));
jest.mock('../utils/TorUtils', () => ({
    doTorRequest: jest.fn(),
    doTorRequestRaw: jest.fn(),
    RequestMethod: { GET: 'GET', POST: 'POST', DELETE: 'DELETE' }
}));
jest.mock('../utils/BackendUtils', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/FeeUtils', () => ({
    sanitizeRecommendedFees: (fees: any) => fees
}));
jest.mock('../utils/UrlUtils', () => ({
    __esModule: true,
    default: { getMempoolApiUrl: () => mockMempoolApiUrl }
}));

// a custom .onion mempool instance always goes over Tor, whatever the setting
const ONION_API =
    'http://zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion/api';
let mockMempoolApiUrl = 'https://mempool.test/api';

import ReactNativeBlobUtil from 'react-native-blob-util';
import FeeStore from './FeeStore';
import { doTorRequestRaw } from '../utils/TorUtils';

const blobFetch = ReactNativeBlobUtil.fetch as jest.Mock;
const torFetch = doTorRequestRaw as jest.Mock;

const URL = 'https://mempool.test/api/v1/fees/recommended';
const FEES = { fastestFee: 10, halfHourFee: 5, hourFee: 2 };

beforeEach(() => {
    jest.clearAllMocks();
    mockMempoolApiUrl = 'https://mempool.test/api';
    torFetch.mockResolvedValue({ status: 200, body: JSON.stringify(FEES) });
    blobFetch.mockResolvedValue({
        info: () => ({ status: 200 }),
        json: () => FEES
    });
});

describe('FeeStore.getOnchainFeesviaMempool', () => {
    it.each([true, false])('fetches fees over Tor %s', async (enableTor) => {
        const store = new FeeStore(
            { enableTor } as any,
            { nodeInfo: {} } as any
        );

        await store.getOnchainFeesviaMempool();

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
        expect(store.recommendedFees).toEqual(FEES);
    });

    it('fetches fees from an .onion instance over Tor with Tor off', async () => {
        mockMempoolApiUrl = ONION_API;
        const store = new FeeStore(
            { enableTor: false } as any,
            { nodeInfo: {} } as any
        );

        await store.getOnchainFeesviaMempool();

        expect(blobFetch).not.toHaveBeenCalled();
        expect(torFetch).toHaveBeenCalledWith(
            `${ONION_API}/v1/fees/recommended`,
            'GET',
            undefined,
            undefined
        );
        expect(store.recommendedFees).toEqual(FEES);
    });
});
