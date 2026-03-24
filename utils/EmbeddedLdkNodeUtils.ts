/**
 * Embedded LDK Node Utilities
 *
 * Utility functions for creating and managing embedded LDK Node wallets.
 */

import RNFS from 'react-native-fs';
import LdkNode from '../ldknode/LdkNodeInjection';
import type { Network } from '../ldknode/LdkNode.d';

export type SupportedNetwork =
    | 'mainnet'
    | 'testnet'
    | 'signet'
    | 'regtest'
    | 'mutinynet';
import { localeString } from './LocaleUtils';
import { deriveVssSigningKey } from './VssAuthUtils';

// Default Esplora servers
export const ESPLORA_SERVERS_MAINNET = [
    'https://electrs.getalbypro.com',
    'https://blockstream.info/api',
    'https://mempool.space/api'
];

export const ESPLORA_SERVERS_TESTNET = [
    'https://mempool.space/testnet/api',
    'https://blockstream.info/testnet/api'
];

export const ESPLORA_SERVERS_SIGNET = ['https://mempool.space/signet/api'];

export const ESPLORA_SERVERS_MUTINYNET = ['https://mutinynet.com/api'];

// Default VSS (Versioned Storage Service) server
export const DEFAULT_VSS_SERVER = 'https://vss.zeusln.com/vss';

// Default RGS (Rapid Gossip Sync) servers
export const RGS_SERVERS_MAINNET = [
    'https://rapidsync.lightningdevkit.org/snapshot'
];

export const RGS_SERVERS_TESTNET = [
    'https://rapidsync.lightningdevkit.org/testnet/snapshot'
];

/**
 * Get the storage directory path for LDK Node data
 */
export function getLdkNodeStoragePath(nodeDir: string): string {
    return `${RNFS.DocumentDirectoryPath}/ldk-node/${nodeDir}`;
}

/**
 * Create the LDK Node storage directory if it doesn't exist
 */
export async function createLdkNodeDirectory(nodeDir: string): Promise<string> {
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
 * Get default Esplora server for network
 */
export function getDefaultEsploraServer(network: SupportedNetwork): string {
    switch (network) {
        case 'mainnet':
            return ESPLORA_SERVERS_MAINNET[0];
        case 'testnet':
            return ESPLORA_SERVERS_TESTNET[0];
        case 'signet':
            return ESPLORA_SERVERS_SIGNET[0];
        case 'mutinynet':
            return ESPLORA_SERVERS_MUTINYNET[0];
        case 'regtest':
            return 'http://localhost:3000'; // Local regtest
        default:
            return ESPLORA_SERVERS_MAINNET[0];
    }
}

/**
 * Get default RGS server for network
 */
export function getDefaultRgsServer(
    network: SupportedNetwork
): string | undefined {
    switch (network) {
        case 'mainnet':
            return RGS_SERVERS_MAINNET[0];
        case 'testnet':
            return RGS_SERVERS_TESTNET[0];
        default:
            return undefined;
    }
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
 * Create a new LDK Node wallet
 */
export async function createLdkNodeWallet({
    nodeDir,
    seedMnemonic,
    passphrase,
    network,
    esploraServerUrl,
    rgsServerUrl,
    listeningAddresses,
    lsps1Config,
    trustedPeers0conf,
    vssServerUrl
}: {
    nodeDir: string;
    seedMnemonic?: string;
    passphrase?: string;
    network: SupportedNetwork;
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
    vssServerUrl?: string;
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
        mnemonic = await generateMnemonic(12);
    }

    // Get network-specific defaults
    const networkType = getNetworkType(network);
    const esploraUrl = esploraServerUrl || getDefaultEsploraServer(network);
    const rgsUrl = rgsServerUrl || getDefaultRgsServer(network);

    // Initialize the node
    const vssUrl = vssServerUrl || DEFAULT_VSS_SERVER;
    const vssStoreId = Buffer.from(
        deriveVssSigningKey(mnemonic, passphrase).publicKey
    ).toString('hex');
    const { vssError } = await LdkNode.utils.initializeNode({
        network: networkType,
        storagePath,
        esploraServerUrl: esploraUrl,
        mnemonic,
        passphrase: passphrase || null,
        rgsServerUrl: rgsUrl,
        listeningAddresses,
        lsps1Config,
        trustedPeers0conf,
        vssConfig: {
            url: vssUrl,
            storeId: vssStoreId
        }
    });

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
    let vssError: string | undefined;

    if (!skipInit) {
        const storagePath = getLdkNodeStoragePath(nodeDir);
        const networkType = getNetworkType(network);
        const esploraUrl = esploraServerUrl || getDefaultEsploraServer(network);
        const rgsUrl = rgsServerUrl || getDefaultRgsServer(network);

        // Initialize the node with existing mnemonic
        const vssUrl = vssServerUrl || DEFAULT_VSS_SERVER;
        const vssStoreId = Buffer.from(
            deriveVssSigningKey(seedMnemonic, passphrase).publicKey
        ).toString('hex');
        const result = await LdkNode.utils.initializeNode({
            network: networkType,
            storagePath,
            esploraServerUrl: esploraUrl,
            mnemonic: seedMnemonic,
            passphrase: passphrase || null,
            rgsServerUrl: rgsUrl,
            listeningAddresses,
            lsps1Config,
            trustedPeers0conf,
            vssConfig: {
                url: vssUrl,
                storeId: vssStoreId
            }
        });
        vssError = result.vssError;
    }

    // Start the node — start() kicks off background tasks (including fee estimation)
    // that can reject asynchronously, so we catch those too
    let esploraError: string | undefined;
    let rgsError: string | undefined;
    let nodeStarted = false;

    try {
        await LdkNode.node.start();
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
    getLdkNodeStoragePath,
    createLdkNodeDirectory,
    getNetworkType,
    getDefaultEsploraServer,
    getDefaultRgsServer,
    generateMnemonic,
    createLdkNodeWallet,
    startLdkNodeWallet,
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
