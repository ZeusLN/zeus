/**
 * Embedded-LND neutrino peers: TCP latency probes, DNS discovery for compact-filter
 * seeds, and tiered latency selection for persisted peer lists.
 */

import Log from '../lndmobile/log';

import { localeString } from './LocaleUtils';

import { settingsStore } from '../stores/Stores';
import {
    DEFAULT_NEUTRINO_PEERS_MAINNET,
    DEFAULT_NEUTRINO_PEERS_TESTNET,
    SECONDARY_NEUTRINO_PEERS_MAINNET
} from '../stores/SettingsStore';

const log = Log('utils/NeutrinoPeersUtils.ts');

// Ports
export const BITCOIN_MAINNET_P2P_PORT = 8333;
export const BITCOIN_TESTNET_P2P_PORT = 18333;

// Probe timeouts (ms)
export const NEUTRINO_PING_TIMEOUT_MS = 3200;
/** Background health checks — more lenient than optimize probes (radio warm-up). */
export const NEUTRINO_HEALTHCHECK_PROBE_TIMEOUT_MS = 5500;
const NEUTRINO_OPTIMIZE_PROBE_TIMEOUT_MS = 2400;

// Latency tiers for peer selection (ms)
export const NEUTRINO_PING_OPTIMAL_MS = 200;
export const NEUTRINO_PING_LAX_MS = 500;
export const NEUTRINO_PING_THRESHOLD_MS = 1000;

const LATENCY_TIER_MAX_MS = [
    NEUTRINO_PING_OPTIMAL_MS,
    NEUTRINO_PING_LAX_MS,
    NEUTRINO_PING_THRESHOLD_MS
] as const;

// Bitcoin nServices (protocol.h) — NODE_NETWORK | NODE_WITNESS | NODE_COMPACT_FILTERS
const BITCOIN_NODE_NETWORK = 1 << 0;
const BITCOIN_NODE_WITNESS = 1 << 3;
const BITCOIN_NODE_COMPACT_FILTERS = 1 << 6;

export const NEUTRINO_DNS_SERVICE_BITS =
    BITCOIN_NODE_NETWORK | BITCOIN_NODE_WITNESS | BITCOIN_NODE_COMPACT_FILTERS;

const MAINNET_DNS_SEEDS = [
    'seed.bitcoin.sipa.be',
    'dnsseed.bluematt.me',
    'dnsseed.bitcoin.dashjr-list-of-p2p-nodes.us',
    'seed.bitcoin.jonasschnelli.ch',
    'seed.btc.petertodd.net',
    'seed.bitcoin.sprovoost.nl',
    'dnsseed.emzy.de',
    'seed.bitcoin.wiz.biz',
    'seed.mainnet.achownodes.xyz'
];

const TESTNET_DNS_SEEDS = [
    'testnet-seed.bitcoin.jonasschnelli.ch',
    'seed.tbtc.petertodd.net',
    'seed.testnet.bitcoin.sprovoost.nl',
    'testnet-seed.bluematt.me',
    'seed.testnet.achownodes.xyz'
];

const OPTIMIZE_PROBE_CONCURRENCY = 4;
const DNS_PROBE_PEER_CAP = 20;
const DNS_RESOLVE_ADDRESS_CAP = 28;
const DNS_DISCOVERY_TOTAL_TIMEOUT_MS = 5200;
const PER_SEED_DNS_TIMEOUT_MS = 2800;
const DNS_SEED_PARALLEL_BATCH = 4;

const DNS_FAILURE_MESSAGE_HINTS = [
    'unable to resolve host',
    'no address associated',
    'could not find the server',
    'cannot find host',
    'nodename nor servname',
    'hostname could not be found',
    'not known'
];

const MIN_REACHABLE_ELAPSED_MS = 100;

export interface PingResult {
    ms: number;
    reachable: boolean;
}

export interface NeutrinoProbeResult extends PingResult {
    timedOut: boolean;
}

export type NeutrinoProbeOutcome = number | 'Timed out' | 'Unreachable';

export type NeutrinoProbeRecord = {
    peer: string;
    ms: NeutrinoProbeOutcome;
};

interface DnsJsonAnswer {
    type: number;
    data: string;
}

interface DnsJsonResponse {
    Status: number;
    Answer?: DnsJsonAnswer[];
}

type RankedProbe = { peer: string; ms: number };

export function bitcoinP2pPort(isTestnet: boolean): number {
    return isTestnet ? BITCOIN_TESTNET_P2P_PORT : BITCOIN_MAINNET_P2P_PORT;
}

/** hostname, IPv4:port, or [IPv6]:port */
export function parseNeutrinoPeerEndpoint(
    peer: string,
    defaultPort: number
): { host: string; port: number } {
    if (peer.startsWith('[')) {
        const closing = peer.indexOf(']:');
        if (closing !== -1) {
            const interior = peer.slice(1, closing);
            const portPart = peer.slice(closing + 2);
            const p = parseInt(portPart, 10);
            return {
                host: interior,
                port: Number.isFinite(p) ? p : defaultPort
            };
        }
    }

    const lastColon = peer.lastIndexOf(':');
    if (lastColon <= 0 || lastColon === peer.length - 1) {
        return { host: peer, port: defaultPort };
    }

    const hostPart = peer.slice(0, lastColon);
    const portPart = peer.slice(lastColon + 1);
    if (/^\d+$/.test(portPart)) {
        const p = parseInt(portPart, 10);
        return {
            host: hostPart,
            port: Number.isFinite(p) ? p : defaultPort
        };
    }

    return { host: peer, port: defaultPort };
}

/**
 * Build DoH lookup hostname (`x49.seed.example.com`) unless Core exempts the host
 * (literal IP, onion, i2p, localhost).
 */
export function dnsSeedFqdnWithServices(
    seedHost: string,
    requiredServices: number
): string {
    const raw = seedHost.trim();
    const lower = raw.toLowerCase();

    if (lower === 'localhost') {
        return raw;
    }

    const bracketIpv6 =
        raw.startsWith('[') && raw.includes(']:')
            ? raw.slice(1, raw.indexOf(']:'))
            : null;

    if (
        bracketIpv6 ||
        isBareIpv6(raw) ||
        isBareIpv4(raw) ||
        lower.includes('.onion') ||
        lower.includes('.i2p')
    ) {
        return raw;
    }

    return `x${requiredServices.toString(16)}.${raw}`;
}

export async function probeNeutrinoPeer(
    peer: string,
    timeoutMs: number,
    defaultPort: number
): Promise<NeutrinoProbeResult> {
    const { host, port } = parseNeutrinoPeerEndpoint(peer, defaultPort);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = global.performance.now();

    if (host.includes('://')) {
        clearTimeout(timer);
        throw new Error(
            localeString(
                'views.Settings.EmbeddedNode.NeutrinoPeers.invalidHost'
            )
        );
    }

    let reachable = false;
    try {
        await fetch(peerProbeUrl(host, port), {
            method: 'HEAD',
            signal: controller.signal
        });
        reachable = true;
    } catch (e: any) {
        if (controller.signal.aborted) {
            return {
                ms: elapsedMs(start),
                reachable: false,
                timedOut: true
            };
        }

        if (dnsFailureHintInMessage(String(e?.message ?? ''))) {
            reachable = false;
        } else {
            reachable =
                global.performance.now() - start >= MIN_REACHABLE_ELAPSED_MS;
        }
    } finally {
        clearTimeout(timer);
    }

    return {
        ms: elapsedMs(start),
        reachable,
        timedOut: false
    };
}

export async function pingPeer(
    peer: string,
    timeout: number = NEUTRINO_PING_TIMEOUT_MS,
    defaultPort: number = BITCOIN_MAINNET_P2P_PORT
): Promise<PingResult> {
    const result = await probeNeutrinoPeer(peer, timeout, defaultPort);
    if (result.timedOut) {
        throw new Error(
            localeString('views.Settings.EmbeddedNode.NeutrinoPeers.timedOut')
        );
    }
    return { ms: result.ms, reachable: result.reachable };
}

export async function discoverNeutrinoPeersFromDns(
    isTestnet: boolean,
    options?: {
        maxAddresses?: number;
        queryTimeoutMs?: number;
        totalTimeoutMs?: number;
    }
): Promise<string[]> {
    const maxAddresses = options?.maxAddresses ?? DNS_RESOLVE_ADDRESS_CAP;
    const queryTimeoutMs = options?.queryTimeoutMs ?? PER_SEED_DNS_TIMEOUT_MS;
    const totalTimeoutMs =
        options?.totalTimeoutMs ?? DNS_DISCOVERY_TOTAL_TIMEOUT_MS;
    const port = bitcoinP2pPort(isTestnet);
    const seeds = [...(isTestnet ? TESTNET_DNS_SEEDS : MAINNET_DNS_SEEDS)];

    shuffleInPlace(seeds);

    const discoveryStarted = global.performance.now();
    const overBudget = () =>
        global.performance.now() - discoveryStarted >= totalTimeoutMs;

    const seenIp = new Set<string>();
    const endpoints: string[] = [];

    for (
        let i = 0;
        i < seeds.length && endpoints.length < maxAddresses && !overBudget();
        i += DNS_SEED_PARALLEL_BATCH
    ) {
        const wave = seeds.slice(i, i + DNS_SEED_PARALLEL_BATCH);
        const addressLists = await Promise.all(
            wave.map((seed) =>
                dnsLookupARecords(
                    dnsSeedFqdnWithServices(seed, NEUTRINO_DNS_SERVICE_BITS),
                    queryTimeoutMs
                )
            )
        );

        for (const ips of addressLists) {
            for (const ip of ips) {
                if (seenIp.has(ip)) {
                    continue;
                }
                seenIp.add(ip);
                endpoints.push(`${ip}:${port}`);
                if (endpoints.length >= maxAddresses) {
                    shuffleInPlace(endpoints);
                    return endpoints;
                }
            }
        }
    }

    shuffleInPlace(endpoints);
    return endpoints;
}

export function selectNeutrinoPeersByLatency(
    probes: NeutrinoProbeRecord[],
    targetCount: number,
    defaultPort: number = BITCOIN_MAINNET_P2P_PORT
): string[] {
    const ranked = probes
        .filter(
            (probe): probe is RankedProbe =>
                typeof probe.ms === 'number' && Number.isInteger(probe.ms)
        )
        .sort((a, b) => a.ms - b.ms);

    const picked: string[] = [];
    const seenHosts = new Set<string>();

    for (const tierMaxMs of LATENCY_TIER_MAX_MS) {
        for (const row of ranked) {
            if (picked.length >= targetCount) {
                return picked;
            }
            if (row.ms >= tierMaxMs) {
                continue;
            }

            const hostKey = peerHostKey(row.peer, defaultPort);
            if (seenHosts.has(hostKey)) {
                continue;
            }

            seenHosts.add(hostKey);
            picked.push(row.peer);
        }
    }

    return picked;
}

export function isWeakNeutrinoProbeOutcome(ms: NeutrinoProbeOutcome): boolean {
    return (
        ms === 'Timed out' ||
        ms === 'Unreachable' ||
        (typeof ms === 'number' && ms > NEUTRINO_PING_THRESHOLD_MS)
    );
}

export async function probeNeutrinoPeerList(
    peers: string[],
    defaultPort: number,
    timeoutMs: number = NEUTRINO_HEALTHCHECK_PROBE_TIMEOUT_MS
): Promise<NeutrinoProbeRecord[]> {
    const records: NeutrinoProbeRecord[] = [];

    for (const peer of peers) {
        const result = await probeNeutrinoPeer(peer, timeoutMs, defaultPort);
        records.push(
            result.timedOut
                ? { peer, ms: 'Timed out' }
                : {
                      peer,
                      ms: result.reachable ? result.ms : 'Unreachable'
                  }
        );
    }

    return records;
}

/**
 * On app restart, probe persisted peers and re-optimize if any are weak.
 * Must run before initializeLnd so LND starts with the updated peer list.
 */
export async function checkAndOptimizeNeutrinoPeersIfNeeded(
    isTestnet?: boolean
): Promise<boolean> {
    const testnet = !!isTestnet;
    const defaultPort = bitcoinP2pPort(testnet);
    const peers = testnet
        ? settingsStore.settings.neutrinoPeersTestnet
        : settingsStore.settings.neutrinoPeersMainnet;

    if (!peers?.length) {
        return false;
    }

    const probes = await probeNeutrinoPeerList(peers, defaultPort);
    log.d(`Neutrino startup check: ${formatNeutrinoProbeSummary(probes)}`);

    if (!probes.some((probe) => isWeakNeutrinoProbeOutcome(probe.ms))) {
        log.d('Neutrino startup check: all peers healthy');
        return false;
    }

    log.d('Neutrino startup check: weak peers detected, optimizing');
    await optimizeNeutrinoPeers(testnet);
    return true;
}

/**
 * Probe curated defaults, then DNS-derived IPs if needed, then mainnet secondary lists.
 * Persists latency-tiered peers; keeps existing settings when nothing is under threshold.
 */
export async function optimizeNeutrinoPeers(
    isTestnet?: boolean,
    peerTargetCount: number = 3
): Promise<void> {
    const testnet = !!isTestnet;
    const defaultPort = bitcoinP2pPort(testnet);
    const curatedDefaults = testnet
        ? DEFAULT_NEUTRINO_PEERS_TESTNET
        : DEFAULT_NEUTRINO_PEERS_MAINNET;

    const seenHosts = new Set<string>();
    const probes: NeutrinoProbeRecord[] = [];
    let selected: string[] = [];

    const probeAndSelect = async (peers: string[]) => {
        await benchmarkPeers(probes, peers, defaultPort);
        selected = selectNeutrinoPeersByLatency(
            probes,
            peerTargetCount,
            defaultPort
        );
    };

    await probeAndSelect(uniquePeers(curatedDefaults, seenHosts, defaultPort));

    if (selected.length < peerTargetCount) {
        let dnsEndpoints: string[] = [];
        try {
            dnsEndpoints = await discoverNeutrinoPeersFromDns(testnet);
            log.d(`DNS neutrino candidates resolved: ${dnsEndpoints.length}`);
        } catch (e) {
            log.d('DNS neutrino discovery failed', [e]);
        }

        if (dnsEndpoints.length > 0) {
            await probeAndSelect(
                uniquePeers(
                    dnsEndpoints,
                    seenHosts,
                    defaultPort,
                    DNS_PROBE_PEER_CAP
                )
            );
        }
    }

    if (selected.length < peerTargetCount && !testnet) {
        for (const group of SECONDARY_NEUTRINO_PEERS_MAINNET) {
            if (selected.length >= peerTargetCount) {
                break;
            }
            await probeAndSelect(uniquePeers(group, seenHosts, defaultPort));
        }
    }

    if (selected.length === 0) {
        log.d(
            'Neutrino optimize: no peers under latency tiers; keeping existing settings'
        );
        return;
    }

    const dontAllowOtherPeers = selected.length > 2;
    await settingsStore.updateSettings(
        testnet
            ? {
                  neutrinoPeersTestnet: selected,
                  dontAllowOtherPeers
              }
            : {
                  neutrinoPeersMainnet: selected,
                  dontAllowOtherPeers
              }
    );
    log.d(`Neutrino optimize: persisted peers: ${selected.join(', ')}`);
}

function isBareIpv4(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim());
}

function isBareIpv6(host: string): boolean {
    const trimmed = host.trim();
    return trimmed.includes(':') && !trimmed.includes('/');
}

function peerHostKey(peer: string, defaultPort: number): string {
    return parseNeutrinoPeerEndpoint(peer, defaultPort).host.toLowerCase();
}

function peerProbeUrl(host: string, port: number): string {
    const needsBrackets = host.includes(':') && !host.startsWith('[');
    const formattedHost = needsBrackets ? `[${host}]` : host;
    return `http://${formattedHost}:${port}`;
}

function elapsedMs(start: number): number {
    return Math.round(global.performance.now() - start);
}

function formatNeutrinoProbeSummary(probes: NeutrinoProbeRecord[]): string {
    return probes
        .map((probe) => {
            const outcome =
                typeof probe.ms === 'number' ? `${probe.ms}ms` : probe.ms;
            return `${probe.peer}=${outcome}`;
        })
        .join(', ');
}

function dnsFailureHintInMessage(message: string): boolean {
    const lower = message.toLowerCase();
    return DNS_FAILURE_MESSAGE_HINTS.some((hint) => lower.includes(hint));
}

function dohUrls(fqdn: string): string[] {
    const encoded = encodeURIComponent(fqdn);
    return [
        `https://cloudflare-dns.com/dns-query?name=${encoded}&type=A`,
        `https://dns.google/resolve?name=${encoded}&type=1`
    ];
}

function shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j]!, items[i]!];
    }
}

async function dnsLookupARecords(
    fqdn: string,
    timeoutMs: number
): Promise<string[]> {
    for (const url of dohUrls(fqdn)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/dns-json' },
                signal: controller.signal
            });
            if (!response.ok) {
                continue;
            }

            const json = (await response.json()) as DnsJsonResponse;
            if (json.Status !== 0 || !json.Answer?.length) {
                continue;
            }

            const ips = json.Answer.filter((a) => a.type === 1).map((a) =>
                a.data.trim()
            );
            if (ips.length) {
                shuffleInPlace(ips);
                return ips;
            }
        } catch {
            // try next resolver
        } finally {
            clearTimeout(timer);
        }
    }

    return [];
}

function uniquePeers(
    peers: string[],
    seenHosts: Set<string>,
    defaultPort: number,
    limit?: number
): string[] {
    const batch: string[] = [];
    const candidates = [...peers];
    shuffleInPlace(candidates);

    for (const peer of candidates) {
        const hostKey = peerHostKey(peer, defaultPort);
        if (seenHosts.has(hostKey)) {
            continue;
        }
        seenHosts.add(hostKey);
        batch.push(peer);
        if (limit !== undefined && batch.length >= limit) {
            break;
        }
    }

    return batch;
}

async function benchmarkPeers(
    probes: NeutrinoProbeRecord[],
    peers: string[],
    defaultPort: number
): Promise<void> {
    if (peers.length === 0) {
        return;
    }

    for (let i = 0; i < peers.length; i += OPTIMIZE_PROBE_CONCURRENCY) {
        const slice = peers.slice(i, i + OPTIMIZE_PROBE_CONCURRENCY);
        const chunk = await Promise.all(
            slice.map(async (peer): Promise<NeutrinoProbeRecord> => {
                const result = await probeNeutrinoPeer(
                    peer,
                    NEUTRINO_OPTIMIZE_PROBE_TIMEOUT_MS,
                    defaultPort
                );
                log.d(
                    `neutrino probe ${peer}: ${result.ms}ms ok=${result.reachable} to=${result.timedOut}`
                );
                if (result.timedOut) {
                    return { peer, ms: 'Timed out' };
                }
                return {
                    peer,
                    ms: result.reachable ? result.ms : 'Unreachable'
                };
            })
        );
        probes.push(...chunk);
    }
}
