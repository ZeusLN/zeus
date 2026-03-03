/**
 * Embedded LDK Node Backend for Zeus
 *
 * This backend provides integration with the embedded ldk-node Lightning implementation.
 */

import BigNumber from 'bignumber.js';
import bolt11 from 'bolt11';
import { Hash as sha256Hash } from 'fast-sha256';

import LdkNode from '../ldknode/LdkNodeInjection';
import Base64Utils from '../utils/Base64Utils';
import { localeString } from '../utils/LocaleUtils';
import type {
    Network,
    NodeStatus,
    BalanceDetails,
    ChannelDetails,
    ClosedChannelDetails,
    PaymentDetails,
    LdkNodeEvent,
    ClosureReason,
    Lsps1OrderResponse,
    Lsps1OrderStatus
} from '../ldknode/LdkNode.d';

import OpenChannelRequest from '../models/OpenChannelRequest';
import { settingsStore } from '../stores/Stores';

// Event callback type
type EventCallback = (event: LdkNodeEvent) => void;

export default class EmbeddedLdkNode {
    // Event loop state
    private eventLoopRunning: boolean = false;
    private eventCallbacks: EventCallback[] = [];

    // ========================================================================
    // Initialization Methods
    // ========================================================================

    /**
     * Initialize and start the LDK Node
     */
    initializeNode = async ({
        network,
        storagePath,
        esploraServerUrl,
        mnemonic,
        passphrase,
        rgsServerUrl,
        listeningAddresses,
        vssConfig
    }: {
        network: Network;
        storagePath: string;
        esploraServerUrl: string;
        mnemonic: string;
        passphrase?: string | null;
        rgsServerUrl?: string;
        listeningAddresses?: string[];
        vssConfig?: {
            url: string;
            storeId: string;
        };
    }): Promise<void> => {
        await LdkNode.utils.initializeNode({
            network,
            storagePath,
            esploraServerUrl,
            mnemonic,
            passphrase,
            rgsServerUrl,
            listeningAddresses,
            vssConfig
        });
    };

    /**
     * Start the node
     */
    startNode = async (): Promise<void> => {
        await LdkNode.node.start();
        // Start the event loop for event subscribers
        if (!this.eventLoopRunning) {
            this.startEventLoop();
        }
    };

    /**
     * Stop the node
     */
    stopNode = async (): Promise<void> => {
        this.stopEventLoop();
        await LdkNode.node.stop();
    };

    // ========================================================================
    // Event Subscription Methods
    // ========================================================================

    /**
     * Subscribe to LDK Node events
     * Returns an unsubscribe function
     */
    subscribeToEvents = (callback: EventCallback): (() => void) => {
        this.eventCallbacks.push(callback);

        // Start event loop if not already running
        if (!this.eventLoopRunning) {
            this.startEventLoop();
        }

        // Return unsubscribe function
        return () => {
            const index = this.eventCallbacks.indexOf(callback);
            if (index > -1) {
                this.eventCallbacks.splice(index, 1);
            }
            // Don't stop the event loop on unsubscribe — other
            // subscribers may still need it
        };
    };

    /**
     * Start the event loop
     */
    private startEventLoop = async (): Promise<void> => {
        if (this.eventLoopRunning) return;

        this.eventLoopRunning = true;

        while (this.eventLoopRunning) {
            try {
                // Poll for the next event (non-blocking)
                const event = await LdkNode.events.nextEvent();

                if (event && this.eventLoopRunning) {
                    // Notify all callbacks
                    for (const callback of this.eventCallbacks) {
                        try {
                            callback(event);
                        } catch (e) {
                            console.error('[LDK] Error in event callback:', e);
                        }
                    }

                    // Mark the event as handled
                    await LdkNode.events.eventHandled();
                } else if (!event) {
                    // No event available — sleep briefly before polling again
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            } catch (e) {
                console.error('[LDK] Error in event loop:', e);
                // Brief pause before retrying to avoid tight loop on errors
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    };

    /**
     * Stop the event loop
     */
    private stopEventLoop = (): void => {
        this.eventLoopRunning = false;
    };

    /**
     * Check if a closure reason indicates a cooperative close
     */
    private static isCooperativeReason(
        reason: ClosureReason | undefined
    ): boolean {
        const type = reason?.type;
        return (
            type === 'locallyInitiatedCooperativeClosure' ||
            type === 'counterpartyInitiatedCooperativeClosure' ||
            type === 'legacyCooperativeClosure' ||
            type === 'counterpartyCoopClosedUnfundedChannel' ||
            type === 'locallyCoopClosedUnfundedChannel'
        );
    }

    /**
     * Sync wallets (on-chain and lightning)
     */
    syncWallets = async (): Promise<void> => {
        await LdkNode.node.syncWallets();
    };

    /**
     * Generate a new mnemonic
     */
    generateMnemonic = async (wordCount: number = 12): Promise<string> => {
        return await LdkNode.mnemonic.generateMnemonic(wordCount);
    };

    // ========================================================================
    // Node Info Methods
    // ========================================================================

    /**
     * Get node info (similar to LND's getInfo)
     */
    getMyNodeInfo = async (): Promise<any> => {
        const nodeId = await LdkNode.node.nodeId();
        const status = await LdkNode.node.status();

        const network = settingsStore.embeddedLdkNetwork || 'mainnet';

        return {
            identity_pubkey: nodeId,
            alias: '', // LDK Node doesn't have built-in alias
            block_height: status.currentBestBlock_height,
            block_hash: status.currentBestBlock_hash,
            synced_to_chain: status.isRunning,
            synced_to_graph: !!status.latestRgsSnapshotTimestamp,
            version: 'ldk-node v0.7.0-zeus-lsps7-rgs-troubleshoot-logobserver',
            testnet: network === 'testnet',
            regtest: network === 'regtest',
            signet: network === 'signet',
            // Additional LDK Node specific fields
            latestLightningWalletSyncTimestamp:
                status.latestLightningWalletSyncTimestamp,
            latestOnchainWalletSyncTimestamp:
                status.latestOnchainWalletSyncTimestamp
        };
    };

    /**
     * Get node status
     */
    getStatus = async (): Promise<NodeStatus> => {
        return await LdkNode.node.status();
    };

    /**
     * Get network graph info
     */
    getNetworkInfo = async (): Promise<any> => {
        const graphInfo = await LdkNode.node.networkGraphInfo();
        return {
            num_channels: graphInfo.channelCount,
            num_nodes: graphInfo.nodeCount
        };
    };

    // ========================================================================
    // Balance Methods
    // ========================================================================

    /**
     * Get blockchain (on-chain) balance
     */
    getBlockchainBalance = async (): Promise<any> => {
        const balances = await LdkNode.node.listBalances();
        return {
            total_balance: balances.totalOnchainBalanceSats.toString(),
            confirmed_balance: balances.spendableOnchainBalanceSats.toString(),
            unconfirmed_balance: new BigNumber(balances.totalOnchainBalanceSats)
                .minus(balances.spendableOnchainBalanceSats)
                .toString()
        };
    };

    /**
     * Get lightning balance
     */
    getLightningBalance = async (): Promise<any> => {
        const channels = await LdkNode.channel.listChannels();

        let localBalance = new BigNumber(0);
        let remoteBalance = new BigNumber(0);
        let pendingOpenBalance = new BigNumber(0);

        for (const channel of channels) {
            if (channel.isChannelReady) {
                // Convert msat to sat, include local reserve in lightning balance
                const localReserve = channel.unspendablePunishmentReserve || 0;
                localBalance = localBalance.plus(
                    new BigNumber(channel.outboundCapacityMsat)
                        .dividedBy(1000)
                        .plus(localReserve)
                );
                remoteBalance = remoteBalance.plus(
                    new BigNumber(channel.inboundCapacityMsat).dividedBy(1000)
                );
            } else {
                pendingOpenBalance = pendingOpenBalance.plus(
                    channel.channelValueSats
                );
            }
        }

        return {
            balance: localBalance.toString(),
            local_balance: {
                sat: localBalance.toString(),
                msat: localBalance.times(1000).toString()
            },
            remote_balance: {
                sat: remoteBalance.toString(),
                msat: remoteBalance.times(1000).toString()
            },
            pending_open_balance: pendingOpenBalance.toString(),
            pending_open_local_balance: {
                sat: pendingOpenBalance.toString(),
                msat: pendingOpenBalance.times(1000).toString()
            }
        };
    };

    /**
     * Get all balances
     */
    listBalances = async (): Promise<BalanceDetails> => {
        return await LdkNode.node.listBalances();
    };

    // ========================================================================
    // Channel Methods
    // ========================================================================

    /**
     * Get all channels
     */
    getChannels = async (): Promise<any> => {
        const channels = await LdkNode.channel.listChannels();
        // Only return ready channels — pending open channels are
        // returned by getPendingChannels() instead.
        const readyChannels = channels.filter((c) => c.isChannelReady);
        return {
            channels: readyChannels.map((channel) =>
                this.formatChannel(channel)
            )
        };
    };

    /**
     * List channels (raw)
     */
    listChannels = async (): Promise<ChannelDetails[]> => {
        return await LdkNode.channel.listChannels();
    };

    /**
     * Get pending channels
     *
     * Returns:
     * - Channels still opening (not yet ready)
     * - Channels with unsettled balances (pending close / waiting close),
     *   cross-referenced with native closed channel records for close-type
     *
     * Force closes with settled balances go to getClosedChannels().
     */
    getPendingChannels = async (): Promise<any> => {
        const [channels, balances, closedChannels] = await Promise.all([
            LdkNode.channel.listChannels(),
            LdkNode.node.listBalances(),
            LdkNode.channel.listClosedChannels()
        ]);

        // Pending open: channels not yet ready
        const pendingOpen = channels.filter((c) => !c.isChannelReady);

        // Build set of active channel IDs
        const activeChannelIds = new Set(channels.map((c) => c.channelId));

        // Build lookup of closed channel records by channelId
        const closedChannelMap = new Map<string, ClosedChannelDetails>();
        for (const cc of closedChannels) {
            closedChannelMap.set(cc.channelId, cc);
        }

        // Collect lightning balance entries by channelId for non-active channels
        const channelLightningBalances = new Map<
            string,
            import('../ldknode/LdkNode.d').LightningBalance[]
        >();
        for (const lb of balances.lightningBalances) {
            if (lb.type === 'claimableOnChannelClose') continue;
            if (activeChannelIds.has(lb.channelId)) continue;
            const list = channelLightningBalances.get(lb.channelId) || [];
            list.push(lb);
            channelLightningBalances.set(lb.channelId, list);
        }

        // Collect sweep entries by channelId for non-active channels
        const channelSweeps = new Map<
            string,
            import('../ldknode/LdkNode.d').PendingSweepBalance[]
        >();
        for (const sb of balances.pendingBalancesFromChannelClosures) {
            if (!sb.channelId || activeChannelIds.has(sb.channelId)) continue;
            const list = channelSweeps.get(sb.channelId) || [];
            list.push(sb);
            channelSweeps.set(sb.channelId, list);
        }

        const pendingClosing: any[] = [];
        const waitingClose: any[] = [];

        // Cooperative closes with balance entries (claimableAwaitingConfirmations
        // with source: coopClose)
        channelLightningBalances.forEach((lbs, channelId) => {
            const isCoopClose = lbs.every(
                (lb) =>
                    lb.type === 'claimableAwaitingConfirmations' &&
                    lb.source === 'coopClose'
            );
            if (!isCoopClose) return;

            const totalSats = lbs.reduce(
                (sum, lb) => sum + lb.amountSatoshis,
                0
            );
            const closed = closedChannelMap.get(channelId);
            const counterpartyNodeId =
                lbs[0]?.counterpartyNodeId || closed?.counterpartyNodeId || '';

            const sweeps = channelSweeps.get(channelId) || [];
            const closingTxid =
                sweeps.find((s) => s.latestSpendingTxid)?.latestSpendingTxid ||
                '';

            pendingClosing.push({
                channel: {
                    remote_pubkey: counterpartyNodeId,
                    channel_point: '',
                    capacity: (
                        closed?.channelCapacitySats || totalSats
                    ).toString(),
                    local_balance: totalSats.toString(),
                    remote_balance: '0'
                },
                closing_txid: closingTxid
            });
        });

        // Sweep-only entries with no lightning balances and no confirmed
        // sweeps: close tx not yet confirmed (waiting close / pending broadcast)
        channelSweeps.forEach((sweeps, channelId) => {
            if (channelLightningBalances.has(channelId)) return;

            if (
                sweeps.some((s) => s.type === 'awaitingThresholdConfirmations')
            ) {
                return;
            }

            const totalSats = sweeps.reduce(
                (sum, s) => sum + s.amountSatoshis,
                0
            );
            const closed = closedChannelMap.get(channelId);

            const channel = {
                remote_pubkey: closed?.counterpartyNodeId || '',
                channel_point: '',
                capacity: (closed?.channelCapacitySats || totalSats).toString(),
                local_balance: totalSats.toString(),
                remote_balance: '0'
            };

            if (sweeps.every((s) => s.type === 'pendingBroadcast')) {
                waitingClose.push({ channel });
            } else {
                const closingTxid =
                    sweeps.find((s) => s.latestSpendingTxid)
                        ?.latestSpendingTxid || '';
                pendingClosing.push({
                    channel,
                    closing_txid: closingTxid
                });
            }
        });

        // Cooperative closes that have no balance entries at all but were
        // closed recently (within 10 minutes) — show as pending close
        // until the close tx has confirmed
        const channelIdsWithBalances = new Set<string>();
        channelLightningBalances.forEach((_, id) =>
            channelIdsWithBalances.add(id)
        );
        channelSweeps.forEach((_, id) => channelIdsWithBalances.add(id));

        for (const cc of closedChannels) {
            if (activeChannelIds.has(cc.channelId)) continue;
            if (channelIdsWithBalances.has(cc.channelId)) continue;
            if (!EmbeddedLdkNode.isCooperativeReason(cc.closureReason))
                continue;

            const ageSecs =
                Math.floor(Date.now() / 1000) - cc.closedAtTimestamp;
            if (ageSecs > 10 * 60) continue;

            pendingClosing.push({
                channel: {
                    remote_pubkey: cc.counterpartyNodeId || '',
                    channel_point: '',
                    capacity: (cc.channelCapacitySats || 0).toString(),
                    local_balance: (cc.lastLocalBalanceMsat
                        ? Math.floor(cc.lastLocalBalanceMsat / 1000)
                        : 0
                    ).toString(),
                    remote_balance: '0'
                },
                closing_txid: ''
            });
        }

        return {
            pending_open_channels: pendingOpen.map((channel) => ({
                channel: this.formatChannel(channel)
            })),
            pending_closing_channels: pendingClosing,
            pending_force_closing_channels: [],
            waiting_close_channels: waitingClose
        };
    };

    /**
     * Get closed channels
     *
     * Uses native listClosedChannels() for authoritative closed channel data.
     * Enriches with balance data when available (for force closes with
     * unsettled balances, blocks_til_maturity, etc).
     *
     * Channels still in active list or shown as pending are excluded.
     */
    getClosedChannels = async (): Promise<any> => {
        const [channels, closedChannelList, balances, status] =
            await Promise.all([
                LdkNode.channel.listChannels(),
                LdkNode.channel.listClosedChannels(),
                LdkNode.node.listBalances(),
                LdkNode.node.status()
            ]);

        const currentBlockHeight = status.currentBestBlock_height;
        const activeChannelIds = new Set(channels.map((c) => c.channelId));

        // Collect balance entries by channelId for non-active channels
        const channelBalanceEntries = new Map<
            string,
            {
                lightningBalances: import('../ldknode/LdkNode.d').LightningBalance[];
                sweepBalances: import('../ldknode/LdkNode.d').PendingSweepBalance[];
            }
        >();

        const ensureEntry = (channelId: string) => {
            if (!channelBalanceEntries.has(channelId)) {
                channelBalanceEntries.set(channelId, {
                    lightningBalances: [],
                    sweepBalances: []
                });
            }
            return channelBalanceEntries.get(channelId)!;
        };

        for (const lb of balances.lightningBalances) {
            if (lb.type === 'claimableOnChannelClose') continue;
            if (activeChannelIds.has(lb.channelId)) continue;
            ensureEntry(lb.channelId).lightningBalances.push(lb);
        }

        for (const sb of balances.pendingBalancesFromChannelClosures) {
            if (!sb.channelId || activeChannelIds.has(sb.channelId)) continue;
            ensureEntry(sb.channelId).sweepBalances.push(sb);
        }

        const closedChannels: any[] = [];

        for (const cc of closedChannelList) {
            // Skip channels still in active list
            if (activeChannelIds.has(cc.channelId)) continue;

            const isCoop = EmbeddedLdkNode.isCooperativeReason(
                cc.closureReason
            );

            // Skip cooperative closes that are still in the pending window
            const ageSecs =
                Math.floor(Date.now() / 1000) - cc.closedAtTimestamp;
            const balEntry = channelBalanceEntries.get(cc.channelId);
            const hasBalanceEntries = !!balEntry;

            if (isCoop && !hasBalanceEntries && ageSecs <= 10 * 60) {
                continue; // Still showing as pending close
            }

            // Skip channels still pending in balance entries
            // (cooperative closes with pending balance → pending tab)
            if (hasBalanceEntries) {
                const coopWithPendingBalance =
                    balEntry!.lightningBalances.length > 0 &&
                    balEntry!.lightningBalances.every(
                        (lb) =>
                            lb.type === 'claimableAwaitingConfirmations' &&
                            lb.source === 'coopClose'
                    );
                if (coopWithPendingBalance) continue;

                // Skip sweep-only channels with no confirmed sweeps
                if (
                    balEntry!.lightningBalances.length === 0 &&
                    balEntry!.sweepBalances.length > 0 &&
                    !balEntry!.sweepBalances.some(
                        (s) => s.type === 'awaitingThresholdConfirmations'
                    )
                ) {
                    continue;
                }
            }

            // Calculate capacity and balance
            const balanceSats = hasBalanceEntries
                ? [
                      ...balEntry!.lightningBalances,
                      ...balEntry!.sweepBalances
                  ].reduce((sum, b) => sum + b.amountSatoshis, 0)
                : cc.lastLocalBalanceMsat
                ? Math.floor(cc.lastLocalBalanceMsat / 1000)
                : 0;

            const capacitySats = cc.channelCapacitySats || balanceSats;

            const closingTxid = hasBalanceEntries
                ? balEntry!.sweepBalances.find((s) => s.latestSpendingTxid)
                      ?.latestSpendingTxid || ''
                : '';

            // Calculate blocks til maturity from balance data
            let blocksTilMaturity = 0;
            if (!isCoop && hasBalanceEntries) {
                for (const lb of balEntry!.lightningBalances) {
                    if (
                        lb.type === 'claimableAwaitingConfirmations' &&
                        lb.confirmationHeight != null
                    ) {
                        const remaining =
                            lb.confirmationHeight - currentBlockHeight;
                        if (remaining > blocksTilMaturity) {
                            blocksTilMaturity = remaining;
                        }
                    }
                }
            }

            const hasTimelock = blocksTilMaturity > 0;
            const closeType = isCoop ? 'COOPERATIVE_CLOSE' : 'FORCE_CLOSE';

            closedChannels.push({
                remote_pubkey: cc.counterpartyNodeId || '',
                channel_point: cc.fundingTxo_txid
                    ? `${cc.fundingTxo_txid}:${cc.fundingTxo_vout || 0}`
                    : '',
                capacity: capacitySats.toString(),
                settled_balance: balanceSats.toString(),
                local_balance: balanceSats.toString(),
                remote_balance: '0',
                close_type: closeType,
                closing_txid: closingTxid,
                closing_tx_hash: closingTxid,
                forceClose: hasTimelock,
                blocks_til_maturity: hasTimelock ? blocksTilMaturity : 0,
                time_locked_balance: hasTimelock ? balanceSats.toString() : '0'
            });
        }

        return { channels: closedChannels };
    };

    /**
     * Open a channel
     */
    openChannelSync = async (data: OpenChannelRequest): Promise<any> => {
        const userChannelId = await LdkNode.channel.openChannel({
            nodeId: data.node_pubkey_string,
            address: data.host || '',
            channelAmountSats: Number(data.local_funding_amount),
            pushToCounterpartyMsat: data.push_sat
                ? Number(data.push_sat) * 1000
                : undefined,
            announceChannel: !data.privateChannel
        });

        // Wait for either channelPending (success) or channelClosed
        // (rejection) event matching this userChannelId
        const CHANNEL_OPEN_TIMEOUT_MS = 60000;
        const result = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => {
                unsubscribe();
                // Timeout — resolve optimistically since the request
                // was accepted by the local node
                resolve({ user_channel_id: userChannelId });
            }, CHANNEL_OPEN_TIMEOUT_MS);

            const unsubscribe = this.subscribeToEvents(
                (event: LdkNodeEvent) => {
                    if (
                        event.type === 'channelPending' &&
                        event.userChannelId === userChannelId
                    ) {
                        clearTimeout(timeout);
                        unsubscribe();
                        resolve({
                            user_channel_id: userChannelId,
                            funding_txid_str: event.fundingTxo_txid,
                            output_index: event.fundingTxo_vout
                        });
                    } else if (
                        event.type === 'channelClosed' &&
                        event.userChannelId === userChannelId
                    ) {
                        clearTimeout(timeout);
                        unsubscribe();
                        const reason = EmbeddedLdkNode.closureReasonToMessage(
                            event.reason
                        );
                        reject(new Error(reason));
                    }
                }
            );
        });

        return result;
    };

    private static closureReasonToMessage(
        reason: ClosureReason | undefined
    ): string {
        if (!reason) return 'Channel closed: unknown reason';
        const peerMsg = reason.peerMessage;
        switch (reason.type) {
            case 'counterpartyForceClosed':
                return peerMsg
                    ? `Channel rejected by counterparty: ${peerMsg}`
                    : 'Channel rejected: counterparty force closed';
            case 'counterpartyCoopClosedUnfundedChannel':
                return 'Channel rejected by counterparty';
            case 'locallyCoopClosedUnfundedChannel':
                return 'Channel closed locally before funding';
            case 'fundingTimedOut':
                return 'Channel funding timed out';
            case 'processingError':
                return peerMsg
                    ? `Channel failed: ${peerMsg}`
                    : 'Channel failed due to a processing error';
            case 'disconnectedPeer':
                return 'Channel failed: peer disconnected';
            case 'peerFeerateTooLow':
                return peerMsg
                    ? `Channel rejected: ${peerMsg}`
                    : 'Channel rejected: peer feerate too low';
            default:
                return `Channel closed: ${reason.type}`;
        }
    }

    /**
     * Close a channel
     *
     * urlParams come from ChannelsStore in LND format:
     * [funding_txid_str, output_index, forceClose, satPerVbyte, deliveryAddress]
     * We look up the channel by funding txid to get the userChannelId
     * and counterpartyNodeId that LDK Node's close API requires.
     */
    closeChannel = async (urlParams?: Array<string>): Promise<any> => {
        const fundingTxid = (urlParams && urlParams[0]) || '';

        const channels = await LdkNode.channel.listChannels();
        const channel = channels.find((c) => c.fundingTxo_txid === fundingTxid);

        if (!channel) {
            throw new Error(
                localeString('error.channelNotFound', { fundingTxid })
            );
        }

        await LdkNode.channel.closeChannel({
            userChannelId: channel.userChannelId,
            counterpartyNodeId: channel.counterpartyNodeId
        });

        return { success: true };
    };

    // ========================================================================
    // On-chain Methods
    // ========================================================================

    /**
     * Get new on-chain address
     */
    getNewAddress = async (): Promise<any> => {
        const address = await LdkNode.onchain.newOnchainAddress();
        return {
            address
        };
    };

    /**
     * Send coins on-chain
     */
    sendCoins = async (data: any): Promise<any> => {
        let txid: string;

        if (data.send_all) {
            txid = await LdkNode.onchain.sendAllToOnchainAddress(data.addr);
        } else {
            txid = await LdkNode.onchain.sendToOnchainAddress({
                address: data.addr,
                amountSats: Number(data.amount)
            });
        }

        return {
            txid
        };
    };

    /**
     * Get on-chain transactions
     */
    getTransactions = async (): Promise<any> => {
        const [payments, status] = await Promise.all([
            LdkNode.payments.listPayments(),
            LdkNode.node.status()
        ]);
        const bestBlockHeight = status.currentBestBlock_height;

        // Filter to only on-chain payments
        const onchainPayments = payments.filter(
            (p) => p.kind.type === 'onchain'
        );

        return {
            transactions: onchainPayments.map((payment) =>
                this.formatOnchainTransaction(payment, bestBlockHeight)
            )
        };
    };

    // ========================================================================
    // Invoice Methods
    // ========================================================================

    /**
     * Create a BOLT11 invoice
     */
    createInvoice = async (data: any): Promise<any> => {
        let invoice: string;

        // Ensure expiry is a number (it comes as a string from the UI)
        const expirySecs = Number(data.expiry_seconds) || 3600;

        if (data.value || data.value_msat) {
            const amountMsat = data.value_msat
                ? Number(data.value_msat)
                : Number(data.value) * 1000;

            invoice = await LdkNode.bolt11.receiveBolt11({
                amountMsat,
                description: data.memo || '',
                expirySecs
            });
        } else {
            invoice = await LdkNode.bolt11.receiveVariableAmountBolt11({
                description: data.memo || '',
                expirySecs
            });
        }

        // Decode the invoice to get the payment hash
        let paymentHash = '';
        try {
            const decoded = bolt11.decode(invoice);
            const hashTag = decoded.tags.find(
                (tag: any) => tag.tagName === 'payment_hash'
            );
            if (hashTag) {
                paymentHash = hashTag.data as string;
            }
        } catch (e) {
            console.error('[LDK] Error decoding invoice for payment hash:', e);
        }

        return {
            payment_request: invoice,
            r_hash: paymentHash,
            add_index: ''
        };
    };

    /**
     * Get invoices (Lightning inbound payments only)
     */
    getInvoices = async (): Promise<any> => {
        const payments = await LdkNode.payments.listPayments();
        // Filter to inbound Lightning payments only (not on-chain)
        const invoices = payments.filter(
            (p) => p.direction === 'inbound' && p.kind.type !== 'onchain'
        );

        return {
            invoices: invoices.map((payment) =>
                this.formatPaymentAsInvoice(payment)
            )
        };
    };

    /**
     * Lookup invoice by payment hash
     */
    lookupInvoice = async (rHash: string): Promise<any> => {
        const payments = await LdkNode.payments.listPayments();
        const payment = payments.find((p) => p.kind.hash === rHash);

        if (payment) {
            return this.formatPaymentAsInvoice(payment);
        }

        throw new Error('Invoice not found');
    };

    // ========================================================================
    // Payment Methods
    // ========================================================================

    /**
     * Pay a BOLT11 invoice
     */
    payLightningInvoice = async (data: any): Promise<any> => {
        const maxTotalRoutingFeeMsat = data.fee_limit_sat
            ? Number(data.fee_limit_sat) * 1000
            : undefined;
        const maxPathCount = data.max_parts
            ? Number(data.max_parts)
            : undefined;

        let paymentId: string;

        if (data.amt) {
            paymentId = await LdkNode.bolt11.sendBolt11UsingAmount({
                invoice: data.payment_request,
                amountMsat: Number(data.amt) * 1000,
                maxTotalRoutingFeeMsat,
                maxPathCount
            });
        } else {
            paymentId = await LdkNode.bolt11.sendBolt11({
                invoice: data.payment_request,
                maxTotalRoutingFeeMsat,
                maxPathCount
            });
        }

        // Wait for payment to complete and get the preimage
        // Poll for up to 60 seconds
        const maxAttempts = 60;
        const delayMs = 1000;
        let payment = null;

        for (let i = 0; i < maxAttempts; i++) {
            const payments = await LdkNode.payments.listPayments();
            payment = payments.find((p) => p.id === paymentId);

            if (payment?.status === 'succeeded') {
                break;
            }
            if (payment?.status === 'failed') {
                throw new Error(localeString('error.paymentFailed'));
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (payment?.status !== 'succeeded') {
            throw new Error(localeString('error.paymentTimedOut'));
        }

        const preimage = payment?.kind.preimage || '';
        const hash = payment?.kind.hash || paymentId;

        return {
            payment_hash: hash,
            payment_preimage: preimage,
            payment_route: {},
            status: 'SUCCEEDED'
        };
    };

    /**
     * Send a keysend (spontaneous) payment
     */
    sendKeysend = async (data: any): Promise<any> => {
        const pubkey = data.pubkey;
        const amt = Number(data.amt);
        const maxTotalRoutingFeeMsat = data.fee_limit_sat
            ? Number(data.fee_limit_sat) * 1000
            : undefined;
        const maxPathCount = data.max_parts
            ? Number(data.max_parts)
            : undefined;

        const paymentId = await LdkNode.spontaneous.sendSpontaneousPayment({
            nodeId: pubkey,
            amountMsat: amt * 1000,
            maxTotalRoutingFeeMsat,
            maxPathCount
        });

        // Wait for payment to complete and get the preimage
        // Poll for up to 60 seconds
        const maxAttempts = 60;
        const delayMs = 1000;
        let payment = null;

        for (let i = 0; i < maxAttempts; i++) {
            const payments = await LdkNode.payments.listPayments();
            payment = payments.find((p) => p.id === paymentId);

            if (payment?.status === 'succeeded') {
                break;
            }
            if (payment?.status === 'failed') {
                throw new Error(localeString('error.paymentFailed'));
            }

            // Wait before next poll
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (payment?.status !== 'succeeded') {
            throw new Error(localeString('error.paymentTimedOut'));
        }

        const preimage = payment?.kind.preimage || '';
        const hash = payment?.kind.hash || paymentId;

        return {
            payment_hash: hash,
            payment_preimage: preimage,
            payment_route: {},
            status: 'SUCCEEDED'
        };
    };

    /**
     * Get payments (Lightning outbound payments only)
     */
    getPayments = async (): Promise<any> => {
        const payments = await LdkNode.payments.listPayments();
        // Filter to outbound Lightning payments only (not on-chain)
        const outboundPayments = payments.filter(
            (p) => p.direction === 'outbound' && p.kind.type !== 'onchain'
        );

        return {
            payments: outboundPayments.map((payment) =>
                this.formatPayment(payment)
            )
        };
    };

    /**
     * List all payments (raw)
     */
    listPayments = async (): Promise<PaymentDetails[]> => {
        return await LdkNode.payments.listPayments();
    };

    /**
     * Decode a payment request
     */
    decodePaymentRequest = async (urlParams?: Array<string>): Promise<any> => {
        const paymentRequest = (urlParams && urlParams[0]) || '';
        const decoded: any = bolt11.decode(paymentRequest);

        // Parse tags for additional fields
        for (let i = 0; i < decoded.tags.length; i++) {
            const tag = decoded.tags[i];
            switch (tag.tagName) {
                case 'purpose_commit_hash':
                    decoded.description_hash = tag.data;
                    break;
                case 'payment_hash':
                    decoded.payment_hash = tag.data;
                    break;
                case 'expire_time':
                    decoded.expiry = tag.data;
                    break;
                case 'description':
                    decoded.description = tag.data;
                    break;
                case 'min_final_cltv_expiry':
                    decoded.cltv_expiry = tag.data;
                    break;
            }
        }

        // Map to expected format
        decoded.destination = decoded.payeeNodeKey;
        decoded.num_satoshis = decoded.satoshis
            ? String(decoded.satoshis)
            : decoded.millisatoshis
            ? String(Math.floor(Number(decoded.millisatoshis) / 1000))
            : '0';
        decoded.num_msat = decoded.millisatoshis || '0';

        return decoded;
    };

    // ========================================================================
    // Peer Methods
    // ========================================================================

    /**
     * Connect to a peer
     */
    connectPeer = async (data: any): Promise<any> => {
        await LdkNode.peers.connect({
            nodeId: data.addr.pubkey,
            address: data.addr.host,
            persist: data.perm !== false
        });

        return {};
    };

    /**
     * Disconnect from a peer
     */
    disconnectPeer = async (pubkey: string): Promise<boolean | null> => {
        try {
            await LdkNode.peers.disconnect(pubkey);
            return true;
        } catch (error) {
            console.error(`Error disconnecting peer ${pubkey}:`, error);
            return null;
        }
    };

    /**
     * List peers
     */
    listPeers = async (): Promise<any[]> => {
        const peers = await LdkNode.peers.listPeers();
        return peers.map((peer) => ({
            pub_key: peer.nodeId,
            address: peer.address,
            inbound: false,
            sync_type: peer.isConnected ? 'ACTIVE_SYNC' : 'UNKNOWN_SYNC'
        }));
    };

    // ========================================================================
    // Event Methods
    // ========================================================================

    /**
     * Get next event (non-blocking)
     */
    nextEvent = async (): Promise<LdkNodeEvent | null> => {
        return await LdkNode.events.nextEvent();
    };

    /**
     * Wait for next event (blocking)
     */
    waitNextEvent = async (): Promise<LdkNodeEvent> => {
        return await LdkNode.events.waitNextEvent();
    };

    /**
     * Mark event as handled
     */
    eventHandled = async (): Promise<void> => {
        await LdkNode.events.eventHandled();
    };

    // ========================================================================
    // LSPS1 Methods
    // ========================================================================

    /**
     * Request a channel from an LSPS1 liquidity provider
     * Note: Must have configured LSPS1 liquidity source during node initialization
     */
    lsps1RequestChannel = async ({
        lspBalanceSat,
        clientBalanceSat,
        channelExpiryBlocks,
        announceChannel = false
    }: {
        lspBalanceSat: number;
        clientBalanceSat: number;
        channelExpiryBlocks: number;
        announceChannel?: boolean;
    }): Promise<Lsps1OrderResponse> => {
        return await LdkNode.lsps1.requestChannel({
            lspBalanceSat,
            clientBalanceSat,
            channelExpiryBlocks,
            announceChannel
        });
    };

    /**
     * Check the status of an LSPS1 channel order
     */
    lsps1CheckOrderStatus = async (
        orderId: string
    ): Promise<Lsps1OrderStatus> => {
        return await LdkNode.lsps1.checkOrderStatus(orderId);
    };

    /**
     * Request inbound liquidity from LSPS1 provider
     * Returns payment info (invoice or on-chain address) to pay for the channel
     */
    requestLsps1Liquidity = async (data: {
        amount_sat: number;
        client_balance_sat?: number;
        expiry_blocks?: number;
        announce_channel?: boolean;
    }): Promise<any> => {
        const response = await this.lsps1RequestChannel({
            lspBalanceSat: data.amount_sat,
            clientBalanceSat: data.client_balance_sat || 0,
            channelExpiryBlocks: data.expiry_blocks || 144 * 365, // ~1 year default
            announceChannel: data.announce_channel || false
        });

        // Extract payment info from bolt11 or onchain payment options
        const paymentInfo = response.paymentInfo || {};
        const bolt11 = paymentInfo.bolt11Invoice;
        const onchain = paymentInfo.onchainPayment;

        return {
            order_id: response.orderId,
            lsp_balance_sat: response.orderParams?.lspBalanceSat,
            client_balance_sat: response.orderParams?.clientBalanceSat,
            funding_confirms_within_blocks:
                response.orderParams?.fundingConfirmsWithinBlocks,
            channel_expiry_blocks: response.orderParams?.channelExpiryBlocks,
            payment: {
                state: paymentInfo.state || bolt11?.state || onchain?.state,
                fee_total_sat:
                    paymentInfo.feeTotalSat ||
                    bolt11?.feeTotalSat ||
                    onchain?.feeTotalSat,
                order_total_sat:
                    paymentInfo.orderTotalSat ||
                    bolt11?.orderTotalSat ||
                    onchain?.orderTotalSat,
                bolt11_invoice: bolt11?.invoice,
                onchain_address: onchain?.address,
                onchain_total_sat: onchain?.orderTotalSat
            },
            channel: response.channelInfo
                ? {
                      funding_txid: response.channelInfo.fundingTxid,
                      funding_vout: response.channelInfo.fundingTxVout,
                      expires_at: response.channelInfo.expiresAt
                  }
                : null
        };
    };

    /**
     * Check LSPS1 order status with formatted response
     */
    checkLsps1OrderStatus = async (orderId: string): Promise<any> => {
        const response = await this.lsps1CheckOrderStatus(orderId);

        // Extract payment info from bolt11 or onchain payment options
        const paymentInfo = response.paymentInfo || {};
        const bolt11 = paymentInfo.bolt11Invoice;
        const onchain = paymentInfo.onchainPayment;

        return {
            order_id: response.orderId,
            lsp_balance_sat: response.orderParams?.lspBalanceSat,
            client_balance_sat: response.orderParams?.clientBalanceSat,
            payment: {
                state: paymentInfo.state || bolt11?.state || onchain?.state,
                fee_total_sat:
                    paymentInfo.feeTotalSat ||
                    bolt11?.feeTotalSat ||
                    onchain?.feeTotalSat,
                order_total_sat:
                    paymentInfo.orderTotalSat ||
                    bolt11?.orderTotalSat ||
                    onchain?.orderTotalSat,
                bolt11_invoice: bolt11?.invoice,
                bolt11_state: bolt11?.state,
                onchain_address: onchain?.address,
                onchain_state: onchain?.state
            },
            channel: response.channelInfo
                ? {
                      funding_txid: response.channelInfo.fundingTxid,
                      funding_vout: response.channelInfo.fundingTxVout,
                      expires_at: response.channelInfo.expiresAt
                  }
                : null
        };
    };

    // ========================================================================
    // LSPS7 Methods
    // ========================================================================

    lsps7GetExtendableChannels = async (): Promise<any> => {
        return await LdkNode.lsps7.getExtendableChannels();
    };

    lsps7CreateOrder = async (params: {
        shortChannelId: string;
        channelExtensionExpiryBlocks: number;
        token?: string;
        refundOnchainAddress?: string;
    }): Promise<any> => {
        const response = await LdkNode.lsps7.createOrder({
            shortChannelId: params.shortChannelId,
            channelExtensionExpiryBlocks: params.channelExtensionExpiryBlocks,
            token: params.token || null,
            refundOnchainAddress: params.refundOnchainAddress || null
        });

        // Transform to match LSPStore expected format
        const paymentInfo = response.paymentInfo || {};
        const bolt11 = paymentInfo.bolt11Invoice;
        const onchain = paymentInfo.onchainPayment;

        return {
            order_id: response.orderId,
            order_state: response.orderState,
            channel_extension_expiry_blocks:
                response.channelExtensionExpiryBlocks,
            new_channel_expiry_block: response.newChannelExpiryBlock,
            payment: {
                state: paymentInfo.state || bolt11?.state || onchain?.state,
                fee_total_sat:
                    paymentInfo.feeTotalSat ||
                    bolt11?.feeTotalSat ||
                    onchain?.feeTotalSat,
                order_total_sat:
                    paymentInfo.orderTotalSat ||
                    bolt11?.orderTotalSat ||
                    onchain?.orderTotalSat,
                bolt11_invoice: bolt11?.invoice,
                onchain_address: onchain?.address,
                onchain_total_sat: onchain?.orderTotalSat
            },
            channel: response.channel
                ? {
                      short_channel_id: response.channel.shortChannelId,
                      max_channel_extension_expiry_blocks:
                          response.channel.maxChannelExtensionExpiryBlocks,
                      expiration_block: response.channel.expirationBlock
                  }
                : null
        };
    };

    lsps7CheckOrderStatus = async (orderId: string): Promise<any> => {
        const response = await LdkNode.lsps7.checkOrderStatus(orderId);

        const paymentInfo = response.paymentInfo || {};
        const bolt11 = paymentInfo.bolt11Invoice;
        const onchain = paymentInfo.onchainPayment;

        return {
            order_id: response.orderId,
            order_state: response.orderState,
            channel_extension_expiry_blocks:
                response.channelExtensionExpiryBlocks,
            new_channel_expiry_block: response.newChannelExpiryBlock,
            payment: {
                state: paymentInfo.state || bolt11?.state || onchain?.state,
                fee_total_sat:
                    paymentInfo.feeTotalSat ||
                    bolt11?.feeTotalSat ||
                    onchain?.feeTotalSat,
                order_total_sat:
                    paymentInfo.orderTotalSat ||
                    bolt11?.orderTotalSat ||
                    onchain?.orderTotalSat,
                bolt11_invoice: bolt11?.invoice,
                bolt11_state: bolt11?.state,
                onchain_address: onchain?.address,
                onchain_state: onchain?.state
            },
            channel: response.channel
                ? {
                      short_channel_id: response.channel.shortChannelId,
                      max_channel_extension_expiry_blocks:
                          response.channel.maxChannelExtensionExpiryBlocks,
                      expiration_block: response.channel.expirationBlock
                  }
                : null
        };
    };

    // ========================================================================
    // BOLT12 / Offers Methods
    // ========================================================================

    createOffer = async ({
        description,
        label: _label,
        singleUse
    }: {
        description?: string;
        label?: string;
        singleUse?: boolean;
    }): Promise<any> => {
        const result = await LdkNode.bolt12.bolt12ReceiveVariableAmount({
            description: description || '',
            expirySecs: 0
        });

        return {
            bolt12: result.offer,
            offer_id: result.offerId,
            active: true,
            single_use: singleUse || false,
            used: false
        };
    };

    listOffers = async (): Promise<any> => {
        // LDK Node doesn't store offers natively
        return { offers: [] };
    };

    disableOffer = async ({ offer_id }: { offer_id: string }): Promise<any> => {
        // No-op: LDK Node doesn't support disabling offers natively
        return { offer_id, active: false };
    };

    fetchInvoiceFromOffer = async (
        bolt12: string,
        amountSatoshis: string
    ): Promise<any> => {
        const paymentId = await LdkNode.bolt12.bolt12SendUsingAmount({
            offer: bolt12,
            amountMsat: Number(amountSatoshis) * 1000
        });

        // Poll for payment completion (up to 60 seconds)
        const maxAttempts = 60;
        const delayMs = 1000;
        let payment = null;

        for (let i = 0; i < maxAttempts; i++) {
            const payments = await LdkNode.payments.listPayments();
            payment = payments.find((p) => p.id === paymentId);

            if (payment?.status === 'succeeded') {
                break;
            }
            if (payment?.status === 'failed') {
                throw new Error(localeString('error.paymentFailed'));
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        const preimage = payment?.kind.preimage || '';
        const hash = payment?.kind.hash || paymentId;

        return {
            payment_hash: hash,
            payment_preimage: preimage,
            status: 'SUCCEEDED'
        };
    };

    createWithdrawalRequest = async ({
        amount,
        description: _description
    }: {
        amount: string;
        description: string;
    }): Promise<any> => {
        const refundStr = await LdkNode.bolt12.bolt12InitiateRefund({
            amountMsat: Number(amount) * 1000,
            expirySecs: 3600
        });

        return { bolt12: refundStr };
    };

    redeemWithdrawalRequest = async ({
        invreq,
        label: _label
    }: {
        invreq: string;
        label: string;
    }): Promise<any> => {
        const invoiceStr = await LdkNode.bolt12.bolt12RequestRefundPayment(
            invreq
        );

        return { bolt12: invoiceStr };
    };

    // ========================================================================
    // Message Signing Methods
    // ========================================================================

    signMessage = async (msg: string) => {
        const signature = await LdkNode.signing.signMessage(msg);
        return { signature };
    };

    verifyMessage = async (data: { msg: string; signature: string }) => {
        const { msg, signature } = data;
        // Get the node's public key to verify against
        const pubkey = await LdkNode.node.nodeId();
        const valid = await LdkNode.signing.verifySignature({
            message: msg,
            signature,
            publicKey: pubkey
        });
        return { valid, pubkey };
    };

    lnurlAuth = async (r_hash: string) => {
        const signed = await this.signMessage(r_hash);
        return {
            signature: new sha256Hash()
                .update(Base64Utils.stringToUint8Array(signed.signature))
                .digest()
        };
    };

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /**
     * Format a channel for Zeus compatibility
     */
    private formatChannel(channel: ChannelDetails): any {
        // Calculate actual balances (capacity + reserve)
        // outboundCapacityMsat is spendable, so add our reserve for total local balance
        const localReserveSats = channel.unspendablePunishmentReserve || 0;
        const remoteReserveSats =
            channel.counterpartyUnspendablePunishmentReserve || 0;

        const localBalanceSats = new BigNumber(channel.outboundCapacityMsat)
            .dividedBy(1000)
            .plus(localReserveSats);
        const remoteBalanceSats = new BigNumber(channel.inboundCapacityMsat)
            .dividedBy(1000)
            .plus(remoteReserveSats);

        return {
            active: channel.isUsable,
            remote_pubkey: channel.counterpartyNodeId,
            channel_point: channel.fundingTxo_txid
                ? `${channel.fundingTxo_txid}:${channel.fundingTxo_vout}`
                : '',
            // Use channel_id (not chan_id) to avoid chanFormat conversion issues
            // LDK channelId is a hex string, not a numeric short channel ID
            channel_id: channel.channelId,
            // Provide short_channel_id directly to prevent chanFormat crash
            short_channel_id: channel.channelId,
            capacity: channel.channelValueSats.toString(),
            local_balance: localBalanceSats.toString(),
            remote_balance: remoteBalanceSats.toString(),
            commit_fee: '0',
            commit_weight: '0',
            fee_per_kw: channel.feerateSatPer1000Weight?.toString() || '0',
            unsettled_balance: '0',
            total_satoshis_sent: '0',
            total_satoshis_received: '0',
            num_updates: '0',
            pending_htlcs: [],
            csv_delay: channel.forceCloseSpendDelay || 0,
            private: !channel.isAnnounced,
            initiator: channel.isOutbound,
            local_chan_reserve_sat:
                channel.unspendablePunishmentReserve?.toString(),
            remote_chan_reserve_sat:
                channel.counterpartyUnspendablePunishmentReserve?.toString(),
            // LDK Node specific
            user_channel_id: channel.userChannelId,
            is_channel_ready: channel.isChannelReady,
            is_usable: channel.isUsable,
            confirmations: channel.confirmations,
            confirmations_required: channel.confirmationsRequired
        };
    }

    /**
     * Format a payment for Zeus compatibility
     */
    private formatPayment(payment: PaymentDetails): any {
        // For Lightning payments, hash and preimage are in the kind object
        const hash = payment.kind.hash || payment.id;
        const preimage = payment.kind.preimage || '';
        const feeMsat = payment.feePaidMsat || 0;

        return {
            payment_hash: hash,
            value: payment.amountMsat
                ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
                : '0',
            value_sat: payment.amountMsat
                ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
                : '0',
            value_msat: payment.amountMsat?.toString() || '0',
            creation_date: payment.latestUpdateTimestamp.toString(),
            fee: new BigNumber(feeMsat).dividedBy(1000).toString(),
            fee_sat: new BigNumber(feeMsat).dividedBy(1000).toFixed(0),
            fee_msat: feeMsat.toString(),
            payment_preimage: preimage,
            status: this.mapPaymentStatus(payment.status),
            failure_reason:
                payment.status === 'failed' ? 'FAILURE_REASON_ERROR' : ''
        };
    }

    /**
     * Format a payment as an invoice for Zeus compatibility
     */
    private formatPaymentAsInvoice(payment: PaymentDetails): any {
        const isSettled = payment.status === 'succeeded';
        // For Lightning payments, hash and preimage are in the kind object
        const hash = payment.kind.hash || '';
        const preimage = payment.kind.preimage || '';

        return {
            memo: '',
            r_preimage: preimage,
            r_hash: hash,
            value: payment.amountMsat
                ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
                : '0',
            value_msat: payment.amountMsat?.toString() || '0',
            settled: isSettled,
            creation_date: payment.latestUpdateTimestamp.toString(),
            settle_date: isSettled
                ? payment.latestUpdateTimestamp.toString()
                : '0',
            payment_request: '',
            expiry: '3600',
            cltv_expiry: '40',
            private: false,
            add_index: '',
            settle_index: '',
            amt_paid: payment.amountMsat
                ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
                : '0',
            amt_paid_sat: payment.amountMsat
                ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
                : '0',
            amt_paid_msat: payment.amountMsat?.toString() || '0',
            state: isSettled
                ? 'SETTLED'
                : payment.status === 'pending'
                ? 'OPEN'
                : 'CANCELED'
        };
    }

    /**
     * Format an on-chain payment as a transaction for Zeus compatibility
     */
    private formatOnchainTransaction(
        payment: PaymentDetails,
        bestBlockHeight: number
    ): any {
        const isInbound = payment.direction === 'inbound';
        const amount = payment.amountMsat
            ? new BigNumber(payment.amountMsat).dividedBy(1000).toString()
            : '0';

        // For on-chain payments, txid is in the kind object
        const txid = payment.kind.txid || payment.id;
        const confirmationStatus = payment.kind.status;
        const isConfirmed =
            confirmationStatus === 'confirmed' ||
            payment.status === 'succeeded';

        const confirmationHeight = payment.kind.confirmationHeight;
        const numConfirmations =
            isConfirmed && confirmationHeight
                ? bestBlockHeight - confirmationHeight + 1
                : 0;

        return {
            tx_hash: txid,
            amount: isInbound ? amount : `-${amount}`,
            num_confirmations: numConfirmations,
            block_height: confirmationHeight || 0,
            time_stamp:
                payment.kind.confirmationTimestamp?.toString() ||
                payment.latestUpdateTimestamp.toString(),
            dest_addresses: [],
            total_fees: '0',
            status: isConfirmed ? 'confirmed' : 'pending'
        };
    }

    /**
     * Map LDK Node payment status to LND status
     */
    private mapPaymentStatus(status: string): string {
        switch (status) {
            case 'succeeded':
                return 'SUCCEEDED';
            case 'pending':
                return 'IN_FLIGHT';
            case 'failed':
                return 'FAILED';
            default:
                return 'UNKNOWN';
        }
    }

    // ========================================================================
    // Capability Flags
    // ========================================================================

    supportsMessageSigning = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsPendingChannels = () => true;
    supportsClosedChannels = () => true;
    supportsMPP = () => true;
    supportsAMP = () => false;
    supportsCoinControl = () => false;
    supportsChannelCoinControl = () => false;
    supportsHopPicking = () => false;
    supportsAccounts = () => false;
    supportsRouting = () => false;
    supportsNodeInfo = () => true;
    supportsWithdrawalRequests = () => true;
    singleFeesEarnedTotal = () => false;
    supportsAddressTypeSelection = () => false;
    supportsNestedSegWit = () => false;
    supportsTaproot = () => true;
    supportsBumpFee = () => false;
    supportsFlowLSP = () => true;
    supportsNetworkInfo = () => true;
    supportsSimpleTaprootChannels = () => false;
    supportsCustomPreimages = () => false;
    supportsSweep = () => false;
    supportsOnchainSendMax = () => true;
    supportsOnchainBatching = () => false;
    supportsChannelBatching = () => false;
    supportsChannelFundMax = () => false;
    supportsLSPScustomMessage = () => false;
    supportsLSPS1rest = () => true; // Use REST API for LSPS1 (Olympus supports this)
    supportsLSPS1native = () => false; // Disabled - Olympus doesn't support native LSPS1 over custom messages
    supportsLSPS7native = () => true;
    supportsOffers = () => true;
    supportsListingOffers = () => false;
    supportsBolt12Address = () => false;
    supportsBolt11BlindedRoutes = () => false;
    supportsAddressesWithDerivationPaths = () => false;
    supportsCustomFeeLimit = () => true;
    isLNDBased = () => false;
    supportsForwardingHistory = () => false;
    supportInboundFees = () => false;
    supportsCashuWallet = () => true;
    supportsAddressMessageSigning = () => false;
    supportsSettingInvoiceExpiration = () => true;
    supportsWatchtowerClient = () => false;
    supportsPeers = () => true;
}
