jest.mock('./LocaleUtils', () => ({
    localeString: (key: string) => key
}));

jest.mock('../lndmobile/log', () => () => ({
    d: jest.fn(),
    e: jest.fn()
}));

jest.mock('../stores/Stores', () => ({
    settingsStore: {
        settings: {
            neutrinoPeersMainnet: ['peer-a.example', 'peer-b.example'],
            neutrinoPeersTestnet: ['testnet-a.example']
        },
        updateSettings: jest.fn()
    }
}));

jest.mock('../lndmobile/LndMobileInjection', () => ({
    index: { neutrinoKitStatus: jest.fn() }
}));

jest.mock('./SleepUtils', () => ({
    sleep: jest.fn().mockResolvedValue(undefined)
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
    isWeakNeutrinoProbeOutcome,
    parseNeutrinoPeerEndpoint,
    pingPeer,
    optimizeNeutrinoPeers,
    probeNeutrinoPeer,
    probeNeutrinoPeerList,
    selectNeutrinoPeersByLatency,
    waitForNeutrinoPeers
} from './NeutrinoPeersUtils';
import lndMobile from '../lndmobile/LndMobileInjection';
import { settingsStore } from '../stores/Stores';

const neutrinoKitStatusMock = lndMobile.index
    .neutrinoKitStatus as unknown as jest.Mock;

const dohAnswer = (ips: string[]) => ({
    ok: true,
    json: async () => ({
        Status: 0,
        Answer: ips.map((data) => ({ type: 1, data }))
    })
});

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

        it('parses bare IPv6 with default port', () => {
            expect(
                parseNeutrinoPeerEndpoint('2001:db8::1', defaultPort)
            ).toEqual({
                host: '2001:db8::1',
                port: defaultPort
            });
            expect(parseNeutrinoPeerEndpoint('::1', defaultPort)).toEqual({
                host: '::1',
                port: defaultPort
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

    describe('isWeakNeutrinoProbeOutcome', () => {
        it('flags timeout, unreachable, and high latency', () => {
            expect(isWeakNeutrinoProbeOutcome('Timed out')).toBe(true);
            expect(isWeakNeutrinoProbeOutcome('Unreachable')).toBe(true);
            expect(
                isWeakNeutrinoProbeOutcome(NEUTRINO_PING_THRESHOLD_MS + 1)
            ).toBe(true);
        });

        it('accepts healthy latency', () => {
            expect(isWeakNeutrinoProbeOutcome(NEUTRINO_PING_THRESHOLD_MS)).toBe(
                false
            );
        });
    });

    describe('probeNeutrinoPeerList', () => {
        it('probes all peers at once', async () => {
            let inFlight = 0;
            let maxInFlight = 0;
            mockFetch.mockImplementation(async () => {
                inFlight++;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await Promise.resolve();
                inFlight--;
                return { ok: true };
            });

            const probes = await probeNeutrinoPeerList(
                ['a.example', 'b.example', 'c.example'],
                BITCOIN_MAINNET_P2P_PORT
            );

            expect(probes.map((probe) => probe.peer)).toEqual([
                'a.example',
                'b.example',
                'c.example'
            ]);
            expect(maxInFlight).toBe(3);
        });

        it('reports a peer that cannot be probed as unreachable instead of throwing', async () => {
            mockFetch.mockResolvedValue({ ok: true });

            const probes = await probeNeutrinoPeerList(
                ['http://bad.example', 'good.example'],
                BITCOIN_MAINNET_P2P_PORT
            );

            expect(probes[0]).toEqual({
                peer: 'http://bad.example',
                ms: 'Unreachable'
            });
            expect(typeof probes[1].ms).toBe('number');
        });

        it('treats a refused connection as unreachable, however long it took', async () => {
            // Slow enough that the elapsed-time check alone would call it
            // reachable
            let now = 0;
            const nowSpy = jest
                .spyOn(global.performance, 'now')
                .mockImplementation(() => (now += 150));
            mockFetch.mockRejectedValue(
                new Error(
                    'Failed to connect: ECONNREFUSED (Connection refused)'
                )
            );

            const probes = await probeNeutrinoPeerList(
                ['down.example'],
                BITCOIN_MAINNET_P2P_PORT
            );

            expect(probes).toEqual([
                { peer: 'down.example', ms: 'Unreachable' }
            ]);
            // The React Native jest preset makes performance.now a
            // jest.fn(Date.now); mockRestore would wipe that, so put it back
            nowSpy.mockImplementation(() => Date.now());
        });
    });

    describe('waitForNeutrinoPeers', () => {
        it('returns as soon as neutrino reports a connected peer', async () => {
            neutrinoKitStatusMock
                .mockResolvedValueOnce({ peers: [] })
                .mockResolvedValueOnce({ peers: ['1.2.3.4:8333'] });

            const peers = await waitForNeutrinoPeers(() => true, 30000, 0);

            expect(peers).toEqual(['1.2.3.4:8333']);
            expect(neutrinoKitStatusMock).toHaveBeenCalledTimes(2);
        });

        it('returns an empty list when neutrino answers but never connects', async () => {
            neutrinoKitStatusMock.mockResolvedValue({ peers: [] });

            const peers = await waitForNeutrinoPeers(() => true, 0, 0);

            expect(peers).toEqual([]);
        });

        it('returns null when neutrino cannot report its status', async () => {
            neutrinoKitStatusMock.mockRejectedValue(
                new Error('unknown service neutrinorpc.NeutrinoKit')
            );

            const peers = await waitForNeutrinoPeers(() => true, 0, 0);

            expect(peers).toBeNull();
        });

        it('stops once the connection is no longer current', async () => {
            let current = true;
            neutrinoKitStatusMock.mockImplementation(async () => {
                current = false;
                return { peers: [] };
            });

            const peers = await waitForNeutrinoPeers(() => current, 30000, 0);

            expect(peers).toBeNull();
            expect(neutrinoKitStatusMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('optimizeNeutrinoPeers', () => {
        afterEach(() => {
            (settingsStore.settings as any).embeddedTor = false;
        });

        it('never makes seed-discovered peers the only allowed peers', async () => {
            mockFetch.mockImplementation((url: string) => {
                if (url.startsWith('https://')) {
                    return Promise.resolve(
                        dohAnswer(['1.1.1.10', '1.1.1.11', '1.1.1.12'])
                    );
                }
                if (url.includes('.example')) {
                    return Promise.reject(new Error('unable to resolve host'));
                }
                return Promise.resolve({ ok: true });
            });

            const selected = await optimizeNeutrinoPeers(false);

            expect(selected).toHaveLength(3);
            expect(settingsStore.updateSettings).toHaveBeenCalledWith(
                expect.objectContaining({ dontAllowOtherPeers: false })
            );
        });

        it('keeps curated peers exclusive when they fill the list', async () => {
            mockFetch.mockImplementation((url: string) =>
                url.startsWith('https://')
                    ? Promise.reject(new Error('offline'))
                    : Promise.resolve({ ok: true })
            );

            const selected = await optimizeNeutrinoPeers(false);

            expect(selected).toHaveLength(3);
            expect(settingsStore.updateSettings).toHaveBeenCalledWith(
                expect.objectContaining({ dontAllowOtherPeers: true })
            );
        });

        it('skips DNS-over-HTTPS discovery while embedded Tor is on', async () => {
            (settingsStore.settings as any).embeddedTor = true;
            mockFetch.mockRejectedValue(new Error('unable to resolve host'));

            const selected = await optimizeNeutrinoPeers(false);

            expect(selected).toEqual([]);
            expect(
                mockFetch.mock.calls.some(([url]) =>
                    String(url).startsWith('https://')
                )
            ).toBe(false);
            expect(settingsStore.updateSettings).not.toHaveBeenCalled();
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

        it('treats fast generic errors as reachable peers', async () => {
            let now = 0;
            jest.spyOn(global.performance, 'now').mockImplementation(() => {
                now += 60;
                return now;
            });
            mockFetch.mockRejectedValue(new Error('Network request failed'));

            await expect(
                probeNeutrinoPeer('peer.example', 5000, 8333)
            ).resolves.toEqual({
                ms: 120,
                reachable: true,
                timedOut: false
            });
        });

        it('treats instant generic errors as unreachable', async () => {
            let now = 0;
            jest.spyOn(global.performance, 'now').mockImplementation(() => {
                now += 10;
                return now;
            });
            mockFetch.mockRejectedValue(new Error('Network request failed'));

            await expect(
                probeNeutrinoPeer('peer.example', 5000, 8333)
            ).resolves.toEqual({
                ms: 20,
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
