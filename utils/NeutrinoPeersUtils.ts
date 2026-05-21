/**
 * Embedded-LND neutrino peers: TCP latency probes (RN `fetch` to Bitcoin P2P port), DNS discovery
 * for compact-filter-capable seeds, and tiered latency selection for persisted neutrino peer lists.
 *
 * Typical entry points: `pingPeer` / `probeNeutrinoPeer`, `discoverNeutrinoPeersFromDns`,
 * `optimizeNeutrinoPeers` (sequential probe waves → accumulated results → tiered picks).
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

// --- Bitcoin P2P ---------------------------------------------------------------------------

export const BITCOIN_MAINNET_P2P_PORT = 8333;
export const BITCOIN_TESTNET_P2P_PORT = 18333;

export function bitcoinP2pPort(isTestnet: boolean): number {
    return isTestnet ? BITCOIN_TESTNET_P2P_PORT : BITCOIN_MAINNET_P2P_PORT;
}

// --- Latency thresholds (used when choosing peers to persist) -----------------------------

/** Manual ping (stopwatch in settings): bitcoin P2P is not HTTP — RN `fetch` waits on TCP + teardown; keep generous on Android */
export const NEUTRINO_PING_TIMEOUT_MS = 3200;

/**
 * Background checks (e.g. AlertStore after unlock): device/Radio may still be warming up;
 * stricter than optimize probes but longer than historical 1500ms to avoid false timeouts.
 */
export const NEUTRINO_HEALTHCHECK_PROBE_TIMEOUT_MS = 5500;

/** Bulk optimize: slightly higher to reduce false timeouts on slow radios */
const NEUTRINO_OPTIMIZE_PROBE_TIMEOUT_MS = 2400;

export const NEUTRINO_PING_OPTIMAL_MS = 200;
export const NEUTRINO_PING_LAX_MS = 500;
export const NEUTRINO_PING_THRESHOLD_MS = 1000;

const LATENCY_TIER_MAX_MS = [
    NEUTRINO_PING_OPTIMAL_MS,
    NEUTRINO_PING_LAX_MS,
    NEUTRINO_PING_THRESHOLD_MS
] as const;

// --- Bitcoin nServices (Bitcoin Core src/protocol.h) ------------------------------------

/** NODE_NETWORK — historically required for block relay */
const BITCOIN_NODE_NETWORK = 1 << 0;
/** NODE_WITNESS — SegWit (BIP141) */
const BITCOIN_NODE_WITNESS = 1 << 3;
/** NODE_COMPACT_FILTERS — BIP157/158 (neutrino / compact block filters) */
const BITCOIN_NODE_COMPACT_FILTERS = 1 << 6;

/**
 * Bits advertised when querying filtered DNS seeds: full-history-capable relay + witness +
 * compact filters (`CBF_FULL_NODE`-style peer pool).
 */
export const NEUTRINO_DNS_SERVICE_BITS =
    BITCOIN_NODE_NETWORK | BITCOIN_NODE_WITNESS | BITCOIN_NODE_COMPACT_FILTERS;

/** Embedded-node neutrino today targets Bitcoin mainnet or testnet; omit Signet/regtest/onion seeds. */
const MAINNET_DNS_SEEDS = [
    'seed.bitcoin.sipa.be',
    'dnsseed.bluematt.me',
    'dnsseed.bitcoin.dashjr-list-of-p2p-nodes.us',
    'seed.bitcoin.jonasschnelli.ch',
    'seed.btc.petertodd.net',
    'seed.bitcoin.sprovoost.nl',
    'dnsseed.emzy.de',
    'seed.bitcoin.wiz.biz',
    // Ava Chow — filtered prefixes include x49 / NODE_COMPACT_FILTERS peers.
    'seed.mainnet.achownodes.xyz'
];

const TESTNET_DNS_SEEDS = [
    'testnet-seed.bitcoin.jonasschnelli.ch',
    'seed.tbtc.petertodd.net',
    'seed.testnet.bitcoin.sprovoost.nl',
    'testnet-seed.bluematt.me',
    'seed.testnet.achownodes.xyz'
];

const DNS_DOH_URLS = (fqdn: string) => [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(
        fqdn
    )}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(fqdn)}&type=1`
];

/** Cap parallel TCP probes during optimize (high concurrency tends to time out on mobile). */
const OPTIMIZE_PROBE_CONCURRENCY = 4;

/** Resolve from DNS but only probe a subset (defaults + latency matter more than raw pool size). */
const DNS_PROBE_PEER_CAP = 20;

/** Stop collecting DNS-derived IPs once we have enough candidates to probe */
const DNS_RESOLVE_ADDRESS_CAP = 28;

/** Overall DNS discovery budget (similar intent to Bitcoin Safe's batched resolve timeout). */
const DNS_DISCOVERY_TOTAL_TIMEOUT_MS = 5200;

const PER_SEED_DNS_TIMEOUT_MS = 2800;

/** Resolve seeds in small waves so we can bail early once the pool is full */
const DNS_SEED_PARALLEL_BATCH = 4;

/** Bare IPv4 dotted quad — literals skip `x{hex}.` (Bitcoin Safe `_seed_with_service_bits`). */
function isBareIpv4(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host.trim());
}

/** IPv6 literals skip service-prefix rewriting */
function looksLikeBareIpv6(host: string): boolean {
    const h = host.trim();
    return h.includes(':') && !h.includes('/');
}

/**
 * Build candidate hostname for DoH lookup (`x49.seed.example.com`) unless Core exempt host rule applies.
 */
function dnsSeedFqdnWithServices(
    seedHost: string,
    requiredServices: number
): string {
    const raw = seedHost.trim();
    const lower = raw.toLowerCase();

    if (lower === 'localhost') return raw;

    const bracketIpv6 =
        raw.startsWith('[') && raw.includes(']:')
            ? raw.slice(1, raw.indexOf(']:'))
            : null;

    if (bracketIpv6 || looksLikeBareIpv6(raw) || isBareIpv4(raw)) {
        return raw;
    }

    if (lower.includes('.onion') || lower.includes('.i2p')) {
        return raw;
    }

    const serviceHex = requiredServices.toString(16);
    return `x${serviceHex}.${raw}`;
}

// --- Types ---------------------------------------------------------------------------------

export interface PingResult {
    ms: number;
    reachable: boolean;
}

interface DnsJsonAnswer {
    type: number;
    data: string;
}

interface DnsJsonResponse {
    Status: number;
    Answer?: DnsJsonAnswer[];
}

export interface NeutrinoProbeResult extends PingResult {
    timedOut: boolean;
}

type ProbeRow = { peer: string; ms: number };

/** Raw probe outcome before latency-tier filtering (`optimizeNeutrinoPeers`). */
type ProbeOutcomeMs = number | 'Timed out' | 'Unreachable';

type ProbeRecord = { peer: string; ms: ProbeOutcomeMs };

// --- Parsing -------------------------------------------------------------------------------

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

// --- TCP reachability (same semantics as previous pingPeer implementation) ---------------

const DNS_FAILURE_MESSAGE_HINTS = [
    'unable to resolve host',
    'no address associated',
    'could not find the server',
    'cannot find host',
    'nodename nor servname',
    'hostname could not be found',
    'not known'
];

function dnsFailureHintInMessage(message: string): boolean {
    const msg = message.toLowerCase();
    return DNS_FAILURE_MESSAGE_HINTS.some((hint) => msg.includes(hint));
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
        await fetch(`http://${host}:${port}`, {
            method: 'HEAD',
            signal: controller.signal
        });
        reachable = true;
    } catch (e: any) {
        if (controller.signal.aborted) {
            return {
                ms: Math.round(global.performance.now() - start),
                reachable: false,
                timedOut: true
            };
        }
        const hasDnsHint = dnsFailureHintInMessage(String(e?.message ?? ''));
        if (hasDnsHint) {
            reachable = false;
        } else {
            const elapsed = global.performance.now() - start;
            reachable = elapsed >= 100;
        }
    } finally {
        clearTimeout(timer);
    }
    return {
        ms: Math.round(global.performance.now() - start),
        reachable,
        timedOut: false
    };
}

/** UI / settings: throws on timeout so callers can show “timed out”. */
export async function pingPeer(
    peer: string,
    timeout: number = NEUTRINO_PING_TIMEOUT_MS,
    defaultPort: number = BITCOIN_MAINNET_P2P_PORT
): Promise<PingResult> {
    const r = await probeNeutrinoPeer(peer, timeout, defaultPort);
    if (r.timedOut) {
        throw new Error(
            localeString('views.Settings.EmbeddedNode.NeutrinoPeers.timedOut')
        );
    }
    return { ms: r.ms, reachable: r.reachable };
}

// --- DNS -----------------------------------------------------------------------------------

function shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = items[i]!;
        items[i] = items[j]!;
        items[j] = tmp;
    }
}

async function dnsLookupARecords(
    fqdn: string,
    timeoutMs: number
): Promise<string[]> {
    const urls = DNS_DOH_URLS(fqdn);
    for (const url of urls) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/dns-json' },
                signal: controller.signal
            });
            if (!response.ok) continue;
            const json = (await response.json()) as DnsJsonResponse;
            if (json.Status !== 0 || !json.Answer?.length) continue;
            const ips = json.Answer.filter((a) => a.type === 1).map((a) =>
                a.data.trim()
            );
            if (ips.length) {
                shuffleInPlace(ips);
                return ips;
            }
        } catch {
            /* try next resolver */
        } finally {
            clearTimeout(timer);
        }
    }
    return [];
}

/**
 * Bitcoin DNS seeds filtered for compact block filters; returns `ip:port` endpoints.
 */
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
    const merged: string[] = [];

    for (
        let i = 0;
        i < seeds.length && merged.length < maxAddresses && !overBudget();
        i += DNS_SEED_PARALLEL_BATCH
    ) {
        const wave = seeds.slice(i, i + DNS_SEED_PARALLEL_BATCH);
        const lists = await Promise.all(
            wave.map((seed) =>
                dnsLookupARecords(
                    dnsSeedFqdnWithServices(seed, NEUTRINO_DNS_SERVICE_BITS),
                    queryTimeoutMs
                )
            )
        );

        for (const ips of lists) {
            for (const ip of ips) {
                if (seenIp.has(ip)) continue;
                seenIp.add(ip);
                merged.push(`${ip}:${port}`);
                if (merged.length >= maxAddresses) {
                    shuffleInPlace(merged);
                    return merged;
                }
            }
        }
    }

    shuffleInPlace(merged);
    return merged;
}

// --- Optimize ------------------------------------------------------------------------------

function peerDedupeKey(peer: string, defaultPort: number): string {
    return parseNeutrinoPeerEndpoint(peer, defaultPort).host.toLowerCase();
}

function appendUniquePeer(
    list: string[],
    seen: Set<string>,
    peer: string,
    defaultPort: number
): void {
    const key = peerDedupeKey(peer, defaultPort);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(peer);
}

function rowsFromProbes(probes: ProbeRecord[]): ProbeRow[] {
    return probes
        .filter(
            (p): p is { peer: string; ms: number } =>
                typeof p.ms === 'number' && Number.isInteger(p.ms)
        )
        .sort((a, b) => a.ms - b.ms);
}

/** Within each tier (strict → loose), peers are already sorted by latency ascending. */
function selectPeersByLatencyTiers(
    rankedAscending: ProbeRow[],
    targetCount: number
): string[] {
    const picked: string[] = [];
    const seen = new Set<string>();

    for (const tierMax of LATENCY_TIER_MAX_MS) {
        for (const row of rankedAscending) {
            if (picked.length >= targetCount) return picked;
            if (row.ms >= tierMax) continue;
            if (seen.has(row.peer)) continue;
            seen.add(row.peer);
            picked.push(row.peer);
        }
    }
    return picked;
}

async function benchmarkPeersConcurrently(
    peers: string[],
    defaultPort: number,
    timeoutMs: number,
    concurrency: number
): Promise<ProbeRecord[]> {
    const out: ProbeRecord[] = [];
    for (let i = 0; i < peers.length; i += concurrency) {
        const slice = peers.slice(i, i + concurrency);
        const chunk = await Promise.all(
            slice.map(async (peer): Promise<ProbeRecord> => {
                const r = await probeNeutrinoPeer(peer, timeoutMs, defaultPort);
                log.d(
                    `neutrino probe ${peer}: ${r.ms}ms ok=${r.reachable} to=${r.timedOut}`
                );
                if (r.timedOut) {
                    return { peer, ms: 'Timed out' };
                }
                return {
                    peer,
                    ms: r.reachable ? r.ms : 'Unreachable'
                };
            })
        );
        out.push(...chunk);
    }
    return out;
}

async function appendPeerBenchmarks(
    probes: ProbeRecord[],
    peerBatch: string[],
    defaultPort: number,
    probeTimeoutMs: number,
    concurrency: number
): Promise<void> {
    if (peerBatch.length === 0) return;
    probes.push(
        ...(await benchmarkPeersConcurrently(
            peerBatch,
            defaultPort,
            probeTimeoutMs,
            concurrency
        ))
    );
}

function peersRankedWithinLatencyTiers(
    probes: ProbeRecord[],
    targetCount: number
): string[] {
    return selectPeersByLatencyTiers(rowsFromProbes(probes), targetCount);
}

function buildDnsProbeBatch(
    dnsEndpoints: string[],
    seen: Set<string>,
    defaultPort: number
): string[] {
    shuffleInPlace(dnsEndpoints);
    const batch: string[] = [];
    for (const p of dnsEndpoints) {
        appendUniquePeer(batch, seen, p, defaultPort);
        if (batch.length >= DNS_PROBE_PEER_CAP) break;
    }
    return batch;
}

/**
 * Measure defaults first, then DNS-derived IPs if needed, then mainnet secondary lists.
 * Persists only latency-tiered peers; skips settings update if nothing reachable under threshold.
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

    let dnsEndpoints: string[] = [];
    try {
        dnsEndpoints = await discoverNeutrinoPeersFromDns(testnet);
        log.d(`DNS neutrino candidates resolved: ${dnsEndpoints.length}`);
    } catch (e) {
        log.d('DNS neutrino discovery failed', [e]);
    }

    const seenHosts = new Set<string>();
    const defaultBatch: string[] = [];
    for (const p of curatedDefaults) {
        appendUniquePeer(defaultBatch, seenHosts, p, defaultPort);
    }

    const probes: ProbeRecord[] = [];
    const probeBudget = NEUTRINO_OPTIMIZE_PROBE_TIMEOUT_MS;

    await appendPeerBenchmarks(
        probes,
        defaultBatch,
        defaultPort,
        probeBudget,
        OPTIMIZE_PROBE_CONCURRENCY
    );
    let selected = peersRankedWithinLatencyTiers(probes, peerTargetCount);

    if (selected.length < peerTargetCount && dnsEndpoints.length > 0) {
        const dnsBatch = buildDnsProbeBatch(
            dnsEndpoints,
            seenHosts,
            defaultPort
        );
        await appendPeerBenchmarks(
            probes,
            dnsBatch,
            defaultPort,
            probeBudget,
            OPTIMIZE_PROBE_CONCURRENCY
        );
        selected = peersRankedWithinLatencyTiers(probes, peerTargetCount);
    }

    if (selected.length < peerTargetCount && !testnet) {
        for (const group of SECONDARY_NEUTRINO_PEERS_MAINNET) {
            if (selected.length >= peerTargetCount) break;
            const secondaryBatch: string[] = [];
            for (const p of group) {
                appendUniquePeer(secondaryBatch, seenHosts, p, defaultPort);
            }
            await appendPeerBenchmarks(
                probes,
                secondaryBatch,
                defaultPort,
                probeBudget,
                OPTIMIZE_PROBE_CONCURRENCY
            );
            selected = peersRankedWithinLatencyTiers(probes, peerTargetCount);
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
