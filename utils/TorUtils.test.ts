jest.mock('react-native-nitro-tor', () => {
    class TorError extends Error {
        code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    }
    return {
        TorError,
        Tor: {
            daemon: {
                start: jest.fn(),
                stop: jest.fn(),
                getStatus: jest.fn(),
                subscribe: jest.fn(),
                requestNewIdentity: jest.fn()
            },
            http: {
                request: jest.fn()
            }
        }
    };
});

jest.mock('react-native-fs', () => ({
    DocumentDirectoryPath: '/tmp'
}));

import { Tor, TorError } from 'react-native-nitro-tor';

import {
    doTorRequest,
    isOnionHttpsUrl,
    restartTor,
    RequestMethod,
    setTorRequestOutcomeListener
} from './TorUtils';

const daemon = Tor.daemon as jest.Mocked<typeof Tor.daemon>;
const request = Tor.http.request as jest.Mock;

const RUNNING = {
    state: 'running',
    socksAddress: '127.0.0.1:9056',
    controlAddress: '127.0.0.1:9051',
    connectivity: { network: 'up', circuitEstablished: true }
};
const ONION = 'https://xyz.onion/v1/getinfo';

const ok = (body: string, statusCode = 200) => ({
    statusCode,
    headers: {},
    body
});

describe('TorUtils', () => {
    describe('isOnionHttpsUrl', () => {
        it('returns true for an HTTPS v3 .onion URL', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true regardless of port', () => {
            expect(
                isOnionHttpsUrl(
                    'https://hnmvv3bxny3chob3ytfai5m5j3356qplcf26hel63fs6c3adlbu56lad.onion:8443/v1/getinfo'
                )
            ).toBe(true);
        });

        it('returns true for a multi-label .onion hostname', () => {
            expect(isOnionHttpsUrl('https://api.xyz.onion/v1/getinfo')).toBe(
                true
            );
        });

        it('returns true even when the hostname is mixed case', () => {
            expect(isOnionHttpsUrl('https://XYZ.ONION/v1/getinfo')).toBe(true);
        });

        it('returns false for an HTTP .onion URL (no TLS to bypass)', () => {
            expect(isOnionHttpsUrl('http://xyz.onion/v1/getinfo')).toBe(false);
        });

        it('returns false for a clearnet HTTPS URL', () => {
            expect(isOnionHttpsUrl('https://example.com/v1/getinfo')).toBe(
                false
            );
        });

        it('returns false when .onion appears in the path', () => {
            expect(
                isOnionHttpsUrl('https://example.com/xyz.onion/v1/getinfo')
            ).toBe(false);
        });

        it('returns false when .onion appears in a query string', () => {
            expect(isOnionHttpsUrl('https://example.com/?host=xyz.onion')).toBe(
                false
            );
        });

        it('returns false when .onion appears in a fragment', () => {
            expect(isOnionHttpsUrl('https://example.com/#xyz.onion')).toBe(
                false
            );
        });

        it('returns false for hostnames that merely contain "onion"', () => {
            expect(isOnionHttpsUrl('https://onion-router.example.com/')).toBe(
                false
            );
        });

        it('returns false for a hostname where .onion is a non-trailing label', () => {
            expect(isOnionHttpsUrl('https://xyz.onion.evil.com/')).toBe(false);
        });

        it('returns false for a hostname suffixed with .onion-like text', () => {
            expect(isOnionHttpsUrl('https://foo.onionspoof.com/')).toBe(false);
        });

        it('returns false for unrelated schemes pointing at .onion', () => {
            expect(isOnionHttpsUrl('ws://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('wss://xyz.onion/socket')).toBe(false);
            expect(isOnionHttpsUrl('ftp://xyz.onion/file')).toBe(false);
        });

        it('returns false for invalid / unparseable URLs', () => {
            expect(isOnionHttpsUrl('')).toBe(false);
            expect(isOnionHttpsUrl('not a url')).toBe(false);
            expect(isOnionHttpsUrl('xyz.onion')).toBe(false); // no scheme
            expect(isOnionHttpsUrl('://xyz.onion')).toBe(false);
        });
    });
    describe('doTorRequest', () => {
        let warn: jest.SpyInstance;

        beforeEach(() => {
            jest.resetAllMocks();
            setTorRequestOutcomeListener(null);
            daemon.getStatus.mockResolvedValue(RUNNING as any);
            daemon.start.mockResolvedValue(RUNNING as any);
            request.mockResolvedValue(ok('{}'));
            warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        afterEach(() => warn.mockRestore());

        it('starts the daemon when it is not running', async () => {
            daemon.getStatus.mockResolvedValueOnce({ state: 'stopped' });

            await doTorRequest(ONION, RequestMethod.GET);

            expect(daemon.start).toHaveBeenCalledWith({
                dataDirectory: '/tmp/tor_data',
                socksPort: 9056,
                bootstrapTimeoutMs: 60000
            });
        });

        it('does not start the daemon when it is already running', async () => {
            await doTorRequest(ONION, RequestMethod.GET);

            expect(daemon.start).not.toHaveBeenCalled();
        });

        it('starts the daemon again after it dies following a successful start', async () => {
            daemon.getStatus
                .mockResolvedValueOnce({ state: 'stopped' })
                .mockResolvedValueOnce(RUNNING as any)
                .mockResolvedValueOnce({
                    state: 'failed',
                    error: { code: 'TOR_STOPPED', message: 'gone' }
                });

            await doTorRequest(ONION, RequestMethod.GET);
            await doTorRequest(ONION, RequestMethod.GET);
            await doTorRequest(ONION, RequestMethod.GET);

            expect(daemon.start).toHaveBeenCalledTimes(2);
        });

        it('shares one start between concurrent requests', async () => {
            daemon.getStatus.mockResolvedValue({ state: 'stopped' });

            await Promise.all([
                doTorRequest(ONION, RequestMethod.GET),
                doTorRequest(ONION, RequestMethod.GET),
                doTorRequest(ONION, RequestMethod.GET)
            ]);

            expect(daemon.start).toHaveBeenCalledTimes(1);
        });

        it('retries the start on the next request after a failed start', async () => {
            daemon.getStatus.mockResolvedValue({ state: 'stopped' });
            daemon.start.mockRejectedValueOnce(
                new TorError('BOOTSTRAP_TIMEOUT', 'timed out')
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('timed out');
            await doTorRequest(ONION, RequestMethod.GET);

            expect(daemon.start).toHaveBeenCalledTimes(2);
            expect(request).toHaveBeenCalledTimes(1);
        });

        it('sends GET without a body and stringifies header values', async () => {
            await doTorRequest(
                ONION,
                RequestMethod.GET,
                '{"ignored":true}',
                {
                    'Grpc-Metadata-macaroon': 'abc',
                    'X-Count': 3,
                    'X-Skip': null
                },
                false,
                5000
            );

            expect(request).toHaveBeenCalledWith({
                url: ONION,
                method: 'GET',
                headers: { 'Grpc-Metadata-macaroon': 'abc', 'X-Count': '3' },
                body: undefined,
                timeoutMs: 5000,
                allowInvalidCertificates: false
            });
        });

        it('sends the POST body and accepts headers as a JSON string', async () => {
            await doTorRequest(
                ONION,
                RequestMethod.POST,
                '{"amt":1}',
                '{"Content-Type":"application/json"}'
            );

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    body: '{"amt":1}',
                    headers: { 'Content-Type': 'application/json' },
                    timeoutMs: 60000
                })
            );
        });

        it('maps DELETE', async () => {
            await doTorRequest(ONION, RequestMethod.DELETE);

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'DELETE', body: undefined })
            );
        });

        it('rejects unsupported methods before touching the daemon', async () => {
            await expect(
                doTorRequest(ONION, 'patch' as RequestMethod)
            ).rejects.toThrow('Unsupported method: patch');
            expect(daemon.getStatus).not.toHaveBeenCalled();
        });

        it('allows invalid certificates for HTTPS .onion URLs', async () => {
            await doTorRequest(ONION, RequestMethod.GET, undefined, {}, true);

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({ allowInvalidCertificates: true })
            );
        });

        it('keeps TLS validation for clearnet URLs even when asked to trust', async () => {
            await doTorRequest(
                'https://example.com/v1/getinfo',
                RequestMethod.GET,
                undefined,
                {},
                true
            );

            expect(request).toHaveBeenCalledWith(
                expect.objectContaining({ allowInvalidCertificates: false })
            );
            expect(warn).toHaveBeenCalled();
        });

        it('returns the parsed JSON body', async () => {
            request.mockResolvedValue(ok('{"alias":"node"}'));

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).resolves.toEqual({ alias: 'node' });
        });

        it('returns a non-JSON body as a string', async () => {
            request.mockResolvedValue(ok('pong'));

            await expect(doTorRequest(ONION, RequestMethod.GET)).resolves.toBe(
                'pong'
            );
        });

        it('throws the node error message for HTTP error statuses', async () => {
            request.mockResolvedValue(
                ok('{"error":{"message":"invoice expired"}}', 500)
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('invoice expired');
        });

        it('throws a plain-text error body for HTTP error statuses', async () => {
            request.mockResolvedValue(ok('permission denied', 403));

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('permission denied');
        });

        it('falls back to the status code when the error body is empty', async () => {
            request.mockResolvedValue(ok('', 502));

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('HTTP 502');
        });

        it('reports a success to the outcome listener, including HTTP errors', async () => {
            const listener = jest.fn();
            setTorRequestOutcomeListener(listener);
            request.mockResolvedValueOnce(ok('{}'));
            request.mockResolvedValueOnce(ok('', 500));

            await doTorRequest(ONION, RequestMethod.GET);
            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow();

            expect(listener.mock.calls).toEqual([
                [true, ONION],
                [true, ONION]
            ]);
        });

        it('reports transport failures to the outcome listener', async () => {
            const listener = jest.fn();
            setTorRequestOutcomeListener(listener);
            request.mockRejectedValue(
                new TorError('HTTP_TIMEOUT', 'request timed out')
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('request timed out');

            expect(listener).toHaveBeenCalledWith(false, ONION);
        });

        it('does not report caller errors as transport failures', async () => {
            const listener = jest.fn();
            setTorRequestOutcomeListener(listener);
            request.mockRejectedValue(
                new TorError('INVALID_REQUEST', 'url must not be empty')
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow();

            expect(listener).not.toHaveBeenCalled();
        });

        it('retries a GET once when Tor stopped mid-request (Restart Tor)', async () => {
            request
                .mockRejectedValueOnce(
                    new TorError(
                        'TOR_STOPPED',
                        'Tor stopped before the HTTP request completed'
                    )
                )
                .mockResolvedValueOnce(ok('{"alias":"node"}'));
            daemon.getStatus
                .mockResolvedValueOnce(RUNNING as any)
                .mockResolvedValueOnce({ state: 'stopped' });

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).resolves.toEqual({ alias: 'node' });

            expect(request).toHaveBeenCalledTimes(2);
            expect(daemon.start).toHaveBeenCalledTimes(1);
        });

        it('does not retry a POST that Tor stopped mid-request, since the node may have received it', async () => {
            request.mockRejectedValue(
                new TorError(
                    'TOR_STOPPED',
                    'Tor stopped before the HTTP request completed'
                )
            );

            await expect(
                doTorRequest(ONION, RequestMethod.POST, '{"amt":1}')
            ).rejects.toThrow('Tor stopped');

            expect(request).toHaveBeenCalledTimes(1);
        });

        it('retries any method once when Tor was not running, since nothing was sent', async () => {
            request
                .mockRejectedValueOnce(
                    new TorError('NOT_RUNNING', 'Tor is not running')
                )
                .mockResolvedValueOnce(ok('{}'));

            await doTorRequest(ONION, RequestMethod.POST, '{"amt":1}');

            expect(request).toHaveBeenCalledTimes(2);
        });

        it('gives up after one retry', async () => {
            request.mockRejectedValue(
                new TorError(
                    'TOR_STOPPED',
                    'Tor stopped before the HTTP request completed'
                )
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('Tor stopped');

            expect(request).toHaveBeenCalledTimes(2);
        });

        it('retries a GET that hit a transport error because Tor restarted during it', async () => {
            // On device a GET cut off mid SOCKS connect by Restart Tor
            // fails with HTTP_TRANSPORT_ERROR, not TOR_STOPPED
            daemon.stop.mockResolvedValue(undefined);
            let restart: Promise<void> = Promise.resolve();
            request
                .mockImplementationOnce(() => {
                    restart = restartTor();
                    return Promise.reject(
                        new TorError(
                            'HTTP_TRANSPORT_ERROR',
                            'socks connect error: unexpected end of file'
                        )
                    );
                })
                .mockResolvedValueOnce(ok('{"alias":"node"}'));

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).resolves.toEqual({ alias: 'node' });
            await restart;

            expect(request).toHaveBeenCalledTimes(2);
        });

        it('resends only after the restart has finished', async () => {
            let finishStop: () => void = () => {};
            daemon.stop.mockReturnValue(
                new Promise<void>((resolve) => (finishStop = resolve))
            );
            daemon.getStatus
                .mockResolvedValueOnce(RUNNING as any)
                .mockResolvedValue({ state: 'stopped' });
            let restart: Promise<void> = Promise.resolve();
            request
                .mockImplementationOnce(() => {
                    restart = restartTor();
                    return Promise.reject(
                        new TorError('TOR_STOPPED', 'Tor stopped')
                    );
                })
                .mockResolvedValueOnce(ok('{}'));

            const pending = doTorRequest(ONION, RequestMethod.GET);
            await new Promise((r) => setImmediate(r));
            expect(request).toHaveBeenCalledTimes(1);

            finishStop();
            await pending;
            await restart;

            expect(request).toHaveBeenCalledTimes(2);
            expect(daemon.start.mock.invocationCallOrder[0]).toBeLessThan(
                request.mock.invocationCallOrder[1]
            );
        });

        it('does not retry a transport error when Tor was not restarted', async () => {
            request.mockRejectedValue(
                new TorError('HTTP_TRANSPORT_ERROR', 'connection refused')
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('connection refused');

            expect(request).toHaveBeenCalledTimes(1);
        });

        it('survives Restart Tor stopping the start it was waiting on', async () => {
            // Seen on iOS: requests waiting for Tor to start failed with
            // "Tor stopped during startup" when Restart Tor stopped that
            // start, although nothing had been sent yet
            daemon.getStatus.mockResolvedValue({ state: 'stopped' });
            let failStart: (e: Error) => void = () => {};
            daemon.start
                .mockReturnValueOnce(
                    new Promise((_, reject) => (failStart = reject))
                )
                .mockResolvedValue(RUNNING as any);
            daemon.stop.mockImplementation(async () => {
                failStart(
                    new TorError('TOR_STOPPED', 'Tor stopped during startup')
                );
            });

            const get = doTorRequest(ONION, RequestMethod.GET);
            const post = doTorRequest(ONION, RequestMethod.POST, '{"a":1}');
            await new Promise((r) => setImmediate(r));
            const restart = restartTor();

            await expect(get).resolves.toEqual({});
            await expect(post).resolves.toEqual({});
            await restart;
            expect(request).toHaveBeenCalledTimes(2);
        });

        it('still fails a start that fails with no restart involved', async () => {
            daemon.getStatus.mockResolvedValue({ state: 'stopped' });
            daemon.start.mockRejectedValue(
                new TorError('BOOTSTRAP_TIMEOUT', 'timed out')
            );

            await expect(
                doTorRequest(ONION, RequestMethod.GET)
            ).rejects.toThrow('timed out');
            expect(request).not.toHaveBeenCalled();
        });

        it('does not retry a POST transport error even when Tor restarted', async () => {
            daemon.stop.mockResolvedValue(undefined);
            let restart: Promise<void> = Promise.resolve();
            request.mockImplementationOnce(() => {
                restart = restartTor();
                return Promise.reject(
                    new TorError(
                        'HTTP_TRANSPORT_ERROR',
                        'unexpected end of file'
                    )
                );
            });

            await expect(
                doTorRequest(ONION, RequestMethod.POST, '{"amt":1}')
            ).rejects.toThrow('unexpected end of file');
            await restart;

            expect(request).toHaveBeenCalledTimes(1);
        });
    });

    describe('restartTor', () => {
        beforeEach(() => jest.clearAllMocks());

        it('stops the daemon and starts it again', async () => {
            daemon.stop.mockResolvedValue(undefined);
            daemon.getStatus.mockResolvedValue({ state: 'stopped' });
            daemon.start.mockResolvedValue(RUNNING as any);

            await restartTor();

            expect(daemon.stop).toHaveBeenCalled();
            expect(daemon.start).toHaveBeenCalledTimes(1);
            expect(daemon.stop.mock.invocationCallOrder[0]).toBeLessThan(
                daemon.start.mock.invocationCallOrder[0]
            );
        });
    });
});
