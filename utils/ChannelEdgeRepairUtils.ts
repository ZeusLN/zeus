import BackendUtils from './BackendUtils';
import { sleep } from './SleepUtils';
import { settingsStore } from '../stores/Stores';
import Log from '../lndmobile/log';

const log = Log('utils/ChannelEdgeRepairUtils.ts');

// lnd defaults for lncli updatechanpolicy, also used to recreate edges
export const DEFAULT_POLICY_BASE_FEE_MSAT = '1000';
export const DEFAULT_POLICY_FEE_RATE_PPM = 1;
export const DEFAULT_POLICY_TIME_LOCK_DELTA = 80;

// A node is retried on later calls while any channel could not be checked or
// repaired, or any peer could not be reconnected, up to this many runs per
// app session
export const MAX_REPAIR_ATTEMPTS = 3;

// lnd drops the old connection asynchronously after DisconnectPeer, so
// ConnectPeer can still report "already connected" for a moment
export const RECONNECT_DELAY_MS = 1000;
export const MAX_RECONNECT_TRIES = 5;

export interface ChannelEdgeRepairResult {
    checked: number;
    repaired: string[];
    failed: string[];
    skipped: string[];
    // Peers of repaired channels that still have to resend their policy
    pendingPeers: string[];
}

const completedNodes = new Set<string>();
const attempts = new Map<string, number>();
const inFlight = new Map<
    string,
    Promise<ChannelEdgeRepairResult | undefined>
>();
const pendingPeersByNode = new Map<string, Set<string>>();

// BackendUtils sends every call to the wallet selected at the time of the
// call, so a run must stop once the user switches away from the wallet it
// was started for
class StaleWalletError extends Error {}

const isCurrentWallet = (lndDir: string): boolean =>
    settingsStore.implementation === 'embedded-lnd' &&
    (settingsStore.lndDir || 'lnd') === lndDir;

const ensureCurrentWallet = (lndDir: string) => {
    if (!isCurrentWallet(lndDir)) throw new StaleWalletError();
};

const isEdgeNotFound = (error: any): boolean =>
    String(error?.message ?? error)
        .toLowerCase()
        .includes('edge not found');

const isAlreadyConnected = (error: any): boolean =>
    String(error?.message ?? error)
        .toLowerCase()
        .includes('already connected');

// lnd can key our edge by the confirmed SCID or an alias rather than the
// chan_id ListChannels reports (zero-conf and scid-alias channels), so check
// every SCID before treating the edge as missing
const channelScids = (channel: any): string[] => {
    const scids = [
        channel.chan_id,
        channel.zero_conf_confirmed_scid,
        ...(channel.alias_scids || [])
    ]
        .filter((scid) => scid != null)
        .map((scid) => scid.toString())
        .filter((scid) => scid !== '0');
    return [...new Set(scids)];
};

type EdgeCheck =
    | { status: 'present'; edge: any }
    | { status: 'missing' }
    | { status: 'unknown' };

const checkEdge = async (channel: any): Promise<EdgeCheck> => {
    for (const scid of channelScids(channel)) {
        try {
            const edge = await BackendUtils.getChannelInfo(scid);
            return { status: 'present', edge };
        } catch (error) {
            if (!isEdgeNotFound(error)) {
                log.w(`Could not check edge for ${channel.channel_point}`, [
                    error
                ]);
                return { status: 'unknown' };
            }
        }
    }
    return { status: 'missing' };
};

const hasPeerPolicy = (edge: any, pubkey: string): boolean => {
    if (edge?.node1_pub === pubkey) return !!edge.node1_policy;
    if (edge?.node2_pub === pubkey) return !!edge.node2_policy;
    return false;
};

const repairChannel = async (channel: any): Promise<boolean> => {
    const [fundingTxId, outputIndex] = channel.channel_point.split(':');
    const data: any = {
        base_fee_msat: DEFAULT_POLICY_BASE_FEE_MSAT,
        fee_rate_ppm: DEFAULT_POLICY_FEE_RATE_PPM,
        time_lock_delta: DEFAULT_POLICY_TIME_LOCK_DELTA,
        create_missing_edge: true,
        chan_point: {
            funding_txid_str: fundingTxId,
            output_index: Number(outputIndex) || 0
        }
    };
    // lnd recreates a missing edge with max_htlc 0, and a blank
    // max_htlc_msat means "keep current", so the update fails validation
    // (min_htlc > max_htlc 0) unless we supply the channel's negotiated max
    // in-flight amount
    const maxPendingAmtMsat =
        channel.local_constraints?.max_pending_amt_msat?.toString();
    if (maxPendingAmtMsat && maxPendingAmtMsat !== '0') {
        data.max_htlc_msat = maxPendingAmtMsat;
    }

    try {
        const response = await BackendUtils.updateChannelPolicy(data);
        const failedUpdates = response?.failed_updates || [];
        if (failedUpdates.length > 0) {
            log.w(
                `Recreating edge for ${
                    channel.channel_point
                } failed: ${failedUpdates
                    .map((f: any) => f.update_error)
                    .join(', ')}`
            );
            return false;
        }
        return true;
    } catch (error) {
        log.e(`Recreating edge for ${channel.channel_point} failed`, [error]);
        return false;
    }
};

const hasPendingHtlcs = async (pubkey: string): Promise<boolean> => {
    const response = await BackendUtils.getChannels();
    return (response?.channels || []).some(
        (channel: any) =>
            channel.remote_pubkey === pubkey &&
            channel.pending_htlcs?.length > 0
    );
};

const reconnectPeer = async (
    lndDir: string,
    pubkey: string,
    host: string
): Promise<boolean> => {
    try {
        ensureCurrentWallet(lndDir);
        // Checked right before the disconnect so payments started during
        // earlier reconnects are seen. The peer stays pending and is
        // reconnected on a later run once its HTLCs are resolved.
        const busy = await hasPendingHtlcs(pubkey);
        ensureCurrentWallet(lndDir);
        if (busy) {
            log.w(`Not reconnecting ${pubkey}: HTLCs in flight`);
            return false;
        }
        // The embedded backend returns null instead of throwing
        if (!(await BackendUtils.disconnectPeer(pubkey))) {
            log.w(`Could not disconnect ${pubkey} to reconnect`);
            return false;
        }
        for (let tries = 1; ; tries++) {
            await sleep(RECONNECT_DELAY_MS);
            ensureCurrentWallet(lndDir);
            try {
                // perm makes lnd keep retrying in the background if the
                // first dial fails
                await BackendUtils.connectPeer({
                    addr: { pubkey, host },
                    perm: true
                });
                return true;
            } catch (error) {
                if (!isAlreadyConnected(error) || tries >= MAX_RECONNECT_TRIES)
                    throw error;
            }
        }
    } catch (error) {
        if (error instanceof StaleWalletError) throw error;
        log.e(`Reconnecting to ${pubkey} failed`, [error]);
        return false;
    }
};

// A recreated edge has no policy from the peer: lnd dropped the peer's
// channel_update because it arrived before the edge existed, and the peer
// only sends it again on reconnect. lnd leaves channels without the peer's
// policy out of invoice route hints, so reconnect to each affected peer,
// except while one of its channels has HTLCs in flight.
// Removes peers from pending once they are reconnected or cannot be helped,
// and leaves the rest for a later run.
const reconnectPeers = async (
    lndDir: string,
    pubkeys: string[],
    pending: Set<string>
) => {
    ensureCurrentWallet(lndDir);
    let peers: any[];
    try {
        peers = (await BackendUtils.listPeers()) || [];
    } catch (error) {
        log.w('Could not list peers to reconnect', [error]);
        return;
    }
    ensureCurrentWallet(lndDir);

    let reconnected = 0;
    for (const pubkey of pubkeys) {
        const peer = peers.find((p: any) => p.pub_key === pubkey);
        // A peer that is not connected sends its channel_update when it
        // next connects. An inbound peer's address is its source port,
        // which we cannot dial, so retrying would not help either.
        if (!peer?.address || peer.inbound) {
            log.w(`Not reconnecting ${pubkey}: no outbound connection`);
            pending.delete(pubkey);
            continue;
        }
        if (await reconnectPeer(lndDir, pubkey, peer.address)) {
            reconnected++;
            pending.delete(pubkey);
        }
    }
    log.i(`Reconnected to ${reconnected} of ${pubkeys.length} peers`);
};

const runRepair = async (lndDir: string): Promise<ChannelEdgeRepairResult> => {
    const result: ChannelEdgeRepairResult = {
        checked: 0,
        repaired: [],
        failed: [],
        skipped: [],
        pendingPeers: []
    };
    // Updated in place so a run stopped by a wallet switch keeps what it
    // recorded
    let pending = pendingPeersByNode.get(lndDir);
    if (!pending) {
        pending = new Set<string>();
        pendingPeersByNode.set(lndDir, pending);
    }

    const response = await BackendUtils.getChannels();
    ensureCurrentWallet(lndDir);
    const channels = (response?.channels || []).filter(
        (channel: any) => channel.channel_point && channel.chan_id
    );

    const peersToReconnect = new Set<string>();
    // Pending peers with a channel that could not be checked this run
    const peersToKeep = new Set<string>();

    // Run one channel at a time to keep load on the database low
    for (const channel of channels) {
        result.checked++;
        const peer = channel.remote_pubkey;
        const edge = await checkEdge(channel);
        ensureCurrentWallet(lndDir);
        if (edge.status === 'present') {
            // A peer whose reconnect failed on an earlier run still needs
            // one until its policy shows up on the edge
            if (pending.has(peer) && !hasPeerPolicy(edge.edge, peer)) {
                peersToReconnect.add(peer);
            }
            continue;
        }
        if (edge.status === 'unknown') {
            result.skipped.push(channel.channel_point);
            if (pending.has(peer)) peersToKeep.add(peer);
            continue;
        }

        log.w(`Missing graph edge for ${channel.channel_point}, recreating`);
        if (await repairChannel(channel)) {
            result.repaired.push(channel.channel_point);
            if (peer) {
                // Recorded before any step a wallet switch can stop
                pending.add(peer);
                peersToReconnect.add(peer);
            }
        } else {
            result.failed.push(channel.channel_point);
        }
    }

    // Pending peers whose policy has arrived or whose channels are gone
    for (const peer of [...pending]) {
        if (!peersToReconnect.has(peer) && !peersToKeep.has(peer)) {
            pending.delete(peer);
        }
    }

    if (peersToReconnect.size > 0) {
        await reconnectPeers(lndDir, [...peersToReconnect], pending);
    }
    result.pendingPeers = [...pending];
    if (pending.size === 0) pendingPeersByNode.delete(lndDir);

    if (
        result.repaired.length > 0 ||
        result.failed.length > 0 ||
        result.skipped.length > 0 ||
        result.pendingPeers.length > 0
    ) {
        log.i(
            `Channel edge repair: ${result.repaired.length} repaired, ${result.failed.length} failed, ${result.skipped.length} skipped, ${result.pendingPeers.length} peers pending, ${result.checked} checked`
        );
    }

    return result;
};

/**
 * Recreates missing graph edges for our own channels. Resetting or rebuilding
 * the SQLite graph database removes them, which breaks getchaninfo and drops
 * the channels from invoice route hints. Reconnects to the peers of repaired
 * channels so they resend their channel_update. Runs until a pass completes
 * cleanly, at most MAX_REPAIR_ATTEMPTS times per node per app session. Does
 * nothing unless lndDir is the selected embedded LND wallet, and stops if the
 * user switches wallets during the run.
 */
export const repairMissingChannelEdges = (
    lndDir: string
): Promise<ChannelEdgeRepairResult | undefined> => {
    const running = inFlight.get(lndDir);
    if (running) return running;
    if (completedNodes.has(lndDir)) return Promise.resolve(undefined);
    if (!isCurrentWallet(lndDir)) return Promise.resolve(undefined);

    const attempt = (attempts.get(lndDir) || 0) + 1;
    if (attempt > MAX_REPAIR_ATTEMPTS) return Promise.resolve(undefined);
    attempts.set(lndDir, attempt);

    const run: Promise<ChannelEdgeRepairResult | undefined> = runRepair(lndDir)
        .then((result) => {
            if (
                result.failed.length === 0 &&
                result.skipped.length === 0 &&
                result.pendingPeers.length === 0
            ) {
                completedNodes.add(lndDir);
            }
            return result;
        })
        .catch((error) => {
            if (!(error instanceof StaleWalletError)) throw error;
            // The run did not finish, so it does not count as an attempt
            attempts.set(lndDir, attempt - 1);
            log.i(`Stopped channel edge repair for ${lndDir}: wallet changed`);
            return undefined;
        })
        .finally(() => inFlight.delete(lndDir));
    inFlight.set(lndDir, run);
    return run;
};

// For tests
export const resetChannelEdgeRepairState = () => {
    completedNodes.clear();
    attempts.clear();
    inFlight.clear();
    pendingPeersByNode.clear();
};
