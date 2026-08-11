const mockFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: (...args: any[]) => mockFetch(...args)
    }
}));

jest.mock('react-native-nitro-tor', () => ({
    RnTor: {
        startTorIfNotRunning: jest.fn().mockResolvedValue({ is_success: true }),
        shutdownService: jest.fn(),
        httpGet: jest.fn(),
        httpPost: jest.fn(),
        httpDelete: jest.fn()
    }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));

import { RnTor } from 'react-native-nitro-tor';
import { networkFetch } from './NetworkUtils';

describe('networkFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (RnTor.startTorIfNotRunning as jest.Mock).mockResolvedValue({
            is_success: true
        });
    });

    describe('when Tor is disabled', () => {
        it('delegates to ReactNativeBlobUtil.fetch and never touches Tor', async () => {
            const blobResponse = { info: () => ({ status: 200 }) };
            mockFetch.mockResolvedValue(blobResponse);

            const response = await networkFetch({
                method: 'POST',
                url: 'https://example.com/api',
                headers: { 'Content-Type': 'application/json' },
                body: '{"a":1}',
                enableTor: false
            });

            expect(mockFetch).toHaveBeenCalledWith(
                'POST',
                'https://example.com/api',
                { 'Content-Type': 'application/json' },
                '{"a":1}'
            );
            expect(RnTor.httpGet).not.toHaveBeenCalled();
            expect(RnTor.httpPost).not.toHaveBeenCalled();
            expect(response).toBe(blobResponse);
        });
    });

    describe('when Tor is enabled', () => {
        it('routes a GET through the Tor daemon and exposes a blob-util-compatible response', async () => {
            (RnTor.httpGet as jest.Mock).mockResolvedValue({
                status_code: 200,
                body: '{"rate":42}',
                error: null
            });

            const response = await networkFetch({
                method: 'GET',
                url: 'https://example.com/rate',
                enableTor: true
            });

            expect(RnTor.httpGet).toHaveBeenCalledTimes(1);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(response.info().status).toBe(200);
            expect(response.json()).toEqual({ rate: 42 });
            expect(response.text()).toBe('{"rate":42}');
            expect(response.data).toBe('{"rate":42}');
        });

        it('routes a POST body through the Tor daemon', async () => {
            (RnTor.httpPost as jest.Mock).mockResolvedValue({
                status_code: 201,
                body: '{"success":true}',
                error: null
            });

            const response = await networkFetch({
                method: 'POST',
                url: 'https://example.com/create',
                headers: { 'Content-Type': 'application/json' },
                body: '{"pubkey":"abc"}',
                enableTor: true
            });

            expect(RnTor.httpPost).toHaveBeenCalledTimes(1);
            const postArgs = (RnTor.httpPost as jest.Mock).mock.calls[0][0];
            expect(postArgs.url).toBe('https://example.com/create');
            expect(postArgs.body).toBe('{"pubkey":"abc"}');
            expect(response.info().status).toBe(201);
            expect(response.json()).toEqual({ success: true });
        });

        it('surfaces a non-2xx status instead of throwing (parity with blob-util)', async () => {
            (RnTor.httpGet as jest.Mock).mockResolvedValue({
                status_code: 404,
                body: '{"error":"not found"}',
                error: null
            });

            const response = await networkFetch({
                method: 'GET',
                url: 'https://example.com/missing',
                enableTor: true
            });

            expect(response.info().status).toBe(404);
            expect(response.json()).toEqual({ error: 'not found' });
        });
    });
});
