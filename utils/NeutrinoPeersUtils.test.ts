jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../lndmobile/log', () => () => ({
    d: jest.fn(),
    e: jest.fn()
}));

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        updateSettings: jest.fn()
    }
}));

jest.mock('../stores/SettingsStore', () => ({
    DEFAULT_NEUTRINO_PEERS_MAINNET: ['peer-a.example', 'peer-b.example'],
    DEFAULT_NEUTRINO_PEERS_TESTNET: ['testnet-a.example'],
    SECONDARY_NEUTRINO_PEERS_MAINNET: [['secondary-a.example']]
}));

import {
    BITCOIN_MAINNET_P2P_PORT,
    BITCOIN_TESTNET_P2P_PORT,
    NEUTRINO_DNS_SERVICE_BITS,
    NEUTRINO_PING_THRESHOLD_MS,
    bitcoinP2pPort,
    discoverNeutrinoPeersFromDns,
    dnsSeedFqdnWithServices,
    parseNeutrinoPeerEndpoint,
    pingPeer,
    probeNeutrinoPeer,
    selectNeutrinoPeersByLatency
} from './NeutrinoPeersUtils';

type MockFetchInit = {
    signal?: {
        addEventListener: (event: string, listener: () => void) => void;
    };
};

const mockFetch = jest.fn();
const originalFetch = global.fetch;

describe('NeutrinoPeersUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch as typeof fetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    describe('bitcoinP2pPort', () => {
        it('returns mainnet and testnet ports', () => {
            expect(bitcoinP2pPort(false)).toBe(BITCOIN_MAINNET_P2P_PORT);
            expect(bitcoinP2pPort(true)).toBe(BITCOIN_TESTNET_P2P_PORT);
        });
    });

    describe('NEUTRINO_DNS_SERVICE_BITS', () => {
        it('requires network, witness, and compact filters (x49)', () => {
            expect(NEUTRINO_DNS_SERVICE_BITS).toBe(0x49);
        });
    });

    describe('parseNeutrinoPeerEndpoint', () => {
        const defaultPort = BITCOIN_MAINNET_P2P_PORT;

        it('parses bare hostnames with default port', () => {
            expect(
                parseNeutrinoPeerEndpoint('btcd1.lnolymp.us', defaultPort)
            ).toEqual({
                host: 'btcd1.lnolymp.us',
                port: defaultPort
            });
        });

        it('parses IPv4 host:port', () => {
            expect(
                parseNeutrinoPeerEndpoint('192.168.0.1:18333', defaultPort)
            ).toEqual({
                host: '192.168.0.1',
                port: 18333
            });
        });

        it('parses bracketed IPv6:port', () => {
            expect(
                parseNeutrinoPeerEndpoint('[2001:db8::1]:8333', defaultPort)
            ).toEqual({
                host: '2001:db8::1',
                port: 8333
            });
        });

        it('ignores non-numeric port suffixes', () => {
            expect(
                parseNeutrinoPeerEndpoint('host:with:colons', defaultPort)
            ).toEqual({
                host: 'host:with:colons',
                port: defaultPort
            });
        });

        it('treats trailing colon as bare host', () => {
            expect(parseNeutrinoPeerEndpoint('host:', defaultPort)).toEqual({
                host: 'host:',
                port: defaultPort
            });
        });
    });

    describe('dnsSeedFqdnWithServices', () => {
        it('prefixes normal seeds with service hex', () => {
            expect(
                dnsSeedFqdnWithServices(
                    'seed.bitcoin.sipa.be',
                    NEUTRINO_DNS_SERVICE_BITS
                )
            ).toBe('x49.seed.bitcoin.sipa.be');
        });

        it('skips prefix for IPv4 literals', () => {
            expect(dnsSeedFqdnWithServices('1.2.3.4', 0x49)).toBe('1.2.3.4');
        });

        it('skips prefix for bare IPv6 literals', () => {
            expect(dnsSeedFqdnWithServices('2001:db8::1', 0x49)).toBe(
                '2001:db8::1'
            );
        });

        it('skips prefix for bracketed IPv6 with port', () => {
            expect(dnsSeedFqdnWithServices('[2001:db8::1]:8333', 0x49)).toBe(
                '[2001:db8::1]:8333'
            );
        });

        it('skips prefix for onion and i2p hosts', () => {
            expect(
                dnsSeedFqdnWithServices(
                    'abc123.onion',
                    NEUTRINO_DNS_SERVICE_BITS
                )
            ).toBe('abc123.onion');
            expect(
                dnsSeedFqdnWithServices('abc.i2p', NEUTRINO_DNS_SERVICE_BITS)
            ).toBe('abc.i2p');
        });

        it('skips prefix for localhost', () => {
            expect(
                dnsSeedFqdnWithServices('localhost', NEUTRINO_DNS_SERVICE_BITS)
            ).toBe('localhost');
        });
    });

    describe('selectNeutrinoPeersByLatency', () => {
        it('picks fastest peers within strict tiers first', () => {
            const selected = selectNeutrinoPeersByLatency(
                [
                    { peer: 'slow', ms: 900 },
                    { peer: 'fast', ms: 120 },
                    { peer: 'mid', ms: 400 },
                    { peer: 'unreachable', ms: 'Unreachable' },
                    { peer: 'timeout', ms: 'Timed out' }
                ],
                3
            );

            expect(selected).toEqual(['fast', 'mid', 'slow']);
        });

        it('fills from looser tiers when strict tier is sparse', () => {
            const selected = selectNeutrinoPeersByLatency(
                [
                    { peer: 'a', ms: 750 },
                    { peer: 'b', ms: 850 },
                    { peer: 'c', ms: 950 }
                ],
                2
            );

            expect(selected).toEqual(['a', 'b']);
        });

        it('excludes peers at or above threshold', () => {
            const selected = selectNeutrinoPeersByLatency(
                [
                    { peer: 'ok', ms: NEUTRINO_PING_THRESHOLD_MS - 1 },
                    { peer: 'too-slow', ms: NEUTRINO_PING_THRESHOLD_MS }
                ],
                3
            );

            expect(selected).toEqual(['ok']);
        });

        it('dedupes duplicate peer strings', () => {
            const selected = selectNeutrinoPeersByLatency(
                [
                    { peer: 'peer-a', ms: 100 },
                    { peer: 'peer-a', ms: 150 }
                ],
                3
            );

            expect(selected).toEqual(['peer-a']);
        });
    });

    describe('probeNeutrinoPeer', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('reports timeout when fetch aborts', async () => {
            mockFetch.mockImplementation((_url, opts: MockFetchInit) => {
                return new Promise((_resolve, reject) => {
                    opts.signal?.addEventListener('abort', () =>
                        reject(new Error('aborted'))
                    );
                });
            });

            const resultPromise = probeNeutrinoPeer('peer.example', 1000, 8333);
            jest.advanceTimersByTime(1000);

            await expect(resultPromise).resolves.toEqual({
                ms: expect.any(Number),
                reachable: false,
                timedOut: true
            });
            expect(mockFetch).toHaveBeenCalledWith(
                'http://peer.example:8333',
                expect.objectContaining({ method: 'HEAD' })
            );
        });

        it('reports unreachable on DNS failure hints', async () => {
            mockFetch.mockRejectedValue(new Error('unable to resolve host'));

            await expect(
                probeNeutrinoPeer('missing.example', 5000, 8333)
            ).resolves.toEqual({
                ms: expect.any(Number),
                reachable: false,
                timedOut: false
            });
        });

        it('treats slow generic errors as reachable peers', async () => {
            let now = 0;
            jest.spyOn(global.performance, 'now').mockImplementation(() => {
                now += 150;
                return now;
            });
            mockFetch.mockRejectedValue(new Error('Network request failed'));

            await expect(
                probeNeutrinoPeer('peer.example', 5000, 8333)
            ).resolves.toEqual({
                ms: 300,
                reachable: true,
                timedOut: false
            });

            jest.spyOn(global.performance, 'now').mockRestore();
        });

        it('throws for invalid host with scheme', async () => {
            await expect(
                probeNeutrinoPeer('http://bad', 1000, 8333)
            ).rejects.toThrow(
                'views.Settings.EmbeddedNode.NeutrinoPeers.invalidHost'
            );
        });
    });

    describe('pingPeer', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('throws localized error on timeout', async () => {
            mockFetch.mockImplementation((_url, opts: MockFetchInit) => {
                return new Promise((_resolve, reject) => {
                    opts.signal?.addEventListener('abort', () =>
                        reject(new Error('aborted'))
                    );
                });
            });

            const pingPromise = pingPeer('peer.example', 500, 8333);
            jest.advanceTimersByTime(500);

            await expect(pingPromise).rejects.toThrow(
                'views.Settings.EmbeddedNode.NeutrinoPeers.timedOut'
            );
        });

        it('returns latency when peer responds', async () => {
            let now = 0;
            jest.spyOn(global.performance, 'now').mockImplementation(() => {
                now += 80;
                return now;
            });
            mockFetch.mockResolvedValue({ ok: true });

            await expect(pingPeer('peer.example', 5000, 8333)).resolves.toEqual(
                {
                    ms: 80,
                    reachable: true
                }
            );

            jest.spyOn(global.performance, 'now').mockRestore();
        });
    });

    describe('discoverNeutrinoPeersFromDns', () => {
        it('queries filtered DNS seeds and returns ip:port endpoints', async () => {
            const requestedUrls: string[] = [];
            mockFetch.mockImplementation((url: string) => {
                requestedUrls.push(url);
                if (url.includes('x49.seed.bitcoin.sipa.be')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                Status: 0,
                                Answer: [{ type: 1, data: '203.0.113.10' }]
                            })
                    });
                }
                return Promise.resolve({ ok: false });
            });

            const peers = await discoverNeutrinoPeersFromDns(false, {
                maxAddresses: 1,
                queryTimeoutMs: 100,
                totalTimeoutMs: 500
            });

            expect(peers).toEqual(['203.0.113.10:8333']);
            expect(
                requestedUrls.some((u) =>
                    u.includes('x49.seed.bitcoin.sipa.be')
                )
            ).toBe(true);
        });

        it('uses testnet port for testnet discovery', async () => {
            mockFetch.mockImplementation((url: string) => {
                if (url.includes('x49.testnet-seed.bluematt.me')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                Status: 0,
                                Answer: [{ type: 1, data: '198.51.100.4' }]
                            })
                    });
                }
                return Promise.resolve({ ok: false });
            });

            const peers = await discoverNeutrinoPeersFromDns(true, {
                maxAddresses: 1,
                queryTimeoutMs: 100,
                totalTimeoutMs: 500
            });

            expect(peers).toEqual(['198.51.100.4:18333']);
        });

        it('falls back to the next DoH resolver', async () => {
            mockFetch.mockImplementation((url: string) => {
                if (url.includes('cloudflare-dns.com')) {
                    return Promise.reject(new Error('cloudflare down'));
                }
                if (url.includes('dns.google')) {
                    return Promise.resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                Status: 0,
                                Answer: [{ type: 1, data: '192.0.2.1' }]
                            })
                    });
                }
                return Promise.resolve({ ok: false });
            });

            const peers = await discoverNeutrinoPeersFromDns(false, {
                maxAddresses: 1,
                queryTimeoutMs: 100,
                totalTimeoutMs: 500
            });

            expect(peers.length).toBe(1);
            expect(peers[0]).toMatch(/^192\.0\.2\.1:8333$/);
            expect(
                mockFetch.mock.calls.some((c) =>
                    String(c[0]).includes('dns.google')
                )
            ).toBe(true);
        });
    });
});
