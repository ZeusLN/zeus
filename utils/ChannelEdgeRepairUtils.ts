import BackendUtils from './BackendUtils';
import Log from '../lndmobile/log';

const log = Log('utils/ChannelEdgeRepairUtils.ts');

// lnd defaults for lncli updatechanpolicy, also used to recreate edges
export const DEFAULT_POLICY_BASE_FEE_MSAT = '1000';
export const DEFAULT_POLICY_FEE_RATE_PPM = 1;
export const DEFAULT_POLICY_TIME_LOCK_DELTA = 80;

export interface ChannelEdgeRepairResult {
    checked: number;
    repaired: string[];
    failed: string[];
}

const checkedNodes = new Set<string>();
let inFlight: Promise<ChannelEdgeRepairResult> | null = null;

const isEdgeNotFound = (error: any): boolean =>
    String(error?.message ?? error)
        .toLowerCase()
        .includes('edge not found');

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
        failed: []
    };

    const response = await BackendUtils.getChannels();
    const channels = (response?.channels || []).filter(
        (channel: any) => channel.channel_point && channel.chan_id
    );

    // Run one channel at a time to keep load on the database low
    for (const channel of channels) {
        result.checked++;
        try {
            await BackendUtils.getChannelInfo(channel.chan_id);
            continue;
        } catch (error) {
            if (!isEdgeNotFound(error)) {
                log.w(`Could not check edge for ${channel.channel_point}`, [
                    error
                ]);
                continue;
            }
        }

        log.w(`Missing graph edge for ${channel.channel_point}, recreating`);
        if (await repairChannel(channel)) {
            result.repaired.push(channel.channel_point);
        } else {
            result.failed.push(channel.channel_point);
        }
    }

    if (result.repaired.length > 0 || result.failed.length > 0) {
        log.i(
            `Channel edge repair: ${result.repaired.length} repaired, ${result.failed.length} failed, ${result.checked} checked`
        );
    }

    return result;
};

/**
 * Recreates missing graph edges for our own channels. Resetting or rebuilding
 * the SQLite graph database removes them, which breaks getchaninfo and route
 * hints. Runs at most once per node per app session.
 */
export const repairMissingChannelEdges = async (
    lndDir: string
): Promise<ChannelEdgeRepairResult | undefined> => {
    if (inFlight) return inFlight;
    if (checkedNodes.has(lndDir)) return;

    inFlight = runRepair();
    try {
        const result = await inFlight;
        checkedNodes.add(lndDir);
        return result;
    } finally {
        inFlight = null;
    }
};

// For tests
export const resetChannelEdgeRepairState = () => {
    checkedNodes.clear();
    inFlight = null;
};
