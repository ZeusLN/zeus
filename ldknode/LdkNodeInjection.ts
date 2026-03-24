/**
 * LDK Node Injection - Wrapper class for LDK Node native module
 * Similar pattern to LndMobileInjection
 */

import { NativeModules } from 'react-native';
import { generateVssAuthHeaders } from '../utils/VssAuthUtils';
import type {
    Network,
    NodeStatus,
    BalanceDetails,
    ChannelDetails,
    ClosedChannelDetails,
    PaymentDetails,
    PeerDetails,
    LdkNodeEvent,
    Lsps1OrderResponse,
    Lsps1OrderStatus,
    Lsps7ExtendableChannel,
    Lsps7OrderResponse
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

const setLiquiditySourceLsps7 = async ({
    nodeId,
    address,
    token
}: {
    nodeId: string;
    address: string;
    token?: string | null;
}): Promise<void> => {
    return await LdkNodeModule.setLiquiditySourceLsps7(
        nodeId,
        address,
        token ?? null
    );
};

const setTrustedPeers0conf = async (peers: string[]): Promise<void> => {
    return await LdkNodeModule.setTrustedPeers0conf(peers);
};

const setVssServer = async (
    vssUrl: string,
    storeId: string,
    headers?: Record<string, string>
): Promise<void> => {
    return await LdkNodeModule.setVssServer(vssUrl, storeId, headers ?? null);
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
): Promise<{ vssError?: string } | null> => {
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

const resetNetworkGraph = async (): Promise<void> => {
    return await LdkNodeModule.resetNetworkGraph();
};

const updateRgsSnapshot = async (): Promise<{ timestamp: number }> => {
    return await LdkNodeModule.updateRgsSnapshot();
};

// ============================================================================
// Channel Functions
// ============================================================================

const listChannels = async (): Promise<ChannelDetails[]> => {
    const result: any = await LdkNodeModule.listChannels();
    return result.channels;
};

const listClosedChannels = async (): Promise<ClosedChannelDetails[]> => {
    const result: any = await LdkNodeModule.listClosedChannels();
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

const openChannelFundMax = async ({
    nodeId,
    address,
    pushToCounterpartyMsat,
    announceChannel = false,
    utxos
}: {
    nodeId: string;
    address: string;
    pushToCounterpartyMsat?: number | null;
    announceChannel?: boolean;
    utxos?: Array<{ txid: string; vout: number }> | null;
}): Promise<string> => {
    const result: any = await LdkNodeModule.openChannelFundMax(
        nodeId,
        address,
        pushToCounterpartyMsat ?? 0,
        announceChannel,
        utxos ?? null
    );
    return result.userChannelId;
};

const openChannelWithUtxos = async ({
    nodeId,
    address,
    channelAmountSats,
    pushToCounterpartyMsat,
    announceChannel = false,
    utxos
}: {
    nodeId: string;
    address: string;
    channelAmountSats: number;
    pushToCounterpartyMsat?: number | null;
    announceChannel?: boolean;
    utxos: Array<{ txid: string; vout: number }>;
}): Promise<string> => {
    const result: any = await LdkNodeModule.openChannelWithUtxos(
        nodeId,
        address,
        channelAmountSats,
        pushToCounterpartyMsat ?? 0,
        announceChannel,
        utxos
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

const forceCloseChannel = async ({
    userChannelId,
    counterpartyNodeId,
    reason
}: {
    userChannelId: string;
    counterpartyNodeId: string;
    reason?: string;
}): Promise<void> => {
    return await LdkNodeModule.forceCloseChannel(
        userChannelId,
        counterpartyNodeId,
        reason ?? ''
    );
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

export interface WalletUtxo {
    txid: string;
    vout: number;
    value_sats: number;
    address: string;
    is_spent: boolean;
}

const listUtxos = async (): Promise<WalletUtxo[]> => {
    const result: any = await LdkNodeModule.listUtxos();
    return result.utxos;
};

const sendToOnchainAddressWithUtxos = async ({
    address,
    amountSats,
    utxos
}: {
    address: string;
    amountSats: number;
    utxos: Array<{ txid: string; vout: number }>;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendToOnchainAddressWithUtxos(
        address,
        amountSats,
        utxos
    );
    return result.txid;
};

const sendAllToOnchainAddressWithUtxos = async ({
    address,
    retainReserve = false,
    utxos
}: {
    address: string;
    retainReserve?: boolean;
    utxos: Array<{ txid: string; vout: number }>;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendAllToOnchainAddressWithUtxos(
        address,
        retainReserve,
        utxos
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

const sendBolt11 = async ({
    invoice,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    invoice: string;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendBolt11(
        invoice,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.paymentId;
};

const sendBolt11UsingAmount = async ({
    invoice,
    amountMsat,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    invoice: string;
    amountMsat: number;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendBolt11UsingAmount(
        invoice,
        amountMsat,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.paymentId;
};

// ============================================================================
// Spontaneous Payment Functions
// ============================================================================

const sendSpontaneousPayment = async ({
    nodeId,
    amountMsat,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    nodeId: string;
    amountMsat: number;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result: any = await LdkNodeModule.sendSpontaneousPayment(
        nodeId,
        amountMsat,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.paymentId;
};

// ============================================================================
// BOLT12 Payment Functions
// ============================================================================

const bolt12Receive = async ({
    amountMsat,
    description,
    expirySecs
}: {
    amountMsat: number;
    description: string;
    expirySecs: number;
}): Promise<{ offer: string; offerId: string }> => {
    return await LdkNodeModule.bolt12Receive(
        amountMsat,
        description,
        expirySecs
    );
};

const bolt12ReceiveVariableAmount = async ({
    description,
    expirySecs
}: {
    description: string;
    expirySecs: number;
}): Promise<{ offer: string; offerId: string }> => {
    return await LdkNodeModule.bolt12ReceiveVariableAmount(
        description,
        expirySecs
    );
};

const bolt12Send = async ({
    offer,
    payerNote,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    offer: string;
    payerNote?: string | null;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result = await LdkNodeModule.bolt12Send(
        offer,
        payerNote ?? null,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.paymentId;
};

const bolt12SendUsingAmount = async ({
    offer,
    amountMsat,
    payerNote,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    offer: string;
    amountMsat: number;
    payerNote?: string | null;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result = await LdkNodeModule.bolt12SendUsingAmount(
        offer,
        amountMsat,
        payerNote ?? null,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.paymentId;
};

const bolt12InitiateRefund = async ({
    amountMsat,
    expirySecs,
    maxTotalRoutingFeeMsat,
    maxPathCount
}: {
    amountMsat: number;
    expirySecs: number;
    maxTotalRoutingFeeMsat?: number;
    maxPathCount?: number;
}): Promise<string> => {
    const result = await LdkNodeModule.bolt12InitiateRefund(
        amountMsat,
        expirySecs,
        maxTotalRoutingFeeMsat ?? -1,
        maxPathCount ?? -1
    );
    return result.refund;
};

const bolt12RequestRefundPayment = async (
    refundStr: string
): Promise<string> => {
    const result = await LdkNodeModule.bolt12RequestRefundPayment(refundStr);
    return result.invoice;
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
// LSPS7 Functions
// ============================================================================

const lsps7GetExtendableChannels = async (): Promise<
    Lsps7ExtendableChannel[]
> => {
    return await LdkNodeModule.lsps7GetExtendableChannels();
};

const lsps7CreateOrder = async ({
    shortChannelId,
    channelExtensionExpiryBlocks,
    token,
    refundOnchainAddress
}: {
    shortChannelId: string;
    channelExtensionExpiryBlocks: number;
    token?: string | null;
    refundOnchainAddress?: string | null;
}): Promise<Lsps7OrderResponse> => {
    return await LdkNodeModule.lsps7CreateOrder(
        shortChannelId,
        channelExtensionExpiryBlocks,
        token ?? null,
        refundOnchainAddress ?? null
    );
};

const lsps7CheckOrderStatus = async (
    orderId: string
): Promise<Lsps7OrderResponse> => {
    return await LdkNodeModule.lsps7CheckOrderStatus(orderId);
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
// Recovery Functions
// ============================================================================

const sweepRemoteClosedOutputs = async ({
    sweepAddress,
    feeRateSatsPerVbyte,
    sleepSeconds
}: {
    sweepAddress: string;
    feeRateSatsPerVbyte: number;
    sleepSeconds: number;
}): Promise<string> => {
    const result = await LdkNodeModule.sweepRemoteClosedOutputs(
        sweepAddress,
        feeRateSatsPerVbyte,
        sleepSeconds
    );
    return result.txHex;
};

// ============================================================================
// Helper Functions
// ============================================================================

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
    trustedPeers0conf,
    vssConfig,
    vssKey
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
    vssConfig?: {
        url: string;
        storeId: string;
    };
    vssKey?: { privateKey: Uint8Array; publicKey: Uint8Array };
}): Promise<{ vssError?: string }> => {
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

        // Also configure LSPS7 with the same LSP for channel lease extensions
        try {
            await setLiquiditySourceLsps7({
                nodeId: lsps1Config.nodeId,
                address: lsps1Config.address,
                token: lsps1Config.token
            });
            console.log('LDK Node: LSPS7 liquidity source configured');
        } catch (e) {
            console.log('LDK Node: LSPS7 configuration failed');
        }
    }

    // Set trusted peers for zero-conf channels (e.g., LSP)
    if (trustedPeers0conf && trustedPeers0conf.length > 0) {
        await setTrustedPeers0conf(trustedPeers0conf);
        console.log(
            `LDK Node: Trusted peers for 0-conf set: ${trustedPeers0conf.length} peer(s)`
        );
    }

    // Configure VSS (Versioned Storage Service) for cloud backup
    if (vssConfig && vssConfig.url && vssConfig.storeId) {
        let vssHeaders: Record<string, string> | undefined;
        try {
            // Pass pre-derived keypair to avoid a second PBKDF2 (~3.4s)
            vssHeaders = generateVssAuthHeaders(
                mnemonic,
                passphrase ?? undefined,
                vssKey
            );
            console.log('LDK Node: VSS auth header generated');
        } catch (e) {
            console.warn('LDK Node: Failed to generate VSS auth header:', e);
        }
        await setVssServer(vssConfig.url, vssConfig.storeId, vssHeaders);
        console.log(`LDK Node: VSS server set to ${vssConfig.url}`);
    }

    const buildResult = await buildNode(mnemonic, passphrase);
    const vssError = buildResult?.vssError;
    if (vssError) {
        console.warn(`LDK Node: VSS failed (${vssError}), using local storage`);
    }
    console.log('LDK Node: Build complete');
    return { vssError };
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
        setVssServer: (
            vssUrl: string,
            storeId: string,
            headers?: Record<string, string>
        ) => Promise<void>;
    };
    mnemonic: {
        generateMnemonic: (wordCount?: number) => Promise<string>;
    };
    node: {
        buildNode: (
            mnemonic: string,
            passphrase?: string | null
        ) => Promise<{ vssError?: string } | null>;
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
        resetNetworkGraph: () => Promise<void>;
        updateRgsSnapshot: () => Promise<{ timestamp: number }>;
    };
    channel: {
        listChannels: () => Promise<ChannelDetails[]>;
        listClosedChannels: () => Promise<ClosedChannelDetails[]>;
        openChannel: (params: {
            nodeId: string;
            address: string;
            channelAmountSats: number;
            pushToCounterpartyMsat?: number | null;
            announceChannel?: boolean;
        }) => Promise<string>;
        openChannelFundMax: (params: {
            nodeId: string;
            address: string;
            pushToCounterpartyMsat?: number | null;
            announceChannel?: boolean;
            utxos?: Array<{ txid: string; vout: number }> | null;
        }) => Promise<string>;
        openChannelWithUtxos: (params: {
            nodeId: string;
            address: string;
            channelAmountSats: number;
            pushToCounterpartyMsat?: number | null;
            announceChannel?: boolean;
            utxos: Array<{ txid: string; vout: number }>;
        }) => Promise<string>;
        closeChannel: (params: {
            userChannelId: string;
            counterpartyNodeId: string;
        }) => Promise<void>;
        forceCloseChannel: (params: {
            userChannelId: string;
            counterpartyNodeId: string;
            reason?: string;
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
        listUtxos: () => Promise<WalletUtxo[]>;
        sendToOnchainAddressWithUtxos: (params: {
            address: string;
            amountSats: number;
            utxos: Array<{ txid: string; vout: number }>;
        }) => Promise<string>;
        sendAllToOnchainAddressWithUtxos: (params: {
            address: string;
            retainReserve?: boolean;
            utxos: Array<{ txid: string; vout: number }>;
        }) => Promise<string>;
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
        sendBolt11: (params: {
            invoice: string;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
        sendBolt11UsingAmount: (params: {
            invoice: string;
            amountMsat: number;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
    };
    spontaneous: {
        sendSpontaneousPayment: (params: {
            nodeId: string;
            amountMsat: number;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
    };
    bolt12: {
        bolt12Receive: (params: {
            amountMsat: number;
            description: string;
            expirySecs: number;
        }) => Promise<{ offer: string; offerId: string }>;
        bolt12ReceiveVariableAmount: (params: {
            description: string;
            expirySecs: number;
        }) => Promise<{ offer: string; offerId: string }>;
        bolt12Send: (params: {
            offer: string;
            payerNote?: string | null;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
        bolt12SendUsingAmount: (params: {
            offer: string;
            amountMsat: number;
            payerNote?: string | null;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
        bolt12InitiateRefund: (params: {
            amountMsat: number;
            expirySecs: number;
            maxTotalRoutingFeeMsat?: number;
            maxPathCount?: number;
        }) => Promise<string>;
        bolt12RequestRefundPayment: (refundStr: string) => Promise<string>;
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
    lsps7: {
        getExtendableChannels: () => Promise<Lsps7ExtendableChannel[]>;
        createOrder: (params: {
            shortChannelId: string;
            channelExtensionExpiryBlocks: number;
            token?: string | null;
            refundOnchainAddress?: string | null;
        }) => Promise<Lsps7OrderResponse>;
        checkOrderStatus: (orderId: string) => Promise<Lsps7OrderResponse>;
    };
    signing: {
        signMessage: (message: string) => Promise<string>;
        verifySignature: (params: {
            message: string;
            signature: string;
            publicKey: string;
        }) => Promise<boolean>;
    };
    recovery: {
        sweepRemoteClosedOutputs: (params: {
            sweepAddress: string;
            feeRateSatsPerVbyte: number;
            sleepSeconds: number;
        }) => Promise<string>;
    };
    utils: {
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
            vssConfig?: {
                url: string;
                storeId: string;
            };
            vssKey?: {
                privateKey: Uint8Array;
                publicKey: Uint8Array;
            };
        }) => Promise<{ vssError?: string }>;
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
        setTrustedPeers0conf,
        setVssServer
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
        networkGraphInfo,
        resetNetworkGraph,
        updateRgsSnapshot
    },
    channel: {
        listChannels,
        listClosedChannels,
        openChannel,
        openChannelFundMax,
        openChannelWithUtxos,
        closeChannel,
        forceCloseChannel
    },
    onchain: {
        newOnchainAddress,
        sendToOnchainAddress,
        sendAllToOnchainAddress,
        listUtxos,
        sendToOnchainAddressWithUtxos,
        sendAllToOnchainAddressWithUtxos
    },
    bolt11: {
        receiveBolt11,
        receiveVariableAmountBolt11,
        sendBolt11,
        sendBolt11UsingAmount
    },
    spontaneous: {
        sendSpontaneousPayment
    },
    bolt12: {
        bolt12Receive,
        bolt12ReceiveVariableAmount,
        bolt12Send,
        bolt12SendUsingAmount,
        bolt12InitiateRefund,
        bolt12RequestRefundPayment
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
        eventHandled
    },
    lsps1: {
        requestChannel: lsps1RequestChannel,
        checkOrderStatus: lsps1CheckOrderStatus
    },
    lsps7: {
        getExtendableChannels: lsps7GetExtendableChannels,
        createOrder: lsps7CreateOrder,
        checkOrderStatus: lsps7CheckOrderStatus
    },
    signing: {
        signMessage,
        verifySignature
    },
    recovery: {
        sweepRemoteClosedOutputs
    },
    utils: {
        initializeNode
    }
};

export default LdkNodeInjection;
