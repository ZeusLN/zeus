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
import { isOnionUrl, networkFetch } from './NetworkUtils';

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

        it('returns the ReactNativeBlobUtil request, so a caller can cancel it', () => {
            const request = Object.assign(new Promise(() => {}), {
                cancel: jest.fn()
            });
            mockFetch.mockReturnValue(request);

            const result = networkFetch({
                method: 'GET',
                url: 'https://example.com/api',
                enableTor: false
            });
            result.cancel?.();

            expect(result).toBe(request);
            expect(request.cancel).toHaveBeenCalled();
        });
    });

    describe('.onion hosts', () => {
        const ONION =
            'zeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeuspayzeus.onion';

        it('go over Tor even when Tor is disabled', async () => {
            (RnTor.httpGet as jest.Mock).mockResolvedValue({
                status_code: 200,
                body: '{"fastestFee":3}',
                error: null
            });

            const response = await networkFetch({
                method: 'GET',
                url: `http://${ONION}/api/v1/fees/recommended`,
                enableTor: false
            });

            expect(RnTor.httpGet).toHaveBeenCalledTimes(1);
            expect((RnTor.httpGet as jest.Mock).mock.calls[0][0].url).toBe(
                `http://${ONION}/api/v1/fees/recommended`
            );
            expect(mockFetch).not.toHaveBeenCalled();
            expect(response.json()).toEqual({ fastestFee: 3 });
        });

        it('fail instead of falling back to clearnet when Tor cannot start', async () => {
            // a fresh module, so no earlier test has already started Tor
            let freshFetch: typeof networkFetch = networkFetch;
            jest.isolateModules(() => {
                freshFetch = require('./NetworkUtils').networkFetch;
                require('react-native-nitro-tor').RnTor.startTorIfNotRunning.mockResolvedValue(
                    {
                        is_success: false,
                        error_message: 'tor down'
                    }
                );
            });

            await expect(
                freshFetch({
                    method: 'POST',
                    url: `http://${ONION}/api/tx`,
                    body: 'deadbeef',
                    enableTor: false
                })
            ).rejects.toThrow('tor down');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('fail instead of falling back to clearnet when the Tor request fails', async () => {
            (RnTor.httpGet as jest.Mock).mockResolvedValue({
                error: 'connection refused'
            });

            await expect(
                networkFetch({
                    method: 'GET',
                    url: `https://${ONION.toUpperCase()}/lnurlp/satoshi`
                })
            ).rejects.toThrow('connection refused');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('isOnionUrl matches only the host', () => {
            expect(isOnionUrl(`http://${ONION}/x`)).toBe(true);
            expect(isOnionUrl(`http://${ONION}./x`)).toBe(true);
            expect(isOnionUrl(`https://${ONION.toUpperCase()}:8080/x`)).toBe(
                true
            );
            expect(isOnionUrl('https://pay.onion.example.com/x')).toBe(false);
            expect(isOnionUrl('https://example.com/a.onion')).toBe(false);
            expect(isOnionUrl('https://example.com/#x.onion')).toBe(false);
            expect(isOnionUrl('not a url')).toBe(false);
        });
    });

    describe('when Tor is enabled', () => {
        it.each([
            'http://192.168.1.10:3006/api/v1/fees/recommended',
            'http://10.0.0.5/api/blocks/tip/height',
            'http://172.20.1.1:8999/api/tx',
            'http://umbrel.local:3006/api/tx',
            'http://UMBREL.LOCAL./api/tx',
            'http://[fd00::1]:3006/api/tx',
            'http://[fe80::1]/api/tx',
            'http://localhost:3006/api/tx',
            'http://127.0.0.1:3006/api/tx'
        ])(
            'sends private host %s direct, since Tor cannot reach it',
            async (url) => {
                const blobResponse = { info: () => ({ status: 200 }) };
                mockFetch.mockResolvedValue(blobResponse);

                const response = await networkFetch({
                    method: 'GET',
                    url,
                    enableTor: true
                });

                expect(mockFetch).toHaveBeenCalledWith(
                    'GET',
                    url,
                    undefined,
                    undefined
                );
                expect(RnTor.httpGet).not.toHaveBeenCalled();
                expect(response).toBe(blobResponse);
            }
        );

        it.each([
            'https://mempool.space/api/tx',
            'https://172.32.0.1/api/tx',
            'https://192.168.evil.com/api/tx',
            'https://local.example.com/api/tx',
            'https://[2001:db8::1]/api/tx'
        ])('sends public host %s over Tor', async (url) => {
            (RnTor.httpGet as jest.Mock).mockResolvedValue({
                status_code: 200,
                body: '{}',
                error: null
            });

            await networkFetch({ method: 'GET', url, enableTor: true });

            expect(RnTor.httpGet).toHaveBeenCalledTimes(1);
            expect(mockFetch).not.toHaveBeenCalled();
        });

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
