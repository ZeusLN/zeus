const mockFetch = jest.fn();
jest.mock('react-native-blob-util', () => ({
    __esModule: true,
    default: {
        fetch: (...args: any[]) => mockFetch(...args)
    }
}));

jest.mock('react-native-nitro-tor', () => ({
    Tor: {
        daemon: {
            start: jest.fn(),
            stop: jest.fn()
        },
        http: {
            request: jest.fn()
        }
    }
}));

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));

import { Tor } from 'react-native-nitro-tor';
import { isOnionUrl, networkFetch } from './NetworkUtils';

const startMock = Tor.daemon.start as jest.Mock;
const requestMock = Tor.http.request as jest.Mock;
const respond = (statusCode: number, body: string) =>
    requestMock.mockResolvedValue({ statusCode, headers: {}, body });

describe('networkFetch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        startMock.mockResolvedValue({
            state: 'running',
            socksAddress: '127.0.0.1:9056',
            controlAddress: '127.0.0.1:9051',
            connectivity: { network: 'up', circuitEstablished: true }
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
            expect(requestMock).not.toHaveBeenCalled();
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
            respond(200, '{"fastestFee":3}');

            const response = await networkFetch({
                method: 'GET',
                url: `http://${ONION}/api/v1/fees/recommended`,
                enableTor: false
            });

            expect(requestMock).toHaveBeenCalledTimes(1);
            expect(requestMock.mock.calls[0][0].url).toBe(
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
                require('react-native-nitro-tor').Tor.daemon.start.mockRejectedValue(
                    new Error('tor down')
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
            requestMock.mockRejectedValue(new Error('connection refused'));

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
                expect(requestMock).not.toHaveBeenCalled();
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
            respond(200, '{}');

            await networkFetch({ method: 'GET', url, enableTor: true });

            expect(requestMock).toHaveBeenCalledTimes(1);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('routes a GET through the Tor daemon and exposes a blob-util-compatible response', async () => {
            respond(200, '{"rate":42}');

            const response = await networkFetch({
                method: 'GET',
                url: 'https://example.com/rate',
                enableTor: true
            });

            expect(requestMock).toHaveBeenCalledTimes(1);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(response.info().status).toBe(200);
            expect(response.json()).toEqual({ rate: 42 });
            expect(response.text()).toBe('{"rate":42}');
            expect(response.data).toBe('{"rate":42}');
        });

        it('routes a POST body through the Tor daemon', async () => {
            respond(201, '{"success":true}');

            const response = await networkFetch({
                method: 'POST',
                url: 'https://example.com/create',
                headers: { 'Content-Type': 'application/json' },
                body: '{"pubkey":"abc"}',
                enableTor: true
            });

            expect(requestMock).toHaveBeenCalledTimes(1);
            const postArgs = requestMock.mock.calls[0][0];
            expect(postArgs.method).toBe('POST');
            expect(postArgs.url).toBe('https://example.com/create');
            expect(postArgs.body).toBe('{"pubkey":"abc"}');
            expect(response.info().status).toBe(201);
            expect(response.json()).toEqual({ success: true });
        });

        it('passes a request timeout to the Tor daemon, 60 s by default', async () => {
            respond(200, '{}');

            await networkFetch({
                method: 'POST',
                url: 'https://example.com/upload',
                body: '{}',
                enableTor: true,
                timeoutMs: 900000
            });
            await networkFetch({
                method: 'POST',
                url: 'https://example.com/status',
                body: '{}',
                enableTor: true
            });

            const timeouts = requestMock.mock.calls.map(
                ([args]) => args.timeoutMs
            );
            expect(timeouts).toEqual([900000, 60000]);
        });

        it('surfaces a non-2xx status instead of throwing (parity with blob-util)', async () => {
            respond(404, '{"error":"not found"}');

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
