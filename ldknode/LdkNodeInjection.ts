/**
 * LDK Node Injection - Wrapper class for LDK Node native module
 * Similar pattern to LndMobileInjection
 */

import { NativeModules, Platform } from 'react-native';
import type {
    Network,
    NodeStatus,
    BalanceDetails,
    ChannelDetails,
    PaymentDetails,
    PeerDetails,
    LdkNodeEvent,
    Lsps1OrderResponse,
    Lsps1OrderStatus
} from './LdkNode.d';

const { LdkNodeModule } = NativeModules;

// ============================================================================
// Builder Functions
// ============================================================================

const createBuilder = async (): Promise<void> => {
    return await LdkNodeModule.createBuilder();
};

const setNetwork = async (network: Network): Promise<void> => {
    return await LdkNodeModule.setNetwork(network);
};

const setStorageDirPath = async (path: string): Promise<void> => {
    return await LdkNodeModule.setStorageDirPath(path);
};

const setEsploraServer = async (serverUrl: string): Promise<void> => {
    return await LdkNodeModule.setEsploraServer(serverUrl);
};

const setGossipSourceRgs = async (rgsServerUrl: string): Promise<void> => {
    return await LdkNodeModule.setGossipSourceRgs(rgsServerUrl);
};

const setGossipSourceP2p = async (): Promise<void> => {
    return await LdkNodeModule.setGossipSourceP2p();
};

const setListeningAddresses = async (addresses: string[]): Promise<void> => {
    return await LdkNodeModule.setListeningAddresses(addresses);
};

const setLiquiditySourceLsps1 = async ({
    nodeId,
    address,
    token
}: {
    nodeId: string;
    address: string;
    token?: string | null;
}): Promise<void> => {
    return await LdkNodeModule.setLiquiditySourceLsps1(
        nodeId,
        address,
        token ?? null
    );
};

const setLiquiditySourceLsps2 = async ({
    nodeId,
    address,
    token
}: {
    nodeId: string;
    address: string;
    token?: string | null;
}): Promise<void> => {
    return await LdkNodeModule.setLiquiditySourceLsps2(
        nodeId,
        address,
        token ?? null
    );
};

const setTrustedPeers0conf = async (peers: string[]): Promise<void> => {
    return await LdkNodeModule.setTrustedPeers0conf(peers);
};

// ============================================================================
// Mnemonic Functions
// ============================================================================

const generateMnemonic = async (wordCount: number = 12): Promise<string> => {
    const result: any = await LdkNodeModule.generateMnemonic(wordCount);
    return result.mnemonic;
};

// ============================================================================
// Node Build Functions
// ============================================================================

const buildNode = async (
    mnemonic: string,
    passphrase?: string | null
): Promise<void> => {
    return await LdkNodeModule.buildNode(mnemonic, passphrase ?? null);
};

// ============================================================================
// Node Lifecycle Functions
// ============================================================================

const start = async (): Promise<void> => {
    return await LdkNodeModule.start();
};

const stop = async (): Promise<void> => {
    return await LdkNodeModule.stop();
};

const syncWallets = async (): Promise<void> => {
    return await LdkNodeModule.syncWallets();
};

// ============================================================================
// Node Info Functions
// ============================================================================

const nodeId = async (): Promise<string> => {
    const result: any = await LdkNodeModule.nodeId();
    return result.nodeId;
};

const status = async (): Promise<NodeStatus> => {
    return await LdkNodeModule.status();
};

const listBalances = async (): Promise<BalanceDetails> => {
    return await LdkNodeModule.listBalances();
};

const networkGraphInfo = async (): Promise<{
    channelCount: number;
    nodeCount: number;
}> => {
    return await LdkNodeModule.networkGraphInfo();
};

// ============================================================================
// Channel Functions
// ============================================================================

const listChannels = async (): Promise<ChannelDetails[]> => {
    const result: any = await LdkNodeModule.listChannels();
    return result.channels;
};

const openChannel = async ({
    nodeId,
    address,
    channelAmountSats,
    pushToCounterpartyMsat,
    announceChannel = false
}: {
    nodeId: string;
    address: string;
    channelAmountSats: number;
    pushToCounterpartyMsat?: number | null;
    announceChannel?: boolean;
}): Promise<string> => {
    const result: any = await LdkNodeModule.openChannel(
        nodeId,
        address,
        channelAmountSats,
        pushToCounterpartyMsat ?? 0,
        announceChannel
    );
    return result.userChannelId;
};

const closeChannel = async ({
    userChannelId,
    counterpartyNodeId
}: {
    userChannelId: string;
    counterpartyNodeId: string;
}): Promise<void> => {
    return await LdkNodeModule.closeChannel(userChannelId, counterpartyNodeId);
};

// ============================================================================
// On-chain Functions
// ============================================================================

const newOnchainAddress = async (): Promise<string> => {
    const result: any = await LdkNodeModule.newOnchainAddress();
    return result.address;
};

const sendToOnchainAddress = async ({
    address,
    amountSats
}: {
    address: string;
    amountSats: number;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendToOnchainAddress(
        address,
        amountSats
    );
    return result.txid;
};

const sendAllToOnchainAddress = async (
    address: string,
    retainReserve: boolean = false
): Promise<string> => {
    const result: any = await LdkNodeModule.sendAllToOnchainAddress(
        address,
        retainReserve
    );
    return result.txid;
};

// ============================================================================
// BOLT11 Payment Functions
// ============================================================================

const receiveBolt11 = async ({
    amountMsat,
    description,
    expirySecs
}: {
    amountMsat: number;
    description: string;
    expirySecs: number;
}): Promise<string> => {
    const result = await LdkNodeModule.receiveBolt11(
        amountMsat,
        description,
        expirySecs
    );
    return result.invoice;
};

const receiveVariableAmountBolt11 = async ({
    description,
    expirySecs
}: {
    description: string;
    expirySecs: number;
}): Promise<string> => {
    const result = await LdkNodeModule.receiveVariableAmountBolt11(
        description,
        expirySecs
    );
    return result.invoice;
};

const sendBolt11 = async (invoice: string): Promise<string> => {
    const result: any = await LdkNodeModule.sendBolt11(invoice);
    return result.paymentId;
};

const sendBolt11UsingAmount = async ({
    invoice,
    amountMsat
}: {
    invoice: string;
    amountMsat: number;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendBolt11UsingAmount(
        invoice,
        amountMsat
    );
    return result.paymentId;
};

// ============================================================================
// Payment Functions
// ============================================================================

const listPayments = async (): Promise<PaymentDetails[]> => {
    const result: any = await LdkNodeModule.listPayments();
    return result.payments;
};

// ============================================================================
// Peer Functions
// ============================================================================

const connect = async ({
    nodeId,
    address,
    persist = true
}: {
    nodeId: string;
    address: string;
    persist?: boolean;
}): Promise<void> => {
    return await LdkNodeModule.connect(nodeId, address, persist);
};

const disconnect = async (nodeId: string): Promise<void> => {
    return await LdkNodeModule.disconnect(nodeId);
};

const listPeers = async (): Promise<PeerDetails[]> => {
    const result: any = await LdkNodeModule.listPeers();
    return result.peers;
};

// ============================================================================
// Event Functions
// ============================================================================

const nextEvent = async (): Promise<LdkNodeEvent | null> => {
    const result: any = await LdkNodeModule.nextEvent();
    return result.event;
};

const waitNextEvent = async (): Promise<LdkNodeEvent> => {
    const result: any = await LdkNodeModule.waitNextEvent();
    return result.event;
};

const eventHandled = async (): Promise<void> => {
    return await LdkNodeModule.eventHandled();
};

// ============================================================================
// LSPS1 Functions
// ============================================================================

const lsps1RequestChannel = async ({
    lspBalanceSat,
    clientBalanceSat,
    channelExpiryBlocks,
    announceChannel
}: {
    lspBalanceSat: number;
    clientBalanceSat: number;
    channelExpiryBlocks: number;
    announceChannel: boolean;
}): Promise<Lsps1OrderResponse> => {
    return await LdkNodeModule.lsps1RequestChannel(
        lspBalanceSat,
        clientBalanceSat,
        channelExpiryBlocks,
        announceChannel
    );
};

const lsps1CheckOrderStatus = async (
    orderId: string
): Promise<Lsps1OrderStatus> => {
    return await LdkNodeModule.lsps1CheckOrderStatus(orderId);
};

// ============================================================================
// Message Signing Functions
// ============================================================================

const signMessage = async (message: string): Promise<string> => {
    const result = await LdkNodeModule.signMessage(message);
    return result.signature;
};

const verifySignature = async ({
    message,
    signature,
    publicKey
}: {
    message: string;
    signature: string;
    publicKey: string;
}): Promise<boolean> => {
    const result = await LdkNodeModule.verifySignature(
        message,
        signature,
        publicKey
    );
    return result.valid;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the default storage directory path for LDK Node data
 */
const getDefaultStoragePath = (): string => {
    if (Platform.OS === 'ios') {
        // On iOS, use Application Support directory
        return ''; // Will be set by the app using proper iOS paths
    } else {
        // On Android, use app's files directory
        return ''; // Will be set by the app using proper Android paths
    }
};

/**
 * Initialize and build a new LDK Node with common defaults
 */
const initializeNode = async ({
    network,
    storagePath,
    esploraServerUrl,
    mnemonic,
    passphrase,
    rgsServerUrl,
    listeningAddresses,
    lsps1Config,
    trustedPeers0conf
}: {
    network: Network;
    storagePath: string;
    esploraServerUrl: string;
    mnemonic: string;
    passphrase?: string | null;
    rgsServerUrl?: string;
    listeningAddresses?: string[];
    lsps1Config?: {
        nodeId: string;
        address: string;
        token?: string | null;
    };
    trustedPeers0conf?: string[];
}): Promise<void> => {
    console.log('LDK Node: Initializing...');
    await createBuilder();
    await setNetwork(network);
    console.log(`LDK Node: Network set to ${network}`);
    await setStorageDirPath(storagePath);
    await setEsploraServer(esploraServerUrl);
    console.log(`LDK Node: Esplora server set to ${esploraServerUrl}`);

    if (rgsServerUrl) {
        await setGossipSourceRgs(rgsServerUrl);
        console.log(`LDK Node: RGS server set to ${rgsServerUrl}`);
    } else {
        console.log('LDK Node: No RGS server configured, using P2P gossip');
    }

    if (listeningAddresses && listeningAddresses.length > 0) {
        await setListeningAddresses(listeningAddresses);
    }

    // Configure LSPS1 liquidity source if provided (for buying inbound liquidity)
    if (lsps1Config && lsps1Config.nodeId && lsps1Config.address) {
        try {
            await setLiquiditySourceLsps1({
                nodeId: lsps1Config.nodeId,
                address: lsps1Config.address,
                token: lsps1Config.token
            });
            console.log('LDK Node: LSPS1 liquidity source configured');
        } catch (e) {
            console.log(
                'LDK Node: LSPS1 configuration failed, REST API will be used'
            );
        }

        // Also configure LSPS2 with the same LSP for JIT channels
        try {
            await setLiquiditySourceLsps2({
                nodeId: lsps1Config.nodeId,
                address: lsps1Config.address,
                token: lsps1Config.token
            });
            console.log('LDK Node: LSPS2 liquidity source configured');
        } catch (e) {
            console.log('LDK Node: LSPS2 configuration failed');
        }
    }

    // Set trusted peers for zero-conf channels (e.g., LSP)
    if (trustedPeers0conf && trustedPeers0conf.length > 0) {
        await setTrustedPeers0conf(trustedPeers0conf);
        console.log(
            `LDK Node: Trusted peers for 0-conf set: ${trustedPeers0conf.length} peer(s)`
        );
    }

    await buildNode(mnemonic, passphrase);
    console.log('LDK Node: Build complete');
};

// ============================================================================
// Interface Definition
// ============================================================================

export interface ILdkNodeInjections {
    builder: {
        createBuilder: () => Promise<void>;
        setNetwork: (network: Network) => Promise<void>;
        setStorageDirPath: (path: string) => Promise<void>;
        setEsploraServer: (serverUrl: string) => Promise<void>;
        setGossipSourceRgs: (rgsServerUrl: string) => Promise<void>;
        setGossipSourceP2p: () => Promise<void>;
        setListeningAddresses: (addresses: string[]) => Promise<void>;
        setLiquiditySourceLsps1: (params: {
            nodeId: string;
            address: string;
            token?: string | null;
        }) => Promise<void>;
        setLiquiditySourceLsps2: (params: {
            nodeId: string;
            address: string;
            token?: string | null;
        }) => Promise<void>;
        setTrustedPeers0conf: (peers: string[]) => Promise<void>;
    };
    mnemonic: {
        generateMnemonic: (wordCount?: number) => Promise<string>;
    };
    node: {
        buildNode: (
            mnemonic: string,
            passphrase?: string | null
        ) => Promise<void>;
        start: () => Promise<void>;
        stop: () => Promise<void>;
        syncWallets: () => Promise<void>;
        nodeId: () => Promise<string>;
        status: () => Promise<NodeStatus>;
        listBalances: () => Promise<BalanceDetails>;
        networkGraphInfo: () => Promise<{
            channelCount: number;
            nodeCount: number;
        }>;
    };
    channel: {
        listChannels: () => Promise<ChannelDetails[]>;
        openChannel: (params: {
            nodeId: string;
            address: string;
            channelAmountSats: number;
            pushToCounterpartyMsat?: number | null;
            announceChannel?: boolean;
        }) => Promise<string>;
        closeChannel: (params: {
            userChannelId: string;
            counterpartyNodeId: string;
        }) => Promise<void>;
    };
    onchain: {
        newOnchainAddress: () => Promise<string>;
        sendToOnchainAddress: (params: {
            address: string;
            amountSats: number;
        }) => Promise<string>;
        sendAllToOnchainAddress: (
            address: string,
            retainReserve?: boolean
        ) => Promise<string>;
    };
    bolt11: {
        receiveBolt11: (params: {
            amountMsat: number;
            description: string;
            expirySecs: number;
        }) => Promise<string>;
        receiveVariableAmountBolt11: (params: {
            description: string;
            expirySecs: number;
        }) => Promise<string>;
        sendBolt11: (invoice: string) => Promise<string>;
        sendBolt11UsingAmount: (params: {
            invoice: string;
            amountMsat: number;
        }) => Promise<string>;
    };
    payments: {
        listPayments: () => Promise<PaymentDetails[]>;
    };
    peers: {
        connect: (params: {
            nodeId: string;
            address: string;
            persist?: boolean;
        }) => Promise<void>;
        disconnect: (nodeId: string) => Promise<void>;
        listPeers: () => Promise<PeerDetails[]>;
    };
    events: {
        nextEvent: () => Promise<LdkNodeEvent | null>;
        waitNextEvent: () => Promise<LdkNodeEvent>;
        eventHandled: () => Promise<void>;
    };
    lsps1: {
        requestChannel: (params: {
            lspBalanceSat: number;
            clientBalanceSat: number;
            channelExpiryBlocks: number;
            announceChannel: boolean;
        }) => Promise<Lsps1OrderResponse>;
        checkOrderStatus: (orderId: string) => Promise<Lsps1OrderStatus>;
    };
    signing: {
        signMessage: (message: string) => Promise<string>;
        verifySignature: (params: {
            message: string;
            signature: string;
            publicKey: string;
        }) => Promise<boolean>;
    };
    utils: {
        getDefaultStoragePath: () => string;
        initializeNode: (params: {
            network: Network;
            storagePath: string;
            esploraServerUrl: string;
            mnemonic: string;
            passphrase?: string | null;
            rgsServerUrl?: string;
            listeningAddresses?: string[];
            lsps1Config?: {
                nodeId: string;
                address: string;
                token?: string | null;
            };
            trustedPeers0conf?: string[];
        }) => Promise<void>;
    };
}

// ============================================================================
// Export
// ============================================================================

const LdkNodeInjection: ILdkNodeInjections = {
    builder: {
        createBuilder,
        setNetwork,
        setStorageDirPath,
        setEsploraServer,
        setGossipSourceRgs,
        setGossipSourceP2p,
        setListeningAddresses,
        setLiquiditySourceLsps1,
        setLiquiditySourceLsps2,
        setTrustedPeers0conf
    },
    mnemonic: {
        generateMnemonic
    },
    node: {
        buildNode,
        start,
        stop,
        syncWallets,
        nodeId,
        status,
        listBalances,
        networkGraphInfo
    },
    channel: {
        listChannels,
        openChannel,
        closeChannel
    },
    onchain: {
        newOnchainAddress,
        sendToOnchainAddress,
        sendAllToOnchainAddress
    },
    bolt11: {
        receiveBolt11,
        receiveVariableAmountBolt11,
        sendBolt11,
        sendBolt11UsingAmount
    },
    payments: {
        listPayments
    },
    peers: {
        connect,
        disconnect,
        listPeers
    },
    events: {
        nextEvent,
        waitNextEvent,
        eventHandled
    },
    lsps1: {
        requestChannel: lsps1RequestChannel,
        checkOrderStatus: lsps1CheckOrderStatus
    },
    signing: {
        signMessage,
        verifySignature
    },
    utils: {
        getDefaultStoragePath,
        initializeNode
    }
};

export default LdkNodeInjection;
