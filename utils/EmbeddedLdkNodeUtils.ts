/**
 * Embedded LDK Node Utilities
 *
 * Utility functions for creating and managing embedded LDK Node wallets.
 */

import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import LdkNode from '../ldknode/LdkNodeInjection';
import type { Network } from '../ldknode/LdkNode.d';

// Default Esplora servers
export const ESPLORA_SERVERS_MAINNET = [
    'https://mempool.space/api',
    'https://blockstream.info/api'
];

export const ESPLORA_SERVERS_TESTNET = [
    'https://mempool.space/testnet/api',
    'https://blockstream.info/testnet/api'
];

export const ESPLORA_SERVERS_SIGNET = ['https://mempool.space/signet/api'];

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
    if (Platform.OS === 'ios') {
        return `${RNFS.DocumentDirectoryPath}/ldk-node/${nodeDir}`;
    } else {
        return `${RNFS.DocumentDirectoryPath}/ldk-node/${nodeDir}`;
    }
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
export function getNetworkType(
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest'
): Network {
    switch (network) {
        case 'mainnet':
            return 'bitcoin';
        case 'testnet':
            return 'testnet';
        case 'signet':
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
export function getDefaultEsploraServer(
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest'
): string {
    switch (network) {
        case 'mainnet':
            return ESPLORA_SERVERS_MAINNET[0];
        case 'testnet':
            return ESPLORA_SERVERS_TESTNET[0];
        case 'signet':
            return ESPLORA_SERVERS_SIGNET[0];
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
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest'
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
    trustedPeers0conf
}: {
    nodeDir: string;
    seedMnemonic?: string;
    passphrase?: string;
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest';
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
}): Promise<{
    mnemonic: string;
    storagePath: string;
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
    await LdkNode.utils.initializeNode({
        network: networkType,
        storagePath,
        esploraServerUrl: esploraUrl,
        mnemonic,
        passphrase: passphrase || null,
        rgsServerUrl: rgsUrl,
        listeningAddresses,
        lsps1Config,
        trustedPeers0conf
    });

    return {
        mnemonic,
        storagePath
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
    trustedPeers0conf
}: {
    nodeDir: string;
    seedMnemonic: string;
    passphrase?: string;
    network: 'mainnet' | 'testnet' | 'signet' | 'regtest';
    esploraServerUrl?: string;
    rgsServerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
}): Promise<void> {
    const storagePath = getLdkNodeStoragePath(nodeDir);
    const networkType = getNetworkType(network);
    const esploraUrl = esploraServerUrl || getDefaultEsploraServer(network);
    const rgsUrl = rgsServerUrl || getDefaultRgsServer(network);

    // Initialize the node with existing mnemonic
    await LdkNode.utils.initializeNode({
        network: networkType,
        storagePath,
        esploraServerUrl: esploraUrl,
        mnemonic: seedMnemonic,
        passphrase: passphrase || null,
        rgsServerUrl: rgsUrl,
        listeningAddresses,
        lsps1Config,
        trustedPeers0conf
    });

    // Start the node
    await LdkNode.node.start();
    console.log('LDK Node: Started successfully');

    // Sync wallets (on-chain and triggers RGS if configured)
    try {
        await LdkNode.node.syncWallets();
        console.log('LDK Node: Initial sync complete');

        // Log network graph info
        const graphInfo = await LdkNode.node.networkGraphInfo();
        console.log(
            `LDK Node: Network graph contains ${graphInfo.channelCount} channels and ${graphInfo.nodeCount} nodes`
        );
    } catch (e) {
        console.log('LDK Node: Initial sync error:', e);
    }
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

/**
 * Check if LDK Node wallet exists
 */
export async function ldkNodeWalletExists(nodeDir: string): Promise<boolean> {
    const storagePath = getLdkNodeStoragePath(nodeDir);
    return await RNFS.exists(storagePath);
}

/**
 * Validate a BIP39 mnemonic
 * Basic validation - checks word count and format
 */
export function validateMnemonic(mnemonic: string): {
    valid: boolean;
    error?: string;
} {
    const words = mnemonic.trim().split(/\s+/);

    if (words.length !== 12 && words.length !== 24) {
        return {
            valid: false,
            error: 'Mnemonic must be 12 or 24 words'
        };
    }

    // Check for empty words
    if (words.some((word) => word.length === 0)) {
        return {
            valid: false,
            error: 'Mnemonic contains empty words'
        };
    }

    return { valid: true };
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
    ldkNodeWalletExists,
    validateMnemonic,
    ESPLORA_SERVERS_MAINNET,
    ESPLORA_SERVERS_TESTNET,
    ESPLORA_SERVERS_SIGNET,
    RGS_SERVERS_MAINNET,
    RGS_SERVERS_TESTNET
};
