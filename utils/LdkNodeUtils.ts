/**
 * Embedded LDK Node Utilities
 *
 * Utility functions for creating and managing embedded LDK Node wallets.
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import LdkNode from '../ldknode/LdkNodeInjection';
import type { Network } from '../ldknode/LdkNode.d';

import { localeString } from './LocaleUtils';
import { retry } from './SleepUtils';
import { deriveVssSigningKeyFromSeed } from './VssAuthUtils';

export type SupportedNetwork =
    | 'mainnet'
    | 'testnet'
    | 'signet'
    | 'regtest'
    | 'mutinynet';

export type EsploraServer = { key: string; value: string };

// Default Esplora servers
export const ESPLORA_SERVERS_MAINNET: EsploraServer[] = [
    { key: 'ZEUS', value: 'https://electrs.zeusln.com' },
    { key: 'Alby', value: 'https://electrs.getalbypro.com' },
    { key: 'Blockstream', value: 'https://blockstream.info/api' },
    { key: 'Mempool.space', value: 'https://mempool.space/api' }
];

export const ESPLORA_SERVERS_TESTNET: EsploraServer[] = [
    { key: 'Mempool.space', value: 'https://mempool.space/testnet/api' },
    { key: 'Blockstream', value: 'https://blockstream.info/testnet/api' }
];

export const ESPLORA_SERVERS_SIGNET: EsploraServer[] = [
    { key: 'Mempool.space', value: 'https://mempool.space/signet/api' }
];

export const ESPLORA_SERVERS_MUTINYNET: EsploraServer[] = [
    { key: 'Mutinynet', value: 'https://mutinynet.com/api' }
];

// Default VSS (Versioned Storage Service) server
export const DEFAULT_VSS_SERVER = 'https://vss.zeusln.com/vss';

// Default RGS (Rapid Gossip Sync) servers
export const RGS_SERVERS_MAINNET: EsploraServer[] = [
    { key: 'ZEUS (rgs.zeusln.com)', value: 'https://rgs.zeusln.com/snapshot' },
    {
        key: 'LDK (rapidsync.lightningdevkit.org)',
        value: 'https://rapidsync.lightningdevkit.org/snapshot'
    }
];

export const RGS_SERVERS_TESTNET: EsploraServer[] = [
    {
        key: 'LDK (rapidsync.lightningdevkit.org)',
        value: 'https://rapidsync.lightningdevkit.org/testnet/snapshot'
    }
];

// Default pathfinding scores server
export const DEFAULT_SCORER_URL = 'https://scores.zeusln.com/latest.bin';

// Native-module error string emitted while `buildNode` is still rebuilding
// the node reference on its background queue
const LDK_NODE_NOT_INITIALIZED = 'Node not initialized';

// Local sentinel for the gap between the node existing and reporting running
const LDK_NODE_NOT_RUNNING_YET = 'LDK Node not running yet';

/**
 * Get the shared base directory that holds every wallet's LDK Node data
 */
export function getLdkNodeBaseDirectory(): string {
    return `${RNFS.DocumentDirectoryPath}/ldk-node`;
}

/**
 * Get the storage directory path for LDK Node data
 */
export function getLdkNodeStoragePath(nodeDir: string): string {
    return `${getLdkNodeBaseDirectory()}/${nodeDir}`;
}

/**
 * Exclude the shared ldk-node base directory, and thereby every wallet's
 * subdirectory, from iOS iCloud/iTunes backups. RNFS.mkdir with
 * NSURLIsExcludedFromBackupKey creates intermediate directories and
 * (re)applies the flag even when the directory already exists, so this is
 * safe to run idempotently on every node start. Non-fatal by design: a
 * failure to set the flag must never prevent the node from starting; it
 * is retried on the next start. No-op on Android, where
 * allowBackup="false" already keeps app data out of backups.
 */
export async function ensureLdkNodeBackupExclusion(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    try {
        await RNFS.mkdir(getLdkNodeBaseDirectory(), {
            NSURLIsExcludedFromBackupKey: true
        });
    } catch (e) {
        console.warn(
            'LDK Node: failed to exclude data directory from backups:',
            e
        );
    }
}

/**
 * Create the LDK Node storage directory if it doesn't exist
 */
export async function createLdkNodeDirectory(nodeDir: string): Promise<string> {
    await ensureLdkNodeBackupExclusion();

    const storagePath = getLdkNodeStoragePath(nodeDir);

    const exists = await RNFS.exists(storagePath);
    if (!exists) {
        await RNFS.mkdir(storagePath);
    }

    return storagePath;
}

/**
 * Convert network string to LDK Node network type
 */
export function getNetworkType(network: SupportedNetwork): Network {
    switch (network) {
        case 'mainnet':
            return 'bitcoin';
        case 'testnet':
            return 'testnet';
        case 'signet':
            return 'signet';
        case 'mutinynet':
            return 'signet';
        case 'regtest':
            return 'regtest';
        default:
            return 'bitcoin';
    }
}

/**
 * Get all Esplora servers for a network
 */
export function getEsploraServersForNetwork(
    network: SupportedNetwork
): EsploraServer[] {
    switch (network) {
        case 'mainnet':
            return ESPLORA_SERVERS_MAINNET;
        case 'testnet':
            return ESPLORA_SERVERS_TESTNET;
        case 'signet':
            return ESPLORA_SERVERS_SIGNET;
        case 'mutinynet':
            return ESPLORA_SERVERS_MUTINYNET;
        case 'regtest':
            return [{ key: 'Localhost', value: 'http://localhost:3000' }];
        default:
            return ESPLORA_SERVERS_MAINNET;
    }
}

/**
 * Get default Esplora server for network
 */
export function getDefaultEsploraServer(network: SupportedNetwork): string {
    return getEsploraServersForNetwork(network)[0]?.value || '';
}

/**
 * Get all RGS servers for a network
 */
export function getRgsServersForNetwork(
    network: SupportedNetwork
): EsploraServer[] {
    switch (network) {
        case 'mainnet':
            return RGS_SERVERS_MAINNET;
        case 'testnet':
            return RGS_SERVERS_TESTNET;
        default:
            return [];
    }
}

/**
 * Get default RGS server for network
 */
export function getDefaultRgsServer(
    network: SupportedNetwork
): string | undefined {
    return getRgsServersForNetwork(network)[0]?.value || undefined;
}

/**
 * Generate a new mnemonic seed phrase
 */
export async function generateMnemonic(
    wordCount: number = 12
): Promise<string> {
    return await LdkNode.mnemonic.generateMnemonic(wordCount);
}

/**
 * Shared node initialization: resolves defaults, derives VSS config, and calls initializeNode.
 */
async function initNode({
    storagePath,
    mnemonic,
    passphrase,
    network,
    esploraServerUrl,
    rgsServerUrl,
    scorerUrl,
    listeningAddresses,
    lsps1Config,
    trustedPeers0conf,
    vssServerUrl,
    failOnVssError
}: {
    storagePath: string;
    mnemonic: string;
    passphrase?: string;
    network: SupportedNetwork;
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    scorerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
    vssServerUrl?: string;
    failOnVssError?: boolean;
}): Promise<{ vssError?: string }> {
    const networkType = getNetworkType(network);
    const esploraUrl = esploraServerUrl || getDefaultEsploraServer(network);
    const rgsUrl = rgsServerUrl || getDefaultRgsServer(network);
    const vssUrl = vssServerUrl || DEFAULT_VSS_SERVER;

    // Derive VSS signing keypair using native PBKDF2 (avoids ~3s JS PBKDF2).
    // The seed is derived once and reused for both storeId and auth headers.
    const seedHex = await LdkNode.crypto.mnemonicToSeed(mnemonic, passphrase);
    const vssKey = deriveVssSigningKeyFromSeed(Buffer.from(seedHex, 'hex'));
    const vssStoreId = Buffer.from(vssKey.publicKey).toString('hex');

    return await LdkNode.utils.initializeNode({
        network: networkType,
        storagePath,
        esploraServerUrl: esploraUrl,
        mnemonic,
        passphrase: passphrase || null,
        rgsServerUrl: rgsUrl,
        scorerUrl,
        listeningAddresses,
        lsps1Config,
        trustedPeers0conf,
        vssConfig: {
            url: vssUrl,
            storeId: vssStoreId
        },
        vssKey,
        failOnVssError
    });
}

/**
 * Create a new LDK Node wallet
 */
export async function createLdkNodeWallet({
    nodeDir,
    seedMnemonic,
    wordCount = 12,
    passphrase,
    network,
    esploraServerUrl,
    rgsServerUrl,
    scorerUrl,
    listeningAddresses,
    lsps1Config,
    trustedPeers0conf,
    vssServerUrl,
    failOnVssError
}: {
    nodeDir: string;
    seedMnemonic?: string;
    wordCount?: number;
    passphrase?: string;
    network: SupportedNetwork;
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    scorerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
    vssServerUrl?: string;
    failOnVssError?: boolean;
}): Promise<{
    mnemonic: string;
    storagePath: string;
    vssError?: string;
}> {
    // Create storage directory
    const storagePath = await createLdkNodeDirectory(nodeDir);

    // Generate mnemonic if not provided (new wallet)
    let mnemonic = seedMnemonic;
    if (!mnemonic) {
        mnemonic = await generateMnemonic(wordCount);
    }

    let vssError: string | undefined;
    try {
        const result = await initNode({
            storagePath,
            mnemonic,
            passphrase,
            network,
            esploraServerUrl,
            rgsServerUrl,
            scorerUrl,
            listeningAddresses,
            lsps1Config,
            trustedPeers0conf,
            vssServerUrl,
            failOnVssError
        });
        vssError = result.vssError;
    } catch (e: any) {
        // A failed build can leave a partially-written local DB behind.
        // If it survived, later dual-store builds would read the partial
        // local state instead of VSS — remove the directory so a retry
        // starts clean. On vss_error/build_in_progress the native side
        // owns the cleanup: a timed-out build may still be running in
        // there, and unlinking under it could leave partial state behind.
        const nativeOwnsCleanup =
            e?.code === 'vss_error' || e?.code === 'build_in_progress';
        if (!nativeOwnsCleanup) {
            try {
                await deleteLdkNodeWallet(nodeDir);
            } catch (cleanupError) {
                console.warn(
                    'LDK Node: failed to clean up wallet dir after failed init:',
                    cleanupError
                );
            }
        }
        throw e;
    }

    return {
        mnemonic,
        storagePath,
        vssError
    };
}

/**
 * Start an existing LDK Node wallet
 */
export async function startLdkNodeWallet({
    nodeDir,
    seedMnemonic,
    passphrase,
    network,
    esploraServerUrl,
    rgsServerUrl,
    scorerUrl,
    listeningAddresses,
    lsps1Config,
    trustedPeers0conf,
    vssServerUrl,
    skipInit,
    onSyncStart
}: {
    nodeDir: string;
    seedMnemonic: string;
    passphrase?: string;
    network: SupportedNetwork;
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    scorerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
    vssServerUrl?: string;
    skipInit?: boolean;
    onSyncStart?: () => void;
}): Promise<{ vssError?: string; esploraError?: string; rgsError?: string }> {
    // Idempotent repair for wallets created before the backup exclusion
    // existed; never throws, so it cannot block node start
    await ensureLdkNodeBackupExclusion();

    let vssError: string | undefined;

    if (!skipInit) {
        const storagePath = getLdkNodeStoragePath(nodeDir);
        // If the wallet's local DB is missing (e.g. config arrived on a new
        // device via cloud keychain sync), this start is effectively a
        // restore-from-seed: building a fresh local node on VSS failure
        // would look like an empty wallet and shadow the VSS backup.
        const hasLocalDb = await RNFS.exists(
            `${storagePath}/ldk_node_data.sqlite`
        );
        const result = await initNode({
            storagePath,
            mnemonic: seedMnemonic,
            passphrase,
            network,
            esploraServerUrl,
            rgsServerUrl,
            scorerUrl,
            listeningAddresses,
            lsps1Config,
            trustedPeers0conf,
            vssServerUrl,
            failOnVssError: !hasLocalDb
        });
        vssError = result.vssError;
    }

    // Start the node — start() kicks off background tasks (including fee estimation)
    // that can reject asynchronously, so we catch those too
    let esploraError: string | undefined;
    let rgsError: string | undefined;
    let nodeStarted = false;

    try {
        await retry({
            fn: () => LdkNode.node.start(),
            maxRetries: 5,
            delayMs: 500,
            shouldRetry: (e: any) => {
                const errMsg = e?.message || e?.toString?.() || String(e);
                return errMsg.includes(LDK_NODE_NOT_INITIALIZED);
            }
        });
        nodeStarted = true;
        console.log('LDK Node: Started successfully');
    } catch (e: any) {
        const errorMsg = e?.message || e?.toString?.() || String(e);
        console.warn('LDK Node: Start error:', errorMsg);
        if (
            errorMsg.includes('FeerateEstimation') ||
            errorMsg.includes('fee rate')
        ) {
            esploraError = errorMsg;
            // Node may still be running despite fee estimation failure —
            // attempt sync to detect RGS errors too
            nodeStarted = true;
        } else {
            // Surface non-fee-rate failures to the caller instead of
            // returning silently — a phantom-success makes the downstream
            // waitForLdkNodeReady timeout in 60s with a misleading error.
            throw e;
        }
    }

    // Only sync if the node actually started
    if (nodeStarted) {
        onSyncStart?.();
        try {
            await LdkNode.node.syncWallets();
            console.log('LDK Node: Sync complete');
        } catch (e: any) {
            const errorMsg = e?.message || e?.toString?.() || String(e);
            console.warn('LDK Node: Sync error:', errorMsg);

            if (
                errorMsg.includes('FeerateEstimation') ||
                errorMsg.includes('Esplora') ||
                errorMsg.includes('fee rate')
            ) {
                esploraError = errorMsg;
            } else if (
                errorMsg.includes('RapidGossipSync') ||
                errorMsg.includes('Rgs') ||
                errorMsg.includes('gossip')
            ) {
                rgsError = errorMsg;
            } else if (!errorMsg.includes('NotRunning')) {
                esploraError = errorMsg;
            }
        }

        // Check if RGS actually populated — use the node status timestamp
        // rather than graph counts, which can race with background RGS sync
        try {
            const status = await LdkNode.node.status();
            if (!status.latestRgsSnapshotTimestamp && !rgsError) {
                rgsError = localeString('components.AlertModal.rgsEmptyGraph');
            }
        } catch (e) {
            console.log('LDK Node: Could not fetch node status:', e);
        }
    }

    return { vssError, esploraError, rgsError };
}

/**
 * Wait for the LDK Node native module to report a running node.
 *
 * `buildNode` clears the native node reference up-front and rebuilds it on
 * a background queue, so any call into the module during that window
 * rejects with "Node not initialized". Retries `status()` calls (treating
 * both that error and a transient `!isRunning` as retryable) so callers
 * can tolerate that race instead of surfacing it as a fatal startup error.
 */
export async function waitForLdkNodeReady(
    timeoutMs: number = 60000
): Promise<void> {
    await retry({
        fn: async () => {
            const status = await LdkNode.node.status();
            if (!status.isRunning) throw new Error(LDK_NODE_NOT_RUNNING_YET);
        },
        maxRetries: Math.floor(timeoutMs / 500),
        delayMs: 500,
        shouldRetry: (e: any) => {
            const errMsg = e?.message || e?.toString?.() || String(e);
            return (
                errMsg.includes(LDK_NODE_NOT_INITIALIZED) ||
                errMsg.includes(LDK_NODE_NOT_RUNNING_YET)
            );
        }
    });
}

/**
 * Stop a running LDK Node
 */
export async function stopLdkNode(): Promise<void> {
    try {
        await LdkNode.node.stop();
    } catch (e) {
        console.log('Error stopping LDK Node:', e);
    }
}

/**
 * Delete LDK Node wallet data
 */
export async function deleteLdkNodeWallet(nodeDir: string): Promise<void> {
    const storagePath = getLdkNodeStoragePath(nodeDir);
    const exists = await RNFS.exists(storagePath);
    if (exists) {
        await RNFS.unlink(storagePath);
    }
}

export default {
    getLdkNodeBaseDirectory,
    getLdkNodeStoragePath,
    ensureLdkNodeBackupExclusion,
    createLdkNodeDirectory,
    getNetworkType,
    getEsploraServersForNetwork,
    getDefaultEsploraServer,
    getRgsServersForNetwork,
    getDefaultRgsServer,
    generateMnemonic,
    createLdkNodeWallet,
    startLdkNodeWallet,
    waitForLdkNodeReady,
    stopLdkNode,
    deleteLdkNodeWallet,
    ESPLORA_SERVERS_MAINNET,
    ESPLORA_SERVERS_TESTNET,
    ESPLORA_SERVERS_SIGNET,
    ESPLORA_SERVERS_MUTINYNET,
    RGS_SERVERS_MAINNET,
    RGS_SERVERS_TESTNET,
    DEFAULT_VSS_SERVER
};
