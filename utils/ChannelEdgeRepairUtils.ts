import BackendUtils from './BackendUtils';
import Log from '../lndmobile/log';

const log = Log('utils/ChannelEdgeRepairUtils.ts');

// lnd defaults for lncli updatechanpolicy, also used to recreate edges
export const DEFAULT_POLICY_BASE_FEE_MSAT = '1000';
export const DEFAULT_POLICY_FEE_RATE_PPM = 1;
export const DEFAULT_POLICY_TIME_LOCK_DELTA = 80;

// A node is retried on later calls while any channel could not be checked or
// repaired, up to this many runs per app session
export const MAX_REPAIR_ATTEMPTS = 3;

export interface ChannelEdgeRepairResult {
    checked: number;
    repaired: string[];
    failed: string[];
    skipped: string[];
}

const completedNodes = new Set<string>();
const attempts = new Map<string, number>();
const inFlight = new Map<string, Promise<ChannelEdgeRepairResult>>();

const isEdgeNotFound = (error: any): boolean =>
    String(error?.message ?? error)
        .toLowerCase()
        .includes('edge not found');

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

const checkEdge = async (
    channel: any
): Promise<'present' | 'missing' | 'unknown'> => {
    for (const scid of channelScids(channel)) {
        try {
            await BackendUtils.getChannelInfo(scid);
            return 'present';
        } catch (error) {
            if (!isEdgeNotFound(error)) {
                log.w(`Could not check edge for ${channel.channel_point}`, [
                    error
                ]);
                return 'unknown';
            }
        }
    }
    return 'missing';
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

const runRepair = async (): Promise<ChannelEdgeRepairResult> => {
    const result: ChannelEdgeRepairResult = {
        checked: 0,
        repaired: [],
        failed: [],
        skipped: []
    };

    const response = await BackendUtils.getChannels();
    const channels = (response?.channels || []).filter(
        (channel: any) => channel.channel_point && channel.chan_id
    );

    // Run one channel at a time to keep load on the database low
    for (const channel of channels) {
        result.checked++;
        const edge = await checkEdge(channel);
        if (edge === 'present') continue;
        if (edge === 'unknown') {
            result.skipped.push(channel.channel_point);
            continue;
        }

        log.w(`Missing graph edge for ${channel.channel_point}, recreating`);
        if (await repairChannel(channel)) {
            result.repaired.push(channel.channel_point);
        } else {
            result.failed.push(channel.channel_point);
        }
    }

    if (
        result.repaired.length > 0 ||
        result.failed.length > 0 ||
        result.skipped.length > 0
    ) {
        log.i(
            `Channel edge repair: ${result.repaired.length} repaired, ${result.failed.length} failed, ${result.skipped.length} skipped, ${result.checked} checked`
        );
    }

    return result;
};

/**
 * Recreates missing graph edges for our own channels. Resetting or rebuilding
 * the SQLite graph database removes them, which breaks getchaninfo and drops
 * the channels from invoice route hints. Runs until a pass completes cleanly,
 * at most MAX_REPAIR_ATTEMPTS times per node per app session.
 */
export const repairMissingChannelEdges = (
    lndDir: string
): Promise<ChannelEdgeRepairResult | undefined> => {
    const running = inFlight.get(lndDir);
    if (running) return running;
    if (completedNodes.has(lndDir)) return Promise.resolve(undefined);

    const attempt = (attempts.get(lndDir) || 0) + 1;
    if (attempt > MAX_REPAIR_ATTEMPTS) return Promise.resolve(undefined);
    attempts.set(lndDir, attempt);

    const run = runRepair()
        .then((result) => {
            if (result.failed.length === 0 && result.skipped.length === 0) {
                completedNodes.add(lndDir);
            }
            return result;
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
};
