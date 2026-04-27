/**
 * Embedded LDK Node Backend for Zeus
 *
 * This backend provides integration with the embedded ldk-node Lightning implementation.
 */

import BigNumber from 'bignumber.js';
import Bolt11Utils from '../utils/Bolt11Utils';
import { Hash as sha256Hash } from 'fast-sha256';

import libraryVersions from '../fetch-libraries-versions.json';
import LdkNodeInjection from '../ldknode/LdkNodeInjection';
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
    PaymentFailureReason,
    ClosureReason,
    Lsps1OrderResponse,
    Lsps1OrderStatus
} from '../ldknode/LdkNode.d';

import OpenChannelRequest from '../models/OpenChannelRequest';
import { settingsStore } from '../stores/Stores';

// Event callback type
type EventCallback = (event: LdkNodeEvent) => void;

export default class LdkNode {
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
        await LdkNodeInjection.utils.initializeNode({
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
        await LdkNodeInjection.node.start();
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
        await LdkNodeInjection.node.stop();
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
                const event = await LdkNodeInjection.events.nextEvent();

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
                    await LdkNodeInjection.events.eventHandled();
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
        await LdkNodeInjection.node.syncWallets();
    };

    /**
     * Generate a new mnemonic
     */
    generateMnemonic = async (wordCount: number = 12): Promise<string> => {
        return await LdkNodeInjection.mnemonic.generateMnemonic(wordCount);
    };

    // ========================================================================
    // Node Info Methods
    // ========================================================================

    /**
     * Get node info (similar to LND's getInfo)
     */
    getMyNodeInfo = async (): Promise<any> => {
        const nodeId = await LdkNodeInjection.node.nodeId();
        const status = await LdkNodeInjection.node.status();

        const network = settingsStore.ldkNetwork || 'mainnet';

        return {
            identity_pubkey: nodeId,
            alias: '', // LDK Node doesn't have built-in alias
            block_height: status.currentBestBlock_height,
            block_hash: status.currentBestBlock_hash,
            synced_to_chain:
                status.isRunning && !!status.latestOnchainWalletSyncTimestamp,
            synced_to_graph: !!status.latestRgsSnapshotTimestamp,
            version: `ldk-node ${libraryVersions['ldk-node'].version}`,
            testnet: network === 'testnet',
            regtest: network === 'regtest',
            signet: network === 'signet' || network === 'mutinynet',
            mutinynet: network === 'mutinynet',
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
        return await LdkNodeInjection.node.status();
    };

    /**
     * Get network graph info
     */
    getNetworkInfo = async (): Promise<any> => {
        const graphInfo = await LdkNodeInjection.node.networkGraphInfo();
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
        const balances = await LdkNodeInjection.node.listBalances();
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
        const [channels, balances, status] = await Promise.all([
            LdkNodeInjection.channel.listChannels(),
            LdkNodeInjection.node.listBalances(),
            LdkNodeInjection.node.status()
        ]);

        const currentBlockHeight = status.currentBestBlock_height;

        let localBalance = new BigNumber(0);
        let remoteBalance = new BigNumber(0);
        let pendingOpenBalance = new BigNumber(0);

        const activeChannelIds = new Set(channels.map((c) => c.channelId));

        for (const channel of channels) {
            if (channel.isChannelReady) {
                const outSats = new BigNumber(
                    channel.outboundCapacityMsat
                ).dividedBy(1000);
                const inSats = new BigNumber(
                    channel.inboundCapacityMsat
                ).dividedBy(1000);
                const localReserve = channel.unspendablePunishmentReserve || 0;
                const remoteReserve =
                    channel.counterpartyUnspendablePunishmentReserve || 0;

                let channelLocal: BigNumber;
                if (outSats.gt(0)) {
                    channelLocal = outSats.plus(localReserve);
                } else {
                    channelLocal = new BigNumber(channel.channelValueSats)
                        .minus(inSats)
                        .minus(remoteReserve)
                        .minus(660);
                    if (channelLocal.lt(0)) channelLocal = new BigNumber(0);
                }
                localBalance = localBalance.plus(channelLocal);
                remoteBalance = remoteBalance.plus(inSats);
            } else {
                // Only count our side: if we opened the channel, our
                // pending balance is the capacity minus the remote reserve.
                // If they opened it, we have no pending balance.
                if (channel.isOutbound) {
                    pendingOpenBalance = pendingOpenBalance.plus(
                        new BigNumber(channel.channelValueSats).minus(
                            channel.counterpartyUnspendablePunishmentReserve ||
                                0
                        )
                    );
                }
            }
        }

        // Include pending close balances (force closes awaiting timelock,
        // cooperative closes awaiting confirmation)
        let pendingCloseBalance = new BigNumber(0);
        for (const lb of balances.lightningBalances) {
            if (lb.type === 'claimableOnChannelClose') continue;
            if (activeChannelIds.has(lb.channelId)) continue;
            pendingCloseBalance = pendingCloseBalance.plus(lb.amountSatoshis);
        }
        for (const sb of balances.pendingBalancesFromChannelClosures) {
            if (sb.channelId && activeChannelIds.has(sb.channelId)) continue;
            // Skip sweeps that have already confirmed on-chain —
            // their value is now in the on-chain wallet balance
            if (
                sb.type === 'awaitingThresholdConfirmations' &&
                sb.confirmationHeight != null &&
                sb.confirmationHeight <= currentBlockHeight
            ) {
                continue;
            }
            pendingCloseBalance = pendingCloseBalance.plus(sb.amountSatoshis);
        }

        const totalPendingBalance =
            pendingOpenBalance.plus(pendingCloseBalance);

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
            pending_open_balance: totalPendingBalance.toString(),
            pending_open_local_balance: {
                sat: totalPendingBalance.toString(),
                msat: totalPendingBalance.times(1000).toString()
            }
        };
    };

    /**
     * Get all balances
     */
    listBalances = async (): Promise<BalanceDetails> => {
        return await LdkNodeInjection.node.listBalances();
    };

    // ========================================================================
    // Channel Methods
    // ========================================================================

    /**
     * Get all channels
     */
    getChannels = async (): Promise<any> => {
        const channels = await LdkNodeInjection.channel.listChannels();
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
        return await LdkNodeInjection.channel.listChannels();
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
        const [channels, balances, closedChannels, status] = await Promise.all([
            LdkNodeInjection.channel.listChannels(),
            LdkNodeInjection.node.listBalances(),
            LdkNodeInjection.channel.listClosedChannels(),
            LdkNodeInjection.node.status()
        ]);

        const currentBlockHeight = status.currentBestBlock_height;

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

        // Collect sweep entries by channelId for non-active channels.
        // Track channels whose sweeps have fully confirmed on-chain so
        // they can be moved to the closed list instead of pending.
        const channelSweeps = new Map<
            string,
            import('../ldknode/LdkNode.d').PendingSweepBalance[]
        >();
        const confirmedSweepChannelIds = new Set<string>();
        for (const sb of balances.pendingBalancesFromChannelClosures) {
            if (!sb.channelId || activeChannelIds.has(sb.channelId)) continue;

            // Drop sweeps that have already confirmed on-chain
            if (
                sb.type === 'awaitingThresholdConfirmations' &&
                sb.confirmationHeight != null &&
                sb.confirmationHeight <= currentBlockHeight
            ) {
                confirmedSweepChannelIds.add(sb.channelId);
                continue;
            }

            const list = channelSweeps.get(sb.channelId) || [];
            list.push(sb);
            channelSweeps.set(sb.channelId, list);
        }

        const pendingClosing: any[] = [];
        const pendingForceClosing: any[] = [];
        const waitingClose: any[] = [];

        // Cooperative closes with balance entries (claimableAwaitingConfirmations
        // with source: coopClose)
        channelLightningBalances.forEach((lbs, channelId) => {
            // Skip channels whose sweeps have already confirmed
            if (confirmedSweepChannelIds.has(channelId)) return;

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

        // Force closes with pending lightning balances
        channelLightningBalances.forEach((lbs, channelId) => {
            // Skip channels whose sweeps have already confirmed
            if (confirmedSweepChannelIds.has(channelId)) return;

            // Skip coop closes (already handled above)
            const isCoopClose = lbs.every(
                (lb) =>
                    lb.type === 'claimableAwaitingConfirmations' &&
                    lb.source === 'coopClose'
            );
            if (isCoopClose) return;

            // Check for pending timelock
            let blocksTilMaturity = 0;
            for (const lb of lbs) {
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

            pendingForceClosing.push({
                channel: {
                    remote_pubkey: counterpartyNodeId,
                    channel_point: closed?.fundingTxo_txid
                        ? `${closed.fundingTxo_txid}:${
                              closed.fundingTxo_vout || 0
                          }`
                        : '',
                    capacity: (
                        closed?.channelCapacitySats || totalSats
                    ).toString(),
                    local_balance: totalSats.toString(),
                    remote_balance: '0',
                    pendingClose: true
                },
                blocks_til_maturity: Math.max(blocksTilMaturity, 0),
                closing_txid: closingTxid
            });
        });

        // Sweep-only entries with no lightning balances — either waiting
        // for broadcast or waiting for sweep confirmations
        channelSweeps.forEach((sweeps, channelId) => {
            if (channelLightningBalances.has(channelId)) return;

            const totalSats = sweeps.reduce(
                (sum, s) => sum + s.amountSatoshis,
                0
            );
            const closed = closedChannelMap.get(channelId);

            const channel = {
                remote_pubkey: closed?.counterpartyNodeId || '',
                channel_point: closed?.fundingTxo_txid
                    ? `${closed.fundingTxo_txid}:${closed.fundingTxo_vout || 0}`
                    : '',
                capacity: (closed?.channelCapacitySats || totalSats).toString(),
                local_balance: totalSats.toString(),
                remote_balance: '0',
                pendingClose: true
            };

            const closingTxid =
                sweeps.find((s) => s.latestSpendingTxid)?.latestSpendingTxid ||
                '';

            if (sweeps.every((s) => s.type === 'pendingBroadcast')) {
                waitingClose.push({ channel });
            } else {
                pendingForceClosing.push({
                    channel,
                    blocks_til_maturity: 0,
                    closing_txid: closingTxid
                });
            }
        });

        // Closed channels with no balance entries that still need attention
        const channelIdsWithBalances = new Set<string>();
        channelLightningBalances.forEach((_, id) =>
            channelIdsWithBalances.add(id)
        );
        channelSweeps.forEach((_, id) => channelIdsWithBalances.add(id));

        for (const cc of closedChannels) {
            if (activeChannelIds.has(cc.channelId)) continue;
            if (channelIdsWithBalances.has(cc.channelId)) continue;
            // Skip channels that never had a funding tx broadcast
            if (!cc.fundingTxo_txid) continue;

            const isCoop = LdkNode.isCooperativeReason(cc.closureReason);
            const localBalanceSats = cc.lastLocalBalanceMsat
                ? Math.floor(cc.lastLocalBalanceMsat / 1000)
                : 0;

            // Cooperative closes: show as pending for 10 minutes
            if (isCoop) {
                const ageSecs =
                    Math.floor(Date.now() / 1000) - cc.closedAtTimestamp;
                if (ageSecs > 10 * 60) continue;

                pendingClosing.push({
                    channel: {
                        remote_pubkey: cc.counterpartyNodeId || '',
                        channel_point: cc.fundingTxo_txid
                            ? `${cc.fundingTxo_txid}:${cc.fundingTxo_vout || 0}`
                            : '',
                        capacity: (cc.channelCapacitySats || 0).toString(),
                        local_balance: localBalanceSats.toString(),
                        remote_balance: '0'
                    },
                    closing_txid: ''
                });
                continue;
            }

            // Force closes with non-zero local balance but no balance
            // entries: commitment tx may not have been broadcast yet.
            // Skip if sweeps already confirmed — funds are recovered.
            // Also skip if the closure reason already indicates the
            // commitment tx confirmed on-chain — if LDK reports no
            // remaining balances, the sweep has fully settled.
            const commitmentConfirmed =
                cc.closureReason?.type === 'commitmentTxConfirmed' ||
                cc.closureReason?.type === 'counterpartyForceClosed';
            if (
                localBalanceSats > 0 &&
                !confirmedSweepChannelIds.has(cc.channelId) &&
                !commitmentConfirmed
            ) {
                pendingForceClosing.push({
                    channel: {
                        remote_pubkey: cc.counterpartyNodeId || '',
                        channel_point: cc.fundingTxo_txid
                            ? `${cc.fundingTxo_txid}:${cc.fundingTxo_vout || 0}`
                            : '',
                        capacity: (
                            cc.channelCapacitySats || localBalanceSats
                        ).toString(),
                        local_balance: localBalanceSats.toString(),
                        remote_balance: '0',
                        pendingClose: true
                    },
                    blocks_til_maturity: 0,
                    closing_txid: ''
                });
            }
        }

        return {
            pending_open_channels: pendingOpen.map((channel) => ({
                channel: this.formatChannel(channel)
            })),
            pending_closing_channels: pendingClosing,
            pending_force_closing_channels: pendingForceClosing,
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
                LdkNodeInjection.channel.listChannels(),
                LdkNodeInjection.channel.listClosedChannels(),
                LdkNodeInjection.node.listBalances(),
                LdkNodeInjection.node.status()
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

        const confirmedSweepChannelIds = new Set<string>();
        for (const sb of balances.pendingBalancesFromChannelClosures) {
            if (!sb.channelId || activeChannelIds.has(sb.channelId)) continue;

            // Drop sweeps that have already confirmed on-chain
            if (
                sb.type === 'awaitingThresholdConfirmations' &&
                sb.confirmationHeight != null &&
                sb.confirmationHeight <= currentBlockHeight
            ) {
                confirmedSweepChannelIds.add(sb.channelId);
                continue;
            }

            ensureEntry(sb.channelId).sweepBalances.push(sb);
        }

        const closedChannels: any[] = [];

        for (const cc of closedChannelList) {
            // Skip channels still in active list
            if (activeChannelIds.has(cc.channelId)) continue;

            // Skip channels that never had a funding tx broadcast
            if (!cc.fundingTxo_txid) continue;

            const isCoop = LdkNode.isCooperativeReason(cc.closureReason);

            // Skip cooperative closes that are still in the pending window
            const ageSecs =
                Math.floor(Date.now() / 1000) - cc.closedAtTimestamp;
            const balEntry = channelBalanceEntries.get(cc.channelId);
            const hasBalanceEntries = !!balEntry;

            if (isCoop && !hasBalanceEntries && ageSecs <= 10 * 60) {
                continue; // Still showing as pending close
            }

            // Skip channels that still have outstanding balances — they
            // belong in the pending tab until fully swept/confirmed
            if (hasBalanceEntries) {
                continue;
            }

            // Force closes with non-zero local balance but no balance
            // entries may have unbroadcast commitment transactions —
            // keep them in pending until funds are recovered.
            // Allow through if sweeps already confirmed on-chain,
            // or if the closure reason indicates the commitment tx
            // already confirmed (funds fully settled by LDK).
            const commitmentConfirmed =
                cc.closureReason?.type === 'commitmentTxConfirmed' ||
                cc.closureReason?.type === 'counterpartyForceClosed';
            if (
                !isCoop &&
                cc.lastLocalBalanceMsat &&
                cc.lastLocalBalanceMsat > 0 &&
                !confirmedSweepChannelIds.has(cc.channelId) &&
                !commitmentConfirmed
            ) {
                continue;
            }

            // Calculate capacity and balance
            const balanceSats = cc.lastLocalBalanceMsat
                ? Math.floor(cc.lastLocalBalanceMsat / 1000)
                : 0;

            const capacitySats = cc.channelCapacitySats || balanceSats;

            const closingTxid = '';

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
                // Only mark as forceClose if there are pending balances
                // (handled in pending list). Fully settled channels in the
                // closed list should not show force-close UI indicators.
                forceClose: false,
                blocks_til_maturity: 0,
                time_locked_balance: '0'
            });
        }

        return { channels: closedChannels };
    };

    /**
     * Open a channel
     */
    openChannelSync = async (data: OpenChannelRequest): Promise<any> => {
        let userChannelId: string;

        const utxoOutpoints =
            data.utxos && data.utxos.length > 0
                ? data.utxos.map((s: string) => {
                      const [utxoTxid, vout] = s.split(':');
                      return { txid: utxoTxid, vout: parseInt(vout) };
                  })
                : null;

        if (data.fundMax) {
            userChannelId = await LdkNodeInjection.channel.openChannelFundMax({
                nodeId: data.node_pubkey_string,
                address: data.host || '',
                pushToCounterpartyMsat: data.push_sat
                    ? Number(data.push_sat) * 1000
                    : undefined,
                announceChannel: !data.privateChannel,
                utxos: utxoOutpoints
            });
        } else if (utxoOutpoints) {
            userChannelId = await LdkNodeInjection.channel.openChannelWithUtxos(
                {
                    nodeId: data.node_pubkey_string,
                    address: data.host || '',
                    channelAmountSats: Number(data.local_funding_amount),
                    pushToCounterpartyMsat: data.push_sat
                        ? Number(data.push_sat) * 1000
                        : undefined,
                    announceChannel: !data.privateChannel,
                    utxos: utxoOutpoints
                }
            );
        } else {
            userChannelId = await LdkNodeInjection.channel.openChannel({
                nodeId: data.node_pubkey_string,
                address: data.host || '',
                channelAmountSats: Number(data.local_funding_amount),
                pushToCounterpartyMsat: data.push_sat
                    ? Number(data.push_sat) * 1000
                    : undefined,
                announceChannel: !data.privateChannel
            });
        }

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
                        const reason = LdkNode.closureReasonToMessage(
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
        if (!reason) return localeString('views.Channel.closureReason.unknown');
        const peerMsg = reason.peerMessage;
        switch (reason.type) {
            case 'counterpartyForceClosed':
                return peerMsg
                    ? localeString(
                          'views.Channel.closureReason.counterpartyForceClosed',
                          { peerMessage: peerMsg }
                      )
                    : localeString(
                          'views.Channel.closureReason.counterpartyForceClosedDefault'
                      );
            case 'counterpartyCoopClosedUnfundedChannel':
                return localeString(
                    'views.Channel.closureReason.counterpartyCoopClosedUnfunded'
                );
            case 'locallyCoopClosedUnfundedChannel':
                return localeString(
                    'views.Channel.closureReason.locallyCoopClosedUnfunded'
                );
            case 'fundingTimedOut':
                return localeString(
                    'views.Channel.closureReason.fundingTimedOut'
                );
            case 'processingError':
                return peerMsg
                    ? localeString(
                          'views.Channel.closureReason.processingError',
                          { peerMessage: peerMsg }
                      )
                    : localeString(
                          'views.Channel.closureReason.processingErrorDefault'
                      );
            case 'disconnectedPeer':
                return localeString(
                    'views.Channel.closureReason.disconnectedPeer'
                );
            case 'peerFeerateTooLow':
                return peerMsg
                    ? localeString(
                          'views.Channel.closureReason.peerFeerateTooLow',
                          { peerMessage: peerMsg }
                      )
                    : localeString(
                          'views.Channel.closureReason.peerFeerateTooLowDefault'
                      );
            case 'holderForceClosed':
                return peerMsg
                    ? localeString(
                          'views.Channel.closureReason.holderForceClosed',
                          { peerMessage: peerMsg }
                      )
                    : localeString(
                          'views.Channel.closureReason.holderForceClosedDefault'
                      );
            case 'legacyCooperativeClosure':
            case 'counterpartyInitiatedCooperativeClosure':
            case 'locallyInitiatedCooperativeClosure':
                return localeString(
                    'views.Channel.closureReason.cooperativeClosure'
                );
            case 'commitmentTxConfirmed':
                return localeString(
                    'views.Channel.closureReason.commitmentTxConfirmed'
                );
            case 'outdatedChannelManager':
                return localeString(
                    'views.Channel.closureReason.outdatedChannelManager'
                );
            case 'fundingBatchClosure':
                return localeString(
                    'views.Channel.closureReason.fundingBatchClosure'
                );
            case 'htlcsTimedOut':
                return localeString(
                    'views.Channel.closureReason.htlcsTimedOut'
                );
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
        const forceClose = urlParams && urlParams[2] ? true : false;

        const channels = await LdkNodeInjection.channel.listChannels();
        const channel = channels.find((c) => c.fundingTxo_txid === fundingTxid);

        if (!channel) {
            throw new Error(
                localeString('error.channelNotFound', { fundingTxid })
            );
        }

        if (forceClose) {
            await LdkNodeInjection.channel.forceCloseChannel({
                userChannelId: channel.userChannelId,
                counterpartyNodeId: channel.counterpartyNodeId
            });
        } else {
            await LdkNodeInjection.channel.closeChannel({
                userChannelId: channel.userChannelId,
                counterpartyNodeId: channel.counterpartyNodeId
            });
        }

        return { success: true };
    };

    // ========================================================================
    // On-chain Methods
    // ========================================================================

    /**
     * Get new on-chain address
     */
    getNewAddress = async (): Promise<any> => {
        const address = await LdkNodeInjection.onchain.newOnchainAddress();
        return {
            address
        };
    };

    /**
     * Get UTXOs for coin control
     */
    getUTXOs = async (): Promise<any> => {
        const utxos = await LdkNodeInjection.onchain.listUtxos();
        return {
            utxos: utxos.map((u) => ({
                outpoint: {
                    txid_str: u.txid,
                    output_index: u.vout
                },
                address: u.address,
                amount_sat: u.value_sats,
                confirmations: u.is_spent ? '0' : '1'
            }))
        };
    };

    /**
     * Send coins on-chain
     */
    sendCoins = async (data: any): Promise<any> => {
        let txid: string;

        if (data.utxos?.length > 0) {
            const outpoints = data.utxos.map((s: string) => {
                const [utxoTxid, vout] = s.split(':');
                return { txid: utxoTxid, vout: parseInt(vout) };
            });
            if (data.send_all) {
                txid =
                    await LdkNodeInjection.onchain.sendAllToOnchainAddressWithUtxos(
                        {
                            address: data.addr,
                            retainReserve: false,
                            utxos: outpoints
                        }
                    );
            } else {
                txid =
                    await LdkNodeInjection.onchain.sendToOnchainAddressWithUtxos(
                        {
                            address: data.addr,
                            amountSats: Number(data.amount),
                            utxos: outpoints
                        }
                    );
            }
        } else if (data.send_all) {
            txid = await LdkNodeInjection.onchain.sendAllToOnchainAddress(
                data.addr
            );
        } else {
            txid = await LdkNodeInjection.onchain.sendToOnchainAddress({
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
            LdkNodeInjection.payments.listPayments(),
            LdkNodeInjection.node.status()
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

            invoice = await LdkNodeInjection.bolt11.receiveBolt11({
                amountMsat,
                description: data.memo || '',
                expirySecs
            });
        } else {
            invoice = await LdkNodeInjection.bolt11.receiveVariableAmountBolt11(
                {
                    description: data.memo || '',
                    expirySecs
                }
            );
        }

        // Decode the invoice to get the payment hash
        let paymentHash = '';
        try {
            const decoded = Bolt11Utils.decode(invoice);
            if (decoded.payment_hash) {
                paymentHash = decoded.payment_hash;
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
        const payments = await LdkNodeInjection.payments.listPayments();
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
        const payments = await LdkNodeInjection.payments.listPayments();
        const payment = payments.find((p) => p.kind.hash === rHash);

        if (payment) {
            return this.formatPaymentAsInvoice(payment);
        }

        throw new Error(
            localeString('stores.NostrWalletConnectStore.error.invoiceNotFound')
        );
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
            paymentId = await LdkNodeInjection.bolt11.sendBolt11UsingAmount({
                invoice: data.payment_request,
                amountMsat: Number(data.amt) * 1000,
                maxTotalRoutingFeeMsat,
                maxPathCount
            });
        } else {
            paymentId = await LdkNodeInjection.bolt11.sendBolt11({
                invoice: data.payment_request,
                maxTotalRoutingFeeMsat,
                maxPathCount
            });
        }

        const { hash, preimage } = await this.awaitPaymentCompletion(paymentId);

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

        const paymentId =
            await LdkNodeInjection.spontaneous.sendSpontaneousPayment({
                nodeId: pubkey,
                amountMsat: amt * 1000,
                maxTotalRoutingFeeMsat,
                maxPathCount
            });

        const { hash, preimage } = await this.awaitPaymentCompletion(paymentId);

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
        const payments = await LdkNodeInjection.payments.listPayments();
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
        return await LdkNodeInjection.payments.listPayments();
    };

    /**
     * Decode a payment request
     */
    decodePaymentRequest = async (urlParams?: Array<string>): Promise<any> => {
        const paymentRequest = (urlParams && urlParams[0]) || '';
        return Bolt11Utils.decode(paymentRequest);
    };

    // ========================================================================
    // Peer Methods
    // ========================================================================

    /**
     * Connect to a peer
     */
    connectPeer = async (data: any): Promise<any> => {
        await LdkNodeInjection.peers.connect({
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
            await LdkNodeInjection.peers.disconnect(pubkey);
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
        const peers = await LdkNodeInjection.peers.listPeers();
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
        return await LdkNodeInjection.events.nextEvent();
    };

    /**
     * Mark event as handled
     */
    eventHandled = async (): Promise<void> => {
        await LdkNodeInjection.events.eventHandled();
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
        return await LdkNodeInjection.lsps1.requestChannel({
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
        return await LdkNodeInjection.lsps1.checkOrderStatus(orderId);
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
        return await LdkNodeInjection.lsps7.getExtendableChannels();
    };

    lsps7CreateOrder = async (params: {
        shortChannelId: string;
        channelExtensionExpiryBlocks: number;
        token?: string;
        refundOnchainAddress?: string;
    }): Promise<any> => {
        const response = await LdkNodeInjection.lsps7.createOrder({
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
        const response = await LdkNodeInjection.lsps7.checkOrderStatus(orderId);

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
        const result =
            await LdkNodeInjection.bolt12.bolt12ReceiveVariableAmount({
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
        const paymentId = await LdkNodeInjection.bolt12.bolt12SendUsingAmount({
            offer: bolt12,
            amountMsat: Number(amountSatoshis) * 1000
        });

        const { hash, preimage } = await this.awaitPaymentCompletion(paymentId);

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
        const refundStr = await LdkNodeInjection.bolt12.bolt12InitiateRefund({
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
        const invoiceStr =
            await LdkNodeInjection.bolt12.bolt12RequestRefundPayment(invreq);

        return { bolt12: invoiceStr };
    };

    // ========================================================================
    // Message Signing Methods
    // ========================================================================

    signMessage = async (msg: string) => {
        const signature = await LdkNodeInjection.signing.signMessage(msg);
        return { signature };
    };

    verifyMessage = async (data: {
        msg: string;
        signature: string;
        pubkey: string;
    }) => {
        const { msg, signature, pubkey } = data;
        const valid = await LdkNodeInjection.signing.verifySignature({
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
     * Poll listPayments until the given payment succeeds or fails.
     * Captures failure reason from events for better error messages.
     * Returns the completed payment or throws on failure/timeout.
     */
    private awaitPaymentCompletion = async (
        paymentId: string
    ): Promise<{ hash: string; preimage: string }> => {
        const maxAttempts = 60;
        const delayMs = 1000;
        let payment = null;
        let failureReason: PaymentFailureReason | undefined;

        // Subscribe to events to capture the failure reason
        const unsubscribe = this.subscribeToEvents((event: LdkNodeEvent) => {
            if (
                event.type === 'paymentFailed' &&
                event.paymentId === paymentId
            ) {
                failureReason = event.reason;
            }
        });

        try {
            for (let i = 0; i < maxAttempts; i++) {
                const payments = await LdkNodeInjection.payments.listPayments();
                payment = payments.find((p) => p.id === paymentId);

                if (payment?.status === 'succeeded') {
                    break;
                }
                if (payment?.status === 'failed') {
                    throw new Error(failureReason || 'PAYMENT_FAILED_UNKNOWN');
                }

                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            if (payment?.status !== 'succeeded') {
                throw new Error(localeString('error.paymentTimedOut'));
            }

            return {
                hash: payment?.kind.hash || paymentId,
                preimage: payment?.kind.preimage || ''
            };
        } finally {
            unsubscribe();
        }
    };

    /**
     * Format a channel for Zeus compatibility
     */
    private formatChannel(channel: ChannelDetails): any {
        const localReserveSats = channel.unspendablePunishmentReserve || 0;
        const remoteReserveSats =
            channel.counterpartyUnspendablePunishmentReserve || 0;

        const outboundSats = new BigNumber(
            channel.outboundCapacityMsat
        ).dividedBy(1000);
        const inboundSats = new BigNumber(
            channel.inboundCapacityMsat
        ).dividedBy(1000);

        let localBalanceSats: BigNumber;
        if (outboundSats.gt(0)) {
            // Normal case: outbound + our reserve = local balance
            localBalanceSats = outboundSats.plus(localReserveSats);
        } else {
            // Below reserve: outbound is 0, derive from capacity.
            // The commit fee is already reflected in inboundCapacityMsat,
            // so only subtract the remote reserve and anchor outputs
            // (2 × 330 sats for anchor channels).
            localBalanceSats = new BigNumber(channel.channelValueSats)
                .minus(inboundSats)
                .minus(remoteReserveSats)
                .minus(660);
            if (localBalanceSats.lt(0)) localBalanceSats = new BigNumber(0);
        }
        const remoteBalanceSats = new BigNumber(channel.channelValueSats).minus(
            localBalanceSats
        );

        return {
            active: channel.isUsable,
            remote_pubkey: channel.counterpartyNodeId,
            channel_point: channel.fundingTxo_txid
                ? `${channel.fundingTxo_txid}:${channel.fundingTxo_vout}`
                : '',
            // chan_id is the numeric SCID (used by chanFormat for NNNxNNNxNNN)
            chan_id: channel.shortChannelId || '',
            // channel_id is the 32-byte hex channel ID
            channel_id: channel.channelId,
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
    supportsMessageVerification = () => true;
    requiresVerifyPubkey = () => true;
    supportsLnurlAuth = () => true;
    supportsOnchainBalance = () => true;
    supportsOnchainSends = () => true;
    supportsOnchainReceiving = () => true;
    supportsLightningSends = () => true;
    supportsKeysend = () => true;
    supportsChannelManagement = () => true;
    supportsCircularRebalancing = () => false;
    supportsForceClose = () => true;
    supportsPendingChannels = () => true;
    supportsClosedChannels = () => true;
    supportsMPP = () => true;
    supportsAMP = () => false;
    supportsCoinControl = () => true;
    supportsChannelCoinControl = () => true;
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
    supportsChannelFundMax = () => true;
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
    supportsNostrWalletConnectService = () => true;
}
